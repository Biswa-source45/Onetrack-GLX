// "The Ledger" — the shared visual world for the landing and login pages only.
// A modern bid-finance ledger/cash-book: white paper ground, blue rule lines
// and blue-ink stamps — the same white-and-blue register the rest of the app
// already uses, executed with real typographic and compositional discipline.
// Scoped entirely to these two surfaces via literal values here, not the
// app-wide --background/--primary tokens in index.css, so nothing bleeds
// into the dashboard or any other screen.

export const ledger = {
  ground: "#FFFFFF",
  groundDeep: "#F3F6FC", // alternate section tint
  surface: "#FFFFFF",
  surfaceRaised: "#EAF1FC", // hover / raised card tint

  rule: "#D7E2F2", // ledger-pad rule line
  ruleBright: "#6D8FC9", // active / hover rule

  accent: "#2563EB", // primary blue ink — CTAs, stamps, active marks
  accentBright: "#3B82F6",
  accentDeep: "#1D4ED8",

  alert: "#DC2626", // reserved for genuine attention/overdue marks

  text: "#101828",
  textMuted: "#47536B",
  textFaint: "#667289",

  border: "#E4EAF5",
  borderBright: "#C7D6EC",

  // The login page's dark panel only: a deep blue register page, paired
  // against the white "entry" panel on the right — still the app's own
  // blue, just at full ink saturation rather than paper-white.
  deepPanel: "#1E3A8A",
  deepPanelRaised: "#24439C",
  deepPanelRule: "#33478A",
  deepPanelText: "#FFFFFF",
  deepPanelMuted: "#BFDBFE",
  deepPanelMark: "#7DD3FC",
}

export const ledgerFont = {
  display: "'Plus Jakarta Sans', system-ui, sans-serif",
  body: "'Public Sans', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
}

// Blob stops for the "Pipeline Constellation" atmosphere layer — brand blue
// family only, kept as tokens so the art component and any future tuning
// share one source instead of re-picking colors per usage site.
export const ledgerGlow = {
  blobA: "rgba(37, 99, 235, 0.16)", // ledger.accent, soft
  blobB: "rgba(59, 130, 246, 0.14)", // ledger.accentBright, soft
  blobC: "rgba(125, 211, 252, 0.14)", // sky tint, matches deepPanelMark family
}

// The eleven-stage pipeline this product is actually built around (mirrors
// services/bids.js STAGE_LABELS) — the ledger's rows are these, in order.
export const LEDGER_STAGES = [
  { code: "01", name: "Discovered", note: "Opportunity logged from GeM or CPPP" },
  { code: "02", name: "Primary Review", note: "Account Manager Go/No-Go decision" },
  { code: "03", name: "OEM Authorization", note: "MAF, MII & compliance certificates" },
  { code: "04", name: "Pricing Request", note: "Distributor quotes collected" },
  { code: "05", name: "Document Checklist", note: "Bidder & OEM documents tracked" },
  { code: "06", name: "EMD Processing", note: "Deposit — online, DD, or exemption" },
  { code: "07", name: "Internal Approval", note: "Management sign-off before submission" },
  { code: "08", name: "Bid Submission", note: "Bid filed before the closing deadline" },
  { code: "09", name: "Technical Evaluation", note: "Qualification result recorded" },
  { code: "10", name: "Financial Evaluation", note: "L1 price comparison tracked" },
  { code: "11", name: "Award & Handover", note: "PO, Bank Guarantee, EMD return" },
]
