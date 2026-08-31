import { motion } from "framer-motion"
import { ledger } from "./ledgerTheme"

// A warm, abstract composition for the login panel — layered arcs and a soft
// glow in the brand blue, extending the same concentric-ring language as the
// landing hero's AbstractMark and the ledger stamp mark, so the two surfaces
// still read as one world without literally repeating the stage register.
// Sized to fill its panel as the dominant visual, not a small corner motif.
export function LedgerAbstract({ className = "" }) {
  return (
    <div className={`relative overflow-hidden ${className}`} aria-hidden="true">
      {/* Warm core glow, lower-right of center */}
      <div
        className="absolute rounded-full"
        style={{
          width: 620,
          height: 620,
          left: "62%",
          top: "58%",
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle, ${ledger.deepPanelMark}70 0%, ${ledger.deepPanelMark}30 34%, transparent 66%)`,
          filter: "blur(6px)",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 320,
          height: 320,
          left: "18%",
          top: "22%",
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle, #7DD3FC55 0%, transparent 70%)`,
          filter: "blur(4px)",
        }}
      />

      <svg viewBox="0 0 480 680" className="relative w-full h-full" fill="none" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="ledgerAbstractFade" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#BAE6FD" stopOpacity="0.95" />
            <stop offset="100%" stopColor={ledger.deepPanelMark} stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {/* Slow-rotating arc families, two independent centers for depth */}
        <motion.g
          style={{ transformOrigin: "300px 400px" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 100, repeat: Infinity, ease: "linear" }}
        >
          <circle cx="300" cy="400" r="260" stroke={ledger.deepPanelRule} strokeWidth="1.5" />
          <path d="M300 140a260 260 0 0 1 184 444" stroke="url(#ledgerAbstractFade)" strokeWidth="3" strokeLinecap="round" />
          <circle cx="300" cy="400" r="190" stroke={ledger.deepPanelRule} strokeWidth="1.5" />
        </motion.g>

        <motion.g
          style={{ transformOrigin: "300px 400px" }}
          animate={{ rotate: -360 }}
          transition={{ duration: 75, repeat: Infinity, ease: "linear" }}
        >
          <path d="M300 210a190 190 0 0 1 134 324" stroke={ledger.deepPanelMark} strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
          <circle cx="300" cy="400" r="128" stroke={ledger.deepPanelRule} strokeWidth="1.5" />
        </motion.g>

        <motion.g
          style={{ transformOrigin: "300px 400px" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 55, repeat: Infinity, ease: "linear" }}
        >
          <path d="M300 272a128 128 0 0 1 90 218" stroke="#BAE6FD" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        </motion.g>

        <circle cx="300" cy="400" r="72" fill={ledger.deepPanelMark} opacity="0.16" />
        <circle cx="300" cy="400" r="72" stroke={ledger.deepPanelMark} strokeWidth="1.5" opacity="0.55" />

        {/* Stamp-mark accents, echoing the ledger's own checkmark motif */}
        <circle cx="300" cy="400" r="9" fill="#BAE6FD" />
        <circle cx="486" cy="248" r="5" fill={ledger.deepPanelMark} opacity="0.85" />
        <circle cx="140" cy="560" r="4" fill={ledger.deepPanelMark} opacity="0.6" />
        <circle cx="460" cy="540" r="4" fill="#BAE6FD" opacity="0.5" />
        <circle cx="90" cy="230" r="3" fill={ledger.deepPanelMark} opacity="0.45" />
      </svg>
    </div>
  )
}
