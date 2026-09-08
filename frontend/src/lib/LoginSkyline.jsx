import { motion } from "framer-motion"
import { ledger } from "./ledgerTheme"

// A flat, geometric line-art skyline bleeding off the bottom of the login
// panel — hand-built rather than a generated photo, since it has to match
// the panel's exact navy ink tone (ledger.deepPanel*) rather than whatever
// color a generator returns. Purely decorative, so it's excluded from the
// accessibility tree.
const BUILDINGS = [
  { x: 0, w: 34, h: 92, windows: 3 },
  { x: 30, w: 46, h: 132, windows: 4 },
  { x: 72, w: 30, h: 78, windows: 2 },
  { x: 98, w: 52, h: 158, windows: 5, roof: "peak" },
  { x: 146, w: 34, h: 104, windows: 3 },
  { x: 176, w: 44, h: 140, windows: 4 },
  { x: 216, w: 30, h: 84, windows: 2 },
  { x: 242, w: 40, h: 118, windows: 3, roof: "peak" },
  { x: 278, w: 34, h: 96, windows: 3 },
]
const VW = 312
const VH = 168

// A handful of windows "wake up" softly and stay lit — a slow, sparse
// flicker rather than a synchronized blink, so the skyline reads as alive
// without turning into distracting noise behind the login form.
function Windows({ x, w, h, top }) {
  const cols = Math.max(1, Math.floor(w / 12))
  const rows = Math.max(2, Math.floor((h - top) / 18))
  const dots = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const seed = (x * 7 + r * 13 + c * 5) % 11
      const lit = seed < 3
      dots.push(
        <motion.rect
          key={`${r}-${c}`}
          x={x + 6 + c * 12}
          y={top + 10 + r * 18}
          width="4"
          height="6"
          rx="0.5"
          fill={ledger.deepPanelMark}
          initial={{ opacity: 0.35 }}
          animate={lit ? { opacity: [0.35, 0.9, 0.35] } : { opacity: 0.35 }}
          transition={lit ? { duration: 3.5 + seed * 0.4, repeat: Infinity, ease: "easeInOut", delay: seed * 0.5 } : undefined}
        />
      )
    }
  }
  return dots
}

export function LoginSkyline({ className = "" }) {
  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMax slice"
      className={className}
      aria-hidden="true"
    >
      {BUILDINGS.map((b, i) => {
        const top = VH - b.h
        return (
          <g key={i}>
            {b.roof === "peak" ? (
              <path
                d={`M ${b.x} ${top + 16} L ${b.x + b.w / 2} ${top} L ${b.x + b.w} ${top + 16} L ${b.x + b.w} ${VH} L ${b.x} ${VH} Z`}
                fill={ledger.deepPanelRaised}
                stroke={ledger.deepPanelRule}
                strokeWidth="1"
              />
            ) : (
              <rect
                x={b.x}
                y={top}
                width={b.w}
                height={b.h}
                fill={ledger.deepPanelRaised}
                stroke={ledger.deepPanelRule}
                strokeWidth="1"
              />
            )}
            <Windows x={b.x} w={b.w} h={VH} top={b.roof === "peak" ? top + 20 : top} />
          </g>
        )
      })}
    </svg>
  )
}
