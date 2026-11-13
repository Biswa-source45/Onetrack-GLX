import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  Clock,
  History,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  Unlock,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatDateTime } from '../../lib/tenderFormat'
import {
  TECH_EVAL_FIELDS,
  addTechEvalDailyRemark,
  addTechEvalNote,
  getActiveTechEvalFields,
  getAvailableTechEvalFields,
  getTechEvalFollowUpStatus,
  openTechEval,
  setTechEvalDate,
  triggerTechEvalFollowUpReminder,
} from '../../services/techEval'

const MAX_TEXT = 1000
const CHIP = 'px-2 py-0.5 rounded-full text-[11px] font-semibold border'
const DUE_STYLE = {
  overdue: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
  soon: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800',
  ok: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
}
const CHANGE_STYLE = {
  SET: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
  EXTEND: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  PREPONE: 'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800',
  CLEAR: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700',
}
const CHANGE_LABEL = { SET: 'Set', EXTEND: 'Extended', PREPONE: 'Moved earlier', CLEAR: 'Cleared' }

const label = (key) => TECH_EVAL_FIELDS.find((f) => f.key === key)?.label || key
const localDay = (d = new Date()) => d.toLocaleDateString('en-CA') // YYYY-MM-DD in the viewer's zone
const ymd = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d) }
const fmtYmd = (s) => (s ? ymd(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

/** Days from today to a YYYY-MM-DD date (negative = past) and a short chip for it. */
function dueChip(s) {
  const diff = Math.round((ymd(s) - ymd(localDay())) / 86400000)
  if (diff < 0) return { state: 'overdue', text: `${-diff}d overdue` }
  if (diff === 0) return { state: 'soon', text: 'Today' }
  if (diff === 1) return { state: 'soon', text: 'Tomorrow' }
  return { state: 'ok', text: `in ${diff}d` }
}

/** Day the bid was submitted (viewer's zone), the earliest date the server accepts is a day before it. */
const submittedDay = (bid) => {
  const at = bid?.post_bid?.submittedAt
  return at && !Number.isNaN(new Date(at).getTime()) ? localDay(new Date(at)) : ''
}

const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'

function useSaving() {
  const ref = useRef(false)
  const [busy, setBusy] = useState(false)
  const run = async (fn) => {
    if (ref.current) return
    ref.current = true
    setBusy(true)
    try { return await fn() } finally { ref.current = false; setBusy(false) }
  }
  return [busy, run]
}

function TextCounter({ value }) {
  return <span className={`text-[10px] ${value.length > MAX_TEXT ? 'text-destructive' : 'text-muted-foreground'}`}>{value.length}/{MAX_TEXT}</span>
}

// "Open Technical Evaluation" — optional open date, plus a remark. Used from Bid Submission.
export function OpenTechEvalDialog({ bid, onClose, onDone }) {
  const [date, setDate] = useState('')
  const [remark, setRemark] = useState('')
  const [busy, run] = useSaving()
  const problem = !remark.trim() ? 'Write a remark'
    : remark.length > MAX_TEXT ? `Remark can be at most ${MAX_TEXT} characters` : ''

  const submit = () => run(async () => {
    if (problem) { toast.error(problem); return }
    const res = await openTechEval(bid.id, { date: date ? date.trim() : '', remark: remark.trim() })
    if (!res.ok && res.status !== 409) { toast.error(res.message || 'Could not open Technical Evaluation'); return }
    toast[res.ok ? 'success' : 'info'](res.ok ? 'Technical Evaluation opened' : 'Technical Evaluation was already opened')
    onDone()
  })

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">Open Technical Evaluation</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Optionally specify the technical evaluation date and leave a remark. The Account Manager, Reporting Manager and Pre-Sales are told by email.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="te-open-date" className="text-xs font-medium">Technical Evaluation open date (optional)</Label>
            <div className="flex gap-2">
              <Input id="te-open-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-xs" />
              <Button type="button" variant="outline" size="sm" onClick={() => setDate(localDay())} className="text-xs h-9">Today</Button>
              {date && <Button type="button" variant="ghost" size="sm" onClick={() => setDate('')} className="text-xs h-9">Clear</Button>}
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="te-open-remark" className="text-xs font-medium">Remark *</Label>
              <TextCounter value={remark} />
            </div>
            <Textarea id="te-open-remark" value={remark} onChange={(e) => setRemark(e.target.value)} className="text-xs min-h-[80px]" placeholder="Why / how the technical evaluation is being opened" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose} className="text-xs">Cancel</Button>
          <Button type="button" size="sm" disabled={busy || !!problem} title={problem} onClick={submit} className="gap-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white">
            <Unlock className="size-3.5" /> Open Technical Evaluation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Set, extend, move or clear one of the five lifecycle dates. All dates and reasons are optional.
function DateDialog({ bid, field, current, onClose, onDone }) {
  const [date, setDate] = useState(current || '')
  const [reason, setReason] = useState('')
  const [busy, run] = useSaving()
  const changing = !!current
  const clearing = changing && !date
  const problem = !date && !changing ? 'Choose a date'
    : reason.length > MAX_TEXT ? `Reason can be at most ${MAX_TEXT} characters` : ''

  const submit = () => run(async () => {
    if (problem) { toast.error(problem); return }
    const res = await setTechEvalDate(bid.id, { field, date: date ? date.trim() : '', reason: reason.trim() })
    if (!res.ok) { toast.error(res.message || 'Could not save the date'); if (res.status === 409) onDone(); return }
    toast.success(clearing ? 'Date cleared' : 'Date saved and notified to Account Manager')
    onDone()
  })

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">{changing ? 'Change' : 'Set'} {label(field)}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {changing ? `Currently ${fmtYmd(current)}. Extensions are kept in the date history.` : 'The Account Manager, Reporting Manager and Pre-Sales are notified by email.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="te-date" className="text-xs font-medium">Date (optional)</Label>
            <div className="flex gap-2">
              <Input id="te-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-xs" />
              <Button type="button" variant="outline" size="sm" onClick={() => setDate(localDay())} className="text-xs h-9">Today</Button>
              {changing && <Button type="button" variant="outline" size="sm" onClick={() => setDate('')} className="text-xs h-9">Clear</Button>}
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="te-reason" className="text-xs font-medium">Reason / Remark (optional)</Label>
              <TextCounter value={reason} />
            </div>
            <Textarea id="te-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="text-xs min-h-[70px]" placeholder="Optional reason or remark for setting or changing this date" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose} className="text-xs">Cancel</Button>
          <Button type="button" size="sm" disabled={busy || !!problem} title={problem || undefined} onClick={submit} className="text-xs bg-teal-600 hover:bg-teal-700 text-white">
            {clearing ? 'Clear date' : changing ? 'Update date' : 'Save date'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Daily Remarks Panel: BE submits daily updates with automated AM/PM notification & 24h SLA tracking.
function DailyRemarksPanel({ bid, readOnly, onRefresh }) {
  const te = bid?.tech_eval || {}
  const log = Array.isArray(te.log) ? te.log : []
  const dailyRemarks = log.filter((e) => e.kind === 'DAILY_REMARK')

  const [remarkText, setRemarkText] = useState('')
  const [busy, run] = useSaving()
  const [remindBusy, setRemindBusy] = useState(false)
  const [status, setStatus] = useState(null)

  const loadStatus = async () => {
    if (!bid?.id) return
    const res = await getTechEvalFollowUpStatus(bid.id)
    if (res.ok && res.data) {
      setStatus(res.data)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [bid?.id, te.lastDailyRemarkAt])

  const submitDailyRemark = () => run(async () => {
    if (!remarkText.trim()) return
    const res = await addTechEvalDailyRemark(bid.id, remarkText.trim())
    if (!res.ok) {
      toast.error(res.message || 'Could not record daily remark')
      return
    }
    toast.success('Daily remark recorded! Notification & email sent to Account Manager (AM) & PM.')
    setRemarkText('')
    onRefresh()
    loadStatus()
  })

  const triggerReminder = async () => {
    setRemindBusy(true)
    try {
      const res = await triggerTechEvalFollowUpReminder(bid.id)
      if (res.ok) {
        toast.success('Follow-up escalation email sent to Account Manager & Pre-Sales.')
      } else {
        toast.error(res.message || 'Could not send reminder')
      }
    } catch {
      toast.error('Network error triggering reminder')
    } finally {
      setRemindBusy(false)
    }
  }

  // Calculate 24-hour SLA freshness client-side fallback
  const lastRemarkAt = te.lastDailyRemarkAt || te.openedAt
  const hoursSince = lastRemarkAt ? (Date.now() - new Date(lastRemarkAt).getTime()) / 3600000 : 999
  const isOverdue = status ? status.isOverdue : hoursSince >= 24

  return (
    <div className="rounded-xl border border-teal-200 dark:border-teal-900/60 bg-gradient-to-br from-teal-50/40 via-card to-card p-4 space-y-4">
      {/* Header and SLA Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Clock className="size-4 text-teal-600 dark:text-teal-400" />
              Daily Remark & Follow-up Tracker
            </h4>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
              Stage 9 SLA: 24h Daily
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <span className="font-semibold text-teal-700 dark:text-teal-400">Process Flow:</span>
            <span>BE (Bid Executive)</span>
            <ArrowRight className="size-3 inline text-teal-600" />
            <span>Notification & Email to AM (Account Manager) & PM</span>
          </p>
        </div>

        {/* SLA Status Badge & Alert Action */}
        <div className="flex items-center gap-2 flex-wrap">
          {isOverdue ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800">
              <AlertCircle className="size-3.5" />
              Follow-up Overdue (&gt;24h)
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800">
              <CheckCircle2 className="size-3.5" />
              Follow-up Up-to-Date
            </div>
          )}

          {!readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={remindBusy}
              onClick={triggerReminder}
              className="h-7 text-xs gap-1 border-amber-300 text-amber-900 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"
              title="Send manual follow-up reminder to AM and PM"
            >
              <Bell className="size-3 text-amber-600" />
              Send Alert to AM/PM
            </Button>
          )}
        </div>
      </div>

      {/* Overdue Warning Callout if > 24 hours */}
      {isOverdue && (
        <div className="p-3 rounded-lg border border-amber-300 dark:border-amber-800/80 bg-amber-50/70 dark:bg-amber-950/30 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-300">
          <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold">Timely Follow-up Required from Bid Executive</p>
            <p className="text-amber-800/90 dark:text-amber-300/90">
              {te.lastDailyRemarkAt
                ? `Last daily remark was recorded ${Math.round(hoursSince)} hours ago by ${te.lastDailyRemarkBy || 'BE'}. Automated escalation triggers to AM/PM if remarks are not refreshed daily.`
                : 'No daily status updates have been recorded yet for this technical evaluation. Please log today’s progress below.'}
            </p>
          </div>
        </div>
      )}

      {/* BE Input Form */}
      {!readOnly && (
        <div className="space-y-2 bg-card p-3 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <Label htmlFor="daily-remark-input" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <MessageSquare className="size-3.5 text-teal-600" />
              Add Daily Remark / Follow-up Note (BE)
            </Label>
            <TextCounter value={remarkText} />
          </div>
          <Textarea
            id="daily-remark-input"
            value={remarkText}
            onChange={(e) => setRemarkText(e.target.value)}
            className="text-xs min-h-[64px] bg-background"
            placeholder="Record today's status, customer interaction, document submission, or technical clarification updates... (Ctrl+Enter to submit)"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                submitDailyRemark()
              }
            }}
          />
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
            <span className="text-[11px] text-muted-foreground">
              Posting triggers immediate notifications to the tender's Account Manager and Pre-Sales.
            </span>
            <Button
              type="button"
              size="sm"
              disabled={busy || !remarkText.trim() || remarkText.length > MAX_TEXT}
              onClick={submitDailyRemark}
              className="gap-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white font-medium"
            >
              <Send className="size-3.5" /> Submit Daily Remark (Notifies AM)
            </Button>
          </div>
        </div>
      )}

      {/* Chronological Daily Remarks Log */}
      <div className="space-y-2">
        <h5 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Daily Remarks History ({dailyRemarks.length})
        </h5>
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {[...dailyRemarks].reverse().map((entry) => (
            <div
              key={entry.id}
              className="p-2.5 rounded-lg border border-border/80 bg-background/80 flex items-start gap-2.5 text-xs"
            >
              <div className="size-6 shrink-0 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300 font-bold text-[10px] flex items-center justify-center">
                {initials(entry.by)}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">{entry.by}</span>
                  <span className="text-[11px] text-muted-foreground">{formatDateTime(entry.at)}</span>
                </div>
                <p className="text-foreground/90 whitespace-pre-wrap break-words">{entry.text}</p>
              </div>
            </div>
          ))}
          {dailyRemarks.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-lg">
              No daily remarks logged yet. Use the form above to record today's update.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Notes({ bid, entries, readOnly, onRefresh }) {
  const [text, setText] = useState('')
  const [busy, run] = useSaving()
  const listRef = useRef(null)
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight }, [entries.length])
  const invalid = !text.trim() || text.length > MAX_TEXT

  const send = () => run(async () => {
    if (invalid) return
    const res = await addTechEvalNote(bid.id, text.trim())
    if (!res.ok) { toast.error(res.message || 'Could not add the note'); return }
    setText('')
    onRefresh()
  })

  return (
    <div className="rounded-xl border border-border bg-card flex flex-col h-full">
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
        <MessageSquare className="size-3.5 text-muted-foreground" />
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">General Notes</h4>
      </div>
      <div ref={listRef} className="p-3 space-y-3 max-h-72 overflow-y-auto flex-1" aria-live="polite">
        {entries.map((e) => (
          <div key={e.id} className={`flex gap-2.5 ${e.kind === 'OPEN' ? 'rounded-lg border border-teal-300 bg-teal-50/70 dark:bg-teal-950/30 dark:border-teal-900 p-2.5' : ''}`}>
            <div className="size-7 shrink-0 rounded-full bg-muted text-[10px] font-bold flex items-center justify-center" aria-hidden="true">{initials(e.by)}</div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">{e.by}</span> · {formatDateTime(e.at)}
                {e.kind === 'OPEN' && <span className={`${CHIP} ml-2 bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800`}>Opened</span>}
              </p>
              <p className="text-xs mt-0.5 whitespace-pre-wrap break-words">{e.text}</p>
            </div>
          </div>
        ))}
        {entries.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No general notes yet.</p>}
      </div>
      {!readOnly && (
        <div className="p-3 border-t border-border space-y-1.5">
          <Textarea
            aria-label="Add a note" value={text} onChange={(e) => setText(e.target.value)} className="text-xs min-h-[50px]" placeholder="Add a note about the technical evaluation… (Ctrl+Enter to send)"
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send() } }}
          />
          <div className="flex items-center justify-between">
            <TextCounter value={text} />
            <Button type="button" size="sm" variant="secondary" disabled={busy || invalid} onClick={send} className="gap-1.5 text-xs h-7"><Send className="size-3" /> Add note</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function DateHistory({ entries }) {
  return (
    <div className="rounded-xl border border-border bg-card h-full">
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
        <History className="size-3.5 text-muted-foreground" />
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Lifecycle Date History</h4>
      </div>
      <div className="p-3 space-y-2.5 max-h-96 overflow-y-auto">
        {[...entries].reverse().map((e) => (
          <div key={e.id} className="text-xs border-b border-border/60 pb-2.5 last:border-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{label(e.field)}</span>
              <span className={`${CHIP} ${CHANGE_STYLE[e.change] || CHANGE_STYLE.SET}`}>{CHANGE_LABEL[e.change] || 'Set'}</span>
            </div>
            <p className="mt-0.5">{e.from ? `${fmtYmd(e.from)} → ` : ''}<span className="font-medium">{e.to ? fmtYmd(e.to) : 'removed'}</span></p>
            <p className="text-[11px] text-muted-foreground">{e.by} · {formatDateTime(e.at)}</p>
            {e.kind === 'DATE' && e.text && <p className="text-[11px] mt-0.5 whitespace-pre-wrap break-words">Reason: {e.text}</p>}
          </div>
        ))}
        {entries.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No date changes yet.</p>}
      </div>
    </div>
  )
}

// The tracker at the top of the Technical Evaluation stage: dynamic dates, daily remarks, notes thread and date history.
export function TechEvalPanel({ bid, readOnly, onRefresh }) {
  const te = bid?.tech_eval || {}
  const dates = te.dates || {}
  const log = Array.isArray(te.log) ? te.log : []
  const [editing, setEditing] = useState(null)
  const [confirmRemove, setConfirmRemove] = useState(null)
  const notes = log.filter((e) => e.kind === 'OPEN' || e.kind === 'NOTE')
  const history = log.filter((e) => e.kind === 'OPEN' || e.kind === 'DATE')
  const extensions = (key) => log.filter((e) => e.kind === 'DATE' && e.field === key && e.change === 'EXTEND').length

  // Dynamic date fields: only fields that have a value set appear in activeFields
  const activeFields = getActiveTechEvalFields(dates)
  // Available standard fields not yet added
  const availableFields = getAvailableTechEvalFields(dates)

  const handleRemove = async (fieldKey) => {
    setConfirmRemove(null)
    const res = await setTechEvalDate(bid.id, { field: fieldKey, date: '', reason: 'Date field removed' })
    if (!res.ok) {
      toast.error(res.message || 'Could not remove date field')
      return
    }
    toast.success(`${label(fieldKey)} removed`)
    onRefresh()
  }

  return (
    <div className="space-y-4">
      {/* Dynamic Lifecycle Dates Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <CalendarClock className="size-4 text-teal-600 dark:text-teal-400" />
            Lifecycle Dates
          </h4>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-secondary-foreground border border-border">
            {activeFields.length} {activeFields.length === 1 ? 'date' : 'dates'} active
          </span>
        </div>
        {!readOnly && availableFields.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs border-teal-300 text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40">
                <Plus className="size-3.5" /> Add Date Field <ChevronDown className="size-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Select date field to add</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableFields.map((f) => (
                <DropdownMenuItem key={f.key} onClick={() => setEditing(f.key)} className="text-xs cursor-pointer gap-2 py-2">
                  <CalendarClock className="size-3.5 text-teal-600" />
                  <span>{f.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Dynamic Lifecycle Dates Cards or Empty State */}
      {activeFields.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center space-y-3">
          <div className="mx-auto size-10 rounded-full bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <CalendarClock className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">No lifecycle dates added</p>
            <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
              Date milestones are dynamic. Click "Add Date Field" to track dates for this tender (e.g. Bid Extension, Evaluation, Clarification, Reverse Auction).
            </p>
          </div>
          {!readOnly && availableFields.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="h-8 gap-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white">
                  <Plus className="size-3.5" /> Add Date Field <ChevronDown className="size-3 opacity-80" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Select date field to add</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {availableFields.map((f) => (
                  <DropdownMenuItem key={f.key} onClick={() => setEditing(f.key)} className="text-xs cursor-pointer gap-2 py-2">
                    <CalendarClock className="size-3.5 text-teal-600" />
                    <span>{f.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {activeFields.map((f) => {
            const value = dates[f.key]
            const chip = value && !readOnly ? dueChip(value) : null
            const ext = extensions(f.key)
            return (
              <div key={f.key} className="rounded-xl border border-border bg-card p-3 space-y-2 flex flex-col justify-between hover:border-teal-300 dark:hover:border-teal-800 transition-colors shadow-sm">
                <div>
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <CalendarClock className="size-3.5 text-teal-600" />
                      {f.label}
                    </p>
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mr-1 -mt-1"
                        title={`Remove ${f.label}`}
                        onClick={() => setConfirmRemove(f.key)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>
                  <p className="text-sm font-semibold mt-1">
                    {fmtYmd(value)}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 min-h-5 mt-1">
                    {chip && <span className={`${CHIP} ${DUE_STYLE[chip.state]}`}>{chip.text}</span>}
                    {ext > 0 && <span className={`${CHIP} ${CHANGE_STYLE.EXTEND}`}>Extended ×{ext}</span>}
                  </div>
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-1.5 pt-2 border-t border-border/50">
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditing(f.key)} className="h-7 gap-1 text-xs w-full">
                      <CalendarPlus className="size-3.5" /> Change date
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Daily Remark Update & Time-Bound Follow-up Tracker (BE -> AM flow) */}
      <DailyRemarksPanel bid={bid} readOnly={readOnly} onRefresh={onRefresh} />

      {/* Notes & Date History */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Notes bid={bid} entries={notes} readOnly={readOnly} onRefresh={onRefresh} />
        <DateHistory entries={history} />
      </div>

      {editing && (
        <DateDialog bid={bid} field={editing} current={dates[editing] || ''} onClose={() => setEditing(null)} onDone={() => { setEditing(null); onRefresh() }} />
      )}

      {confirmRemove && (
        <AlertDialog open onOpenChange={(open) => !open && setConfirmRemove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-sm font-bold">Remove {label(confirmRemove)}?</AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground">
                This will remove this milestone date from the Technical Evaluation lifecycle. The removal will be recorded in the date history, and you can re-add this field at any time.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-0">
              <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleRemove(confirmRemove)}
                className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove Date Field
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
