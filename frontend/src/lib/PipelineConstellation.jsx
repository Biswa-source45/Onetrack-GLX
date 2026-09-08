import { useId, useRef } from "react"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { Search, UserCheck, ShieldCheck, Tag, FileCheck, Banknote, Stamp, Send, Target, BarChart3, Trophy } from "lucide-react"
import { ledger, ledgerGlow } from "./ledgerTheme"

// The shared hero art for both the landing page and the login panel — an
// animated node-graph of the eleven-stage pipeline, replacing the old thin
// static rings (LedgerAbstract). One authored composition, not a stock
// image: sharper than any raster at any zoom, nothing to fail to load on
// the first screen a visitor sees, and it extends the same rule-line/stamp
// language the rest of "the Ledger" world already uses.
//
// Layout is normalized (0–1) so the same 11 points read sensibly whichever
// aspect ratio the caller drops it into — wide for the landing hero, tall
// for the login panel, short for the CTA band — via preserveAspectRatio
// "none": both the SVG and the icon overlay scale off the same percentages,
// so they always line up regardless of stretch.
const NODES = [
  { icon: Search, x: 0.06, y: 0.62 },
  { icon: UserCheck, x: 0.15, y: 0.42 },
  { icon: ShieldCheck, x: 0.24, y: 0.3 },
  { icon: Tag, x: 0.33, y: 0.38 },
  { icon: FileCheck, x: 0.42, y: 0.58 },
  { icon: Banknote, x: 0.51, y: 0.72 },
  { icon: Stamp, x: 0.6, y: 0.6 },
  { icon: Send, x: 0.69, y: 0.4 },
  { icon: Target, x: 0.78, y: 0.28 },
  { icon: BarChart3, x: 0.87, y: 0.38 },
  { icon: Trophy, x: 0.95, y: 0.58 },
]
const REACHED_COUNT = 6
// Segments shown mid-flow — a small pulse travels these on a loop, so the
// graph reads as a live system rather than a fully static diagram.
const FLOW_SEGMENTS = [
  [3, 4],
  [5, 6],
  [7, 8],
]
const V = 800
const pt = (n) => [n.x * V, n.y * V]

// Two palettes, not one: this art sits on white paper (landing hero) and on
// the full-ink navy panel (login, the dark CTA band) — the light-mode
// tokens would render near-invisible on navy, so dark mode borrows the
// same ink-saturated tokens the rest of the panel already uses.
const TONES = {
  light: {
    lineFrom: ledger.borderBright,
    lineTo: ledger.accent,
    nodeFill: ledger.surface,
    nodeStroke: ledger.accent,
    nodeStrokeIdle: ledger.borderBright,
    glow: ledger.accent,
    glowOpacity: 0.08,
    icon: ledger.accentDeep,
    iconIdle: ledger.textFaint,
    pulse: ledger.accentBright,
  },
  dark: {
    lineFrom: ledger.deepPanelRule,
    lineTo: ledger.deepPanelMark,
    nodeFill: ledger.deepPanelRaised,
    nodeStroke: ledger.deepPanelMark,
    nodeStrokeIdle: ledger.deepPanelRule,
    glow: ledger.deepPanelMark,
    glowOpacity: 0.22,
    icon: ledger.deepPanelMark,
    iconIdle: ledger.deepPanelRule,
    pulse: "#BAE6FD",
  },
}

export function PipelineConstellation({ className = "", interactive = true, tone = "light" }) {
  const c = TONES[tone] ?? TONES.light
  const gradientId = useId()
  const containerRef = useRef(null)

  // Pointer parallax via motion values, not useState — updates happen
  // outside React's render cycle so a mouse-move never re-renders this
  // subtree (design-taste-frontend-v1's rule for continuous transforms).
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, { stiffness: 55, damping: 20, mass: 0.6 })
  const sy = useSpring(my, { stiffness: 55, damping: 20, mass: 0.6 })
  const rotateX = useTransform(sy, [-1, 1], [3, -3])
  const rotateY = useTransform(sx, [-1, 1], [-3, 3])
  const fgX = useTransform(sx, [-1, 1], [-14, 14])
  const fgY = useTransform(sy, [-1, 1], [-10, 10])
  const bgX = useTransform(sx, [-1, 1], [-6, 6])
  const bgY = useTransform(sy, [-1, 1], [-4, 4])

  function handlePointerMove(e) {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    mx.set(((e.clientX - rect.left) / rect.width) * 2 - 1)
    my.set(((e.clientY - rect.top) / rect.height) * 2 - 1)
  }
  function handlePointerLeave() {
    mx.set(0)
    my.set(0)
  }

  return (
    <div
      ref={containerRef}
      onPointerMove={interactive ? handlePointerMove : undefined}
      onPointerLeave={interactive ? handlePointerLeave : undefined}
      // No default position class: the caller's className controls it
      // ("absolute inset-0" against a positioned ancestor, or "relative
      // h-full w-full" inside a wrapper that's already absolutely
      // positioned) — hardcoding one here would collide with whichever the
      // caller passes and silently collapse to zero height.
      className={`overflow-hidden ${className}`}
      style={{ perspective: 1000 }}
      aria-hidden="true"
    >
      {/* Atmosphere — soft drifting gradient blobs, background depth layer */}
      <motion.div className="absolute inset-0" style={{ x: bgX, y: bgY }}>
        <motion.div
          className="absolute rounded-full"
          style={{ width: "55%", aspectRatio: "1/1", left: "-8%", top: "-6%", background: `radial-gradient(circle, ${ledgerGlow.blobA} 0%, transparent 70%)`, filter: "blur(34px)" }}
          animate={{ x: [0, 22, 0], y: [0, -16, 0] }}
          transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{ width: "48%", aspectRatio: "1/1", right: "-6%", bottom: "-4%", background: `radial-gradient(circle, ${ledgerGlow.blobB} 0%, transparent 70%)`, filter: "blur(28px)" }}
          animate={{ x: [0, -18, 0], y: [0, 14, 0] }}
          transition={{ duration: 28, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{ width: "34%", aspectRatio: "1/1", left: "38%", top: "30%", background: `radial-gradient(circle, ${ledgerGlow.blobC} 0%, transparent 70%)`, filter: "blur(22px)" }}
          animate={{ x: [0, 14, 0], y: [0, 10, 0] }}
          transition={{ duration: 19, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
      </motion.div>

      {/* Node graph — mid-ground layer, moves a little more than the blobs */}
      <motion.div className="absolute inset-0" style={{ rotateX, rotateY, x: fgX, y: fgY }}>
        <svg viewBox={`0 0 ${V} ${V}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" fill="none">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor={c.lineFrom} stopOpacity="0.9" />
              <stop offset="100%" stopColor={c.lineTo} stopOpacity="0.55" />
            </linearGradient>
          </defs>

          {NODES.slice(0, -1).map((n, i) => {
            const [x1, y1] = pt(n)
            const [x2, y2] = pt(NODES[i + 1])
            const cx = (x1 + x2) / 2 + (y1 - y2) * 0.12
            const cy = (y1 + y2) / 2 + (x2 - x1) * 0.12
            return <path key={i} d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`} stroke={`url(#${gradientId})`} strokeWidth="2" strokeLinecap="round" />
          })}

          {FLOW_SEGMENTS.map(([a, b], i) => {
            const [x1, y1] = pt(NODES[a])
            const [x2, y2] = pt(NODES[b])
            return (
              <motion.circle
                key={i}
                r="5"
                fill={c.pulse}
                initial={{ cx: x1, cy: y1, opacity: 0 }}
                animate={{ cx: [x1, x2], cy: [y1, y2], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.85, repeatDelay: 1.1 }}
              />
            )
          })}

          {NODES.map((n, i) => {
            const [x, y] = pt(n)
            const reached = i < REACHED_COUNT
            return (
              <g key={i}>
                {reached && <circle cx={x} cy={y} r="22" fill={c.glow} opacity={c.glowOpacity} />}
                <circle cx={x} cy={y} r="11" fill={c.nodeFill} stroke={reached ? c.nodeStroke : c.nodeStrokeIdle} strokeWidth="2" />
              </g>
            )
          })}
        </svg>

        {NODES.map((n, i) => {
          const Icon = n.icon
          const reached = i < REACHED_COUNT
          return (
            <div
              key={i}
              className="absolute flex size-[22px] -translate-x-1/2 -translate-y-1/2 items-center justify-center"
              style={{ left: `${n.x * 100}%`, top: `${n.y * 100}%` }}
            >
              <Icon className="size-3.5" style={{ color: reached ? c.icon : c.iconIdle }} strokeWidth={2.25} />
            </div>
          )
        })}
      </motion.div>
    </div>
  )
}
