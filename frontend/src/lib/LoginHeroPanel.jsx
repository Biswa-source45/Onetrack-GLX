import { ledger, ledgerFont } from "./ledgerTheme"
import { LedgerStampMark } from "./ledgerMarks"
import { LedgerAbstract } from "./LedgerAbstract"

// The login page's left panel: the wordmark and headline over a full-bleed
// abstract composition in the brand blue — replaces the earlier WebGL
// cloud/lightning shader (irrelevant to the product) and, per direction, the
// live stage-register board (too literal for this panel; the register
// itself is the landing page's job). The art fills the whole panel as the
// dominant visual rather than a small motif above the text.
export function LoginHeroPanel() {
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden p-8 lg:p-10" style={{ background: ledger.deepPanel }}>
      <LedgerAbstract className="absolute inset-0" />

      {/* Light legibility wash, anchored only where the wordmark and copy
          sit, so the artwork stays vivid through the middle of the panel */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `linear-gradient(180deg, ${ledger.deepPanel}B0 0%, transparent 22%, transparent 60%, ${ledger.deepPanel}D9 100%)` }}
      />

      <div className="relative z-10 flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-[5px]" style={{ background: ledger.deepPanelRaised, border: `1px solid ${ledger.deepPanelRule}` }}>
          <LedgerStampMark className="size-5" color={ledger.deepPanelMark} />
        </span>
        <span className="text-2xl font-semibold tracking-tight" style={{ fontFamily: ledgerFont.display, color: ledger.deepPanelText }}>OneTrack</span>
      </div>

      <div className="relative z-10">
        <h1 className="text-3xl lg:text-[2.5rem] font-semibold leading-[1.1]" style={{ fontFamily: ledgerFont.display, color: ledger.deepPanelText }}>
          Every tender,<br />entered in order.
        </h1>
        <p className="mt-3 text-sm leading-relaxed max-w-[300px]" style={{ fontFamily: ledgerFont.body, color: ledger.deepPanelMuted }}>
          From GeM submission to contract closure — one ledger for your entire bid lifecycle.
        </p>
      </div>
    </div>
  )
}
