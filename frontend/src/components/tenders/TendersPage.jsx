import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus, Search, Filter, Download, RefreshCw, ChevronLeft, ChevronRight, ChevronDown,
  Building2, Calendar, DollarSign, Tag, ArrowUpRight, Loader2, X,
  AlertCircle, TrendingUp, FileText, Zap, MoreHorizontal, Eye,
  CheckCircle2, XCircle, Clock, Archive, LayoutGrid, TableProperties, ShieldCheck,
  User, Check, Square, Trash2, RotateCcw, Ban
} from 'lucide-react'
import { toast } from 'sonner'

import { Button }    from '@/components/ui/button'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Input }     from '@/components/ui/input'
import { Badge }     from '@/components/ui/badge'
import { Label }     from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

import {
  listBids, getBid, updateBid, transitionBidStage, restoreBid, permanentDeleteBid, STAGE_LABELS, STAGE_COLORS, STATUS_COLORS, STAGE_TRANSITIONS,
} from '../../services/bids'
import { usePermissions } from '../../hooks/usePermissions'
import { useBidStore } from '../../store/useBidStore'

// ── Stage List order for progress computation ────────────────────────────────
const STAGES_ORDER = [
  'DISCOVERED',
  'QUALIFICATION_REVIEW',
  'DOCUMENT_COMPILATION',
  'OEM_COORDINATION',
  'COMMERCIAL_PREPARATION',
  'INTERNAL_REVIEW',
  'FINAL_APPROVAL',
  'READY_FOR_SUBMISSION',
  'SUBMITTED',
  'AWAITING_RESULT',
  'WON',
  'LOST'
]

// ── Stage Badge ───────────────────────────────────────────────────────────────
function StageBadge({ stage }) {
  const color = STAGE_COLORS[stage] ?? 'bg-gray-100 text-gray-600 border-gray-200'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${color}`}>
      {STAGE_LABELS[stage] ?? stage}
    </span>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────
const STATUS_DISPLAY_LABELS = {
  WON:                  'Won',
  LOST:                 'Lost',
  CANCELLED:            'Cancelled',
  SUBMITTED:            'Submitted',
  TECHNICAL_EVALUATION: 'Under Tech Eval',
  ACTIVE:               'Active',
  ARCHIVED:             'Archived',
}

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'
  const icons = {
    WON:                  <CheckCircle2 className="size-3 mr-1 text-emerald-600" />,
    LOST:                 <XCircle className="size-3 mr-1 text-red-600" />,
    CANCELLED:            <XCircle className="size-3 mr-1 text-slate-500" />,
    SUBMITTED:            <CheckCircle2 className="size-3 mr-1 text-lime-600" />,
    TECHNICAL_EVALUATION: <Clock className="size-3 mr-1 text-teal-600" />,
    ACTIVE:               <span className="size-1.5 rounded-full bg-blue-500 mr-1.5" />,
    ARCHIVED:             <Archive className="size-3 mr-1" />,
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${color}`}>
      {icons[status]}
      {STATUS_DISPLAY_LABELS[status] ?? status}
    </span>
  )
}

// ── Format currency ───────────────────────────────────────────────────────────
function formatCurrency(val) {
  if (!val && val !== 0) return '—'
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`
  if (val >= 100000)   return `₹${(val / 100000).toFixed(1)}L`
  return `₹${val.toLocaleString('en-IN')}`
}

// ── Format date ───────────────────────────────────────────────────────────────
function isValidDate(dt) {
  if (!dt) return false
  const d = new Date(dt)
  if (isNaN(d.getTime())) return false
  if (d.getFullYear() <= 1970) return false
  return true
}

function formatDate(dt, fallback = '—') {
  if (!isValidDate(dt)) return fallback
  return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getBidStartDate(bid) {
  if (!bid) return 'Not Specified'
  if (isValidDate(bid.start_date)) return formatDate(bid.start_date)
  if (isValidDate(bid.opening_date)) return formatDate(bid.opening_date)
  return 'Not Specified'
}

function getBidEndDate(bid) {
  if (!bid) return 'Not Specified'
  if (isValidDate(bid.end_date)) return formatDate(bid.end_date)
  if (isValidDate(bid.closing_date)) return formatDate(bid.closing_date)
  if (isValidDate(bid.submission_deadline)) return formatDate(bid.submission_deadline)
  if (isValidDate(bid.target_month_date)) return formatDate(bid.target_month_date)
  return 'Not Specified'
}

// Helper to safely format dates for <input type="date"> without crashing on invalid/empty values
function safeDateInputFormat(dt) {
  if (!dt) return ''
  try {
    const d = new Date(dt)
    if (isNaN(d.getTime())) return ''
    return d.toISOString().split('T')[0]
  } catch {
    return ''
  }
}

export function getDerivedBidStatusAndOutcome(bid) {
  if (!bid) return { status: 'ACTIVE', outcome: null };

  const stage = bid.workflow_stage;
  const rawStatus = bid.bid_status;
  const rawOutcome = bid.bid_outcome;

  // 1. Explicit Terminal & Intermediate Stage Mappings (5-State Model)
  if (stage === 'WON' || rawStatus === 'WON' || rawOutcome === 'WON') {
    return { status: 'WON', outcome: 'WON' };
  }
  if (stage === 'LOST' || rawStatus === 'LOST' || rawOutcome === 'LOST') {
    return { status: 'LOST', outcome: 'LOST' };
  }
  if (stage === 'CANCELLED' || rawStatus === 'CANCELLED' || rawOutcome === 'CANCELLED') {
    return { status: 'CANCELLED', outcome: 'CANCELLED' };
  }
  if (
    stage === 'GEM_SUBMISSION' ||
    stage === 'TECHNICAL_EVALUATION' ||
    stage === 'FINANCIAL_EVALUATION' ||
    rawStatus === 'TECHNICAL_EVALUATION' ||
    rawStatus === 'SUBMITTED' ||
    bid.submission_status === 'SUBMITTED' ||
    bid.submission_done === true
  ) {
    return { status: 'TECHNICAL_EVALUATION', outcome: null };
  }

  // 2. Legacy / Result-based fallbacks if result string exists
  const result = (bid.bid_result || '').trim();
  const resultLower = result.toLowerCase();
  if (result) {
    if (resultLower.includes('l1') || resultLower.includes('won')) {
      return { status: 'WON', outcome: 'WON' };
    }
    if (
      resultLower !== 'result pending' &&
      resultLower !== 'na' &&
      resultLower !== 'bid in progress' &&
      resultLower !== 'pending'
    ) {
      return { status: 'LOST', outcome: 'LOST' };
    }
  }

  return { status: rawStatus || 'ACTIVE', outcome: rawOutcome || null };
}



// Helper to escape CSV fields correctly according to RFC 4180
function escapeCSV(val) {
  if (val === null || val === undefined) return ''
  let str = String(val)
  str = str.replace(/"/g, '""')
  if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
    return `"${str}"`
  }
  return str
}

// ── Export to Excel/CSV (Full database export with compliance details) ─────────
async function exportToExcel() {
  const toastId = toast.loading('Fetching all tenders and details for export...')
  try {
    // 1. Retrieve all bids in the system
    const res = await listBids({ page: 1, limit: 1000 })
    if (!res.ok) {
      throw new Error(res.error?.message ?? 'Failed to retrieve tenders from API')
    }
    const allBids = Array.isArray(res.data) ? res.data : (res.data?.bids || [])

    if (allBids.length === 0) {
      toast.error('No tenders available to export', { id: toastId })
      return
    }

    // 2. Fetch full details for each bid in parallel to get full compliance information
    const detailPromises = allBids.map(b => getBid(b.id))
    const detailResults = await Promise.all(detailPromises)
    const enrichedBids = allBids.map((b, idx) => {
      const detailRes = detailResults[idx]
      let enriched = b
      if (detailRes && detailRes.ok && detailRes.data) {
        enriched = {
          ...b,
          ...detailRes.data,
        }
      }
      const { status, outcome } = getDerivedBidStatusAndOutcome(enriched)
      return {
        ...enriched,
        bid_status: status,
        bid_outcome: outcome
      }
    })

    // 3. Define headers and rows
    const headers = [
      'Title',
      'Status',
      'Workflow Stage',
      'Category',
      'Team',
      'Bid ID',
      'Platform',
      'Department',
      'Scope Type',
      'EMD',
      'EMD Exemption',
      'BG Rate (%)',
      'Activity Type',
      'Target Month',
      'Start Date',
      'End Date',
      'Estimated Value',
      'Tech Eval',
      'Submission Status',
      'Financial Evaluation Status',
      'PO Received Status',
      'Result',
      'Owner',
      'Remarks'
    ]

    const csvRows = [headers.map(escapeCSV).join(',')]

    enrichedBids.forEach(b => {
      const row = [
        b.title ?? '',
        b.bid_status ?? '',
        STAGE_LABELS[b.workflow_stage] ?? b.workflow_stage ?? '',
        b.category ?? '',
        b.team ?? '',
        b.gem_bid_no ?? '',
        b.portal_source ?? '',
        b.department_name ?? '',
        b.scope_type ?? '',
        b.emd_amount !== null && b.emd_amount !== undefined ? String(b.emd_amount) : '',
        b.emd_exempted ? 'Yes' : 'No',
        b.bg_rate !== null && b.bg_rate !== undefined ? `${b.bg_rate}%` : '',
        b.activity_type ?? '',
        b.target_month_date ? new Date(b.target_month_date).toLocaleDateString('en-IN') : '—',
        b.opening_date ? new Date(b.opening_date).toLocaleDateString('en-IN') : '—',
        b.closing_date ? new Date(b.closing_date).toLocaleDateString('en-IN') : '—',
        b.estimated_value !== null && b.estimated_value !== undefined ? String(b.estimated_value) : '',
        b.has_tech_eval ? 'Yes' : 'No',
        b.submission_status ?? '',
        b.financial_evaluation_status ?? '',
        b.po_received_status ?? '',
        b.bid_result ?? '',
        b.bid_owner?.full_name ?? '',
        b.remarks ?? ''
      ]
      csvRows.push(row.map(escapeCSV).join(','))
    })

    // Add Unicode BOM to force Excel to read UTF-8 correctly
    const csvContent = '\uFEFF' + csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tenders_workspace_export_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    
    toast.success(`Successfully exported ${enrichedBids.length} records to CSV/Excel`, { id: toastId })
  } catch (err) {
    console.error('Failed to export tenders:', err)
    toast.error(err.message || 'Error occurred during export', { id: toastId })
  }
}

// ── Filter Bar Options ────────────────────────────────────────────────────────
const STAGE_OPTIONS = [
  { value: '', label: 'All Stages' },
  { value: 'DISCOVERED', label: '1. Search & ID' },
  { value: 'ELIGIBILITY_ASSESSMENT', label: '2. Eligibility' },
  { value: 'OEM_AUTHORIZATION_REQUEST', label: '3. OEM Auth' },
  { value: 'PRICING_REQUEST', label: '4. Pricing Request' },
  { value: 'DOCUMENT_CHECKLIST_PREPARATION', label: '5. Checklist Prep' },
  { value: 'EMD_PROCESSING', label: '6. EMD Processing' },
  { value: 'BID_DOCUMENTATION', label: '7. Documentation' },
  { value: 'INTERNAL_APPROVAL', label: '8. Internal Approval' },
  { value: 'GEM_SUBMISSION', label: '9. GeM Submission' },
  { value: 'TECHNICAL_EVALUATION', label: '10. Tech Eval' },
  { value: 'FINANCIAL_EVALUATION', label: '11. Financial Eval' },
  { value: 'AWARD_HANDOVER', label: '12. Award & Delivery' },
  { value: 'WON', label: 'Won' },
  { value: 'LOST', label: 'Lost' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'WON', label: 'Won' },
  { value: 'LOST', label: 'Lost' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'TECHNICAL_EVALUATION', label: 'Under Tech Eval' },
  { value: 'ACTIVE', label: 'Active' },
]

const PORTAL_SOURCES = ['GeM', 'CPPP', 'eProcure']
const BID_TYPES = ['CUSTOM_BID', 'BOQ_BID', 'SERVICE_BID', 'INTELLIGENCE_BID']
const EMD_TYPES = ['ONLINE', 'BG', 'DD', 'EXEMPTED']

function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function TendersPage() {
  const { hasPermission } = usePermissions()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [sheetEditable, setSheetEditable] = useState(false)

  const toggleSheetEditable = () => {
    const nextState = !sheetEditable
    setSheetEditable(nextState)
    if (nextState) {
      toast.success('Edit Mode Enabled: Autosave activated', { id: 'autosave-status' })
    } else {
      toast.success('Edit Mode Disabled: Autosave deactivated', { id: 'autosave-status' })
    }
  }

  const {
    bids,
    meta,
    loading,
    error,
    page,
    stageFilter,
    statusFilter,
    searchInput,
    inBin,
    viewMode,
    setPage,
    setStageFilter,
    setStatusFilter,
    setSearchInput,
    setDebouncedSearch,
    setInBin,
    setViewMode,
    loadBids,
    users,
    loadUsers,
  } = useBidStore()

  useEffect(() => {
    const statusParam = searchParams.get('status')
    const stageParam = searchParams.get('stage')
    const binParam = searchParams.get('bin')

    let hasParamUpdate = false
    if (binParam === 'true' && !inBin) {
      setInBin(true)
      hasParamUpdate = true
    } else if (binParam === 'false' && inBin) {
      setInBin(false)
      hasParamUpdate = true
    }

    if (statusParam !== null && statusParam !== statusFilter) {
      setStatusFilter(statusParam)
      hasParamUpdate = true
    }
    if (stageParam !== null && stageParam !== stageFilter) {
      setStageFilter(stageParam)
      hasParamUpdate = true
    }

    if (!hasParamUpdate) {
      loadBids()
    }
    loadUsers()
  }, [searchParams])

  const handleRestoreBid = async (bidId, bidTitle) => {
    try {
      const res = await restoreBid(bidId)
      if (res.ok) {
        toast.success(`Tender "${bidTitle || bidId}" restored successfully!`)
        loadBids()
      } else {
        toast.error(res.error?.message ?? 'Failed to restore tender')
      }
    } catch (err) {
      toast.error('Error restoring tender')
    }
  }

  const handlePermanentDeleteBid = async (bidId, bidTitle) => {
    if (!window.confirm(`Are you sure you want to PERMANENTLY delete tender "${bidTitle || bidId}"? This action CANNOT be undone.`)) {
      return
    }
    try {
      const res = await permanentDeleteBid(bidId)
      if (res.ok) {
        toast.success('Tender permanently deleted')
        loadBids()
      } else {
        toast.error(res.error?.message ?? 'Failed to permanently delete tender')
      }
    } catch (err) {
      toast.error('Error permanently deleting tender')
    }
  }

  const effectiveBids = bids.map(bid => {
    const { status, outcome } = getDerivedBidStatusAndOutcome(bid)
    return {
      ...bid,
      bid_status: status,
      bid_outcome: outcome
    }
  })

  // Setup search debouncing to update store's debouncedSearch
  const debouncedSearchVal = useDebounce(searchInput, 300)
  useEffect(() => {
    setDebouncedSearch(debouncedSearchVal)
  }, [debouncedSearchVal, setDebouncedSearch])

  // Local state update for smooth/instant character rendering
  const handleFieldChangeLocal = (bidId, field, value) => {
    const updated = bids.map(b => {
      if (b.id === bidId) {
        let newBid = { ...b, [field]: value }
        
        // EMD dependencies
        if (field === 'emd_exempted') {
          if (value) {
            newBid.emd_type = 'EXEMPTED'
            newBid.emd_amount = 0
          } else {
            if (b.emd_type === 'EXEMPTED') {
              newBid.emd_type = 'ONLINE'
            }
          }
        } else if (field === 'emd_type') {
          if (value === 'EXEMPTED') {
            newBid.emd_exempted = true
            newBid.emd_amount = 0
          } else {
            newBid.emd_exempted = false
          }
        }
        return newBid
      }
      return b
    })
    useBidStore.setState({ bids: updated })
  }

  // API save trigger for inputs on blur / enter
  const handleFieldSave = async (bidId, field, value) => {
    const currentBid = bids.find(b => b.id === bidId)
    if (!currentBid) return

    if (field === 'workflow_stage') {
      try {
        const res = await transitionBidStage(bidId, value, 'Updated via spreadsheet inline edit')
        if (res.ok) {
          const updated = bids.map(b => {
            if (b.id === bidId) {
              return {
                ...b,
                workflow_stage: value,
              }
            }
            return b
          })
          useBidStore.setState({ bids: updated })
        } else {
          toast.error(res.error?.message ?? `Invalid transition to ${STAGE_LABELS[value] ?? value}`)
          loadBids()
        }
      } catch (err) {
        console.error('Failed to transition stage:', err)
        toast.error('Network error during stage transition')
        loadBids()
      }
      return
    }

    let sendValue = value
    if (field === 'estimated_value' || field === 'emd_amount' || field === 'bg_rate') {
      sendValue = value !== '' ? Number(value) : null
    }
    if (field === 'opening_date' || field === 'closing_date' || field === 'target_month_date') {
      sendValue = value ? new Date(value).toISOString() : null
    }

    const payload = {
      title:             currentBid.title,
      bid_no:            currentBid.bid_no,
      gem_bid_no:        currentBid.gem_bid_no,
      organization_name: currentBid.organization_name,
      department_name:   currentBid.department_name,
      portal_source:     currentBid.portal_source,
      bid_type:          currentBid.bid_type,
      category:          currentBid.category,
      estimated_value:   currentBid.estimated_value !== null ? Number(currentBid.estimated_value) : null,
      emd_amount:        currentBid.emd_amount !== null ? Number(currentBid.emd_amount) : null,
      emd_type:          currentBid.emd_type,
      emd_exempted:      !!currentBid.emd_exempted,
      oem_required:      !!currentBid.oem_required,
      has_tech_eval:     !!currentBid.has_tech_eval,
      opening_date:      currentBid.opening_date ? new Date(currentBid.opening_date).toISOString() : null,
      closing_date:      currentBid.closing_date ? new Date(currentBid.closing_date).toISOString() : null,
      bid_owner_id:      currentBid.bid_owner?.id || currentBid.bid_owner_id,
      remarks:           currentBid.remarks,
      bid_status:        currentBid.bid_status,
      workflow_stage:    currentBid.workflow_stage,
      team:                        currentBid.team,
      scope_type:                  currentBid.scope_type,
      bg_rate:                     currentBid.bg_rate !== null ? Number(currentBid.bg_rate) : null,
      activity_type:               currentBid.activity_type,
      target_month_date:           currentBid.target_month_date ? new Date(currentBid.target_month_date).toISOString() : null,
      excel_bid_status:            currentBid.excel_bid_status,
      submission_status:           currentBid.submission_status,
      financial_evaluation_status:  currentBid.financial_evaluation_status,
      po_received_status:           currentBid.po_received_status,
      bid_result:                  currentBid.bid_result,
      bid_outcome:                 currentBid.bid_outcome,
    }

    payload[field] = sendValue

    // Derive bid_status and bid_outcome based on the new or current bid_result
    const finalBidResult = payload.bid_result
    const finalBidResultStr = (finalBidResult || '').trim()
    const resultLower = finalBidResultStr.toLowerCase()

    let derivedStatus = payload.bid_status || 'ACTIVE'
    let derivedOutcome = payload.bid_outcome || null

    if (finalBidResultStr) {
      if (resultLower.includes('l1') || resultLower.includes('won')) {
        derivedStatus = 'WON'
        derivedOutcome = 'WON'
      } else if (
        resultLower !== 'result pending' &&
        resultLower !== 'na' &&
        resultLower !== 'bid in progress' &&
        resultLower !== 'pending'
      ) {
        derivedStatus = 'LOST'
        derivedOutcome = 'LOST'
      } else {
        derivedStatus = 'ACTIVE'
        derivedOutcome = null
      }
    }

    const finalWorkflowStage = payload.workflow_stage
    if (finalWorkflowStage === 'WON') {
      derivedStatus = 'WON'
      derivedOutcome = 'WON'
    } else if (finalWorkflowStage === 'LOST') {
      derivedStatus = 'LOST'
      derivedOutcome = 'LOST'
    } else if (finalWorkflowStage === 'CANCELLED') {
      derivedStatus = 'CANCELLED'
      derivedOutcome = 'CANCELLED'
    }

    payload.bid_status = derivedStatus
    payload.bid_outcome = derivedOutcome
    if (field === 'emd_exempted') {
      if (value) {
        payload.emd_type = 'EXEMPTED'
        payload.emd_amount = null
      } else {
        if (currentBid.emd_type === 'EXEMPTED') {
          payload.emd_type = 'ONLINE'
        }
      }
    } else if (field === 'emd_type') {
      if (value === 'EXEMPTED') {
        payload.emd_exempted = true
        payload.emd_amount = null
      } else {
        payload.emd_exempted = false
      }
    }

    try {
      const res = await updateBid(bidId, payload)
      if (res.ok) {
        if (res.data) {
          const updated = bids.map(b => {
            if (b.id === bidId) {
              return {
                ...b,
                ...res.data,
              }
            }
            return b
          })
          useBidStore.setState({ bids: updated })
        }
      } else {
        toast.error(res.error?.message ?? 'Failed to auto-save field')
        loadBids()
      }
    } catch (err) {
      console.error('Failed to auto-save:', err)
      toast.error('Network error during auto-save')
      loadBids()
    }
  }

  // Immediate save on select / toggle
  const handleImmediateChangeAndSave = async (bidId, field, value) => {
    handleFieldChangeLocal(bidId, field, value)
    await handleFieldSave(bidId, field, value)
  }

  function handleSearchChange(e) {
    setSearchInput(e.target.value)
  }

  const totalPages = Math.ceil((meta.total ?? 0) / (meta.limit ?? 20))

  return (
    <div className="space-y-6 w-full min-w-0">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold text-foreground">
              {inBin ? 'Tender Bin' : 'Tenders'}
            </h1>

            {/* Workspace View Switcher (Active Tenders vs Tender Bin) */}
            <div className="flex items-center bg-muted/60 border border-border p-1 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => { setInBin(false); setSearchParams({}) }}
                className={`px-3 py-1 rounded-md font-semibold transition-all ${!inBin ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Active Workspace
              </button>
              <button
                type="button"
                onClick={() => { setInBin(true); setSearchParams({ bin: 'true' }) }}
                className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${inBin ? 'bg-rose-600 text-white shadow-xs' : 'text-muted-foreground hover:text-rose-600'}`}
              >
                <Trash2 className="size-3.5" />
                Tender Bin (Trash)
              </button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {inBin 
              ? 'Soft-deleted tender workspaces. Items are retained for 15 days before permanent auto-purge. Super Admins can restore or purge them.'
              : 'Manage and track all organizational bid workspaces and GeM tenders.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Export to Excel */}
          {!inBin && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-border hover:bg-muted"
              onClick={exportToExcel}
              disabled={bids.length === 0}
            >
              <Download className="size-3.5 text-muted-foreground" />
              Export Excel
            </Button>
          )}

          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-border hover:bg-muted"
            onClick={loadBids}
            disabled={loading}
          >
            <RefreshCw className={`size-3.5 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
          </Button>

          {/* Add Tender */}
          {!inBin && hasPermission('bid.create') && (
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                id="add-tender-btn"
                size="sm"
                className="gap-1.5 bg-primary hover:bg-primary/95 shadow-sm text-primary-foreground"
                onClick={() => navigate('/dashboard/tenders/new')}
              >
                <Plus className="size-3.5" />
                Add Tender
              </Button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Tender Bin Banner */}
      {inBin && (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Trash2 className="size-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-rose-900 dark:text-rose-200">Tender Bin (15-Day Retention Period)</p>
              <p className="text-xs text-rose-700 dark:text-rose-400 mt-0.5">
                Items in this bin will be permanently purged automatically after 15 days of soft-deletion. Super Admins can restore tenders back to the active workspace at any time.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setInBin(false); setSearchParams({}) }} className="text-xs shrink-0 bg-card border-rose-300 hover:bg-rose-100/50">
            Return to Active Workspace
          </Button>
        </div>
      )}

      {/* ── Stats Row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Tenders', value: meta.total ?? 0, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50/50', filterKey: '' },
          { label: 'Active', value: meta.active_count ?? 0, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50/50', filterKey: 'ACTIVE' },
          { label: 'Under Tech Eval', value: meta.tech_eval_count ?? 0, icon: Clock, color: 'text-teal-600', bg: 'bg-teal-50/50', filterKey: 'TECHNICAL_EVALUATION' },
          { label: 'Won', value: meta.won_count ?? 0, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50/50', filterKey: 'WON' },
          { label: 'Lost', value: meta.lost_count ?? 0, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50/50', filterKey: 'LOST' },
          { label: 'Cancelled', value: meta.cancelled_count ?? 0, icon: Ban, color: 'text-amber-600', bg: 'bg-amber-50/50', filterKey: 'CANCELLED' },
        ].map((stat) => {
          const isActiveFilter = statusFilter === stat.filterKey || (!statusFilter && stat.filterKey === '')
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (stat.filterKey === '') {
                  setStatusFilter('')
                  setStageFilter('')
                  setPage(1)
                  setSearchParams(inBin ? { bin: 'true' } : {})
                } else {
                  setStatusFilter(stat.filterKey)
                  setStageFilter('')
                  setPage(1)
                  setSearchParams(inBin ? { bin: 'true', status: stat.filterKey } : { status: stat.filterKey })
                }
              }}
              className={`rounded-xl border p-3.5 flex items-center gap-3 shadow-xs cursor-pointer transition-all ${
                isActiveFilter
                  ? 'border-primary ring-2 ring-primary/30 bg-primary/5 shadow-sm'
                  : 'border-border bg-card hover:bg-muted/40 hover:border-muted-foreground/30'
              }`}
            >
              <div className={`size-9 rounded-lg ${stat.bg} flex items-center justify-center shrink-0`}>
                <stat.icon className={`size-4.5 ${stat.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xl font-bold font-heading text-foreground leading-none">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">{stat.label}</p>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* ── Filter & Search Bar + View Selector ──────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap gap-2.5 items-center justify-between">
          <div className="flex flex-wrap gap-2.5 items-center flex-1 min-w-[280px]">
            {/* Search */}
            <div className="relative flex-1 max-w-sm min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by title, GeM ID, authority, department..."
                value={searchInput}
                onChange={handleSearchChange}
                className="pl-8 h-8.5 text-xs bg-background"
              />
              {searchInput && (
                <button onClick={() => { setSearchInput(''); setPage(1) }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Stage filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8.5 text-xs font-normal bg-background border-input text-foreground hover:bg-muted/50 gap-1.5">
                  <span>{STAGE_OPTIONS.find(o => o.value === stageFilter)?.label || 'All Stages'}</span>
                  <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-60 overflow-y-auto">
                <DropdownMenuLabel>Filter by Stage</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {STAGE_OPTIONS.map((o) => (
                  <DropdownMenuItem key={o.value} onSelect={() => { setStageFilter(o.value); setPage(1) }}>
                    {o.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Status filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8.5 text-xs font-normal bg-background border-input text-foreground hover:bg-muted/50 gap-1.5">
                  <span>{STATUS_OPTIONS.find(o => o.value === statusFilter)?.label || 'All Statuses'}</span>
                  <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {STATUS_OPTIONS.filter(o => o.value !== 'ARCHIVED').map((o) => (
                  <DropdownMenuItem key={o.value} onSelect={() => { setStatusFilter(o.value); setPage(1) }}>
                    {o.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>


            {/* Clear filters */}
            {(stageFilter || statusFilter || searchInput) && (
              <Button variant="ghost" size="sm" className="h-8.5 text-xs gap-1"
                onClick={() => { setSearchInput(''); setStageFilter(''); setStatusFilter(''); setPage(1) }}>
                <X className="size-3" />
                Clear Filters
              </Button>
            )}
          </div>

          {/* View Toggles */}
          <div className="flex items-center gap-2">
            {viewMode === 'sheets' && hasPermission('bid.edit') && (
              <button
                onClick={toggleSheetEditable}
                className={`h-8.5 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm
                  ${sheetEditable 
                    ? 'bg-amber-500 hover:bg-amber-600 text-white ring-2 ring-amber-500/20' 
                    : 'bg-background hover:bg-muted border border-border text-muted-foreground hover:text-foreground'}`}
              >
                <Zap className={`size-3.5 ${sheetEditable ? 'animate-pulse text-white' : 'text-muted-foreground'}`} />
                {sheetEditable ? 'Edit Mode: Active' : 'Enable Inline Edit'}
              </button>
            )}

            <div className="flex items-center border border-border rounded-lg p-0.5 bg-muted/40">
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-md transition-all flex items-center gap-1 text-xs font-medium
                  ${viewMode === 'cards' 
                    ? 'bg-card text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'}`}
                title="Cards View"
              >
                <LayoutGrid className="size-3.5" />
                Cards
              </button>
              <button
                onClick={() => setViewMode('sheets')}
                className={`p-1.5 rounded-md transition-all flex items-center gap-1 text-xs font-medium
                  ${viewMode === 'sheets' 
                    ? 'bg-card text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'}`}
                title="Sheets View"
              >
                <TableProperties className="size-3.5" />
                Sheets
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Data View ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-primary" />
          <span className="text-sm font-medium">Retrieving tenders...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground bg-card border border-border rounded-xl">
          <AlertCircle className="size-9 text-destructive/80" />
          <p className="text-sm font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={loadBids}>Retry Query</Button>
        </div>
      ) : effectiveBids.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground bg-card border border-border rounded-xl">
          <FileText className="size-12 text-muted-foreground/20" />
          <div className="text-center">
            <p className="font-semibold text-sm text-foreground">No matching tenders found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {searchInput || stageFilter || statusFilter
                ? 'Refine your query filters or criteria.'
                : 'Create your first tender to spin up a workflow workspace.'}
            </p>
          </div>
          {hasPermission('bid.create') && !searchInput && !stageFilter && !statusFilter && (
            <Button size="sm" className="gap-1.5 mt-2" onClick={() => navigate('/dashboard/tenders/new')}>
              <Plus className="size-3.5" />
              Add Tender
            </Button>
          )}
        </div>
      ) : (
        <div>
          {viewMode === 'cards' ? (
            /* ── Card Gallery Grid (Default) ── */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence initial={false}>
                {effectiveBids.map((bid, i) => {
                  const currentStageIdx = STAGES_ORDER.indexOf(bid.workflow_stage)
                  const progressPct = currentStageIdx >= 0 
                    ? ((currentStageIdx + 1) / STAGES_ORDER.length) * 100 
                    : 0

                  return (
                    <motion.div
                      key={bid.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02, duration: 0.25, type: 'spring', stiffness: 200, damping: 20 }}
                      whileHover={{ y: -3, scale: 1.01 }}
                      onClick={() => hasPermission('bid.view') && navigate(`/dashboard/tenders/${bid.id}`)}
                      className={`group border rounded-xl p-5 shadow-sm hover:shadow-md transition-[border-color,background-color] duration-300 flex flex-col justify-between relative overflow-hidden
                        ${bid.bid_status === 'CANCELLED' || bid.bid_status === 'CLOSED' ? 'bg-red-50/30 border-red-200/50 dark:bg-red-950/10 dark:border-red-900/30 opacity-80' :
                          bid.bid_status === 'LOST' ? 'bg-orange-50/30 border-orange-200/50 dark:bg-orange-950/10 dark:border-orange-900/30 opacity-80' :
                          bid.bid_status === 'WON' ? 'bg-sky-50/30 border-sky-200/50 dark:bg-sky-950/10 dark:border-sky-900/30' :
                          bid.bid_status === 'ACTIVE' ? 'bg-emerald-50/30 border-emerald-200/50 dark:bg-emerald-950/10 dark:border-emerald-900/30' :
                          'bg-card border-border hover:border-primary/30'}
                        ${hasPermission('bid.view') ? 'cursor-pointer' : ''}`}
                    >
                      {/* Decorative colored top line based on status */}
                      <div className={`absolute top-0 left-0 right-0 h-1 
                        ${bid.bid_status === 'WON' ? 'bg-sky-500' :
                          bid.bid_status === 'CANCELLED' || bid.bid_status === 'CLOSED' ? 'bg-red-500' :
                          bid.bid_status === 'LOST' ? 'bg-orange-500' :
                          bid.bid_status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-primary'}`} 
                      />
                      {/* Stamp watermark for terminal status tenders */}
                      {['CANCELLED', 'CLOSED', 'WON', 'LOST'].includes(bid.bid_status) && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10 select-none">
                          <span className={`text-4xl font-black tracking-widest rotate-[-25deg]
                            ${bid.bid_status === 'WON' ? 'text-sky-500/10 dark:text-sky-500/15' :
                              bid.bid_status === 'CANCELLED' || bid.bid_status === 'CLOSED' ? 'text-red-500/10 dark:text-red-500/15' :
                              bid.bid_status === 'LOST' ? 'text-orange-500/10 dark:text-orange-500/15' :
                              'text-slate-500/10 dark:text-slate-500/15'}`}>
                            {bid.bid_status}
                          </span>
                        </div>
                      )}

                      <div className="space-y-3.5">
                        {/* Tags / Status */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {bid.portal_source && (
                              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                                {bid.portal_source}
                              </span>
                            )}
                            {bid.gem_bid_no && (
                              <span className="text-[10px] font-mono text-primary font-semibold">
                                {bid.gem_bid_no}
                              </span>
                            )}
                          </div>
                          {inBin && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-300">
                              <Clock className="size-3 mr-1 animate-pulse" />
                              {bid.days_remaining ?? 15}d to purge
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <div>
                          <div className="flex items-start gap-1.5 justify-between">
                            <h3 className="font-heading text-sm font-bold text-foreground line-clamp-2 leading-relaxed group-hover:text-primary transition-colors flex-1">
                              {bid.title}
                            </h3>
                            {bid.bid_status === 'ACTIVE' ? (
                              <span className="relative flex size-2 mt-1 shrink-0" title="Active">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
                              </span>
                            ) : bid.bid_status === 'WON' ? (
                              <span className="size-2 rounded-full bg-sky-500 mt-1 shrink-0" title="Won" />
                            ) : bid.bid_status === 'LOST' ? (
                              <span className="size-2 rounded-full bg-orange-500 mt-1 shrink-0" title="Lost" />
                            ) : (
                              <span className="size-2 rounded-full bg-red-600 mt-1 shrink-0" title={bid.bid_status} />
                            )}
                          </div>
                          {bid.bid_no && (
                            <p className="text-[11px] text-muted-foreground font-mono mt-1">Ref: {bid.bid_no}</p>
                          )}
                        </div>

                        {/* Details */}
                        <div className="space-y-1.5 bg-muted/30 p-2.5 rounded-lg border border-border/40 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Building2 className="size-3 text-muted-foreground/75" /> Authority
                            </span>
                            <span className="font-semibold text-foreground truncate max-w-[150px]">
                              {bid.organization_name ?? '—'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <DollarSign className="size-3 text-muted-foreground/75" /> Est. Value
                            </span>
                            <span className="font-semibold text-foreground">
                              {formatCurrency(bid.estimated_value)}
                            </span>
                          </div>
                        </div>

                        {/* Workflow Progress */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Workflow Stage</span>
                            <span className="font-bold text-primary text-[11px]">
                              {STAGE_LABELS[bid.workflow_stage] ?? bid.workflow_stage}
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="bg-primary h-full rounded-full transition-all duration-500" 
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="size-3 text-amber-600" />
                          <span>End Date: {getBidEndDate(bid)}</span>
                        </div>
                        {bid.bid_owner && (
                          <div className="flex items-center gap-1.5" title={`Owner: ${bid.bid_owner.full_name}`}>
                            <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                              {bid.bid_owner.full_name?.charAt(0) ?? 'O'}
                            </div>
                            <span className="max-w-[70px] truncate">{bid.bid_owner.full_name.split(' ')[0]}</span>
                          </div>
                        )}
                      </div>

                      {/* Bin Actions */}
                      {inBin && (
                        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2 z-20">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 h-8 flex-1 font-semibold"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRestoreBid(bid.id, bid.title)
                            }}
                          >
                            <RotateCcw className="size-3.5" />
                            Restore Tender
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="gap-1.5 text-xs h-8 flex-1 font-semibold bg-rose-600 hover:bg-rose-700 text-white"
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePermanentDeleteBid(bid.id, bid.title)
                            }}
                          >
                            <Trash2 className="size-3.5" />
                            Purge
                          </Button>
                        </div>
                      )}

                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          ) : (
            /* ── Sheet View (Wide Spreadsheet Table) ── */
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden w-full">
              <div className="w-full overflow-x-auto overflow-y-hidden">
                <table className="min-w-full w-max text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      <th className="p-3 border-r border-border min-w-[240px] sticky left-0 bg-[color-mix(in_srgb,var(--muted)_40%,var(--card))] z-20 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.15)]">Tender Title</th>
                      <th className="p-3 border-r border-border min-w-[120px]">Status</th>
                      <th className="p-3 border-r border-border min-w-[180px]">Workflow Stage</th>
                      <th className="p-3 border-r border-border min-w-[120px]">Category</th>
                      <th className="p-3 border-r border-border min-w-[140px]">Team</th>
                      <th className="p-3 border-r border-border min-w-[140px]">Bid ID</th>
                      <th className="p-3 border-r border-border min-w-[135px]">Platform</th>
                      <th className="p-3 border-r border-border min-w-[180px]">Department</th>
                      <th className="p-3 border-r border-border min-w-[140px]">Scope Type</th>
                      <th className="p-3 border-r border-border min-w-[120px]">EMD</th>
                      <th className="p-3 border-r border-border min-w-[130px]">EMD Exemption</th>
                      <th className="p-3 border-r border-border min-w-[110px]">BG Rate (%)</th>
                      <th className="p-3 border-r border-border min-w-[140px]">Activity Type</th>
                      <th className="p-3 border-r border-border min-w-[150px]">Target Month</th>
                      <th className="p-3 border-r border-border min-w-[150px]">Start Date</th>
                      <th className="p-3 border-r border-border min-w-[150px]">End Date</th>
                      <th className="p-3 border-r border-border min-w-[130px]">Estimated Value</th>
                      <th className="p-3 border-r border-border min-w-[120px]">Tech Eval</th>
                      <th className="p-3 border-r border-border min-w-[140px]">Submission Status</th>
                      <th className="p-3 border-r border-border min-w-[160px]">Fin Eval Status</th>
                      <th className="p-3 border-r border-border min-w-[140px]">PO Recv Status</th>
                      <th className="p-3 border-r border-border min-w-[140px]">Result</th>
                      <th className="p-3 border-r border-border min-w-[130px]">Owner</th>
                      <th className="p-3 border-r border-border min-w-[200px]">Remarks</th>
                      {inBin && <th className="p-3 min-w-[160px] text-center bg-rose-50/50 text-rose-900">Bin Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {effectiveBids.map((bid) => {
                      const isReadOnly = !sheetEditable || 
                        bid.bid_status === 'ARCHIVED' || 
                        bid.bid_status === 'CANCELLED' || 
                        bid.bid_status === 'WON' || 
                        bid.bid_status === 'LOST'
                      return (
                        <tr 
                          key={bid.id} 
                          className={`hover:bg-muted/30 transition-colors whitespace-nowrap align-middle group/row
                            ${['CANCELLED', 'ARCHIVED', 'LOST'].includes(bid.bid_status) ? 'text-muted-foreground/85' : ''}`}
                        >
                          {/* 1. Tender Title */}
                          <td 
                            onClick={(e) => {
                              e.stopPropagation()
                              if (isReadOnly && hasPermission('bid.view')) {
                                navigate(`/dashboard/tenders/${bid.id}`)
                              }
                            }}
                            className={`p-3 border-r border-border min-w-[240px] truncate max-w-sm sticky left-0 bg-card group-hover/row:bg-[color-mix(in_srgb,var(--muted)_30%,var(--card))] z-10 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.15)] ${isReadOnly ? 'font-semibold text-foreground hover:text-primary hover:underline cursor-pointer' : ''}`}
                          >
                            <div className="flex items-center gap-2.5 w-full">
                              {bid.bid_status === 'ACTIVE' ? (
                                <span className="relative flex size-2 shrink-0" title="Active">
                                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
                                </span>
                              ) : bid.bid_status === 'WON' ? (
                                <span className="size-2 rounded-full bg-sky-500 shrink-0" title="Won" />
                              ) : bid.bid_status === 'LOST' ? (
                                <span className="size-2 rounded-full bg-orange-500 shrink-0" title="Lost" />
                              ) : (
                                <span className="size-2 rounded-full bg-red-600 shrink-0" title={bid.bid_status} />
                              )}

                              {!isReadOnly ? (
                                <input 
                                  type="text" 
                                  value={bid.title || ''} 
                                  onChange={(e) => handleFieldChangeLocal(bid.id, 'title', e.target.value)} 
                                  onBlur={(e) => handleFieldSave(bid.id, 'title', e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                                  className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary px-1 py-0.5 text-xs text-foreground font-semibold rounded"
                                />
                              ) : (
                                <span className="truncate">{bid.title}</span>
                              )}
                            </div>
                          </td>

                          {/* 2. Status */}
                          <td className="p-3 border-r border-border text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                              ${bid.bid_status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30' :
                                bid.bid_status === 'WON' ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-400 border border-sky-200/50 dark:border-sky-800/30' :
                                bid.bid_status === 'LOST' ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-200/50 dark:border-orange-800/30' :
                                'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400 border border-red-200/50 dark:border-red-800/30'}`}>
                              {bid.bid_status}
                            </span>
                          </td>

                          {/* 3. Workflow Stage */}
                          <td className="p-3 border-r border-border">
                            {!isReadOnly ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="flex items-center gap-1.5 bg-background hover:bg-muted/50 text-foreground border border-border rounded-md px-2 py-1 text-xs text-left min-w-[130px] justify-between focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm">
                                    <span>{STAGE_OPTIONS.find(o => o.value === bid.workflow_stage)?.label || bid.workflow_stage || 'Discovered'}</span>
                                    <ChevronDown className="size-3 text-muted-foreground ml-1" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto min-w-[160px]">
                                  {STAGE_OPTIONS.filter(o => o.value !== '').map((o) => {
                                    const isCurrent = o.value === bid.workflow_stage
                                    const allowedNext = STAGE_TRANSITIONS[bid.workflow_stage] ?? []
                                    const isAllowed = isCurrent || allowedNext.includes(o.value)
                                    return (
                                      <DropdownMenuItem 
                                        key={o.value} 
                                        disabled={!isAllowed}
                                        onSelect={() => handleImmediateChangeAndSave(bid.id, 'workflow_stage', o.value)}
                                        className={`text-xs ${isCurrent ? 'font-semibold text-primary bg-accent/40' : ''}`}
                                      >
                                        {o.label}
                                      </DropdownMenuItem>
                                    )
                                  })}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <StageBadge stage={bid.workflow_stage} />
                            )}
                          </td>

                          {/* 4. Category */}
                          <td className="p-3 border-r border-border truncate max-w-xs">
                            {!isReadOnly ? (
                              <input 
                                type="text" 
                                value={bid.category || ''} 
                                onChange={(e) => handleFieldChangeLocal(bid.id, 'category', e.target.value)} 
                                onBlur={(e) => handleFieldSave(bid.id, 'category', e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                                className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary px-1 py-0.5 text-xs text-foreground rounded"
                                placeholder="Category"
                              />
                            ) : (
                              bid.category ?? '—'
                            )}
                          </td>

                          {/* 5. Team */}
                          <td className="p-3 border-r border-border">
                            {!isReadOnly ? (
                              <input 
                                type="text" 
                                value={bid.team || ''} 
                                onChange={(e) => handleFieldChangeLocal(bid.id, 'team', e.target.value)} 
                                onBlur={(e) => handleFieldSave(bid.id, 'team', e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                                className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary px-1 py-0.5 text-xs text-foreground rounded"
                                placeholder="Team"
                              />
                            ) : (
                              bid.team ?? '—'
                            )}
                          </td>

                          {/* 6. Bid ID (gem_bid_no) */}
                          <td className="p-3 border-r border-border font-mono text-primary font-medium">
                            {!isReadOnly ? (
                              <input 
                                type="text" 
                                value={bid.gem_bid_no || ''} 
                                onChange={(e) => handleFieldChangeLocal(bid.id, 'gem_bid_no', e.target.value)} 
                                onBlur={(e) => handleFieldSave(bid.id, 'gem_bid_no', e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                                className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary px-1 py-0.5 text-xs text-primary font-medium rounded font-mono"
                                placeholder="Bid ID"
                              />
                            ) : (
                              bid.gem_bid_no ?? '—'
                            )}
                          </td>

                          {/* 7. Platform (portal_source) */}
                          <td className="p-3 border-r border-border">
                            {!isReadOnly ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="flex items-center gap-1.5 bg-background hover:bg-muted/50 text-foreground border border-border rounded-md px-2 py-1 text-xs text-left min-w-[90px] justify-between focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm">
                                    <span>{bid.portal_source || 'Select Portal'}</span>
                                    <ChevronDown className="size-3 text-muted-foreground ml-1" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="min-w-[120px]">
                                  {PORTAL_SOURCES.map((p) => (
                                    <DropdownMenuItem 
                                      key={p} 
                                      onSelect={() => handleImmediateChangeAndSave(bid.id, 'portal_source', p)}
                                      className="text-xs"
                                    >
                                      {p}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              bid.portal_source ?? '—'
                            )}
                          </td>

                          {/* 8. Department (organization_name) */}
                          <td className="p-3 border-r border-border truncate max-w-xs">
                            {!isReadOnly ? (
                              <input 
                                type="text" 
                                value={bid.organization_name || ''} 
                                onChange={(e) => handleFieldChangeLocal(bid.id, 'organization_name', e.target.value)} 
                                onBlur={(e) => handleFieldSave(bid.id, 'organization_name', e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                                className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary px-1 py-0.5 text-xs text-foreground rounded"
                                placeholder="Department"
                              />
                            ) : (
                              bid.organization_name ?? '—'
                            )}
                          </td>

                          {/* 9. Scope Type */}
                          <td className="p-3 border-r border-border">
                            {!isReadOnly ? (
                              <input 
                                type="text" 
                                value={bid.scope_type || ''} 
                                onChange={(e) => handleFieldChangeLocal(bid.id, 'scope_type', e.target.value)} 
                                onBlur={(e) => handleFieldSave(bid.id, 'scope_type', e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                                className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary px-1 py-0.5 text-xs text-foreground rounded"
                                placeholder="Scope Type"
                              />
                            ) : (
                              bid.scope_type ?? '—'
                            )}
                          </td>

                          {/* 10. EMD Amount */}
                          <td className="p-3 border-r border-border font-medium text-foreground">
                            {!isReadOnly ? (
                              <input 
                                type="number" 
                                value={bid.emd_amount !== undefined && bid.emd_amount !== null ? bid.emd_amount : ''} 
                                onChange={(e) => handleFieldChangeLocal(bid.id, 'emd_amount', e.target.value)} 
                                onBlur={(e) => handleFieldSave(bid.id, 'emd_amount', e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                                disabled={!!bid.emd_exempted}
                                className={`w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary px-1 py-0.5 text-xs text-foreground font-medium rounded ${bid.emd_exempted ? 'text-muted-foreground bg-muted/20 cursor-not-allowed' : ''}`}
                                placeholder="0"
                              />
                            ) : (
                              formatCurrency(bid.emd_amount)
                            )}
                          </td>

                          {/* 11. EMD Exempted */}
                          <td className="p-3 border-r border-border">
                            {!isReadOnly ? (
                              <button
                                onClick={() => handleImmediateChangeAndSave(bid.id, 'emd_exempted', !bid.emd_exempted)}
                                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                                  bid.emd_exempted 
                                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                                    : 'bg-muted hover:bg-muted/80 text-muted-foreground border border-border'
                                }`}
                              >
                                {bid.emd_exempted ? 'Yes' : 'No'}
                              </button>
                            ) : (
                              bid.emd_exempted ? (
                                <span className="text-emerald-600 font-bold flex items-center gap-0.5"><Check className="size-3.5" /> Yes</span>
                              ) : (
                                <span className="text-muted-foreground">No</span>
                              )
                            )}
                          </td>

                          {/* 12. BG Rate */}
                          <td className="p-3 border-r border-border">
                            {!isReadOnly ? (
                              <input 
                                type="number"
                                step="any"
                                value={bid.bg_rate !== undefined && bid.bg_rate !== null ? bid.bg_rate : ''} 
                                onChange={(e) => handleFieldChangeLocal(bid.id, 'bg_rate', e.target.value)} 
                                onBlur={(e) => handleFieldSave(bid.id, 'bg_rate', e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                                className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary px-1 py-0.5 text-xs text-foreground rounded"
                                placeholder="BG Rate"
                              />
                            ) : (
                              bid.bg_rate !== undefined && bid.bg_rate !== null ? `${bid.bg_rate}%` : '—'
                            )}
                          </td>

                          {/* 13. Activity Type */}
                          <td className="p-3 border-r border-border">
                            {!isReadOnly ? (
                              <input 
                                type="text" 
                                value={bid.activity_type || ''} 
                                onChange={(e) => handleFieldChangeLocal(bid.id, 'activity_type', e.target.value)} 
                                onBlur={(e) => handleFieldSave(bid.id, 'activity_type', e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                                className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary px-1 py-0.5 text-xs text-foreground rounded"
                                placeholder="Activity Type"
                              />
                            ) : (
                              bid.activity_type ?? '—'
                            )}
                          </td>

                          {/* 14. Target Month Date */}
                          <td className="p-3 border-r border-border text-muted-foreground">
                            {!isReadOnly ? (
                              <input 
                                type="date" 
                                value={safeDateInputFormat(bid.target_month_date)} 
                                onChange={(e) => handleImmediateChangeAndSave(bid.id, 'target_month_date', e.target.value)}
                                className="bg-transparent border-none text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary p-0.5 rounded"
                              />
                            ) : (
                              formatDate(bid.target_month_date)
                            )}
                          </td>

                          {/* 15. Opening Date */}
                          <td className="p-3 border-r border-border text-muted-foreground">
                            {!isReadOnly ? (
                              <input 
                                type="date" 
                                value={safeDateInputFormat(bid.opening_date)} 
                                onChange={(e) => handleImmediateChangeAndSave(bid.id, 'opening_date', e.target.value)}
                                className="bg-transparent border-none text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary p-0.5 rounded"
                              />
                            ) : (
                              formatDate(bid.opening_date)
                            )}
                          </td>

                          {/* 16. Closing Date */}
                          <td className="p-3 border-r border-border text-muted-foreground">
                            {!isReadOnly ? (
                              <input 
                                type="date" 
                                value={safeDateInputFormat(bid.closing_date)} 
                                onChange={(e) => handleImmediateChangeAndSave(bid.id, 'closing_date', e.target.value)}
                                className="bg-transparent border-none text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary p-0.5 rounded"
                              />
                            ) : (
                              formatDate(bid.closing_date)
                            )}
                          </td>

                          {/* 17. Estimated Value */}
                          <td className="p-3 border-r border-border font-medium text-foreground">
                            {!isReadOnly ? (
                              <input 
                                type="number" 
                                value={bid.estimated_value !== undefined && bid.estimated_value !== null ? bid.estimated_value : ''} 
                                onChange={(e) => handleFieldChangeLocal(bid.id, 'estimated_value', e.target.value)} 
                                onBlur={(e) => handleFieldSave(bid.id, 'estimated_value', e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                                className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary px-1 py-0.5 text-xs text-foreground font-medium rounded"
                                placeholder="0"
                              />
                            ) : (
                              formatCurrency(bid.estimated_value)
                            )}
                          </td>

                          {/* 18. Tech Eval */}
                          <td className="p-3 border-r border-border">
                            {!isReadOnly ? (
                              <button
                                onClick={() => handleImmediateChangeAndSave(bid.id, 'has_tech_eval', !bid.has_tech_eval)}
                                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                                  bid.has_tech_eval 
                                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                                    : 'bg-muted hover:bg-muted/80 text-muted-foreground border border-border'
                                }`}
                              >
                                {bid.has_tech_eval ? 'Yes' : 'No'}
                              </button>
                            ) : (
                              bid.has_tech_eval ? (
                                <span className="text-emerald-600 font-bold flex items-center gap-0.5"><Check className="size-3.5" /> Yes</span>
                              ) : (
                                <span className="text-muted-foreground">No</span>
                              )
                            )}
                          </td>

                          {/* 19. Submission Status */}
                          <td className="p-3 border-r border-border">
                            {!isReadOnly ? (
                              <input 
                                type="text" 
                                value={bid.submission_status || ''} 
                                onChange={(e) => handleFieldChangeLocal(bid.id, 'submission_status', e.target.value)} 
                                onBlur={(e) => handleFieldSave(bid.id, 'submission_status', e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                                className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary px-1 py-0.5 text-xs text-foreground rounded"
                                placeholder="Submission Status"
                              />
                            ) : (
                              bid.submission_status ?? '—'
                            )}
                          </td>

                          {/* 20. Financial Evaluation Status */}
                          <td className="p-3 border-r border-border">
                            {!isReadOnly ? (
                              <input 
                                type="text" 
                                value={bid.financial_evaluation_status || ''} 
                                onChange={(e) => handleFieldChangeLocal(bid.id, 'financial_evaluation_status', e.target.value)} 
                                onBlur={(e) => handleFieldSave(bid.id, 'financial_evaluation_status', e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                                className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary px-1 py-0.5 text-xs text-foreground rounded"
                                placeholder="Financial Eval Status"
                              />
                            ) : (
                              bid.financial_evaluation_status ?? '—'
                            )}
                          </td>

                          {/* 21. PO Received Status */}
                          <td className="p-3 border-r border-border">
                            {!isReadOnly ? (
                              <input 
                                type="text" 
                                value={bid.po_received_status || ''} 
                                onChange={(e) => handleFieldChangeLocal(bid.id, 'po_received_status', e.target.value)} 
                                onBlur={(e) => handleFieldSave(bid.id, 'po_received_status', e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                                className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary px-1 py-0.5 text-xs text-foreground rounded"
                                placeholder="PO Received Status"
                              />
                            ) : (
                              bid.po_received_status ?? '—'
                            )}
                          </td>

                          {/* 22. Bid Result */}
                          <td className="p-3 border-r border-border">
                            {!isReadOnly ? (
                              <input 
                                type="text" 
                                value={bid.bid_result || ''} 
                                onChange={(e) => handleFieldChangeLocal(bid.id, 'bid_result', e.target.value)} 
                                onBlur={(e) => handleFieldSave(bid.id, 'bid_result', e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                                className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary px-1 py-0.5 text-xs text-foreground rounded"
                                placeholder="Result"
                              />
                            ) : (
                              bid.bid_result ?? '—'
                            )}
                          </td>

                          {/* 23. Owner */}
                          <td className="p-3 border-r border-border">
                            {!isReadOnly ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="flex items-center gap-1.5 bg-background hover:bg-muted/50 text-foreground border border-border rounded-md px-2 py-1 text-xs text-left min-w-[120px] justify-between focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm">
                                    <span>{bid.bid_owner?.full_name || 'Select Owner'}</span>
                                    <ChevronDown className="size-3 text-muted-foreground ml-1" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="max-h-[200px] overflow-y-auto min-w-[140px]">
                                  <DropdownMenuItem 
                                    onSelect={() => handleImmediateChangeAndSave(bid.id, 'bid_owner_id', null)}
                                    className="text-xs text-muted-foreground italic"
                                  >
                                    Unassigned
                                  </DropdownMenuItem>
                                  {users.map((u) => (
                                    <DropdownMenuItem 
                                      key={u.id} 
                                      onSelect={() => handleImmediateChangeAndSave(bid.id, 'bid_owner_id', u.id)}
                                      className="text-xs"
                                    >
                                      {u.full_name}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              bid.bid_owner?.full_name ?? '—'
                            )}
                          </td>

                          {/* 24. Remarks */}
                          <td className={`p-3 truncate max-w-xs text-muted-foreground ${inBin ? 'border-r border-border' : ''}`} title={bid.remarks}>
                            {!isReadOnly ? (
                              <input 
                                type="text" 
                                value={bid.remarks || ''} 
                                onChange={(e) => handleFieldChangeLocal(bid.id, 'remarks', e.target.value)} 
                                onBlur={(e) => handleFieldSave(bid.id, 'remarks', e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                                className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary px-1 py-0.5 text-xs text-foreground rounded"
                                placeholder="Remarks"
                              />
                            ) : (
                              bid.remarks ?? '—'
                            )}
                          </td>

                          {/* 25. Bin Actions */}
                          {inBin && (
                            <td className="p-3 bg-rose-50/20">
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[11px] px-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1 font-semibold"
                                  onClick={() => handleRestoreBid(bid.id, bid.title)}
                                >
                                  <RotateCcw className="size-3" />
                                  Restore
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-7 text-[11px] px-2 gap-1 font-semibold bg-rose-600 hover:bg-rose-700 text-white"
                                  onClick={() => handlePermanentDeleteBid(bid.id, bid.title)}
                                >
                                  <Trash2 className="size-3" />
                                  Purge
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                    )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Pagination ────────────────────────────────────────────────── */}
      {!loading && effectiveBids.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border border-border bg-card rounded-xl shadow-sm">
          <p className="text-xs text-muted-foreground">
            Showing {((page - 1) * (meta.limit ?? 20)) + 1}–{Math.min(page * (meta.limit ?? 20), meta.total ?? 0)} of {meta.total ?? 0} tenders
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="sm"
              className="h-7 w-7 p-0 border-border"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pg = i + 1
              return (
                <Button
                  key={pg}
                  variant={pg === page ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 w-7 p-0 text-xs"
                  onClick={() => setPage(pg)}
                >
                  {pg}
                </Button>
              )
            })}
            <Button
              variant="outline" size="sm"
              className="h-7 w-7 p-0 border-border"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
