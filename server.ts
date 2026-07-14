/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser
  app.use(express.json({ limit: "10mb" }));

  // API: Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // API: SMR Gemini Expert Advisor
  app.post("/api/gemini-advisor", async (req, res) => {
    try {
      const { inputs, results } = req.body;

      if (!inputs || !results) {
        res.status(400).json({ error: "Missing simulation inputs or results." });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        res.status(400).json({
          error: "Gemini API key is not configured. Please open Settings > Secrets in the AI Studio panel to set your GEMINI_API_KEY."
        });
        return;
      }

      // Initialize the official Google Gen AI Client on the server
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const stepsLength = results.steps?.length || 0;
      const outletTemp = stepsLength > 0 ? results.steps[stepsLength - 1].temp.toFixed(1) : "N/A";

      // Construct a highly detailed prompt with chemical engineering domain instructions
      const prompt = `
You are a Senior Chemical Process Engineer specializing in Steam Methane Reforming (SMR) plants and furnace operations.
Analyze the following SMR simulation run and provide an executive high-fidelity engineering evaluation report.

================ SMR OPERATIONS INPUT DATA ================
- Process Gas Flow: ${inputs.Gas_Flow} NMC/hr
- Process Steam Flow: ${inputs.Steam_Flow} T/hr
- Inlet Temperature: ${inputs.T_in_C} °C
- Inlet Pressure: ${inputs.P_in} bar
- Feed Gas Mol%: CH4: ${inputs.CH4}%, H2: ${inputs.H2}%, C2H6: ${inputs.C2H6}%, CO2: ${inputs.CO2}%, CO: ${inputs.CO}%, N2: ${inputs.N2}%, Ar: ${inputs.Ar}%
- Fuel Gas Mol%: CH4: ${inputs.fuel_CH4}%, C2H6: ${inputs.fuel_C2H6}%, CO2: ${inputs.fuel_CO2}%, N2: ${inputs.fuel_N2}%
- Total Burner Fuel: ${inputs.total_fuel} NMC/hr
- Number of Tubes in Radiant Box: ${inputs.N_tubes}
- Radiant Box Thermal Efficiency: ${inputs.efficiency}%
- Tube Length: ${inputs.L} m | OD: ${inputs.OD} mm | ID: ${inputs.Di} mm
- Catalyst Bulk Density: ${inputs.rho_b} kg/m³ | Particle Dia: ${inputs.dp} mm | Bed Voidage: ${inputs.eps}
- Catalyst Activity Factor: ${inputs.cat_activity}x
- Fouling Pressure Drop Factor: ${inputs.dp_factor}x
- Desired Outlet Gas Target Temp: ${inputs.T_out_target} °C

================ SIMULATION RESULTS ================
- Calculated Fuel LHV: ${results.lhvFuel.toFixed(1)} kcal/NMC
- Total Burner Thermal Release: ${results.totalThermalReleaseGcal.toFixed(3)} Gcal/hr
- Total Radiant Heat Absorbed by Tubes: ${results.totalRadiantAbsorbedGcal.toFixed(3)} Gcal/hr
- Average Tube Heat Flux: ${results.averageHeatFlux.toFixed(1)} kcal/m²·hr
- Actual Outlet Temp Reached in Tube: ${outletTemp} °C
- Target Intercept Pressure: ${results.interpolatedAtTarget?.pressure?.toFixed(3) || "N/A"} bar
- SMR Reformer Equilibrium Approach Temp (dT_approach): ${results.interpolatedAtTarget?.approachToEquilibrium?.toFixed(2) || "N/A"} °C
- Theoretical Thermodynamic Eq Temp: ${results.interpolatedAtTarget?.theoreticalEqTemp?.toFixed(1) || "N/A"} °C
- Dry Gas Output Composition at Target Temp:
  CH4: ${results.interpolatedAtTarget?.dryComposition?.CH4?.toFixed(3) || "N/A"}% (Methane Slippage)
  H2: ${results.interpolatedAtTarget?.dryComposition?.H2?.toFixed(3) || "N/A"}%
  CO: ${results.interpolatedAtTarget?.dryComposition?.CO?.toFixed(3) || "N/A"}%
  CO2: ${results.interpolatedAtTarget?.dryComposition?.CO2?.toFixed(3) || "N/A"}%
  N2: ${results.interpolatedAtTarget?.dryComposition?.N2?.toFixed(3) || "N/A"}%

Based on these parameters, please generate a highly professional and structured evaluation report with the following sections:
1. **Executive Evaluation**: Grade the current SMR configuration (Optimal, Marginal, Critical). Address whether the targeted outlet temperature was reached and evaluate the heat flux level.
2. **Steam-to-Carbon (S/C) Ratio Analysis**: Calculate and evaluate the approximate Steam-to-Carbon molar ratio. Warn if there is a severe coking risk (S/C < 2.0).
3. **Catalyst Activity & Pressure Drop Assessment**: Analyze the catalyst health. Evaluate how the catalyst activity factor (${inputs.cat_activity}x) and the fouling pressure drop factor (${inputs.dp_factor}x) impact operations (e.g. compression cost, throughput, thermal stresses).
4. **Combustion & Thermal Profile Evaluation**: Critique the burner hydraulics across rows. Discuss if the sub-header pressures and burner count are distributing heat correctly or creating local hot-spots.
5. **Actionable Recommendations**: Give 3 distinct, high-impact actionable items to optimize hydrogen yield, reduce methane slippage, or extend catalyst lifetime.

Keep your response highly technical, detailed, elegant, and directly useful to refinery operators. Do not use generic filler words. Write the response in beautiful clean Markdown.
`;

      // Simple, robust exponential backoff retry for transient Gemini 503 errors
      let response: any = null;
      let attempt = 0;
      const maxRetries = 3;
      while (attempt < maxRetries) {
        try {
          response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt,
          });
          break; // success
        } catch (genErr: any) {
          attempt++;
          const errString = String(genErr?.message || genErr);
          const isTransient = genErr?.status === 503 || errString.includes("503") || errString.includes("UNAVAILABLE") || errString.includes("high demand");
          if (isTransient && attempt < maxRetries) {
            console.warn(`[SMR Server] Gemini API 503 on attempt ${attempt}. Retrying in ${attempt * 1000}ms...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
            continue;
          }
          throw genErr; // final attempt or non-transient error
        }
      }

      const reportText = response?.text || "No report could be generated.";
      res.json({ report: reportText });

    } catch (err: any) {
      console.error("Gemini API Error:", err);
      res.status(500).json({
        error: `Failed to generate advisor report: ${err?.message || String(err)}`
      });
    }
  });

  // Vite Integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware integrated.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving production static files from /dist.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SMR Server] Custom server is running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
