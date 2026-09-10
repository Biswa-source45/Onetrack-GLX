import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Clock, User, CheckCircle2, PlayCircle, RotateCcw } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { getTicket, getTicketHistory, updateTicketStatus } from '../../services/tickets'
import { categoryColor, TICKET_STATUS_LABELS, TICKET_STATUS_CLASSES } from '../../lib/ticketCategories'

function formatWhen(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`
}

/**
 * TicketDetailDialog — the one detail view shared by both Feedback Loop
 * surfaces: read-only for the reporter (Feedback tab's "My Tickets"),
 * with a status control when canManage is true (Tickets tab, Super Admin).
 *
 * Props:
 *   open, onOpenChange  {boolean, fn}
 *   ticketId            {string}
 *   canManage           {boolean}  show the status-change control
 *   onChanged           {fn}       called after a successful status change
 */
export function TicketDetailDialog({ open, onOpenChange, ticketId, canManage = false, onChanged }) {
  const [ticket, setTicket] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [changingTo, setChangingTo] = useState(null)

  const load = useCallback(() => {
    if (!open || !ticketId) return
    setLoading(true)
    Promise.all([getTicket(ticketId), getTicketHistory(ticketId)]).then(([t, h]) => {
      if (t.ok) setTicket(t.data)
      if (h.ok) setHistory(h.data || [])
      setLoading(false)
    })
  }, [open, ticketId])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (!open) setNote('') }, [open])

  async function handleStatusChange(status) {
    setChangingTo(status)
    try {
      const res = await updateTicketStatus(ticketId, status, note.trim() || undefined)
      if (res.ok) {
        toast.success(`Marked ${TICKET_STATUS_LABELS[status]}`)
        setNote('')
        load()
        onChanged?.()
      } else {
        toast.error(res.error?.message || 'Failed to update ticket')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setChangingTo(null)
    }
  }

  const chip = ticket ? categoryColor(ticket.category === 'Other' ? (ticket.custom_category || 'Other') : ticket.category) : null
  const displayCategory = ticket ? (ticket.category === 'Other' ? (ticket.custom_category || 'Other') : ticket.category) : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border">
          <DialogTitle>Feedback Ticket</DialogTitle>
          <DialogDescription>What was reported, and what's happened since.</DialogDescription>
        </DialogHeader>

        {loading || !ticket ? (
          <div className="p-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <Loader2 className="size-5 animate-spin text-primary" />
            Loading…
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto">
            <div className="px-5 py-4 space-y-3 border-b border-border">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${chip.bg} ${chip.text} ${chip.border}`}>
                  {displayCategory}
                </span>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${TICKET_STATUS_CLASSES[ticket.status]}`}>
                  {TICKET_STATUS_LABELS[ticket.status] || ticket.status}
                </span>
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="size-3.5" />
                <span className="font-medium text-foreground">{ticket.reporter?.full_name || ticket.reporter?.username || 'Unknown'}</span>
                <span>· {formatWhen(ticket.created_at)}</span>
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">History</span>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">No status changes yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {history.map((h) => (
                    <div key={h.id} className="flex items-start gap-2 text-xs">
                      <Clock className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-foreground">
                          {h.from_status ? `${TICKET_STATUS_LABELS[h.from_status] || h.from_status} → ` : ''}
                          <span className="font-semibold">{TICKET_STATUS_LABELS[h.to_status] || h.to_status}</span>
                          {h.changed_by && <span className="text-muted-foreground"> by {h.changed_by.full_name || h.changed_by.username}</span>}
                        </p>
                        {h.note && <p className="text-muted-foreground italic mt-0.5">"{h.note}"</p>}
                        <p className="text-muted-foreground/70 font-mono text-[10px] mt-0.5">{formatWhen(h.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {canManage && ticket.status !== 'RESOLVED' && (
              <div className="px-5 py-4 border-t border-border bg-muted/20 space-y-3">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Update status</span>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note (e.g. what fixed it)"
                  className="text-sm min-h-[60px]"
                />
                <div className="flex gap-2 flex-wrap">
                  {ticket.status === 'OPEN' && (
                    <Button size="sm" variant="outline" disabled={!!changingTo} onClick={() => handleStatusChange('IN_PROGRESS')}>
                      {changingTo === 'IN_PROGRESS' ? <Loader2 className="size-3.5 animate-spin" /> : <PlayCircle className="size-3.5" />}
                      Mark In Progress
                    </Button>
                  )}
                  <Button size="sm" disabled={!!changingTo} onClick={() => handleStatusChange('RESOLVED')}>
                    {changingTo === 'RESOLVED' ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                    Mark Resolved
                  </Button>
                </div>
              </div>
            )}

            {canManage && ticket.status === 'RESOLVED' && (
              <div className="px-5 py-4 border-t border-border bg-muted/20">
                <Button size="sm" variant="outline" disabled={!!changingTo} onClick={() => handleStatusChange('IN_PROGRESS')}>
                  {changingTo === 'IN_PROGRESS' ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                  Reopen
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
