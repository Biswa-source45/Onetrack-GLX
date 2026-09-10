import { useCallback, useEffect, useRef, useState } from 'react'
import { History, Loader2, ScrollText } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { getGlobalAuditHistory } from '../../services/bids'
import { dateGroupLabel } from '../../lib/dateGroups'

/**
 * ActivityLogDialog — "Action Ledger" per-person view.
 *
 * Maps to: GET /api/v1/bids/audit-history?user_id={user.id}
 * Server-gated to Super Admin / Admin / Manager (403 for anyone else) —
 * this component doesn't re-check the role, it just won't be reachable from
 * the row-actions menu for a viewer without it (see UserTable.jsx).
 *
 * Server-paginated (30/page, newest first): scrolling the list to its
 * bottom loads the next page instead of ever fetching one person's whole
 * history in a single response.
 *
 * Props:
 *   open        {boolean}
 *   onOpenChange {(open: boolean) => void}
 *   user        {object}  the row's user — needs id, full_name/username
 */
function eventBadge(type) {
  switch (type) {
    case 'TENDER_EDITED':
      return { label: 'Edited', class: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200' }
    case 'TENDER_ARCHIVED':
      return { label: 'Archived', class: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200' }
    case 'TENDER_RESTORED':
      return { label: 'Restored', class: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200' }
    case 'TENDER_DELETED':
      return { label: 'Deleted', class: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200' }
    case 'OUTCOME_RECORDED':
      return { label: 'Outcome', class: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200' }
    case 'MEMBER_ADDED':
    case 'MEMBER_REMOVED':
      return { label: 'Team Change', class: 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300 border-violet-200' }
    case 'PRICING':
    case 'OEM':
    case 'CHECKLIST':
    case 'ALERT':
      return { label: type.charAt(0) + type.slice(1).toLowerCase(), class: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200' }
    default:
      return { label: 'Stage Change', class: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200' }
  }
}

export function ActivityLogDialog({ open, onOpenChange, user }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [cursor, setCursor] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const sentinelRef = useRef(null)
  const scrollRef = useRef(null)

  const userId = user?.id

  useEffect(() => {
    if (!open || !userId) return
    let cancelled = false
    setLoading(true)
    setError('')
    getGlobalAuditHistory({ limit: 30, userId }).then((res) => {
      if (cancelled) return
      if (res.ok && Array.isArray(res.data)) {
        setEntries(res.data)
        setCursor(res.meta?.next_cursor || '')
        setHasMore(!!res.meta?.has_more)
      } else {
        setError(res.error?.message || 'Failed to load activity log')
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [open, userId])

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || !userId) return
    setLoadingMore(true)
    getGlobalAuditHistory({ limit: 30, cursor, userId }).then((res) => {
      if (res.ok && Array.isArray(res.data)) {
        setEntries((prev) => {
          const seen = new Set(prev.map((e) => e.id))
          return [...prev, ...res.data.filter((e) => !seen.has(e.id))]
        })
        setCursor(res.meta?.next_cursor || '')
        setHasMore(!!res.meta?.has_more)
      }
      setLoadingMore(false)
    })
  }, [cursor, hasMore, loadingMore, userId])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !open || !hasMore) return
    const observer = new IntersectionObserver(
      (obsEntries) => { if (obsEntries[0].isIntersecting) loadMore() },
      { root: scrollRef.current, rootMargin: '150px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [open, hasMore, loadMore])

  if (!user) return null
  const displayName = user.full_name || user.username

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4 text-primary" />
            Activity Log
          </DialogTitle>
          <DialogDescription>
            Every tender action recorded for <span className="font-medium text-foreground">{displayName}</span> — newest first.
          </DialogDescription>
        </DialogHeader>

        <div ref={scrollRef} className="max-h-[60vh] overflow-y-auto divide-y divide-border">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <Loader2 className="size-5 animate-spin text-primary" />
              Loading activity log…
            </div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-destructive">{error}</div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <ScrollText className="size-8 mx-auto mb-2 opacity-30" />
              No recorded actions yet.
            </div>
          ) : (
            entries.map((entry, i) => {
              const badge = eventBadge(entry.event_type)
              const when = entry.created_at ? new Date(entry.created_at) : null
              const dayLabel = when ? dateGroupLabel(when) : null
              const prevWhen = i > 0 && entries[i - 1].created_at ? new Date(entries[i - 1].created_at) : null
              const isNewDay = dayLabel && (!prevWhen || dateGroupLabel(prevWhen) !== dayLabel)
              return (
                <div key={entry.id}>
                  {isNewDay && (
                    <div className="sticky top-0 z-10 flex justify-center py-2 bg-popover/95 backdrop-blur-sm">
                      <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full border border-border">
                        {dayLabel}
                      </span>
                    </div>
                  )}
                  <div className="px-5 py-3 text-xs space-y-1.5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground truncate" title={entry.bid_title}>
                        {entry.bid_title || 'Deleted tender'}
                      </span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border shrink-0 ${badge.class}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {entry.transition_reason || `Stage: ${entry.from_stage ? `${entry.from_stage} → ` : ''}${entry.to_stage}`}
                    </p>
                    {when && (
                      <p className="text-[10px] text-muted-foreground/70 font-mono">
                        {when.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </p>
                    )}
                  </div>
                </div>
              )
            })
          )}
          {hasMore && (
            <div ref={sentinelRef} className="flex items-center justify-center py-4">
              {loadingMore && (
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Loading more…
                </span>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
