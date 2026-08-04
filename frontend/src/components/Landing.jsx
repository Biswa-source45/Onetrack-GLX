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
  LineChart,
  Zap,
  CheckSquare,
  Key,
  Cpu,
  Database,
  Eye,
  IndianRupee,
  ChevronDown,
  Quote,
  Star,
  Server,
  Terminal,
  Grid,
  Filter,
  Play,
  LockKeyhole
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

import { tokenStorage } from "../services/auth"

// ── Motion Animation Variants ────────────────────────────────────────────────
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
}

/* ==========================================
   1. MEGA MENU NAVBAR (Shadcnblocks LP19)
   ========================================== */
function Navbar({ onNavigate }) {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [activeMegaMenu, setActiveMegaMenu] = useState(null)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 12)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-200 ${
        isScrolled
          ? "border-b border-slate-200/90 bg-white/95 backdrop-blur-md shadow-2xs"
          : "border-b border-slate-200/60 bg-white"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* BRAND LOGO */}
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-600/30 group-hover:bg-blue-700 transition-colors">
            <Layers className="size-5" />
          </div>
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5">
              <span className="font-heading text-lg font-bold tracking-tight text-slate-900">
                OneTrack
              </span>
              <span className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold font-mono text-blue-700 border border-blue-200/70">
                v2.4
              </span>
            </div>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">
              Tender Management System
            </span>
          </div>
        </div>

        {/* MEGA MENU NAVIGATION */}
        <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-slate-600">
          <div
            className="relative"
            onMouseEnter={() => setActiveMegaMenu("features")}
            onMouseLeave={() => setActiveMegaMenu(null)}
          >
            <button className="flex items-center gap-1 py-5 hover:text-blue-600 transition-colors font-semibold cursor-pointer">
              System Modules <ChevronDown className="size-3.5 text-slate-400" />
            </button>
            <AnimatePresence>
              {activeMegaMenu === "features" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="absolute top-full left-0 w-[480px] bg-white rounded-2xl border border-slate-200 shadow-xl p-5 grid grid-cols-2 gap-4 text-left z-50"
                >
                  <a href="#pipeline" className="p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-2.5 text-slate-900 font-bold text-xs group-hover:text-blue-600">
                      <Layers className="size-4 text-blue-600" /> 12-Stage Pipeline
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Sequential stage gate engine & checklists.</p>
                  </a>
                  <a href="#analytics" className="p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-2.5 text-slate-900 font-bold text-xs group-hover:text-blue-600">
                      <BarChart2 className="size-4 text-blue-600" /> BI Analytics
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Win rate funnels & financial tracking.</p>
                  </a>
                  <a href="#bento" className="p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-2.5 text-slate-900 font-bold text-xs group-hover:text-blue-600">
                      <IndianRupee className="size-4 text-blue-600" /> EMD & BG Ledger
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Earnest money & bank guarantee tracking.</p>
                  </a>
                  <a href="#roles" className="p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-2.5 text-slate-900 font-bold text-xs group-hover:text-blue-600">
                      <Users className="size-4 text-blue-600" /> Role Permissions
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Super Admin, Admin & Manager controls.</p>
                  </a>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <a href="#pipeline" className="hover:text-blue-600 transition-colors font-semibold py-1">
            12-Stage Workflow
          </a>
          <a href="#analytics" className="hover:text-blue-600 transition-colors font-semibold py-1">
            BI Funnel
          </a>
          <a href="#roles" className="hover:text-blue-600 transition-colors font-semibold py-1">
            Role Access
          </a>
        </nav>

        {/* ACTION BUTTONS */}
        <div className="hidden md:flex items-center gap-3">
          {tokenStorage.getAccessToken() ? (
            <Button
              asChild
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-9 px-5 rounded-lg shadow-xs transition-all cursor-pointer"
            >
              <Link to="/dashboard" className="flex items-center gap-2">
                Open Dashboard <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          ) : (
            <>
              <Button
                onClick={() => onNavigate("login")}
                variant="ghost"
                className="text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 px-3.5 h-9 rounded-lg cursor-pointer"
              >
                Sign In
              </Button>
              <Button
                onClick={() => onNavigate("login")}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-9 px-5 rounded-lg shadow-xs transition-all cursor-pointer"
              >
                Access System
              </Button>
            </>
          )}
        </div>

        {/* MOBILE MENU TOGGLE */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="lg:hidden p-2 text-slate-600 hover:text-slate-900 focus:outline-none cursor-pointer rounded-lg hover:bg-slate-100"
        >
          {isMobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* MOBILE DROPDOWN */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-b border-slate-200 bg-white px-4 pt-2 pb-6 space-y-3 shadow-lg text-left"
          >
            <a
              href="#pipeline"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block py-2 text-sm font-semibold text-slate-700 hover:text-blue-600"
            >
              12-Stage Workflow
            </a>
            <a
              href="#analytics"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block py-2 text-sm font-semibold text-slate-700 hover:text-blue-600"
            >
              BI Funnel
            </a>
            <a
              href="#roles"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block py-2 text-sm font-semibold text-slate-700 hover:text-blue-600"
            >
              Role Access
            </a>
            <div className="border-t border-slate-100 pt-3 flex flex-col gap-2">
              {tokenStorage.getAccessToken() ? (
                <Button
                  asChild
                  className="w-full bg-blue-600 text-white h-10 rounded-lg font-bold cursor-pointer"
                >
                  <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>
                    Open Dashboard
                  </Link>
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setIsMobileMenuOpen(false)
                    onNavigate("login")
                  }}
                  className="w-full bg-blue-600 text-white h-10 rounded-lg font-bold cursor-pointer"
                >
                  Access System
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

/* ==========================================
   2. SPLIT HERO WITH 3D SKEWED DASHBOARD MOCKUP (LP19 SIGNATURE)
   ========================================== */
function SplitHero({ onNavigate }) {
  return (
    <section className="relative bg-gradient-to-b from-slate-50/90 via-white to-slate-50/40 pt-10 pb-20 border-b border-slate-200/80 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          
          {/* Left Text Column */}
          <div className="lg:col-span-6 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-200 px-3.5 py-1 text-xs font-bold text-blue-700">
              <Sparkles className="size-3.5 text-blue-600" />
              <span>ONETRACK TENDER OPERATING SYSTEM</span>
            </div>

            <h1 className="font-heading text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.15]">
              Track Every Stage of Your Tender Lifecycle in <span className="text-blue-600">One Place</span>
            </h1>

            <p className="text-base text-slate-600 leading-relaxed">
              Manage GeM and CPPP bids from discovery to award. Enforce 12-stage gate approvals, track OEM MAF authorizations, monitor EMD refunds, and review BI analytics.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              {tokenStorage.getAccessToken() ? (
                <Button
                  asChild
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm h-11 px-7 rounded-xl shadow-md shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Link to="/dashboard">
                    Open Dashboard <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <Button
                  onClick={() => onNavigate("login")}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm h-11 px-7 rounded-xl shadow-md shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  Sign In to System <ArrowRight className="size-4" />
                </Button>
              )}
              <a
                href="#pipeline"
                className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs h-11 px-5 rounded-xl flex items-center justify-center gap-1.5 transition-all"
              >
                View 12 Stages <ChevronDown className="size-4" />
              </a>
            </div>

            {/* Quick Specs */}
            <div className="pt-4 border-t border-slate-200/80 grid grid-cols-3 gap-4 text-left">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Stages</span>
                <span className="font-mono font-bold text-sm text-slate-900">12 Governed</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Portals</span>
                <span className="font-mono font-bold text-sm text-slate-900">GeM & CPPP</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Host LAN</span>
                <span className="font-mono font-bold text-sm text-slate-900">192.168.1.8</span>
              </div>
            </div>
          </div>

          {/* Right Column: 3D Skewed Interactive Dashboard Component (LP19 Signature) */}
          <div className="lg:col-span-6 relative perspective-[1200px]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, rotateX: 6, rotateY: -8 }}
              animate={{ opacity: 1, scale: 1, rotateX: 4, rotateY: -5 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="w-full transition-transform duration-500 hover:[transform:rotateX(0deg)_rotateY(0deg)]"
            >
              <Card className="rounded-2xl border border-slate-300 bg-white p-4 shadow-2xl space-y-3 text-left">
                {/* Window Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="size-2.5 rounded-full bg-slate-300" />
                      <div className="size-2.5 rounded-full bg-slate-300" />
                      <div className="size-2.5 rounded-full bg-slate-300" />
                    </div>
                    <span className="text-[11px] font-mono font-bold text-slate-600 ml-2">
                      http://192.168.1.8/dashboard
                    </span>
                  </div>
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                    Super Admin View
                  </Badge>
                </div>

                {/* Dashboard Stats Row */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Active Tenders</span>
                    <span className="font-mono font-bold text-base text-slate-900">₹148.5 Cr</span>
                    <span className="text-[9px] text-emerald-600 font-semibold block">12 Bids Active</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">EMD Locked</span>
                    <span className="font-mono font-bold text-base text-amber-600">₹42.0 Lakhs</span>
                    <span className="text-[9px] text-slate-500 font-semibold block">4 BGs Pending</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Win Rate</span>
                    <span className="font-mono font-bold text-base text-blue-600">68.4%</span>
                    <span className="text-[9px] text-emerald-600 font-semibold block">+4.2% Q2</span>
                  </div>
                </div>

                {/* Sample Active Tender Stage Item */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-blue-600">GEM/2026/B/891204</span>
                      <h4 className="text-xs font-bold text-slate-900">Supply of 500 High-Performance Workstations</h4>
                    </div>
                    <Badge className="bg-blue-100 text-blue-700 text-[10px] font-bold">STAGE 3: MAF APPROVED</Badge>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                      <span>Pipeline Progress</span>
                      <span>Stage 3 of 12 (25%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full bg-blue-600 w-1/4 rounded-full" />
                    </div>
                  </div>
                </div>

                {/* Quick Action Footer */}
                <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 font-semibold">
                  <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                    <CheckCircle2 className="size-3.5" /> Stage Gate Checklists Verified
                  </span>
                  <span className="font-mono text-slate-400">Host: LAN</span>
                </div>
              </Card>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  )
}

/* ==========================================
   3. MUTED LOGO / INTEGRATION MARQUEE STRIP (LP19 STYLE)
   ========================================== */
function IntegrationMarquee() {
  const integrations = [
    { title: "GeM Portal", label: "e-Procurement Sync" },
    { title: "CPPP Portal", label: "Central Tenders" },
    { title: "OEM MAF Engine", label: "HP / Dell / Cisco" },
    { title: "EMD Bank Ledger", label: "BG Refund Tracking" },
    { title: "PostgreSQL DB", label: "Auto Migrations" }
  ]

  return (
    <section className="bg-slate-100/70 border-b border-slate-200/80 py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12">
          {integrations.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 font-bold text-xs text-slate-700 bg-white px-3.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
              <CheckCircle2 className="size-3.5 text-blue-600" />
              <span>{item.title}</span>
              <span className="text-[10px] text-slate-400 font-normal">({item.label})</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ==========================================
   4. BENTO STAT GRID SECTION (LP19 SIGNATURE)
   ========================================== */
function BentoStatGrid() {
  return (
    <section id="bento" className="py-20 bg-white border-b border-slate-200/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
          <Badge variant="outline" className="text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border-blue-200">
            System Metrics & Capabilities
          </Badge>
          <h2 className="font-heading text-3xl font-extrabold text-slate-900 tracking-tight">
            Designed for Operational Precision
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Key operational highlights integrated directly into the tender operating workspace.
          </p>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 text-left">
          
          {/* Card 1: 12 Stages (Wide 7-col) */}
          <Card className="md:col-span-7 p-7 rounded-2xl border border-slate-200 bg-slate-50/50 shadow-2xs space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="size-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                <Layers className="size-5" />
              </div>
              <h3 className="font-heading text-xl font-bold text-slate-900">12 Governed Lifecycle Stages</h3>
              <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
                Every bid moves through 12 mandatory stages—from GeM discovery and OEM MAF authorization to commercial sign-off and EMD refund release.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/80 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block">STAGE GATING</span>
                <span className="font-bold text-slate-900">Strict Lock</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block">CHECKLISTS</span>
                <span className="font-bold text-slate-900">Enforced</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block">AUDIT TRAIL</span>
                <span className="font-bold text-slate-900">Automated</span>
              </div>
            </div>
          </Card>

          {/* Card 2: 2x2 Metric Tile (5-col) */}
          <Card className="md:col-span-5 p-7 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
            <div className="space-y-1">
              <h3 className="font-heading text-base font-bold text-slate-900">Financial & EMD Visibility</h3>
              <p className="text-xs text-slate-500">Real-time ledger tracking for earnest deposits and Bank Guarantees.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">EMD RELEASE</span>
                <span className="font-mono font-bold text-lg text-emerald-600">100%</span>
                <span className="text-[9px] text-slate-500 block">Tracked on award</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">BG EXPIRY</span>
                <span className="font-mono font-bold text-lg text-amber-600">Alerts</span>
                <span className="text-[9px] text-slate-500 block">Automated notifications</span>
              </div>
            </div>
          </Card>

        </div>
      </div>
    </section>
  )
}

/* ==========================================
   5. INTERACTIVE 12-STAGE PIPELINE (LP19 STEP CARDS)
   ========================================== */
function StagePipelineSteps() {
  const [selectedStage, setSelectedStage] = useState(0)

  const stages = [
    { num: "01", name: "Discovered", desc: "Tender logging from GeM/CPPP portal with basic metadata & submission deadline." },
    { num: "02", name: "Pre-Qualification", desc: "Verification of turnover requirements, past experience certificates, and ISO standards." },
    { num: "03", name: "OEM MAF Matrix", desc: "Requesting OEM Manufacturer Authorization Forms and Make in India content proofs." },
    { num: "04", name: "Pre-Bid Queries", desc: "Submitting queries for pre-bid meetings and tracking published corrigendums." },
    { num: "05", name: "Technical Qualification", desc: "Preparing BOQ compliance sheets, technical data sheets, and bid binder." },
    { num: "06", name: "Commercial Margin", desc: "Calculating cost margins, tax structures, and obtaining financial sign-off." },
    { num: "07", name: "EMD & BG Issuance", desc: "Issuing online EMD transfer or Bank Guarantee with validity date tracking." },
    { num: "08", name: "Portal Submission", desc: "Final encryption upload to e-Procurement portal and submission receipt." },
    { num: "09", name: "Tech Evaluation", desc: "Monitoring technical opening, attending evaluation meetings, and clarifying queries." },
    { num: "10", name: "Financial Opening", desc: "Financial bid opening, price ranking (L1/L2 calculation), and negotiations." },
    { num: "11", name: "Contract Award", desc: "Official PO award receipt and Performance BG (PBG) submission." },
    { num: "12", name: "Completed & Refund", desc: "Final project handover, milestone billing, and EMD refund release closure." }
  ]

  return (
    <section id="pipeline" className="py-20 bg-slate-50/60 border-b border-slate-200/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-2">
          <Badge variant="outline" className="text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border-blue-200">
            Interactive Workflow Engine
          </Badge>
          <h2 className="font-heading text-3xl font-extrabold text-slate-900 tracking-tight">
            12-Stage Lifecycle Engine
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Select a stage below to inspect its operational checklist rules.
          </p>
        </div>

        {/* Stage Grid Switcher */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 mb-8">
          {stages.map((st, i) => (
            <button
              key={i}
              onClick={() => setSelectedStage(i)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedStage === i
                  ? "bg-blue-600 border-blue-600 text-white shadow-md scale-[1.02]"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className={`text-[10px] font-bold font-mono block ${selectedStage === i ? "text-blue-100" : "text-slate-400"}`}>
                STAGE {st.num}
              </span>
              <span className="text-xs font-bold truncate block mt-0.5">{st.name}</span>
            </button>
          ))}
        </div>

        {/* Active Stage Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedStage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="p-6 rounded-2xl border border-blue-200 bg-white shadow-sm max-w-4xl mx-auto text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-600 text-white font-mono text-xs px-2 py-0.5">
                    STAGE {stages[selectedStage].num} OF 12
                  </Badge>
                  <span className="text-xs font-bold text-slate-500 uppercase">Checklist Enforced</span>
                </div>
                <h3 className="font-heading text-lg font-bold text-slate-900">{stages[selectedStage].name}</h3>
                <p className="text-xs text-slate-600 max-w-xl leading-relaxed">{stages[selectedStage].desc}</p>
              </div>

              <div className="shrink-0">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200">
                  <CheckCircle2 className="size-4 text-emerald-600" /> Gate Verified
                </div>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}

/* ==========================================
   6. ROLE ACCESS CONTROL SECTION (LP19 INTERACTIVE TILES)
   ========================================== */
function RoleAccessSection() {
  const roles = [
    {
      title: "Super Admin & Admin",
      badge: "Full System Controls",
      desc: "Full management access to create tenders, view executive BI analytics, manage user roles, and override stage gates."
    },
    {
      title: "Manager Role",
      badge: "Department Oversight",
      desc: "Departmental access to assign bid owners, review stage completion checklists, and monitor active tender BI reports."
    },
    {
      title: "Operational Bid Owner",
      badge: "Stage Execution",
      desc: "Focuses exclusively on executing stage tasks, uploading MAF documents, and submitting checklist items."
    },
    {
      title: "Finance & Commercial Lead",
      badge: "EMD & Financials",
      desc: "Manages EMD payment status, Bank Guarantee validity alerts, and commercial price sheet approvals."
    }
  ]

  return (
    <section id="roles" className="py-20 bg-white border-b border-slate-200/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
          <Badge variant="outline" className="text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border-blue-200">
            Role-Based Access Control
          </Badge>
          <h2 className="font-heading text-3xl font-extrabold text-slate-900 tracking-tight">
            Role Security Architecture
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Analytics and sensitive financial data are restricted by user role.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          {roles.map((r, i) => (
            <Card key={i} className="p-6 rounded-2xl border border-slate-200 bg-slate-50/40 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-bold text-base text-slate-900">{r.title}</h3>
                <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold">{r.badge}</Badge>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{r.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ==========================================
   7. MUTED SPLIT FOOTER (LP19 SIGNATURE)
   ========================================== */
function MutedSplitFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-slate-50 border-t border-slate-200 text-slate-700 text-left">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-slate-200/80">
          
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold">
                <Layers className="size-4" />
              </div>
              <span className="font-heading text-base font-bold tracking-tight text-slate-900">
                OneTrack Enterprise System
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
              Standardized tender management system for GeM and CPPP public bidding operations.
            </p>
          </div>

          <div className="space-y-2 text-xs">
            <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">System Modules</h4>
            <ul className="space-y-1.5 text-slate-600 font-medium">
              <li><a href="#pipeline" className="hover:text-blue-600 transition-colors">12-Stage Pipeline</a></li>
              <li><a href="#bento" className="hover:text-blue-600 transition-colors">EMD & BG Ledger</a></li>
              <li><a href="#roles" className="hover:text-blue-600 transition-colors">Role RBAC</a></li>
            </ul>
          </div>

          <div className="space-y-2 text-xs">
            <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">Quick Actions</h4>
            <ul className="space-y-1.5 text-slate-600 font-medium">
              <li><a href="/login" className="text-blue-600 font-bold hover:underline">System Login Portal →</a></li>
              <li><span className="text-slate-400 font-mono text-[11px]">LAN Host: 192.168.1.8</span></li>
            </ul>
          </div>

        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {currentYear} GlobX Technologies. OneTrack Tender Management System v2.4.2</p>
          <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-500">
            <span>GeM Compliant</span>
            <span>CPPP Integration</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ==========================================
   MAIN LANDING COMPONENT (Shadcnblocks LP19 Architecture)
   ========================================== */
export default function Landing() {
  const navigate = useNavigate()

  const handleNavigate = (route) => {
    if (route === "login") {
      navigate("/login")
    }
  }

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      <Navbar onNavigate={handleNavigate} />
      <SplitHero onNavigate={handleNavigate} />
      <IntegrationMarquee />
      <BentoStatGrid />
      <StagePipelineSteps />
      <RoleAccessSection />
      <MutedSplitFooter />
    </div>
  )
}
