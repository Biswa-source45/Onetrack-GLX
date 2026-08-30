import React from 'react'
import { FileSpreadsheet } from 'lucide-react'

/**
 * Marks a tender that came in through the bulk tracker import rather than
 * being created stage-by-stage in the app. Its lifecycle stage was derived
 * from the spreadsheet's status columns, so the badge tells the team where
 * the record came from before they act on it.
 *
 * `compact` drops the label and keeps the icon, for dense spreadsheet rows.
 */
export function ImportedPill({ compact = false, className = '' }) {
  return (
    <span
      title="Imported from the GBX tracker — stage derived from the sheet"
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-100 font-bold uppercase tracking-wider text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-300 ${
        compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'
      } ${className}`}
    >
      <FileSpreadsheet className={compact ? 'size-2.5' : 'size-3'} />
      {!compact && 'Imported'}
    </span>
  )
}
