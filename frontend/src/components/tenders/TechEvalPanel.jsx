import { useEffect, useRef, useState } from 'react'
import { CalendarClock, CalendarPlus, History, MessageSquare, Send, Unlock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDateTime } from '../../lib/tenderFormat'
import { TECH_EVAL_FIELDS, addTechEvalNote, openTechEval, setTechEvalDate } from '../../services/techEval'

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

// Run an async save at most once at a time; the ref stops a double click or Enter before state re-renders.
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

// "Open Technical Evaluation" — the date it is set for, plus a remark. Used from Bid Submission.
export function OpenTechEvalDialog({ bid, onClose, onDone }) {
  const min = submittedDay(bid)
  const [date, setDate] = useState(localDay())
  const [remark, setRemark] = useState('')
  const [busy, run] = useSaving()
  const problem = !date ? 'Choose the technical evaluation date'
    : min && date < min ? 'The date cannot be before the bid was submitted'
      : !remark.trim() ? 'Write a remark'
        : remark.length > MAX_TEXT ? `Remark can be at most ${MAX_TEXT} characters` : ''

  const submit = () => run(async () => {
    if (problem) { toast.error(problem); return }
    const res = await openTechEval(bid.id, { date, remark: remark.trim() })
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
            Choose the technical evaluation date and leave a remark. The Account Manager, Reporting Manager and Pre-Sales are told by email.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="te-open-date" className="text-xs font-medium">Technical Evaluation open date *</Label>
            <div className="flex gap-2">
              <Input id="te-open-date" type="date" min={min || undefined} value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-xs" />
              <Button type="button" variant="outline" size="sm" onClick={() => setDate(localDay())} className="text-xs h-9">Open today</Button>
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

// Set, extend, move or clear one of the four dates. A reason is required once a date exists.
function DateDialog({ bid, field, current, onClose, onDone }) {
  const min = submittedDay(bid)
  const [date, setDate] = useState(current || '')
  const [reason, setReason] = useState('')
  const [busy, run] = useSaving()
  const changing = !!current
  const clearing = changing && !date
  const problem = date === current ? 'Pick a different date'
    : date && min && date < min ? 'The date cannot be before the bid was submitted'
      : changing && !reason.trim() ? 'A reason is required to change a date'
        : reason.length > MAX_TEXT ? `Reason can be at most ${MAX_TEXT} characters` : ''

  const submit = () => run(async () => {
    if (problem) { toast.error(problem); return }
    const res = await setTechEvalDate(bid.id, { field, date, reason: reason.trim() })
    if (!res.ok) { toast.error(res.message || 'Could not save the date'); if (res.status === 409) onDone(); return }
    toast.success(clearing ? 'Date cleared' : 'Date saved')
    onDone()
  })

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">{changing ? 'Change' : 'Set'} {label(field)}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {changing ? `Currently ${fmtYmd(current)}. Extensions are kept in the date history.` : 'The Account Manager, Reporting Manager and Pre-Sales are told by email, and again the day before.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="te-date" className="text-xs font-medium">Date</Label>
            <div className="flex gap-2">
              <Input id="te-date" type="date" min={min || undefined} value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-xs" />
              {changing && <Button type="button" variant="outline" size="sm" onClick={() => setDate('')} className="text-xs h-9">Clear</Button>}
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="te-reason" className="text-xs font-medium">{changing ? 'Reason *' : 'Remark (optional)'}</Label>
              <TextCounter value={reason} />
            </div>
            <Textarea id="te-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="text-xs min-h-[70px]" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose} className="text-xs">Cancel</Button>
          <Button type="button" size="sm" disabled={busy || !!problem} title={problem} onClick={submit} className="text-xs bg-teal-600 hover:bg-teal-700 text-white">
            {clearing ? 'Clear date' : 'Save date'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    <div className="rounded-xl border border-border bg-card flex flex-col">
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
        <MessageSquare className="size-3.5 text-muted-foreground" />
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes</h4>
      </div>
      <div ref={listRef} className="p-3 space-y-3 max-h-80 overflow-y-auto" aria-live="polite">
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
        {entries.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No notes yet.</p>}
      </div>
      {!readOnly && (
        <div className="p-3 border-t border-border space-y-1.5">
          <Textarea
            aria-label="Add a note" value={text} onChange={(e) => setText(e.target.value)} className="text-xs min-h-[60px]" placeholder="Add a note about the technical evaluation… (Ctrl+Enter to send)"
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send() } }}
          />
          <div className="flex items-center justify-between">
            <TextCounter value={text} />
            <Button type="button" size="sm" variant="secondary" disabled={busy || invalid} onClick={send} className="gap-1.5 text-xs h-8"><Send className="size-3.5" /> Add note</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function DateHistory({ entries }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
        <History className="size-3.5 text-muted-foreground" />
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Date history</h4>
      </div>
      <div className="p-3 space-y-2.5 max-h-80 overflow-y-auto">
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

// The tracker at the top of the Technical Evaluation stage: four dates, notes thread and date history.
// readOnly once the result is recorded or the tender has ended (the server refuses writes then too).
export function TechEvalPanel({ bid, readOnly, onRefresh }) {
  const te = bid?.tech_eval || {}
  const dates = te.dates || {}
  const log = Array.isArray(te.log) ? te.log : []
  const [editing, setEditing] = useState(null)
  const notes = log.filter((e) => e.kind === 'OPEN' || e.kind === 'NOTE')
  const history = log.filter((e) => e.kind === 'OPEN' || e.kind === 'DATE')
  const extensions = (key) => log.filter((e) => e.kind === 'DATE' && e.field === key && e.change === 'EXTEND').length

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {TECH_EVAL_FIELDS.map((f) => {
          const value = dates[f.key]
          const chip = value && !readOnly ? dueChip(value) : null
          const ext = extensions(f.key)
          return (
            <div key={f.key} className="rounded-xl border border-border bg-card p-3 space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><CalendarClock className="size-3.5" />{f.label}</p>
              <p className="text-sm font-semibold">{value ? fmtYmd(value) : <span className="text-muted-foreground font-normal">Not set</span>}</p>
              <div className="flex flex-wrap items-center gap-1.5 min-h-5">
                {chip && <span className={`${CHIP} ${DUE_STYLE[chip.state]}`}>{chip.text}</span>}
                {ext > 0 && <span className={`${CHIP} ${CHANGE_STYLE.EXTEND}`}>Extended ×{ext}</span>}
              </div>
              {!readOnly && (
                <Button type="button" variant="outline" size="sm" onClick={() => setEditing(f.key)} className="h-7 gap-1 text-xs">
                  <CalendarPlus className="size-3.5" /> {value ? 'Change date' : 'Set date'}
                </Button>
              )}
            </div>
          )
        })}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Notes bid={bid} entries={notes} readOnly={readOnly} onRefresh={onRefresh} />
        <DateHistory entries={history} />
      </div>
      {editing && (
        <DateDialog bid={bid} field={editing} current={dates[editing] || ''} onClose={() => setEditing(null)} onDone={() => { setEditing(null); onRefresh() }} />
      )}
    </div>
  )
}
