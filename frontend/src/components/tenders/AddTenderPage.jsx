import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Loader2, Building2, FileText, DollarSign,
  ChevronLeft, Zap, PenLine, ShieldCheck, ChevronDown, Check,
  Plus, Trash2, HelpCircle, CheckSquare, Award, ArrowRight, ArrowLeft, Shuffle
} from 'lucide-react'
import { toast } from 'sonner'
import { ALERT_NOTE_COLORS, randomAlertNoteColor } from '../../lib/tenderFormat'

import { Button }    from '@/components/ui/button'
import { Input }     from '@/components/ui/input'
import { Label }     from '@/components/ui/label'
import { Textarea }  from '@/components/ui/textarea'
import { FieldMemoryInput } from '@/components/ui/field-memory-input'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { createBid } from '../../services/bids'
import { tokenStorage } from '../../services/auth'
import { useBidStore } from '../../store/useBidStore'

const STANDARD_PORTAL_SOURCES = ['GeM', 'CPPP', 'eProcure']
const PORTAL_SOURCES = [...STANDARD_PORTAL_SOURCES, 'Other']
const BID_TYPES      = ['BID', 'BID_TO_RA']
const SCOPE_TYPES    = ['Supply', 'Implementation', 'Support', 'N/A']
const STANDARD_CATEGORY_OPTIONS = [
  'End computing', 'IT infra', 'Non-IT infra', 'Security', 'Cloud',
  'Surveillance', 'Software', 'Manpower-augmentation',
]
const CATEGORY_OPTIONS = [...STANDARD_CATEGORY_OPTIONS, 'Other']

const BIDDER_SUGGESTIONS = [
  'Experience Certificate',
  'Company Information Docs',
  'Non-blacklisted Forms',
  'Bidder Turnover',
  'Technical Compliance Sheet'
]

const OEM_SUGGESTIONS = [
  'MAF Certificate',
  'MII Certificate',
  'No Malicious Certificate'
]

function inputCls(err) {
  return `h-9 text-sm w-full bg-background ${err ? 'border-destructive focus-visible:ring-destructive/30' : ''}`
}

function Field({ label, error, children, required, tooltip }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label} {required && <span className="text-destructive font-bold">*</span>}
        </Label>
        {tooltip && (
          <div className="group relative">
            <HelpCircle className="size-3 text-muted-foreground cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-48 bg-foreground text-background text-[10px] p-2 rounded shadow-lg z-50 text-center leading-normal">
              {tooltip}
            </div>
          </div>
        )}
      </div>
      {children}
      {error && <p className="text-xs text-destructive font-medium">{error}</p>}
    </div>
  )
}

export function AddTenderPage() {
  const navigate = useNavigate()
  const currentUser = tokenStorage.getUser()

  const { users, usersLoading, loadUsers, learnFieldValue } = useBidStore()

  // Stepper state
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(0) // -1 for back, 1 for forward

  const [form, setForm] = useState({
    creation_mode:               'MANUAL',
    title:                       '',
    high_level_scope:            '',
    gem_bid_no:                  '',
    organization_name:           '',
    department_name:             '',
    location:                    '',
    portal_source:               'GeM',
    bid_type:                    'BID',
    category:                    '',
    quantity:                    '',
    estimated_value:             '',
    emd_amount:                  '',
    emd_not_applicable:          false,
    emd_exemption_types:         [],
    emd_exemption_reason:        '',
    oem_required:                true,
    bg_required:                 false,
    bg_rate:                     '',
    bg_duration_months:          '',
    start_date:                  '',
    end_date:                    '',
    target_month_date:           '',
    bid_owner_id:                currentUser?.id ?? '',
    reporting_manager_id:        '',
    account_manager_id:          '',
    presales_id:                 '',
    remarks:                     '',
    scope_type:                  'Supply',
    // EMD bank/online payment details
    emd_bank_name:               '',
    emd_account_number:          '',
    emd_ifsc_code:               '',
    emd_branch:                  '',
    // EMD DD (Demand Draft) details
    emd_beneficiary:             '',
    emd_payable_at:              '',
  })

  // Dynamic checklists seed input list split for Bidder and OEM
  const [bidderChecklists, setBidderChecklists] = useState([])
  const [oemChecklists, setOemChecklists] = useState([])
  const [newBidderItem, setNewBidderItem] = useState('')
  const [newOemItem, setNewOemItem] = useState('')

  // Products/Services Asked in the RFP — freeform rows, OEM is optional per row
  const [products, setProducts] = useState([{ id: 1, product: '', description: '', qty: '', oem: '' }])
  const addProductRow = () => setProducts(prev => [...prev, { id: Date.now(), product: '', description: '', qty: '', oem: '' }])
  const updateProductRow = (id, field, value) => setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  const removeProductRow = (id) => setProducts(prev => prev.length > 1 ? prev.filter(p => p.id !== id) : prev)

  const [errors, setErrors]   = useState({})
  const [loading, setLoading] = useState(false)
  const [otherPortalSource, setOtherPortalSource] = useState(false)
  const [otherCategory, setOtherCategory] = useState(false)
  // Online/DD are independent raw-capture toggles — a tender document can
  // offer either, both, or neither (if fully exempt). Kept outside `form` so
  // unticking one can clear just its own fields without touching the other.
  const [emdOnlineOn, setEmdOnlineOn] = useState(false)
  const [emdDdOn, setEmdDdOn] = useState(false)

  // Optional "Additional Info / Challenge" note — a colored label + free
  // text surfaced in the identification alert/mail so a known issue gets
  // noticed immediately rather than buried in a plain remarks field.
  const [showAlertNote, setShowAlertNote] = useState(false)
  const [alertNoteText, setAlertNoteText] = useState('')
  const [alertNoteLabel, setAlertNoteLabel] = useState('')
  const [alertNoteColor, setAlertNoteColor] = useState(() => randomAlertNoteColor())

  // Account Manager is required (approving authority); Pre-Sales is optional —
  // both filtered to users holding that role as primary or secondary.
  const accountManagers = users.filter(u => Array.isArray(u.roles) && u.roles.includes('ACCOUNT_MANAGER'))
  const presalesUsers = users.filter(u => Array.isArray(u.roles) && u.roles.includes('PRE_SALES'))

  // Load users for owner selector
  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  // Pre-fill bid owner if users loaded
  useEffect(() => {
    if (currentUser?.id && !form.bid_owner_id) {
      setForm(f => ({ ...f, bid_owner_id: currentUser.id }))
    }
  }, [currentUser, form.bid_owner_id])

  function set(field, value) {
    setForm((f) => {
      let updated = { ...f, [field]: value }

      // EMD capture at add-time is raw data straight off the tender document:
      // Online, DD, and exemption criteria are all independent — a document
      // can offer any combination. "No EMD" is the only field that clears
      // everything else, since it means none of the rest applies at all.
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

  function validateStep(currentStep) {
    const e = {}
    if (currentStep === 1) {
      if (!form.title.trim()) e.title = 'Tender title is required'
      if (!form.bid_type) e.bid_type = 'Bid type is required'
      // EMD is raw data off the tender document: Online, DD, and exemption
      // criteria are independent — tick whichever the document actually
      // offers. The Account Manager decides which one to go with, later, in
      // Primary Review.
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
    } else if (currentStep === 2) {
      if (!form.bid_owner_id && !currentUser?.id) e.bid_owner_id = 'Bid owner is required'
      if (!form.account_manager_id) e.account_manager_id = 'Account Manager is required — they are the approving authority for this tender'
    }
    return e
  }

  function nextStep() {
    const e = validateStep(step)
    if (Object.keys(e).length > 0) {
      setErrors(e)
      toast.error('Please fill required fields before proceeding')
      return
    }
    setDirection(1)
    setStep(2)
  }

  function prevStep() {
    setDirection(-1)
    setStep(1)
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    const e = validateStep(step)
    if (Object.keys(e).length > 0) {
      setErrors(e)
      toast.error('Please resolve validation errors')
      return
    }

    setLoading(true)
    try {
      const activeOwnerId = form.bid_owner_id || currentUser?.id || ''
      const cleanProducts = products
        .filter(p => p.product.trim() || p.description.trim())
        .map(({ id, ...rest }) => rest)

      const payload = {
        ...form,
        bid_owner_id:    activeOwnerId,
        presales_id:     form.presales_id || undefined,
        quantity: form.quantity ? Number(form.quantity) : undefined,
        estimated_value: form.estimated_value ? Number(form.estimated_value) : undefined,
        emd_amount:      form.emd_amount ? Number(form.emd_amount) : undefined,
        bg_rate:         form.bg_required && form.bg_rate ? Number(form.bg_rate) : undefined,
        bg_duration_months: form.bg_required && form.bg_duration_months ? Number(form.bg_duration_months) : undefined,
        requested_products: cleanProducts.length > 0 ? JSON.stringify(cleanProducts) : undefined,
        alert_note: (showAlertNote && alertNoteText.trim())
          ? JSON.stringify({ text: alertNoteText.trim(), label: alertNoteLabel.trim(), color: alertNoteColor })
          : undefined,
        start_date:      form.start_date ? new Date(form.start_date).toISOString() : undefined,
        end_date:        form.end_date ? new Date(form.end_date).toISOString() : undefined,
        opening_date:    form.start_date ? new Date(form.start_date).toISOString() : undefined,
        closing_date:    form.end_date ? new Date(form.end_date).toISOString() : undefined,
        target_month_date: form.target_month_date ? new Date(form.target_month_date).toISOString() : undefined,
        bidder_checklists: bidderChecklists.map((item) => `[Bidder] ${item.replace(/^\[(Bidder|OEM)\]\s*/i, '')}`),
        oem_checklists:    oemChecklists.map((item) => `[OEM] ${item.replace(/^\[(Bidder|OEM)\]\s*/i, '')}`),
      }

      // Remove empty strings
      Object.keys(payload).forEach((k) => {
        if (payload[k] === '' || payload[k] === undefined) delete payload[k]
      })

      const res = await createBid(payload)
      if (res.ok) {
        // Field Memory: make the values just typed available as suggestions
        // right away, without waiting for a refetch of each field's list.
        learnFieldValue('organization_name', form.organization_name)
        learnFieldValue('department_name', form.department_name)
        learnFieldValue('location', form.location)
        learnFieldValue('emd_bank_name', form.emd_bank_name)
        learnFieldValue('emd_beneficiary', form.emd_beneficiary)
        learnFieldValue('emd_payable_at', form.emd_payable_at)
        cleanProducts.forEach((p) => learnFieldValue('oem', p.oem))

        toast.success('Tender workspace created successfully!')
        navigate('/dashboard/tenders')
      } else {
        toast.error(res.error?.message ?? 'Failed to create tender')
      }
    } catch {
      toast.error('Network error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const stepsInfo = [
    { num: 1, label: 'Core Specifications & Financial Scope', icon: FileText },
    { num: 2, label: 'Team Assignment & Checklist Seeds', icon: ShieldCheck },
  ]

  // Checklist Helpers
  const addBidderSuggestion = (item) => {
    if (!bidderChecklists.includes(item)) setBidderChecklists(prev => [...prev, item])
  }
  const addOemSuggestion = (item) => {
    if (!oemChecklists.includes(item)) setOemChecklists(prev => [...prev, item])
  }
  const addCustomBidder = () => {
    if (newBidderItem.trim() && !bidderChecklists.includes(newBidderItem.trim())) {
      setBidderChecklists(prev => [...prev, newBidderItem.trim()])
      setNewBidderItem('')
    }
  }
  const addCustomOem = () => {
    if (newOemItem.trim() && !oemChecklists.includes(newOemItem.trim())) {
      setOemChecklists(prev => [...prev, newOemItem.trim()])
      setNewOemItem('')
    }
  }
  const removeBidderItem = (idx) => setBidderChecklists(prev => prev.filter((_, i) => i !== idx))
  const removeOemItem = (idx) => setOemChecklists(prev => prev.filter((_, i) => i !== idx))

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Breadcrumb / Back Button */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard/tenders')}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to Tenders
        </Button>
      </div>

      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold font-heading tracking-tight text-foreground">Add New Tender</h1>
        <p className="text-sm text-muted-foreground">
          Fill in specifications, financials, timelines, and document checklists to initialize a new GeM bid workspace.
        </p>
      </div>

      {/* Stepper Progress Bar */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          {stepsInfo.map((s, i) => {
            const isCompleted = step > s.num
            const isActive = step === s.num
            return (
              <React.Fragment key={s.num}>
                <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => {
                  if (s.num < step) {
                    setDirection(-1)
                    setStep(s.num)
                  } else if (s.num > step) {
                    nextStep()
                  }
                }}>
                  <div className={`size-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all duration-300
                    ${isCompleted ? 'bg-primary border-primary text-primary-foreground'
                      : isActive ? 'bg-primary/10 border-primary text-primary ring-4 ring-primary/10 scale-105'
                                 : 'bg-background border-border text-muted-foreground'}`}>
                    {isCompleted ? <Check className="size-4" /> : s.num}
                  </div>
                  <div className="hidden md:block text-left">
                    <span className={`text-[10px] font-bold uppercase tracking-wider block leading-tight
                      ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>Section {s.num}</span>
                    <span className={`text-xs font-medium block leading-none mt-0.5
                      ${isActive ? 'text-foreground' : 'text-muted-foreground/80'}`}>{s.label}</span>
                  </div>
                </div>
                {i < stepsInfo.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-2 rounded-full transition-colors duration-300 ${step > s.num ? 'bg-primary' : 'bg-border'}`} />
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* Main Wizard Form Container */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-md min-h-[460px] flex flex-col">
        <div className="p-6 flex-1">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: direction > 0 ? 30 : -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction > 0 ? -30 : 30 }}
              transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              className="space-y-6"
            >
              {/* SECTION 1: Core Specifications, Financials & Dates */}
              {step === 1 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 border-b border-border/60 pb-2.5">
                    <FileText className="size-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Section 1: Basic Specifications & Financial Scope</h3>
                  </div>

                  {/* BUBBLE: Account & Tender Identity */}
                  <div className="space-y-4 border border-border/80 rounded-xl p-4 bg-muted/5">
                    <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                      <Building2 className="size-4 text-primary" />
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Account & Tender Identity</h4>
                    </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Account Name (the procuring authority / client organization) */}
                    <Field label="Account Name" tooltip="The procuring authority / client organization for this tender.">
                      <FieldMemoryInput fieldKey="organization_name" value={form.organization_name} onChange={(v) => set('organization_name', v)}
                        placeholder="e.g. NIC Delhi" className={inputCls()} />
                    </Field>

                    {/* Department / Ministry */}
                    <Field label="Department / Ministry">
                      <FieldMemoryInput fieldKey="department_name" value={form.department_name} onChange={(v) => set('department_name', v)}
                        placeholder="e.g. Ministry of Electronics & IT" className={inputCls()} />
                    </Field>

                    {/* Location */}
                    <Field label="Location">
                      <FieldMemoryInput fieldKey="location" value={form.location} onChange={(v) => set('location', v)}
                        placeholder="e.g. New Delhi" className={inputCls()} />
                    </Field>

                    {/* Tender Title */}
                    <div className="sm:col-span-2">
                      <Field label="Tender Title" error={errors.title} required tooltip="The primary title of the tender.">
                        <Input
                          value={form.title}
                          onChange={(e) => set('title', e.target.value)}
                          placeholder="e.g. Supply and Implementation of Enterprise Firewall"
                          className={inputCls(errors.title)}
                        />
                      </Field>
                    </div>

                    {/* BID / RFP Number */}
                    <Field label="BID Number/RFP Number" tooltip="The BID number or RFP number as listed on the source portal.">
                      <Input value={form.gem_bid_no} onChange={(e) => set('gem_bid_no', e.target.value)}
                        placeholder="e.g. GEM/2026/B/87654 or RFP/2026/012" className={inputCls()} />
                    </Field>

                    {/* High Level Scope */}
                    <div className="sm:col-span-2">
                      <Field label="High Level Scope" tooltip="Summary of high level work scope and deliverables.">
                        <Textarea
                          value={form.high_level_scope}
                          onChange={(e) => set('high_level_scope', e.target.value)}
                          placeholder="Detail overall technical and operational scope..."
                          className="text-sm min-h-[70px] bg-background"
                        />
                      </Field>
                    </div>

                    {/* Dates */}
                    <Field label="Start Date">
                      <Input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)}
                        className={inputCls()} />
                    </Field>

                    <Field label="End Date">
                      <Input type="datetime-local" value={form.end_date} onChange={(e) => set('end_date', e.target.value)}
                        className={inputCls()} />
                    </Field>

                    {/* Portal Source */}
                    <Field label="Portal Source">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full h-9 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5">
                            <span>{otherPortalSource ? 'Other' : form.portal_source}</span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[220px]">
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

                    {/* Bid Type (BID / BID_TO_RA) */}
                    <Field label="Bid Type" error={errors.bid_type} required>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full h-9 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5">
                            <span>{form.bid_type === 'BID_TO_RA' ? 'BID to RA' : 'BID'}</span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[220px]">
                          {BID_TYPES.map((t) => (
                            <DropdownMenuItem key={t} onSelect={() => set('bid_type', t)}>
                              {t === 'BID_TO_RA' ? 'BID to RA' : 'BID'}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Field>

                    {/* Category / Scope Group */}
                    <Field label="Category / Scope Group">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full h-9 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5">
                            <span>{otherCategory ? 'Other' : (form.category || 'Select category...')}</span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[220px]">
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

                    {/* Scope Type */}
                    <Field label="Scope Type">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full h-9 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5">
                            <span>{form.scope_type}</span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[220px]">
                          {SCOPE_TYPES.map((st) => (
                            <DropdownMenuItem key={st} onSelect={() => set('scope_type', st)}>
                              {st}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Field>

                    {/* Every tender is for some number of units or licences. */}
                    <Field label="Quantity">
                      <Input type="number" min="1" value={form.quantity} onChange={(e) => set('quantity', e.target.value)}
                        placeholder="e.g. 100" className={inputCls()} />
                    </Field>

                    {/* Financial Fields */}
                    <Field label="Estimated Tender Value (₹)">
                      <Input type="number" value={form.estimated_value} onChange={(e) => set('estimated_value', e.target.value)}
                        placeholder="e.g. 5000000" className={inputCls()} />
                    </Field>
                  </div>
                  </div>

                  {/* BUBBLE: Products/Services Asked in the RFP */}
                  <div className="space-y-4 border border-border/80 rounded-xl p-4 bg-muted/5">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="size-4 text-primary" />
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Products/Services Asked in the RFP</h4>
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
                          <TableHead className="w-24">Quantity</TableHead>
                          <TableHead>OEM (Optional)</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="min-w-[160px]">
                              <Input value={p.product} onChange={(e) => updateProductRow(p.id, 'product', e.target.value)}
                                placeholder="e.g. Enterprise Firewall" className="h-8 text-xs bg-background" />
                            </TableCell>
                            <TableCell className="min-w-[200px]">
                              <Input value={p.description} onChange={(e) => updateProductRow(p.id, 'description', e.target.value)}
                                placeholder="Brief description" className="h-8 text-xs bg-background" />
                            </TableCell>
                            <TableCell className="w-24">
                              <Input type="number" min="1" value={p.qty} onChange={(e) => updateProductRow(p.id, 'qty', e.target.value)}
                                placeholder="Qty" className="h-8 text-xs bg-background" />
                            </TableCell>
                            <TableCell className="min-w-[140px]">
                              <FieldMemoryInput fieldKey="oem" value={p.oem} onChange={(v) => updateProductRow(p.id, 'oem', v)}
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
                    <p className="text-[11px] text-muted-foreground italic">Add every product or service the RFP is asking for — each line becomes selectable later during Pricing.</p>
                  </div>

                  {/* BUBBLE: Financials — EMD & Bank Guarantee */}
                  <div className="space-y-4 border border-border/80 rounded-xl p-4 bg-muted/5">
                    <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                      <DollarSign className="size-4 text-emerald-600" />
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Financials — EMD &amp; Bank Guarantee</h4>
                    </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-end gap-3 w-full">
                      <div className="flex-1">
                        <Field label="EMD Amount (₹)">
                          <Input type="number" value={form.emd_amount} onChange={(e) => set('emd_amount', e.target.value)}
                            placeholder="e.g. 100000" className={`${inputCls()} ${form.emd_not_applicable ? 'opacity-50' : ''}`}
                            disabled={form.emd_not_applicable} />
                        </Field>
                      </div>
                      <div className="h-9 flex items-center shrink-0">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <div
                            onClick={() => set('emd_not_applicable', !form.emd_not_applicable)}
                            className={`w-7 h-4 rounded-full transition-colors relative cursor-pointer
                              ${form.emd_not_applicable ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                          >
                            <span className={`absolute top-0.5 size-3 rounded-full bg-white shadow transition-transform
                              ${form.emd_not_applicable ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                          </div>
                          <span className="text-[11px] font-medium text-muted-foreground">No EMD</span>
                        </label>
                      </div>
                    </div>

                    {/* No EMD */}
                    {form.emd_not_applicable && (
                      <div className="sm:col-span-2 p-3 rounded-lg bg-muted/40 border border-border">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">No EMD</span> — this tender has no Earnest Money Deposit requirement at all. Nothing further to configure here.
                        </p>
                      </div>
                    )}

                    {!form.emd_not_applicable && (
                      <div className="sm:col-span-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800">
                        <p className="text-xs text-slate-700 dark:text-slate-300">
                          Tick whichever payment modes and exemption criteria the tender document actually offers — a document can list Online, DD, both, or neither if fully exempt. The Account Manager picks the one to actually go with during Primary Review.
                        </p>
                      </div>
                    )}

                    {errors.emd_mode && !form.emd_not_applicable && (
                      <p className="sm:col-span-2 text-[11px] text-red-500">{errors.emd_mode}</p>
                    )}

                    {/* EMD via Online — independent checkbox, raw off the tender document */}
                    {!form.emd_not_applicable && (
                      <div className="sm:col-span-2 space-y-3">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                          <input type="checkbox" checked={emdOnlineOn} onChange={toggleEmdOnline} className="accent-primary size-3.5 shrink-0" />
                          <span className="text-xs font-medium text-blue-800 dark:text-blue-200">
                            <strong>EMD via Online Payment</strong> — tick if the tender document offers this route.
                          </span>
                        </label>
                        {emdOnlineOn && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Bank Name" error={errors.emd_bank_name} required>
                              <FieldMemoryInput
                                fieldKey="emd_bank_name"
                                value={form.emd_bank_name}
                                onChange={(v) => set('emd_bank_name', v)}
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
                      <div className="sm:col-span-2 space-y-3">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                          <input type="checkbox" checked={emdDdOn} onChange={toggleEmdDd} className="accent-primary size-3.5 shrink-0" />
                          <span className="text-xs font-medium text-amber-800 dark:text-amber-200">
                            <strong>EMD via Demand Draft (DD)</strong> — tick if the tender document offers this route.
                          </span>
                        </label>
                        {emdDdOn && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Beneficiary" error={errors.emd_beneficiary} required>
                              <FieldMemoryInput
                                fieldKey="emd_beneficiary"
                                value={form.emd_beneficiary}
                                onChange={(v) => set('emd_beneficiary', v)}
                                placeholder="e.g. The Accounts Officer, NIC Delhi"
                                className={inputCls(errors.emd_beneficiary)}
                              />
                            </Field>
                            <Field label="Payable At" error={errors.emd_payable_at} required>
                              <FieldMemoryInput
                                fieldKey="emd_payable_at"
                                value={form.emd_payable_at}
                                onChange={(v) => set('emd_payable_at', v)}
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
                      <div className="sm:col-span-2 space-y-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
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

                    {/* BG Required Toggle & Rate */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Bank Guarantee (BG)
                      </Label>
                      <div className="flex items-center gap-4 h-9">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <div
                            onClick={() => set('bg_required', !form.bg_required)}
                            className={`w-7 h-4 rounded-full transition-colors relative cursor-pointer
                              ${form.bg_required ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                          >
                            <span className={`absolute top-0.5 size-3 rounded-full bg-white shadow transition-transform
                              ${form.bg_required ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                          </div>
                          <span className="text-[11px] font-medium text-muted-foreground">BG Required</span>
                        </label>

                        {form.bg_required && (
                          <div className="flex-1">
                            <Input type="number" step="any" value={form.bg_rate} onChange={(e) => set('bg_rate', e.target.value)}
                              placeholder="BG Rate (%) e.g. 2.5" className={inputCls()} />
                          </div>
                        )}
                        {form.bg_required && (
                          <div className="flex-1">
                            <Input type="number" min="1" value={form.bg_duration_months} onChange={(e) => set('bg_duration_months', e.target.value)}
                              placeholder="BG Duration (months) e.g. 12" className={inputCls()} />
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                  </div>
                </div>
              )}

              {/* SECTION 2: Ownership, Reporting Manager & Checklist Seeds */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 border-b border-border/60 pb-2.5">
                    <ShieldCheck className="size-4 text-violet-500" />
                    <h3 className="text-sm font-semibold text-foreground">Section 2: Team Assignment & Checklist Seeds</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Bid Owner selection */}
                    <Field label="Bid Owner" error={errors.bid_owner_id} required tooltip="Defaults to the logged in user.">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className={`w-full h-9 text-xs font-normal justify-between bg-background text-foreground hover:bg-muted/50 gap-1.5 ${errors.bid_owner_id ? 'border-destructive' : 'border-input'}`}>
                            <span>{form.bid_owner_id ? (users.find(u => u.id === form.bid_owner_id)?.full_name ?? currentUser?.full_name ?? 'Select Owner...') : (currentUser?.full_name ?? 'Select Owner...')}</span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="max-h-60 overflow-y-auto w-[320px]">
                          <DropdownMenuLabel>Select Owner</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {usersLoading ? (
                            <DropdownMenuItem disabled>Loading users…</DropdownMenuItem>
                          ) : (
                            users.map((u) => (
                              <DropdownMenuItem key={u.id} onSelect={() => set('bid_owner_id', u.id)}>
                                {u.full_name}
                              </DropdownMenuItem>
                            ))
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Field>

                    {/* Reporting Manager selection */}
                    <Field label="Reporting Manager" tooltip="Notified when this tender is discovered and tracked as a tender member.">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full h-9 text-xs font-normal justify-between bg-background text-foreground hover:bg-muted/50 gap-1.5 border-input">
                            <span>{form.reporting_manager_id ? (users.find(u => u.id === form.reporting_manager_id)?.full_name ?? 'Select Manager...') : 'Select Reporting Manager...'}</span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="max-h-60 overflow-y-auto w-[320px]">
                          <DropdownMenuLabel>Select Reporting Manager</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {usersLoading ? (
                            <DropdownMenuItem disabled>Loading users…</DropdownMenuItem>
                          ) : (
                            users.map((u) => (
                              <DropdownMenuItem key={u.id} onSelect={() => set('reporting_manager_id', u.id)}>
                                {u.full_name}
                              </DropdownMenuItem>
                            ))
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Field>

                    {/* Account Manager selection — required, the approving authority for this tender */}
                    <Field label="Account Manager" error={errors.account_manager_id} required tooltip="The approving authority for this tender — owns the Primary Review Go/No-Go decision.">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className={`w-full h-9 text-xs font-normal justify-between bg-background text-foreground hover:bg-muted/50 gap-1.5 ${errors.account_manager_id ? 'border-destructive' : 'border-input'}`}>
                            <span>{form.account_manager_id ? (accountManagers.find(u => u.id === form.account_manager_id)?.full_name ?? 'Select Account Manager...') : 'Select Account Manager...'}</span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="max-h-60 overflow-y-auto w-[320px]">
                          <DropdownMenuLabel>Select Account Manager</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {usersLoading ? (
                            <DropdownMenuItem disabled>Loading users…</DropdownMenuItem>
                          ) : accountManagers.length === 0 ? (
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

                    {/* Pre-Sales selection — optional, can also be assigned later during Primary Review */}
                    <Field label="Pre-Sales" tooltip="Optional. Reviews OEM authorization for the proposed products. Can also be assigned later during Primary Review.">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full h-9 text-xs font-normal justify-between bg-background text-foreground hover:bg-muted/50 gap-1.5 border-input">
                            <span>{form.presales_id ? (presalesUsers.find(u => u.id === form.presales_id)?.full_name ?? 'Select Pre-Sales...') : 'None selected'}</span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="max-h-60 overflow-y-auto w-[320px]">
                          <DropdownMenuLabel>Select Pre-Sales</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => set('presales_id', '')}>None</DropdownMenuItem>
                          {presalesUsers.length === 0 ? (
                            <DropdownMenuItem disabled>No users hold the Pre-Sales role yet</DropdownMenuItem>
                          ) : (
                            presalesUsers.map((u) => (
                              <DropdownMenuItem key={u.id} onSelect={() => set('presales_id', u.id)}>
                                {u.full_name}
                              </DropdownMenuItem>
                            ))
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Field>

                    {/* Internal Remarks */}
                    <div className="sm:col-span-2">
                      <Field label="Remarks & Internal Notes">
                        <Textarea
                          value={form.remarks}
                          onChange={(e) => set('remarks', e.target.value)}
                          placeholder="Provide additional details regarding delivery terms, OEM contacts, bid security conditions, etc."
                          className="text-sm min-h-[60px] bg-background"
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

                  {/* Checklist Seeds Grid */}
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                      <CheckSquare className="size-4 text-primary" />
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Document Checklist Seeds</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Bidder Docs */}
                      <div className="space-y-4 border border-border/80 rounded-xl p-4 bg-muted/5">
                        <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                          <Award className="size-4 text-primary" />
                          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Bidder Docs Checklist</h4>
                        </div>

                        {/* Suggestions */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Recommended Suggestions</span>
                          <div className="flex flex-wrap gap-1.5">
                            {BIDDER_SUGGESTIONS.map((item) => {
                              const isAdded = bidderChecklists.includes(item)
                              return (
                                <button
                                  key={item}
                                  type="button"
                                  disabled={isAdded}
                                  onClick={() => addBidderSuggestion(item)}
                                  className={`text-[11px] px-2.5 py-1 rounded-md border transition-all flex items-center gap-1.5
                                    ${isAdded
                                      ? 'bg-muted text-muted-foreground border-border/40 cursor-default opacity-60'
                                      : 'bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 hover:border-primary/40 cursor-pointer'}`}
                                >
                                  {isAdded ? <Check className="size-3 text-emerald-500" /> : <Plus className="size-3" />}
                                  {item}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Custom Input */}
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add custom bidder doc..."
                            value={newBidderItem}
                            onChange={(e) => setNewBidderItem(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomBidder() } }}
                            className="h-8 text-xs bg-background"
                          />
                          <Button type="button" size="sm" onClick={addCustomBidder} className="h-8 text-xs px-3">
                            <Plus className="size-3.5" />
                          </Button>
                        </div>

                        {/* Current List */}
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Added Bidder Items ({bidderChecklists.length})</span>
                          {bidderChecklists.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic py-2">No bidder items added yet.</p>
                          ) : (
                            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                              {bidderChecklists.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 rounded-md bg-background border border-border/60 text-xs">
                                  <span className="truncate pr-2 font-medium">{item}</span>
                                  <button type="button" onClick={() => removeBidderItem(idx)} className="text-muted-foreground hover:text-destructive p-0.5">
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* OEM Docs */}
                      <div className="space-y-4 border border-border/80 rounded-xl p-4 bg-muted/5">
                        <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                          <Building2 className="size-4 text-violet-500" />
                          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">OEM Docs Checklist</h4>
                        </div>

                        {/* Suggestions */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Recommended Suggestions</span>
                          <div className="flex flex-wrap gap-1.5">
                            {OEM_SUGGESTIONS.map((item) => {
                              const isAdded = oemChecklists.includes(item)
                              return (
                                <button
                                  key={item}
                                  type="button"
                                  disabled={isAdded}
                                  onClick={() => addOemSuggestion(item)}
                                  className={`text-[11px] px-2.5 py-1 rounded-md border transition-all flex items-center gap-1.5
                                    ${isAdded
                                      ? 'bg-muted text-muted-foreground border-border/40 cursor-default opacity-60'
                                      : 'bg-violet-500/5 text-violet-600 border-violet-500/20 hover:bg-violet-500/10 hover:border-violet-500/40 cursor-pointer dark:text-violet-400'}`}
                                >
                                  {isAdded ? <Check className="size-3 text-emerald-500" /> : <Plus className="size-3" />}
                                  {item}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Custom Input */}
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add custom OEM doc..."
                            value={newOemItem}
                            onChange={(e) => setNewOemItem(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomOem() } }}
                            className="h-8 text-xs bg-background"
                          />
                          <Button type="button" size="sm" onClick={addCustomOem} className="h-8 text-xs px-3">
                            <Plus className="size-3.5" />
                          </Button>
                        </div>

                        {/* Current List */}
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Added OEM Items ({oemChecklists.length})</span>
                          {oemChecklists.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic py-2">No OEM items added yet.</p>
                          ) : (
                            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                              {oemChecklists.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 rounded-md bg-background border border-border/60 text-xs">
                                  <span className="truncate pr-2 font-medium">{item}</span>
                                  <button type="button" onClick={() => removeOemItem(idx)} className="text-muted-foreground hover:text-destructive p-0.5">
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Navigation Buttons */}
        <div className="p-4 bg-muted/20 border-t border-border/80 flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={prevStep}
            disabled={step === 1 || loading}
            className="gap-1.5"
          >
            <ArrowLeft className="size-4" />
            Previous
          </Button>

          <div className="flex items-center gap-3">
            {step < 2 ? (
              <Button
                type="button"
                size="sm"
                onClick={nextStep}
                className="gap-1.5"
              >
                Next: Section 2
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleSubmit}
                disabled={loading}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                Create Tender Workspace
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
