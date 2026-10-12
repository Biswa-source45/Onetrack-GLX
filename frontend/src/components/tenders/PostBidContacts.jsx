import { useState } from 'react'
import { CheckCircle2, Mail, Phone, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CONTACT_GROUPS, blankContact, cleanContacts, validateContacts } from '../../lib/postBid'
import { formatDateTime } from '../../lib/tenderFormat'

const COLS = 'grid grid-cols-1 sm:grid-cols-[1.2fr_1fr_1fr_1.2fr_auto] gap-2 items-center'

// Editable contacts for Finance. Holds its own draft; the parent remounts it (key)
// after a save so it always starts from what is stored.
export function PostBidContactsForm({ initial, busy, onSave, onComplete }) {
  const [contacts, setContacts] = useState(() =>
    Object.fromEntries(CONTACT_GROUPS.map(({ key }) => [key, initial?.contacts?.[key]?.length ? initial.contacts[key] : [blankContact()]])))
  const [na, setNa] = useState(initial?.na || [])
  const [errors, setErrors] = useState({})

  const setField = (g, i, k, v) => setContacts((c) => ({ ...c, [g]: c[g].map((row, j) => (j === i ? { ...row, [k]: v } : row)) }))
  const addRow = (g) => setContacts((c) => ({ ...c, [g]: [...c[g], blankContact()] }))
  const removeRow = (g, i) => setContacts((c) => ({ ...c, [g]: c[g].length > 1 ? c[g].filter((_, j) => j !== i) : [blankContact()] }))
  const toggleNa = (g) => setNa((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))

  const complete = () => {
    const e = validateContacts({ contacts, na })
    setErrors(e)
    if (Object.keys(e).length === 0) onComplete(cleanContacts({ contacts, na }))
  }

  return (
    <div className="space-y-4">
      {CONTACT_GROUPS.map(({ key, label, hint, orgLabel }) => {
        const notApplicable = na.includes(key)
        return (
          <section key={key} className={`rounded-xl border p-4 space-y-3 ${errors[key] ? 'border-destructive/60 bg-destructive/5' : 'border-border bg-card'}`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h5 className="text-sm font-semibold text-foreground">{label}</h5>
                <p className="text-xs text-muted-foreground">{hint}</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={notApplicable} onChange={() => toggleNa(key)} className="size-3.5 accent-primary" />
                Not applicable
              </label>
            </div>
            {!notApplicable && (
              <div className="space-y-2">
                <div className={`${COLS} hidden sm:grid text-[11px] font-semibold text-muted-foreground`}>
                  <span>Name</span><span>{orgLabel}</span><span>Phone</span><span>Email</span><span className="w-7" />
                </div>
                {contacts[key].map((row, i) => (
                  <div key={i} className={COLS}>
                    <Input aria-label={`${label} name`} placeholder="Name" value={row.name} onChange={(e) => setField(key, i, 'name', e.target.value)} className="h-8 text-xs" />
                    <Input aria-label={`${label} ${orgLabel}`} placeholder={orgLabel} value={row.org} onChange={(e) => setField(key, i, 'org', e.target.value)} className="h-8 text-xs" />
                    <Input aria-label={`${label} phone`} placeholder="Phone" inputMode="tel" value={row.phone} onChange={(e) => setField(key, i, 'phone', e.target.value)} className="h-8 text-xs" />
                    <Input aria-label={`${label} email`} placeholder="Email" type="email" value={row.email} onChange={(e) => setField(key, i, 'email', e.target.value)} className="h-8 text-xs" />
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${label} row`} onClick={() => removeRow(key, i)} className="size-7 text-muted-foreground hover:text-destructive">
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => addRow(key)} className="h-7 gap-1 text-xs">
                  <Plus className="size-3.5" /> Add another
                </Button>
              </div>
            )}
            {errors[key] && <p role="alert" className="text-xs text-destructive">{errors[key]}</p>}
          </section>
        )
      })}
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => onSave(cleanContacts({ contacts, na }))} className="text-xs">
          Save draft
        </Button>
        <Button type="button" size="sm" disabled={busy} onClick={complete} className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
          <CheckCircle2 className="size-3.5" /> Mark my part complete
        </Button>
      </div>
    </div>
  )
}

// Read-only list, used once Finance is done and on the tender Overview.
export function PostBidContactsView({ postBid }) {
  const na = postBid?.na || []
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {CONTACT_GROUPS.map(({ key, label }) => {
        const rows = postBid?.contacts?.[key] || []
        return (
          <div key={key} className="rounded-lg border border-border bg-card p-3 space-y-2">
            <p className="text-xs font-semibold text-foreground">{label}</p>
            {na.includes(key) || rows.length === 0 ? (
              <p className="text-xs text-muted-foreground">Not applicable</p>
            ) : rows.map((c, i) => (
              <div key={i} className="text-xs space-y-0.5">
                <p className="font-medium text-foreground">{c.name}{c.org ? <span className="font-normal text-muted-foreground"> · {c.org}</span> : null}</p>
                {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"><Phone className="size-3" />{c.phone}</a>}
                {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"><Mail className="size-3" />{c.email}</a>}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// Overview card: shown once Finance has marked their part complete.
export function PostBidContactsCard({ bid }) {
  const pb = bid?.post_bid && typeof bid.post_bid === 'object' ? bid.post_bid : null
  if (!pb?.doneAt) return null
  return (
    <div className="rounded-lg border border-border p-4 space-y-3 bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Post-Bid Contacts</p>
        <p className="text-xs text-muted-foreground">Recorded by {pb.doneBy || pb.financeUserName || 'Finance'} on {formatDateTime(pb.doneAt)}</p>
      </div>
      <PostBidContactsView postBid={pb} />
    </div>
  )
}
