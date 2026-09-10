import { useCallback, useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Loader2, Inbox, Ticket as TicketIcon, ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { listAllTickets } from '../../services/tickets'
import { TICKET_CATEGORIES, categoryColor, TICKET_STATUS_LABELS, TICKET_STATUS_CLASSES } from '../../lib/ticketCategories'
import { dateGroupLabel } from '../../lib/dateGroups'
import { TicketDetailDialog } from './TicketDetailDialog'

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
]

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export function TicketsPage() {
  const { refreshTicketsCount } = useOutletContext() || {}

  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [cursor, setCursor] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const sentinelRef = useRef(null)

  const [selectedTicketId, setSelectedTicketId] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listAllTickets({ limit: 30, status: statusFilter, category: categoryFilter }).then((res) => {
      if (cancelled) return
      if (res.ok) {
        setTickets(res.data || [])
        setCursor(res.meta?.next_cursor || '')
        setHasMore(!!res.meta?.has_more)
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [statusFilter, categoryFilter])

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    listAllTickets({ limit: 30, cursor, status: statusFilter, category: categoryFilter }).then((res) => {
      if (res.ok) {
        setTickets((prev) => {
          const seen = new Set(prev.map((t) => t.id))
          return [...prev, ...(res.data || []).filter((t) => !seen.has(t.id))]
        })
        setCursor(res.meta?.next_cursor || '')
        setHasMore(!!res.meta?.has_more)
      }
      setLoadingMore(false)
    })
  }, [cursor, hasMore, loadingMore, statusFilter, categoryFilter])

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

  function handleChanged() {
    refreshTicketsCount?.()
    // Re-run the current filter from page one — simplest correct way to
    // reflect a status change (a ticket may now belong to a different
    // filtered view, e.g. it just left "Open").
    setLoading(true)
    listAllTickets({ limit: 30, status: statusFilter, category: categoryFilter }).then((res) => {
      if (res.ok) {
        setTickets(res.data || [])
        setCursor(res.meta?.next_cursor || '')
        setHasMore(!!res.meta?.has_more)
      }
      setLoading(false)
    })
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-heading font-semibold text-foreground flex items-center gap-2">
          <TicketIcon className="size-5 text-primary" />
          Tickets
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Every question, bug, and idea reported across the team.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              {STATUS_FILTERS.find((s) => s.value === statusFilter)?.label}
              <ChevronDown className="size-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {STATUS_FILTERS.map((s) => (
              <DropdownMenuItem key={s.value} onSelect={() => setStatusFilter(s.value)}>{s.label}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              {categoryFilter || 'All categories'}
              <ChevronDown className="size-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-[320px] overflow-y-auto">
            <DropdownMenuItem onSelect={() => setCategoryFilter('')}>All categories</DropdownMenuItem>
            {TICKET_CATEGORIES.filter((c) => c !== 'Other').map((c) => (
              <DropdownMenuItem key={c} onSelect={() => setCategoryFilter(c)}>{c}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-primary" /></div>
      ) : tickets.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-10 text-center">
          <Inbox className="size-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No tickets match this filter.</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
          {tickets.map((t, i) => {
            const label = t.category === 'Other' ? (t.custom_category || 'Other') : t.category
            const chip = categoryColor(label)
            const dayLabel = dateGroupLabel(t.created_at)
            const prevDayLabel = i > 0 ? dateGroupLabel(tickets[i - 1].created_at) : null
            const isNewDay = dayLabel !== prevDayLabel
            return (
              <div key={t.id}>
                {isNewDay && (
                  <div className="sticky top-0 z-10 flex justify-center py-1.5 bg-muted/60 backdrop-blur-sm">
                    <span className="text-[9px] font-semibold text-muted-foreground bg-background px-2 py-0.5 rounded-full border border-border">
                      {dayLabel}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => setSelectedTicketId(t.id)}
                  className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${chip.bg} ${chip.text} ${chip.border}`}>
                        {label}
                      </span>
                      <span className="text-xs font-medium text-foreground">{t.reporter?.full_name || t.reporter?.username}</span>
                      <span className="text-xs text-muted-foreground">{formatTime(t.created_at)}</span>
                    </div>
                    <p className="text-sm text-foreground truncate">{t.description}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${TICKET_STATUS_CLASSES[t.status]}`}>
                    {TICKET_STATUS_LABELS[t.status] || t.status}
                  </span>
                </button>
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

      <TicketDetailDialog
        open={!!selectedTicketId}
        onOpenChange={(v) => !v && setSelectedTicketId(null)}
        ticketId={selectedTicketId}
        canManage
        onChanged={handleChanged}
      />
    </div>
  )
}
