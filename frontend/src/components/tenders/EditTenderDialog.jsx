import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Loader2, Building2, FileText, DollarSign, Calendar,
  ChevronDown,
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
import { updateBid, getBid } from '../../services/bids'
import { listUsers }  from '../../services/users'

function useMacOSDialog(open, originX, originY) {
  const centerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 0
  const centerY = typeof window !== 'undefined' ? window.innerHeight / 2 : 0

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

export function EditTenderDialog({ open, onClose, bid, onUpdated, originX, originY }) {
  const spring = useMacOSDialog(open, originX, originY)

  const [form, setForm] = useState({
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
    bid_owner_id:      '',
    remarks:           '',
    team:                        '',
    scope_type:                  '',
    bg_rate:                     '',
    activity_type:               '',
    target_month_date:           '',
    excel_bid_status:            '',
    submission_status:           '',
    financial_evaluation_status:  '',
    po_received_status:           '',
    technical_manager_id:        '',
    bid_result:                  '',
  })

  const [errors, setErrors]   = useState({})
  const [loading, setLoading] = useState(false)
  const [users, setUsers]     = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [fetchingBid, setFetchingBid] = useState(false)

  // Load users for owner selector
  useEffect(() => {
    async function loadUsers() {
      setUsersLoading(true)
      try {
        const res = await listUsers({ limit: 100 })
        if (res.ok) {
          const arr = Array.isArray(res.data?.users) ? res.data.users : []
          setUsers(arr)
        }
      } catch { /* skip */ }
      finally { setUsersLoading(false) }
    }
    if (open) {
      loadUsers()
    }
  }, [open])

  // Populate form when bid changes or dialog opens
  useEffect(() => {
    let active = true

    async function loadFullBid() {
      if (!bid || !bid.id || !open) return
      setFetchingBid(true)
      try {
        const res = await getBid(bid.id)
        if (res.ok && res.data && active) {
          const b = res.data
          setForm({
            title:             b.title || '',
            bid_no:            b.bid_no || '',
            gem_bid_no:        b.gem_bid_no || '',
            organization_name: b.organization_name || '',
            department_name:   b.department_name || '',
            portal_source:     b.portal_source || 'GeM',
            bid_type:          b.bid_type || 'CUSTOM_BID',
            category:          b.category || '',
            estimated_value:   b.estimated_value !== undefined && b.estimated_value !== null ? String(b.estimated_value) : '',
            emd_amount:        b.emd_amount !== undefined && b.emd_amount !== null ? String(b.emd_amount) : '',
            emd_type:          b.emd_type || 'ONLINE',
            emd_exempted:      !!b.emd_exempted,
            oem_required:      !!b.oem_required,
            has_tech_eval:     !!b.has_tech_eval,
            opening_date:      b.opening_date ? new Date(b.opening_date).toISOString().split('T')[0] : '',
            closing_date:      b.closing_date ? new Date(b.closing_date).toISOString().split('T')[0] : '',
            bid_owner_id:      b.bid_owner?.id || b.bid_owner_id || '',
            remarks:           b.remarks || '',
            team:                        b.team || '',
            scope_type:                  b.scope_type || '',
            bg_rate:                     b.bg_rate !== undefined && b.bg_rate !== null ? String(b.bg_rate) : '',
            activity_type:               b.activity_type || '',
            target_month_date:           b.target_month_date ? new Date(b.target_month_date).toISOString().split('T')[0] : '',
            excel_bid_status:            b.excel_bid_status || '',
            submission_status:           b.submission_status || '',
            financial_evaluation_status:  b.financial_evaluation_status || '',
            po_received_status:           b.po_received_status || '',
            technical_manager_id:        b.technical_manager?.id || b.technical_manager_id || '',
            bid_result:                  b.bid_result || '',
          })
        }
      } catch (err) {
        console.error('Failed to load full bid details', err)
      } finally {
        if (active) {
          setFetchingBid(false)
        }
      }
    }

    if (bid && open) {
      setForm({
        title:             bid.title || '',
        bid_no:            bid.bid_no || '',
        gem_bid_no:        bid.gem_bid_no || '',
        organization_name: bid.organization_name || '',
        department_name:   bid.department_name || '',
        portal_source:     bid.portal_source || 'GeM',
        bid_type:          bid.bid_type || 'CUSTOM_BID',
        category:          bid.category || '',
        estimated_value:   bid.estimated_value !== undefined && bid.estimated_value !== null ? String(bid.estimated_value) : '',
        emd_amount:        bid.emd_amount !== undefined && bid.emd_amount !== null ? String(bid.emd_amount) : '',
        emd_type:          bid.emd_type || 'ONLINE',
        emd_exempted:      !!bid.emd_exempted,
        oem_required:      !!bid.oem_required,
        has_tech_eval:     !!bid.has_tech_eval,
        opening_date:      bid.opening_date ? new Date(bid.opening_date).toISOString().split('T')[0] : '',
        closing_date:      bid.closing_date ? new Date(bid.closing_date).toISOString().split('T')[0] : '',
        bid_owner_id:      bid.bid_owner?.id || bid.bid_owner_id || '',
        remarks:           bid.remarks || '',
        team:                        bid.team || '',
        scope_type:                  bid.scope_type || '',
        bg_rate:                     bid.bg_rate !== undefined && bid.bg_rate !== null ? String(bid.bg_rate) : '',
        activity_type:               bid.activity_type || '',
        target_month_date:           bid.target_month_date ? new Date(bid.target_month_date).toISOString().split('T')[0] : '',
        excel_bid_status:            bid.excel_bid_status || '',
        submission_status:           bid.submission_status || '',
        financial_evaluation_status:  bid.financial_evaluation_status || '',
        po_received_status:           bid.po_received_status || '',
        technical_manager_id:        bid.technical_manager?.id || bid.technical_manager_id || '',
        bid_result:                  bid.bid_result || '',
      })
      setErrors({})
      loadFullBid()
    }

    return () => {
      active = false
    }
  }, [bid, open])

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
        estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
        emd_amount:      form.emd_amount ? Number(form.emd_amount) : null,
        bg_rate:         form.bg_rate ? Number(form.bg_rate) : null,
        opening_date:    form.opening_date ? new Date(form.opening_date).toISOString() : null,
        closing_date:    form.closing_date ? new Date(form.closing_date).toISOString() : null,
        target_month_date: form.target_month_date ? new Date(form.target_month_date).toISOString() : null,
        technical_manager_id: form.technical_manager_id || null,
        bid_result: form.bid_result || null,
      }

      const res = await updateBid(bid.id, payload)
      if (res.ok) {
        toast.success('Tender updated successfully')
        onUpdated(res.data)
        onClose()
      } else {
        toast.error(res.error?.message ?? 'Failed to update tender')
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
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
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            {...spring}
            className="relative z-10 w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSubmit}>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
                <div>
                  <h2 className="font-heading text-base font-semibold text-foreground">Edit Tender Details</h2>
                  <p className="text-xs text-muted-foreground">Modify tender properties and financials</p>
                </div>
                <button type="button" onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                  <X className="size-4" />
                </button>
              </div>

              {/* Scrollable body */}
              <ScrollArea className="max-h-[70vh]">
                <div className="px-6 py-5 space-y-6 relative">
                {fetchingBid ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                    <Loader2 className="size-8 animate-spin text-primary" />
                    <span className="text-xs font-medium animate-pulse">Loading latest tender details...</span>
                  </div>
                ) : (
                  <>
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
                    <Field label="Opening Date">
                      <Input type="date" value={form.opening_date}
                        onChange={(e) => set('opening_date', e.target.value)} className={inputCls()} />
                    </Field>
                    <Field label="Closing Date">
                      <Input type="date" value={form.closing_date}
                        onChange={(e) => set('closing_date', e.target.value)} className={inputCls()} />
                    </Field>
                  </div>
                </section>

                {/* Excel Tracking Details */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="size-6 rounded-md bg-purple-100 flex items-center justify-center">
                      <FileText className="size-3.5 text-purple-600" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">Excel Tracking Details</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Team">
                      <Input value={form.team} onChange={(e) => set('team', e.target.value)}
                        placeholder="e.g. Govt Team A" className={inputCls()} />
                    </Field>
                    <Field label="Scope Type">
                      <Input value={form.scope_type} onChange={(e) => set('scope_type', e.target.value)}
                        placeholder="e.g. Service / Supply" className={inputCls()} />
                    </Field>
                    <Field label="BG Rate (%)">
                      <Input type="number" step="any" value={form.bg_rate} onChange={(e) => set('bg_rate', e.target.value)}
                        placeholder="e.g. 2.5" className={inputCls()} />
                    </Field>
                    <Field label="Activity Type">
                      <Input value={form.activity_type} onChange={(e) => set('activity_type', e.target.value)}
                        placeholder="e.g. System Integration" className={inputCls()} />
                    </Field>
                    <Field label="Target Month Date">
                      <Input type="date" value={form.target_month_date}
                        onChange={(e) => set('target_month_date', e.target.value)} className={inputCls()} />
                    </Field>
                    <Field label="Excel Bid Status">
                      <Input value={form.excel_bid_status} onChange={(e) => set('excel_bid_status', e.target.value)}
                        placeholder="e.g. Submitted" className={inputCls()} />
                    </Field>
                    <Field label="Submission Status">
                      <Input value={form.submission_status} onChange={(e) => set('submission_status', e.target.value)}
                        placeholder="e.g. Online Upload" className={inputCls()} />
                    </Field>
                    <Field label="Financial Evaluation Status">
                      <Input value={form.financial_evaluation_status} onChange={(e) => set('financial_evaluation_status', e.target.value)}
                        placeholder="e.g. Qualified" className={inputCls()} />
                    </Field>
                    <Field label="PO Received Status">
                      <Input value={form.po_received_status} onChange={(e) => set('po_received_status', e.target.value)}
                        placeholder="e.g. Awaiting PO" className={inputCls()} />
                    </Field>
                  </div>
                </section>

                {/* Assignment & Remarks */}
                <section>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                    <Field label="Technical Manager">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={usersLoading}>
                          <Button variant="outline" size="sm" className="w-full h-8 text-xs font-normal justify-between bg-background text-foreground hover:bg-muted/50 gap-1.5 border-input">
                            <span>{form.technical_manager_id ? (users.find((u) => u.id === form.technical_manager_id)?.full_name ?? 'Select manager...') : 'Select manager...'}</span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="max-h-60 overflow-y-auto w-[220px]">
                          <DropdownMenuLabel>Select Technical Manager</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {users.map((u) => (
                            <DropdownMenuItem key={u.id} onSelect={() => set('technical_manager_id', u.id)}>
                              {u.full_name} (@{u.username})
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Field>

                    <div className="sm:col-span-2">
                      <Field label="Bid Result / Outcome">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full h-8 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5">
                              <span>{form.bid_result || 'Pending'}</span>
                              <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-[180px]">
                            {['Pending', 'Won', 'Lost', 'Result Pending', 'L1'].map((br) => (
                              <DropdownMenuItem key={br} onSelect={() => set('bid_result', br)}>
                                {br}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </Field>
                    </div>

                    <div className="sm:col-span-2">
                      <Field label="Remarks / Notes">
                        <Textarea
                          value={form.remarks}
                          onChange={(e) => set('remarks', e.target.value)}
                          placeholder="Any internal notes, OEM preferences, etc."
                          className="text-sm min-h-[60px]"
                        />
                      </Field>
                    </div>
                  </div>
                </section>
                  </>
                )}
                </div>
              </ScrollArea>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/10">
                <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading || fetchingBid}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={loading || fetchingBid} className="gap-1.5 min-w-[120px]">
                  {loading ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
                  {loading ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
