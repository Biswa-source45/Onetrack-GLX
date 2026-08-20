import React, { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  Layers,
  Menu,
  X,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  IndianRupee,
  BarChart2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

import { tokenStorage } from "../services/auth"

// ── Real 10-stage pipeline (mirrors services/bids.js STAGE_LABELS) ───────────
const STAGES = [
  { name: "Discovered", desc: "Log the opportunity from GeM or CPPP with its Bid Number and closing deadline. Tenders are only added once eligibility is already confirmed." },
  { name: "OEM Authorization", desc: "Request MAF, MII, and No-Malicious-Code certificates from OEM partners." },
  { name: "Pricing Request", desc: "Collect distributor quotes and calculate the commercial offer." },
  { name: "Document Checklist", desc: "Track every bidder and OEM document required for submission." },
  { name: "EMD Processing", desc: "Process the earnest money deposit — online transfer, DD, or exemption." },
  { name: "Internal Approval", desc: "Management sign-off on pricing and compliance before submission." },
  { name: "GeM Submission", desc: "Submit the final bid on the portal before the closing deadline." },
  { name: "Technical Evaluation", desc: "Track the technical opening and record the qualification result." },
  { name: "Financial Evaluation", desc: "Track the financial opening and the L1 price comparison." },
  { name: "Award & Handover", desc: "Confirm Purchase Order receipt, Bank Guarantee, and EMD return." },
]

const CAPABILITIES = [
  { icon: Layers, title: "Stage Gate Pipeline", desc: "Ten sequential stages, each locked behind the one before it — nothing skips ahead by accident." },
  { icon: IndianRupee, title: "EMD & BG Tracking", desc: "Deposits, bank guarantees, and returns tracked from processing through final handover." },
  { icon: ShieldCheck, title: "Role-Based Access", desc: "Six roles, granular permissions, and an audit trail on every stage change." },
  { icon: BarChart2, title: "Pipeline Analytics", desc: "Funnel, win/loss, and owner performance — visible the moment a stage updates." },
]

const ROLES = [
  { title: "Super Admin & Admin", badge: "Full Access", desc: "Unrestricted administration — settings, roles, and the full bid pipeline." },
  { title: "Manager", badge: "Lifecycle Owner", desc: "Creates tenders, assigns owners, and reviews pipeline analytics." },
  { title: "Bid Executive", badge: "Stage Execution", desc: "Runs discovery through submission — documents, checklists, compliance." },
  { title: "Pre-Sales", badge: "Eligibility & OEM", desc: "Technical eligibility review, OEM tracking, feasibility assessment." },
  { title: "Finance", badge: "EMD & BG", desc: "Earnest deposits, Bank Guarantees, margins, and commercial pricing." },
]

// ── Motion helpers ────────────────────────────────────────────────────────────
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
}
const fadeInUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
}

function Reveal({ children, className, delay = 0 }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  )
}

function Eyebrow({ children }) {
  return (
    <Badge variant="outline" className="text-[11px] font-bold uppercase tracking-wider text-primary bg-primary/5 border-primary/20">
      {children}
    </Badge>
  )
}

/* ── Nav ──────────────────────────────────────────────────────────────────── */
function Navbar({ onNavigate }) {
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
      className={`sticky top-0 z-50 w-full transition-all duration-200 ${
        isScrolled ? "border-b border-border bg-background/95 backdrop-blur-md shadow-2xs" : "border-b border-border/60 bg-background"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Layers className="size-4.5" />
          </div>
          <span className="font-heading text-base font-bold tracking-tight text-foreground">OneTrack</span>
        </div>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
          <a href="#pipeline" className="hover:text-foreground transition-colors">Pipeline</a>
          <a href="#roles" className="hover:text-foreground transition-colors">Roles</a>
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {isAuthed ? (
            <Button asChild size="sm" className="font-semibold gap-1.5">
              <Link to="/dashboard">Open Dashboard <ArrowRight className="size-3.5" /></Link>
            </Button>
          ) : (
            <>
              <Button onClick={() => onNavigate("login")} variant="ghost" size="sm" className="font-semibold text-foreground">
                Sign In
              </Button>
              <Button onClick={() => onNavigate("login")} size="sm" className="font-semibold">
                Access System
              </Button>
            </>
          )}
        </div>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
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
            className="md:hidden border-b border-border bg-background px-4 pt-2 pb-5 space-y-3"
          >
            <a href="#pipeline" onClick={() => setIsMobileMenuOpen(false)} className="block py-1.5 text-sm font-semibold text-foreground">Pipeline</a>
            <a href="#roles" onClick={() => setIsMobileMenuOpen(false)} className="block py-1.5 text-sm font-semibold text-foreground">Roles</a>
            <div className="border-t border-border pt-3">
              {isAuthed ? (
                <Button asChild className="w-full font-semibold">
                  <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>Open Dashboard</Link>
                </Button>
              ) : (
                <Button onClick={() => { setIsMobileMenuOpen(false); onNavigate("login") }} className="w-full font-semibold">
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

/* ── Hero ─────────────────────────────────────────────────────────────────── */
function Hero({ onNavigate }) {
  const isAuthed = !!tokenStorage.getAccessToken()

  return (
    <section className="relative bg-background pt-16 pb-20 overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <motion.div
            className="lg:col-span-6 space-y-6"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/20 px-3.5 py-1 text-xs font-bold text-primary">
              Tender Operating System
            </motion.div>

            <motion.h1 variants={fadeInUp} className="font-heading text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-[1.12]" style={{ textWrap: "balance" }}>
              Every stage of the tender, <span className="text-primary">tracked</span>
            </motion.h1>

            <motion.p variants={fadeInUp} className="text-base text-muted-foreground leading-relaxed max-w-lg">
              OneTrack takes a GeM or CPPP tender from discovery to award through an eleven-stage
              gate pipeline — with EMD and Bank Guarantee tracking, role-based access, and a full
              audit trail along the way.
            </motion.p>

            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center gap-3 pt-1">
              {isAuthed ? (
                <Button asChild size="lg" className="w-full sm:w-auto font-bold gap-2">
                  <Link to="/dashboard">Open Dashboard <ArrowRight className="size-4" /></Link>
                </Button>
              ) : (
                <Button onClick={() => onNavigate("login")} size="lg" className="w-full sm:w-auto font-bold gap-2">
                  Sign In to System <ArrowRight className="size-4" />
                </Button>
              )}
              <a href="#pipeline" className="w-full sm:w-auto text-foreground border border-border font-semibold text-sm h-10 px-5 rounded-md flex items-center justify-center gap-1.5 hover:bg-muted transition-colors">
                See the pipeline <ChevronDown className="size-4" />
              </a>
            </motion.div>

            <motion.div variants={fadeInUp} className="pt-4 border-t border-border grid grid-cols-3 gap-4">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">Stages</span>
                <span className="font-mono font-bold text-sm text-foreground">10 Gated</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">Portals</span>
                <span className="font-mono font-bold text-sm text-foreground">GeM &amp; CPPP</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">Roles</span>
                <span className="font-mono font-bold text-sm text-foreground">6 Defined</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Illustrative product glimpse — labeled as an example, not live data */}
          <motion.div
            className="lg:col-span-6"
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut", delay: 0.15 }}
          >
            <Card className="rounded-2xl border border-border bg-card p-4 shadow-xl space-y-3 transition-transform duration-300 hover:-translate-y-1">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="size-2.5 rounded-full bg-muted" />
                    <div className="size-2.5 rounded-full bg-muted" />
                    <div className="size-2.5 rounded-full bg-muted" />
                  </div>
                  <span className="text-[11px] font-mono font-semibold text-muted-foreground ml-1">Tender Workspace · Example</span>
                </div>
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">Bid Executive</Badge>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold text-primary">GEM/2026/B/041872</span>
                <h4 className="text-sm font-bold text-foreground leading-snug">Supply &amp; Installation of Enterprise Network Switches</h4>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-muted-foreground font-bold">
                  <span>Stage 5 of 10 — EMD Processing</span>
                  <span>50%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: "50%" }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block">Bidder Docs</span>
                  <span className="font-mono font-bold text-sm text-foreground">4 / 5</span>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block">OEM Docs</span>
                  <span className="font-mono font-bold text-sm text-foreground">2 / 2</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground font-semibold">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                  <CheckCircle2 className="size-3.5" /> EMD mode: Online — bank details sent
                </span>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/* ── Capability strip ─────────────────────────────────────────────────────── */
function CapabilityStrip() {
  return (
    <section className="py-16 bg-muted/30 border-y border-border">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {CAPABILITIES.map((c, i) => (
            <motion.div key={i} variants={fadeInUp}>
              <Card className="h-full p-5 rounded-xl border border-border bg-card space-y-2.5 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <c.icon className="size-4.5" />
                </div>
                <h3 className="font-heading text-sm font-bold text-foreground">{c.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{c.desc}</p>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

/* ── Pipeline ─────────────────────────────────────────────────────────────── */
function PipelineSection() {
  const [selected, setSelected] = useState(0)

  return (
    <section id="pipeline" className="py-20 bg-background">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center max-w-2xl mx-auto mb-12 space-y-2">
          <Eyebrow>The Pipeline</Eyebrow>
          <h2 className="font-heading text-3xl font-extrabold text-foreground tracking-tight" style={{ textWrap: "balance" }}>
            Eleven stages, each one gated
          </h2>
          <p className="text-sm text-muted-foreground">A tender can't reach the next stage until the one before it is actually done.</p>
        </Reveal>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-8">
          {STAGES.map((st, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                selected === i
                  ? "bg-primary border-primary text-primary-foreground shadow-sm"
                  : "bg-card border-border text-foreground hover:bg-muted/60"
              }`}
            >
              <span className={`text-[10px] font-bold font-mono block ${selected === i ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-xs font-semibold truncate block mt-0.5">{st.name}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={selected}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="p-6 rounded-xl border border-border bg-card max-w-3xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="space-y-1.5">
                <Badge className="bg-primary text-primary-foreground font-mono text-xs px-2 py-0.5">Stage {selected + 1} of {STAGES.length}</Badge>
                <h3 className="font-heading text-lg font-bold text-foreground">{STAGES[selected].name}</h3>
                <p className="text-xs text-muted-foreground max-w-lg leading-relaxed">{STAGES[selected].desc}</p>
              </div>
              <div className="shrink-0 flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2 rounded-lg border border-emerald-200 dark:border-emerald-900">
                <CheckCircle2 className="size-4" /> Gate enforced
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}

/* ── Roles ────────────────────────────────────────────────────────────────── */
function RoleSection() {
  return (
    <section id="roles" className="py-20 bg-muted/30 border-y border-border">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center max-w-2xl mx-auto mb-12 space-y-2">
          <Eyebrow>Access Control</Eyebrow>
          <h2 className="font-heading text-3xl font-extrabold text-foreground tracking-tight" style={{ textWrap: "balance" }}>
            Six roles, each seeing only what they need
          </h2>
          <p className="text-sm text-muted-foreground">Permissions and stage access are enforced by role, not convention.</p>
        </Reveal>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {ROLES.map((r, i) => (
            <motion.div key={i} variants={fadeInUp}>
              <Card className="h-full p-5 rounded-xl border border-border bg-card space-y-2 transition-transform duration-200 hover:-translate-y-0.5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-heading font-bold text-sm text-foreground">{r.title}</h3>
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold shrink-0">{r.badge}</Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{r.desc}</p>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

/* ── Closing CTA ──────────────────────────────────────────────────────────── */
function ClosingCTA({ onNavigate }) {
  const isAuthed = !!tokenStorage.getAccessToken()
  return (
    <section className="py-20 bg-background">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <Card className="rounded-2xl border border-primary/20 bg-primary/5 p-10 text-center space-y-5">
            <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight" style={{ textWrap: "balance" }}>
              Bring your tender pipeline into one place
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Sign in to pick up where your team left off — or open the dashboard if you're already in.
            </p>
            {isAuthed ? (
              <Button asChild size="lg" className="font-bold gap-2">
                <Link to="/dashboard">Open Dashboard <ArrowRight className="size-4" /></Link>
              </Button>
            ) : (
              <Button onClick={() => onNavigate("login")} size="lg" className="font-bold gap-2">
                Sign In to System <ArrowRight className="size-4" />
              </Button>
            )}
          </Card>
        </Reveal>
      </div>
    </section>
  )
}

/* ── Footer ───────────────────────────────────────────────────────────────── */
function Footer() {
  const currentYear = new Date().getFullYear()
  return (
    <footer className="bg-background border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-border">
          <div className="md:col-span-1 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Layers className="size-3.5" />
              </div>
              <span className="font-heading text-sm font-bold text-foreground">OneTrack</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
              Tender lifecycle management for GeM and CPPP public bidding.
            </p>
          </div>

          <div className="space-y-2 text-xs">
            <h4 className="font-bold text-foreground uppercase text-[10px] tracking-wider">System</h4>
            <ul className="space-y-1.5 text-muted-foreground font-medium">
              <li><a href="#pipeline" className="hover:text-primary transition-colors">Pipeline</a></li>
              <li><a href="#roles" className="hover:text-primary transition-colors">Roles &amp; Access</a></li>
            </ul>
          </div>

          <div className="space-y-2 text-xs">
            <h4 className="font-bold text-foreground uppercase text-[10px] tracking-wider">Account</h4>
            <ul className="space-y-1.5 text-muted-foreground font-medium">
              <li><Link to="/login" className="text-primary font-bold hover:underline">Sign in →</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {currentYear} GlobX Technologies. OneTrack Tender Management System.</p>
          <div className="flex items-center gap-4 text-[11px] font-semibold">
            <span>GeM Compliant</span>
            <span>CPPP Integration</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function Landing() {
  const navigate = useNavigate()

  const handleNavigate = (route) => {
    if (route === "login") navigate("/login")
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground selection:bg-primary/20 selection:text-primary">
      <Navbar onNavigate={handleNavigate} />
      <Hero onNavigate={handleNavigate} />
      <CapabilityStrip />
      <PipelineSection />
      <RoleSection />
      <ClosingCTA onNavigate={handleNavigate} />
      <Footer />
    </div>
  )
}
