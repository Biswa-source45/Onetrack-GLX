import { useEffect, useRef, useState } from 'react'
import { Ban, Mail, Pencil, Phone, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { usePermissions } from '../../hooks/usePermissions'
import { getBid } from '../../services/bids'
import { addContact, updateContact, deleteContact, reorderContacts } from '../../services/contacts'
import { KINDS, applyPlan, blankContact, cleanContact, contactsSignature, findDuplicate, groupContacts, kindLabel, oemRowContacts, planDrop, sourceLabel, validateContact } from '../../lib/contacts'
import { ReasonDialog } from './DocShortfall'

const FIELDS = [
  ['name', 'Name *', 'Full name'], ['org', 'Organisation', 'Company / department'], ['designation', 'Designation', 'Role or title'],
  ['phone', 'Phone', '+91 98765 43210'], ['email', 'Email', 'name@company.com'],
]

// Add / edit one contact. `onSave` gets the trimmed contact and resolves true when it was saved.
function ContactDialog({ initial, all, busy, fixedKind, onSave, onClose }) {
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState({})
  const editing = !!initial.id

  const submit = () => {
    const e = validateContact(form)
    const dup = findDuplicate(all, form, initial.id)
    if (dup) e[cleanContact(form).email && cleanContact(form).email === String(dup.email).toLowerCase() ? 'email' : 'phone'] = `${dup.name} is already listed under ${kindLabel(dup.kind)}`
    setErrors(e)
    if (Object.keys(e).length === 0) onSave(cleanContact(form))
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">{editing ? 'Edit contact' : 'Add contact'}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">One person is listed once per tender: the same email or phone number cannot be added twice.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2" onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') submit() }}>
          {!fixedKind && (
            <div className="space-y-1.5">
              <Label htmlFor="contact-kind" className="text-xs font-medium">Type</Label>
              <select id="contact-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs">
                {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
              </select>
            </div>
          )}
          {FIELDS.map(([key, label, ph]) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`contact-${key}`} className="text-xs font-medium">{label}</Label>
              <Input id={`contact-${key}`} value={form[key]} placeholder={ph} autoFocus={key === 'name'} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="h-9 text-xs" />
              {errors[key] && <p role="alert" className="text-xs text-destructive">{errors[key]}</p>}
            </div>
          ))}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="contact-notes" className="text-xs font-medium">Notes</Label>
            <Textarea id="contact-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="text-xs min-h-[60px]" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose} className="text-xs">Cancel</Button>
          <Button type="button" size="sm" disabled={busy} onClick={submit} className="text-xs">{editing ? 'Save changes' : 'Add contact'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ContactLines({ c }) {
  return (
    <>
      {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><Phone className="size-3 shrink-0" /><span className="truncate">{c.phone}</span></a>}
      {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><Mail className="size-3 shrink-0" /><span className="truncate">{c.email}</span></a>}
    </>
  )
}

// Read-only list grouped by type: the Bid Submission stage shows this once the bid is submitted.
export function ContactsSummary({ contacts }) {
  const cols = groupContacts(contacts)
  if (!(contacts || []).length) return <p className="text-xs text-muted-foreground">No contacts have been added to this tender yet.</p>
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {KINDS.map(({ key, label }) => (
        <div key={key} className="rounded-lg border border-border bg-card p-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">{label}</p>
          {cols[key].length === 0 ? <p className="text-xs text-muted-foreground">None</p> : cols[key].map((c) => (
            <div key={c.id} className={`text-xs space-y-0.5 ${c.banned ? 'opacity-60' : ''}`}>
              <p className={`font-medium text-foreground ${c.banned ? 'line-through' : ''}`}>{c.name}{c.org ? <span className="font-normal text-muted-foreground"> · {c.org}</span> : null}{c.banned ? <span className="font-normal text-destructive"> · banned</span> : null}</p>
              <ContactLines c={c} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// The contact cell of one OEM Authorization row: the contacts typed for that OEM, in the same list as the
// Contacts tab (so they are edited, moved and banned there), plus a button to add one.
export function OemContactCell({ bid, row, onRefresh }) {
  const { hasPermission } = usePermissions()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const mine = oemRowContacts(bid.contacts, row.id)

  const save = async (c) => {
    setBusy(true)
    try {
      const res = await addContact(bid.id, { kind: 'OEM', name: c.name, org: c.org, designation: c.designation, phone: c.phone, email: c.email, notes: c.notes, source: 'OEM_AUTH', source_ref: row.id })
      if (!res.ok) { toast.error(res.message || 'Could not add the contact'); return }
      toast.success('Contact added')
      setOpen(false)
      await onRefresh?.()
    } catch { toast.error('Network error') } finally { setBusy(false) }
  }

  return (
    <div className="space-y-1 text-xs" data-testid={`oem-contacts-${row.name}`}>
      {mine.length === 0 && <p className="text-muted-foreground">—</p>}
      {mine.map((c) => (
        <div key={c.id} className={c.banned ? 'opacity-60' : ''}>
          <p className={`font-semibold text-foreground ${c.banned ? 'line-through' : ''}`}>{c.name}</p>
          <ContactLines c={c} />
        </div>
      ))}
      <div className="flex items-center gap-2 flex-wrap">
        {hasPermission('bid.edit') && (
          <Button type="button" variant="outline" size="sm" aria-label={`Add contact for ${row.name}`} onClick={() => setOpen(true)} className="h-6 gap-1 px-2 text-[11px]"><Plus className="size-3" /> Contact</Button>
        )}
        {mine.length > 0 && <Link to={{ search: '?tab=contacts' }} className="text-[11px] text-primary hover:underline">Manage</Link>}
      </div>
      {open && <ContactDialog initial={{ ...blankContact('OEM'), org: row.name }} all={bid.contacts || []} busy={busy} fixedKind onSave={save} onClose={() => setOpen(false)} />}
    </div>
  )
}

export function ContactsTab({ bid, onRefresh }) {
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission('bid.edit')
  // What is shown is the tender's contacts; while a drop is being saved it is the moved order instead.
  const [moved, setMoved] = useState(null)
  const list = moved ?? (bid.contacts || [])
  const [query, setQuery] = useState('')
  const [drag, setDrag] = useState(null)   // id being dragged
  const [over, setOver] = useState(null)   // { kind, beforeId } the drop would land on
  const [dialog, setDialog] = useState(null) // { mode: 'form' | 'ban' | 'delete', contact }
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const sigRef = useRef('')
  useEffect(() => { sigRef.current = contactsSignature(bid.contacts) })

  // Another person may change the contacts: look again when this window regains focus and every
  // 30 seconds, and reload only when something differs (a failed look is ignored).
  useEffect(() => {
    const check = async () => {
      if (document.hidden || busyRef.current) return
      try {
        const res = await getBid(bid.id)
        if (res.ok && contactsSignature(res.data?.contacts) !== sigRef.current && !busyRef.current) onRefresh()
      } catch { /* next time */ }
    }
    const timer = setInterval(check, 30000)
    window.addEventListener('focus', check)
    return () => { clearInterval(timer); window.removeEventListener('focus', check) }
  }, [bid.id, onRefresh])

  const run = async (fn, okMsg) => {
    busyRef.current = true
    setBusy(true)
    try {
      const res = await fn()
      if (!res.ok) { toast.error(res.message || 'Could not save the change'); return false }
      if (okMsg) toast.success(okMsg)
      await onRefresh()
      return true
    } catch { toast.error('Network error'); return false } finally { busyRef.current = false; setBusy(false) }
  }

  // Drag and drop (and the "Move to" menu): shown at once, then saved; a failure puts it back.
  const place = async (id, kind, beforeId = null) => {
    const items = planDrop(list, id, kind, beforeId)
    if (!items.length) return
    setMoved(applyPlan(list, items))
    await run(() => reorderContacts(bid.id, items))
    setMoved(null)
  }
  const drop = (kind, beforeId) => { const id = drag; setDrag(null); setOver(null); if (id) place(id, kind, beforeId) }

  const q = query.trim().toLowerCase()
  const shown = (c) => !q || [c.name, c.org, c.designation, c.phone, c.email, c.notes, sourceLabel(c)].join(' ').toLowerCase().includes(q)
  const cols = groupContacts(list)

  const save = async (c) => {
    const fields = { kind: c.kind, name: c.name, org: c.org, designation: c.designation, phone: c.phone, email: c.email, notes: c.notes }
    const ok = c.id ? await run(() => updateContact(bid.id, c.id, fields), 'Contact updated') : await run(() => addContact(bid.id, fields), 'Contact added')
    if (ok) setDialog(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input aria-label="Search contacts" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search contacts" className="h-8 pl-8 text-xs" />
        </div>
        <p className="text-xs text-muted-foreground">{canEdit ? 'Drag a card to another type to move it, or use its "Move to" menu.' : 'You can view contacts but not change them.'}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {KINDS.map(({ key, label, hint }) => {
          const visible = cols[key].filter(shown)
          return (
            <section key={key} data-testid={`contacts-col-${key}`} aria-label={`${label} contacts`}
              onDragOver={(e) => { if (drag) { e.preventDefault(); setOver({ kind: key, beforeId: null }) } }}
              onDrop={(e) => { e.preventDefault(); drop(key, null) }}
              className={`rounded-xl border p-3 space-y-3 bg-muted/20 min-h-40 ${over?.kind === key && !over.beforeId ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{label} <span className="text-xs font-normal text-muted-foreground">({cols[key].length})</span></h4>
                  <p className="text-[11px] text-muted-foreground">{hint}</p>
                </div>
                {canEdit && (
                  <Button type="button" size="sm" variant="outline" aria-label={`Add ${label} contact`} disabled={busy} onClick={() => setDialog({ mode: 'form', contact: blankContact(key) })} className="h-7 gap-1 text-xs">
                    <Plus className="size-3.5" /> Add
                  </Button>
                )}
              </div>
              {visible.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">{q ? 'No match' : 'No contacts yet'}</p>}
              {visible.map((c) => (
                <article key={c.id} data-testid={`contact-card-${c.name}`} draggable={canEdit && !busy}
                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; setDrag(c.id) }}
                  onDragEnd={() => { setDrag(null); setOver(null) }}
                  onDragOver={(e) => { if (drag) { e.preventDefault(); e.stopPropagation(); setOver({ kind: key, beforeId: c.id }) } }}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); drop(key, c.id) }}
                  className={`rounded-lg border bg-card p-3 space-y-1.5 ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''} ${c.banned ? 'opacity-60 border-destructive/40' : 'border-border'} ${drag === c.id ? 'opacity-40' : ''} ${over?.beforeId === c.id ? 'border-t-2 border-t-primary' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold text-foreground break-words ${c.banned ? 'line-through' : ''}`}>{c.name}</p>
                      {(c.designation || c.org) && <p className="text-xs text-muted-foreground break-words">{[c.designation, c.org].filter(Boolean).join(' · ')}</p>}
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0">
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Edit ${c.name}`} disabled={busy} onClick={() => setDialog({ mode: 'form', contact: { ...c } })} className="size-7"><Pencil className="size-3.5" /></Button>
                        {c.banned
                          ? <Button type="button" variant="ghost" size="icon-sm" aria-label={`Un-ban ${c.name}`} disabled={busy} onClick={() => run(() => updateContact(bid.id, c.id, { banned: false }), 'Contact un-banned')} className="size-7"><RotateCcw className="size-3.5" /></Button>
                          : <Button type="button" variant="ghost" size="icon-sm" aria-label={`Ban ${c.name}`} disabled={busy} onClick={() => setDialog({ mode: 'ban', contact: c })} className="size-7"><Ban className="size-3.5" /></Button>}
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Delete ${c.name}`} disabled={busy} onClick={() => setDialog({ mode: 'delete', contact: c })} className="size-7 hover:text-destructive"><Trash2 className="size-3.5" /></Button>
                      </div>
                    )}
                  </div>
                  <ContactLines c={c} />
                  {c.notes && <p className="text-xs text-muted-foreground whitespace-pre-line break-words">{c.notes}</p>}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {sourceLabel(c) && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800">{sourceLabel(c)}</span>}
                    {c.banned && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800">Banned</span>}
                  </div>
                  {c.banned && c.banned_reason && <p className="text-[11px] text-destructive break-words">Do not use: {c.banned_reason}</p>}
                  {canEdit && (
                    <select aria-label={`Move ${c.name} to`} value="" disabled={busy} onChange={(e) => e.target.value && place(c.id, e.target.value)} className="h-7 w-full rounded-md border border-input bg-background px-1.5 text-[11px] text-muted-foreground">
                      <option value="">Move to…</option>
                      {KINDS.filter((k) => k.key !== c.kind).map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
                    </select>
                  )}
                </article>
              ))}
            </section>
          )
        })}
      </div>

      {dialog?.mode === 'form' && <ContactDialog initial={dialog.contact} all={list} busy={busy} onSave={save} onClose={() => setDialog(null)} />}
      {dialog?.mode === 'ban' && (
        <ReasonDialog title={`Ban ${dialog.contact.name}`} description="The contact stays on the list, greyed out and marked do not use. You can un-ban them later." label="Reason" confirmLabel="Ban contact" danger busy={busy}
          onConfirm={async (reason) => { if (await run(() => updateContact(bid.id, dialog.contact.id, { banned: true, banned_reason: reason }), 'Contact banned')) setDialog(null) }} onClose={() => setDialog(null)} />
      )}
      {dialog?.mode === 'delete' && (
        <Dialog open onOpenChange={(open) => !open && !busy && setDialog(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold">Delete {dialog.contact.name}?</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">This removes the contact from the tender. To keep the person but stop using them, ban them instead.</DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setDialog(null)} className="text-xs">Cancel</Button>
              <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={async () => { if (await run(() => deleteContact(bid.id, dialog.contact.id), 'Contact deleted')) setDialog(null) }} className="text-xs">Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
