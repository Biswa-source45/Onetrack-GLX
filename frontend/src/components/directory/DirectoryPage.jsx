import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, Building2, CalendarDays, Factory, Globe, Loader2, Mail, MapPin, Pencil, Phone, Plus, Search, Tag, Trash2, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  KINDS, blankContact, blankEntry, contactPayload, entryPayload, filterEntries, validateDirectoryContact, validateEntry,
} from '../../lib/directory'
import {
  addContact, createEntry, deleteContact, deleteEntry, getEntry, listEntries, updateContact, updateEntry,
} from '../../services/directory'

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
const errText = (res, fallback) => res?.error?.message || fallback
const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

/** My Accounts / My OEMs: the list, and one record (with its contacts) opened via ?open=<id>. */
export function DirectoryPage({ kind }) {
  const [params, setParams] = useSearchParams()
  const openId = params.get('open')
  const cfg = KINDS[kind]
  const open = (id) => setParams(id ? { open: id } : {})
  return openId
    ? <Detail key={`${kind}-${openId}`} kind={kind} cfg={cfg} id={openId} onBack={() => open('')} />
    : <List key={kind} kind={kind} cfg={cfg} onOpen={open} />
}

function Field({ id, label, error, hint, children }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium">{label}</Label>
      {children}
      {error ? <p role="alert" className="text-[11px] font-medium text-destructive">{error}</p>
        : hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

// The record's own fields; used in the add dialog and on the detail screen.
function EntryFields({ cfg, value, errors, disabled, onChange, idPrefix, autoFocus = false }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value })
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field id={`${idPrefix}-name`} label={`${cfg.one === 'OEM' ? 'OEM' : 'Account'} name *`} error={errors.name}>
          <Input id={`${idPrefix}-name`} value={value.name} onChange={set('name')} disabled={disabled} maxLength={200} autoFocus={autoFocus} aria-invalid={!!errors.name} />
        </Field>
      </div>
      <Field id={`${idPrefix}-sector`} label={cfg.sectorLabel} hint={cfg.sectorHint}>
        <Input id={`${idPrefix}-sector`} value={value.sector} onChange={set('sector')} disabled={disabled} maxLength={100} />
      </Field>
      <Field id={`${idPrefix}-location`} label="Location">
        <Input id={`${idPrefix}-location`} value={value.location} onChange={set('location')} disabled={disabled} maxLength={200} />
      </Field>
      {cfg.hasWebsite && (
        <div className="sm:col-span-2">
          <Field id={`${idPrefix}-website`} label="Website" error={errors.website}>
            <Input id={`${idPrefix}-website`} value={value.website} onChange={set('website')} disabled={disabled} placeholder="https://" aria-invalid={!!errors.website} />
          </Field>
        </div>
      )}
      <div className="sm:col-span-2">
        <Field id={`${idPrefix}-notes`} label="Notes">
          <Textarea id={`${idPrefix}-notes`} value={value.notes} onChange={set('notes')} disabled={disabled} maxLength={2000} className="min-h-[88px] text-sm" />
        </Field>
      </div>
    </div>
  )
}

function List({ kind, cfg, onOpen }) {
  const Icon = kind === 'oems' ? Factory : Building2
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await listEntries(kind)
      if (res.ok) setEntries(res.data || [])
      else setError(errText(res, 'Could not load the list'))
    } catch { setError('Network error') }
  }, [kind])
  useEffect(() => { load() }, [load])

  const shown = useMemo(() => filterEntries(entries || [], query), [entries, query])

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" /></span>
          <div>
            <h1 className="text-xl font-bold font-heading">{cfg.label}</h1>
            <p className="text-sm text-muted-foreground max-w-xl">{cfg.blurb}</p>
          </div>
        </div>
        <Button onClick={() => setAdding(true)} className="gap-1.5"><Plus className="size-4" /> {cfg.Add}</Button>
      </div>

      {entries && entries.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, type or location" aria-label={`Search ${cfg.label}`} className="pl-9" />
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
          <Button size="sm" variant="outline" onClick={load}>Retry</Button>
        </div>
      )}

      {!error && entries === null && (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading…</div>
      )}

      {entries && entries.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <Icon className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold">No {cfg.plural} yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Add your first {cfg.one} and keep its contacts together.</p>
          <Button onClick={() => setAdding(true)} className="mt-4 gap-1.5"><Plus className="size-4" /> {cfg.Add}</Button>
        </div>
      )}

      {entries && entries.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="p-3">Name</th>
                <th scope="col" className="p-3">{cfg.sectorLabel}</th>
                <th scope="col" className="p-3">Location</th>
                <th scope="col" className="p-3 text-right">Contacts</th>
                <th scope="col" className="p-3 text-right">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((e) => (
                <tr key={e.id} onClick={() => onOpen(e.id)} className="cursor-pointer transition-colors hover:bg-muted/30">
                  <td className="p-3 font-semibold">
                    <button type="button" onClick={(ev) => { ev.stopPropagation(); onOpen(e.id) }} className="text-left hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
                      {e.name}
                    </button>
                  </td>
                  <td className="p-3 text-muted-foreground">{e.sector || '—'}</td>
                  <td className="p-3 text-muted-foreground">{e.location || '—'}</td>
                  <td className="p-3 text-right tabular-nums">{e.contact_count}</td>
                  <td className="p-3 text-right text-muted-foreground tabular-nums">{fmtDate(e.updated_at)}</td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nothing matches “{query}”.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <AddDialog kind={kind} cfg={cfg} onClose={() => setAdding(false)} onCreated={(e) => { setAdding(false); onOpen(e.id) }} />
      )}
    </div>
  )
}

function AddDialog({ kind, cfg, onClose, onCreated }) {
  const [form, setForm] = useState(blankEntry())
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const e = validateEntry(form)
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      const res = await createEntry(kind, entryPayload(form))
      if (res.ok) { toast.success(`${cfg.one === 'OEM' ? 'OEM' : 'Account'} added`); onCreated(res.data); return }
      if (res.status === 409) setErrors({ name: errText(res, 'You already have one with this name') })
      else toast.error(errText(res, 'Could not save'))
    } catch { toast.error('Network error') } finally { setBusy(false) }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{cfg.Add}</DialogTitle>
          <DialogDescription>You can add contacts once it is saved.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); submit() }} noValidate>
          <EntryFields cfg={cfg} value={form} errors={errors} disabled={busy} onChange={setForm} idPrefix="add" autoFocus />
          <DialogFooter className="mt-5 gap-2 sm:gap-0">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />} Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Detail({ kind, cfg, id, onBack }) {
  const [entry, setEntry] = useState(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState(blankEntry())
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [contactDlg, setContactDlg] = useState(null) // null | { id?, ...fields }
  const [confirm, setConfirm] = useState(null) // null | { type: 'entry' } | { type: 'contact', contact }

  const adopt = (e) => {
    setEntry(e)
    setForm({ name: e.name, sector: e.sector, location: e.location, website: e.website, notes: e.notes })
  }

  useEffect(() => {
    let live = true
    getEntry(kind, id).then((res) => {
      if (!live) return
      if (res.ok) adopt(res.data)
      else setError(res.status === 404 ? `This ${cfg.one} was not found.` : errText(res, 'Could not load'))
    }).catch(() => live && setError('Network error'))
    return () => { live = false }
  }, [kind, id, cfg.one])

  const dirty = entry && JSON.stringify(entryPayload(form)) !== JSON.stringify(entryPayload(entry))

  // Every write answers with the record as it now stands.
  const write = async (run, okMsg) => {
    setBusy(true)
    try {
      const res = await run()
      if (res.ok) { if (res.data) adopt(res.data); if (okMsg) toast.success(okMsg); return res }
      if (res.status === 409) setErrors({ name: errText(res, 'You already have one with this name') })
      else toast.error(errText(res, 'Could not save'))
      return null
    } catch { toast.error('Network error'); return null } finally { setBusy(false) }
  }

  const saveEntry = async () => {
    const e = validateEntry(form)
    setErrors(e)
    if (Object.keys(e).length) return
    const res = await write(() => updateEntry(kind, id, entryPayload(form)), 'Saved')
    if (res) setEditing(false)
  }

  const cancelEdit = () => { adopt(entry); setErrors({}); setEditing(false) }

  const removeEntry = async () => {
    setBusy(true)
    try {
      const res = await deleteEntry(kind, id)
      if (res.ok) { toast.success('Deleted'); onBack(); return }
      toast.error(errText(res, 'Could not delete'))
    } catch { toast.error('Network error') } finally { setBusy(false); setConfirm(null) }
  }

  const removeContact = async (c) => {
    await write(() => deleteContact(kind, id, c.id), 'Contact deleted')
    setConfirm(null)
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5"><ArrowLeft className="size-4" /> Back to {cfg.label}</Button>
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>
      </div>
    )
  }
  if (!entry) return <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading…</div>

  const Icon = kind === 'oems' ? Factory : Building2
  const contacts = entry.contacts || []

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 gap-1.5 text-muted-foreground">
        <ArrowLeft className="size-4" /> {cfg.label}
      </Button>

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-2">
            <h1 className="truncate text-2xl font-bold font-heading leading-tight">{entry.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              {entry.sector && <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-foreground"><Tag className="size-3" aria-hidden="true" />{entry.sector}</span>}
              {entry.location && <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden="true" />{entry.location}</span>}
              {entry.website && (
                <a href={entry.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline">
                  <Globe className="size-3.5" aria-hidden="true" />{entry.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => setEditing(true)} className="gap-1.5">
              <Pencil className="size-4" /> Edit details
            </Button>
          )}
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirm({ type: 'entry' })} className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="size-4" /> Delete {cfg.one}
          </Button>
        </div>
      </header>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] 2xl:items-start">
        <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="entry-details">
          <div className="flex items-center justify-between">
            <h2 id="entry-details" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {editing ? 'Edit details' : 'Details'}
            </h2>
            {editing && (
              <Button variant="ghost" size="icon" className="size-7" aria-label="Cancel editing" disabled={busy} onClick={cancelEdit}><X className="size-4" /></Button>
            )}
          </div>

          {editing ? (
            <form className="mt-4 space-y-4" noValidate onSubmit={(ev) => { ev.preventDefault(); saveEntry() }}>
              <EntryFields cfg={cfg} value={form} errors={errors} disabled={busy} onChange={setForm} idPrefix="edit" autoFocus />
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button type="button" variant="outline" disabled={busy} onClick={cancelEdit}>Cancel</Button>
                <Button type="submit" disabled={busy || !dirty}>{busy && <Loader2 className="size-4 animate-spin" />} Save changes</Button>
              </div>
            </form>
          ) : (
            <dl className="mt-4 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-1">
              <div>
                <dt className="text-xs text-muted-foreground">{cfg.sectorLabel}</dt>
                <dd className="mt-0.5 font-medium">{entry.sector || <span className="font-normal text-muted-foreground">Not set</span>}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Location</dt>
                <dd className="mt-0.5 font-medium">{entry.location || <span className="font-normal text-muted-foreground">Not set</span>}</dd>
              </div>
              {cfg.hasWebsite && (
                <div>
                  <dt className="text-xs text-muted-foreground">Website</dt>
                  <dd className="mt-0.5 font-medium break-all">
                    {entry.website ? <a href={entry.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{entry.website}</a> : <span className="font-normal text-muted-foreground">Not set</span>}
                  </dd>
                </div>
              )}
              <div className="sm:col-span-2 xl:col-span-4 2xl:col-span-1">
                <dt className="text-xs text-muted-foreground">Notes</dt>
                <dd className="mt-0.5 whitespace-pre-wrap break-words">{entry.notes || <span className="text-muted-foreground">No notes</span>}</dd>
              </div>
              <div className="flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground sm:col-span-2 xl:col-span-4 2xl:col-span-1">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                Added {fmtDate(entry.created_at)} · Updated {fmtDate(entry.updated_at)}
              </div>
            </dl>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card" aria-labelledby="entry-contacts">
          <div className="flex items-center justify-between gap-3 p-5 pb-4">
            <h2 id="entry-contacts" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Users className="size-4" aria-hidden="true" /> Contacts
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-foreground">{contacts.length}</span>
            </h2>
            <Button size="sm" onClick={() => setContactDlg(blankContact())} className="gap-1.5"><Plus className="size-4" /> Add contact</Button>
          </div>
          {contacts.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-y border-border bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="p-3 pl-5">Name</th>
                    <th scope="col" className="p-3">Email</th>
                    <th scope="col" className="p-3">Phone</th>
                    <th scope="col" className="p-3">Remarks</th>
                    <th scope="col" className="p-3 pr-5 text-right"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {contacts.map((c) => (
                    <tr key={c.id} className="align-top transition-colors hover:bg-muted/30">
                      <td className="p-3 pl-5">
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary" aria-hidden="true">{initials(c.name)}</span>
                          <div className="min-w-0">
                            <div className="font-semibold">{c.name}</div>
                            {c.designation && <div className="text-xs text-muted-foreground">{c.designation}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 pt-4">{c.email ? <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 text-primary hover:underline"><Mail className="size-3.5" aria-hidden="true" />{c.email}</a> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="p-3 pt-4 whitespace-nowrap">{c.phone ? <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1.5 text-primary hover:underline"><Phone className="size-3.5" aria-hidden="true" />{c.phone}</a> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="p-3 pt-4 max-w-[16rem] whitespace-pre-wrap break-words text-muted-foreground">{c.remarks || '—'}</td>
                      <td className="p-3 pr-5">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="size-8" aria-label={`Edit ${c.name}`} disabled={busy} onClick={() => setContactDlg({ ...c })}><Pencil className="size-4" /></Button>
                          <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" aria-label={`Delete ${c.name}`} disabled={busy} onClick={() => setConfirm({ type: 'contact', contact: c })}><Trash2 className="size-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mx-5 mb-5 rounded-lg border border-dashed border-border p-8 text-center">
              <Users className="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium">No contacts yet</p>
              <p className="text-sm text-muted-foreground">Add the people you deal with at this {cfg.one}.</p>
              <Button size="sm" onClick={() => setContactDlg(blankContact())} className="mt-3 gap-1.5"><Plus className="size-4" /> Add contact</Button>
            </div>
          )}
        </section>
      </div>

      {contactDlg && (
        <ContactDialog
          initial={contactDlg} all={entry.contacts || []} busy={busy} onClose={() => setContactDlg(null)}
          onSave={async (c) => {
            const payload = contactPayload(c)
            const res = await write(() => (c.id ? updateContact(kind, id, c.id, payload) : addContact(kind, id, payload)), c.id ? 'Contact updated' : 'Contact added')
            if (res) setContactDlg(null)
          }}
        />
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && !busy && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.type === 'entry' ? `Delete this ${cfg.one}?` : 'Delete this contact?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === 'entry'
                ? `“${entry.name}” and all ${entry.contacts?.length || 0} of its contacts will be removed. This cannot be undone.`
                : `${confirm?.contact?.name} will be removed from “${entry.name}”.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); confirm?.type === 'entry' ? removeEntry() : removeContact(confirm.contact) }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ContactDialog({ initial, all, busy, onSave, onClose }) {
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState({})
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = () => {
    const e = validateDirectoryContact(form, all, initial.id)
    setErrors(e)
    if (!Object.keys(e).length) onSave(form)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial.id ? 'Edit contact' : 'Add contact'}</DialogTitle>
          <DialogDescription>Email and phone are optional but make the contact useful.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); submit() }} noValidate className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field id="c-name" label="Name *" error={errors.name}>
              <Input id="c-name" value={form.name} onChange={set('name')} disabled={busy} maxLength={200} autoFocus aria-invalid={!!errors.name} />
            </Field>
          </div>
          <Field id="c-designation" label="Designation">
            <Input id="c-designation" value={form.designation} onChange={set('designation')} disabled={busy} maxLength={150} />
          </Field>
          <Field id="c-phone" label="Phone" error={errors.phone}>
            <Input id="c-phone" type="tel" value={form.phone} onChange={set('phone')} disabled={busy} placeholder="+91 98765 43210" aria-invalid={!!errors.phone} />
          </Field>
          <div className="sm:col-span-2">
            <Field id="c-email" label="Email" error={errors.email}>
              <Input id="c-email" type="email" value={form.email} onChange={set('email')} disabled={busy} placeholder="name@company.com" aria-invalid={!!errors.email} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field id="c-remarks" label="Remarks">
              <Textarea id="c-remarks" value={form.remarks} onChange={set('remarks')} disabled={busy} maxLength={1000} className="min-h-[72px] text-sm" />
            </Field>
          </div>
          <DialogFooter className="sm:col-span-2 gap-2 sm:gap-0">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />} {initial.id ? 'Save' : 'Add contact'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
