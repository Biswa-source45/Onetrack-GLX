import { useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, FileText, Plus, Send, Upload, X, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { uploadShortfallDoc, openShortfallDoc } from '../../services/bids'
import { formatDateTime } from '../../lib/tenderFormat'
import {
  OUTCOME_LABEL, ROUND_STATUS_LABEL, approverChoices, docCounts, dueState, newDoc, patchRound, readyForApproval, shortfallRounds, validateRaise,
} from '../../lib/docShortfall'

const STATUS_STYLE = {
  COLLECTING: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  PENDING_APPROVAL: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800',
  APPROVED: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
  SUBMITTED: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700',
}
const DUE_STYLE = {
  overdue: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
  soon: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800',
  ok: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
}
const CHIP = 'px-2.5 py-0.5 rounded-full text-[11px] font-semibold border'
const FILE_TYPES = 'application/pdf,image/jpeg,image/png,image/webp'
// Alert messages are HTML, so anything typed by a person goes through this.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// One short text field in a dialog (a reason, or remarks).
function ReasonDialog({ title, description, label, confirmLabel, danger, busy, onConfirm, onClose }) {
  const [text, setText] = useState('')
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">{title}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 py-2">
          <Label htmlFor="shortfall-reason" className="text-xs font-medium">{label} *</Label>
          <Textarea id="shortfall-reason" value={text} onChange={(e) => setText(e.target.value)} className="text-xs min-h-[80px]" autoFocus />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose} className="text-xs">Cancel</Button>
          <Button type="button" size="sm" variant={danger ? 'destructive' : 'default'} disabled={busy || !text.trim()} onClick={() => onConfirm(text.trim())} className="text-xs">
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// The customer asked for documents: the deadline they gave and what they want.
export function RaiseShortfallDialog({ busy, onRaise, onClose }) {
  const [deadline, setDeadline] = useState('')
  const [note, setNote] = useState('')
  const [docs, setDocs] = useState([{ name: '', note: '' }])
  const [errors, setErrors] = useState({})
  const setDoc = (i, k, v) => setDocs((d) => d.map((row, j) => (j === i ? { ...row, [k]: v } : row)))

  const submit = () => {
    const e = validateRaise({ deadline, docs })
    setErrors(e)
    if (Object.keys(e).length === 0) onRaise({ deadline, note, docs })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">Document shortfall requested</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            The customer gave a time to submit missing documents instead of disqualifying us. Record the deadline and what they asked for.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="shortfall-deadline" className="text-xs font-medium">Submit documents by *</Label>
            <Input id="shortfall-deadline" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="h-9 text-xs" />
            {errors.deadline && <p role="alert" className="text-xs text-destructive">{errors.deadline}</p>}
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Documents the customer asked for *</Label>
            {docs.map((d, i) => (
              <div key={i} className="grid grid-cols-[1.2fr_1fr_auto] gap-2 items-center">
                <Input aria-label="Document name" placeholder="e.g. ISO 9001 certificate" value={d.name} onChange={(e) => setDoc(i, 'name', e.target.value)} className="h-8 text-xs" />
                <Input aria-label="Document note" placeholder="Note (optional)" value={d.note} onChange={(e) => setDoc(i, 'note', e.target.value)} className="h-8 text-xs" />
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove document" onClick={() => setDocs((all) => (all.length > 1 ? all.filter((_, j) => j !== i) : [{ name: '', note: '' }]))} className="size-7 text-muted-foreground hover:text-destructive">
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setDocs((all) => [...all, { name: '', note: '' }])} className="h-7 gap-1 text-xs">
              <Plus className="size-3.5" /> Add another document
            </Button>
            {errors.docs && <p role="alert" className="text-xs text-destructive">{errors.docs}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shortfall-note" className="text-xs font-medium">Customer's message (optional)</Label>
            <Textarea id="shortfall-note" value={note} onChange={(e) => setNote(e.target.value)} className="text-xs min-h-[60px]" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose} className="text-xs">Cancel</Button>
          <Button type="button" size="sm" disabled={busy} onClick={submit} className="gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white">
            <AlertTriangle className="size-3.5" /> Start document shortfall
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// The round being worked on: collect the documents, get them approved, send them to the customer.
// onSave(nextDocShortfall, { ok, log, notify }) persists and resolves true on success.
export function ShortfallPanel({ bid, round, busy, user, isAdmin, onSave, onLost }) {
  const ds = bid.doc_shortfall
  const choices = approverChoices(bid)
  const [approverId, setApproverId] = useState(choices[0]?.id || '')
  const [uploadingId, setUploadingId] = useState('')
  const uploading = useRef(false) // set synchronously, unlike state, so two quick uploads cannot start from the same copy
  const [extraName, setExtraName] = useState('')
  const [dialog, setDialog] = useState('') // 'sendBack' | 'sent' | 'lost'
  const actor = user?.full_name || user?.username || ''
  const now = () => new Date().toISOString()
  const editable = round.status === 'COLLECTING'
  const counts = docCounts(round)
  const due = dueState(round.deadline)
  const canDecide = isAdmin || (!!user?.id && user.id === round.approverId)
  const tell = (title, text, ids, type = 'INFO') => ({ ids, title, type, html: `<p>${text}</p>` })
  const save = (patch, opts) => onSave(patchRound(ds, round.n, patch), opts)

  const upload = async (doc, file) => {
    if (!file) return
    if (uploading.current) { toast.error('Wait for the previous upload to finish'); return }
    uploading.current = true
    setUploadingId(doc.id)
    try {
      const res = await uploadShortfallDoc(bid.id, file)
      if (!res.ok) { toast.error(res.message || 'Upload failed'); return }
      const file_ = { name: file.name, url: res.data.url, uploadedAt: now() }
      await save({ docs: round.docs.map((d) => (d.id === doc.id ? { ...d, file: file_, addedBy: actor, addedAt: file_.uploadedAt } : d)) },
        { ok: `${doc.name} added`, log: `Document shortfall round ${round.n}: ${actor} added "${doc.name}" (${file.name})` })
    } finally { uploading.current = false; setUploadingId('') }
  }
  const open = (doc) => openShortfallDoc(bid.id, doc.file?.url).catch(() => toast.error('Could not open the document'))

  const submitForApproval = () => {
    const pick = choices.find((c) => c.id === approverId)
    if (!pick) { toast.error('Choose who should approve'); return }
    return save({
      status: 'PENDING_APPROVAL', approverId: pick.id, approverName: pick.name, approverRole: pick.role,
      approvalRequestedAt: now(), approvalRequestedById: user?.id, approvalRequestedByName: actor, rejection: null,
    }, {
      ok: `Sent to ${pick.name} for approval`, log: `Document shortfall round ${round.n}: documents sent to ${pick.name} (${pick.role}) for approval`,
      notify: tell(`Approve shortfall documents: ${bid.title}`, `${esc(actor)} added the documents the customer asked for on <strong>${esc(bid.title)}</strong> (due ${formatDateTime(round.deadline)}). Please review and approve them.`, [pick.id], 'ACTION_REQUIRED'),
    })
  }
  const approve = () => save({ status: 'APPROVED', approvedAt: now(), approvedBy: actor, approvedById: user?.id }, {
    ok: 'Documents approved', log: `Document shortfall round ${round.n}: documents approved by ${actor}`,
    notify: tell(`Shortfall documents approved: ${bid.title}`, `${esc(actor)} approved the documents for <strong>${esc(bid.title)}</strong>. You can now send them to the customer.`, [round.raisedById, round.approvalRequestedById]),
  })
  const sendBack = async (reason) => {
    if (await save({ status: 'COLLECTING', rejection: { reason, by: actor, byId: user?.id, at: now() } }, {
      ok: 'Sent back for changes', log: `Document shortfall round ${round.n}: sent back by ${actor}: ${reason}`,
      notify: tell(`Shortfall documents sent back: ${bid.title}`, `${esc(actor)} sent the documents for <strong>${esc(bid.title)}</strong> back: ${esc(reason)}`, [round.approvalRequestedById, round.raisedById], 'ACTION_REQUIRED'),
    })) setDialog('')
  }
  const withdraw = () => save({ status: 'COLLECTING' }, { ok: 'Request withdrawn', log: `Document shortfall round ${round.n}: approval request withdrawn by ${actor}` })
  const sent = async (remarks) => {
    if (await save({ status: 'SUBMITTED', respondedAt: now(), respondedBy: actor, responseRemarks: remarks }, {
      ok: 'Marked as sent to the customer', log: `Document shortfall round ${round.n}: documents sent to the customer by ${actor} (${remarks})`,
      notify: tell(`Shortfall documents sent: ${bid.title}`, `${esc(actor)} sent the shortfall documents for <strong>${esc(bid.title)}</strong> to the customer. Waiting for the technical re-evaluation.`, [round.approvalRequestedById, round.approverId]),
    })) setDialog('')
  }
  const lost = async (reason) => { if (await onLost(reason)) setDialog('') }

  return (
    <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/40 dark:bg-amber-950/10 dark:border-amber-900/60 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h4 className="text-sm font-bold text-amber-900 dark:text-amber-300">Document shortfall · round {round.n}</h4>
          <p className="text-xs text-muted-foreground">Raised by {round.raisedBy} · {formatDateTime(round.raisedAt)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`${CHIP} ${STATUS_STYLE[round.status]}`}>{ROUND_STATUS_LABEL[round.status]}</span>
          <span className={`${CHIP} ${DUE_STYLE[due.state]} flex items-center gap-1`}><Clock className="size-3" /> Due {formatDateTime(round.deadline)}{due.label ? ` · ${due.label}` : ''}</span>
        </div>
      </div>
      {round.note && <p className="text-xs text-foreground bg-background/60 border border-border rounded-lg p-2.5">“{round.note}”</p>}
      {round.rejection && round.status === 'COLLECTING' && (
        <p role="alert" className="text-xs text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg p-2.5">
          Sent back by {round.rejection.by}: {round.rejection.reason}
        </p>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">Documents ({counts.added} of {counts.total} added)</p>
        {round.docs.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-3 flex-wrap rounded-lg border border-border bg-card p-2.5">
            <div className="flex items-center gap-2 min-w-0">
              {d.file ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" /> : <FileText className="size-4 shrink-0 text-muted-foreground" />}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">{d.name}</p>
                {d.note && <p className="text-[11px] text-muted-foreground">{d.note}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {d.file && (
                <button type="button" onClick={() => open(d)} className="flex items-center gap-1 text-[11px] text-primary hover:underline max-w-[220px]">
                  <ExternalLink className="size-3 shrink-0" /> <span className="truncate">{d.file.name}</span>
                </button>
              )}
              {editable && (
                <label className={`inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium cursor-pointer hover:bg-muted ${busy || uploadingId ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Upload className="size-3" /> {uploadingId === d.id ? 'Uploading…' : d.file ? 'Replace' : 'Upload'}
                  <input type="file" className="sr-only" aria-label={`Upload ${d.name}`} accept={FILE_TYPES} disabled={busy || !!uploadingId}
                    onChange={(e) => { upload(d, e.target.files?.[0]); e.target.value = '' }} />
                </label>
              )}
              {editable && d.extra && (
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${d.name}`} disabled={busy}
                  onClick={() => save({ docs: round.docs.filter((x) => x.id !== d.id) })} className="size-7 text-muted-foreground hover:text-destructive">
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
        {editable && (
          <div className="flex items-center gap-2">
            <Input aria-label="Extra document name" placeholder="Another document to add" value={extraName} onChange={(e) => setExtraName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && extraName.trim()) { save({ docs: [...round.docs, newDoc(extraName)] }); setExtraName('') } }} className="h-8 text-xs max-w-xs" />
            <Button type="button" variant="outline" size="sm" disabled={busy || !extraName.trim()} onClick={() => { save({ docs: [...round.docs, newDoc(extraName)] }); setExtraName('') }} className="h-8 gap-1 text-xs">
              <Plus className="size-3.5" /> Add
            </Button>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">PDF or image (JPEG, PNG, WebP), up to 10 MB each.</p>
      </div>

      {round.status === 'COLLECTING' && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs font-semibold text-foreground">Approval</p>
          {choices.length === 0 ? (
            <p className="text-xs text-destructive">This tender has no Reporting Manager, Account Manager or Bid Owner to approve the documents.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {choices.map((c) => (
                <label key={c.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="radio" name="shortfall-approver" checked={approverId === c.id} onChange={() => setApproverId(c.id)} />
                  <span><span className="font-semibold">{c.name}</span> <span className="text-muted-foreground">· {c.role}</span></span>
                </label>
              ))}
            </div>
          )}
          <span title={readyForApproval(round) ? undefined : 'Add every document first'}>
            <Button size="sm" disabled={busy || !readyForApproval(round) || !approverId} onClick={submitForApproval} className="gap-1.5 text-xs">
              <Send className="size-3.5" /> Send for approval
            </Button>
          </span>
        </div>
      )}

      {round.status === 'PENDING_APPROVAL' && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            Waiting for <span className="font-semibold text-foreground">{round.approverName}</span> ({round.approverRole}) to approve · requested by {round.approvalRequestedByName} · {formatDateTime(round.approvalRequestedAt)}
          </p>
          <div className="flex gap-2 flex-wrap">
            {canDecide && (
              <>
                <Button size="sm" disabled={busy} onClick={approve} className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"><CheckCircle2 className="size-3.5" /> Approve documents</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setDialog('sendBack')} className="gap-1.5 text-xs">Send back</Button>
              </>
            )}
            {!canDecide && <Button size="sm" variant="outline" disabled={busy} onClick={withdraw} className="text-xs">Withdraw request</Button>}
          </div>
        </div>
      )}

      {round.status === 'APPROVED' && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5" /> Approved by {round.approvedBy} · {formatDateTime(round.approvedAt)}
          </p>
          <Button size="sm" disabled={busy} onClick={() => setDialog('sent')} className="gap-1.5 text-xs bg-sky-600 hover:bg-sky-700 text-white">
            <Send className="size-3.5" /> Mark documents sent to customer
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap border-t border-border pt-3">
        <p className="text-[11px] text-muted-foreground">Cannot get the documents? Close this and record the bid as lost.</p>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setDialog('lost')} className="gap-1.5 text-xs border-rose-300 text-rose-700 hover:bg-rose-50 dark:text-rose-400">
          <XCircle className="size-3.5" /> Cannot provide, mark bid Lost
        </Button>
      </div>

      {dialog === 'sendBack' && <ReasonDialog title="Send documents back" description="Tell the team what to fix. They are alerted and the round returns to collecting documents." label="What needs to change" confirmLabel="Send back" busy={busy} onConfirm={sendBack} onClose={() => setDialog('')} />}
      {dialog === 'sent' && <ReasonDialog title="Documents sent to the customer" description="Confirm the approved documents were submitted to the customer. The technical evaluation result can then be recorded." label="How and where they were sent" confirmLabel="Confirm sent" busy={busy} onConfirm={sent} onClose={() => setDialog('')} />}
      {dialog === 'lost' && <ReasonDialog title="Mark bid as Lost" description="We cannot provide the missing documents. The bid is closed as lost (disqualified) and this is kept in the shortfall history." label="Reason" confirmLabel="Mark bid Lost" danger busy={busy} onConfirm={lost} onClose={() => setDialog('')} />}
    </div>
  )
}

// Every shortfall round: what was asked, who approved it, when it was sent, and how the re-evaluation went.
export function ShortfallHistory({ ds }) {
  const rounds = shortfallRounds(ds)
  if (!rounds.length) return null
  const result = (r) => (r.outcome
    ? { text: OUTCOME_LABEL[r.outcome] || r.outcome, cls: r.outcome === 'QUALIFIED' ? 'text-emerald-700 dark:text-emerald-400' : r.outcome === 'DISQUALIFIED' ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400' }
    : { text: r.status === 'SUBMITTED' ? 'Awaiting re-evaluation' : 'In progress', cls: 'text-muted-foreground' })
  return (
    <div className="rounded-xl border border-border bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Round</TableHead>
            <TableHead className="text-xs">Shortfall raised</TableHead>
            <TableHead className="text-xs">Deadline</TableHead>
            <TableHead className="text-xs">Documents</TableHead>
            <TableHead className="text-xs">Approval</TableHead>
            <TableHead className="text-xs">Sent to customer</TableHead>
            <TableHead className="text-xs">Re-evaluation result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rounds.map((r) => {
            const res = result(r)
            return (
              <TableRow key={r.n} data-testid={`shortfall-round-${r.n}`}>
                <TableCell className="text-xs font-semibold">#{r.n}</TableCell>
                <TableCell className="text-xs">{formatDateTime(r.raisedAt)}<br /><span className="text-muted-foreground">{r.raisedBy}</span></TableCell>
                <TableCell className="text-xs">{formatDateTime(r.deadline)}</TableCell>
                <TableCell className="text-xs">
                  {r.docs.map((d) => (
                    <div key={d.id} className="flex items-center gap-1">
                      {d.file ? <CheckCircle2 className="size-3 text-emerald-600 shrink-0" /> : <span className="size-3 rounded-full border border-muted-foreground/50 shrink-0" />}
                      <span>{d.name}</span>
                    </div>
                  ))}
                </TableCell>
                <TableCell className="text-xs">
                  {r.approvedAt ? <>{r.approvedBy}<br /><span className="text-muted-foreground">{formatDateTime(r.approvedAt)}</span></>
                    : r.status === 'PENDING_APPROVAL' ? <span className="text-orange-700 dark:text-orange-400">Waiting for {r.approverName}</span> : '—'}
                </TableCell>
                <TableCell className="text-xs">{r.respondedAt ? <>{formatDateTime(r.respondedAt)}<br /><span className="text-muted-foreground">{r.respondedBy}</span></> : '—'}</TableCell>
                <TableCell className={`text-xs font-semibold ${res.cls}`}>{res.text}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

// Overview card: shown once a document shortfall has been raised.
export function ShortfallHistoryCard({ bid }) {
  const ds = bid?.doc_shortfall
  if (!shortfallRounds(ds).length) return null
  return (
    <div className="rounded-lg border border-border p-4 space-y-3 bg-card shadow-sm">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Document Shortfall History</p>
      <ShortfallHistory ds={ds} />
    </div>
  )
}
