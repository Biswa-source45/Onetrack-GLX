import React, { useState, useEffect, useRef } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion, AnimatePresence, MotionConfig, useMotionValue, useMotionTemplate, useSpring, useInView, animate } from "framer-motion"
import {
  Menu, X, ArrowRight, Layers, Coins, ShieldCheck, BarChart3, CheckCircle2,
  Sparkles, ChevronRight, AlertCircle, Search, Filter, Plus, FileText, Check,
  Clock, ArrowUpRight
} from "lucide-react"

import { tokenStorage } from "../services/auth"
import { ledger, ledgerFont, LEDGER_STAGES } from "../lib/ledgerTheme"
import { LedgerStampMark } from "../lib/ledgerMarks"
import { LedgerRow } from "../lib/LedgerRow"

import { SkiperSvgBeam } from "./ui/SkiperSvgBeam"
import { InteractiveBoardDemo } from "./ui/InteractiveBoardDemo"
import { FaqSection } from "./ui/FaqSection"

// ── Background Faded Grid/Checkerboard Pattern ──────────────────────────────
function FadedCheckBackground({ className = "", opacity = 0.4 }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`} aria-hidden="true">
      {/* 32px Checkerboard Grid Pattern */}
      <div
        className="absolute inset-0"
        style={{
          opacity: opacity,
          backgroundImage: `
            linear-gradient(to right, rgba(37, 99, 235, 0.09) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(37, 99, 235, 0.09) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 35%, black 25%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 35%, black 25%, transparent 80%)",
        }}
      />
    </div>
  )
}

// ── Content Definitions ──────────────────────────────────────────────────────
const ROLES = [
  { title: "Super Admin & Admin", initials: "SA", badge: "Full Access", note: "Unrestricted administration: settings, permissions, user assignment, and pipeline audit." },
  { title: "Manager", initials: "MG", badge: "Lifecycle Owner", note: "Creates tenders, assigns owner roles, tracks margins, and reviews stage conversion analytics." },
  { title: "Bid Executive", initials: "BE", badge: "Stage Execution", note: "Executes stage 1 through 11 deliverables: document checklists, GeM filings, and portal updates." },
  { title: "Pre-Sales", initials: "PS", badge: "Eligibility & OEM", note: "Technical eligibility review, OEM matrix clearance, MAF certificates, and feasibility clearance." },
  { title: "Finance", initials: "FN", badge: "EMD & Commercial", note: "Earnest deposits, Demand Drafts, Bank Guarantees, margin checks, and commercial signoff." },
]

const DEMO_SHEET_TENDERS = [
  {
    id: "GEM/2026/B/041872",
    title: "Highway Toll Automation & Fastag Sensors",
    authority: "NHAI India",
    value: "₹8.50 Cr",
    emdMode: "Bank Guarantee (180d)",
    stage: "Stage 6 · EMD Processing",
    owner: "Suresh P.",
    portal: "GeM",
    statusBadge: "bg-blue-50 text-blue-700 border-blue-200",
    alert: true,
  },
  {
    id: "CPPP/2026/881204",
    title: "Railway Signaling & Interlocking Systems",
    authority: "Indian Railways",
    value: "₹14.20 Cr",
    emdMode: "Paid Online (₹2.4L)",
    stage: "Stage 11 · Award & Handover",
    owner: "Biswa S.",
    portal: "CPPP",
    statusBadge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    id: "GEM/2026/B/982110",
    title: "Smart City Surveillance & Fiber Network",
    authority: "Smart City Ltd",
    value: "₹4.80 Cr",
    emdMode: "Exemption Certificate",
    stage: "Stage 3 · OEM Authorization",
    owner: "Rohan V.",
    portal: "GeM",
    statusBadge: "bg-slate-100 text-slate-700 border-slate-200",
  },
  {
    id: "CPPP/2026/410299",
    title: "Data Center UPS & Precision Air Conditioning",
    authority: "BHEL Bhopal",
    value: "₹1.25 Cr",
    emdMode: "Demand Draft Uploaded",
    stage: "Stage 4 · Pricing Request",
    owner: "Neha G.",
    portal: "CPPP",
    statusBadge: "bg-blue-50 text-blue-700 border-blue-200",
  },
]

// ── Shared UI Elements ───────────────────────────────────────────────────────
function Wordmark({ size = "text-base" }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-xl bg-blue-100 border border-blue-200">
        <LedgerStampMark className="size-4" color="#2563eb" />
      </span>
      <span className={`${size} font-extrabold tracking-tight text-slate-900`} style={{ fontFamily: ledgerFont.display }}>
        OneTrack
      </span>
    </span>
  )
}

const MotionLink = motion.create(Link)

function PrimaryButton({ children, onClick, href, as, size = "md", className = "" }) {
  const pad = size === "lg" ? "px-6 py-3.5 text-sm" : "px-5 py-2.5 text-xs"
  const cls = `inline-flex items-center justify-center gap-2 rounded-xl font-bold tracking-wide transition-all ${pad} ${className}`
  const style = {
    fontFamily: ledgerFont.body,
    background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
    color: "#FFFFFF",
    boxShadow: "0 6px 20px -4px rgba(37, 99, 235, 0.4)",
  }

  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 210, damping: 16, mass: 0.4 })
  const sy = useSpring(y, { stiffness: 210, damping: 16, mass: 0.4 })

  function handleMove(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    x.set((e.clientX - rect.left - rect.width / 2) * 0.18)
    y.set((e.clientY - rect.top - rect.height / 2) * 0.18)
  }
  function handleLeave() {
    x.set(0)
    y.set(0)
  }

  const motionProps = {
    style: { ...style, x: sx, y: sy },
    onPointerMove: handleMove,
    onPointerLeave: handleLeave,
    whileTap: { scale: 0.97 },
  }

  if (as === "link") {
    return (
      <MotionLink to={href} className={cls} {...motionProps}>
        {children}
      </MotionLink>
    )
  }
  return (
    <motion.button type="button" onClick={onClick} className={cls} {...motionProps}>
      {children}
    </motion.button>
  )
}

function GhostButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition-colors cursor-pointer"
      style={{ fontFamily: ledgerFont.body }}
    >
      {children}
    </button>
  )
}

function SectionHeading({ title, lede, badge }) {
  return (
    <div className="mb-12 text-center max-w-3xl mx-auto space-y-3 relative z-10">
      {badge && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
          <Sparkles className="size-3.5 text-blue-600" /> {badge}
        </span>
      )}
      <h2
        className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900"
        style={{ fontFamily: ledgerFont.display, textWrap: "balance" }}
      >
        {title}
      </h2>
      {lede && (
        <p className="text-sm sm:text-base text-slate-600 font-medium max-w-xl mx-auto" style={{ fontFamily: ledgerFont.body }}>
          {lede}
        </p>
      )}
    </div>
  )
}

function CountUp({ value, className, style }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-10% 0px" })
  const numeric = Number(value)
  const isNumeric = !Number.isNaN(numeric) && String(value).trim() !== ""

  useEffect(() => {
    if (!inView || !isNumeric || !ref.current) return
    const controls = animate(0, numeric, {
      duration: 1.1,
      ease: "easeOut",
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = String(Math.round(v))
      },
    })
    return () => controls.stop()
  }, [inView, isNumeric, numeric])

  if (!isNumeric) {
    return (
      <span className={className} style={style}>
        {value}
      </span>
    )
  }
  return (
    <span ref={ref} className={className} style={style}>
      0
    </span>
  )
}

function RoleAvatar({ initials }) {
  return (
    <span
      className="flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-mono font-bold bg-blue-100 text-blue-700 border border-blue-200"
    >
      {initials}
    </span>
  )
}

// ── Navigation Bar ────────────────────────────────────────────────────────────
function Navbar() {
  const navigate = useNavigate()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 12)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const isAuthed = !!tokenStorage.getAccessToken()

  return (
    <header
      className="sticky top-0 z-40 w-full transition-all duration-300 border-b"
      style={{
        background: isScrolled ? "rgba(255, 255, 255, 0.95)" : "#ffffff",
        borderColor: isScrolled ? "#e2e8f0" : "#f1f5f9",
        backdropFilter: isScrolled ? "blur(12px)" : undefined,
      }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="cursor-pointer">
          <Wordmark />
        </button>

        <nav className="hidden md:flex items-center gap-8 text-xs font-bold text-slate-700">
          <a href="#features" className="hover:text-blue-600 transition-colors">Capabilities</a>
          <a href="#board-demo" className="hover:text-blue-600 transition-colors">Live Board</a>
          <a href="#pipeline" className="hover:text-blue-600 transition-colors">11 Pipeline Gates</a>
          <a href="#roles" className="hover:text-blue-600 transition-colors">Roles</a>
          <a href="#faq" className="hover:text-blue-600 transition-colors">FAQ</a>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {isAuthed ? (
            <PrimaryButton as="link" href="/dashboard">
              Open Workspace <ArrowRight className="size-3.5" />
            </PrimaryButton>
          ) : (
            <>
              <GhostButton onClick={() => navigate("/login")}>Sign In</GhostButton>
              <PrimaryButton onClick={() => navigate("/login")}>
                Get Started <ArrowRight className="size-3.5" />
              </PrimaryButton>
            </>
          )}
        </div>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100"
        >
          {isMobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden px-4 pt-2 pb-6 space-y-3 bg-white border-b border-slate-200"
          >
            <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 text-sm font-bold text-slate-800">Capabilities</a>
            <a href="#board-demo" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 text-sm font-bold text-slate-800">Live Board</a>
            <a href="#pipeline" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 text-sm font-bold text-slate-800">11 Pipeline Gates</a>
            <a href="#roles" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 text-sm font-bold text-slate-800">Roles</a>
            <a href="#faq" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 text-sm font-bold text-slate-800">FAQ</a>

            <div className="pt-3 border-t border-slate-200 flex flex-col gap-2">
              {isAuthed ? (
                <PrimaryButton as="link" href="/dashboard" className="w-full">Open Workspace</PrimaryButton>
              ) : (
                <>
                  <GhostButton onClick={() => { setIsMobileMenuOpen(false); navigate("/login") }}>Sign In</GhostButton>
                  <PrimaryButton onClick={() => { setIsMobileMenuOpen(false); navigate("/login") }} className="w-full">
                    Get Started Now
                  </PrimaryButton>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

// ── Mac Window Hero Tender Sheet Showcase Component ──────────────────────────
function MacHeroTenderSheet() {
  const navigate = useNavigate()
  const [filterPortal, setFilterPortal] = useState("ALL")
  const [activeRow, setActiveRow] = useState(0)

  const filtered = filterPortal === "ALL"
    ? DEMO_SHEET_TENDERS
    : DEMO_SHEET_TENDERS.filter((t) => t.portal === filterPortal)

  return (
    <div className="relative rounded-2xl p-1 bg-white border border-blue-200 shadow-2xl overflow-hidden text-slate-900">
      <SkiperSvgBeam duration={7} glowColor="#2563eb" />

      <div className="rounded-xl overflow-hidden bg-slate-50 border border-slate-200">
        {/* Mac Window Title Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-100 border-b border-slate-200 select-none">
          {/* Top Left Mac Controls */}
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-red-500 hover:opacity-80 transition-opacity cursor-pointer inline-block" />
            <span className="size-3 rounded-full bg-amber-400 hover:opacity-80 transition-opacity cursor-pointer inline-block" />
            <span className="size-3 rounded-full bg-emerald-500 hover:opacity-80 transition-opacity cursor-pointer inline-block" />
            <span className="ml-3 text-[11px] font-mono font-bold text-slate-500 hidden sm:inline-block">
              OneTrack v1.1 — Tender Operations Sheet Workspace
            </span>
          </div>

          {/* Top Right Status & Action */}
          <div className="flex items-center gap-3 text-xs">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
              <span className="size-1.5 rounded-full bg-blue-600 animate-pulse" /> Live Register
            </span>
            <button
              onClick={() => navigate("/login")}
              className="px-3 py-1 rounded-lg bg-blue-600 text-white font-bold text-[11px] hover:bg-blue-700 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Open Dashboard</span>
              <ArrowUpRight className="size-3" />
            </button>
          </div>
        </div>

        {/* Dashboard Toolbar Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 sm:px-4 bg-white border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
              <input
                type="text"
                readOnly
                value="GeM & CPPP active bids..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-600 font-medium focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 border border-slate-200">
              {["ALL", "GeM", "CPPP"].map((p) => (
                <button
                  key={p}
                  onClick={() => setFilterPortal(p)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                    filterPortal === p
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Total Bids:</span>
              <span className="font-mono font-bold text-blue-600">24 Active</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Pipeline Value:</span>
              <span className="font-mono font-bold text-emerald-600">₹28.75 Cr</span>
            </div>
          </div>
        </div>

        {/* Live Tender Sheet Table */}
        <div className="overflow-x-auto bg-white">
          <table className="w-full text-left text-xs text-slate-800">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-4">Tender Ref ID</th>
                <th className="py-2.5 px-4">Opportunity Description</th>
                <th className="py-2.5 px-4">Value</th>
                <th className="py-2.5 px-4">EMD Mode</th>
                <th className="py-2.5 px-4">Current Gate Stage</th>
                <th className="py-2.5 px-4">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.map((t, idx) => (
                <tr
                  key={t.id}
                  onMouseEnter={() => setActiveRow(idx)}
                  className={`transition-colors cursor-pointer ${
                    activeRow === idx ? "bg-blue-50/80" : "hover:bg-slate-50"
                  }`}
                >
                  <td className="py-3 px-4 font-mono font-bold text-blue-600 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        t.portal === "GeM" ? "bg-sky-100 text-sky-800" : "bg-indigo-100 text-indigo-800"
                      }`}>
                        {t.portal}
                      </span>
                      <span>{t.id}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 max-w-xs">
                    <div className="font-bold text-slate-900 truncate">{t.title}</div>
                    <div className="text-[11px] text-slate-500 font-sans">{t.authority}</div>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-emerald-600 whitespace-nowrap">
                    {t.value}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                      {t.alert && <span className="size-1.5 rounded-full bg-red-600 animate-pulse" />}
                      {t.emdMode}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${t.statusBadge}`}>
                      <CheckCircle2 className="size-3" />
                      {t.stage}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-700 whitespace-nowrap">
                    {t.owner}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sheet Footer Bar */}
        <div className="p-3 px-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-600">
          <div className="flex items-center gap-2 font-medium">
            <ShieldCheck className="size-4 text-blue-600" />
            <span>Sequential Stage Locks Active • Showing 4 of 24 Tenders in Live Register</span>
          </div>
          <div className="flex items-center gap-3 font-bold text-slate-500">
            <span>GeM API Synced</span>
            <span>•</span>
            <span>CPPP Portal Verified</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Hero Section ─────────────────────────────────────────────────────────────
function FloatingChip({ icon: Icon, label, style, delay, alert }) {
  return (
    <motion.div
      className={`pointer-events-none absolute hidden lg:flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold border shadow-xl backdrop-blur-md z-20 ${
        alert
          ? "bg-red-50/95 border-red-200 text-red-700"
          : "bg-white/95 border-blue-200 text-blue-700"
      }`}
      style={style}
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay }}
    >
      <Icon className={`size-4 ${alert ? "text-red-600" : "text-blue-600"}`} />
      {label}
    </motion.div>
  )
}

function Hero() {
  const navigate = useNavigate()
  const isAuthed = !!tokenStorage.getAccessToken()

  return (
    <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32 bg-white text-slate-900">
      {/* 40% Faded Checkerboard / Grid Pattern Background */}
      <FadedCheckBackground opacity={0.4} />

      {/* Soft Blue Radial Background Glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-500/10 blur-[130px] rounded-full" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
        {/* Release Pill Badge - v1.1 */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold bg-blue-50 border border-blue-200 text-blue-700 mb-6 cursor-pointer"
          onClick={() => navigate("/login")}
        >
          <span className="flex size-2 rounded-full bg-blue-600 animate-ping" />
          <span>OneTrack v1.1 • GeM & CPPP Sequential Tender Governance</span>
          <ChevronRight className="size-3.5" />
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.08] text-slate-900"
          style={{ fontFamily: ledgerFont.display, textWrap: "balance" }}
        >
          Every public tender entered in <span className="bg-gradient-to-r from-blue-600 via-blue-700 to-slate-900 bg-clip-text text-transparent">one unified workspace</span>.
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-slate-600 font-medium leading-relaxed"
        >
          Sequential stage gating, automated EMD tracking, and strict role authorization enforced on every bid from qualification through award.
        </motion.p>

        {/* CTA Group */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          {isAuthed ? (
            <PrimaryButton as="link" href="/dashboard" size="lg" className="w-full sm:w-auto">
              Open Dashboard Workspace <ArrowRight className="size-4" />
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={() => navigate("/login")} size="lg" className="w-full sm:w-auto">
              Start Free Workspace <ArrowRight className="size-4" />
            </PrimaryButton>
          )}

          <a
            href="#board-demo"
            className="w-full sm:w-auto text-xs font-bold h-12 px-6 rounded-xl flex items-center justify-center text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
          >
            Explore Live Board Demo
          </a>
        </motion.div>
      </div>

      {/* Hero Mac Window Showcase Card */}
      <motion.div
        initial={{ opacity: 0, y: 35 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.35, ease: "easeOut" }}
        className="relative z-10 mx-auto mt-14 max-w-5xl px-4 sm:px-6 lg:px-8"
      >
        <FloatingChip icon={CheckCircle2} label="Stage Gate Enforced" style={{ left: "-2%", top: "-4%" }} delay={0} />
        <FloatingChip icon={AlertCircle} label="EMD Expiry Alert" style={{ right: "-2%", bottom: "-3%" }} delay={1.4} alert />

        <MacHeroTenderSheet />
      </motion.div>
    </section>
  )
}

// ── Live Board Section ───────────────────────────────────────────────────────
function LiveBoardSection() {
  return (
    <section id="board-demo" className="relative py-24 bg-slate-50 text-slate-900 border-t border-slate-200">
      <FadedCheckBackground opacity={0.3} />
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Interactive Preview"
          title="Try the live retrospective & tender board"
          lede="Switch between team retrospective items and active tender stages. Click cards, upvote feedback, or add custom entries."
        />
        <InteractiveBoardDemo />
      </div>
    </section>
  )
}

// ── Bento Capabilities Section ───────────────────────────────────────────────
function BentoTile({ icon: Icon, title, note, code, className = "", children }) {
  const mx = useMotionValue(50)
  const my = useMotionValue(50)
  const spotlight = useMotionTemplate`radial-gradient(280px circle at ${mx}% ${my}%, rgba(37, 99, 235, 0.1), transparent 75%)`

  function handleMove(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    mx.set(((e.clientX - rect.left) / rect.width) * 100)
    my.set(((e.clientY - rect.top) / rect.height) * 100)
  }

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      onPointerMove={handleMove}
      className={`group relative overflow-hidden rounded-2xl p-6 sm:p-7 bg-white border border-slate-200 hover:border-blue-300 shadow-sm hover:shadow-md ${className}`}
    >
      <motion.div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: spotlight }} />
      <div className="relative z-10 flex flex-col h-full justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="flex size-10 items-center justify-center rounded-xl bg-blue-100 border border-blue-200 text-blue-600">
              <Icon className="size-5" />
            </span>
            <span className="text-xs font-mono font-bold text-slate-400">{code}</span>
          </div>
          <h3 className="mt-5 text-lg font-bold text-slate-900" style={{ fontFamily: ledgerFont.display }}>{title}</h3>
          <p className="mt-2 text-xs text-slate-600 font-medium leading-relaxed">{note}</p>
        </div>
        {children && <div className="mt-5">{children}</div>}
      </div>
    </motion.div>
  )
}

function CapabilitiesSection() {
  return (
    <section id="features" className="relative py-24 bg-white text-slate-900 border-t border-slate-200">
      <FadedCheckBackground opacity={0.35} />
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Architectural Foundation"
          title="Engineered for public procurement governance"
          lede="Built from the ground up to solve tender tracking fragmentation across GeM and CPPP portals."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <BentoTile
            icon={Layers}
            title="11-Stage Gate Pipeline"
            note="Sequential progression locks. Tenders cannot skip discovery, technical signoff, or financial approvals."
            code="FEAT-01"
            className="md:col-span-2"
          >
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-700 font-bold">
                <span>Stage 4: EMD Deposit Gate Verification</span>
                <span className="text-emerald-600 font-mono">Passed ✓</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full w-[65%]" />
              </div>
            </div>
          </BentoTile>

          <BentoTile
            icon={Coins}
            title="EMD & Bank Guarantee Engine"
            note="Deposit mode, DD details, bank guarantees, and automatic return date alerts."
            code="FEAT-02"
          >
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600"><span>EMD Paid:</span><span className="font-mono font-bold text-slate-900">₹2,40,000</span></div>
              <div className="flex justify-between text-slate-600">
                <span>BG Expiry:</span>
                <span className="font-mono font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200 text-[10px]">
                  18 Days Left (Urgent)
                </span>
              </div>
            </div>
          </BentoTile>

          <BentoTile
            icon={ShieldCheck}
            title="Role-Based Security Matrix"
            note="Server-enforced matrix for Super Admin, Manager, Bid Executive, Pre-Sales, and Finance."
            code="FEAT-03"
          />

          <BentoTile
            icon={BarChart3}
            title="Real-Time Win/Loss Analytics"
            note="Executive dashboard tracking conversion rates, pipeline velocity, and owner matrix."
            code="FEAT-04"
            className="md:col-span-2"
          >
            <div className="relative rounded-xl overflow-hidden border border-slate-200">
              <img
                src="/assets/pipeline_workflow_light.png"
                alt="Pipeline Analytics Visual"
                className="w-full h-28 object-cover"
              />
            </div>
          </BentoTile>
        </div>
      </div>
    </section>
  )
}

// ── Pipeline Section ─────────────────────────────────────────────────────────
function PipelineSection() {
  const [selected, setSelected] = useState(0)
  const stage = LEDGER_STAGES[selected]

  return (
    <section id="pipeline" className="relative py-24 bg-slate-50 text-slate-900 border-t border-slate-200">
      <FadedCheckBackground opacity={0.3} />
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Sequential Workflow"
          title="The 11 sequential workspace stages"
          lede="Each stage requires verified authorization before moving to the next line."
        />

        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-start">
          <div className="md:col-span-3 space-y-1">
            {LEDGER_STAGES.map((s, i) => (
              <LedgerRow
                key={s.code}
                code={s.code}
                title={s.name}
                status={i < 4 ? "reached" : i === 4 ? "active" : "pending"}
                selected={selected === i}
                onClick={() => setSelected(i)}
              />
            ))}
          </div>

          <div className="md:col-span-2 sticky top-24">
            <AnimatePresence mode="wait">
              <motion.div
                key={selected}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="relative rounded-2xl p-6 bg-white border border-blue-200 shadow-xl"
              >
                <SkiperSvgBeam duration={4} glowColor="#2563eb" />
                <span className="text-xs font-mono font-bold text-blue-600">
                  Stage {stage.code} of {LEDGER_STAGES.length}
                </span>
                <h3 className="mt-2 text-xl font-bold text-slate-900" style={{ fontFamily: ledgerFont.display }}>
                  {stage.name}
                </h3>
                <p className="mt-3 text-xs text-slate-600 font-medium leading-relaxed">
                  {stage.note}
                </p>
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                    <CheckCircle2 className="size-4" /> Sequential Gate Lock Verified
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">
                    Strict Gate
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Roles Section ────────────────────────────────────────────────────────────
function RoleSection() {
  return (
    <section id="roles" className="relative py-24 bg-white text-slate-900 border-t border-slate-200">
      <FadedCheckBackground opacity={0.35} />
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Access Control"
          title="Role-based permissions for every team member"
          lede="Role boundaries are enforced on every API route and interface level."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {ROLES.map((r) => (
            <motion.div
              key={r.title}
              whileHover={{ y: -4 }}
              className="rounded-2xl p-5 bg-slate-50 border border-slate-200 hover:border-blue-300 flex flex-col justify-between shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <RoleAvatar initials={r.initials} />
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                    {r.badge}
                  </span>
                </div>
                <h4 className="text-base font-bold text-slate-900">{r.title}</h4>
                <p className="mt-2 text-xs text-slate-600 font-medium leading-relaxed">{r.note}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Stats Strip ──────────────────────────────────────────────────────────────
function StatsStrip() {
  const stats = [
    [LEDGER_STAGES.length, "Sequential Stages"],
    ["GeM & CPPP", "Portals Supported"],
    [6, "System Roles"],
    ["100%", "Audit Coverage"],
  ]
  return (
    <section className="py-16 bg-blue-50/80 border-y border-blue-100 text-slate-900">
      <div className="mx-auto max-w-5xl px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
        {stats.map(([v, l]) => (
          <div key={l} className="text-center">
            <CountUp value={v} className="block text-3xl sm:text-4xl font-extrabold font-mono text-blue-600" />
            <span className="mt-1 block text-xs font-bold uppercase tracking-wider text-slate-600">{l}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  const navigate = useNavigate()
  const currentYear = new Date().getFullYear()
  return (
    <footer className="bg-slate-900 text-slate-300 text-xs border-t border-slate-800">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2 space-y-3">
            <div className="inline-flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-xl bg-blue-600 border border-blue-500">
                <LedgerStampMark className="size-4" color="#ffffff" />
              </span>
              <span className="text-lg font-extrabold tracking-tight text-white" style={{ fontFamily: ledgerFont.display }}>
                OneTrack
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              OneTrack Tender Governance Platform. Engineered for public procurement teams operating across GeM and CPPP portals.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-white uppercase text-[11px] tracking-wider">Navigation</h4>
            <ul className="space-y-2 font-medium">
              <li><a href="#features" className="hover:text-white transition-colors">Capabilities</a></li>
              <li><a href="#board-demo" className="hover:text-white transition-colors">Live Board</a></li>
              <li><a href="#pipeline" className="hover:text-white transition-colors">Pipeline Gates</a></li>
              <li><a href="#roles" className="hover:text-white transition-colors">Roles</a></li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-white uppercase text-[11px] tracking-wider">Account Access</h4>
            <ul className="space-y-2 font-medium">
              <li>
                <button onClick={() => navigate("/login")} className="hover:text-white transition-colors font-bold text-blue-400 cursor-pointer">
                  Sign In to OneTrack →
                </button>
              </li>
              <li>
                <button onClick={() => navigate("/login")} className="hover:text-white transition-colors cursor-pointer">
                  Request Demo Workspace
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
          <p>© {currentYear} GlobX Technologies. OneTrack Tender Management System. All rights reserved.</p>
          <div className="flex items-center gap-4 text-slate-400 font-semibold">
            <span>GeM Compliant</span>
            <span>•</span>
            <span>CPPP Portal Integration</span>
            <span>•</span>
            <span>SOC2 Infrastructure</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ── Main Page Export ─────────────────────────────────────────────────────────
export default function Landing() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-blue-600 selection:text-white">
        <Navbar />
        <Hero />
        <LiveBoardSection />
        <CapabilitiesSection />
        <PipelineSection />
        <RoleSection />
        <FaqSection />
        <StatsStrip />
        <Footer />
      </div>
    </MotionConfig>
  )
}
