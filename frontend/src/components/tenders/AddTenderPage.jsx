import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Loader2, Building2, FileText, DollarSign,
  ChevronLeft, Zap, PenLine, ShieldCheck, ChevronDown, Check,
  Plus, Trash2, HelpCircle, CheckSquare, Award, ArrowRight, ArrowLeft
} from 'lucide-react'
import { toast } from 'sonner'

import { Button }    from '@/components/ui/button'
import { Input }     from '@/components/ui/input'
import { Label }     from '@/components/ui/label'
import { Textarea }  from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { createBid } from '../../services/bids'
import { tokenStorage } from '../../services/auth'
import { useBidStore } from '../../store/useBidStore'

const STANDARD_PORTAL_SOURCES = ['GeM', 'CPPP', 'eProcure']
const PORTAL_SOURCES = [...STANDARD_PORTAL_SOURCES, 'Other']
const BID_TYPES      = ['BID', 'BID_TO_RA']
const EMD_TYPES      = ['ONLINE', 'DD']
const SCOPE_TYPES    = ['Supply', 'Implementation', 'Support', 'N/A']
const CATEGORY_OPTIONS = [
  'End computing', 'IT infra', 'Non-IT infra', 'Security', 'Cloud',
  'Servilance', 'Software', 'Manpower-augmentation',
]

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

  const { users, usersLoading, loadUsers } = useBidStore()

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
    portal_source:               'GeM',
    bid_type:                    'BID',
    category:                    '',
    estimated_value:             '',
    emd_amount:                  '',
    emd_type:                    'ONLINE',
    emd_exempted:                false,
    emd_exemption_type:          '',
    emd_exemption_reason:        '',
    oem_required:                true,
    bg_required:                 false,
    bg_rate:                     '',
    start_date:                  '',
    end_date:                    '',
    target_month_date:           '',
    bid_owner_id:                currentUser?.id ?? '',
    reporting_manager_id:        '',
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

  const [errors, setErrors]   = useState({})
  const [loading, setLoading] = useState(false)
  const [otherPortalSource, setOtherPortalSource] = useState(false)

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

      if (field === 'emd_exempted') {
        if (value) {
          updated.emd_type = 'EXEMPTED'
          updated.emd_amount = ''
        } else {
          updated.emd_type = 'ONLINE'
          updated.emd_exemption_type = ''
          updated.emd_exemption_reason = ''
        }
      } else if (field === 'emd_type') {
        if (value === 'EXEMPTED') {
          updated.emd_exempted = true
          updated.emd_amount = ''
        } else {
          updated.emd_exempted = false
          updated.emd_exemption_type = ''
          updated.emd_exemption_reason = ''
        }
      } else if (field === 'emd_exemption_type') {
        if (value !== 'OTHER') updated.emd_exemption_reason = ''
      }

      return updated
    })
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function validateStep(currentStep) {
    const e = {}
    if (currentStep === 1) {
      if (!form.title.trim()) e.title = 'Tender title is required'
      if (!form.bid_type) e.bid_type = 'Bid type is required'
      // EMD bank/DD mandatory fields
      if (!form.emd_exempted) {
        if (form.emd_type === 'ONLINE') {
          if (!form.emd_bank_name.trim()) e.emd_bank_name = 'Bank name is required for Online EMD'
          if (!form.emd_account_number.trim()) e.emd_account_number = 'Account number is required'
          if (!form.emd_ifsc_code.trim()) e.emd_ifsc_code = 'IFSC code is required'
        } else if (form.emd_type === 'DD') {
          if (!form.emd_beneficiary.trim()) e.emd_beneficiary = 'Beneficiary is required for DD EMD'
          if (!form.emd_payable_at.trim()) e.emd_payable_at = 'Payable at location is required'
        }
      } else {
        if (!form.emd_exemption_type) e.emd_exemption_type = 'Select MSME, Startup, or Other'
        else if (form.emd_exemption_type === 'OTHER' && !form.emd_exemption_reason.trim()) {
          e.emd_exemption_reason = 'Please specify the reason for exemption'
        }
      }
    } else if (currentStep === 2) {
      if (!form.bid_owner_id && !currentUser?.id) e.bid_owner_id = 'Bid owner is required'
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

      const payload = {
        ...form,
        bid_owner_id:    activeOwnerId,
        estimated_value: form.estimated_value ? Number(form.estimated_value) : undefined,
        emd_amount:      form.emd_amount ? Number(form.emd_amount) : undefined,
        bg_rate:         form.bg_required && form.bg_rate ? Number(form.bg_rate) : undefined,
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                    {/* BID / RFP Number */}
                    <Field label="BID Number/RFP Number" tooltip="The BID number or RFP number as listed on the source portal.">
                      <Input value={form.gem_bid_no} onChange={(e) => set('gem_bid_no', e.target.value)}
                        placeholder="e.g. GEM/2026/B/87654 or RFP/2026/012" className={inputCls()} />
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
                            <span>{form.category || 'Select category...'}</span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[220px]">
                          {CATEGORY_OPTIONS.map((c) => (
                            <DropdownMenuItem key={c} onSelect={() => set('category', c)}>
                              {c}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Field>

                    {/* Authority Organization */}
                    <Field label="Authority / Client Organization">
                      <Input value={form.organization_name} onChange={(e) => set('organization_name', e.target.value)}
                        placeholder="e.g. NIC Delhi" className={inputCls()} />
                    </Field>

                    {/* Department / Ministry */}
                    <Field label="Department / Ministry">
                      <Input value={form.department_name} onChange={(e) => set('department_name', e.target.value)}
                        placeholder="e.g. Ministry of Electronics & IT" className={inputCls()} />
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

                    {/* Financial Fields */}
                    <Field label="Estimated Tender Value (₹)">
                      <Input type="number" value={form.estimated_value} onChange={(e) => set('estimated_value', e.target.value)}
                        placeholder="e.g. 5000000" className={inputCls()} />
                    </Field>

                    <div className="flex items-end gap-3 w-full">
                      <div className="flex-1">
                        <Field label="EMD Amount (₹)">
                          <Input type="number" value={form.emd_amount} onChange={(e) => set('emd_amount', e.target.value)}
                            placeholder="e.g. 100000" className={`${inputCls()} ${form.emd_exempted ? 'opacity-50' : ''}`}
                            disabled={form.emd_exempted} />
                        </Field>
                      </div>
                      <div className="h-9 flex items-center shrink-0">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <div
                            onClick={() => set('emd_exempted', !form.emd_exempted)}
                            className={`w-7 h-4 rounded-full transition-colors relative cursor-pointer
                              ${form.emd_exempted ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                          >
                            <span className={`absolute top-0.5 size-3 rounded-full bg-white shadow transition-transform
                              ${form.emd_exempted ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                          </div>
                          <span className="text-[11px] font-medium text-muted-foreground">Exempted</span>
                        </label>
                      </div>
                    </div>

                    {/* EMD Exemption Basis */}
                    {form.emd_exempted && (
                      <div className="sm:col-span-2 space-y-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                        <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                          EMD Exemption Basis <span className="text-red-500">*</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-4">
                          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-foreground">
                            <input
                              type="radio"
                              name="emd_exemption_type"
                              checked={form.emd_exemption_type === 'MSME'}
                              onChange={() => set('emd_exemption_type', 'MSME')}
                              className="accent-primary"
                            />
                            MSME
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-foreground">
                            <input
                              type="radio"
                              name="emd_exemption_type"
                              checked={form.emd_exemption_type === 'STARTUP'}
                              onChange={() => set('emd_exemption_type', 'STARTUP')}
                              className="accent-primary"
                            />
                            Startup
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-foreground">
                            <input
                              type="checkbox"
                              checked={form.emd_exemption_type === 'OTHER'}
                              onChange={() => set('emd_exemption_type', form.emd_exemption_type === 'OTHER' ? '' : 'OTHER')}
                              className="accent-primary"
                            />
                            Other
                          </label>
                        </div>
                        {errors.emd_exemption_type && (
                          <p className="text-[11px] text-red-500">{errors.emd_exemption_type}</p>
                        )}
                        {form.emd_exemption_type === 'OTHER' && (
                          <Input
                            value={form.emd_exemption_reason}
                            onChange={(e) => set('emd_exemption_reason', e.target.value)}
                            placeholder="Specify the reason for EMD exemption"
                            className={inputCls(errors.emd_exemption_reason)}
                          />
                        )}
                      </div>
                    )}

                    {/* EMD Mode */}
                    <Field label="EMD Mode">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={form.emd_exempted}>
                          <Button variant="outline" size="sm" className="w-full h-9 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5 disabled:opacity-50">
                            <span>{form.emd_exempted ? 'EXEMPTED' : (form.emd_type === 'ONLINE' ? 'Online Payment' : form.emd_type)}</span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[180px]">
                          {EMD_TYPES.map((t) => (
                            <DropdownMenuItem key={t} onSelect={() => set('emd_type', t)}>
                              {t === 'ONLINE' ? 'Online Payment' : 'DD (Demand Draft)'}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Field>

                    {/* Dynamic EMD Detail Fields */}
                    {!form.emd_exempted && form.emd_type === 'ONLINE' && (
                      <>
                        <div className="sm:col-span-2">
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 mb-3">
                            <svg className="size-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                            <p className="text-xs font-medium text-blue-800 dark:text-blue-200">
                              <strong>EMD via Online Payment</strong> — Provide the bank account where the EMD amount should be remitted. Finance team will be alerted with these details.
                            </p>
                          </div>
                        </div>
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
                      </>
                    )}

                    {!form.emd_exempted && form.emd_type === 'DD' && (
                      <>
                        <div className="sm:col-span-2">
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 mb-3">
                            <svg className="size-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                              <strong>EMD via Demand Draft (DD)</strong> — Provide the DD beneficiary and payable location. Finance team will be alerted to prepare the DD accordingly.
                            </p>
                          </div>
                        </div>
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
                      </>
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
