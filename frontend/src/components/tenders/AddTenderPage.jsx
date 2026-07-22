import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Loader2, Building2, FileText, DollarSign, Calendar,
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

const PORTAL_SOURCES = ['GeM', 'CPPP', 'eProcure', 'Others']
const BID_TYPES      = ['REGULAR', 'RA_BID']
const EMD_TYPES      = ['ONLINE', 'DD']
const SCOPE_TYPES    = ['Supply', 'Implementation', 'Support']
const ACTIVITY_TYPES = ['Fresh', 'Renewal', 'Extension', 'Others']
const EXCEL_STATUSES = ['Open', 'Closed', 'In Progress', 'Cancelled', 'Submitted', 'Result Pending']
const SUB_STATUSES   = ['Draft', 'Pending', 'In Progress', 'Submitted', 'Not Submitted']

const BIDDER_SUGGESTIONS = [
  'Compile Technical Compliance Sheet',
  'Upload EMD / BG / Exemption Certificate',
  'Prepare Commercial Bid Template',
  'Submit Portal Bid & Record Submission',
  'Obtain Internal Approval'
]

const OEM_SUGGESTIONS = [
  'Verify OEM Authorization Letter',
  'Request OEM Technical Datasheets',
  'Request OEM Price Support Quote',
  'Obtain OEM Compliance Certificate'
]

const MONTHS = [
  { name: 'January', value: 0 },
  { name: 'February', value: 1 },
  { name: 'March', value: 2 },
  { name: 'April', value: 3 },
  { name: 'May', value: 4 },
  { name: 'June', value: 5 },
  { name: 'July', value: 6 },
  { name: 'August', value: 7 },
  { name: 'September', value: 8 },
  { name: 'October', value: 9 },
  { name: 'November', value: 10 },
  { name: 'December', value: 11 },
]

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR + i)


function getSelectedMonthName(dateStr) {
  if (!dateStr) return 'Select Month...'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return 'Select Month...'
  return MONTHS[d.getMonth()].name
}

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
    bid_no:                      '',
    gem_bid_no:                  '',
    organization_name:           '',
    department_name:             '',
    portal_source:               'GeM',
    bid_type:                    '', // Default empty string, must be selected (mandatory)
    category:                    '',
    estimated_value:             '',
    emd_amount:                  '',
    emd_type:                    '', // Default empty string, must be selected if not exempted (mandatory)
    emd_exempted:                false,
    oem_required:                true, // OEM Auth is default required
    has_tech_eval:               false,
    opening_date:                '',
    closing_date:                '',
    bid_owner_id:                currentUser?.id ?? '',
    technical_manager_id:        '',
    remarks:                     '',
    team:                        '',
    scope_type:                  '',
    bg_rate:                     '',
    activity_type:               '',
    target_month_date:           '',
    excel_bid_status:            'Open', // Default Open
    submission_status:           'In Progress', // Default In Progress
    financial_evaluation_status: 'Pending',
    po_received_status:          'Pending',
    bid_result:                  'Pending',
    final_bid_value:             '',
  })

  // Dynamic checklists seed input list split for Bidder and OEM
  const [bidderChecklists, setBidderChecklists] = useState([])
  const [oemChecklists, setOemChecklists] = useState([])
  const [newBidderItem, setNewBidderItem] = useState('')
  const [newOemItem, setNewOemItem] = useState('')

  const [errors, setErrors]   = useState({})
  const [loading, setLoading] = useState(false)

  // Load users for owner selector
  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  function set(field, value) {
    setForm((f) => {
      let updated = { ...f, [field]: value }

      if (field === 'emd_exempted') {
        if (value) {
          updated.emd_type = 'EXEMPTED'
          updated.emd_amount = ''
        } else {
          if (f.emd_type === 'EXEMPTED') {
            updated.emd_type = '' // Reset so they have to select
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

  const targetDate = form.target_month_date ? new Date(form.target_month_date) : null
  const currentMonthIdx = targetDate && !isNaN(targetDate.getTime()) ? targetDate.getMonth() : -1
  const currentYearVal = targetDate && !isNaN(targetDate.getTime()) ? targetDate.getFullYear() : -1


  function validateStep(currentStep) {
    const e = {}
    if (currentStep === 1) {
      if (!form.title.trim()) e.title = 'Tender title is required'
      if (!form.bid_type) e.bid_type = 'Bid type is required'
    } else if (currentStep === 2) {
      if (!form.emd_exempted && !form.emd_type) {
        e.emd_type = 'EMD Mode is required'
      }
    } else if (currentStep === 3) {
      if (!form.bid_owner_id) e.bid_owner_id = 'Bid owner is required'
    }
    return e
  }

  function nextStep() {
    const e = validateStep(step)
    if (Object.keys(e).length > 0) {
      setErrors(e)
      toast.error('Please resolve validation errors before continuing')
      return
    }
    setDirection(1)
    setStep(s => Math.min(s + 1, 4))
  }

  function prevStep() {
    setDirection(-1)
    setStep(s => Math.max(s - 1, 1))
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
      const payload = {
        ...form,
        estimated_value: form.estimated_value ? Number(form.estimated_value) : undefined,
        emd_amount:      form.emd_amount ? Number(form.emd_amount) : undefined,
        final_bid_value: form.final_bid_value ? Number(form.final_bid_value) : undefined,
        bg_rate:         form.bg_rate ? Number(form.bg_rate) : undefined,
        opening_date:    form.opening_date ? new Date(form.opening_date).toISOString() : undefined,
        closing_date:    form.closing_date ? new Date(form.closing_date).toISOString() : undefined,
        target_month_date: form.target_month_date ? new Date(form.target_month_date).toISOString() : undefined,
        checklists:      [
          ...bidderChecklists.map((item) => `[Bidder] ${item}`),
          ...oemChecklists.map((item) => `[OEM] ${item}`)
        ],
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
    { num: 1, label: 'Specifications', icon: FileText },
    { num: 2, label: 'Financials & Dates', icon: DollarSign },
    { num: 3, label: 'Status & Ownership', icon: ShieldCheck },
    { num: 4, label: 'Checklist Seed', icon: CheckSquare },
  ]

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

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Create New Tender Workspace</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Set up details, assign key roles, and seed critical workflow checklist items.
          </p>
        </div>
      </div>

      {/* Modern Stepper Indicator */}
      <div className="rounded-xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2 md:px-6">
          {stepsInfo.map((s, i) => {
            const Icon = s.icon
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
                      ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>Step {s.num}</span>
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
              {/* STEP 1: Basic & Meta Info */}
              {step === 1 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 border-b border-border/60 pb-2.5">
                    <FileText className="size-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Basic Tender Specifications</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <Field label="Tender Title" error={errors.title} required tooltip="The primary name of the bid work scope.">
                        <Input
                          value={form.title}
                          onChange={(e) => set('title', e.target.value)}
                          placeholder="e.g. Supply and Implementation of Enterprise Firewall"
                          className={inputCls(errors.title)}
                        />
                      </Field>
                    </div>

                    <Field label="GeM Bid Number" tooltip="Government E-Marketplace registration ID.">
                      <Input value={form.gem_bid_no} onChange={(e) => set('gem_bid_no', e.target.value)}
                        placeholder="e.g. GEM/2026/B/87654" className={inputCls()} />
                    </Field>

                    <Field label="Portal Source">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full h-9 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5">
                            <span>{form.portal_source}</span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[220px]">
                          {PORTAL_SOURCES.map((p) => (
                            <DropdownMenuItem key={p} onSelect={() => set('portal_source', p)}>
                              {p}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Field>

                    <Field label="Bid Type" error={errors.bid_type} required>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className={`w-full h-9 text-xs font-normal justify-between bg-background text-foreground hover:bg-muted/50 gap-1.5 ${errors.bid_type ? 'border-destructive' : 'border-input'}`}>
                            <span>{form.bid_type ? (form.bid_type === 'RA_BID' ? 'RA BID' : form.bid_type) : 'Select a bid'}</span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[220px]">
                          {BID_TYPES.map((t) => (
                            <DropdownMenuItem key={t} onSelect={() => set('bid_type', t)}>
                              {t === 'RA_BID' ? 'RA BID' : t}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Field>

                    <Field label="Category / Scope Group">
                      <Input value={form.category} onChange={(e) => set('category', e.target.value)}
                        placeholder="e.g. Networking & Cybersecurity" className={inputCls()} />
                    </Field>

                    <Field label="Scope Type">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full h-9 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5">
                            <span>{form.scope_type || 'Select Scope Type...'}</span>
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

                    <Field label="Activity Type">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full h-9 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5">
                            <span>{form.activity_type || 'Select Activity Type...'}</span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[220px]">
                          {ACTIVITY_TYPES.map((at) => (
                            <DropdownMenuItem key={at} onSelect={() => set('activity_type', at)}>
                              {at}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Field>
                  </div>
                </div>
              )}

              {/* STEP 2: Financials & Dates */}
              {step === 2 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 border-b border-border/60 pb-2.5">
                    <DollarSign className="size-4 text-emerald-500" />
                    <h3 className="text-sm font-semibold text-foreground">Financial Parameters & Timelines</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

                    <Field label="EMD Mode" error={errors.emd_type} required={!form.emd_exempted}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={form.emd_exempted}>
                          <Button variant="outline" size="sm" className={`w-full h-9 text-xs font-normal justify-between bg-background text-foreground hover:bg-muted/50 gap-1.5 disabled:opacity-50 ${errors.emd_type ? 'border-destructive' : 'border-input'}`}>
                            <span>
                              {form.emd_exempted 
                                ? 'EXEMPTED' 
                                : form.emd_type 
                                  ? (form.emd_type === 'ONLINE' ? 'Online' : form.emd_type) 
                                  : 'Select EMD Mode'}
                            </span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[180px]">
                          {EMD_TYPES.map((t) => (
                            <DropdownMenuItem key={t} onSelect={() => set('emd_type', t)}>
                              {t === 'ONLINE' ? 'Online' : t}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Field>

                    <Field label="BG Rate (%)" tooltip="Bank Guarantee commission rate / performance security pct.">
                      <Input type="number" step="any" value={form.bg_rate} onChange={(e) => set('bg_rate', e.target.value)}
                        placeholder="e.g. 2.5" className={inputCls()} />
                    </Field>

                    <Field label="Month" tooltip="Select the target month and year.">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="w-full h-9 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5">
                                <span>{currentMonthIdx >= 0 ? MONTHS[currentMonthIdx].name : 'Month...'}</span>
                                <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="max-h-60 overflow-y-auto w-[150px]">
                              {MONTHS.map((m) => (
                                <DropdownMenuItem key={m.value} onSelect={() => {
                                  const yr = currentYearVal > 0 ? currentYearVal : new Date().getFullYear()
                                  const monthStr = String(m.value + 1).padStart(2, '0')
                                  set('target_month_date', `${yr}-${monthStr}-01`)
                                }}>
                                  {m.name}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="w-[100px] shrink-0">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="w-full h-9 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5">
                                <span>{currentYearVal > 0 ? currentYearVal : 'Year...'}</span>
                                <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="max-h-60 overflow-y-auto w-[100px]">
                              {YEARS.map((yr) => (
                                <DropdownMenuItem key={yr} onSelect={() => {
                                  const mo = currentMonthIdx >= 0 ? currentMonthIdx : 0
                                  const monthStr = String(mo + 1).padStart(2, '0')
                                  set('target_month_date', `${yr}-${monthStr}-01`)
                                }}>
                                  {yr}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </Field>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Compliance Toggles
                      </Label>
                      <div className="flex flex-col gap-2.5 justify-center pt-1.5">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <div
                            onClick={() => set('has_tech_eval', !form.has_tech_eval)}
                            className={`w-7 h-4 rounded-full transition-colors relative cursor-pointer
                              ${form.has_tech_eval ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                          >
                            <span className={`absolute top-0.5 size-3 rounded-full bg-white shadow transition-transform
                              ${form.has_tech_eval ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                          </div>
                          <span className="text-[11px] font-medium text-muted-foreground">Technical Evaluation Required</span>
                        </label>
                      </div>
                    </div>

                    <Field label="Opening Date / Time">
                      <Input type="date" value={form.opening_date} onChange={(e) => set('opening_date', e.target.value)}
                        className={inputCls()} />
                    </Field>

                    <Field label="Closing Date / Time">
                      <Input type="datetime-local" value={form.closing_date} onChange={(e) => set('closing_date', e.target.value)}
                        className={inputCls()} />
                    </Field>
                  </div>
                </div>
              )}

              {/* STEP 3: Status & Ownership */}
              {step === 3 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 border-b border-border/60 pb-2.5">
                    <ShieldCheck className="size-4 text-violet-500" />
                    <h3 className="text-sm font-semibold text-foreground">Ownership Roles & Status Tracking</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Organization details */}
                    <Field label="Authority / Client Organization">
                      <Input value={form.organization_name} onChange={(e) => set('organization_name', e.target.value)}
                        placeholder="e.g. NIC Delhi" className={inputCls()} />
                    </Field>

                    <Field label="Department / Ministry">
                      <Input value={form.department_name} onChange={(e) => set('department_name', e.target.value)}
                        placeholder="e.g. Ministry of Electronics & IT" className={inputCls()} />
                    </Field>

                    {/* Bid Owner selection */}
                    <Field label="Bid Owner" error={errors.bid_owner_id} required tooltip="The primary manager of the bid lifecycle.">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className={`w-full h-9 text-xs font-normal justify-between bg-background text-foreground hover:bg-muted/50 gap-1.5 ${errors.bid_owner_id ? 'border-destructive' : 'border-input'}`}>
                            <span>{form.bid_owner_id ? (users.find(u => u.id === form.bid_owner_id)?.full_name ?? 'Select Owner...') : 'Select Owner...'}</span>
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
                                {u.full_name} (@{u.username})
                              </DropdownMenuItem>
                            ))
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Field>

                    {/* Technical Manager selection */}
                    <Field label="Technical Manager" tooltip="The lead responsible for technical compliance and specs.">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full h-9 text-xs font-normal justify-between bg-background text-foreground hover:bg-muted/50 gap-1.5 border-input">
                            <span>{form.technical_manager_id ? (users.find(u => u.id === form.technical_manager_id)?.full_name ?? 'Select Manager...') : 'Select Manager...'}</span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="max-h-60 overflow-y-auto w-[320px]">
                          <DropdownMenuLabel>Select Technical Manager</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {usersLoading ? (
                            <DropdownMenuItem disabled>Loading users…</DropdownMenuItem>
                          ) : (
                            users.map((u) => (
                              <DropdownMenuItem key={u.id} onSelect={() => set('technical_manager_id', u.id)}>
                                {u.full_name} (@{u.username})
                              </DropdownMenuItem>
                            ))
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Field>

                    <div className="sm:col-span-2">
                      <Field label="Remarks & Internal Notes">
                        <Textarea
                          value={form.remarks}
                          onChange={(e) => set('remarks', e.target.value)}
                          placeholder="Provide additional details regarding delivery terms, OEM contacts, bid security conditions, etc."
                          className="text-sm min-h-[70px] bg-background"
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              )}
 
              {/* STEP 4: Checklist Seed Items */}
              {step === 4 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 border-b border-border/60 pb-2.5">
                    <CheckSquare className="size-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Seed Initial Checklist Items</h3>
                  </div>
 
                  <p className="text-xs text-muted-foreground leading-normal">
                    Seed the workspace checklist with Bidder and OEM specific tasks. Click suggestions to add, or create custom ones.
                  </p>
 
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Bidder Checklist Section */}
                    <div className="space-y-4 border border-border/80 rounded-xl p-4 bg-muted/5">
                      <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                        <Award className="size-4 text-primary" />
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Bidder Tasks</h4>
                      </div>

                      {/* Suggestions */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Suggested</span>
                        <div className="flex flex-wrap gap-1.5">
                          {BIDDER_SUGGESTIONS.map((suggestion) => {
                            const isAdded = bidderChecklists.includes(suggestion)
                            return (
                              <button
                                key={suggestion}
                                type="button"
                                disabled={isAdded}
                                onClick={() => setBidderChecklists([...bidderChecklists, suggestion])}
                                className={`px-2.5 py-1 rounded-md text-[11px] border transition-all text-left flex items-center gap-1
                                  ${isAdded
                                    ? 'bg-primary/10 border-primary/20 text-primary/70 cursor-not-allowed font-medium'
                                    : 'bg-background hover:bg-muted border-border hover:border-muted-foreground text-muted-foreground hover:text-foreground cursor-pointer'}`}
                              >
                                {isAdded ? <Check className="size-3" /> : <Plus className="size-3" />}
                                {suggestion}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Custom Item input */}
                      <div className="flex gap-2">
                        <Input
                          value={newBidderItem}
                          onChange={(e) => setNewBidderItem(e.target.value)}
                          placeholder="Add custom Bidder task..."
                          className="h-8 text-xs flex-1 bg-background"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              if (newBidderItem.trim()) {
                                  if (bidderChecklists.includes(newBidderItem.trim())) {
                                    toast.error('Item already exists')
                                    return
                                  }
                                setBidderChecklists([...bidderChecklists, newBidderItem.trim()])
                                setNewBidderItem('')
                              }
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            if (newBidderItem.trim()) {
                              if (bidderChecklists.includes(newBidderItem.trim())) {
                                  toast.error('Item already exists')
                                  return
                              }
                              setBidderChecklists([...bidderChecklists, newBidderItem.trim()])
                              setNewBidderItem('')
                            }
                          }}
                          className="gap-1 h-8 text-xs px-2.5"
                        >
                          <Plus className="size-3" /> Add
                        </Button>
                      </div>

                      {/* Added List */}
                      <div className="border border-border/60 rounded-lg overflow-hidden bg-card max-h-48 overflow-y-auto">
                        {bidderChecklists.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground text-[11px]">
                            No Bidder tasks added yet.
                          </div>
                        ) : (
                          <div className="divide-y divide-border">
                            {bidderChecklists.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 text-[11px] hover:bg-muted/10 transition-colors">
                                <span className="font-medium text-foreground truncate max-w-[220px]">{item}</span>
                                <button
                                  type="button"
                                  onClick={() => setBidderChecklists(bidderChecklists.filter((_, i) => i !== idx))}
                                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* OEM Checklist Section */}
                    <div className="space-y-4 border border-border/80 rounded-xl p-4 bg-muted/5">
                      <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                        <Building2 className="size-4 text-primary" />
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">OEM Tasks</h4>
                      </div>

                      {/* Suggestions */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Suggested</span>
                        <div className="flex flex-wrap gap-1.5">
                          {OEM_SUGGESTIONS.map((suggestion) => {
                            const isAdded = oemChecklists.includes(suggestion)
                            return (
                              <button
                                key={suggestion}
                                type="button"
                                disabled={isAdded}
                                onClick={() => setOemChecklists([...oemChecklists, suggestion])}
                                className={`px-2.5 py-1 rounded-md text-[11px] border transition-all text-left flex items-center gap-1
                                  ${isAdded
                                    ? 'bg-primary/10 border-primary/20 text-primary/70 cursor-not-allowed font-medium'
                                    : 'bg-background hover:bg-muted border-border hover:border-muted-foreground text-muted-foreground hover:text-foreground cursor-pointer'}`}
                              >
                                {isAdded ? <Check className="size-3" /> : <Plus className="size-3" />}
                                {suggestion}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Custom Item input */}
                      <div className="flex gap-2">
                        <Input
                          value={newOemItem}
                          onChange={(e) => setNewOemItem(e.target.value)}
                          placeholder="Add custom OEM task..."
                          className="h-8 text-xs flex-1 bg-background"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              if (newOemItem.trim()) {
                                if (oemChecklists.includes(newOemItem.trim())) {
                                  toast.error('Item already exists')
                                  return
                                }
                                setOemChecklists([...oemChecklists, newOemItem.trim()])
                                setNewOemItem('')
                              }
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            if (newOemItem.trim()) {
                              if (oemChecklists.includes(newOemItem.trim())) {
                                  toast.error('Item already exists')
                                  return
                              }
                              setOemChecklists([...oemChecklists, newOemItem.trim()])
                              setNewOemItem('')
                            }
                          }}
                          className="gap-1 h-8 text-xs px-2.5"
                        >
                          <Plus className="size-3" /> Add
                        </Button>
                      </div>

                      {/* Added List */}
                      <div className="border border-border/60 rounded-lg overflow-hidden bg-card max-h-48 overflow-y-auto">
                        {oemChecklists.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground text-[11px]">
                            No OEM tasks added yet.
                          </div>
                        ) : (
                          <div className="divide-y divide-border">
                            {oemChecklists.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 text-[11px] hover:bg-muted/10 transition-colors">
                                <span className="font-medium text-foreground truncate max-w-[220px]">{item}</span>
                                <button
                                  type="button"
                                  onClick={() => setOemChecklists(oemChecklists.filter((_, i) => i !== idx))}
                                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Wizard Navigation Footer */}
        <div className="flex items-center justify-between border-t border-border bg-muted/10 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={prevStep}
            disabled={step === 1 || loading}
            className="gap-1.5"
          >
            <ArrowLeft className="size-4" /> Back
          </Button>

          <div className="flex items-center gap-2">
            {step < 4 ? (
              <Button
                type="button"
                size="sm"
                onClick={nextStep}
                className="gap-1.5"
              >
                Next <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 gap-1.5"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {loading ? 'Creating...' : 'Create Tender Workspace'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

