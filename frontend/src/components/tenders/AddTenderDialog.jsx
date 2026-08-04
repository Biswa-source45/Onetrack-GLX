import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Loader2, Building2, FileText, DollarSign, Calendar,
  ChevronDown, Zap, PenLine,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Label }    from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { createBid } from '../../services/bids'
import { listUsers }  from '../../services/users'
import { tokenStorage } from '../../services/auth'

// ── macOS spring dialog animation (pops from origin point) ────────────────────
function useMacOSDialog(open, originX, originY) {
  const centerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 0
  const centerY = typeof window !== 'undefined' ? window.innerHeight / 2 : 0

  // Delta from origin to center (so the dialog appears to grow from the button)
  const dx = originX ? originX - centerX : 0
  const dy = originY ? originY - centerY : 0

  return {
    initial: { opacity: 0, scale: 0.4, x: dx, y: dy },
    animate: { opacity: 1, scale: 1, x: 0, y: 0 },
    exit:    { opacity: 0, scale: 0.4, x: dx, y: dy },
    transition: { type: 'spring', stiffness: 380, damping: 30, mass: 0.8 },
  }
}

const PORTAL_SOURCES = ['GeM', 'CPPP', 'eProcure']
const BID_TYPES      = ['CUSTOM_BID', 'REGULAR', 'RA_BID']
const EMD_TYPES      = ['ONLINE', 'DD', 'BG', 'EXEMPTED']

export function AddTenderDialog({ open, onClose, onCreated, originX, originY }) {
  const [mode, setMode] = useState(null) // null | 'MANUAL' | 'INTELLIGENCE'
  const spring = useMacOSDialog(open, originX, originY)

  function handleClose() {
    setMode(null)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-foreground/25 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Dialog */}
          <motion.div
            {...spring}
            className="relative z-10 w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mode picker */}
            {!mode ? (
              <ModePicker onSelect={setMode} onClose={handleClose} />
            ) : (
              <ManualForm
                onClose={handleClose}
                onCreated={onCreated}
                onBack={() => setMode(null)}
              />
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// ── Mode Picker ───────────────────────────────────────────────────────────────
function ModePicker({ onSelect, onClose }) {
  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="font-heading text-xl font-semibold text-foreground">Add Tender</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Choose how you want to add this tender</p>
        </div>
        <button onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Manual */}
        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect('MANUAL')}
          className="group relative rounded-xl border-2 border-border hover:border-primary/40 bg-muted/30 hover:bg-primary/5 p-5 text-left transition-all"
        >
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
            <PenLine className="size-5 text-primary" />
          </div>
          <p className="font-semibold text-sm text-foreground">Manual Entry</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Fill out the tender form manually with all details
          </p>
        </motion.button>

        {/* Intelligence (disabled/coming soon) */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          onClick={() => toast.info('AI Intelligence mode coming soon!')}
          className="group relative rounded-xl border-2 border-dashed border-border bg-muted/20 p-5 text-left opacity-70 cursor-not-allowed"
        >
          <div className="size-10 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
            <Zap className="size-5 text-amber-600" />
          </div>
          <p className="font-semibold text-sm text-foreground">AI Intelligence</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Upload a tender document and AI will auto-populate all fields
          </p>
          <span className="absolute top-3 right-3 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
            Soon
          </span>
        </motion.button>
      </div>
    </div>
  )
}

// ── Field wrapper (must be outside ManualForm to avoid React re-mount crash) ──
function inputCls(err) {
  return `h-8 text-sm ${err ? 'border-destructive focus-visible:ring-destructive/30' : ''}`
}

function Field({ label, error, children, required }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

// ── Manual Form ───────────────────────────────────────────────────────────────
function ManualForm({ onClose, onCreated, onBack }) {
  const currentUser = tokenStorage.getUser()

  const [form, setForm] = useState({
    creation_mode:     'MANUAL',
    title:             '',
    bid_no:            '',
    gem_bid_no:        '',
    organization_name: '',
    department_name:   '',
    portal_source:     'GeM',
    bid_type:          'CUSTOM_BID',
    category:          '',
    estimated_value:   '',
    emd_amount:        '',
    emd_type:          'ONLINE',
    emd_exempted:      false,
    oem_required:      false,
    has_tech_eval:     false,
    opening_date:      '',
    closing_date:      '',
    bid_owner_id:      currentUser?.id ?? '',
    remarks:           '',
  })

  const [errors, setErrors]   = useState({})
  const [loading, setLoading] = useState(false)
  const [users, setUsers]     = useState([])
  const [usersLoading, setUsersLoading] = useState(false)

  // Load users for owner selector
  useEffect(() => {
    async function loadUsers() {
      setUsersLoading(true)
      try {
        const res = await listUsers({ limit: 100 })
        if (res.ok) {
          // listUsers returns { ok, status, success, data: { users: User[], meta: {} } }
          const arr = Array.isArray(res.data?.users) ? res.data.users : []
          setUsers(arr)
        }
      } catch { /* skip */ }
      finally { setUsersLoading(false) }
    }
    loadUsers()
  }, [])

  function set(field, value) {
    setForm((f) => {
      let updated = { ...f, [field]: value }

      if (field === 'emd_exempted') {
        if (value) {
          updated.emd_type = 'EXEMPTED'
          updated.emd_amount = ''
        } else {
          if (f.emd_type === 'EXEMPTED') {
            updated.emd_type = 'ONLINE'
          }
        }
      } else if (field === 'emd_type') {
        if (value === 'EXEMPTED') {
          updated.emd_exempted = true
          updated.emd_amount = ''
        } else {
          updated.emd_exempted = false
        }
      }

      return updated
    })
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function validate() {
    const e = {}
    if (!form.title.trim())      e.title = 'Tender title is required'
    if (!form.bid_owner_id)      e.bid_owner_id = 'Bid owner is required'
    return e
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }

    setLoading(true)
    try {
      const payload = {
        ...form,
        estimated_value: form.estimated_value ? Number(form.estimated_value) : undefined,
        emd_amount:      form.emd_amount ? Number(form.emd_amount) : undefined,
        start_date:      form.opening_date ? new Date(form.opening_date).toISOString() : undefined,
        end_date:        form.closing_date ? new Date(form.closing_date).toISOString() : undefined,
        opening_date:    form.opening_date ? new Date(form.opening_date).toISOString() : undefined,
        closing_date:    form.closing_date ? new Date(form.closing_date).toISOString() : undefined,
      }
      // Remove empty strings
      Object.keys(payload).forEach((k) => {
        if (payload[k] === '' || payload[k] === undefined) delete payload[k]
      })

      const res = await createBid(payload)
      if (res.ok) {
        onCreated(res.data)
      } else {
        toast.error(res.error?.message ?? 'Failed to create tender')
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack}
            className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground">
            <ChevronDown className="size-4 rotate-90" />
          </button>
          <div>
            <h2 className="font-heading text-base font-semibold text-foreground">Add New Tender</h2>
            <p className="text-xs text-muted-foreground">Manual Entry</p>
          </div>
        </div>
        <button type="button" onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
          <X className="size-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <ScrollArea className="max-h-[70vh]">
        <div className="px-6 py-5 space-y-6">

        {/* Basic Info */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="size-6 rounded-md bg-primary/10 flex items-center justify-center">
              <FileText className="size-3.5 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Basic Information</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Field label="Tender Title" error={errors.title} required>
                <Input
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  placeholder="e.g. Supply of Enterprise Firewall — NIC Delhi"
                  className={inputCls(errors.title)}
                />
              </Field>
            </div>
            <Field label="Bid No / Reference">
              <Input value={form.bid_no} onChange={(e) => set('bid_no', e.target.value)}
                placeholder="TENDER/2026/IT/001" className={inputCls()} />
            </Field>
            <Field label="GeM Bid No">
              <Input value={form.gem_bid_no} onChange={(e) => set('gem_bid_no', e.target.value)}
                placeholder="GEM/2026/B/12345" className={inputCls()} />
            </Field>
            <Field label="Portal Source">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full h-8 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5">
                    <span>{form.portal_source}</span>
                    <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[180px]">
                  <DropdownMenuLabel>Select Portal Source</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {PORTAL_SOURCES.map((p) => (
                    <DropdownMenuItem key={p} onSelect={() => set('portal_source', p)}>
                      {p}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </Field>
            <Field label="Bid Type">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full h-8 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5">
                    <span>{form.bid_type}</span>
                    <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[180px]">
                  <DropdownMenuLabel>Select Bid Type</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {BID_TYPES.map((t) => (
                    <DropdownMenuItem key={t} onSelect={() => set('bid_type', t)}>
                      {t}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </Field>
            <Field label="Category">
              <Input value={form.category} onChange={(e) => set('category', e.target.value)}
                placeholder="e.g. Networking Equipment" className={inputCls()} />
            </Field>
          </div>
        </section>

        {/* Organization */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="size-6 rounded-md bg-blue-100 flex items-center justify-center">
              <Building2 className="size-3.5 text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Organization Details</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Organization Name">
              <Input value={form.organization_name} onChange={(e) => set('organization_name', e.target.value)}
                placeholder="e.g. National Informatics Centre" className={inputCls()} />
            </Field>
            <Field label="Department / Ministry">
              <Input value={form.department_name} onChange={(e) => set('department_name', e.target.value)}
                placeholder="e.g. MeitY" className={inputCls()} />
            </Field>
          </div>
        </section>

        {/* Financials */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="size-6 rounded-md bg-emerald-100 flex items-center justify-center">
              <DollarSign className="size-3.5 text-emerald-600" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Financials & Compliance</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Estimated Value (₹)">
              <Input type="number" value={form.estimated_value} onChange={(e) => set('estimated_value', e.target.value)}
                placeholder="e.g. 2500000" className={inputCls()} />
            </Field>
            <Field label="EMD Amount (₹)">
              <Input type="number" value={form.emd_amount} onChange={(e) => set('emd_amount', e.target.value)}
                placeholder="e.g. 50000" className={`${inputCls()} ${form.emd_exempted ? 'opacity-50' : ''}`}
                disabled={form.emd_exempted} />
            </Field>
            <Field label="EMD Type">
              <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={form.emd_exempted}>
                  <Button variant="outline" size="sm" className="w-full h-8 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5 disabled:opacity-50">
                    <span>{form.emd_type}</span>
                    <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[180px]">
                  <DropdownMenuLabel>Select EMD Type</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {EMD_TYPES.map((t) => (
                    <DropdownMenuItem key={t} onSelect={() => set('emd_type', t)}>
                      {t}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </Field>

            {/* Toggles */}
            <div className="space-y-2 pt-1">
              {[
                { field: 'emd_exempted', label: 'EMD Exempted' },
                { field: 'oem_required', label: 'OEM Authorization Required' },
                { field: 'has_tech_eval', label: 'Technical Evaluation' },
              ].map(({ field, label }) => (
                <label key={field} className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => set(field, !form[field])}
                    className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer
                      ${form[field] ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  >
                    <span className={`absolute top-0.5 size-3 rounded-full bg-white shadow transition-transform
                      ${form[field] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-xs text-muted-foreground">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="size-6 rounded-md bg-amber-100 flex items-center justify-center">
              <Calendar className="size-3.5 text-amber-600" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Timeline</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Date">
              <Input type="date" value={form.opening_date}
                onChange={(e) => set('opening_date', e.target.value)} className={inputCls()} />
            </Field>
            <Field label="End Date">
              <Input type="date" value={form.closing_date}
                onChange={(e) => set('closing_date', e.target.value)} className={inputCls()} />
            </Field>
          </div>
        </section>

        {/* Assignment & Remarks */}
        <section>
          <div className="grid grid-cols-1 gap-3">
            <Field label="Bid Owner" error={errors.bid_owner_id} required>
              <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={usersLoading}>
                  <Button variant="outline" size="sm" className={`w-full h-8 text-xs font-normal justify-between bg-background text-foreground hover:bg-muted/50 gap-1.5 ${errors.bid_owner_id ? 'border-destructive' : 'border-input'}`}>
                    <span>{form.bid_owner_id ? (users.find((u) => u.id === form.bid_owner_id)?.full_name ?? 'Select owner...') : 'Select owner...'}</span>
                    <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-60 overflow-y-auto w-[220px]">
                  <DropdownMenuLabel>Select Bid Owner</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {users.map((u) => (
                    <DropdownMenuItem key={u.id} onSelect={() => set('bid_owner_id', u.id)}>
                      {u.full_name} (@{u.username})
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </Field>
            <Field label="Remarks / Notes">
              <Textarea
                value={form.remarks}
                onChange={(e) => set('remarks', e.target.value)}
                placeholder="Any internal notes, OEM preferences, etc."
                className="text-sm min-h-[60px]"
              />
            </Field>
          </div>
        </section>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/10">
        <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={loading} className="gap-1.5 min-w-[120px]">
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
          {loading ? 'Creating…' : 'Create Tender'}
        </Button>
      </div>
    </form>
  )
}
