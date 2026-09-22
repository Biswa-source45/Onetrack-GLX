import { TrendingUp } from 'lucide-react'

/**
 * Marks a tender that's identified but not yet submitted (bid_status
 * 'ACTIVE' — the same bucket the Tenders Workspace "In Progress" stat tile
 * counts), so it's visually obvious in list views the same way "Imported" is.
 *
 * `compact` drops the label and keeps the icon, for dense spreadsheet rows.
 */
export function InProgressPill({ compact = false, className = '' }) {
  return (
    <span
      title="In Progress — identified, not yet submitted"
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 font-bold uppercase tracking-wider text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-300 ${
        compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'
      } ${className}`}
    >
      <TrendingUp className={compact ? 'size-2.5' : 'size-3'} />
      {!compact && 'In Progress'}
    </span>
  )
}
