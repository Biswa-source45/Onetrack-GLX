import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Loader2, Building2, FileText, DollarSign, Calendar,
  ChevronDown, CheckSquare, Plus, Trash2, Shuffle,
} from 'lucide-react'
import { toast } from 'sonner'
import { ALERT_NOTE_COLORS, randomAlertNoteColor } from '../../lib/tenderFormat'

import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Label }    from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
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
import { usePermissions } from '../../hooks/usePermissions'

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

const STANDARD_PORTAL_SOURCES = ['GeM', 'CPPP', 'eProcure']
const PORTAL_SOURCES = [...STANDARD_PORTAL_SOURCES, 'Other']
const BID_TYPES      = ['BID', 'BID_TO_RA']
const SCOPE_TYPES    = ['Supply', 'Implementation', 'Support', 'N/A']
const STANDARD_CATEGORY_OPTIONS = [
  'End computing', 'IT infra', 'Non-IT infra', 'Security', 'Cloud',
  'Surveillance', 'Software', 'Manpower-augmentation',
]
const CATEGORY_OPTIONS = [...STANDARD_CATEGORY_OPTIONS, 'Other']

function safeDateStr(dt) {
  if (!dt) return ''
  try {
    const d = new Date(dt)
    if (isNaN(d.getTime())) return ''
    if (d.getFullYear() <= 1970) return ''
    return d.toISOString().split('T')[0]
  } catch {
    return ''
  }
}

// Preserves time-of-day for <input type="datetime-local"> — unlike safeDateStr,
// which truncates to a date-only string and silently drops the time.
function safeDateTimeStr(dt) {
  if (!dt) return ''
  try {
    const d = new Date(dt)
    if (isNaN(d.getTime())) return ''
    if (d.getFullYear() <= 1970) return ''
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

// Parses a bid's requested_products (array of {product,description,qty,oem}
// or null) into the row shape the products table needs, with local ids for
// React keys. Falls back to one blank row so the table is never empty.
// alert_note comes back from the API already parsed (interface{} on the Go
// side), same as requested_products — no JSON.parse needed here.
function applyAlertNote(note, setShow, setText, setLabel, setColor) {
  if (note && typeof note === 'object' && note.text) {
    setShow(true)
    setText(note.text || '')
    setLabel(note.label || '')
    setColor(note.color && ALERT_NOTE_COLORS[note.color] ? note.color : randomAlertNoteColor())
  } else {
    setShow(false)
    setText('')
    setLabel('')
  }
}

function parseRequestedProducts(rp) {
  const arr = Array.isArray(rp) ? rp : []
  if (arr.length === 0) return [{ id: 1, product: '', description: '', qty: '', oem: '' }]
  return arr.map((p, i) => ({
    id: i + 1,
    product: p.product || '',
    description: p.description || '',
    qty: p.qty !== undefined && p.qty !== null ? String(p.qty) : '',
    oem: p.oem || '',
  }))
}

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
  const { user, isAdmin } = usePermissions()

  // Bid Owner reassignment is restricted to this tender's own Account Manager
  // / Reporting Manager (or an admin) — mirrors the backend check in
  // bidService.UpdateBid so the field is visibly locked instead of failing
  // silently after submit.
  const isTenderAccountManager = !!user?.id && bid?.account_manager?.id === user.id
  const isTenderReportingManager = !!user?.id && bid?.reporting_manager?.id === user.id
  const canChangeOwner = isAdmin || isTenderAccountManager || isTenderReportingManager
  const [amOwnerCaution, setAmOwnerCaution] = useState(false)

  const [form, setForm] = useState({
    title:             '',
    high_level_scope:  '',
    gem_bid_no:        '',
    organization_name: '',
    department_name:   '',
    location:          '',
    portal_source:     'GeM',
    bid_type:          'BID',
    category:          '',
    scope_type:        'Supply',
    quantity:          '',
    estimated_value:   '',
    emd_amount:        '',
    emd_not_applicable: false,
    emd_exemption_types:  [],
    emd_exemption_reason: '',
    bg_required:       false,
    bg_rate:           '',
    bg_duration_months: '',
    opening_date:      '',
    closing_date:      '',
    target_month_date: '',
    bid_owner_id:      '',
    remarks:           '',
    reporting_manager_id:        '',
    account_manager_id:          '',
    presales_id:                 '',
    // EMD bank/online payment details
    emd_bank_name:               '',
    emd_account_number:          '',
    emd_ifsc_code:               '',
    emd_branch:                  '',
    // EMD DD (Demand Draft) details
    emd_beneficiary:             '',
    emd_payable_at:              '',
  })

  const [errors, setErrors]   = useState({})
  const [loading, setLoading] = useState(false)
  const [users, setUsers]     = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [fetchingBid, setFetchingBid] = useState(false)
  const [otherPortalSource, setOtherPortalSource] = useState(false)
  const [otherCategory, setOtherCategory] = useState(false)
  // Online/DD are independent raw-capture toggles, kept outside `form` so
  // unticking one clears just its own fields (see AddTenderPage for why).
  const [emdOnlineOn, setEmdOnlineOn] = useState(false)
  const [emdDdOn, setEmdDdOn] = useState(false)
  const [products, setProducts] = useState([{ id: 1, product: '', description: '', qty: '', oem: '' }])
  // Additional Info / Challenge note — see AddTenderPage for the same field
  const [showAlertNote, setShowAlertNote] = useState(false)
  const [alertNoteText, setAlertNoteText] = useState('')
  const [alertNoteLabel, setAlertNoteLabel] = useState('')
  const [alertNoteColor, setAlertNoteColor] = useState(() => randomAlertNoteColor())
  const addProductRow = () => setProducts(prev => [...prev, { id: Date.now(), product: '', description: '', qty: '', oem: '' }])
  const updateProductRow = (id, field, value) => setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  const removeProductRow = (id) => setProducts(prev => prev.length > 1 ? prev.filter(p => p.id !== id) : prev)
  const accountManagers = users.filter(u => Array.isArray(u.roles) && u.roles.includes('ACCOUNT_MANAGER'))
  const presalesUsers = users.filter(u => Array.isArray(u.roles) && u.roles.includes('PRE_SALES'))

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
            high_level_scope:  b.high_level_scope || '',
            gem_bid_no:        b.gem_bid_no || '',
            organization_name: b.organization_name || '',
            department_name:   b.department_name || '',
            location:          b.location || '',
            portal_source:     b.portal_source || 'GeM',
            bid_type:          b.bid_type || 'BID',
            category:          b.category || '',
            scope_type:        b.scope_type || 'Supply',
            quantity:          b.quantity !== undefined && b.quantity !== null ? String(b.quantity) : '',
            estimated_value:   b.estimated_value !== undefined && b.estimated_value !== null ? String(b.estimated_value) : '',
            emd_amount:        b.emd_amount !== undefined && b.emd_amount !== null ? String(b.emd_amount) : '',
            emd_not_applicable: !!b.emd_not_applicable,
            emd_exemption_types:  Array.isArray(b.emd_exemption_types) ? b.emd_exemption_types : [],
            emd_exemption_reason: b.emd_exemption_reason || '',
            bg_required:       !!b.bg_required,
            bg_rate:           b.bg_rate !== undefined && b.bg_rate !== null ? String(b.bg_rate) : '',
            bg_duration_months: b.bg_duration_months !== undefined && b.bg_duration_months !== null ? String(b.bg_duration_months) : '',
            opening_date:      safeDateStr(b.opening_date || b.start_date),
            closing_date:      safeDateTimeStr(b.closing_date || b.end_date || b.submission_deadline || b.target_month_date),
            target_month_date: safeDateStr(b.target_month_date),
            bid_owner_id:      b.bid_owner?.id || b.bid_owner_id || '',
            remarks:           b.remarks || '',
            reporting_manager_id: b.reporting_manager?.id || b.reporting_manager_id || '',
            account_manager_id: b.account_manager?.id || b.account_manager_id || '',
            presales_id:        b.presales?.id || b.presales_id || '',
            emd_bank_name:      b.emd_bank_name || '',
            emd_account_number: b.emd_account_number || '',
            emd_ifsc_code:      b.emd_ifsc_code || '',
            emd_branch:         b.emd_branch || '',
            emd_beneficiary:    b.emd_beneficiary || '',
            emd_payable_at:     b.emd_payable_at || '',
          })
          setEmdOnlineOn(!!b.emd_bank_name)
          setEmdDdOn(!!b.emd_beneficiary)
          setProducts(parseRequestedProducts(b.requested_products))
          applyAlertNote(b.alert_note, setShowAlertNote, setAlertNoteText, setAlertNoteLabel, setAlertNoteColor)
          setOtherPortalSource(!!b.portal_source && !STANDARD_PORTAL_SOURCES.includes(b.portal_source))
          setOtherCategory(!!b.category && !STANDARD_CATEGORY_OPTIONS.includes(b.category))
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
        high_level_scope:  bid.high_level_scope || '',
        gem_bid_no:        bid.gem_bid_no || '',
        organization_name: bid.organization_name || '',
        department_name:   bid.department_name || '',
        location:          bid.location || '',
        portal_source:     bid.portal_source || 'GeM',
        bid_type:          bid.bid_type || 'BID',
        category:          bid.category || '',
        scope_type:        bid.scope_type || 'Supply',
        quantity:          bid.quantity !== undefined && bid.quantity !== null ? String(bid.quantity) : '',
        estimated_value:   bid.estimated_value !== undefined && bid.estimated_value !== null ? String(bid.estimated_value) : '',
        emd_amount:        bid.emd_amount !== undefined && bid.emd_amount !== null ? String(bid.emd_amount) : '',
        emd_not_applicable: !!bid.emd_not_applicable,
        emd_exemption_types:  Array.isArray(bid.emd_exemption_types) ? bid.emd_exemption_types : [],
        emd_exemption_reason: bid.emd_exemption_reason || '',
        bg_required:       !!bid.bg_required,
        bg_rate:           bid.bg_rate !== undefined && bid.bg_rate !== null ? String(bid.bg_rate) : '',
        bg_duration_months: bid.bg_duration_months !== undefined && bid.bg_duration_months !== null ? String(bid.bg_duration_months) : '',
        opening_date:      safeDateStr(bid.opening_date || bid.start_date),
        closing_date:      safeDateTimeStr(bid.closing_date || bid.end_date || bid.submission_deadline || bid.target_month_date),
        target_month_date: safeDateStr(bid.target_month_date),
        bid_owner_id:      bid.bid_owner?.id || bid.bid_owner_id || '',
        remarks:           bid.remarks || '',
        reporting_manager_id: bid.reporting_manager?.id || bid.reporting_manager_id || '',
        account_manager_id: bid.account_manager?.id || bid.account_manager_id || '',
        presales_id:        bid.presales?.id || bid.presales_id || '',
        emd_bank_name:      bid.emd_bank_name || '',
        emd_account_number: bid.emd_account_number || '',
        emd_ifsc_code:      bid.emd_ifsc_code || '',
        emd_branch:         bid.emd_branch || '',
        emd_beneficiary:    bid.emd_beneficiary || '',
        emd_payable_at:     bid.emd_payable_at || '',
      })
      setEmdOnlineOn(!!bid.emd_bank_name)
      setEmdDdOn(!!bid.emd_beneficiary)
      setProducts(parseRequestedProducts(bid.requested_products))
      applyAlertNote(bid.alert_note, setShowAlertNote, setAlertNoteText, setAlertNoteLabel, setAlertNoteColor)
      setOtherPortalSource(!!bid.portal_source && !STANDARD_PORTAL_SOURCES.includes(bid.portal_source))
      setOtherCategory(!!bid.category && !STANDARD_CATEGORY_OPTIONS.includes(bid.category))
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

      // EMD is raw data off the tender document — see AddTenderPage's set()
      // for the full rationale. Only "No EMD" clears Online/DD/exemption
      // data; Online, DD, and exemption criteria are otherwise independent.
      if (field === 'emd_not_applicable' && value) {
        updated.emd_amount = ''
        updated.emd_exemption_types = []
        updated.emd_exemption_reason = ''
        updated.emd_bank_name = ''
        updated.emd_account_number = ''
        updated.emd_ifsc_code = ''
        updated.emd_branch = ''
        updated.emd_beneficiary = ''
        updated.emd_payable_at = ''
      } else if (field === 'closing_date' && value) {
        const d = new Date(value)
        if (!isNaN(d.getTime())) {
          const year = d.getFullYear()
          const monthStr = String(d.getMonth() + 1).padStart(2, '0')
          updated.target_month_date = `${year}-${monthStr}-01`
        }
      }

      return updated
    })
    if (field === 'emd_not_applicable' && value) {
      setEmdOnlineOn(false)
      setEmdDdOn(false)
    }
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  const toggleEmdOnline = () => {
    setEmdOnlineOn((prev) => {
      const next = !prev
      if (!next) setForm((f) => ({ ...f, emd_bank_name: '', emd_account_number: '', emd_ifsc_code: '', emd_branch: '' }))
      return next
    })
    setErrors((e) => ({ ...e, emd_mode: undefined, emd_bank_name: undefined, emd_account_number: undefined, emd_ifsc_code: undefined }))
  }

  const toggleEmdDd = () => {
    setEmdDdOn((prev) => {
      const next = !prev
      if (!next) setForm((f) => ({ ...f, emd_beneficiary: '', emd_payable_at: '' }))
      return next
    })
    setErrors((e) => ({ ...e, emd_mode: undefined, emd_beneficiary: undefined, emd_payable_at: undefined }))
  }

  const toggleExemptionType = (type) => {
    setForm((f) => {
      const has = f.emd_exemption_types.includes(type)
      const next = has ? f.emd_exemption_types.filter((t) => t !== type) : [...f.emd_exemption_types, type]
      const updated = { ...f, emd_exemption_types: next }
      if (!next.includes('OTHER')) updated.emd_exemption_reason = ''
      return updated
    })
    setErrors((e) => ({ ...e, emd_mode: undefined, emd_exemption_reason: undefined }))
  }

  function validate() {
    const e = {}
    if (!form.title.trim())      e.title = 'Tender title is required'
    if (!form.bid_owner_id)      e.bid_owner_id = 'Bid owner is required'
    if (!form.account_manager_id) e.account_manager_id = 'Account Manager is required — they are the approving authority for this tender'
    // EMD is raw data off the tender document (mirrors AddTenderPage): Online,
    // DD, and exemption criteria are independent — tick whichever the
    // document actually offers.
    if (!form.emd_not_applicable) {
      if (emdOnlineOn) {
        if (!form.emd_bank_name.trim()) e.emd_bank_name = 'Bank name is required'
        if (!form.emd_account_number.trim()) e.emd_account_number = 'Account number is required'
        if (!form.emd_ifsc_code.trim()) e.emd_ifsc_code = 'IFSC code is required'
      }
      if (emdDdOn) {
        if (!form.emd_beneficiary.trim()) e.emd_beneficiary = 'Beneficiary is required'
        if (!form.emd_payable_at.trim()) e.emd_payable_at = 'Payable at location is required'
      }
      if (!emdOnlineOn && !emdDdOn && form.emd_exemption_types.length === 0) {
        e.emd_mode = 'Tick at least one: Online, DD, or an exemption criterion the tender document allows'
      }
      if (form.emd_exemption_types.includes('OTHER') && !form.emd_exemption_reason.trim()) {
        e.emd_exemption_reason = 'Please specify the Other exemption criterion'
      }
    }
    return e
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length > 0) {
      setErrors(e)
      toast.error('Please resolve validation errors')
      return
    }

    setLoading(true)
    try {
      const cleanProducts = products
        .filter(p => p.product.trim() || p.description.trim())
        .map(({ id, ...rest }) => rest)

      const payload = {
        ...form,
        quantity:        form.quantity ? Number(form.quantity) : null,
        estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
        emd_amount:      form.emd_amount ? Number(form.emd_amount) : null,
        bg_rate:         form.bg_required && form.bg_rate ? Number(form.bg_rate) : null,
        bg_duration_months: form.bg_required && form.bg_duration_months ? Number(form.bg_duration_months) : null,
        start_date:      form.opening_date ? new Date(form.opening_date).toISOString() : null,
        end_date:        form.closing_date ? new Date(form.closing_date).toISOString() : null,
        opening_date:    form.opening_date ? new Date(form.opening_date).toISOString() : null,
        closing_date:    form.closing_date ? new Date(form.closing_date).toISOString() : null,
        target_month_date: form.target_month_date ? new Date(form.target_month_date).toISOString() : null,
        reporting_manager_id: form.reporting_manager_id || null,
        presales_id:     form.presales_id || null,
        requested_products: JSON.stringify(cleanProducts),
        // Always sent (not just when set) so removing the note in the UI
        // actually clears it on save, the same way an emptied products list
        // does above — omitting the field would leave a stale note in place.
        alert_note: (showAlertNote && alertNoteText.trim())
          ? JSON.stringify({ text: alertNoteText.trim(), label: alertNoteLabel.trim(), color: alertNoteColor })
          : JSON.stringify(null),
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
                    <div className="col-span-2">
                      <Field label="High Level Scope">
                        <Textarea
                          value={form.high_level_scope}
                          onChange={(e) => set('high_level_scope', e.target.value)}
                          placeholder="Detail overall technical and operational scope..."
                          className="text-sm min-h-[60px]"
                        />
                      </Field>
                    </div>
                    <Field label="BID Number/RFP Number">
                      <Input value={form.gem_bid_no} onChange={(e) => set('gem_bid_no', e.target.value)}
                        placeholder="GEM/2026/B/12345 or RFP/2026/012" className={inputCls()} />
                    </Field>
                    <Field label="Portal Source">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full h-8 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5">
                            <span>{otherPortalSource ? 'Other' : form.portal_source}</span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[180px]">
                          <DropdownMenuLabel>Select Portal Source</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {PORTAL_SOURCES.map((p) => (
                            <DropdownMenuItem key={p} onSelect={() => {
                              if (p === 'Other') {
                                setOtherPortalSource(true)
                                set('portal_source', '')
                              } else {
                                setOtherPortalSource(false)
                                set('portal_source', p)
                              }
                            }}>
                              {p}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {otherPortalSource && (
                        <Input
                          value={form.portal_source}
                          onChange={(e) => set('portal_source', e.target.value)}
                          placeholder="Enter portal source name"
                          className={`${inputCls()} mt-2`}
                          autoFocus
                        />
                      )}
                    </Field>
                    <Field label="Bid Type">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full h-8 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5">
                            <span>{form.bid_type === 'BID_TO_RA' ? 'BID to RA' : 'BID'}</span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[180px]">
                          <DropdownMenuLabel>Select Bid Type</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {BID_TYPES.map((t) => (
                            <DropdownMenuItem key={t} onSelect={() => set('bid_type', t)}>
                              {t === 'BID_TO_RA' ? 'BID to RA' : 'BID'}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Field>
                    <Field label="Category">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full h-8 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5">
                            <span>{otherCategory ? 'Other' : (form.category || 'Select category...')}</span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[180px]">
                          <DropdownMenuLabel>Select Category</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {CATEGORY_OPTIONS.map((c) => (
                            <DropdownMenuItem key={c} onSelect={() => {
                              if (c === 'Other') {
                                setOtherCategory(true)
                                set('category', '')
                              } else {
                                setOtherCategory(false)
                                set('category', c)
                              }
                            }}>
                              {c}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {otherCategory && (
                        <Input
                          value={form.category}
                          onChange={(e) => set('category', e.target.value)}
                          placeholder="Enter category name"
                          className={`${inputCls()} mt-2`}
                          autoFocus
                        />
                      )}
                    </Field>
                    <Field label="Scope Type">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full h-8 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5">
                            <span>{form.scope_type}</span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[180px]">
                          <DropdownMenuLabel>Select Scope Type</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {SCOPE_TYPES.map((st) => (
                            <DropdownMenuItem key={st} onSelect={() => set('scope_type', st)}>
                              {st}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
                    <Field label="Account Name">
                      <Input value={form.organization_name} onChange={(e) => set('organization_name', e.target.value)}
                        placeholder="e.g. National Informatics Centre" className={inputCls()} />
                    </Field>
                    <Field label="Department / Ministry">
                      <Input value={form.department_name} onChange={(e) => set('department_name', e.target.value)}
                        placeholder="e.g. MeitY" className={inputCls()} />
                    </Field>
                    <Field label="Location">
                      <Input value={form.location} onChange={(e) => set('location', e.target.value)}
                        placeholder="e.g. New Delhi" className={inputCls()} />
                    </Field>
                  </div>
                </section>

                {/* Products/Services Asked in the RFP */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-md bg-violet-100 flex items-center justify-center">
                        <CheckSquare className="size-3.5 text-violet-600" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">Products/Services Asked in the RFP</h3>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addProductRow} className="h-7 text-xs gap-1">
                      <Plus className="size-3.5" /> Add Row
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product/Service</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-20">Quantity</TableHead>
                        <TableHead>OEM (Optional)</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="min-w-[140px]">
                            <Input value={p.product} onChange={(e) => updateProductRow(p.id, 'product', e.target.value)}
                              placeholder="e.g. Enterprise Firewall" className="h-8 text-xs bg-background" />
                          </TableCell>
                          <TableCell className="min-w-[180px]">
                            <Input value={p.description} onChange={(e) => updateProductRow(p.id, 'description', e.target.value)}
                              placeholder="Brief description" className="h-8 text-xs bg-background" />
                          </TableCell>
                          <TableCell className="w-20">
                            <Input type="number" min="1" value={p.qty} onChange={(e) => updateProductRow(p.id, 'qty', e.target.value)}
                              placeholder="Qty" className="h-8 text-xs bg-background" />
                          </TableCell>
                          <TableCell className="min-w-[120px]">
                            <Input value={p.oem} onChange={(e) => updateProductRow(p.id, 'oem', e.target.value)}
                              placeholder="OEM name" className="h-8 text-xs bg-background" />
                          </TableCell>
                          <TableCell>
                            <button type="button" onClick={() => removeProductRow(p.id)} disabled={products.length === 1}
                              className="text-muted-foreground hover:text-destructive p-1 disabled:opacity-30 disabled:cursor-not-allowed">
                              <Trash2 className="size-3.5" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
                    <Field label="Quantity">
                      <Input type="number" min="1" value={form.quantity} onChange={(e) => set('quantity', e.target.value)}
                        placeholder="e.g. 100" className={inputCls()} />
                    </Field>
                    <Field label="Estimated Value (₹)">
                      <Input type="number" value={form.estimated_value} onChange={(e) => set('estimated_value', e.target.value)}
                        placeholder="e.g. 2500000" className={inputCls()} />
                    </Field>
                    <Field label="EMD Amount (₹)">
                      <Input type="number" value={form.emd_amount} onChange={(e) => set('emd_amount', e.target.value)}
                        placeholder="e.g. 50000" className={`${inputCls()} ${form.emd_not_applicable ? 'opacity-50' : ''}`}
                        disabled={form.emd_not_applicable} />
                    </Field>

                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                      <div
                        onClick={() => set('emd_not_applicable', !form.emd_not_applicable)}
                        className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer
                          ${form.emd_not_applicable ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                      >
                        <span className={`absolute top-0.5 size-3 rounded-full bg-white shadow transition-transform
                          ${form.emd_not_applicable ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </div>
                      <span className="text-xs text-muted-foreground">No EMD</span>
                    </label>

                    {/* Bank Guarantee (BG) */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-foreground">Bank Guarantee (BG)</Label>
                      <div className="flex items-center gap-3 h-8">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <div
                            onClick={() => set('bg_required', !form.bg_required)}
                            className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer
                              ${form.bg_required ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                          >
                            <span className={`absolute top-0.5 size-3 rounded-full bg-white shadow transition-transform
                              ${form.bg_required ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </div>
                          <span className="text-xs text-muted-foreground">BG Required</span>
                        </label>
                      </div>
                    </div>
                    {form.bg_required && (
                      <Field label="BG Rate (%)">
                        <Input type="number" step="any" value={form.bg_rate} onChange={(e) => set('bg_rate', e.target.value)}
                          placeholder="e.g. 2.5" className={inputCls()} />
                      </Field>
                    )}
                    {form.bg_required && (
                      <Field label="BG Duration (months)">
                        <Input type="number" min="1" value={form.bg_duration_months} onChange={(e) => set('bg_duration_months', e.target.value)}
                          placeholder="e.g. 12" className={inputCls()} />
                      </Field>
                    )}

                    {errors.emd_mode && !form.emd_not_applicable && (
                      <p className="col-span-2 text-[11px] text-red-500">{errors.emd_mode}</p>
                    )}

                    {/* EMD via Online — independent checkbox, raw off the tender document */}
                    {!form.emd_not_applicable && (
                      <div className="col-span-2 space-y-3">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                          <input type="checkbox" checked={emdOnlineOn} onChange={toggleEmdOnline} className="accent-primary size-3.5 shrink-0" />
                          <span className="text-xs font-medium text-blue-800 dark:text-blue-200">
                            <strong>EMD via Online Payment</strong> — tick if the tender document offers this route.
                          </span>
                        </label>
                        {emdOnlineOn && (
                          <div className="grid grid-cols-2 gap-3">
                            <Field label="Bank Name" error={errors.emd_bank_name} required>
                              <Input
                                value={form.emd_bank_name}
                                onChange={(e) => set('emd_bank_name', e.target.value)}
                                placeholder="e.g. State Bank of India"
                                className={inputCls(errors.emd_bank_name)}
                              />
                            </Field>
                            <Field label="Account Number" error={errors.emd_account_number} required>
                              <Input
                                value={form.emd_account_number}
                                onChange={(e) => set('emd_account_number', e.target.value)}
                                placeholder="e.g. 012345678901"
                                className={inputCls(errors.emd_account_number)}
                              />
                            </Field>
                            <Field label="IFSC Code" error={errors.emd_ifsc_code} required>
                              <Input
                                value={form.emd_ifsc_code}
                                onChange={(e) => set('emd_ifsc_code', e.target.value.toUpperCase())}
                                placeholder="e.g. SBIN0001234"
                                className={inputCls(errors.emd_ifsc_code)}
                              />
                            </Field>
                            <Field label="Branch (If Required)">
                              <Input
                                value={form.emd_branch}
                                onChange={(e) => set('emd_branch', e.target.value)}
                                placeholder="e.g. New Delhi Main Branch"
                                className={inputCls()}
                              />
                            </Field>
                          </div>
                        )}
                      </div>
                    )}

                    {/* EMD via DD — independent checkbox, raw off the tender document */}
                    {!form.emd_not_applicable && (
                      <div className="col-span-2 space-y-3">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                          <input type="checkbox" checked={emdDdOn} onChange={toggleEmdDd} className="accent-primary size-3.5 shrink-0" />
                          <span className="text-xs font-medium text-amber-800 dark:text-amber-200">
                            <strong>EMD via Demand Draft (DD)</strong> — tick if the tender document offers this route.
                          </span>
                        </label>
                        {emdDdOn && (
                          <div className="grid grid-cols-2 gap-3">
                            <Field label="Beneficiary" error={errors.emd_beneficiary} required>
                              <Input
                                value={form.emd_beneficiary}
                                onChange={(e) => set('emd_beneficiary', e.target.value)}
                                placeholder="e.g. The Accounts Officer, NIC Delhi"
                                className={inputCls(errors.emd_beneficiary)}
                              />
                            </Field>
                            <Field label="Payable At" error={errors.emd_payable_at} required>
                              <Input
                                value={form.emd_payable_at}
                                onChange={(e) => set('emd_payable_at', e.target.value)}
                                placeholder="e.g. New Delhi"
                                className={inputCls(errors.emd_payable_at)}
                              />
                            </Field>
                          </div>
                        )}
                      </div>
                    )}

                    {/* EMD Exemption criteria — multi-select, independent of Online/DD */}
                    {!form.emd_not_applicable && (
                      <div className="col-span-2 space-y-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                        <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                          Exemption Criteria Listed In The Tender (tick all that apply)
                        </p>
                        <div className="flex flex-wrap items-center gap-4">
                          {['MSME', 'STARTUP', 'OTHER'].map((t) => (
                            <label key={t} className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-foreground">
                              <input
                                type="checkbox"
                                checked={form.emd_exemption_types.includes(t)}
                                onChange={() => toggleExemptionType(t)}
                                className="accent-primary"
                              />
                              {t === 'OTHER' ? 'Other' : t === 'STARTUP' ? 'Startup' : 'MSME'}
                            </label>
                          ))}
                        </div>
                        {form.emd_exemption_types.includes('OTHER') && (
                          <Input
                            value={form.emd_exemption_reason}
                            onChange={(e) => set('emd_exemption_reason', e.target.value)}
                            placeholder="Specify the Other exemption criterion"
                            className={inputCls(errors.emd_exemption_reason)}
                          />
                        )}
                        {errors.emd_exemption_reason && (
                          <p className="text-[11px] text-red-500">{errors.emd_exemption_reason}</p>
                        )}
                      </div>
                    )}
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
                      <Input type="datetime-local" value={form.closing_date}
                        onChange={(e) => set('closing_date', e.target.value)} className={inputCls()} />
                    </Field>
                  </div>
                </section>


                {/* Assignment & Remarks */}
                <section>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Bid Owner" error={errors.bid_owner_id} required>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={usersLoading || !canChangeOwner}>
                          <Button variant="outline" size="sm" disabled={usersLoading || !canChangeOwner} className={`w-full h-8 text-xs font-normal justify-between bg-background text-foreground hover:bg-muted/50 gap-1.5 ${errors.bid_owner_id ? 'border-destructive' : 'border-input'}`}>
                            <span>{form.bid_owner_id ? (users.find((u) => u.id === form.bid_owner_id)?.full_name ?? 'Select owner...') : 'Select owner...'}</span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="max-h-60 overflow-y-auto w-[220px]">
                          <DropdownMenuLabel>Select Bid Owner</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {users.map((u) => (
                            <DropdownMenuItem key={u.id} onSelect={() => {
                              if (u.id === form.account_manager_id) {
                                setAmOwnerCaution(true)
                                return
                              }
                              set('bid_owner_id', u.id)
                            }}>
                              {u.full_name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {!canChangeOwner && (
                        <p className="text-[11px] text-muted-foreground">
                          Only this tender's Account Manager or Reporting Manager can reassign the owner.
                        </p>
                      )}
                    </Field>

                    <Field label="Reporting Manager">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={usersLoading}>
                          <Button variant="outline" size="sm" className="w-full h-8 text-xs font-normal justify-between bg-background text-foreground hover:bg-muted/50 gap-1.5 border-input">
                            <span>{form.reporting_manager_id ? (users.find((u) => u.id === form.reporting_manager_id)?.full_name ?? 'Select manager...') : 'Select manager...'}</span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="max-h-60 overflow-y-auto w-[220px]">
                          <DropdownMenuLabel>Select Reporting Manager</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {users.map((u) => (
                            <DropdownMenuItem key={u.id} onSelect={() => set('reporting_manager_id', u.id)}>
                              {u.full_name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Field>

                    <Field label="Account Manager" error={errors.account_manager_id} required>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={usersLoading}>
                          <Button variant="outline" size="sm" className={`w-full h-8 text-xs font-normal justify-between bg-background text-foreground hover:bg-muted/50 gap-1.5 ${errors.account_manager_id ? 'border-destructive' : 'border-input'}`}>
                            <span>{form.account_manager_id ? (accountManagers.find((u) => u.id === form.account_manager_id)?.full_name ?? users.find((u) => u.id === form.account_manager_id)?.full_name ?? 'Select account manager...') : 'Select account manager...'}</span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="max-h-60 overflow-y-auto w-[220px]">
                          <DropdownMenuLabel>Select Account Manager</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {accountManagers.length === 0 ? (
                            <DropdownMenuItem disabled>No users hold the Account Manager role yet</DropdownMenuItem>
                          ) : (
                            accountManagers.map((u) => (
                              <DropdownMenuItem key={u.id} onSelect={() => set('account_manager_id', u.id)}>
                                {u.full_name}
                              </DropdownMenuItem>
                            ))
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Field>

                    <Field label="Pre-Sales">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={usersLoading}>
                          <Button variant="outline" size="sm" className="w-full h-8 text-xs font-normal justify-between bg-background text-foreground hover:bg-muted/50 gap-1.5 border-input">
                            <span>{form.presales_id ? (presalesUsers.find((u) => u.id === form.presales_id)?.full_name ?? users.find((u) => u.id === form.presales_id)?.full_name ?? 'Select pre-sales...') : 'None selected'}</span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="max-h-60 overflow-y-auto w-[220px]">
                          <DropdownMenuLabel>Select Pre-Sales</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => set('presales_id', '')}>None</DropdownMenuItem>
                          {presalesUsers.map((u) => (
                            <DropdownMenuItem key={u.id} onSelect={() => set('presales_id', u.id)}>
                              {u.full_name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Field>

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

                    {/* Additional Info / Challenge — optional, colored-label
                        note surfaced in the identification alert/mail. */}
                    <div className="sm:col-span-2">
                      {!showAlertNote ? (
                        <button
                          type="button"
                          onClick={() => setShowAlertNote(true)}
                          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                        >
                          <Plus className="size-3.5" /> Add Additional Info / Challenge
                        </button>
                      ) : (
                        <div className="space-y-2 p-3 rounded-lg border border-border/60 bg-muted/20">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold text-foreground">Additional Info / Challenge</Label>
                            <button
                              type="button"
                              onClick={() => { setShowAlertNote(false); setAlertNoteText(''); setAlertNoteLabel('') }}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              value={alertNoteLabel}
                              onChange={(e) => setAlertNoteLabel(e.target.value)}
                              placeholder="Label, e.g. Delivery Risk"
                              className="text-xs h-8 bg-background flex-1"
                            />
                            <span
                              className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full text-white shrink-0 whitespace-nowrap"
                              style={{ background: ALERT_NOTE_COLORS[alertNoteColor].solid }}
                            >
                              {alertNoteLabel.trim() || 'Attention'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setAlertNoteColor((c) => randomAlertNoteColor(c))}
                              title="Shuffle color"
                              className="p-1.5 rounded-md border border-border hover:bg-muted shrink-0"
                            >
                              <Shuffle className="size-3.5" />
                            </button>
                          </div>
                          <Textarea
                            value={alertNoteText}
                            onChange={(e) => setAlertNoteText(e.target.value)}
                            placeholder="Describe the challenge or issue to flag for reviewers..."
                            className="text-sm min-h-[60px] bg-background"
                          />
                        </div>
                      )}
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

          {/* Account-Manager-as-owner caution — a hard block, not a confirm:
              the AM owns this tender's Go/No-Go and pricing sign-off, so they
              can't also be the owner they're reviewing. */}
          <AnimatePresence>
            {amOwnerCaution && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
                  onClick={() => setAmOwnerCaution(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="relative z-10 w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl p-5 space-y-3"
                >
                  <h3 className="text-sm font-semibold text-foreground">Can't assign the Account Manager as owner</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    This user is this tender's Account Manager — the approving authority for its Primary Review
                    Go/No-Go and pricing sign-off. Assigning them as Bid Owner too would let them review their own
                    work, so choose a different owner.
                  </p>
                  <div className="flex justify-end">
                    <Button type="button" size="sm" onClick={() => setAmOwnerCaution(false)}>Got it</Button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </AnimatePresence>
  )
}
