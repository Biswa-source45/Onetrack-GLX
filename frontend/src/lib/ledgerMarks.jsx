import { ledger } from "./ledgerTheme"

// A single stamp glyph — the world's one recurring mark, used for a
// completed/reached ledger row on both the landing pipeline and the login
// panel's live board. One small inline SVG (icon-scale, not a plate).
export function LedgerStampMark({ className = "", color = ledger.accent }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="13" stroke={color} strokeWidth="2" />
      <path d="M10 16.5l4 4 8-9" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
