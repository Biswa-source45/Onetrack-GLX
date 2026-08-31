import React, { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion, AnimatePresence, MotionConfig } from "framer-motion"
import { Menu, X, ArrowRight } from "lucide-react"

import { tokenStorage } from "../services/auth"
import { ledger, ledgerFont, LEDGER_STAGES } from "../lib/ledgerTheme"
import { LedgerStampMark } from "../lib/ledgerMarks"
import { LedgerRow } from "../lib/LedgerRow"

// ── Content ──────────────────────────────────────────────────────────────────
const CAPABILITIES = [
  { title: "Stage Gate Pipeline", note: "Ten sequential stages, each locked behind the one before it — nothing skips ahead by accident." },
  { title: "EMD & Bank Guarantee Tracking", note: "Deposits, guarantees, and returns entered from processing through final handover." },
  { title: "Role-Based Access", note: "Six roles, server-enforced permissions, and an audit trail on every stage change." },
  { title: "Pipeline Analytics", note: "Funnel, win/loss, and owner performance — visible the moment a stage updates." },
]

const ROLES = [
  { title: "Super Admin & Admin", initials: "SA", badge: "Full Access", note: "Unrestricted administration — settings, roles, and the full bid pipeline." },
  { title: "Manager", initials: "MG", badge: "Lifecycle Owner", note: "Creates tenders, assigns owners, and reviews pipeline analytics." },
  { title: "Bid Executive", initials: "BE", badge: "Stage Execution", note: "Runs discovery through submission — documents, checklists, compliance." },
  { title: "Pre-Sales", initials: "PS", badge: "Eligibility & OEM", note: "Technical eligibility review, OEM tracking, feasibility assessment." },
  { title: "Finance", initials: "FN", badge: "EMD & BG", note: "Earnest deposits, Bank Guarantees, margins, and commercial pricing." },
]

// Illustrative snapshot for the hero register — labelled, not live data.
const HERO_SNAPSHOT_REACHED = 4
const HERO_SNAPSHOT_ACTIVE = 5

// ── Small shared bits ────────────────────────────────────────────────────────
function Wordmark({ size = "text-base" }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="flex size-7 items-center justify-center rounded-[5px]"
        style={{ background: ledger.surfaceRaised, border: `1px solid ${ledger.borderBright}` }}
      >
        <LedgerStampMark className="size-4" color={ledger.accent} />
      </span>
      <span
        className={`${size} font-semibold tracking-tight`}
        style={{ fontFamily: ledgerFont.display, color: ledger.text }}
      >
        OneTrack
      </span>
    </span>
  )
}

function StampButton({ children, onClick, href, as, size = "md", className = "" }) {
  const pad = size === "lg" ? "px-6 py-3.5 text-sm" : "px-5 py-2.5 text-[13px]"
  const cls = `inline-flex items-center justify-center gap-2 rounded-[5px] font-semibold tracking-wide transition-transform active:scale-[0.98] ${pad} ${className}`
  const style = {
    fontFamily: ledgerFont.body,
    background: ledger.accent,
    color: "#FFFFFF",
    boxShadow: `0 1px 0 ${ledger.accentDeep}, 0 10px 22px -8px rgba(37,99,235,0.45)`,
  }
  if (as === "link") {
    return (
      <Link to={href} className={cls} style={style}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cls} style={style}>
      {children}
    </button>
  )
}

function GhostButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-[5px] px-4 py-2 text-[13px] font-semibold transition-colors"
      style={{ fontFamily: ledgerFont.body, color: ledger.text, border: `1px solid ${ledger.borderBright}` }}
    >
      {children}
    </button>
  )
}

function SectionHeading({ title, lede }) {
  return (
    <div className="mb-10 max-w-2xl">
      <h2
        className="text-2xl font-semibold sm:text-3xl"
        style={{ fontFamily: ledgerFont.display, color: ledger.text, textWrap: "balance" }}
      >
        {title}
      </h2>
      {lede && (
        <p className="mt-2.5 text-sm" style={{ fontFamily: ledgerFont.body, color: ledger.textMuted }}>
          {lede}
        </p>
      )}
    </div>
  )
}

// Abstract, authored composition — concentric rings and offset ledger-rule
// arcs in the brand blue. Not a stock gradient blob: geometric, drawn from
// the same rule-line material the register itself uses.
function AbstractMark({ className = "" }) {
  return (
    <svg viewBox="0 0 360 360" fill="none" className={className} aria-hidden="true">
      <circle cx="180" cy="180" r="150" stroke={ledger.rule} strokeWidth="1.5" />
      <circle cx="180" cy="180" r="112" stroke={ledger.rule} strokeWidth="1.5" />
      <circle cx="180" cy="180" r="74" stroke={ledger.borderBright} strokeWidth="1.5" />
      <path d="M180 30a150 150 0 0 1 106 256" stroke={ledger.accent} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M180 68a112 112 0 0 1 79 191" stroke={ledger.accentBright} strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      <circle cx="180" cy="180" r="36" fill={ledger.accent} opacity="0.08" />
      <circle cx="180" cy="180" r="5" fill={ledger.accent} />
    </svg>
  )
}

// Avatar-style role monogram — an initial in a ring, not a stock photo.
function RoleAvatar({ initials }) {
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
      style={{ background: ledger.surfaceRaised, border: `1px solid ${ledger.borderBright}`, color: ledger.accentDeep, fontFamily: ledgerFont.mono }}
    >
      {initials}
    </span>
  )
}

// ── Nav ──────────────────────────────────────────────────────────────────────
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
      className="sticky top-0 z-50 w-full transition-shadow duration-200"
      style={{
        background: isScrolled ? "rgba(255,255,255,0.9)" : ledger.ground,
        borderBottom: `1px solid ${isScrolled ? ledger.borderBright : ledger.border}`,
        backdropFilter: isScrolled ? "blur(8px)" : undefined,
      }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="cursor-pointer">
          <Wordmark />
        </button>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium" style={{ fontFamily: ledgerFont.body }}>
          <a href="#pipeline" className="transition-colors" style={{ color: ledger.textMuted }}>Pipeline</a>
          <a href="#roles" className="transition-colors" style={{ color: ledger.textMuted }}>Roles</a>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {isAuthed ? (
            <StampButton as="link" href="/dashboard">Open Dashboard <ArrowRight className="size-3.5" /></StampButton>
          ) : (
            <>
              <GhostButton onClick={() => onNavigate("login")}>Sign In</GhostButton>
              <StampButton onClick={() => onNavigate("login")}>Sign In to the Ledger</StampButton>
            </>
          )}
        </div>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 rounded-[5px]"
          style={{ color: ledger.text }}
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
            className="md:hidden px-4 pt-2 pb-5 space-y-3"
            style={{ borderTop: `1px solid ${ledger.border}`, background: ledger.ground }}
          >
            <a href="#pipeline" onClick={() => setIsMobileMenuOpen(false)} className="block py-1.5 text-sm font-semibold" style={{ color: ledger.text, fontFamily: ledgerFont.body }}>Pipeline</a>
            <a href="#roles" onClick={() => setIsMobileMenuOpen(false)} className="block py-1.5 text-sm font-semibold" style={{ color: ledger.text, fontFamily: ledgerFont.body }}>Roles</a>
            <div className="pt-3" style={{ borderTop: `1px solid ${ledger.border}` }}>
              {isAuthed ? (
                <StampButton as="link" href="/dashboard" className="w-full">Open Dashboard</StampButton>
              ) : (
                <StampButton onClick={() => { setIsMobileMenuOpen(false); onNavigate("login") }} className="w-full">Sign In to the Ledger</StampButton>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

// ── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ onNavigate }) {
  const isAuthed = !!tokenStorage.getAccessToken()

  return (
    <section className="relative pt-16 pb-20 overflow-hidden" style={{ background: ledger.ground }}>
      {/* Abstract mark, offset behind the register — decorative, not content */}
      <AbstractMark className="pointer-events-none absolute -right-24 -top-16 hidden xl:block size-[560px] opacity-70" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-14 items-center">
          <div className="lg:col-span-6 space-y-7">
            <h1
              className="text-4xl sm:text-5xl font-semibold leading-[1.08]"
              style={{ fontFamily: ledgerFont.display, color: ledger.text, textWrap: "balance" }}
            >
              Ten stages. Every one <span style={{ color: ledger.accent }}>accounted for</span>.
            </h1>

            <p className="text-base leading-relaxed max-w-lg" style={{ fontFamily: ledgerFont.body, color: ledger.textMuted }}>
              OneTrack keeps a GeM or CPPP tender's entire lifecycle in one ledger — EMD and
              Bank Guarantee entered at every gate, nothing marked reached until the stage
              before it is actually closed.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
              {isAuthed ? (
                <StampButton as="link" href="/dashboard" size="lg" className="w-full sm:w-auto">
                  Open Dashboard <ArrowRight className="size-4" />
                </StampButton>
              ) : (
                <StampButton onClick={() => onNavigate("login")} size="lg" className="w-full sm:w-auto">
                  Sign In to the Ledger <ArrowRight className="size-4" />
                </StampButton>
              )}
              <a
                href="#pipeline"
                className="w-full sm:w-auto text-sm font-semibold h-11 px-5 rounded-[5px] flex items-center justify-center transition-colors"
                style={{ fontFamily: ledgerFont.body, color: ledger.text, border: `1px solid ${ledger.borderBright}` }}
              >
                Open the register
              </a>
            </div>

            <div className="flex gap-8 pt-5" style={{ borderTop: `1px solid ${ledger.border}` }}>
              {[["10", "Gated Stages"], ["GeM & CPPP", "Portals"], ["6", "Roles"]].map(([v, l]) => (
                <div key={l} className="pt-5">
                  <span className="block text-lg font-semibold tabular-nums" style={{ fontFamily: ledgerFont.mono, color: ledger.accentDeep }}>{v}</span>
                  <span className="block text-[11px] uppercase tracking-wide mt-0.5" style={{ fontFamily: ledgerFont.body, color: ledger.textFaint }}>{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Live illustrative ledger register — the page's one entrance
              moment lives inside it already (each reached row's stamp
              strikes on mount), so this wrapper needs none of its own. */}
          <div className="lg:col-span-6 relative">
            <div
              className="relative rounded-[8px] p-5 sm:p-6"
              style={{ background: ledger.surface, border: `1px solid ${ledger.borderBright}`, boxShadow: "0 24px 60px -24px rgba(16,24,40,0.18)" }}
            >
              <div className="flex items-center justify-between pb-3 mb-1" style={{ borderBottom: `1px solid ${ledger.rule}` }}>
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ fontFamily: ledgerFont.mono, color: ledger.textFaint }}>
                  GEM/2026/B/041872 · Example
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-[3px]" style={{ fontFamily: ledgerFont.body, color: ledger.accentDeep, border: `1px solid ${ledger.borderBright}`, background: ledger.surfaceRaised }}>
                  Bid Executive
                </span>
              </div>

              {LEDGER_STAGES.map((s, i) => (
                <LedgerRow
                  key={s.code}
                  code={s.code}
                  title={s.name}
                  note={i === HERO_SNAPSHOT_ACTIVE - 1 ? "In progress now" : undefined}
                  status={i < HERO_SNAPSHOT_REACHED ? "reached" : i === HERO_SNAPSHOT_ACTIVE - 1 ? "active" : "pending"}
                  dense
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Capabilities — a ledger register, not icon cards ────────────────────────
function CapabilitySection() {
  return (
    <section className="py-20" style={{ background: ledger.groundDeep }}>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionHeading title="What the ledger actually tracks" />
        <div>
          {CAPABILITIES.map((c, i) => (
            <LedgerRow key={c.title} code={`C${i + 1}`} title={c.title} note={c.note} status="reached" />
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Pipeline — the full register, selectable ─────────────────────────────────
function PipelineSection() {
  const [selected, setSelected] = useState(0)
  const stage = LEDGER_STAGES[selected]

  return (
    <section id="pipeline" className="py-20" style={{ background: ledger.ground }}>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="The pipeline, entered in order"
          lede="A tender can't reach the next line until the one before it is actually closed. Select a stage to read its entry."
        />

        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          <div className="md:col-span-3">
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

          <div className="md:col-span-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={selected}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="rounded-[8px] p-5 sticky top-24"
                style={{ background: ledger.surface, border: `1px solid ${ledger.borderBright}`, boxShadow: "0 16px 40px -20px rgba(16,24,40,0.14)" }}
              >
                <span className="text-[11px] font-semibold tabular-nums" style={{ fontFamily: ledgerFont.mono, color: ledger.accentDeep }}>
                  Entry {stage.code} of 10
                </span>
                <h3 className="mt-1.5 text-lg font-semibold" style={{ fontFamily: ledgerFont.display, color: ledger.text }}>
                  {stage.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ fontFamily: ledgerFont.body, color: ledger.textMuted }}>
                  {stage.note}
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs font-semibold" style={{ fontFamily: ledgerFont.body, color: ledger.accentDeep }}>
                  <LedgerStampMark className="size-4" color={ledger.accent} />
                  Gate enforced
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Roles ────────────────────────────────────────────────────────────────────
function RoleSection() {
  return (
    <section id="roles" className="py-20" style={{ background: ledger.groundDeep }}>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionHeading title="Six roles, each seeing only their column" lede="Permissions and stage access are enforced by role, not convention." />
        <div>
          {ROLES.map((r) => (
            <div
              key={r.title}
              className="flex items-center gap-3.5 py-3.5"
              style={{ borderBottom: `1px solid ${ledger.rule}` }}
            >
              <RoleAvatar initials={r.initials} />
              <div className="min-w-0 flex-1">
                <span className="block font-medium" style={{ fontFamily: ledgerFont.display, color: ledger.text, fontSize: "1.05rem" }}>{r.title}</span>
                <span className="mt-0.5 block truncate text-xs" style={{ fontFamily: ledgerFont.body, color: ledger.textMuted }}>{r.note}</span>
              </div>
              <span
                className="shrink-0 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-[3px]"
                style={{ fontFamily: ledgerFont.body, color: ledger.accentDeep, border: `1px solid ${ledger.borderBright}`, background: ledger.surfaceRaised }}
              >
                {r.badge}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Closing balance / CTA ────────────────────────────────────────────────────
function ClosingCTA({ onNavigate }) {
  const isAuthed = !!tokenStorage.getAccessToken()
  return (
    <section className="py-20" style={{ background: ledger.ground }}>
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div
          className="rounded-[8px] p-10 text-center"
          style={{ background: ledger.surfaceRaised, border: `1px solid ${ledger.borderBright}` }}
        >
          <h2 className="text-2xl sm:text-3xl font-semibold" style={{ fontFamily: ledgerFont.display, color: ledger.text, textWrap: "balance" }}>
            Bring your tender pipeline into one ledger
          </h2>
          <p className="mt-3 text-sm max-w-md mx-auto" style={{ fontFamily: ledgerFont.body, color: ledger.textMuted }}>
            Sign in to pick up where your team left off — or open the dashboard if you're already in.
          </p>
          <div className="mt-6">
            {isAuthed ? (
              <StampButton as="link" href="/dashboard" size="lg">Open Dashboard <ArrowRight className="size-4" /></StampButton>
            ) : (
              <StampButton onClick={() => onNavigate("login")} size="lg">Sign In to the Ledger <ArrowRight className="size-4" /></StampButton>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  const currentYear = new Date().getFullYear()
  return (
    <footer style={{ background: ledger.ground, borderTop: `1px solid ${ledger.border}` }}>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8" style={{ borderBottom: `1px solid ${ledger.border}` }}>
          <div className="md:col-span-1 space-y-2.5">
            <Wordmark />
            <p className="text-xs leading-relaxed max-w-xs" style={{ fontFamily: ledgerFont.body, color: ledger.textMuted }}>
              Tender lifecycle management for GeM and CPPP public bidding.
            </p>
          </div>

          <div className="space-y-2 text-xs">
            <h4 className="font-semibold uppercase text-[10px] tracking-wider" style={{ fontFamily: ledgerFont.body, color: ledger.textFaint }}>System</h4>
            <ul className="space-y-1.5 font-medium" style={{ fontFamily: ledgerFont.body }}>
              <li><a href="#pipeline" style={{ color: ledger.textMuted }}>Pipeline</a></li>
              <li><a href="#roles" style={{ color: ledger.textMuted }}>Roles &amp; Access</a></li>
            </ul>
          </div>

          <div className="space-y-2 text-xs">
            <h4 className="font-semibold uppercase text-[10px] tracking-wider" style={{ fontFamily: ledgerFont.body, color: ledger.textFaint }}>Account</h4>
            <ul className="space-y-1.5 font-medium" style={{ fontFamily: ledgerFont.body }}>
              <li><Link to="/login" className="font-semibold" style={{ color: ledger.accentDeep }}>Sign in →</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs" style={{ fontFamily: ledgerFont.body, color: ledger.textMuted }}>
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

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate()

  const handleNavigate = (route) => {
    if (route === "login") navigate("/login")
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen" style={{ background: ledger.ground }}>
        <Navbar onNavigate={handleNavigate} />
        <Hero onNavigate={handleNavigate} />
        <CapabilitySection />
        <PipelineSection />
        <RoleSection />
        <ClosingCTA onNavigate={handleNavigate} />
        <Footer />
      </div>
    </MotionConfig>
  )
}
