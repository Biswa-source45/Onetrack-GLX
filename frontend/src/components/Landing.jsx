import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart as RechartsBarChart, 
  Bar, 
  Cell, 
  PieChart as RechartsPieChart, 
  Pie,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip
} from "recharts"
import { 
  Layers, 
  Menu, 
  X, 
  Sparkles, 
  Play, 
  ArrowRight, 
  FileCheck2, 
  ShieldAlert, 
  Activity, 
  Award,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Cpu,
  FileCheck,
  Shield,
  Lightbulb,
  CornerDownRight,
  Info,
  Check,
  ChevronRight,
  FileText
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

import { tokenStorage } from "../services/auth"
import { Link } from "react-router-dom"

/* ==========================================
   1. NAVBAR COMPONENT
   ========================================== */
function Navbar({ onNavigate }) {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        isScrolled
          ? "border-b border-neutral-200/80 bg-white/80 backdrop-blur-md shadow-xs"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* LOGO */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
            <Layers className="size-4.5" />
          </div>
          <div className="flex flex-col">
            <span className="font-heading text-base font-bold tracking-tight text-neutral-900">Onetrack GeM AI</span>
            <span className="text-[9px] font-semibold text-neutral-400 uppercase tracking-widest leading-none">Tender Intelligence</span>
          </div>
        </div>

        {/* DESKTOP NAV */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-600">
          <a href="#about" className="hover:text-black transition-colors">About the App</a>
          <a href="#demo" className="hover:text-black transition-colors">Interactive Demo</a>
        </nav>

        {/* RIGHT SIDE ACTIONS */}
        <div className="hidden md:flex items-center gap-3">
          {tokenStorage.getAccessToken() ? (
            <Button 
              asChild
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm h-9 px-4 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Link to="/dashboard">Go to Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button 
                onClick={() => onNavigate("login")}
                variant="ghost" 
                className="text-sm font-medium text-neutral-600 hover:text-black hover:bg-neutral-50 px-4 py-2 h-9 rounded-lg cursor-pointer"
              >
                Login
              </Button>
              <Button 
                onClick={() => onNavigate("login")}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm h-9 px-4 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                Start Analysis
              </Button>
            </>
          )}
        </div>

        {/* MOBILE MENU BUTTON */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-1.5 text-neutral-500 hover:text-black focus:outline-none cursor-pointer"
        >
          {isMobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {/* MOBILE MENU DROPDOWN */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-b border-neutral-200 bg-white px-4 pt-2 pb-6 space-y-3 shadow-md animate-in fade-in slide-in-from-top duration-200">
          <a
            href="#about"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block w-full py-2 text-sm font-medium text-neutral-600 hover:text-black"
          >
            About the App
          </a>
          <a
            href="#demo"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block w-full py-2 text-sm font-medium text-neutral-600 hover:text-black"
          >
            Interactive Demo
          </a>
          <div className="border-t border-neutral-100 pt-3 flex flex-col gap-2">
            {tokenStorage.getAccessToken() ? (
              <Button 
                asChild
                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-9.5 rounded-lg cursor-pointer"
              >
                <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>
                  Go to Dashboard
                </Link>
              </Button>
            ) : (
              <>
                <Button 
                  onClick={() => {
                    setIsMobileMenuOpen(false)
                    onNavigate("login")
                  }}
                  variant="outline" 
                  className="w-full text-neutral-600 border-neutral-200 hover:bg-neutral-50 h-9.5 rounded-lg cursor-pointer"
                >
                  Login
                </Button>
                <Button 
                  onClick={() => {
                    setIsMobileMenuOpen(false)
                    onNavigate("login")
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white h-9.5 rounded-lg cursor-pointer"
                >
                  Start Analysis
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

/* ==========================================
   2. HERO COMPONENT
   ========================================== */
function Hero({ onNavigate }) {
  const sparklineData = [
    { name: "W1", score: 65 },
    { name: "W2", score: 70 },
    { name: "W3", score: 68 },
    { name: "W4", score: 85 },
    { name: "W5", score: 82 },
    { name: "W6", score: 94 }
  ]

  const barData = [
    { name: "Bid A", value: 40 },
    { name: "Bid B", value: 80 },
    { name: "Bid C", value: 60 }
  ]

  const pieData = [
    { name: "Pass", value: 75, color: "#2563eb" },
    { name: "Fail", value: 25, color: "#f43f5e" }
  ]

  return (
    <section className="relative bg-white pt-12 pb-24 overflow-hidden border-b border-neutral-100">
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1.2px,transparent_1.2px)] [background-size:24px_24px] opacity-45 pointer-events-none" />
      <div className="absolute top-[-20%] left-[-10%] w-[550px] h-[550px] rounded-full bg-blue-500/5 blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[450px] h-[450px] rounded-full bg-indigo-500/5 blur-[140px] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          
          <div className="lg:col-span-6 space-y-8 text-left">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-100/60 shadow-2xs">
              <Sparkles className="size-3.5 text-blue-600 animate-pulse" />
              <span>Next-Gen Tender Intelligence</span>
            </div>

            <h1 className="font-display text-4xl font-normal tracking-tight text-neutral-900 sm:text-5xl lg:text-[54px] leading-[1.08]">
              AI-Powered GeM Tender Intelligence Platform
            </h1>

            <p className="text-base sm:text-lg text-neutral-500 leading-relaxed font-normal max-w-xl">
              Consolidate procurement guidelines, match criteria, analyze technical compliance, and run instant eligibility checks for GeM bids in seconds.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3.5 pt-2">
              {tokenStorage.getAccessToken() ? (
                <Button
                  asChild
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm h-11 px-8 rounded-xl shadow-md shadow-blue-500/10 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Link to="/dashboard">
                    Go to Dashboard
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <Button
                  onClick={() => onNavigate("login")}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm h-11 px-8 rounded-xl shadow-md shadow-blue-500/10 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  Analyze Tenders
                  <ArrowRight className="size-4" />
                </Button>
              )}
              <Button
                onClick={() => document.getElementById("about")?.scrollIntoView({ behavior: "smooth" })}  
                variant="outline"
                className="w-full sm:w-auto text-neutral-600 border-neutral-250 hover:bg-neutral-50 font-semibold text-sm h-11 px-8 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                Learn More
              </Button>
            </div>

            <div className="pt-6 border-t border-neutral-100 space-y-4">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400 block">
                COMPLIANCE & SYSTEM METRICS
              </span>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">✓</span>
                  GeM API Schemas
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">✓</span>
                  ISO 27001 Secure Data
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">✓</span>
                  MII Local Sourcing Audits
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE HERO TELEMETRY MOCKUP */}
          <div className="lg:col-span-6 relative">
            <div className="absolute -inset-4 rounded-3xl bg-blue-500/5 blur-xl pointer-events-none" />

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="absolute -top-6 -left-6 z-20 hidden sm:flex items-center gap-3 bg-white p-3.5 rounded-xl border border-neutral-200 shadow-lg pointer-events-none"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                <Award className="size-5" />
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-neutral-400 block">WIN PROBABILITY</span>
                <span className="text-xs font-extrabold text-neutral-900 block leading-tight">94.2% Success</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="absolute -bottom-6 -right-6 z-20 hidden sm:flex items-center gap-3 bg-white p-3.5 rounded-xl border border-neutral-200 shadow-lg pointer-events-none"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                <Activity className="size-4.5" />
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-neutral-400 block">AUDIT SPEED</span>
                <span className="text-xs font-extrabold text-neutral-900 block leading-tight">&lt; 15s Per Document</span>
              </div>
            </motion.div>

            <motion.div 
              className="relative rounded-2xl border border-neutral-200/80 bg-neutral-50/70 p-4.5 shadow-xl overflow-hidden"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center justify-between pb-3 border-b border-neutral-200 mb-4">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-neutral-300" />
                  <div className="w-3 h-3 rounded-full bg-neutral-200" />
                  <div className="w-3 h-3 rounded-full bg-neutral-100" />
                </div>
                <div className="flex items-center gap-1">
                  <Layers className="size-3 text-blue-600" />
                  <span className="text-[9px] font-semibold text-neutral-400 font-mono">tender_match_model.py</span>
                </div>
                <Badge className="bg-blue-600 text-white font-bold text-[8px] h-3.5 border-none">
                  READY
                </Badge>
              </div>

              <div className="space-y-4">
                <div className="bg-white border border-neutral-200 p-3.5 rounded-xl flex items-center justify-between shadow-2xs">
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold text-neutral-400">ACTIVE GEM TENDER</span>
                    <h3 className="text-xs font-bold text-neutral-900">#GeM-2026-B-99881: Multi-City CCTV Upgrade</h3>
                    <p className="text-[9px] text-neutral-500">Value: ₹18.5 Crores • June 24, 2026</p>
                  </div>
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-extrabold">
                    94%
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card className="border border-neutral-200/80 bg-white p-3 shadow-2xs flex flex-col justify-between h-32">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-neutral-400">Match Accuracy Trend</span>
                      <div className="text-sm font-extrabold text-neutral-900">94.2% Max</div>
                    </div>
                    <div className="h-12 w-full mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sparklineData} margin={{ top: 2, right: 2, left: -30, bottom: 2 }}>
                          <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={1.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card className="border border-neutral-200/80 bg-white p-3 shadow-2xs flex flex-col justify-between h-32">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-neutral-400">RFP Document Scores</span>
                      <div className="text-sm font-extrabold text-neutral-900">Passed Pre-Q</div>
                    </div>
                    <div className="h-12 w-full mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBarChart data={barData} margin={{ top: 2, right: 2, left: -30, bottom: 2 }}>
                          <Bar dataKey="value" fill="#2563eb" radius={[2, 2, 0, 0]} />
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card className="border border-neutral-200/80 bg-white p-3.5 shadow-2xs flex items-center justify-between col-span-1 sm:col-span-2 h-24">
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase font-bold text-neutral-400">Compliance Audit Check</span>
                      <h4 className="text-xs font-bold text-neutral-900">75% Mandatory Documents Active</h4>
                      <p className="text-[9px] text-neutral-500">1 Warning: Sourcing Undertaking missing</p>
                    </div>
                    
                    <div className="h-16 w-16 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={15}
                            outerRadius={24}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </div>
              </div>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  )
}

/* ==========================================
   3. ABOUT THE APPLICATION COMPONENT (COMBINED ABOUT & SIMULATOR)
   ========================================== */
function About() {
  const [selectedTender, setSelectedTender] = useState("cctv")
  const [analysisState, setAnalysisState] = useState("idle") // idle, scanning, parsing, complete
  const [progress, setProgress] = useState(0)

  const mockTenders = {
    cctv: {
      title: "GeM-2026-B-99881: Multi-City Smart CCTV Upgrade",
      authority: "Municipal Police Department & IT Cell",
      value: "₹18,50,00,000 (18.5 Cr)",
      deadline: "June 24, 2026",
      score: 94,
      summary: "This tender requests the deployment of artificial intelligence-based crowd management cameras and analytical servers. The bidder must have ISO 27001 certification and a minimum direct turnover of ₹5 Cr in security surveillance systems.",
      compliance: [
        { item: "ISO 27001 Security Standard", status: "passed", detail: "Verified: Corporate security audit certificate is active until Nov 2028." },
        { item: "Local Content Certificate (MII Class-I > 50%)", status: "passed", detail: "Verified: OEM dashboard lists local sourcing percentage at 58%." },
        { item: "Minimum Turnover >= 5.0 Crores", status: "passed", detail: "Verified: Average annual audited turnover is ₹14.5 Crores." },
        { item: "E-Waste Disposal Compliance Undertaking", status: "warning", detail: "Conditional: Form-X is missing from your profile. Needs signed PDF." }
      ],
      risks: [
        { severity: "low", title: "Liquidated Damages Constraint", desc: "Section 4.2 states a penalty of 1% per week of delay. Standard but requires strict hardware delivery monitoring." }
      ],
      recommendations: [
        "Procure surveillance storage disks from Class-I local manufacturer to secure MII compliance.",
        "Sign and stamp the electronic waste disposal authorization sheet before bid submission."
      ]
    },
    grid: {
      title: "GeM-2026-B-99120: Smart Electricity Grid Substation Expansion",
      authority: "State Power Grid Corp Ltd",
      value: "₹55,00,000 (55 Lakhs)",
      deadline: "June 18, 2026",
      score: 68,
      summary: "Tender involves upgrading sub-station relays and installing SCADA control boxes. Requires high-voltage contractor license and electrical safety certificates from the local board.",
      compliance: [
        { item: "Class A Electrical Contractor License", status: "failed", detail: "Failed: Contractor license is restricted to low-voltage (under 11kV) systems." },
        { item: "Average Turnover >= 15 Lakhs", status: "passed", detail: "Verified: Average audited turnover is ₹14.5 Crores." },
        { item: "Prior Commissioning Experience (2 projects)", status: "passed", detail: "Verified: Uploaded reference projects in Smart Substation upgrades." },
        { item: "3 Years Product Performance Guarantee", status: "warning", detail: "Flagged: Standard OEM warranty is 2 years. Requires extended SLA agreement." }
      ],
      risks: [
        { severity: "high", title: "Licensing Mismatch", desc: "Contractor license must support up to 33kV networks. Current license fails pre-qualification. Do not bid without JV." }
      ],
      recommendations: [
        "Form a Joint Venture (JV) with a licensed Class-A high voltage grid installer.",
        "Request OEM partner for a formal 3-year warranty extension confirmation letter."
      ]
    }
  }

  const runAnalysis = () => {
    setAnalysisState("scanning")
    setProgress(15)
    
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setAnalysisState("complete")
          return 100
        }
        const next = prev + Math.floor(Math.random() * 20) + 10
        if (next >= 50 && next < 80) {
          setAnalysisState("parsing")
        }
        return next > 100 ? 100 : next
      })
    }, 450)
  }

  const activeTender = mockTenders[selectedTender]

  return (
    <section id="about" className="py-24 bg-neutral-50/50 border-t border-neutral-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* HEADER */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
            ABOUT THE PLATFORM
          </span>
          <h2 className="font-display text-3xl font-normal tracking-tight text-neutral-900 sm:text-4xl mt-4">
            How Onetrack GeM AI Accelerates Your Bids
          </h2>
          <p className="mt-4 text-base text-neutral-500">
            A comprehensive, multi-stage RAG extraction and evaluation pipeline designed to verify compliance, analyze risk, and determine tender eligibility in under 15 seconds.
          </p>
        </div>

        {/* PILLARS & DETAILS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          
          {/* Platform Info Left */}
          <div className="lg:col-span-5 space-y-8">
            <div className="space-y-6">
              <h3 className="font-display text-lg font-normal text-neutral-900">
                Automated Pre-Qualification Audits
              </h3>
              <p className="text-sm text-neutral-500 leading-relaxed font-normal">
                Instead of manually combing through hundreds of pages of RFP conditions, Onetrack GeM AI automatically correlates your profile parameters against government procurement constraints.
              </p>
            </div>

            <div className="space-y-6 pt-4 border-t border-neutral-200">
              <div className="flex gap-4 items-start">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 text-blue-600">
                  <Cpu className="size-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-900">1. Instant RAG Extraction</h4>
                  <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                    Uses layout-aware OCR extraction and semantic RAG indexing to pull Turnover requirements, experience clauses, and credential schedules.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 text-blue-600">
                  <FileCheck className="size-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-900">2. Precheck & Validation</h4>
                  <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                    Instantly cross-references your active GST, MCA registration documents, and ISO certifications to generate audit warning reports.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 text-blue-600">
                  <Shield className="size-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-900">3. Bid Shield & Risk Detection</h4>
                  <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                    Detects hidden liquidated damages, strict delivery milestones, or non-standard OEM authorization letters that could fail qualification.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Demo Sandbox Right */}
          <div id="demo" className="lg:col-span-7 space-y-4">
            <h3 className="text-xs uppercase font-extrabold text-neutral-400 tracking-wider">
              Interactive Audit Sandbox
            </h3>
            
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setSelectedTender("cctv")
                  setAnalysisState("idle")
                }}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  selectedTender === "cctv" ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                CCTV Surveillance Upgrade
              </button>
              <button 
                onClick={() => {
                  setSelectedTender("grid")
                  setAnalysisState("idle")
                }}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  selectedTender === "grid" ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                Electricity Grid Substation
              </button>
            </div>

            <Card className="border border-neutral-200/80 bg-white rounded-2xl shadow-md min-h-[480px] flex flex-col overflow-hidden">
              <div className="border-b border-neutral-100 bg-neutral-50 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                  <span className="text-xs font-bold text-neutral-900 font-mono">Onetrack GeM Model</span>
                </div>
                <span className="text-[10px] font-bold font-mono text-neutral-450">
                  {analysisState === "idle" ? "READY" : analysisState.toUpperCase()}
                </span>
              </div>

              {analysisState === "idle" && (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
                  <div className="h-12 w-12 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-center text-neutral-450">
                    <FileText className="size-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-neutral-900">Pre-Loaded Government Tender RFP</h4>
                    <p className="text-xs text-neutral-500 max-w-sm mt-1">
                      Start the simulation to extract compliance checklists, turn-over eligibility, and identified risks.
                    </p>
                  </div>
                  <Button
                    onClick={runAnalysis}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Cpu className="size-4" /> Run AI Audit Simulation
                  </Button>
                </div>
              )}

              {(analysisState === "scanning" || analysisState === "parsing") && (
                <div className="flex-1 p-8 space-y-6 flex flex-col justify-center">
                  <div className="space-y-2 text-center">
                    <Cpu className="size-8 text-blue-600 animate-spin mx-auto mb-2" />
                    <h4 className="text-sm font-bold text-neutral-900">
                      {analysisState === "scanning" ? "Scanning RFP Sections..." : "Verifying Compliance Keys..."}
                    </h4>
                    <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                      Analyzing MCA database records and local manufacturing certifications against the uploaded draft.
                    </p>
                  </div>
                  <div className="w-full max-w-md mx-auto bg-neutral-100 h-1 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              {analysisState === "complete" && (
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 space-y-6 flex-1"
                  >
                    <div className="flex flex-col md:flex-row justify-between gap-6 border-b border-neutral-100 pb-5">
                      <div className="space-y-1">
                        <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Tender Matching Result</span>
                        <h4 className="text-xs font-bold text-neutral-900 leading-tight">
                          {activeTender.title}
                        </h4>
                        <p className="text-[10.5px] text-neutral-500 font-medium">
                          Authority: {activeTender.authority} • Value: {activeTender.value}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
                        <div className="relative flex items-center justify-center h-10 w-10 rounded-full bg-white border-2 border-neutral-200">
                          <span className={`text-[11px] font-extrabold ${activeTender.score >= 80 ? "text-blue-600" : "text-yellow-600"}`}>
                            {activeTender.score}%
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-neutral-400 block">Eligibility</span>
                          <span className="text-xs font-bold text-neutral-900 block leading-none">
                            {activeTender.score >= 80 ? "Qualified" : "Partner JV Required"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-blue-50/40 border border-blue-100/50 flex gap-3">
                      <Sparkles className="size-4.5 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">AI Summary</span>
                        <p className="text-xs text-neutral-600 leading-relaxed mt-1">{activeTender.summary}</p>
                      </div>
                    </div>

                    <div>
                      <h5 className="text-[10px] uppercase font-extrabold text-neutral-400 tracking-wider mb-3">
                        Clause Verification Checklist
                      </h5>
                      <div className="space-y-2">
                        {activeTender.compliance.map((item, i) => (
                          <div key={i} className="flex gap-3 p-2.5 rounded-lg border border-neutral-100 bg-neutral-50/30">
                            {item.status === "passed" && <CheckCircle2 className="size-4.5 text-emerald-600 shrink-0 mt-0.5" />}
                            {item.status === "warning" && <AlertTriangle className="size-4.5 text-yellow-600 shrink-0 mt-0.5" />}
                            {item.status === "failed" && <XCircle className="size-4.5 text-rose-600 shrink-0 mt-0.5" />}
                            <div>
                              <p className="text-xs font-bold text-neutral-900 leading-none">{item.item}</p>
                              <p className="text-[10px] text-neutral-500 mt-1 leading-tight">{item.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div className="p-3 rounded-xl border border-rose-100 bg-rose-50/20">
                        <div className="flex items-center gap-2 mb-2 text-rose-600">
                          <Shield className="size-4" />
                          <span className="text-[9px] font-bold uppercase tracking-wider">Identified Risk</span>
                        </div>
                        {activeTender.risks.map((risk, i) => (
                          <div key={i} className="space-y-1">
                            <h6 className="text-[11px] font-bold text-neutral-900 flex items-center gap-1 leading-none">
                              {risk.title}
                            </h6>
                            <p className="text-[10px] text-neutral-500 leading-normal mt-0.5">{risk.desc}</p>
                          </div>
                        ))}
                      </div>

                      <div className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/20">
                        <div className="flex items-center gap-2 mb-2 text-emerald-600">
                          <Lightbulb className="size-4" />
                          <span className="text-[9px] font-bold uppercase tracking-wider">AI Recommendation</span>
                        </div>
                        <ul className="space-y-1.5 text-[10px] text-neutral-600">
                          {activeTender.recommendations.map((rec, i) => (
                            <li key={i} className="flex gap-1.5 items-start">
                              <CornerDownRight className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}
            </Card>
          </div>

        </div>

      </div>
    </section>
  )
}

/* ==========================================
   4. FOOTER COMPONENT
   ========================================== */
function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-neutral-150 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-neutral-100">
          
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <Layers className="size-4.5" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-heading text-base font-bold tracking-tight text-neutral-900">Onetrack GeM AI</span>
              <span className="text-[9px] font-semibold text-neutral-400 uppercase tracking-widest leading-none">GlobX Platform</span>
            </div>
          </div>

          <p className="text-xs text-neutral-500 max-w-xs leading-relaxed text-center md:text-left">
            Accelerating government tender qualification analysis and risk tracking for enterprise bidding consortiums.
          </p>

          {/* Social Links (Inline SVGs to prevent lucide-react build errors) */}
          <div className="flex gap-4">
            <a href="#" className="text-neutral-400 hover:text-black transition-colors" aria-label="Twitter">
              <svg className="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
              </svg>
            </a>
            <a href="#" className="text-neutral-400 hover:text-black transition-colors" aria-label="LinkedIn">
              <svg className="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                <rect x="2" y="9" width="4" height="12" />
                <circle cx="4" cy="4" r="2" />
              </svg>
            </a>
            <a href="#" className="text-neutral-400 hover:text-black transition-colors" aria-label="GitHub">
              <svg className="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                <path d="M9 18c-4.51 2-5-2-7-2" />
              </svg>
            </a>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-neutral-400">
          <p>© {currentYear} GlobX Technologies Private Limited. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-black transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-black transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-black transition-colors">Trust Center</a>
          </div>
        </div>

      </div>
    </footer>
  )
}

/* ==========================================
   MAIN LANDING COMPONENT EXPORT
   ========================================== */
export default function Landing() {
  const navigate = useNavigate()
  const onNavigate = (path) => {
    if (path === 'login') {
      navigate('/login')
    } else if (path === 'dashboard') {
      navigate('/dashboard')
    } else {
      navigate('/')
    }
  }
  return (
    <div className="min-h-screen bg-white text-neutral-900 font-sans selection:bg-blue-100 selection:text-blue-900 antialiased">
      <Navbar onNavigate={onNavigate} />
      <Hero onNavigate={onNavigate} />
      <About />
      <Footer />
    </div>
  )
}
