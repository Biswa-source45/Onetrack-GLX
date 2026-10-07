import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { useBidStore } from '../../store/useBidStore'

const CATEGORY_FILTERS = [
  { value: '', label: 'All categories' },
  { value: 'TENDER', label: 'Tender Activity' },
  { value: 'LEAD', label: 'Leads' },
  { value: 'FEEDBACK', label: 'Feedback' },
  { value: 'USER_MGMT', label: 'User Management' },
  { value: 'ACCESS_CONTROL', label: 'Access Control' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'CONFIGURATION', label: 'Configuration' },
]

const CATEGORY_CLASSES = {
  TENDER: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
  LEAD: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-900',
  FEEDBACK: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300 border-slate-200 dark:border-slate-800',
  USER_MGMT: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-900',
  ACCESS_CONTROL: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-900',
  SECURITY: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900',
  CONFIGURATION: 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300 border-violet-200 dark:border-violet-900',
}
const CATEGORY_LABELS = {
  TENDER: 'Tender Activity',
  LEAD: 'Leads',
  FEEDBACK: 'Feedback',
  USER_MGMT: 'User Management',
  ACCESS_CONTROL: 'Access Control',
  SECURITY: 'Security',
  CONFIGURATION: 'Configuration',
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

/**
 * SystemLogsPage — one feed of everything every user does, Super Admin
 * only: logins and account/permission changes, plus the tender Action
 * Ledger, feedback tickets and lead creation, merged server-side.
 *
 * Loaded a page at a time as you scroll (30/page, newest first, keyset
 * cursor — the server never reads more than a page per source), grouped by
 * day the same WhatsApp-style way Activity Log already is. Off-screen rows
 * skip layout/paint via content-visibility, so a long session of scrolling
 * doesn't slow the page down.
 */
export function SystemLogsPage() {
  const [categoryFilter, setCategoryFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const { users, loadUsers } = useBidStore()
  useEffect(() => { loadUsers() }, [loadUsers])

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [cursor, setCursor] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const sentinelRef = useRef(null)
  // Bumped on every filter change, so a "load more" still in flight for the
  // previous filter can't append its rows to the new list.
  const requestGen = useRef(0)

  useEffect(() => {
    let cancelled = false
    requestGen.current += 1
    setLoading(true)
    setLoadingMore(false)
    setError('')
    getSystemLogs({ limit: 30, category: categoryFilter, userId: userFilter }).then((res) => {
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
  }, [categoryFilter, userFilter])

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const gen = requestGen.current
    getSystemLogs({ limit: 30, cursor, category: categoryFilter, userId: userFilter }).then((res) => {
      if (gen !== requestGen.current) return
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
  }, [cursor, hasMore, loadingMore, categoryFilter, userFilter])

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
          Everything every user does across the system — logins, account and permission changes, and every action on tenders, leads and feedback tickets. Who did what, and when.
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
        <select
          aria-label="Filter by user"
          value={userFilter}
          onChange={(ev) => setUserFilter(ev.target.value)}
          className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground max-w-[220px]"
        >
          <option value="">All users</option>
          {(users || []).map((u) => (
            <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
          ))}
        </select>
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
            const catClass = CATEGORY_CLASSES[e.category] || 'bg-muted text-muted-foreground border-border'
            return (
              <div key={e.id} className="[content-visibility:auto] [contain-intrinsic-size:auto_64px]">
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
                    {e.bid_title && (
                      e.bid_id
                        ? <Link to={`/dashboard/tenders/${e.bid_id}`} className="block text-xs font-medium text-primary hover:underline truncate">{e.bid_title}</Link>
                        : <span className="block text-xs font-medium text-muted-foreground truncate">{e.bid_title}</span>
                    )}
                    <p className="text-sm text-foreground break-words">{e.summary}</p>
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
