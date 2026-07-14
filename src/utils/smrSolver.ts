/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SMRInputs {
  Gas_Flow: number;        // Process Gas Flow (NMC/hr)
  Steam_Flow: number;      // Process Steam Flow (T/hr)
  P_in: number;            // Inlet Pressure (kg/cm²g)
  T_in_C: number;          // Inlet Temp (°C)
  total_fuel: number;      // Total Burner Fuel (NMC/hr)
  N_tubes: number;         // Number of tubes
  T_out_target: number;    // Actual Outlet Temp (°C)
  CH4: number;             // Feed CH4 mol%
  H2: number;              // Feed H2 mol%
  C2H6: number;            // Feed C2H6 mol%
  N2: number;              // Feed N2 mol%
  CO2: number;             // Feed CO2 mol%
  Ar: number;              // Feed Ar mol%
  CO: number;              // Feed CO mol%
  fuel_CH4: number;        // Fuel CH4 %
  fuel_C2H6: number;       // Fuel C2H6 %
  fuel_N2: number;         // Fuel N2 %
  fuel_CO2: number;        // Fuel CO2 %
  cat_activity: number;    // Catalyst Activity Factor
  dp_factor: number;       // DP Factor (Fines/Fouling)
  L: number;               // Tube Length (m)
  OD: number;              // Tube OD (mm)
  Di: number;              // Tube ID (mm)
  rho_b: number;           // Catalyst Bulk Density (kg/m³)
  dp: number;              // Particle Diameter (mm)
  eps: number;             // Bed Voidage Fraction
  efficiency: number;      // Radiant Box Efficiency (%)
  num_subheaders: number;  // Number of Sub Headers
  p_subheaders_str: string; // Sub-Header pressures (Top to Bot), comma separated
  burners_per_row_str: string; // Burners/Row (Top to Bot), comma separated
  length_divisions: number; // Length Grid Divisions
}

export interface ZoneSummary {
  rowNum: string;
  pressure: number;
  burners: number;
  flow: number;
  heatRelease: number;
  heatPerBurner: number;
  localFlux: number;
}

export interface StepProfile {
  z: number;
  temp: number;
  press: number;
  dryCH4: number;
  dryH2: number;
  dryCO: number;
  dryCO2: number;
  dryN2: number;
  dryAr: number;
  dryTotal: number;
  wetCH4: number;
  wetH2: number;
  wetH2O: number;
  wetCO: number;
  wetCO2: number;
  wetN2: number;
  wetAr: number;
  wetTotal: number;
  fluxKw: number;
}

export interface SMRResult {
  success: boolean;
  error?: string;
  steps: StepProfile[];
  zoneSummaries: ZoneSummary[];
  lhvFuel: number;
  totalThermalReleaseGcal: number;
  totalRadiantAbsorbedGcal: number;
  totalSurfaceArea: number;
  averageHeatFlux: number;
  interpolatedAtTarget: {
    targetTemp: number;
    pressure: number;
    approachToEquilibrium: number;
    theoreticalEqTemp: number;
    dryComposition: Record<string, number>;
    wetComposition: Record<string, number>;
  };
}

// Thermodynamic critical constants & Molecular weights
const TC: Record<string, number> = { CH4: 190.58, H2O: 647.13, CO: 132.92, CO2: 304.19, H2: 33.18, N2: 126.1, Ar: 150.8 };
const PC: Record<string, number> = { CH4: 46.948, H2O: 224.899, CO: 35.680, CO2: 75.276, H2: 13.389, N2: 34.609, Ar: 48.1 };
const MW: Record<string, number> = { CH4: 16.043, H2O: 18.015, CO: 28.010, CO2: 44.009, H2: 2.016, N2: 28.013, Ar: 39.948 };

export function runSMRSimulation(inputs: SMRInputs): SMRResult {
  try {
    // --- Part A: Validation and Fuel/Burner Hydraulics ---
    const feedSum = inputs.CH4 + inputs.H2 + inputs.C2H6 + inputs.N2 + inputs.CO2 + inputs.Ar + inputs.CO;
    if (Math.abs(feedSum - 100.0) > 0.01) {
      return {
        success: false,
        error: `Feed Gas Composition sums to ${feedSum.toFixed(3)}%. It must equal exactly 100%.`,
        steps: [],
        zoneSummaries: [],
        lhvFuel: 0,
        totalThermalReleaseGcal: 0,
        totalRadiantAbsorbedGcal: 0,
        totalSurfaceArea: 0,
        averageHeatFlux: 0,
        interpolatedAtTarget: {
          targetTemp: 0,
          pressure: 0,
          approachToEquilibrium: 0,
          theoreticalEqTemp: 0,
          dryComposition: {},
          wetComposition: {}
        }
      };
    }

    const fuelSum = inputs.fuel_CH4 + inputs.fuel_C2H6 + inputs.fuel_N2 + inputs.fuel_CO2;
    if (Math.abs(fuelSum - 100.0) > 0.01) {
      return {
        success: false,
        error: `Fuel Gas Composition sums to ${fuelSum.toFixed(3)}%. It must equal exactly 100%.`,
        steps: [],
        zoneSummaries: [],
        lhvFuel: 0,
        totalThermalReleaseGcal: 0,
        totalRadiantAbsorbedGcal: 0,
        totalSurfaceArea: 0,
        averageHeatFlux: 0,
        interpolatedAtTarget: {
          targetTemp: 0,
          pressure: 0,
          approachToEquilibrium: 0,
          theoreticalEqTemp: 0,
          dryComposition: {},
          wetComposition: {}
        }
      };
    }

    const pSub = inputs.p_subheaders_str.split(",").map(p => parseFloat(p.trim())).filter(p => !isNaN(p));
    const nBurners = inputs.burners_per_row_str.split(",").map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));

    if (pSub.length !== inputs.num_subheaders || nBurners.length !== inputs.num_subheaders) {
      return {
        success: false,
        error: `Mismatch between subheader count (${inputs.num_subheaders}) and pressure/burner string inputs (${pSub.length}/${nBurners.length} rows detected).`,
        steps: [],
        zoneSummaries: [],
        lhvFuel: 0,
        totalThermalReleaseGcal: 0,
        totalRadiantAbsorbedGcal: 0,
        totalSurfaceArea: 0,
        averageHeatFlux: 0,
        interpolatedAtTarget: {
          targetTemp: 0,
          pressure: 0,
          approachToEquilibrium: 0,
          theoreticalEqTemp: 0,
          dryComposition: {},
          wetComposition: {}
        }
      };
    }

    // Dynamic LHV calculation based on custom fuel mix (N2 and CO2 contribute 0 kcal/NMC)
    const LHV_CH4 = 8550.0;   // kcal/NMC
    const LHV_C2H6 = 15200.0; // kcal/NMC
    const lhvFuel = (inputs.fuel_CH4 / 100.0) * LHV_CH4 + (inputs.fuel_C2H6 / 100.0) * LHV_C2H6;
    const qTotalRelease = inputs.total_fuel * lhvFuel; // kcal/hr

    const L = inputs.L;
    const Di = inputs.Di / 1000.0;  // mm to m
    const OD = inputs.OD / 1000.0;  // mm to m
    const N_tubes = inputs.N_tubes;

    const surfaceAreaPerTube = Math.PI * OD * L;
    const totalSurfaceArea = N_tubes * surfaceAreaPerTube;
    const areaPerZone = totalSurfaceArea / inputs.num_subheaders;

    const rowTerms = pSub.map((p_g, i) => Math.sqrt(p_g) * nBurners[i]);
    const sumRowTerms = rowTerms.reduce((sum, val) => sum + val, 0);
    if (sumRowTerms === 0) {
      throw new Error("Sum of hydraulic pressure factors cannot be zero.");
    }

    const zoneFluxesKcal: number[] = [];
    const zoneSummaries: ZoneSummary[] = [];

    for (let i = 0; i < inputs.num_subheaders; i++) {
      const rowNum = inputs.num_subheaders - i;
      const n_i = nBurners[i];
      const rowTerm = rowTerms[i];

      const rowFlow = (rowTerm / sumRowTerms) * inputs.total_fuel;
      const rowHeatRelease = rowFlow * lhvFuel;
      const heatPerBurner = n_i > 0 ? rowHeatRelease / n_i : 0;
      const rowHeatAbsorbed = rowHeatRelease * (inputs.efficiency / 100.0);
      const localFluxKcal = rowHeatAbsorbed / areaPerZone;

      zoneFluxesKcal.push(localFluxKcal);
      zoneSummaries.push({
        rowNum: `Row ${rowNum}`,
        pressure: pSub[i],
        burners: n_i,
        flow: rowFlow,
        heatRelease: rowHeatRelease / 1e6, // convert to Gcal/hr
        heatPerBurner: heatPerBurner,
        localFlux: localFluxKcal
      });
    }

    // --- Part B: Kinetic Process Simulation Core Setup ---
    const Gas_Flow_Total = inputs.Gas_Flow;
    const Steam_Flow_Total = inputs.Steam_Flow;
    const P_in = inputs.P_in;
    const T_in_C = inputs.T_in_C;
    const cat_activity = inputs.cat_activity;
    const dp_factor = inputs.dp_factor;
    const rho_b = inputs.rho_b;
    const dp = inputs.dp / 1000.0; // mm to m
    const eps = inputs.eps;
    const length_divisions = inputs.length_divisions;

    const Ac = (Math.PI / 4) * (Di ** 2);
    const ai = Math.PI * Di;
    const ao = Math.PI * OD;

    const frac_CH4  = inputs.CH4 / 100.0;
    const frac_H2   = inputs.H2 / 100.0;
    const frac_C2H6 = inputs.C2H6 / 100.0;
    const frac_N2   = inputs.N2 / 100.0;
    const frac_CO2  = inputs.CO2 / 100.0;
    const frac_Ar   = inputs.Ar / 100.0;
    const frac_CO   = inputs.CO / 100.0;

    const F_gas_tube = (Gas_Flow_Total / 22.414) / N_tubes;
    const F_steam_tube = (Steam_Flow_Total * 1000 / 18.015) / N_tubes;

    // Inlet molar flow rates in kmol/hr per tube
    let F_CH4_0  = F_gas_tube * frac_CH4;
    const F_C2H6_0 = F_gas_tube * frac_C2H6;
    const F_N2_0   = F_gas_tube * frac_N2;
    const F_CO2_0  = F_gas_tube * frac_CO2;
    let F_H2_0   = F_gas_tube * frac_H2;
    const F_Ar_0   = F_gas_tube * frac_Ar;
    let F_CO_0   = F_gas_tube * frac_CO;
    let F_H2O_0  = F_steam_tube;

    // Pre-reform thermal cracking equivalence for higher hydrocarbons (C2H6)
    F_CH4_0  = F_CH4_0 + F_C2H6_0;
    F_CO_0   = F_CO_0 + F_C2H6_0;
    F_H2_0   = F_H2_0 + 3 * F_C2H6_0;
    F_H2O_0  = Math.max(1e-3, F_H2O_0 - F_C2H6_0);

    const T_in_K = T_in_C + 273.15;

    // Helper to get local flux parameters at position z
    const getLocalFluxParameters = (z_pos: number): number => {
      let zoneIndex = Math.floor(z_pos / (L / inputs.num_subheaders));
      zoneIndex = Math.max(0, Math.min(zoneIndex, inputs.num_subheaders - 1));
      const fluxKcalM2hr = zoneFluxesKcal[zoneIndex];
      const fluxKJM2hr = fluxKcalM2hr * 4.184;
      return fluxKJM2hr * ao / ai;
    };

    // ODE derivative evaluation
    // State: [F_CH4, F_H2O, F_CO, F_CO2, F_H2, T_K, P]
    const derivatives = (z: number, state: number[]): number[] => {
      const [F_CH4, F_H2O, F_CO, F_CO2, F_H2, T, P] = state;
      const F_total = F_CH4 + F_H2O + F_CO + F_CO2 + F_H2 + F_N2_0 + F_Ar_0;

      const P_CH4 = Math.max(1e-5, (F_CH4 / F_total) * P);
      const P_H2O = Math.max(1e-5, (F_H2O / F_total) * P);
      const P_CO  = Math.max(1e-5, (F_CO / F_total) * P);
      const P_CO2 = Math.max(1e-5, (F_CO2 / F_total) * P);
      const P_H2  = Math.max(1e-5, (F_H2 / F_total) * P);

      const R_gas = 8.3144e-3; // kJ/(mol*K)

      const k1 = 4.225e15 * Math.exp(-240.1 / (R_gas * T));
      const k2 = 1.955e6  * Math.exp(-67.1 / (R_gas * T));
      const k3 = 1.020e15 * Math.exp(-243.9 / (R_gas * T));

      const K_CO  = 8.23e-5 * Math.exp(70.6 / (R_gas * T));
      const K_H2  = 6.12e-9 * Math.exp(82.9 / (R_gas * T));
      const K_CH4 = 6.65e-4 * Math.exp(38.3 / (R_gas * T));
      const K_H2O = 1.77e5  * Math.exp(-88.7 / (R_gas * T));

      const K_P1 = Math.exp(-26830 / T + 30.114) * (0.98692 ** 2);
      const K_P2 = Math.exp(4400 / T - 4.036);
      const K_P3 = K_P1 * K_P2;

      const DEN = 1.0 + K_CO * P_CO + K_H2 * P_H2 + K_CH4 * P_CH4 + (K_H2O * P_H2O) / P_H2;

      // Rate formulations (Xu and Froment kinetics)
      const r1 = (k1 / Math.pow(P_H2, 2.5)) * (P_CH4 * P_H2O - (P_CO * Math.pow(P_H2, 3)) / K_P1) / (DEN ** 2);
      const r2 = (k2 / P_H2) * (P_CO * P_H2O - (P_CO2 * P_H2) / K_P2) / (DEN ** 2);
      const r3 = (k3 / Math.pow(P_H2, 3.5)) * (P_CH4 * (P_H2O ** 2) - (P_CO2 * Math.pow(P_H2, 4)) / K_P3) / (DEN ** 2);

      const eta1 = 0.015 + 0.085 * (z / L);
      const eta2 = 0.45;
      const eta3 = 0.015 + 0.085 * (z / L);

      const r1_app = cat_activity * eta1 * r1;
      const r2_app = cat_activity * eta2 * r2;
      const r3_app = cat_activity * eta3 * r3;

      const dH1 = 206100.0; // kJ/kmol
      const dH2 = -41100.0; // kJ/kmol
      const dH3 = dH1 + dH2;

      const Cp_CH4 = 34.3 + 0.0546 * T;
      const Cp_H2O = 32.2 + 0.0019 * T;
      const Cp_CO  = 29.1 + 0.0041 * T;
      const Cp_CO2 = 44.1 + 0.0090 * T;
      const Cp_H2  = 27.1 + 0.0033 * T;
      const Cp_N2  = 29.0 + 0.0039 * T;
      const Cp_Ar  = 20.8;

      const Sum_F_Cp = (F_CH4 * Cp_CH4 + F_H2O * Cp_H2O + F_CO * Cp_CO + F_CO2 * Cp_CO2 +
                        F_H2 * Cp_H2 + F_N2_0 * Cp_N2 + F_Ar_0 * Cp_Ar);

      const dW_dz = Ac * rho_b;

      const dF_CH4_dz = (-r1_app - r3_app) * dW_dz;
      const dF_H2O_dz = (-r1_app - r2_app - 2 * r3_app) * dW_dz;
      const dF_CO_dz  = (r1_app - r2_app) * dW_dz;
      const dF_CO2_dz = (r2_app + r3_app) * dW_dz;
      const dF_H2_dz  = (3 * r1_app + r2_app + 4 * r3_app) * dW_dz;

      const qFluxInnerZ = getLocalFluxParameters(z);
      const dT_dz = (qFluxInnerZ * ai - (r1_app * dH1 + r2_app * dH2 + r3_app * dH3) * dW_dz) / Sum_F_Cp;

      const y_CH4  = F_CH4 / F_total;
      const y_H2O  = F_H2O / F_total;
      const y_CO   = F_CO / F_total;
      const y_CO2  = F_CO2 / F_total;
      const y_H2   = F_H2 / F_total;
      const y_N2   = F_N2_0 / F_total;
      const y_Ar   = F_Ar_0 / F_total;

      const Crit_P_Gas_g = (y_CH4 * PC.CH4 + y_H2O * PC.H2O + y_CO * PC.CO +
                            y_CO2 * PC.CO2 + y_H2 * PC.H2 + y_N2 * PC.N2 + y_Ar * PC.Ar);
      const Crit_P_Gas_abs = Crit_P_Gas_g + 1.03323;
      const Crit_T_Gas = (y_CH4 * TC.CH4 + y_H2O * TC.H2O + y_CO * TC.CO +
                          y_CO2 * TC.CO2 + y_H2 * TC.H2 + y_N2 * TC.N2 + y_Ar * TC.Ar);

      const P_kg_cm2_abs = P * 1.01972;
      const Reduced_P = P_kg_cm2_abs / Crit_P_Gas_abs;
      const Reduced_T = T / Crit_T_Gas;

      let Z = 1.0 - ((3.52 * Reduced_P) / Math.pow(10, 0.9813 * Reduced_T)) +
              (0.274 * (Reduced_P ** 2) * Math.exp(-1.2 * Reduced_T)) +
              (0.027 * (Reduced_P ** 3) * Math.exp(-1.6 * Reduced_T));
      Z = Math.max(0.2, Math.min(Z, 1.5));

      const MW_mix = (F_CH4 * MW.CH4 + F_H2O * MW.H2O + F_CO * MW.CO +
                      F_CO2 * MW.CO2 + F_H2 * MW.H2 + F_N2_0 * MW.N2 + F_Ar_0 * MW.Ar) / F_total;
      const rho_gas = (P * 100000 * MW_mix) / (Z * 8314.4 * T);

      const G_flux = (F_total * MW_mix / 3600.0) / Ac;
      const visc = 3.2e-5;
      const dP_dz = - dp_factor * ((150 * visc * Math.pow(1 - eps, 2) / (Math.pow(dp, 2) * Math.pow(eps, 3))) +
                    (1.75 * G_flux * (1 - eps) / (dp * Math.pow(eps, 3)))) * (G_flux / rho_gas) * 1e-5;

      return [dF_CH4_dz, dF_H2O_dz, dF_CO_dz, dF_CO2_dz, dF_H2_dz, dT_dz, dP_dz];
    };

    // --- Part C: Numerical ODE Solver (Runge-Kutta 4th Order with fixed fine step sizes for physical accuracy) ---
    // Physical solver accuracy and target temperature interpolation parameters are 100% constant and independent of the user's grid divisions selection.
    const totalSteps = 3000; // Fixed high resolution steps for absolute stability and grid-independent physics
    const h = L / totalSteps;

    let state = [F_CH4_0, F_H2O_0, F_CO_0, F_CO2_0, F_H2_0, T_in_K, P_in];
    let z = 0.0;

    const integrationProfile: { z: number; state: number[] }[] = [];
    integrationProfile.push({ z, state: [...state] });

    for (let step = 0; step < totalSteps; step++) {
      const k1_state = derivatives(z, state);
      const state_k2 = state.map((val, idx) => val + 0.5 * h * k1_state[idx]);
      const k2_state = derivatives(z + 0.5 * h, state_k2);
      const state_k3 = state.map((val, idx) => val + 0.5 * h * k2_state[idx]);
      const k3_state = derivatives(z + 0.5 * h, state_k3);
      const state_k4 = state.map((val, idx) => val + h * k3_state[idx]);
      const k4_state = derivatives(z + h, state_k4);

      state = state.map((val, idx) => {
        let nxt = val + (h / 6) * (k1_state[idx] + 2 * k2_state[idx] + 2 * k3_state[idx] + k4_state[idx]);
        // Chemical species molar flow cannot drop below zero
        if (idx < 5) nxt = Math.max(1e-10, nxt);
        return nxt;
      });

      z += h;
      integrationProfile.push({ z, state: [...state] });
    }

    // --- Part D: Parse Solver Output & Composition Calculation for High-Resolution Profile ---
    const highResSteps: StepProfile[] = [];
    for (const item of integrationProfile) {
      const z_pos = item.z;
      const [F_CH4, F_H2O, F_CO, F_CO2, F_H2, T_val, P_val] = item.state;
      const temp_C = T_val - 273.15;

      const F_tot_wet = F_CH4 + F_H2O + F_CO + F_CO2 + F_H2 + F_N2_0 + F_Ar_0;
      const F_tot_dry = F_CH4 + F_CO + F_CO2 + F_H2 + F_N2_0 + F_Ar_0;

      const wetCH4  = (F_CH4 / F_tot_wet) * 100;
      const wetH2   = (F_H2 / F_tot_wet) * 100;
      const wetH2O  = (F_H2O / F_tot_wet) * 100;
      const wetCO   = (F_CO / F_tot_wet) * 100;
      const wetCO2  = (F_CO2 / F_tot_wet) * 100;
      const wetN2   = (F_N2_0 / F_tot_wet) * 100;
      const wetAr   = (F_Ar_0 / F_tot_wet) * 100;

      const dryCH4  = (F_CH4 / F_tot_dry) * 100;
      const dryH2   = (F_H2 / F_tot_dry) * 100;
      const dryCO   = (F_CO / F_tot_dry) * 100;
      const dryCO2  = (F_CO2 / F_tot_dry) * 100;
      const dryN2   = (F_N2_0 / F_tot_dry) * 100;
      const dryAr   = (F_Ar_0 / F_tot_dry) * 100;

      const z_step = L / inputs.num_subheaders;
      let zone_idx = Math.floor(z_pos / z_step);
      zone_idx = Math.max(0, Math.min(zone_idx, inputs.num_subheaders - 1));
      const fluxKw = zoneFluxesKcal[zone_idx] / 859.85; // kcal/m2hr to kW/m2

      highResSteps.push({
        z: z_pos,
        temp: temp_C,
        press: P_val,
        dryCH4,
        dryH2,
        dryCO,
        dryCO2,
        dryN2,
        dryAr,
        dryTotal: dryCH4 + dryH2 + dryCO + dryCO2 + dryN2 + dryAr,
        wetCH4,
        wetH2,
        wetH2O,
        wetCO,
        wetCO2,
        wetN2,
        wetAr,
        wetTotal: wetCH4 + wetH2 + wetH2O + wetCO + wetCO2 + wetN2 + wetAr,
        fluxKw
      });
    }

    // --- Part E: Interpolation at Target Outlet Temp on High-Resolution Data ---
    const tempCList = highResSteps.map(s => s.temp);

    const targetTemp = inputs.T_out_target;
    // Safeguard target temp bounds
    const minT = tempCList[0];
    const maxT = tempCList[tempCList.length - 1];
    const interpTemp = Math.max(minT, Math.min(targetTemp, maxT));

    // Linear interpolation helper for any variable lists at target temperature
    const interpolateAtTemp = (varList: number[]): number => {
      if (interpTemp <= minT) return varList[0];
      if (interpTemp >= maxT) return varList[varList.length - 1];
      for (let j = 0; j < tempCList.length - 1; j++) {
        const t0 = tempCList[j];
        const t1 = tempCList[j + 1];
        if (interpTemp >= t0 && interpTemp <= t1) {
          const factor = (interpTemp - t0) / (t1 - t0);
          return varList[j] + factor * (varList[j + 1] - varList[j]);
        }
      }
      return varList[varList.length - 1];
    };

    const P_at_target = interpolateAtTemp(highResSteps.map(s => s.press));

    const wCH4_t  = interpolateAtTemp(highResSteps.map(s => s.wetCH4)) / 100;
    const wH2_t   = interpolateAtTemp(highResSteps.map(s => s.wetH2)) / 100;
    const wH2O_t  = interpolateAtTemp(highResSteps.map(s => s.wetH2O)) / 100;
    const wCO_t   = interpolateAtTemp(highResSteps.map(s => s.wetCO)) / 100;
    const wCO2_t  = interpolateAtTemp(highResSteps.map(s => s.wetCO2)) / 100;
    const wN2_t   = interpolateAtTemp(highResSteps.map(s => s.wetN2)) / 100;
    const wAr_t   = interpolateAtTemp(highResSteps.map(s => s.wetAr)) / 100;

    const dCH4_t  = interpolateAtTemp(highResSteps.map(s => s.dryCH4));
    const dH2_t   = interpolateAtTemp(highResSteps.map(s => s.dryH2));
    const dCO_t   = interpolateAtTemp(highResSteps.map(s => s.dryCO));
    const dCO2_t  = interpolateAtTemp(highResSteps.map(s => s.dryCO2));
    const dN2_t   = interpolateAtTemp(highResSteps.map(s => s.dryN2));
    const dAr_t   = interpolateAtTemp(highResSteps.map(s => s.dryAr));

    // SMR Equilibrium reaction quotient: Q_P = (y_CO * y_H2^3) / (y_CH4 * y_H2O) * P^2
    const Q_P_smr = ((wCO_t * Math.pow(wH2_t, 3)) / (wCH4_t * wH2O_t)) * Math.pow(P_at_target, 2);

    // Solve for equilibrium temperature: K_P1(T_eq) = Q_P_smr
    // K_P1 = exp(-26830 / T + 30.114) * (0.98692^2)
    // ln(K_P1 / 0.98692^2) = -26830 / T + 30.114
    // -26830 / T = ln(Q_P_smr / 0.98692^2) - 30.114
    // T_eq = -26830 / (ln(Q_P_smr / 0.98692^2) - 30.114)
    const factor_atm = Q_P_smr / (0.98692 ** 2);
    let T_eq_C = NaN;
    let approachToEquilibrium = NaN;

    if (factor_atm > 0) {
      const T_eq_K = -26830.0 / (Math.log(factor_atm) - 30.114);
      T_eq_C = T_eq_K - 273.15;
      approachToEquilibrium = T_eq_C - interpTemp;
    }

    // --- Part F: Sample and Interpolate the user-visible steps based on Length Grid Divisions ---
    const steps: StepProfile[] = [];
    for (let i = 0; i <= length_divisions; i++) {
      const z_target = (i * L) / length_divisions;
      const floatIdx = (z_target / L) * totalSteps;
      const idx0 = Math.max(0, Math.min(totalSteps, Math.floor(floatIdx)));
      const idx1 = Math.max(0, Math.min(totalSteps, Math.ceil(floatIdx)));

      if (idx0 === idx1) {
        steps.push({ ...highResSteps[idx0], z: z_target });
      } else {
        const s0 = highResSteps[idx0];
        const s1 = highResSteps[idx1];
        const weight = (z_target - s0.z) / (s1.z - s0.z);

        steps.push({
          z: z_target,
          temp: s0.temp + weight * (s1.temp - s0.temp),
          press: s0.press + weight * (s1.press - s0.press),
          dryCH4: s0.dryCH4 + weight * (s1.dryCH4 - s0.dryCH4),
          dryH2: s0.dryH2 + weight * (s1.dryH2 - s0.dryH2),
          dryCO: s0.dryCO + weight * (s1.dryCO - s0.dryCO),
          dryCO2: s0.dryCO2 + weight * (s1.dryCO2 - s0.dryCO2),
          dryN2: s0.dryN2 + weight * (s1.dryN2 - s0.dryN2),
          dryAr: s0.dryAr + weight * (s1.dryAr - s0.dryAr),
          dryTotal: s0.dryTotal + weight * (s1.dryTotal - s0.dryTotal),
          wetCH4: s0.wetCH4 + weight * (s1.wetCH4 - s0.wetCH4),
          wetH2: s0.wetH2 + weight * (s1.wetH2 - s0.wetH2),
          wetH2O: s0.wetH2O + weight * (s1.wetH2O - s0.wetH2O),
          wetCO: s0.wetCO + weight * (s1.wetCO - s0.wetCO),
          wetCO2: s0.wetCO2 + weight * (s1.wetCO2 - s0.wetCO2),
          wetN2: s0.wetN2 + weight * (s1.wetN2 - s0.wetN2),
          wetAr: s0.wetAr + weight * (s1.wetAr - s0.wetAr),
          wetTotal: s0.wetTotal + weight * (s1.wetTotal - s0.wetTotal),
          fluxKw: s0.fluxKw + weight * (s1.fluxKw - s0.fluxKw)
        });
      }
    }

    return {
      success: true,
      steps,
      zoneSummaries,
      lhvFuel,
      totalThermalReleaseGcal: qTotalRelease / 1e6,
      totalRadiantAbsorbedGcal: (qTotalRelease * (inputs.efficiency / 100.0)) / 1e6,
      totalSurfaceArea,
      averageHeatFlux: (qTotalRelease * (inputs.efficiency / 100.0)) / totalSurfaceArea,
      interpolatedAtTarget: {
        targetTemp: interpTemp,
        pressure: P_at_target,
        approachToEquilibrium: isNaN(approachToEquilibrium) ? 0 : approachToEquilibrium,
        theoreticalEqTemp: isNaN(T_eq_C) ? 0 : T_eq_C,
        dryComposition: {
          CH4: dCH4_t,
          H2: dH2_t,
          H2O: 0.0,
          CO: dCO_t,
          CO2: dCO2_t,
          N2: dN2_t,
          Ar: dAr_t,
          Total: 100.0
        },
        wetComposition: {
          CH4: wCH4_t * 100,
          H2: wH2_t * 100,
          H2O: wH2O_t * 100,
          CO: wCO_t * 100,
          CO2: wCO2_t * 100,
          N2: wN2_t * 100,
          Ar: wAr_t * 100,
          Total: 100.0
        }
      }
    };

  } catch (err: any) {
    return {
      success: false,
      error: err?.message || String(err),
      steps: [],
      zoneSummaries: [],
      lhvFuel: 0,
      totalThermalReleaseGcal: 0,
      totalRadiantAbsorbedGcal: 0,
      totalSurfaceArea: 0,
      averageHeatFlux: 0,
      interpolatedAtTarget: {
        targetTemp: 0,
        pressure: 0,
        approachToEquilibrium: 0,
        theoreticalEqTemp: 0,
        dryComposition: {},
        wetComposition: {}
      }
    };
  }
}
