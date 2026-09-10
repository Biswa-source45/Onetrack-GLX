import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// One band in the executive Pipeline KPI banner — a colored header bar over a
// white value panel. `tone` picks the header color; the info icon's tooltip
// carries the metric's exact definition so the numbers are self-explaining.
// Shared by Dashboard.jsx and AnalyticsPage.jsx so both pages render the
// identical component for the identical numbers.
const KPI_BAND_TONES = {
  navy: 'bg-slate-800',
  blue: 'bg-blue-600',
  brightBlue: 'bg-blue-500',
  emerald: 'bg-emerald-600'
}

export function PipelineKpiBand({ label, value, tone, explain, mono = true, onClick }) {
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-xl overflow-hidden border border-border bg-card shadow-xs w-full text-left ${onClick ? 'cursor-pointer hover:shadow-md hover:border-primary/40 transition-all' : ''}`}
    >
      <div className={`${KPI_BAND_TONES[tone]} px-3.5 py-2 flex items-center justify-between gap-2`}>
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/90">{label}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 text-white/70 hover:text-white transition-colors"
              aria-label={`What is ${label}?`}
            >
              <Info className="size-3.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[220px]">{explain}</TooltipContent>
        </Tooltip>
      </div>
      <div className="px-3.5 py-3">
        <p className={`text-xl font-bold text-foreground ${mono ? 'font-mono tabular-nums' : 'font-heading'}`}>{value}</p>
      </div>
    </Wrapper>
  )
}
