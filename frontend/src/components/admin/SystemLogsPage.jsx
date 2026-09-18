import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Inbox, ScrollText, ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { getSystemLogs } from '../../services/systemLogs'
import { dateGroupLabel } from '../../lib/dateGroups'

const CATEGORY_FILTERS = [
  { value: '', label: 'All categories' },
  { value: 'USER_MGMT', label: 'User Management' },
  { value: 'ACCESS_CONTROL', label: 'Access Control' },
  { value: 'SECURITY', label: 'Security' },
]

const CATEGORY_CLASSES = {
  USER_MGMT: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-900',
  ACCESS_CONTROL: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-900',
  SECURITY: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900',
}
const CATEGORY_LABELS = {
  USER_MGMT: 'User Management',
  ACCESS_CONTROL: 'Access Control',
  SECURITY: 'Security',
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

/**
 * SystemLogsPage — the account/permission-layer audit trail, Super Admin
 * only. Tender activity already has its own ledger (Action Ledger, seen in
 * Tender Detail / Database Audit Trail / per-person Activity Log); this
 * page covers what that one doesn't: user creation, role/permission
 * changes, and Stage Access toggles.
 *
 * Server-paginated (30/page, newest first), grouped by day the same
 * WhatsApp-style way Activity Log already is.
 */
export function SystemLogsPage() {
  const [categoryFilter, setCategoryFilter] = useState('')

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [cursor, setCursor] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const sentinelRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    getSystemLogs({ limit: 30, category: categoryFilter }).then((res) => {
      if (cancelled) return
      if (res.ok && Array.isArray(res.data)) {
        setEvents(res.data)
        setCursor(res.meta?.next_cursor || '')
        setHasMore(!!res.meta?.has_more)
      } else {
        setError(res.error?.message || 'Failed to load system logs')
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [categoryFilter])

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    getSystemLogs({ limit: 30, cursor, category: categoryFilter }).then((res) => {
      if (res.ok && Array.isArray(res.data)) {
        setEvents((prev) => {
          const seen = new Set(prev.map((e) => e.id))
          return [...prev, ...res.data.filter((e) => !seen.has(e.id))]
        })
        setCursor(res.meta?.next_cursor || '')
        setHasMore(!!res.meta?.has_more)
      }
      setLoadingMore(false)
    })
  }, [cursor, hasMore, loadingMore, categoryFilter])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '300px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-heading font-semibold text-foreground flex items-center gap-2">
          <ScrollText className="size-5 text-primary" />
          System Logs
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every account, role, permission, and stage-access change made across the system — who did what, and when.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              {CATEGORY_FILTERS.find((c) => c.value === categoryFilter)?.label}
              <ChevronDown className="size-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {CATEGORY_FILTERS.map((c) => (
              <DropdownMenuItem key={c.value} onSelect={() => setCategoryFilter(c.value)}>{c.label}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-primary" /></div>
      ) : error ? (
        <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-6 text-center text-sm text-destructive">{error}</div>
      ) : events.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-10 text-center">
          <Inbox className="size-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No system events match this filter.</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
          {events.map((e, i) => {
            const dayLabel = dateGroupLabel(e.created_at)
            const prevDayLabel = i > 0 ? dateGroupLabel(events[i - 1].created_at) : null
            const isNewDay = dayLabel !== prevDayLabel
            const catClass = CATEGORY_CLASSES[e.category] || CATEGORY_CLASSES.USER_MGMT
            return (
              <div key={e.id}>
                {isNewDay && (
                  <div className="sticky top-0 z-10 flex justify-center py-1.5 bg-muted/60 backdrop-blur-sm">
                    <span className="text-[9px] font-semibold text-muted-foreground bg-background px-2 py-0.5 rounded-full border border-border">
                      {dayLabel}
                    </span>
                  </div>
                )}
                <div className="px-4 py-3 hover:bg-muted/30 transition-colors flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${catClass}`}>
                        {CATEGORY_LABELS[e.category] || e.category}
                      </span>
                      <span className="text-xs font-medium text-foreground">{e.actor?.full_name || e.actor?.username || 'Deleted user'}</span>
                      <span className="text-xs text-muted-foreground">{formatTime(e.created_at)}</span>
                    </div>
                    <p className="text-sm text-foreground">{e.summary}</p>
                  </div>
                </div>
              </div>
            )
          })}
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
      )}
    </div>
  )
}
