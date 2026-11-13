import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar, Clock, User, ArrowRight, History, X,
  AlertCircle, CheckCircle2, TrendingUp, TrendingDown,
  CalendarCheck, ShieldCheck
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

function formatDateTime(val) {
  if (!val) return '—'
  const d = new Date(val)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

function formatRelative(val) {
  if (!val) return ''
  const d = new Date(val)
  if (isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'Just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 30) return `${diffDays} days ago`
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function getDurationDiff(oldDate, newDate) {
  if (!oldDate || !newDate) return null
  const o = new Date(oldDate).getTime()
  const n = new Date(newDate).getTime()
  if (isNaN(o) || isNaN(n)) return null
  const diffMs = n - o
  const diffHrs = Math.round(diffMs / (1000 * 60 * 60))
  if (diffHrs === 0) return { type: 'same', text: 'Time adjusted' }
  if (diffHrs > 0) {
    const days = Math.floor(diffHrs / 24)
    const remHrs = diffHrs % 24
    if (days > 0) {
      return {
        type: 'extended',
        text: `Extended by +${days}d${remHrs > 0 ? ` ${remHrs}h` : ''}`
      }
    }
    return { type: 'extended', text: `Extended by +${diffHrs}h` }
  } else {
    const absHrs = Math.abs(diffHrs)
    const days = Math.floor(absHrs / 24)
    const remHrs = absHrs % 24
    if (days > 0) {
      return {
        type: 'preponed',
        text: `Advanced by -${days}d${remHrs > 0 ? ` ${remHrs}h` : ''}`
      }
    }
    return { type: 'preponed', text: `Advanced by -${absHrs}h` }
  }
}

export function EndDateHistoryModal({
  open,
  onClose,
  tenderTitle = 'Tender',
  tenderNumber = '',
  currentEndDate,
  history = [],
  changeCount = 0
}) {
  if (!open) return null

  // Ensure history is a valid array and sorted newest first
  const rawList = Array.isArray(history) ? history : []
  const sortedHistory = [...rawList].sort((a, b) => {
    const tA = new Date(a.changed_at || 0).getTime()
    const tB = new Date(b.changed_at || 0).getTime()
    return tB - tA
  })

  const totalCount = changeCount || sortedHistory.length
  const lastChange = sortedHistory[0]
  const earliestChange = sortedHistory[sortedHistory.length - 1]
  const originalDate = earliestChange?.old_date || (sortedHistory.length === 0 ? currentEndDate : null)

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-background/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-2xl bg-card border border-border shadow-2xl rounded-2xl overflow-hidden z-10 my-8 flex flex-col max-h-[88vh]"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-border/60 bg-gradient-to-r from-amber-500/10 via-primary/5 to-transparent flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="size-11 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-500 shrink-0 shadow-sm mt-0.5">
                <History className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-lg font-bold text-foreground">
                    End Date Change History
                  </h2>
                  {totalCount > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 shadow-xs">
                      <Clock className="size-3" />
                      {totalCount} Change{totalCount !== 1 ? 's' : ''} Recorded
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                      No changes
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                  {tenderNumber ? <span className="font-semibold text-foreground mr-1.5">{tenderNumber}</span> : null}
                  {tenderTitle}
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
              onClick={onClose}
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Quick Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 sm:p-5 bg-muted/20 border-b border-border/40 text-xs">
            <div className="rounded-xl bg-card border border-border/60 p-3 shadow-xs">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1">
                <CalendarCheck className="size-3 text-emerald-500" />
                Current End Date
              </span>
              <p className="font-semibold text-foreground text-sm truncate" title={formatDateTime(currentEndDate)}>
                {formatDateTime(currentEndDate)}
              </p>
            </div>

            <div className="rounded-xl bg-card border border-border/60 p-3 shadow-xs">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1">
                <Clock className="size-3 text-blue-500" />
                Initial Date
              </span>
              <p className="font-semibold text-foreground text-sm truncate" title={formatDateTime(originalDate)}>
                {originalDate ? formatDateTime(originalDate) : 'Not recorded'}
              </p>
            </div>

            <div className="rounded-xl bg-card border border-border/60 p-3 shadow-xs col-span-2 sm:col-span-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1">
                <User className="size-3 text-purple-500" />
                Last Modified By
              </span>
              <p className="font-semibold text-foreground text-sm truncate" title={lastChange?.changed_by_name || 'None'}>
                {lastChange?.changed_by_name || 'No modifications'}
              </p>
              {lastChange?.changed_at && (
                <span className="text-[10px] text-muted-foreground">
                  {formatRelative(lastChange.changed_at)}
                </span>
              )}
            </div>
          </div>

          {/* Timeline / Audit List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {sortedHistory.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="size-14 rounded-2xl bg-muted/60 border border-border flex items-center justify-center text-muted-foreground mx-auto mb-3 shadow-xs">
                  <Calendar className="size-7 opacity-60" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  No End Date Changes Recorded
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  The closing date for this tender has remained unchanged since creation. Whenever someone edits or extends the date, a detailed audit trail with author and timestamps will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="relative pl-6 sm:pl-8 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-border/60 space-y-5">
                {sortedHistory.map((entry, idx) => {
                  const revNum = totalCount - idx
                  const diffInfo = getDurationDiff(entry.old_date, entry.new_date)

                  return (
                    <motion.div
                      key={entry.changed_at || idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="relative group"
                    >
                      {/* Timeline dot */}
                      <div className="absolute -left-6 sm:-left-8 top-1.5 size-6 rounded-full bg-card border-2 border-amber-500 flex items-center justify-center text-[10px] font-bold text-amber-500 shadow-xs ring-4 ring-background">
                        {revNum}
                      </div>

                      {/* Content Card */}
                      <div className="rounded-xl border border-border/80 bg-card p-4 hover:border-amber-500/40 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              Revision #{revNum}
                            </span>
                            {diffInfo && (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                                diffInfo.type === 'extended'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  : diffInfo.type === 'preponed'
                                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                {diffInfo.type === 'extended' && <TrendingUp className="size-3" />}
                                {diffInfo.type === 'preponed' && <TrendingDown className="size-3" />}
                                {diffInfo.text}
                              </span>
                            )}
                          </div>

                          <span className="text-[11px] text-muted-foreground flex items-center gap-1" title={entry.changed_at ? new Date(entry.changed_at).toLocaleString('en-IN') : ''}>
                            <Clock className="size-3" />
                            {formatDateTime(entry.changed_at)}
                            {entry.changed_at && (
                              <span className="text-[10px] text-muted-foreground/80 font-medium ml-1">
                                ({formatRelative(entry.changed_at)})
                              </span>
                            )}
                          </span>
                        </div>

                        {/* Author info */}
                        <div className="flex items-center gap-2 text-xs text-foreground font-medium mb-3">
                          <div className="size-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-[10px] font-bold">
                            {(entry.changed_by_name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <span>
                            Changed by <strong className="text-foreground font-semibold">{entry.changed_by_name || 'System / Unassigned'}</strong>
                          </span>
                        </div>

                        {/* Date comparison */}
                        <div className="p-3 rounded-lg bg-muted/40 border border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <div className="flex-1">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-0.5 font-medium">
                              Previous Date
                            </span>
                            <span className="text-muted-foreground font-mono text-[11px] sm:text-xs line-through opacity-80">
                              {entry.old_date ? formatDateTime(entry.old_date) : 'None (Unset)'}
                            </span>
                          </div>

                          <div className="hidden sm:flex items-center justify-center text-muted-foreground">
                            <ArrowRight className="size-4" />
                          </div>

                          <div className="flex-1 sm:text-right">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-0.5 font-medium">
                              New Date
                            </span>
                            <span className="text-foreground font-mono text-[11px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              {formatDateTime(entry.new_date)}
                            </span>
                          </div>
                        </div>

                        {/* Reason / Note if exists */}
                        {entry.reason && (
                          <div className="mt-2.5 text-[11px] text-muted-foreground italic flex items-start gap-1.5">
                            <AlertCircle className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                            <span>{entry.reason}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-5 border-t border-border/60 bg-muted/10 flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-emerald-500" />
              Audit-verified date modification history
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs h-8 px-4 font-medium"
            >
              Close
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
