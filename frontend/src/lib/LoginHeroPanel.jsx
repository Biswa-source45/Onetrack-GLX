import { ledger, ledgerFont } from "./ledgerTheme"
import { LedgerStampMark } from "./ledgerMarks"
import { LoginSkyline } from "./LoginSkyline"

// The login page's left panel: wordmark on top, a short headline above the
// fold, and a skyline illustration bleeding off the bottom edge.
export function LoginHeroPanel() {
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden p-8 lg:p-10" style={{ background: ledger.deepPanel }}>
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
          From GeM submission to contract closure, one ledger for your entire bid lifecycle.
        </p>
      </div>

      <LoginSkyline className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] w-full opacity-90" />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
        style={{ background: `linear-gradient(180deg, transparent 0%, ${ledger.deepPanel} 100%)` }}
      />
    </div>
  )
}
