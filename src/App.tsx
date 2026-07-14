/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  runSMRSimulation,
  SMRInputs,
  SMRResult,
  StepProfile,
  ZoneSummary
} from "./utils/smrSolver";
import {
  Activity,
  Flame,
  Gauge,
  Thermometer,
  Percent,
  Download,
  Settings,
  Database,
  Compass,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Cpu,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  FileText,
  Layers,
  Sparkles,
  Play,
  Sun,
  Moon,
  Lock,
  User,
  LogOut,
  Terminal
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Predefined industrial operating default inputs
const DEFAULT_INPUTS: SMRInputs = {
  Gas_Flow: 50000.0,
  Steam_Flow: 125.0,
  P_in: 35.0,
  T_in_C: 520.0,
  total_fuel: 30000.0,
  N_tubes: 288,
  T_out_target: 785.0,
  CH4: 69.53,
  H2: 0.52,
  C2H6: 0.24,
  N2: 17.95,
  CO2: 11.08,
  Ar: 0.001,
  CO: 0.679,
  fuel_CH4: 70.0,
  fuel_C2H6: 0.5,
  fuel_N2: 18.0,
  fuel_CO2: 11.5,
  cat_activity: 0.63,
  dp_factor: 1.5,
  L: 11.0,
  OD: 154.0,
  Di: 129.0,
  rho_b: 960.0,
  dp: 15.0,
  eps: 0.46,
  efficiency: 44.0,
  num_subheaders: 6,
  p_subheaders_str: "0.6, 3.3, 3.3, 3.3, 3.3, 1.7",
  burners_per_row_str: "108, 108, 108, 108, 108, 108",
  length_divisions: 25
};

export default function App() {
  // Theme state
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem("smr_auth") === "true";
  });
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsSubmitting(true);

    // Simulate standard secure authorization validation check
    setTimeout(() => {
      if (usernameInput.trim() === "Reformer_Kinetics" && passwordInput === "Demo@321") {
        sessionStorage.setItem("smr_auth", "true");
        setIsAuthenticated(true);
      } else {
        setLoginError("Invalid terminal authorization credentials. Please verify your credentials and try again.");
      }
      setIsSubmitting(false);
    }, 600); // Sleek mechanical delay
  };

  const handleLogout = () => {
    sessionStorage.removeItem("smr_auth");
    setIsAuthenticated(false);
    setUsernameInput("");
    setPasswordInput("");
    setLoginError("");
  };

  // Simulation inputs state
  const [inputs, setInputs] = useState<SMRInputs>({ ...DEFAULT_INPUTS });

  // Simulation output state
  const [result, setResult] = useState<SMRResult | null>(null);

  // Interactive charting tabs & state
  const [activeChartTab, setActiveChartTab] = useState<"temperature" | "pressure" | "wetComp" | "dryComp" | "heatFlux">("temperature");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Tab state for Bottom Table Matrix
  const [activeTableTab, setActiveTableTab] = useState<"hydraulics" | "matrix">("hydraulics");

  // Filter state for high resolution ledger
  const [matrixSearch, setMatrixSearch] = useState("");

  // Tab selections for parameter inputs
  const [inputTab, setInputTab] = useState<"ops" | "feed" | "geom">("ops");

  // Interactive Composition Basis & Hover states for digital twin
  const [compositionBasis, setCompositionBasis] = useState<"dry" | "wet">("dry");
  const [hoveredGas, setHoveredGas] = useState<string | null>(null);
  const [hoveredMetric, setHoveredMetric] = useState<string | null>(null);

  // Calculate S/C ratio
  const steamKmolHr = (inputs.Steam_Flow * 1000) / 18.015;
  const gasKmolHr = (inputs.Gas_Flow / 22.414);
  const carbonFraction = (inputs.CH4 + inputs.C2H6 * 2.0 + inputs.CO + inputs.CO2) / 100.0;
  const SC_Ratio = carbonFraction > 0 ? (steamKmolHr / (gasKmolHr * carbonFraction)) : 0;

  // Run simulation upon mount or input change
  const triggerSimulation = (currentInputs: SMRInputs) => {
    const res = runSMRSimulation(currentInputs);
    setResult(res);
  };

  // Automatically trigger simulation on any inputs change (Reactive Engine)
  useEffect(() => {
    triggerSimulation(inputs);
  }, [inputs]);

  const handleReset = () => {
    setInputs({ ...DEFAULT_INPUTS });
  };

  const handleInputChange = (field: keyof SMRInputs, val: string | number) => {
    let parsed: any = val;
    if (typeof inputs[field] === "number" && typeof val === "string") {
      parsed = parseFloat(val);
      if (isNaN(parsed)) parsed = 0;
    }
    const next = { ...inputs, [field]: parsed };
    setInputs(next);
  };

  // Export full profile dataset to CSV
  const exportToCSV = () => {
    if (!result || !result.steps.length) return;
    const headers = [
      "Length (m)", "Temp (C)", "Pressure (kg/cm2g)",
      "Dry CH4%", "Dry H2%", "Dry CO%", "Dry CO2%", "Dry N2%", "Dry Ar%", "Dry Total%",
      "Wet CH4%", "Wet H2%", "Wet H2O%", "Wet CO%", "Wet CO2%", "Wet N2%", "Wet Ar%", "Wet Total%",
      "Zone Flux (kW/m2)"
    ];

    const rows = result.steps.map(s => [
      s.z.toFixed(3), s.temp.toFixed(2), s.press.toFixed(3),
      s.dryCH4.toFixed(3), s.dryH2.toFixed(3), s.dryCO.toFixed(3), s.dryCO2.toFixed(3), s.dryN2.toFixed(3), s.dryAr.toFixed(3), s.dryTotal.toFixed(3),
      s.wetCH4.toFixed(3), s.wetH2.toFixed(3), s.wetH2O.toFixed(3), s.wetCO.toFixed(3), s.wetCO2.toFixed(3), s.wetN2.toFixed(3), s.wetAr.toFixed(3), s.wetTotal.toFixed(3),
      s.fluxKw.toFixed(2)
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SMR_Digital_Twin_Profile.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // SVG Chart Engine Renderer
  const chartWidth = 720;
  const chartHeight = 240;
  const paddingLeft = 55;
  const paddingRight = 40;
  const paddingTop = 25;
  const paddingBottom = 40;

  const chartDataPoints = useMemo(() => {
    if (!result || !result.steps.length) return [];
    return result.steps;
  }, [result]);

  const chartScales = useMemo(() => {
    if (!chartDataPoints.length) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    const minX = 0;
    const maxX = inputs.L || 1;

    let minY = 0;
    let maxY = 100;

    if (activeChartTab === "temperature") {
      const temps = chartDataPoints.map(p => p.temp).filter(t => !isNaN(t));
      const inTemp = isNaN(inputs.T_in_C) ? 0 : inputs.T_in_C;
      minY = temps.length ? Math.min(inTemp, ...temps) - 40 : 0;
      maxY = temps.length ? Math.max(...temps) + 40 : 100;
    } else if (activeChartTab === "pressure") {
      const presses = chartDataPoints.map(p => p.press).filter(p => !isNaN(p));
      const inPress = isNaN(inputs.P_in) ? 1 : inputs.P_in;
      minY = presses.length ? Math.min(...presses) - 1 : 0;
      maxY = presses.length ? Math.max(inPress, ...presses) + 1 : 100;
    } else if (activeChartTab === "wetComp") {
      const values = chartDataPoints.map(p => Math.max(p.wetH2O || 0, p.wetH2 || 0, p.wetCH4 || 0, p.wetCO2 || 0, p.wetCO || 0));
      minY = 0;
      maxY = values.length ? Math.max(...values) + 5 : 100;
    } else if (activeChartTab === "dryComp") {
      const values = chartDataPoints.map(p => Math.max(p.dryH2 || 0, p.dryCH4 || 0, p.dryCO || 0, p.dryCO2 || 0));
      minY = 0;
      maxY = values.length ? Math.max(...values) + 5 : 100;
    } else if (activeChartTab === "heatFlux") {
      const fluxes = chartDataPoints.map(p => p.fluxKw).filter(f => !isNaN(f));
      minY = 0;
      maxY = fluxes.length ? Math.max(...fluxes) + 10 : 100;
    }

    if (minY === maxY) {
      maxY = minY + 1;
    }

    return { minX, maxX, minY, maxY };
  }, [chartDataPoints, activeChartTab, inputs]);

  const mapX = (xVal: number) => {
    const { minX, maxX } = chartScales;
    const denom = maxX - minX;
    if (denom === 0 || isNaN(xVal) || !isFinite(xVal)) return paddingLeft;
    return paddingLeft + ((xVal - minX) / denom) * (chartWidth - paddingLeft - paddingRight);
  };

  const mapY = (yVal: number) => {
    const { minY, maxY } = chartScales;
    const denom = maxY - minY;
    if (denom === 0 || isNaN(yVal) || !isFinite(yVal)) return chartHeight - paddingBottom;
    return chartHeight - paddingBottom - ((yVal - minY) / denom) * (chartHeight - paddingTop - paddingBottom);
  };

  // Generate SVG Path for a variable list
  const getPathD = (yGetter: (p: StepProfile) => number) => {
    if (!chartDataPoints.length) return "";
    return chartDataPoints.map((p, idx) => {
      const x = mapX(p.z);
      const y = mapY(yGetter(p));
      return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
    }).join(" ");
  };

  // Get dynamic coordinates for hovered index tooltip
  const hoverPointInfo = useMemo(() => {
    if (hoveredIndex === null || !chartDataPoints[hoveredIndex]) return null;
    const pt = chartDataPoints[hoveredIndex];
    return {
      x: mapX(pt.z),
      z: pt.z,
      temp: pt.temp,
      press: pt.press,
      dryCH4: pt.dryCH4,
      dryH2: pt.dryH2,
      dryCO: pt.dryCO,
      dryCO2: pt.dryCO2,
      dryN2: pt.dryN2,
      dryAr: pt.dryAr,
      wetCH4: pt.wetCH4,
      wetH2: pt.wetH2,
      wetH2O: pt.wetH2O,
      wetCO: pt.wetCO,
      wetCO2: pt.wetCO2,
      wetN2: pt.wetN2,
      wetAr: pt.wetAr,
      flux: pt.fluxKw
    };
  }, [hoveredIndex, chartDataPoints]);

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!chartDataPoints.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;

    // Map clientX taking SVG container responsiveness scaling into account
    const svgX = (clientX / rect.width) * chartWidth;
    const relativeX = svgX - paddingLeft;
    const chartAreaWidth = chartWidth - paddingLeft - paddingRight;
    const ratio = Math.max(0, Math.min(1, relativeX / chartAreaWidth));
    const zGuess = ratio * inputs.L;

    // Find closest index
    let closestIdx = 0;
    let minDiff = Infinity;
    chartDataPoints.forEach((p, idx) => {
      const diff = Math.abs(p.z - zGuess);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });
    setHoveredIndex(closestIdx);
  };

  // Grid node list filtering
  const filteredMatrix = useMemo(() => {
    if (!result) return [];
    if (!matrixSearch.trim()) return result.steps;
    const s = matrixSearch.toLowerCase();
    return result.steps.filter(node =>
      node.z.toFixed(2).includes(s) ||
      node.temp.toFixed(1).includes(s) ||
      node.press.toFixed(2).includes(s)
    );
  }, [result, matrixSearch]);

  // Safe checks for validation alerts
  const SC_Risk_Level = SC_Ratio < 2.0 ? "high" : SC_Ratio < 2.5 ? "medium" : "low";
  const slip_level = result && result.interpolatedAtTarget?.dryComposition?.CH4 !== undefined ? (result.interpolatedAtTarget.dryComposition.CH4 > 5.0 ? "high" : result.interpolatedAtTarget.dryComposition.CH4 > 2.5 ? "medium" : "low") : "low";
  const dp_level = result && result.steps.length > 0 ? ((inputs.P_in - result.steps[result.steps.length - 1].press) > 4.5 ? "high" : (inputs.P_in - result.steps[result.steps.length - 1].press) > 2.5 ? "medium" : "low") : "low";

  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen ${theme === "dark" ? "dark bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900"} font-sans transition-colors duration-200 selection:bg-cyan-500 selection:text-zinc-950 flex flex-col justify-between`}>
        {/* Landing Header */}
        <header className="border-b border-zinc-200 dark:border-zinc-900 bg-white/80 dark:bg-zinc-950/80 backdrop-blur px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 text-zinc-950 shadow-lg shadow-cyan-500/10">
              <Cpu className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold tracking-wider text-zinc-900 dark:text-white uppercase font-mono">
                REFORMER KINETIC MODEL
              </h1>
            </div>
          </div>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all flex items-center gap-2 text-xs font-mono font-medium shadow-sm"
          >
            {theme === "dark" ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-500" /> <span className="hidden sm:inline">Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-500" /> <span className="hidden sm:inline">Dark Mode</span>
              </>
            )}
          </button>
        </header>

        {/* Hero Section */}
        <div className="flex-1 flex items-center justify-center p-6 md:p-12">
          <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left side: engaging presentation and highlights */}
            <div className="lg:col-span-7 space-y-6">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-none text-zinc-900 dark:text-white">
                Steam Methane Reforming <br />
                <span className="bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 bg-clip-text text-transparent">
                  Co-Solver & Kinetics Model
                </span>
              </h2>
              
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-xl leading-relaxed">
                Stop waiting for simulation convergence. Model industrial steam methane reforming instantly with a high-fidelity co-solver that pairs rigorous thermodynamics with continuous kinetic profiling.
              </p>
            </div>

            {/* Right side: Login Panel */}
            <div className="lg:col-span-5">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden"
              >
                {/* Visual accent background blur */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-2xl -z-10 pointer-events-none"></div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white font-mono uppercase">
                    Authorized Access
                  </h3>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  {/* Username Field */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold block">
                      Username
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={usernameInput}
                        onChange={(e) => {
                          setUsernameInput(e.target.value);
                          if (loginError) setLoginError("");
                        }}
                        placeholder=""
                        className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-950/60 text-sm border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition font-sans text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 font-mono"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold block">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        required
                        value={passwordInput}
                        onChange={(e) => {
                          setPasswordInput(e.target.value);
                          if (loginError) setLoginError("");
                        }}
                        placeholder="••••••••••••"
                        className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-950/60 text-sm border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition font-sans text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 font-mono"
                      />
                    </div>
                  </div>

                  {/* Login Error Alert */}
                  <AnimatePresence>
                    {loginError && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl flex items-start gap-2"
                      >
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="font-sans font-medium">{loginError}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-xl text-xs font-mono uppercase tracking-wider font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/15 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Authorizing...
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Connect to SMR Co-Solver
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Landing Footer */}
        <footer className="border-t border-zinc-200 dark:border-zinc-900 bg-white/40 dark:bg-zinc-950/40 py-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-zinc-400 dark:text-zinc-500">
        </footer>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === "dark" ? "dark bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900"} font-sans transition-colors duration-200 selection:bg-cyan-500 selection:text-zinc-950 pb-28`}>
      {/* HEADER BAR */}
      <header className="border-b border-zinc-200 dark:border-zinc-900 bg-white/80 dark:bg-zinc-950/80 backdrop-blur sticky top-0 z-50 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 text-zinc-950 shadow-lg shadow-cyan-500/10">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white uppercase font-mono">
              REFORMER KINETIC MODEL
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all flex items-center gap-2 text-xs font-mono font-medium shadow-sm"
          >
            {theme === "dark" ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-500" /> Light Mode
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" /> Dark Mode
              </>
            )}
          </button>

          <button
            onClick={handleLogout}
            className="p-2 px-3 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/40 transition-all flex items-center gap-2 text-xs font-mono font-medium shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </header>

      {/* CORE CONTENT */}
      <main className="p-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Validation Errors banner */}
        {result && !result.success && (
          <div className="xl:col-span-12 bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start gap-3 text-rose-300 font-mono">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-bounce" />
            <div>
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">Input Parameter Violation Error</span>
              <p className="text-xs font-sans mt-1 text-zinc-300">{result.error || "The simulation solver failed due to invalid physical conditions. Please verify that your compositions add up to 100% and that inputs are within physically realistic bounds."}</p>
            </div>
          </div>
        )}

        {/* LEFT COLUMN: SIMULATION INPUTS (BENTO BLOCK 1) */}
        <section className="xl:col-span-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-zinc-900 dark:text-white">Furnace Control Panel</h2>
            </div>
            <div className="flex bg-zinc-100 dark:bg-zinc-950 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setInputTab("ops")}
                className={`px-2 py-1 text-[11px] font-mono rounded transition ${
                  inputTab === "ops" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium shadow-sm border border-zinc-200/50 dark:border-zinc-700/50" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                Operations
              </button>
              <button
                onClick={() => setInputTab("feed")}
                className={`px-2 py-1 text-[11px] font-mono rounded transition ${
                  inputTab === "feed" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium shadow-sm border border-zinc-200/50 dark:border-zinc-700/50" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                Chemistry
              </button>
              <button
                onClick={() => setInputTab("geom")}
                className={`px-2 py-1 text-[11px] font-mono rounded transition ${
                  inputTab === "geom" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium shadow-sm border border-zinc-200/50 dark:border-zinc-700/50" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                Geometry
              </button>
            </div>
          </div>

          <div className="p-5 flex-1 overflow-y-auto max-h-[580px] space-y-4">
            {inputTab === "ops" && (
              <div className="space-y-4">
                <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase border-b border-zinc-100 dark:border-zinc-800 pb-1 font-mono">🚀 Operations & Kinetics</div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-1">Process Gas Flow (NMC/h)</label>
                    <input
                      type="number"
                      value={inputs.Gas_Flow}
                      onChange={(e) => handleInputChange("Gas_Flow", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-1">Process Steam (T/h)</label>
                    <input
                      type="number"
                      value={inputs.Steam_Flow}
                      onChange={(e) => handleInputChange("Steam_Flow", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-1">Inlet Pressure (kg/cm²g)</label>
                    <input
                      type="number"
                      value={inputs.P_in}
                      onChange={(e) => handleInputChange("P_in", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-1">Inlet Temp (°C)</label>
                    <input
                      type="number"
                      value={inputs.T_in_C}
                      onChange={(e) => handleInputChange("T_in_C", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-1">Total Fuel (NMC/h)</label>
                    <input
                      type="number"
                      value={inputs.total_fuel}
                      onChange={(e) => handleInputChange("total_fuel", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-1">Desired Outlet Temp (°C)</label>
                    <input
                      type="number"
                      value={inputs.T_out_target}
                      onChange={(e) => handleInputChange("T_out_target", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                </div>

                <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase border-b border-zinc-100 dark:border-zinc-800 pb-1 pt-2 font-mono">🧪 Physical Resistance Adjustments</div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-1">Catalyst Activity Factor</label>
                    <input
                      type="number"
                      step="0.01"
                      value={inputs.cat_activity}
                      onChange={(e) => handleInputChange("cat_activity", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-1">Fouling DP Factor</label>
                    <input
                      type="number"
                      step="0.1"
                      value={inputs.dp_factor}
                      onChange={(e) => handleInputChange("dp_factor", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {inputTab === "feed" && (
              <div className="space-y-4">
                <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase border-b border-zinc-100 dark:border-zinc-800 pb-1 font-mono flex justify-between">
                  <span>🧪 Process Feed Gas Mix (mol%)</span>
                  <span className={`text-[10px] font-mono ${Math.abs(inputs.CH4 + inputs.H2 + inputs.C2H6 + inputs.N2 + inputs.CO2 + inputs.Ar + inputs.CO - 100) < 0.01 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400 animate-pulse"}`}>
                    Sum: {(inputs.CH4 + inputs.H2 + inputs.C2H6 + inputs.N2 + inputs.CO2 + inputs.Ar + inputs.CO).toFixed(2)}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-0.5">Methane (CH4)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={inputs.CH4}
                      onChange={(e) => handleInputChange("CH4", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-0.5">Ethane (C2H6)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={inputs.C2H6}
                      onChange={(e) => handleInputChange("C2H6", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-0.5">Hydrogen (H2)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={inputs.H2}
                      onChange={(e) => handleInputChange("H2", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-0.5">Carbon Dioxide (CO2)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={inputs.CO2}
                      onChange={(e) => handleInputChange("CO2", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-0.5">Carbon Monoxide (CO)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={inputs.CO}
                      onChange={(e) => handleInputChange("CO", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-0.5">Nitrogen (N2)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={inputs.N2}
                      onChange={(e) => handleInputChange("N2", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-0.5">Argon (Ar)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={inputs.Ar}
                      onChange={(e) => handleInputChange("Ar", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                </div>

                <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase border-b border-zinc-100 dark:border-zinc-800 pb-1 pt-2 font-mono flex justify-between">
                  <span>🔥 Furnace Burner Fuel Mix (%)</span>
                  <span className={`text-[10px] font-mono ${Math.abs(inputs.fuel_CH4 + inputs.fuel_C2H6 + inputs.fuel_CO2 + inputs.fuel_N2 - 100) < 0.01 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400 animate-pulse"}`}>
                    Sum: {(inputs.fuel_CH4 + inputs.fuel_C2H6 + inputs.fuel_CO2 + inputs.fuel_N2).toFixed(2)}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-0.5">Methane (CH4)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={inputs.fuel_CH4}
                      onChange={(e) => handleInputChange("fuel_CH4", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-0.5">Ethane (C2H6)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={inputs.fuel_C2H6}
                      onChange={(e) => handleInputChange("fuel_C2H6", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-0.5">Carbon Dioxide (CO2)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={inputs.fuel_CO2}
                      onChange={(e) => handleInputChange("fuel_CO2", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-0.5">Nitrogen (N2)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={inputs.fuel_N2}
                      onChange={(e) => handleInputChange("fuel_N2", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {inputTab === "geom" && (
              <div className="space-y-4">
                <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase border-b border-zinc-100 dark:border-zinc-800 pb-1 font-mono">📐 Tube & Furnace Dimensions</div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-1">Tube Length L (m)</label>
                    <input
                      type="number"
                      value={inputs.L}
                      onChange={(e) => handleInputChange("L", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-1">Number of Tubes</label>
                    <input
                      type="number"
                      value={inputs.N_tubes}
                      onChange={(e) => handleInputChange("N_tubes", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-1">Tube OD (mm)</label>
                    <input
                      type="number"
                      value={inputs.OD}
                      onChange={(e) => handleInputChange("OD", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-1">Tube ID (mm)</label>
                    <input
                      type="number"
                      value={inputs.Di}
                      onChange={(e) => handleInputChange("Di", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-1">Length Grid Divisions</label>
                    <input
                      type="number"
                      value={inputs.length_divisions}
                      onChange={(e) => handleInputChange("length_divisions", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                </div>

                <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase border-b border-zinc-100 dark:border-zinc-800 pb-1 pt-2 font-mono">🧱 Catalyst Bed Packing</div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-1">Bulk Density (kg/m³)</label>
                    <input
                      type="number"
                      value={inputs.rho_b}
                      onChange={(e) => handleInputChange("rho_b", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-1">Pellet Dia (mm)</label>
                    <input
                      type="number"
                      value={inputs.dp}
                      onChange={(e) => handleInputChange("dp", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-1">Voidage Fraction</label>
                    <input
                      type="number"
                      step="0.01"
                      value={inputs.eps}
                      onChange={(e) => handleInputChange("eps", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-1">Radiant Box Efficiency (%)</label>
                    <input
                      type="number"
                      value={inputs.efficiency}
                      onChange={(e) => handleInputChange("efficiency", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                </div>

                <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase border-b border-zinc-100 dark:border-zinc-800 pb-1 pt-2 font-mono">🔥 Subheaders & Burner Specs</div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-0.5">Sub-Header Count</label>
                    <input
                      type="number"
                      value={inputs.num_subheaders}
                      onChange={(e) => handleInputChange("num_subheaders", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-0.5">Sub-Header Pressures (kg/cm²g)</label>
                    <input
                      type="text"
                      value={inputs.p_subheaders_str}
                      onChange={(e) => handleInputChange("p_subheaders_str", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase mb-0.5">Burners per Row (Top to Bottom)</label>
                    <input
                      type="text"
                      value={inputs.burners_per_row_str}
                      onChange={(e) => handleInputChange("burners_per_row_str", e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Compute Trigger Footer */}
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex gap-3">
            <button
              onClick={() => triggerSimulation(inputs)}
              className="flex-1 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-zinc-950 font-bold py-2.5 px-4 rounded-xl text-xs font-mono uppercase tracking-wider transition-all duration-300 shadow-lg shadow-cyan-500/10 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              Re-Calculate SMR Matrix
            </button>
            <button
              onClick={handleReset}
              title="Reset parameters to design default"
              className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 p-2.5 rounded-xl transition duration-200"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* MIDDLE SECTION: DIGITAL TWIN INTERACTIVE ANALYTICS CONSOLE (BENTO BLOCK 2) */}
        <section className="xl:col-span-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 flex flex-col gap-5 shadow-2xl relative overflow-hidden">
          {/* Header block */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-zinc-900 dark:text-white">REFORMER KINETIC MODEL</h2>
                <p className="text-[10px] text-zinc-500 font-mono">Thermodynamic, Kinetic & Hydraulic Co-Solver Status</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-mono font-medium text-emerald-600 dark:text-emerald-400">ACTIVE</span>
            </div>
          </div>

          {/* TWO MAIN SUB-PANELS LAYOUT: GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-[460px]">
            {/* LEFT SUB-GRID: CORE DIGITAL TWIN METRICS */}
            <div className="lg:col-span-7 flex flex-col gap-3">
              <div className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-mono flex items-center gap-1.5 border-b border-zinc-200 dark:border-zinc-800/60 pb-1">
                <Sparkles className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
                <span>Thermodynamic & Hydraulic Intercepts</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Reformer Output Target Temp */}
                <div 
                  className={`p-3 bg-zinc-50/80 dark:bg-zinc-950/80 border rounded-xl flex flex-col justify-between transition duration-200 cursor-pointer ${
                    hoveredMetric === "targetTemp" ? "border-cyan-500 bg-white dark:bg-zinc-950 shadow-lg shadow-cyan-500/5" : "border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                  onMouseEnter={() => setHoveredMetric("targetTemp")}
                  onMouseLeave={() => setHoveredMetric(null)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono uppercase tracking-tight">Output Target Temp</span>
                    <Thermometer className="w-3.5 h-3.5 text-rose-500" />
                  </div>
                  <div className="mt-2.5">
                    <div className="text-lg font-bold font-mono text-zinc-900 dark:text-white">
                      {result ? `${result.interpolatedAtTarget.targetTemp.toFixed(1)}` : "..."}°C
                    </div>
                    <div className="text-[8px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">Desired Plant Outlet Window</div>
                  </div>
                </div>

                {/* 2. Theoretical Thermodynamic Eq Temp */}
                <div 
                  className={`p-3 bg-zinc-50/80 dark:bg-zinc-950/80 border rounded-xl flex flex-col justify-between transition duration-200 cursor-pointer ${
                    hoveredMetric === "eqTemp" ? "border-cyan-500 bg-white dark:bg-zinc-950 shadow-lg shadow-cyan-500/5" : "border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                  onMouseEnter={() => setHoveredMetric("eqTemp")}
                  onMouseLeave={() => setHoveredMetric(null)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono uppercase tracking-tight">Equilibrium Temp</span>
                    <Cpu className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <div className="mt-2.5">
                    <div className="text-lg font-bold font-mono text-zinc-900 dark:text-white">
                      {result ? `${result.interpolatedAtTarget.theoreticalEqTemp.toFixed(1)}` : "..."}°C
                    </div>
                    <div className="text-[8px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">State Reaction Quotient Limit</div>
                  </div>
                </div>

                {/* 3. Approach to Equilibrium Calculation (ATE) */}
                <div 
                  className={`p-3 bg-zinc-50/80 dark:bg-zinc-950/80 border rounded-xl flex flex-col justify-between transition duration-200 cursor-pointer ${
                    hoveredMetric === "ate" ? "border-cyan-500 bg-white dark:bg-zinc-950 shadow-lg shadow-cyan-500/5" : "border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                  onMouseEnter={() => setHoveredMetric("ate")}
                  onMouseLeave={() => setHoveredMetric(null)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono uppercase tracking-tight">Approach to Eq (ATE)</span>
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="mt-2.5">
                    <div className="text-lg font-bold font-mono text-zinc-900 dark:text-white">
                      {result ? `${result.interpolatedAtTarget.approachToEquilibrium.toFixed(2)}` : "..."}°C
                    </div>
                    <div className="text-[8px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">Thermodynamic Distance (ΔT)</div>
                  </div>
                </div>

                {/* 4. Local Kinetic Pressure Intercept */}
                <div 
                  className={`p-3 bg-zinc-50/80 dark:bg-zinc-950/80 border rounded-xl flex flex-col justify-between transition duration-200 cursor-pointer ${
                    hoveredMetric === "pressure" ? "border-cyan-500 bg-white dark:bg-zinc-950 shadow-lg shadow-cyan-500/5" : "border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                  onMouseEnter={() => setHoveredMetric("pressure")}
                  onMouseLeave={() => setHoveredMetric(null)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono uppercase tracking-tight">Kinetic P Intercept</span>
                    <Gauge className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  <div className="mt-2.5">
                    <div className="text-lg font-bold font-mono text-zinc-900 dark:text-white">
                      {result ? `${result.interpolatedAtTarget.pressure.toFixed(3)}` : "..."} <span className="text-xs">kg/cm²g</span>
                    </div>
                    <div className="text-[8px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">At Specified Temp Location</div>
                  </div>
                </div>

                {/* 5. Delta P = Inlet P - Outlet P */}
                <div 
                  className={`p-3 bg-zinc-50/80 dark:bg-zinc-950/80 border rounded-xl flex flex-col justify-between transition duration-200 cursor-pointer ${
                    hoveredMetric === "deltaP" ? "border-cyan-500 bg-white dark:bg-zinc-950 shadow-lg shadow-cyan-500/5" : "border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                  onMouseEnter={() => setHoveredMetric("deltaP")}
                  onMouseLeave={() => setHoveredMetric(null)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono uppercase tracking-tight">Bed Delta P (ΔP)</span>
                    <Gauge className="w-3.5 h-3.5 text-pink-400" />
                  </div>
                  <div className="mt-2.5">
                    <div className="text-lg font-bold font-mono text-zinc-900 dark:text-white">
                      {result && result.steps.length > 0 ? `${(inputs.P_in - result.steps[result.steps.length - 1].press).toFixed(3)}` : "..."} <span className="text-xs">kg/cm²g</span>
                    </div>
                    <div className="text-[8px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">Total Hydraulic Resistance</div>
                  </div>
                </div>

                {/* 6. Calculated Fuel Mix LHV */}
                <div 
                  className={`p-3 bg-zinc-50/80 dark:bg-zinc-950/80 border rounded-xl flex flex-col justify-between transition duration-200 cursor-pointer ${
                    hoveredMetric === "lhv" ? "border-cyan-500 bg-white dark:bg-zinc-950 shadow-lg shadow-cyan-500/5" : "border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                  onMouseEnter={() => setHoveredMetric("lhv")}
                  onMouseLeave={() => setHoveredMetric(null)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono uppercase tracking-tight">Fuel Mix LHV</span>
                    <Flame className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <div className="mt-2.5">
                    <div className="text-lg font-bold font-mono text-zinc-900 dark:text-white">
                      {result ? `${result.lhvFuel.toLocaleString(undefined, { maximumFractionDigits: 1 })}` : "..."} <span className="text-xs">kcal/NMC</span>
                    </div>
                    <div className="text-[8px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">Lower Heating Value of Feed</div>
                  </div>
                </div>

                {/* 7. Total Thermal Energy Release to Furnace */}
                <div 
                  className={`p-3 bg-zinc-50/80 dark:bg-zinc-950/80 border rounded-xl flex flex-col justify-between transition duration-200 cursor-pointer ${
                    hoveredMetric === "thermalRelease" ? "border-cyan-500 bg-white dark:bg-zinc-950 shadow-lg shadow-cyan-500/5" : "border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                  onMouseEnter={() => setHoveredMetric("thermalRelease")}
                  onMouseLeave={() => setHoveredMetric(null)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono uppercase tracking-tight">Total Thermal Release</span>
                    <Flame className="w-3.5 h-3.5 text-red-500" />
                  </div>
                  <div className="mt-2.5">
                    <div className="text-lg font-bold font-mono text-zinc-900 dark:text-white">
                      {result ? `${result.totalThermalReleaseGcal.toFixed(3)}` : "..."} <span className="text-xs">Gcal/h</span>
                    </div>
                    <div className="text-[8px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">Gross Combusted Fuel Heat</div>
                  </div>
                </div>

                {/* 8. Total Radiant Heat Energy Absorbed */}
                <div 
                  className={`p-3 bg-zinc-50/80 dark:bg-zinc-950/80 border rounded-xl flex flex-col justify-between transition duration-200 cursor-pointer ${
                    hoveredMetric === "radiantAbsorbed" ? "border-cyan-500 bg-white dark:bg-zinc-950 shadow-lg shadow-cyan-500/5" : "border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                  onMouseEnter={() => setHoveredMetric("radiantAbsorbed")}
                  onMouseLeave={() => setHoveredMetric(null)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono uppercase tracking-tight">Radiant Heat Absorbed</span>
                    <Layers className="w-3.5 h-3.5 text-yellow-500" />
                  </div>
                  <div className="mt-2.5">
                    <div className="text-lg font-bold font-mono text-zinc-900 dark:text-white">
                      {result ? `${result.totalRadiantAbsorbedGcal.toFixed(3)}` : "..."} <span className="text-xs">Gcal/h</span>
                    </div>
                    <div className="text-[8px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">Net Energy Absorbed by Bed</div>
                  </div>
                </div>

                {/* 9. Total Furnace Radiant Tube Surface Area */}
                <div 
                  className={`p-3 bg-zinc-50/80 dark:bg-zinc-950/80 border rounded-xl flex flex-col justify-between transition duration-200 cursor-pointer ${
                    hoveredMetric === "surfaceArea" ? "border-cyan-500 bg-white dark:bg-zinc-950 shadow-lg shadow-cyan-500/5" : "border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                  onMouseEnter={() => setHoveredMetric("surfaceArea")}
                  onMouseLeave={() => setHoveredMetric(null)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono uppercase tracking-tight">Radiant Tube Surface Area</span>
                    <Database className="w-3.5 h-3.5 text-teal-400" />
                  </div>
                  <div className="mt-2.5">
                    <div className="text-lg font-bold font-mono text-zinc-900 dark:text-white">
                      {result ? `${result.totalSurfaceArea.toFixed(2)}` : "..."} <span className="text-xs">m²</span>
                    </div>
                    <div className="text-[8px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">Total Outer Area ({inputs.N_tubes} Tubes)</div>
                  </div>
                </div>

                {/* 10. Average Furnace Radiant Tube Heat Flux */}
                <div 
                  className={`p-3 bg-zinc-50/80 dark:bg-zinc-950/80 border rounded-xl flex flex-col justify-between transition duration-200 cursor-pointer ${
                    hoveredMetric === "heatFlux" ? "border-cyan-500 bg-white dark:bg-zinc-950 shadow-lg shadow-cyan-500/5" : "border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                  onMouseEnter={() => setHoveredMetric("heatFlux")}
                  onMouseLeave={() => setHoveredMetric(null)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono uppercase tracking-tight">Average Tube Heat Flux</span>
                    <Flame className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
                  </div>
                  <div className="mt-2.5">
                    <div className="text-lg font-bold font-mono text-zinc-900 dark:text-white">
                      {result ? `${result.averageHeatFlux.toLocaleString(undefined, { maximumFractionDigits: 1 })}` : "..."} <span className="text-[10px]">kcal/m²h</span>
                    </div>
                    <div className="text-[8px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">
                      Equivalent to {result ? `${(result.averageHeatFlux / 859.85).toFixed(2)}` : "..."} kW/m²
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Interactive Metric Explanation Area */}
              <div className="p-3 bg-zinc-100/60 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800/60 rounded-xl flex items-start gap-2.5 min-h-[58px]">
                <HelpCircle className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                <div className="text-[11px] font-mono leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {hoveredMetric === "targetTemp" && "Output Target Temp: The specified operational monitor temperature window. If the calculated gas profile exceeds or falls short of this temperature, variables are dynamically interpolated at this specific intercept."}
                  {hoveredMetric === "eqTemp" && "Theoretical Thermodynamic Equilibrium Temp: The hypothetical temperature at which the local kinetic reaction quotient (Qp) reaches full chemical equilibrium (Kp). Highly active catalysts minimize the approach delta."}
                  {hoveredMetric === "ate" && "Approach to Equilibrium (ATE): Calculated as Eq Temp - Actual Temp. A lower ATE (e.g. 5-15°C) indicates high catalytic conversion rate and optimal activity, whereas a larger ATE indicates severe kinetic limitations."}
                  {hoveredMetric === "pressure" && "Kinetic Pressure Intercept: The calculated local gas phase pressure inside the reformer tubes at the physical position corresponding directly to your specified Outlet Target Temperature."}
                  {hoveredMetric === "deltaP" && "Bed Delta P (ΔP): The calculated difference between raw Inlet Pressure and final Tube Outlet Pressure (Pin - Pout). Solved dynamically using Ergun's packed bed resistance formulation with your dynamic Fouling DP factor."}
                  {hoveredMetric === "lhv" && "Fuel Mix LHV: Net Lower Heating Value of the custom combusted fuel mixture. Derived dynamically from your burner gas concentrations (with carbonaceous components contributing heat, and inert N2/CO2 contributing zero)."}
                  {hoveredMetric === "thermalRelease" && "Total Thermal Release: The raw gross chemical energy output released by all furnace burners row-by-row based on fuel flow rates and mixture LHV."}
                  {hoveredMetric === "radiantAbsorbed" && "Radiant Heat Absorbed: The portion of combustion energy successfully absorbed by the external surfaces of the reformer tubes, calculated via overall Radiant Box Thermal Efficiency."}
                  {hoveredMetric === "surfaceArea" && "Tube Surface Area: The total external heat-transfer surface area across all tubes inside the radiant furnace. Calculated using the formula: Area = N_tubes * π * OD * L."}
                  {hoveredMetric === "heatFlux" && "Average Heat Flux: The average external heat absorption rate per square meter of tube surface area. Higher values increase tube skin temperatures and require highly alloyed metallurgical selection."}
                  {!hoveredMetric && "Hover over any metric card above to view real-time process details, scientific explanations, and chemical engineering significance."}
                </div>
              </div>
            </div>

            {/* RIGHT SUB-PANEL: INTERACTIVE GAS COMPOSITION EXPLORER */}
            <div className="lg:col-span-5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                    <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider font-mono">Composition Intercept</span>
                  </div>
                  <div className="flex bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <button
                      onClick={() => setCompositionBasis("dry")}
                      className={`px-2 py-0.5 text-[9px] font-mono rounded transition ${
                        compositionBasis === "dry" ? "bg-white dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800 shadow-sm font-medium" : "text-zinc-500 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                      }`}
                    >
                      Dry Basis
                    </button>
                    <button
                      onClick={() => setCompositionBasis("wet")}
                      className={`px-2 py-0.5 text-[9px] font-mono rounded transition ${
                        compositionBasis === "wet" ? "bg-white dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800 shadow-sm font-medium" : "text-zinc-500 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                      }`}
                    >
                      Wet Basis
                    </button>
                  </div>
                </div>

                {/* Graphic horizontal mole percent stack visualizer */}
                {result && (
                  <div className="mb-4">
                    <div className="text-[8px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1.5 font-mono">Visual Stack Representation</div>
                    <div className="h-4 w-full rounded-md overflow-hidden flex border border-zinc-200 dark:border-zinc-800">
                      {(() => {
                        const comp = compositionBasis === "dry" 
                          ? result.interpolatedAtTarget.dryComposition 
                          : result.interpolatedAtTarget.wetComposition;
                        
                        const colors: Record<string, string> = {
                          H2: "bg-cyan-500",
                          CH4: "bg-pink-500",
                          H2O: "bg-blue-500",
                          CO: "bg-yellow-500",
                          CO2: "bg-emerald-500",
                          N2: "bg-zinc-600",
                          Ar: "bg-zinc-800"
                        };

                        return Object.entries(comp)
                          .filter(([gas, val]) => gas !== "Total" && (val as number) > 0.01)
                          .map(([gas, val]) => {
                            const valNum = val as number;
                            return (
                              <div
                                key={gas}
                                className={`h-full ${colors[gas] || "bg-zinc-700"} transition-all duration-300 relative`}
                                style={{ width: `${valNum}%` }}
                                title={`${gas}: ${valNum.toFixed(2)}%`}
                              />
                            );
                          });
                      })()}
                    </div>
                  </div>
                )}

                {/* List of gas components with progress bars */}
                <div className="space-y-2.5">
                  {result && (() => {
                    const comp = compositionBasis === "dry" 
                      ? result.interpolatedAtTarget.dryComposition 
                      : result.interpolatedAtTarget.wetComposition;

                    const gasLabels: Record<string, { label: string; desc: string; color: string; border: string }> = {
                      H2: { label: "Hydrogen (H2)", desc: "Primary reforming product. Higher yields represent high chemical conversion rate.", color: "bg-cyan-500", border: "border-cyan-500/20" },
                      CH4: { label: "Methane (CH4)", desc: "Feedstock slip. Reflects unreacted methane flowing out of catalyst beds.", color: "bg-pink-500", border: "border-pink-500/20" },
                      H2O: { label: "Water Vapor (H2O)", desc: "Excess steam reactant. Fully condensed/removed in Dry gas analyzer basis.", color: "bg-blue-500", border: "border-blue-500/20" },
                      CO: { label: "Carbon Monoxide (CO)", desc: "Primary side-product. Feed gas for downstream high-temp shift reactors.", color: "bg-yellow-500", border: "border-yellow-500/20" },
                      CO2: { label: "Carbon Dioxide (CO2)", desc: "Formed via in-situ water gas shift reaction within the catalyst bed.", color: "bg-emerald-500", border: "border-emerald-500/20" },
                      N2: { label: "Nitrogen (N2)", desc: "Inert spectator gas. Passes completely unreacted through the SMR system.", color: "bg-zinc-500", border: "border-zinc-500/20" },
                      Ar: { label: "Argon (Ar)", desc: "Trace inert gas. Used as a reference calibration tracer for plant analyzers.", color: "bg-zinc-700", border: "border-zinc-700/20" },
                    };

                    return Object.entries(comp)
                      .filter(([gas]) => gas !== "Total")
                      .map(([gas, value]) => {
                        const valueNum = value as number;
                        const isHovered = hoveredGas === gas;
                        const spec = gasLabels[gas] || { label: gas, desc: "Process gas component.", color: "bg-zinc-400", border: "border-zinc-400/20" };

                        return (
                          <div 
                            key={gas}
                            className={`p-1.5 rounded-lg border transition duration-150 cursor-pointer ${
                              isHovered ? "bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700" : "border-transparent hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50"
                            }`}
                            onMouseEnter={() => setHoveredGas(gas)}
                            onMouseLeave={() => setHoveredGas(null)}
                          >
                            <div className="flex justify-between text-[10px] font-mono mb-1">
                              <span className="text-zinc-700 dark:text-zinc-300 font-semibold">{spec.label}</span>
                              <span className="text-zinc-900 dark:text-white font-bold">{valueNum.toFixed(3)} mol%</span>
                            </div>
                            <div className="w-full bg-zinc-100 dark:bg-zinc-900 h-1.5 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-800">
                              <div 
                                className={`h-full ${spec.color} transition-all duration-500`}
                                style={{ width: `${valueNum}%` }}
                              />
                            </div>
                          </div>
                        );
                      });
                  })()}
                </div>
              </div>

              {/* Composition explanatory details block */}
              <div className="mt-3 p-2 bg-zinc-100/60 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-lg text-[9px] font-mono text-zinc-600 dark:text-zinc-500 leading-relaxed min-h-[50px]">
                {hoveredGas ? (
                  <p>
                    <strong className="text-zinc-700 dark:text-zinc-400 uppercase">{hoveredGas} Information:</strong><br />
                    {(() => {
                      const gasExpls: Record<string, string> = {
                        CH4: "Methane (CH4) represents unreacted hydrocarbon slip. High values indicate low catalyst activity or low SMR temperature.",
                        H2: "Hydrogen (H2) is the primary target product of steam methane reforming. High H2 concentration is desired.",
                        H2O: "Water (H2O) is the excess steam reactant. In Dry Gas Analyzer basis, H2O is fully condensed (0%).",
                        CO: "Carbon Monoxide (CO) is a major product of reforming, which is typically converted further to H2 in the downstream Shift Reactor.",
                        CO2: "Carbon Dioxide (CO2) is produced by the Water Gas Shift (WGS) side-reaction in the reformer tubes.",
                        N2: "Nitrogen (N2) is an inert component from the feed gas, passing through the reformer without reacting.",
                        Ar: "Argon (Ar) is an inert noble trace gas, acting as a permanent visual reference tracer."
                      };
                      return gasExpls[hoveredGas] || "";
                    })()}
                  </p>
                ) : (
                  <p className="italic text-center text-zinc-500 dark:text-zinc-600">Hover over any composition row to view chemical properties and process details.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* INTERACTIVE CHART VISUALIZATION SECTION */}
        <section className="xl:col-span-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-zinc-900 dark:text-white">Dynamic 1D Axial Profiles</h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setActiveChartTab("temperature")}
                className={`px-3 py-1 text-xs font-mono rounded-lg border transition ${
                  activeChartTab === "temperature"
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                    : "bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                Gas Temperature
              </button>
              <button
                onClick={() => setActiveChartTab("pressure")}
                className={`px-3 py-1 text-xs font-mono rounded-lg border transition ${
                  activeChartTab === "pressure"
                    ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30"
                    : "bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                Hydraulic Drop (P)
              </button>
              <button
                onClick={() => setActiveChartTab("wetComp")}
                className={`px-3 py-1 text-xs font-mono rounded-lg border transition ${
                  activeChartTab === "wetComp"
                    ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30"
                    : "bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                Wet Composition Matrix
              </button>
              <button
                onClick={() => setActiveChartTab("dryComp")}
                className={`px-3 py-1 text-xs font-mono rounded-lg border transition ${
                  activeChartTab === "dryComp"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    : "bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                Dry Gas Analyzer (mol%)
              </button>
              <button
                onClick={() => setActiveChartTab("heatFlux")}
                className={`px-3 py-1 text-xs font-mono rounded-lg border transition ${
                  activeChartTab === "heatFlux"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                    : "bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                Combustion Heat Flux
              </button>
            </div>
          </div>

          {/* SVG CHART CONTAINER */}
          <div className="relative bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row gap-6">
            <div className="flex-1 min-w-0 relative">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-auto overflow-visible select-none"
                onMouseMove={handleSvgMouseMove}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Horizontal gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const yVal = chartScales.minY + ratio * (chartScales.maxY - chartScales.minY);
                  const y = mapY(yVal);
                  if (isNaN(yVal) || isNaN(y)) return null;
                  return (
                    <g key={idx}>
                      <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke={theme === "dark" ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"} strokeDasharray="2 2" />
                      <text x={paddingLeft - 8} y={y + 4} textAnchor="end" fill="#71717a" className="text-[9px] font-mono">
                        {yVal.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </text>
                    </g>
                  );
                })}

                {/* Vertical gridlines (axial length ticks) */}
                {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((ratio, idx) => {
                  const zVal = ratio * inputs.L;
                  const x = mapX(zVal);
                  if (isNaN(zVal) || isNaN(x)) return null;
                  return (
                    <g key={idx}>
                      <line x1={x} y1={paddingTop} x2={x} y2={chartHeight - paddingBottom} stroke={theme === "dark" ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"} strokeDasharray="2 2" />
                      <text x={x} y={chartHeight - paddingBottom + 14} textAnchor="middle" fill="#71717a" className="text-[9px] font-mono">
                        {zVal.toFixed(1)}m
                      </text>
                    </g>
                  );
                })}

                {/* CHART CURVES */}
                {activeChartTab === "temperature" && (
                  <>
                    <path d={getPathD(p => p.temp)} fill="none" stroke="#f43f5e" strokeWidth="2.5" />
                    {/* Target outlet indicator */}
                    {!isNaN(inputs.T_out_target) && isFinite(inputs.T_out_target) && !isNaN(mapY(inputs.T_out_target)) && (
                      <>
                        <line x1={paddingLeft} y1={mapY(inputs.T_out_target)} x2={chartWidth - paddingRight} y2={mapY(inputs.T_out_target)} stroke="#a855f7" strokeWidth="1" strokeDasharray="4 4" />
                        <text x={paddingLeft + 10} y={mapY(inputs.T_out_target) - 5} textAnchor="start" fill="#c084fc" className="text-[8px] font-mono">
                          Target Monitor ({inputs.T_out_target}°C)
                        </text>
                      </>
                    )}
                  </>
                )}

                {activeChartTab === "pressure" && (
                  <path d={getPathD(p => p.press)} fill="none" stroke="#8b5cf6" strokeWidth="2.5" />
                )}

                {activeChartTab === "wetComp" && (
                  <>
                    <path d={getPathD(p => p.wetCH4)} fill="none" stroke="#a8a29e" strokeWidth="1.5" />
                    <path d={getPathD(p => p.wetH2)} fill="none" stroke="#06b6d4" strokeWidth="2" />
                    <path d={getPathD(p => p.wetH2O)} fill="none" stroke="#3b82f6" strokeWidth="1.5" />
                    <path d={getPathD(p => p.wetCO)} fill="none" stroke="#eab308" strokeWidth="1.5" />
                    <path d={getPathD(p => p.wetCO2)} fill="none" stroke="#10b981" strokeWidth="1.5" />
                  </>
                )}

                {activeChartTab === "dryComp" && (
                  <>
                    <path d={getPathD(p => p.dryCH4)} fill="none" stroke="#ec4899" strokeWidth="2.5" />
                    <path d={getPathD(p => p.dryH2)} fill="none" stroke="#06b6d4" strokeWidth="2.5" />
                    <path d={getPathD(p => p.dryCO)} fill="none" stroke="#eab308" strokeWidth="1.5" />
                    <path d={getPathD(p => p.dryCO2)} fill="none" stroke="#10b981" strokeWidth="1.5" />
                  </>
                )}

                {activeChartTab === "heatFlux" && (
                  <path d={getPathD(p => p.fluxKw)} fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="1 1" />
                )}

                {/* Mouse Hover Tracker Crosshair */}
                {hoverPointInfo && !isNaN(hoverPointInfo.x) && (
                  <g>
                    <line x1={hoverPointInfo.x} y1={paddingTop} x2={hoverPointInfo.x} y2={chartHeight - paddingBottom} stroke="rgba(34, 211, 238, 0.4)" strokeWidth="1.5" />
                  </g>
                )}

                {/* X Axis Title */}
                <text x={(chartWidth - paddingLeft - paddingRight)/2 + paddingLeft} y={chartHeight - 4} textAnchor="middle" fill="#52525b" className="text-[10px] font-mono">
                  AXIAL TUBE LENGTH POSITION (m)
                </text>
              </svg>
            </div>

            {/* CHART LEGENDS & CURRENT HOVER POPUP INFO */}
            <div className="w-full md:w-56 shrink-0 flex flex-col justify-between border-t md:border-t-0 md:border-l border-zinc-200 dark:border-zinc-800 pt-4 md:pt-0 md:pl-5">
              <div>
                <div className="text-xs font-bold font-mono uppercase text-zinc-500 dark:text-zinc-400 mb-2 border-b border-zinc-200 dark:border-zinc-800 pb-1">Species Legend</div>
                {activeChartTab === "wetComp" || activeChartTab === "dryComp" ? (
                  <div className="space-y-1.5 text-[11px] font-mono">
                    <div className="flex items-center gap-2"><span className="w-2.5 h-1.5 bg-cyan-500 rounded-sm inline-block"></span> <span className="text-zinc-700 dark:text-zinc-200">Hydrogen (H2)</span></div>
                    <div className="flex items-center gap-2"><span className="w-2.5 h-1.5 bg-rose-500 rounded-sm inline-block"></span> <span className="text-zinc-700 dark:text-zinc-200">CH4 (Methane)</span></div>
                    {activeChartTab === "wetComp" && <div className="flex items-center gap-2"><span className="w-2.5 h-1.5 bg-blue-500 rounded-sm inline-block"></span> <span className="text-zinc-700 dark:text-zinc-200">Steam (H2O)</span></div>}
                    <div className="flex items-center gap-2"><span className="w-2.5 h-1.5 bg-yellow-500 rounded-sm inline-block"></span> <span className="text-zinc-700 dark:text-zinc-200">Carbon Monoxide</span></div>
                    <div className="flex items-center gap-2"><span className="w-2.5 h-1.5 bg-emerald-500 rounded-sm inline-block"></span> <span className="text-zinc-700 dark:text-zinc-200">CO2 (Dioxide)</span></div>
                  </div>
                ) : (
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-sans italic leading-tight">
                    {activeChartTab === "temperature" && "Axial gas thermal gradient representing rapid endothermic catalytic cracking heat consumption inside tube."}
                    {activeChartTab === "pressure" && "Pressure decline along catalyst pellets calculated dynamically using the 1D Ergun hydraulic equation."}
                    {activeChartTab === "heatFlux" && "Row-by-row heat flux step distribution transferred across zones from burners to outer tube surface area."}
                  </p>
                )}
              </div>

              {/* Live crosshair values */}
              <div className="mt-4 bg-zinc-100/60 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 p-3 rounded-lg flex flex-col gap-2">
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800 pb-1">Interactive Probe</div>
                {hoverPointInfo ? (
                  <div className="space-y-2 text-xs font-mono">
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pb-1.5 border-b border-zinc-200 dark:border-zinc-800/60">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Pos:</span>
                        <span className="text-zinc-900 dark:text-white font-bold">{hoverPointInfo.z.toFixed(2)}m</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Temp:</span>
                        <span className="text-rose-600 dark:text-rose-400 font-bold">{hoverPointInfo.temp.toFixed(1)}°C</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Pres:</span>
                        <span className="text-violet-600 dark:text-violet-400 font-bold text-[10px]">{hoverPointInfo.press.toFixed(2)} kg/cm²g</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Flux:</span>
                        <span className="text-amber-600 dark:text-amber-500 font-bold">{hoverPointInfo.flux.toFixed(1)}k</span>
                      </div>
                    </div>

                    <div>
                      <div className="text-[9px] text-zinc-600 dark:text-zinc-400 uppercase font-bold tracking-tight mb-1">Dry Gas Mix (mol%)</div>
                      <div className="grid grid-cols-2 gap-x-2 text-[10px]">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">H2:</span>
                          <span className="text-cyan-600 dark:text-cyan-400 font-medium">{hoverPointInfo.dryH2.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">CH4:</span>
                          <span className="text-pink-600 dark:text-pink-400 font-medium">{hoverPointInfo.dryCH4.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">CO:</span>
                          <span className="text-yellow-600 dark:text-yellow-400 font-medium">{hoverPointInfo.dryCO.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">CO2:</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{hoverPointInfo.dryCO2.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">N2:</span>
                          <span className="text-zinc-600 dark:text-zinc-400 font-medium">{hoverPointInfo.dryN2.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Ar:</span>
                          <span className="text-zinc-600 dark:text-zinc-400 font-medium">{hoverPointInfo.dryAr.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-[9px] text-zinc-600 dark:text-zinc-400 uppercase font-bold tracking-tight mb-1">Wet Gas Mix (mol%)</div>
                      <div className="grid grid-cols-2 gap-x-2 text-[10px]">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">H2:</span>
                          <span className="text-cyan-600 dark:text-cyan-400 font-medium">{hoverPointInfo.wetH2.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">CH4:</span>
                          <span className="text-pink-600 dark:text-pink-400 font-medium">{hoverPointInfo.wetCH4.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">H2O:</span>
                          <span className="text-blue-600 dark:text-blue-400 font-medium">{hoverPointInfo.wetH2O.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">CO:</span>
                          <span className="text-yellow-600 dark:text-yellow-400 font-medium">{hoverPointInfo.wetCO.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">CO2:</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{hoverPointInfo.wetCO2.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">N2:</span>
                          <span className="text-zinc-600 dark:text-zinc-400 font-medium">{hoverPointInfo.wetN2.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-zinc-500 italic">
                    Hover mouse over the chart curve to read localized node data.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* BOTTOM TABLES SECTION (BENTO BLOCK 3) */}
        <section className="xl:col-span-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
          {/* Tabs */}
          <div className="bg-zinc-50/50 dark:bg-zinc-900/40 border-b border-zinc-200 dark:border-zinc-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex bg-zinc-100 dark:bg-zinc-950 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 self-start">
              <button
                onClick={() => setActiveTableTab("hydraulics")}
                className={`px-3.5 py-1.5 text-xs font-mono rounded-md transition ${
                  activeTableTab === "hydraulics" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm font-medium" : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                Burner Zone Hydraulics
              </button>
              <button
                onClick={() => setActiveTableTab("matrix")}
                className={`px-3.5 py-1.5 text-xs font-mono rounded-md transition ${
                  activeTableTab === "matrix" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm font-medium" : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                Axial Grid Matrix Ledger
              </button>
            </div>

            {/* Export buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={exportToCSV}
                className="bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 rounded-lg text-xs font-mono transition flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> CSV Exporter
              </button>
            </div>
          </div>

          <div className="p-5 flex-1 bg-zinc-50/20 dark:bg-zinc-950/20">
            {activeTableTab === "hydraulics" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                      <th className="py-2.5 px-4 font-semibold uppercase">Zone / Row Num</th>
                      <th className="py-2.5 px-4 font-semibold uppercase">Header Pressure (kg/cm²g)</th>
                      <th className="py-2.5 px-4 font-semibold uppercase">Active Burners</th>
                      <th className="py-2.5 px-4 font-semibold uppercase">Flow Distributed (NMC/h)</th>
                      <th className="py-2.5 px-4 font-semibold uppercase text-right">Heat Released (Gcal/h)</th>
                      <th className="py-2.5 px-4 font-semibold uppercase text-right">Burner Load (kcal/h)</th>
                      <th className="py-2.5 px-4 font-semibold uppercase text-right">Tube Zone Heat Flux (kW/m²)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                    {result && result.zoneSummaries.map((row, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 text-zinc-800 dark:text-zinc-200">
                        <td className="py-3 px-4 font-semibold">{row.rowNum}</td>
                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-300">{row.pressure.toFixed(2)}</td>
                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-300">{row.burners}</td>
                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-300">{row.flow.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                        <td className="py-3 px-4 text-right text-amber-600 dark:text-amber-400">{row.heatRelease.toFixed(3)}</td>
                        <td className="py-3 px-4 text-right text-zinc-600 dark:text-zinc-300">{row.heatPerBurner.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400 font-semibold">{(row.localFlux / 859.85).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTableTab === "matrix" && (
              <div className="space-y-4">
                {/* Search box */}
                <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-950 px-3.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 w-full sm:w-80">
                  <Search className="w-4 h-4 text-zinc-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search length, temp, press..."
                    value={matrixSearch}
                    onChange={(e) => { setMatrixSearch(e.target.value); }}
                    className="bg-transparent border-none outline-none text-xs text-zinc-900 dark:text-white font-mono placeholder:text-zinc-400 dark:placeholder:text-zinc-600 w-full"
                  />
                </div>

                <div className="overflow-x-auto overflow-y-auto max-h-[500px] border border-zinc-200 dark:border-zinc-800/60 rounded-xl bg-white dark:bg-zinc-950/40 relative">
                  <table className="w-full text-left border-collapse text-[11px] font-mono table-auto min-w-[1400px]">
                    <thead>
                      <tr className="bg-zinc-100 dark:bg-zinc-900/40 text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-20">
                        <th className="py-2.5 px-4 font-semibold sticky left-0 top-0 bg-zinc-200 dark:bg-zinc-900 border-r border-zinc-300 dark:border-zinc-800 z-30">Length (m)</th>
                        <th className="py-2.5 px-4 font-semibold bg-zinc-100 dark:bg-zinc-900">Temp (°C)</th>
                        <th className="py-2.5 px-4 font-semibold bg-zinc-100 dark:bg-zinc-900">Press (kg/cm²g)</th>
                        <th className="py-2.5 px-4 font-semibold text-rose-500 bg-zinc-100 dark:bg-zinc-900">Dry CH4 %</th>
                        <th className="py-2.5 px-4 font-semibold text-rose-400 bg-zinc-100 dark:bg-zinc-900">Wet CH4 %</th>
                        <th className="py-2.5 px-4 font-semibold text-cyan-500 bg-zinc-100 dark:bg-zinc-900">Dry H2 %</th>
                        <th className="py-2.5 px-4 font-semibold text-cyan-400 bg-zinc-100 dark:bg-zinc-900">Wet H2 %</th>
                        <th className="py-2.5 px-4 font-semibold text-yellow-600 dark:text-yellow-500 bg-zinc-100 dark:bg-zinc-900">Dry CO %</th>
                        <th className="py-2.5 px-4 font-semibold text-yellow-500 bg-zinc-100 dark:bg-zinc-900">Wet CO %</th>
                        <th className="py-2.5 px-4 font-semibold text-emerald-500 bg-zinc-100 dark:bg-zinc-900">Dry CO2 %</th>
                        <th className="py-2.5 px-4 font-semibold text-emerald-400 bg-zinc-100 dark:bg-zinc-900">Wet CO2 %</th>
                        <th className="py-2.5 px-4 font-semibold text-blue-500 bg-zinc-100 dark:bg-zinc-900">Dry H2O %</th>
                        <th className="py-2.5 px-4 font-semibold text-blue-400 bg-zinc-100 dark:bg-zinc-900">Wet H2O %</th>
                        <th className="py-2.5 px-4 font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-900">Dry N2 %</th>
                        <th className="py-2.5 px-4 font-semibold text-zinc-400 bg-zinc-100 dark:bg-zinc-900">Wet N2 %</th>
                        <th className="py-2.5 px-4 font-semibold text-purple-500 bg-zinc-100 dark:bg-zinc-900">Dry Ar %</th>
                        <th className="py-2.5 px-4 font-semibold text-purple-400 bg-zinc-100 dark:bg-zinc-900">Wet Ar %</th>
                        <th className="py-2.5 px-4 font-semibold text-right bg-zinc-100 dark:bg-zinc-900">Row Flux (kW/m²)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-900">
                      {filteredMatrix.map((node, idx) => (
                        <tr key={idx} className="group hover:bg-zinc-50 dark:hover:bg-zinc-900/40 text-zinc-800 dark:text-zinc-200">
                          <td className="py-2.5 px-4 font-semibold text-zinc-500 dark:text-zinc-400 sticky left-0 bg-white dark:bg-zinc-950 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 z-10 transition-colors">
                            {node.z.toFixed(3)}
                          </td>
                          <td className="py-2.5 px-4 text-zinc-900 dark:text-zinc-100 font-semibold">{node.temp.toFixed(1)}</td>
                          <td className="py-2.5 px-4 text-violet-600 dark:text-violet-400">{node.press.toFixed(3)}</td>
                          <td className="py-2.5 px-4 text-rose-600 dark:text-rose-500">{node.dryCH4.toFixed(3)}</td>
                          <td className="py-2.5 px-4 text-rose-500 dark:text-rose-400">{node.wetCH4.toFixed(3)}</td>
                          <td className="py-2.5 px-4 text-cyan-600 dark:text-cyan-500">{node.dryH2.toFixed(3)}</td>
                          <td className="py-2.5 px-4 text-cyan-500 dark:text-cyan-400">{node.wetH2.toFixed(3)}</td>
                          <td className="py-2.5 px-4 text-yellow-600 dark:text-yellow-500">{node.dryCO.toFixed(3)}</td>
                          <td className="py-2.5 px-4 text-yellow-500 dark:text-yellow-400">{node.wetCO.toFixed(3)}</td>
                          <td className="py-2.5 px-4 text-emerald-600 dark:text-emerald-500">{node.dryCO2.toFixed(3)}</td>
                          <td className="py-2.5 px-4 text-emerald-500 dark:text-emerald-400">{node.wetCO2.toFixed(3)}</td>
                          <td className="py-2.5 px-4 text-blue-600 dark:text-blue-500">{(0.0).toFixed(3)}</td>
                          <td className="py-2.5 px-4 text-blue-500 dark:text-blue-400">{node.wetH2O.toFixed(3)}</td>
                          <td className="py-2.5 px-4 text-zinc-500 dark:text-zinc-400">{node.dryN2.toFixed(3)}</td>
                          <td className="py-2.5 px-4 text-zinc-400 dark:text-zinc-500">{node.wetN2.toFixed(3)}</td>
                          <td className="py-2.5 px-4 text-purple-500">{node.dryAr.toFixed(3)}</td>
                          <td className="py-2.5 px-4 text-purple-400">{node.wetAr.toFixed(3)}</td>
                          <td className="py-2.5 px-4 text-right text-amber-600 dark:text-amber-500">{node.fluxKw.toFixed(2)}</td>
                        </tr>
                      ))}
                      {filteredMatrix.length === 0 && (
                        <tr>
                          <td colSpan={18} className="py-6 text-center text-zinc-500 italic">No search results found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200/80 dark:border-zinc-800/80 py-2.5 px-4 text-center bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur flex flex-col items-center justify-center gap-0.5 shadow-sm">
        <div className="text-slate-800 dark:text-zinc-100 font-bold text-xs sm:text-sm tracking-tight">
          Developed by Muhammad Ans, Process Control Engineer.
        </div>
        <div className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-slate-400 dark:text-zinc-500 font-medium">
          © 2026 | ALL RIGHTS RESERVED.
        </div>
      </footer>
    </div>
  );
}
