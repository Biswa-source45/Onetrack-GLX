import React, { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  Layers,
  Menu,
  X,
  ArrowRight,
  ShieldCheck,
  Activity,
  Award,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileCheck,
  Shield,
  Check,
  ChevronRight,
  FileText,
  Users,
  Building2,
  Lock,
  Clock,
  TrendingUp,
  FileCode,
  Sliders,
  DollarSign,
  BarChart2,
  PieChart,
  Globe,
  Sparkles,
  ArrowUpRight,
  RefreshCw,
  LineChart
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

import { tokenStorage } from "../services/auth"

/* ==========================================
   1. ENTERPRISE NAVBAR (DECLUTTERED & SPACIOUS)
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
          ? "border-b border-neutral-200/90 bg-white/95 backdrop-blur-md shadow-2xs"
          : "border-b border-neutral-100 bg-white"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* LOGO */}
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
            <Layers className="size-5" />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-heading text-base font-bold tracking-tight text-neutral-900">
              OneTrack
            </span>
            <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest leading-none">
              Enterprise Procurement
            </span>
          </div>
        </div>

        {/* DESKTOP NAV (CLEAN & DECLUTTERED - 3 ESSENTIAL ITEMS) */}
        <nav className="hidden md:flex items-center gap-10 text-sm font-semibold text-neutral-600">
          <a href="#features" className="hover:text-blue-600 transition-colors">
            Capabilities
          </a>
          <a href="#workflow" className="hover:text-blue-600 transition-colors">
            Tender Flow
          </a>
          <a href="#security" className="hover:text-blue-600 transition-colors">
            Security
          </a>
        </nav>

        {/* RIGHT SIDE ACTIONS */}
        <div className="hidden md:flex items-center gap-3">
          {tokenStorage.getAccessToken() ? (
            <Button
              asChild
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm h-9 px-4.5 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Link to="/dashboard">Go to Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button
                onClick={() => onNavigate("login")}
                variant="ghost"
                className="text-sm font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 px-4 h-9 rounded-xl cursor-pointer"
              >
                Sign In
              </Button>
              <Button
                onClick={() => onNavigate("login")}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm h-9 px-5 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Access Platform
              </Button>
            </>
          )}
        </div>

        {/* MOBILE MENU BUTTON */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 text-neutral-600 hover:text-neutral-900 focus:outline-none cursor-pointer"
        >
          {isMobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {/* MOBILE DROPDOWN */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-b border-neutral-200 bg-white px-4 pt-2 pb-6 space-y-3 shadow-lg animate-in fade-in slide-in-from-top duration-200">
          <a
            href="#features"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 text-sm font-semibold text-neutral-700 hover:text-blue-600"
          >
            Capabilities
          </a>
          <a
            href="#workflow"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 text-sm font-semibold text-neutral-700 hover:text-blue-600"
          >
            Tender Flow
          </a>
          <a
            href="#security"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 text-sm font-semibold text-neutral-700 hover:text-blue-600"
          >
            Security
          </a>
          <div className="border-t border-neutral-100 pt-3 flex flex-col gap-2">
            {tokenStorage.getAccessToken() ? (
              <Button
                asChild
                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-10 rounded-xl cursor-pointer font-semibold"
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
                  className="w-full text-neutral-700 border-neutral-300 hover:bg-neutral-50 h-10 rounded-xl font-semibold cursor-pointer"
                >
                  Sign In
                </Button>
                <Button
                  onClick={() => {
                    setIsMobileMenuOpen(false)
                    onNavigate("login")
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white h-10 rounded-xl font-semibold cursor-pointer"
                >
                  Access Platform
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
   2. ENTERPRISE HERO COMPONENT (EXPANDED PROMINENT IMAGE)
   ========================================== */
function Hero({ onNavigate }) {
  return (
    <section className="relative bg-gradient-to-b from-slate-50/90 via-white to-blue-50/30 text-neutral-900 pt-12 pb-24 overflow-hidden border-b border-neutral-200/80">
      {/* Micro Pattern Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />
      <div className="absolute top-[-10%] left-[30%] w-[600px] h-[600px] rounded-full bg-blue-400/10 blur-[160px] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          
          {/* Left Text Column (5 Cols) */}
          <div className="lg:col-span-5 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200 shadow-2xs">
              <ShieldCheck className="size-4 text-blue-600" />
              <span>Enterprise Government Procurement & Tender Management</span>
            </div>

            <h1 className="font-heading text-4xl sm:text-5xl lg:text-[48px] font-bold tracking-tight text-neutral-900 leading-[1.12]">
              Centralized Control for High-Stakes Tender Bidding
            </h1>

            <p className="text-base sm:text-lg text-neutral-600 leading-relaxed font-normal">
              OneTrack unifies government bidding, GeM portal workspaces, team role assignments, commercial approval gates, and compliance tracking into a single operational interface.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center gap-3.5 pt-2">
              {tokenStorage.getAccessToken() ? (
                <Button
                  asChild
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm h-11 px-7 rounded-xl shadow-md shadow-blue-600/15 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Link to="/dashboard">
                    Open Workspace
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <Button
                  onClick={() => onNavigate("login")}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm h-11 px-7 rounded-xl shadow-md shadow-blue-600/15 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  Sign In to OneTrack
                  <ArrowRight className="size-4" />
                </Button>
              )}
              <a
                href="#sandbox"
                className="w-full sm:w-auto bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900 font-semibold text-sm h-11 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-2xs"
              >
                Explore Live Demo
              </a>
            </div>

            {/* Enterprise Badges */}
            <div className="pt-5 border-t border-neutral-200/80 space-y-2.5">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400 block">
                TRUSTED SYSTEM COMPLIANCE
              </span>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-neutral-700">
                <div className="flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">✓</span>
                  GeM & CPPP Portal Ready
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">✓</span>
                  ISO 27001 Certified
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">✓</span>
                  Enforced RBAC Locks
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: EXPANDED ENHANCED SYSTEM SCREENSHOT (7 Cols - Large Container) */}
          <div className="lg:col-span-7 relative">
            <div className="relative rounded-2xl border border-neutral-300/90 bg-white p-2.5 shadow-2xl overflow-hidden group hover:shadow-3xl transition-shadow">
              
              {/* Browser Header Bar */}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-neutral-100/95 rounded-t-xl border-b border-neutral-200 mb-2">
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full bg-red-400" />
                  <div className="size-3 rounded-full bg-amber-400" />
                  <div className="size-3 rounded-full bg-emerald-400" />
                </div>
                <div className="flex items-center gap-2 bg-white px-4 py-1 rounded-lg border border-neutral-200/90 text-xs text-neutral-600 font-mono shadow-2xs">
                  <Lock className="size-3.5 text-emerald-600" />
                  <span className="font-semibold text-neutral-800">https://192.168.1.8/dashboard/tenders</span>
                </div>
                <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider hidden sm:block">OneTrack Enterprise UI</div>
              </div>

              {/* Enhanced High-Resolution Screenshot Visual (Controlled Aspect Ratio & Height) */}
              <div className="relative overflow-hidden rounded-xl border border-neutral-200 max-h-[420px]">
                <img
                  src="/onetrack_dashboard_enhanced.png"
                  alt="OneTrack Enhanced Enterprise Dashboard Screenshot"
                  className="w-full max-h-[420px] object-cover object-top rounded-xl transition-transform duration-500 hover:scale-[1.01]"
                  onError={(e) => {
                    // Fallback if image load fails
                    e.target.src = "/onetrack_dashboard_actual.png"
                  }}
                />
              </div>

              {/* Floating Live Analytics Component 1: Win Rate & Pipeline */}
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="absolute bottom-5 left-5 bg-white/95 backdrop-blur-md p-4 rounded-xl border border-neutral-200/90 shadow-xl text-left hidden sm:flex items-center gap-3.5"
              >
                <div className="size-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                  <LineChart className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-neutral-900">Live Tender Analytics</span>
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">+18.4% Win Rate</span>
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">56 Active Bids • ₹150+ Cr Portfolio Managed</div>
                </div>
              </motion.div>

              {/* Floating Live Analytics Component 2: Stage Compliance */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className="absolute top-14 right-5 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-emerald-200 shadow-md text-left hidden sm:flex items-center gap-2"
              >
                <span className="size-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                <div className="text-left">
                  <div className="text-[11px] font-bold text-emerald-900 leading-tight">Stage Gate Guard Locked</div>
                  <div className="text-[9px] text-emerald-700 font-mono">100% Checklist Verified</div>
                </div>
              </motion.div>

            </div>
          </div>

        </div>
      </div>
    </section>
  )
}



/* ==========================================
   4. ENTERPRISE CAPABILITIES (FEATURES)
   ========================================== */
function Features() {
  const featuresList = [
    {
      icon: Layers,
      title: "Structured Stage-Gate Pipeline",
      description:
        "Guide tenders through Draft, Qualification, Technical Evaluation, Commercial Bidding, and Submission with automated guard conditions."
    },
    {
      icon: Users,
      title: "Role-Based Access Control (RBAC)",
      description:
        "Enforce strict operational boundaries across Super Admin, Bid Manager, Bid Owner, Technical Manager, Finance, and Reviewer roles."
    },
    {
      icon: DollarSign,
      title: "EMD & Bank Guarantee Management",
      description:
        "Track Earnest Money Deposits, BG expiry schedules, margin liabilities, and release dates with real-time financial oversight."
    },
    {
      icon: FileCheck,
      title: "Stage Gate Qualification Checklists",
      description:
        "Ensure all mandatory technical compliance, OEM authorization letters, and MII local content certificates are verified before stage locking."
    },
    {
      icon: Sliders,
      title: "Granular Permission Overrides",
      description:
        "Audit and fine-tune team member access using simple, human-readable permission toggles, category filters, and interactive info tooltips."
    },
    {
      icon: Activity,
      title: "Audit Logging & Win/Loss Analytics",
      description:
        "Capture complete historical event trails, stage change logs, checklist updates, and bid performance metrics for executive review."
    }
  ]

  return (
    <section id="features" className="py-20 bg-slate-50/50 border-b border-neutral-200/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
          <Badge variant="outline" className="text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border-blue-200">
            Enterprise Architecture
          </Badge>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900">
            End-to-End Control Over Your Tender Portfolio
          </h2>
          <p className="text-base text-neutral-600 leading-relaxed">
            Built specifically for bidding consortiums, government contractors, and enterprise sales teams managing multi-crore public sector tenders.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuresList.map((feat, idx) => (
            <Card
              key={idx}
              className="p-6 rounded-2xl border border-neutral-200/80 bg-white hover:border-blue-500/40 hover:shadow-md transition-all space-y-4 text-left"
            >
              <div className="size-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <feat.icon className="size-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-heading text-lg font-bold text-neutral-900">
                  {feat.title}
                </h3>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  {feat.description}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ==========================================
   5. TENDER LIFECYCLE WORKFLOW
   ========================================== */
function Workflow() {
  const steps = [
    {
      num: "01",
      title: "Initiate Tender Workspace",
      desc: "Log GeM / CPPP bid numbers, estimated value, authority details, and submission deadlines into a centralized workspace."
    },
    {
      num: "02",
      title: "Assign Operational Team",
      desc: "Select Bid Manager, Bid Owner, and Technical Manager with role-restricted permissions to manage task execution."
    },
    {
      num: "03",
      title: "Stage Gate Evaluation",
      desc: "Complete mandatory stage checklists for Technical Qualification, OEM MAF letters, and MII local sourcing certificates."
    },
    {
      num: "04",
      title: "Commercial Approval & Submission",
      desc: "Finalize financial margin calculations, lock EMD / BG deposits, obtain management sign-off, and log portal submission."
    }
  ]

  return (
    <section id="workflow" className="py-20 bg-white border-b border-neutral-200/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
          <Badge variant="outline" className="text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border-blue-200">
            Operational Lifecycle
          </Badge>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900">
            How OneTrack Governs Every Bid
          </h2>
          <p className="text-base text-neutral-600">
            A standardized four-stage operational framework ensuring 100% submission compliance and zero missed deadlines.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <div
              key={i}
              className="p-6 rounded-2xl bg-neutral-50/70 border border-neutral-200/80 shadow-2xs space-y-4 text-left relative"
            >
              <span className="text-3xl font-extrabold font-mono text-blue-600/30 block">
                {step.num}
              </span>
              <h3 className="font-heading text-base font-bold text-neutral-900">
                {step.title}
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ==========================================
   6. INTERACTIVE OPERATIONS SANDBOX
   ========================================== */
function OperationsSandbox() {
  const [selectedBid, setSelectedBid] = useState("firewall")

  const mockBids = {
    firewall: {
      title: "GEM/2026/B/776655: V1 Firewall Test Bid",
      authority: "Ministry of Defence",
      value: "₹15.0 Lakhs",
      deadline: "30 June 2026",
      stage: "Discovered",
      bidOwner: "Admin (Super Admin)",
      techManager: "Technical Manager",
      emdStatus: "₹30,000 EMD Online Payment Verified",
      checklist: [
        { label: "OEM Authorization Letter (MAF)", done: true, role: "Technical Manager" },
        { label: "ISO 27001 Security Audit Report", done: true, role: "Bid Owner" },
        { label: "MII Class-I Local Content Declaration", done: true, role: "Reviewer" },
        { label: "Financial Bid Price Approval", done: false, role: "Finance Lead" }
      ]
    },
    adobe: {
      title: "GEM/2026/B/7641961: Adobe Acrobat Pro & Autodesk Autocad LT",
      authority: "Numaligarh Refinery Ltd",
      value: "₹50.0 Lakhs",
      deadline: "23 June 2026",
      stage: "Awaiting Result",
      bidOwner: "Biswa (Bid Owner)",
      techManager: "Amit Verma (Tech Lead)",
      emdStatus: "₹1,00,000 Bank Guarantee Issued",
      checklist: [
        { label: "OEM Commercial Partner Code", done: true, role: "Tech Lead" },
        { label: "Technical Compliance Matrix Signed", done: true, role: "Bid Owner" },
        { label: "Commercial Costing Approval Sheet", done: true, role: "Finance Lead" },
        { label: "Portal Submission Receipt Uploaded", done: true, role: "Admin" }
      ]
    }
  }

  const active = mockBids[selectedBid]

  return (
    <section id="sandbox" className="py-20 bg-slate-50/60 border-b border-neutral-200/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <Badge variant="outline" className="text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border-blue-200">
            Interactive Operations Sandbox
          </Badge>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900">
            Explore Live OneTrack Tender Workspaces
          </h2>
          <p className="text-base text-neutral-600">
            Preview active GeM bid cards, team assignments, financial deposits, and qualification stage gates.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex justify-center gap-3 mb-8">
          <button
            onClick={() => setSelectedBid("firewall")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedBid === "firewall"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100"
            }`}
          >
            V1 Firewall Test Bid
          </button>
          <button
            onClick={() => setSelectedBid("adobe")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedBid === "adobe"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100"
            }`}
          >
            Adobe & Autodesk Software RFP
          </button>
        </div>

        {/* Sandbox Content Box */}
        <Card className="max-w-4xl mx-auto p-6 sm:p-8 rounded-2xl border border-neutral-200/90 bg-white shadow-lg space-y-6 text-left">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-100 pb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-[10px]">
                  GEM ACTIVE BID
                </Badge>
                <span className="text-[11px] font-mono text-neutral-400">Closes: {active.deadline}</span>
              </div>
              <h3 className="font-heading text-lg font-bold text-neutral-900">
                {active.title}
              </h3>
              <p className="text-xs text-neutral-500">
                Authority: <span className="font-semibold text-neutral-800">{active.authority}</span> • Est. Value: <span className="font-semibold text-neutral-900">{active.value}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge className="bg-blue-50 text-blue-700 border border-blue-200 font-bold text-xs px-3 py-1">
                Stage: {active.stage}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/70 space-y-1">
              <span className="text-[10px] font-bold text-neutral-400 uppercase">ASSIGNED BID OWNER</span>
              <p className="text-xs font-bold text-neutral-900">{active.bidOwner}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/70 space-y-1">
              <span className="text-[10px] font-bold text-neutral-400 uppercase">TECHNICAL MANAGER</span>
              <p className="text-xs font-bold text-neutral-900">{active.techManager}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/70 space-y-1">
              <span className="text-[10px] font-bold text-neutral-400 uppercase">EMD / BG DEPOSIT</span>
              <p className="text-xs font-bold text-emerald-700">{active.emdStatus}</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Stage Gate Qualification Checklist
            </h4>
            <div className="space-y-2">
              {active.checklist.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl border border-neutral-100 bg-neutral-50/50 text-xs"
                >
                  <div className="flex items-center gap-3">
                    {item.done ? (
                      <CheckCircle2 className="size-4.5 text-emerald-600 shrink-0" />
                    ) : (
                      <Clock className="size-4.5 text-amber-500 shrink-0" />
                    )}
                    <span className={`font-semibold ${item.done ? "text-neutral-900" : "text-neutral-600"}`}>
                      {item.label}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono bg-white">
                    Assigned: {item.role}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </section>
  )
}

/* ==========================================
   7. SECURITY & GOVERNANCE (White Theme)
   ========================================== */
function SecurityGovernance() {
  return (
    <section id="security" className="py-20 bg-slate-50 border-y border-neutral-200/80 text-neutral-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6 text-left">
            <Badge className="bg-blue-100 text-blue-800 border border-blue-200 text-[11px] font-extrabold uppercase tracking-wider">
              Enterprise Governance
            </Badge>
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900">
              Bank-Grade Security for Critical Procurement Data
            </h2>
            <p className="text-neutral-600 text-sm leading-relaxed">
              OneTrack isolates workspace data, enforces encrypted JWT tokens, logs all administrative modifications, and protects sensitive commercial pricing prior to official submission.
            </p>
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 text-xs font-semibold text-neutral-700">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="size-3.5" />
                </div>
                Granular Role-Based Access Control (RBAC) with user-level overrides
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold text-neutral-700">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="size-3.5" />
                </div>
                Full migration idempotency & PostgreSQL transactional data locks
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold text-neutral-700">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="size-3.5" />
                </div>
                On-premise & private cloud deployment capability for government systems
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-6 rounded-2xl bg-white border border-neutral-200/90 shadow-sm text-left space-y-2 hover:border-blue-300 transition-all">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Lock className="size-5" />
              </div>
              <h3 className="font-bold text-sm text-neutral-900">Encrypted Sessions</h3>
              <p className="text-xs text-neutral-500 leading-relaxed">JWT claims authorization with secure token rotation.</p>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-neutral-200/90 shadow-sm text-left space-y-2 hover:border-blue-300 transition-all">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Building2 className="size-5" />
              </div>
              <h3 className="font-bold text-sm text-neutral-900">On-Premise Ready</h3>
              <p className="text-xs text-neutral-500 leading-relaxed">Deploy within host network environments securely.</p>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-neutral-200/90 shadow-sm text-left space-y-2 hover:border-blue-300 transition-all">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <FileCode className="size-5" />
              </div>
              <h3 className="font-bold text-sm text-neutral-900">Audit Trails</h3>
              <p className="text-xs text-neutral-500 leading-relaxed">Immutable logs for stage changes & user role edits.</p>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-neutral-200/90 shadow-sm text-left space-y-2 hover:border-blue-300 transition-all">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <ShieldCheck className="size-5" />
              </div>
              <h3 className="font-bold text-sm text-neutral-900">Compliance Guard</h3>
              <p className="text-xs text-neutral-500 leading-relaxed">Stage checklist validation prior to bid lock.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ==========================================
   8. ENTERPRISE FOOTER (Pure White Theme)
   ========================================== */
function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-white border-t border-neutral-200/80 text-neutral-700">
      {/* Upper CTA Section (Light Blue / White Gradient Banner) */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-12 px-4 sm:px-6 lg:px-8 shadow-sm">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1.5 text-center md:text-left">
            <h3 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center justify-center md:justify-start gap-2.5">
              <span>Ready to streamline your enterprise tender lifecycle?</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-xs font-bold text-emerald-200 border border-emerald-300/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                Live Operational
              </span>
            </h3>
            <p className="text-xs text-blue-100 max-w-xl leading-relaxed">
              Unify your tender discovery, technical qualification, EMD tracking, and commercial approval workflows into one secure dashboard.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href="#sandbox"
              className="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold h-11 px-5 rounded-xl border border-white/20 transition-colors flex items-center gap-2 backdrop-blur-xs"
            >
              Try Interactive Sandbox
            </a>
            <a
              href="/login"
              className="bg-white hover:bg-blue-50 text-blue-700 text-xs font-bold h-11 px-6 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              Sign In to OneTrack
              <ArrowRight className="size-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Main Footer Links & Info Grid (White Theme) */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 bg-white">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 pb-10 border-b border-neutral-200">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/20">
                <Layers className="size-5" />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-heading text-lg font-bold tracking-tight text-neutral-900">
                  OneTrack
                </span>
                <span className="text-[9.5px] font-extrabold text-blue-600 uppercase tracking-widest leading-none">
                  GlobX Enterprise Platform
                </span>
              </div>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed max-w-sm">
              The premier operations system for government tender discovery, end-to-end role execution, commercial cost management, and compliance auditing for enterprise consortiums.
            </p>

            <div className="pt-1 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100 border border-neutral-200 text-neutral-700 font-semibold">
                <ShieldCheck className="size-3.5 text-blue-600" />
                ISO 27001 Certified
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100 border border-neutral-200 text-neutral-700 font-semibold">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                GeM & CPPP Compliant
              </span>
            </div>
          </div>

          {/* Column 1: Core Modules */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-neutral-900">
              Platform Modules
            </h4>
            <ul className="space-y-2 text-xs text-neutral-600 font-medium">
              <li>
                <a href="#features" className="hover:text-blue-600 transition-colors">
                  Tender Discovery Engine
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-blue-600 transition-colors">
                  Qualification Verification
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-blue-600 transition-colors">
                  Commercial Pricing Sheet
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-blue-600 transition-colors">
                  EMD & Bank Guarantee Log
                </a>
              </li>
              <li>
                <a href="#security" className="hover:text-blue-600 transition-colors">
                  RBAC Audit Logging
                </a>
              </li>
            </ul>
          </div>

          {/* Column 2: System Roles */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-neutral-900">
              Workflow Roles
            </h4>
            <ul className="space-y-2 text-xs text-neutral-600 font-medium">
              <li>
                <a href="#workflow" className="hover:text-blue-600 transition-colors">
                  Bid Manager (Lifecycle Lead)
                </a>
              </li>
              <li>
                <a href="#workflow" className="hover:text-blue-600 transition-colors">
                  Bid Owner (Tender Lead)
                </a>
              </li>
              <li>
                <a href="#workflow" className="hover:text-blue-600 transition-colors">
                  Technical Reviewer
                </a>
              </li>
              <li>
                <a href="#workflow" className="hover:text-blue-600 transition-colors">
                  Finance Manager (Costing)
                </a>
              </li>
              <li>
                <a href="#workflow" className="hover:text-blue-600 transition-colors">
                  Operator (Portal Upload)
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Quick Navigation */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-neutral-900">
              Quick Links
            </h4>
            <ul className="space-y-2 text-xs text-neutral-600 font-medium">
              <li>
                <a href="/login" className="hover:text-blue-700 transition-colors font-bold text-blue-600">
                  User Login Portal →
                </a>
              </li>
              <li>
                <a href="#sandbox" className="hover:text-blue-600 transition-colors">
                  Interactive Role Sandbox
                </a>
              </li>
              <li>
                <a href="#security" className="hover:text-blue-600 transition-colors">
                  Security Governance
                </a>
              </li>
              <li>
                <a href="#analytics" className="hover:text-blue-600 transition-colors">
                  Analytics & Reports
                </a>
              </li>
              <li>
                <span className="text-emerald-700 font-semibold text-[11px] flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  System Operational
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright & Version Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <p>© {currentYear} GlobX Technologies. All rights reserved.</p>
            <span className="hidden sm:inline text-neutral-300">•</span>
            <span className="font-mono text-[11px] text-neutral-700 bg-neutral-100 px-2.5 py-0.5 rounded-md border border-neutral-200 font-semibold">
              v2.4.1 (Auto-Deploy Verified)
            </span>
          </div>

          <div className="flex flex-wrap gap-6 font-semibold text-neutral-600">
            <a href="#security" className="hover:text-blue-600 transition-colors">
              Security Policy
            </a>
            <a href="#" className="hover:text-blue-600 transition-colors">
              Terms of Service
            </a>
            <a href="#" className="hover:text-blue-600 transition-colors">
              Privacy Protocol
            </a>
            <a href="#" className="hover:text-blue-600 transition-colors">
              Audit Compliance
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ==========================================
   MAIN LANDING COMPONENT
   ========================================== */
export default function Landing() {
  const navigate = useNavigate()

  const handleNavigate = (route) => {
    if (route === "login") {
      navigate("/login")
    }
  }

  return (
    <div className="min-h-screen bg-white font-sans text-neutral-900 selection:bg-blue-100 selection:text-blue-900">
      <Navbar onNavigate={handleNavigate} />
      <Hero onNavigate={handleNavigate} />
      <Features />
      <Workflow />
      <OperationsSandbox />
      <SecurityGovernance />
      <Footer />
    </div>
  )
}
