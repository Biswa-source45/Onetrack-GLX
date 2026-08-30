import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useSearchParams, useLocation, useOutletContext } from 'react-router-dom'
import {
  Plus, Search, Filter, Download, RefreshCw, ChevronLeft, ChevronRight, ChevronDown,
  Building2, Calendar, DollarSign, Tag, ArrowUpRight, Loader2, X,
  AlertCircle, TrendingUp, FileText, Zap, MoreHorizontal, Eye,
  CheckCircle2, XCircle, Clock, Archive, LayoutGrid, LayoutList, TableProperties, ShieldCheck,
  User, Check, Square, Trash2, RotateCcw, Ban, History, PanelRightOpen, Eraser,
  UserCheck, Layers
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
  listBids, getBid, updateBid, transitionBidStage, restoreBid, permanentDeleteBid, getGlobalAuditHistory, getTenderPerformanceMatrix, STAGE_LABELS, statusStyle, STAGE_TRANSITIONS, listAllBids } from '../../services/bids'
import { ImportedPill } from './ImportedPill'
import { usePermissions } from '../../hooks/usePermissions'
import { useBidStore } from '../../store/useBidStore'
import { tokenStorage } from '../../services/auth'
import {
  formatCurrency, formatEmdExemption, formatDate, getBidEndDate,
  formatDateTime, getTargetMonthDisplay, getSubmissionStatusVal,
  getFinEvalStatusVal, getPoRecvStatusVal, getBidResultVal, escapeCSV,
  getDerivedBidStatusAndOutcome,
} from '../../lib/tenderFormat'
import { StageBadge, StatusTag } from '../../lib/tenderDisplay'

// ── Stage List order for progress computation ────────────────────────────────
// The real 10-stage pipeline (mirrors services/bids.js STAGE_LABELS). A
// terminal stage isn't a pipeline position, so it renders full progress
// rather than indexOf returning -1 and showing 0%.
const STAGES_ORDER = [
  'DISCOVERED',
  'OEM_AUTHORIZATION_REQUEST',
  'PRICING_REQUEST',
  'DOCUMENT_CHECKLIST_PREPARATION',
  'EMD_PROCESSING',
  'INTERNAL_APPROVAL',
  'GEM_SUBMISSION',
  'TECHNICAL_EVALUATION',
  'FINANCIAL_EVALUATION',
  'AWARD_HANDOVER',
]
const TERMINAL_STAGES = ['WON', 'LOST', 'CANCELLED']

// Helper to safely format datetimes for <input type="datetime-local"> without
// crashing on invalid/empty values, preserving time-of-day (unlike safeDateInputFormat).
function safeDateTimeInputFormat(dt) {
  if (!dt) return ''
  try {
    const d = new Date(dt)
    if (isNaN(d.getTime())) return ''
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

// Helper to safely format dates for <input type="date"> without crashing on invalid/empty values.
// Reads local date parts (like safeDateTimeInputFormat above), not toISOString(),
// which converts to UTC first and can render a day earlier than what read-only
// views show for the same timestamp.
function safeDateInputFormat(dt) {
  if (!dt) return ''
  try {
    const d = new Date(dt)
    if (isNaN(d.getTime())) return ''
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  } catch {
    return ''
  }
}

// ── Export to Excel/CSV (Full database export with compliance details) ─────────
async function exportToExcel() {
  const toastId = toast.loading('Fetching all tenders and details for export...')
  try {
    // 1. Retrieve all bids in the system
    const res = await listAllBids()
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
      'Bid ID',
      'Platform',
      'Department',
      'High Level Scope',
      'Quantity',
      'Scope Type',
      'EMD',
      'EMD Exemption',
      'BG Rate (%)',
      'Target Month',
      'Start Date',
      'End Date',
      'Estimated Value',
      'GlobX Total (Bid Submit Price)',
      'Tech Eval',
      'Submission Status',
      'Financial Evaluation Status',
      'PO Received',
      'PO Received Date',
      'EMD Ready Date',
      'BG Issued Date',
      'Delivery/Work Complete Date',
      'Our Rank',
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
        b.gem_bid_no ?? b.bid_no ?? '',
        b.portal_source ?? '',
        b.organization_name ?? b.department_name ?? '',
        b.high_level_scope ?? '',
        b.quantity ?? '',
        b.scope_type ?? '',
        b.emd_amount !== null && b.emd_amount !== undefined ? String(b.emd_amount) : '',
        formatEmdExemption(b),
        b.bg_rate !== null && b.bg_rate !== undefined ? `${b.bg_rate}%` : '',
        b.target_month_date ? new Date(b.target_month_date).toLocaleDateString('en-IN') : '—',
        b.opening_date ? new Date(b.opening_date).toLocaleDateString('en-IN') : '—',
        b.closing_date ? new Date(b.closing_date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—',
        b.estimated_value !== null && b.estimated_value !== undefined ? String(b.estimated_value) : '',
        b.quoted_price !== null && b.quoted_price !== undefined ? String(b.quoted_price) : '',
        b.technical_result === 'QUALIFIED' ? 'Qualified' : b.technical_result === 'DISQUALIFIED' ? 'Disqualified' : 'Pending',
        b.submission_status ?? '',
        b.financial_evaluation_status ?? '',
        b.po_received_status === 'PO Received' ? 'Yes' : (['LOST', 'CANCELLED'].includes(b.bid_status) ? 'N/A' : 'No'),
        formatDate(b.po_received_date),
        formatDate(b.emd_ready_date),
        formatDate(b.bg_discharged_date),
        formatDate(b.delivery_complete_date),
        b.our_rank ?? '',
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
  { value: 'OEM_AUTHORIZATION_REQUEST', label: '2. OEM Auth' },
  { value: 'PRICING_REQUEST', label: '3. Pricing Request' },
  { value: 'DOCUMENT_CHECKLIST_PREPARATION', label: '4. Checklist Prep' },
  { value: 'EMD_PROCESSING', label: '5. EMD Processing' },
  { value: 'INTERNAL_APPROVAL', label: '6. Internal Approval' },
  { value: 'GEM_SUBMISSION', label: '7. GeM Submission' },
  { value: 'TECHNICAL_EVALUATION', label: '8. Tech Eval' },
  { value: 'FINANCIAL_EVALUATION', label: '9. Financial Eval' },
  { value: 'AWARD_HANDOVER', label: '10. Award & Delivery' },
  { value: 'WON', label: 'Won' },
  { value: 'LOST', label: 'Lost' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'WON', label: 'Won' },
  { value: 'LOST', label: 'Lost' },
  { value: 'CANCELLED', label: 'Cancelled' },
  // Closed = assessed then dropped without bidding. Not a workflow stage, so it
  // appears here but never in STAGE_OPTIONS above.
  { value: 'CLOSED', label: 'Closed (No Bid)' },
  // No "Submitted" entry: a submitted tender moves straight to evaluation, so
  // it is always found under "Under Tech Eval". The sheet view still shows the
  // per-tender Submission Status column.
  { value: 'TECHNICAL_EVALUATION', label: 'Under Tech Eval' },
  { value: 'ACTIVE', label: 'Active' },
]

const END_DATE_OPTIONS = [
  { value: '', label: 'All End Dates' },
  { value: 'today', label: 'Ending Today' },
  { value: 'week', label: 'Ending This Week' },
  { value: 'month', label: 'Ending This Month' },
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

export function TendersPage({ initialScope = 'all' }) {
  const { hasPermission, isAdmin, hasRole } = usePermissions()
  const isManagementRole = isAdmin || hasRole('MANAGER')
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const outletContext = useOutletContext() || {}
  const currentUser = outletContext.user || tokenStorage.getUser()

  const isOwnedView = location.pathname.includes('/dashboard/tenders/owned') || initialScope === 'owned'

  const [sheetEditable, setSheetEditable] = useState(false)
  const [showAuditPanel, setShowAuditPanel] = useState(false)
  const [sheetAuditLog, setSheetAuditLog] = useState([])
  const [loadingAudit, setLoadingAudit] = useState(false)

  const fetchAuditLogs = useCallback(async () => {
    setLoadingAudit(true)
    try {
      const res = await getGlobalAuditHistory(100)
      if (res.ok && Array.isArray(res.data)) {
        setSheetAuditLog(res.data)
      }
    } catch (err) {
      console.error('Failed to load audit history:', err)
    } finally {
      setLoadingAudit(false)
    }
  }, [])

  useEffect(() => {
    if (showAuditPanel) {
      fetchAuditLogs()
    }
  }, [showAuditPanel, fetchAuditLogs])

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
    endDateFilter,
    ownerFilterId,
    setPage,
    setStageFilter,
    setStatusFilter,
    setSearchInput,
    setDebouncedSearch,
    setInBin,
    setViewMode,
    setScope,
    setEndDateFilter,
    setOwnerFilterId,
    loadBids,
    users,
    loadUsers,
  } = useBidStore()

  // Per-owner tender counts for the management-only Owner cross-filter.
  const [ownerStats, setOwnerStats] = useState([])
  useEffect(() => {
    if (!isManagementRole) return
    let active = true
    getTenderPerformanceMatrix().then((res) => {
      if (active && res.ok && Array.isArray(res.data)) setOwnerStats(res.data)
    }).catch(() => {})
    return () => { active = false }
  }, [isManagementRole])

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

    const targetOwnerId = isOwnedView ? (currentUser?.id || '') : ''
    setScope(isOwnedView ? 'owned' : 'all', targetOwnerId)
    loadUsers()
  }, [searchParams, isOwnedView, currentUser?.id])

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

  const isBidOwnedByUser = (bid, user) => {
    if (!user || !user.id) return true
    const ownerId = bid.bid_owner?.id || bid.bid_owner_id
    const creatorId = bid.created_by
    return (ownerId && ownerId === user.id) || (creatorId && creatorId === user.id)
  }

  // bid_status/bid_outcome are shown exactly as the server returns them -
  // re-deriving them client-side from free text made a card's own status
  // disagree with the stat-card counts (which come from the same server
  // truth via meta.*_count).
  const effectiveBids = bids
    .filter(bid => {
      if (isOwnedView && currentUser?.id) {
        return isBidOwnedByUser(bid, currentUser)
      }
      return true
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
            newBid.emd_not_applicable = false
          } else {
            if (b.emd_type === 'EXEMPTED') {
              newBid.emd_type = 'ONLINE'
            }
          }
        } else if (field === 'emd_not_applicable') {
          if (value) {
            newBid.emd_type = 'NOT_APPLICABLE'
            newBid.emd_amount = 0
            newBid.emd_exempted = false
          } else if (b.emd_type === 'NOT_APPLICABLE') {
            newBid.emd_type = 'ONLINE'
          }
        } else if (field === 'emd_type') {
          if (value === 'EXEMPTED') {
            newBid.emd_exempted = true
            newBid.emd_not_applicable = false
            newBid.emd_amount = 0
          } else if (value === 'NOT_APPLICABLE') {
            newBid.emd_not_applicable = true
            newBid.emd_exempted = false
            newBid.emd_amount = 0
          } else {
            newBid.emd_exempted = false
            newBid.emd_not_applicable = false
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
    if (field === 'estimated_value' || field === 'emd_amount' || field === 'bg_rate' || field === 'quantity') {
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
      emd_not_applicable: !!currentBid.emd_not_applicable,
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

    // Only re-derive bid_status/bid_outcome when the Result cell itself was
    // the field just edited - deriving on every unrelated save (e.g. a
    // remarks edit) meant free text the sheet never intended as a verdict
    // ("Reverse Auction Scheduled", a typo, anything not on the recognised
    // list) silently flipped the tender to Lost in the database. Even here,
    // an unrecognised result is left alone rather than guessed as a loss.
    if (field === 'bid_result') {
      const resultLower = (sendValue || '').trim().toLowerCase()
      if (resultLower.includes('l1') || resultLower.includes('won')) {
        payload.bid_status = 'WON'
        payload.bid_outcome = 'WON'
      } else if (resultLower === 'result pending' || resultLower === 'na' ||
        resultLower === 'bid in progress' || resultLower === 'pending' || resultLower === '') {
        payload.bid_status = 'ACTIVE'
        payload.bid_outcome = null
      }
      // Anything else is kept as free text with bid_status/bid_outcome
      // untouched - the team can record the real outcome explicitly.
    }
    if (field === 'emd_exempted') {
      if (value) {
        payload.emd_type = 'EXEMPTED'
        payload.emd_amount = null
        payload.emd_not_applicable = false
      } else {
        if (currentBid.emd_type === 'EXEMPTED') {
          payload.emd_type = 'ONLINE'
        }
      }
    } else if (field === 'emd_not_applicable') {
      if (value) {
        payload.emd_type = 'NOT_APPLICABLE'
        payload.emd_amount = null
        payload.emd_exempted = false
      } else if (currentBid.emd_type === 'NOT_APPLICABLE') {
        payload.emd_type = 'ONLINE'
      }
    } else if (field === 'emd_type') {
      if (value === 'EXEMPTED') {
        payload.emd_exempted = true
        payload.emd_not_applicable = false
        payload.emd_amount = null
      } else if (value === 'NOT_APPLICABLE') {
        payload.emd_not_applicable = true
        payload.emd_exempted = false
        payload.emd_amount = null
      } else {
        payload.emd_exempted = false
        payload.emd_not_applicable = false
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
        // Refresh database-backed audit log if open
        if (showAuditPanel) {
          fetchAuditLogs()
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

  // PO Received is a clear Yes/No fact (mirrors the Stage 12 checklist), not free
  // text — writes both the status and the received date together, same as Stage 12.
  const handlePoReceivedToggle = async (bidId, checked) => {
    const newStatus = checked ? 'PO Received' : 'Pending'
    handleFieldChangeLocal(bidId, 'po_received_status', newStatus)
    try {
      const res = await updateBid(bidId, {
        po_received_status: newStatus,
        po_received_date: checked ? new Date().toISOString() : undefined,
      })
      if (res.ok) {
        toast.success(checked ? 'PO marked as Received' : 'PO status set to Pending')
      } else {
        toast.error(res.error?.message ?? 'Failed to update PO status')
        loadBids()
      }
    } catch {
      toast.error('Network error')
      loadBids()
    }
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
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-heading text-2xl font-bold text-foreground">
              {inBin ? 'Tender Bin' : isOwnedView ? 'Owned Tenders' : 'Tenders Workspace'}
            </h1>

            {/* Workspace Navigation Tabs */}
            <div className="flex items-center bg-muted/60 border border-border p-1 rounded-lg text-xs gap-1">
              <button
                type="button"
                onClick={() => {
                  setInBin(false)
                  setSearchParams({})
                  navigate('/dashboard/tenders')
                }}
                className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                  !inBin && !isOwnedView
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Layers className="size-3.5" />
                All Tenders
              </button>

              <button
                type="button"
                onClick={() => {
                  setInBin(false)
                  setSearchParams({})
                  navigate('/dashboard/tenders/owned')
                }}
                className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                  !inBin && isOwnedView
                    ? 'bg-card text-foreground shadow-xs text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <UserCheck className="size-3.5" />
                Owned Tenders
              </button>

              <button
                type="button"
                onClick={() => navigate('/dashboard/tenders/master')}
                title="Every tender in one continuous, scrollable sheet"
                className="px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <LayoutList className="size-3.5" />
                Master Sheet
              </button>

              <button
                type="button"
                onClick={() => {
                  setInBin(true)
                  setSearchParams({ bin: 'true' })
                }}
                className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                  inBin
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-rose-600'
                }`}
              >
                <Trash2 className="size-3.5" />
                Tender Bin
              </button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {inBin
              ? 'Soft-deleted tender workspaces. Items are retained for 15 days before permanent auto-purge.'
              : isOwnedView
              ? `Displaying tenders assigned to or created by ${currentUser?.full_name || currentUser?.username || 'your account'}.`
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
          { label: 'Won', value: meta.won_count ?? 0, icon: CheckCircle2, color: 'text-sky-600', bg: 'bg-sky-50/50', filterKey: 'WON' },
          { label: 'Lost', value: meta.lost_count ?? 0, icon: XCircle, color: 'text-orange-600', bg: 'bg-orange-50/50', filterKey: 'LOST' },
          { label: 'Cancelled', value: meta.cancelled_count ?? 0, icon: Ban, color: 'text-red-600', bg: 'bg-red-50/50', filterKey: 'CANCELLED' },
          { label: 'Closed', value: meta.closed_count ?? 0, icon: Archive, color: 'text-zinc-600', bg: 'bg-zinc-50/50', filterKey: 'CLOSED' },
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

            {/* End date quick filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8.5 text-xs font-normal bg-background border-input text-foreground hover:bg-muted/50 gap-1.5">
                  <Calendar className="size-3 text-muted-foreground" />
                  <span>{END_DATE_OPTIONS.find(o => o.value === endDateFilter)?.label || 'All End Dates'}</span>
                  <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Filter by End Date</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {END_DATE_OPTIONS.map((o) => (
                  <DropdownMenuItem key={o.value} onSelect={() => setEndDateFilter(o.value)}>
                    {o.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Owner cross-filter — Manager/Admin/Super Admin only */}
            {isManagementRole && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8.5 text-xs font-normal bg-background border-input text-foreground hover:bg-muted/50 gap-1.5">
                    <User className="size-3 text-muted-foreground" />
                    <span className="max-w-[140px] truncate">
                      {ownerFilterId ? (ownerStats.find(s => s.user_id === ownerFilterId)?.full_name ?? 'Owner') : 'All Owners'}
                    </span>
                    <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-72 overflow-y-auto w-[260px]">
                  <DropdownMenuLabel>Filter by Owner</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setOwnerFilterId('')}>
                    All Owners
                  </DropdownMenuItem>
                  {ownerStats.map((s) => (
                    <DropdownMenuItem key={s.user_id} onSelect={() => setOwnerFilterId(s.user_id)}>
                      <span className="flex-1 truncate">{s.full_name}</span>
                      <span className="text-muted-foreground text-[11px] ml-2 shrink-0">{s.total} tenders</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Clear filters */}
            {(stageFilter || statusFilter || searchInput || endDateFilter || ownerFilterId) && (
              <Button variant="ghost" size="sm" className="h-8.5 text-xs gap-1"
                onClick={() => { setSearchInput(''); setStageFilter(''); setStatusFilter(''); setEndDateFilter(''); setOwnerFilterId(''); setPage(1) }}>
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

            {viewMode === 'sheets' && (
              <button
                onClick={() => setShowAuditPanel(p => !p)}
                className={`h-8.5 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm
                  ${showAuditPanel
                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-500/20'
                    : 'bg-background hover:bg-muted border border-border text-muted-foreground hover:text-foreground'}`}
                title="Sheet Change History"
              >
                <History className={`size-3.5 ${showAuditPanel ? 'text-white' : 'text-muted-foreground'}`} />
                {sheetAuditLog.length > 0 ? `History (${sheetAuditLog.length})` : 'History'}
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
            <p className="font-semibold text-sm text-foreground">
              {isOwnedView ? 'No Owned Tenders Found' : 'No matching tenders found'}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              {isOwnedView
                ? 'You do not currently own or have not created any tenders matching the applied filters.'
                : searchInput || stageFilter || statusFilter
                ? 'Refine your query filters or criteria.'
                : 'Create your first tender to spin up a workflow workspace.'}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            {isOwnedView && (
              <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/tenders')}>
                View All Tenders
              </Button>
            )}
            {hasPermission('bid.create') && !searchInput && !stageFilter && !statusFilter && (
              <Button size="sm" className="gap-1.5" onClick={() => navigate('/dashboard/tenders/new')}>
                <Plus className="size-3.5" />
                Add Tender
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div>
          {viewMode === 'cards' ? (
            /* ── Card Gallery Grid (Default) ── */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence initial={false}>
                {effectiveBids.map((bid, i) => {
                  const currentStageIdx = STAGES_ORDER.indexOf(bid.workflow_stage)
                  const progressPct = TERMINAL_STAGES.includes(bid.workflow_stage)
                    ? 100
                    : currentStageIdx >= 0
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
                        ${statusStyle(bid.bid_status).tint}
                        ${['CANCELLED', 'CLOSED', 'LOST', 'ARCHIVED'].includes(bid.bid_status) ? 'opacity-80' : ''}
                        ${hasPermission('bid.view') ? 'cursor-pointer' : ''}`}
                    >
                      {/* Decorative colored top line based on status */}
                      <div className={`absolute top-0 left-0 right-0 h-1 ${statusStyle(bid.bid_status).accent}`} />
                      {/* Stamp watermark for terminal status tenders */}
                      {['CANCELLED', 'CLOSED', 'WON', 'LOST'].includes(bid.bid_status) && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10 select-none">
                          <span className={`text-4xl font-black tracking-widest rotate-[-25deg] opacity-[0.13]
                            ${statusStyle(bid.bid_status).dot.replace('bg-', 'text-')}`}>
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
                            {(bid.gem_bid_no || bid.bid_no) && (
                              <span className="text-[10px] font-mono text-primary font-semibold">
                                {bid.gem_bid_no || bid.bid_no}
                              </span>
                            )}
                            {bid.is_imported && <ImportedPill />}
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
            <div className={`flex gap-3 w-full items-start`}>
              {/* Table */}
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex-1 min-w-0">
              <div className="w-full overflow-x-auto overflow-y-hidden">
                <table className="min-w-full w-max text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      <th className="p-3 border-r border-border min-w-[240px] sticky left-0 bg-[color-mix(in_srgb,var(--muted)_40%,var(--card))] z-20 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.15)]">Tender Title</th>
                      <th className="p-3 border-r border-border min-w-[120px]">Status</th>
                      <th className="p-3 border-r border-border min-w-[180px]">Workflow Stage</th>
                      <th className="p-3 border-r border-border min-w-[120px]">Category</th>
                      <th className="p-3 border-r border-border min-w-[140px]">Bid ID</th>
                      <th className="p-3 border-r border-border min-w-[135px]">Platform</th>
                      <th className="p-3 border-r border-border min-w-[180px]">Department</th>
                      <th className="p-3 border-r border-border min-w-[240px]">High Level Scope</th>
                      <th className="p-3 border-r border-border min-w-[90px]">Quantity</th>
                      <th className="p-3 border-r border-border min-w-[140px]">Scope Type</th>
                      <th className="p-3 border-r border-border min-w-[120px]">EMD</th>
                      <th className="p-3 border-r border-border min-w-[100px]">No EMD</th>
                      <th className="p-3 border-r border-border min-w-[130px]">EMD Exemption</th>
                      <th className="p-3 border-r border-border min-w-[110px]">BG Rate (%)</th>
                      <th className="p-3 border-r border-border min-w-[150px]">Target Month</th>
                      <th className="p-3 border-r border-border min-w-[150px]">Start Date</th>
                      <th className="p-3 border-r border-border min-w-[180px]">End Date</th>
                      <th className="p-3 border-r border-border min-w-[130px]">Estimated Value</th>
                      <th className="p-3 border-r border-border min-w-[140px]">GlobX Total</th>
                      <th className="p-3 border-r border-border min-w-[120px]">Tech Eval</th>
                      <th className="p-3 border-r border-border min-w-[140px]">Submission Status</th>
                      <th className="p-3 border-r border-border min-w-[160px]">Fin Eval Status</th>
                      <th className="p-3 border-r border-border min-w-[140px]">PO Received</th>
                      <th className="p-3 border-r border-border min-w-[140px]">PO Received Date</th>
                      <th className="p-3 border-r border-border min-w-[140px]">EMD Ready Date</th>
                      <th className="p-3 border-r border-border min-w-[140px]">BG Issued Date</th>
                      <th className="p-3 border-r border-border min-w-[150px]">Delivery/Work Complete Date</th>
                      <th className="p-3 border-r border-border min-w-[110px]">Our Rank</th>
                      <th className="p-3 border-r border-border min-w-[140px]">Result</th>
                      <th className="p-3 border-r border-border min-w-[130px]">Owner</th>
                      <th className="p-3 border-r border-border min-w-[200px]">Remarks</th>
                      {inBin && <th className="p-3 min-w-[160px] text-center bg-rose-50/50 text-rose-900">Bin Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {effectiveBids.map((bid) => {
                      // WON and LOST bids are still editable (for typo corrections etc.).
                      // Only ARCHIVED/CANCELLED are truly read-only in sheet mode.
                      const isReadOnly = !sheetEditable || bid.bid_status === 'ARCHIVED'
                      // One "RFP/BID ID" in the tracker maps to two columns here:
                      // GeM portal ids land in gem_bid_no, everything else in
                      // bid_no. Show and edit whichever one actually holds it.
                      const bidIdField = bid.gem_bid_no ? 'gem_bid_no' : (bid.bid_no ? 'bid_no' : 'gem_bid_no')
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
                              {bid.is_imported && <ImportedPill compact />}
                              {bid.bid_status === 'ACTIVE' ? (
                                <span className="relative flex size-2 shrink-0" title="Active">
                                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
                                </span>
                              ) : (
                                <span
                                  className={`size-2 rounded-full shrink-0 ${statusStyle(bid.bid_status).dot}`}
                                  title={bid.bid_status}
                                />
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
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusStyle(bid.bid_status).pill}`}>
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

                          {/* 6. Bid ID (gem_bid_no) */}
                          <td className="p-3 border-r border-border font-mono text-primary font-medium">
                            {!isReadOnly ? (
                              <input 
                                type="text" 
                                value={bid[bidIdField] || ''} 
                                onChange={(e) => handleFieldChangeLocal(bid.id, bidIdField, e.target.value)} 
                                onBlur={(e) => handleFieldSave(bid.id, bidIdField, e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                                className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary px-1 py-0.5 text-xs text-primary font-medium rounded font-mono"
                                placeholder="Bid ID"
                              />
                            ) : (
                              bid.gem_bid_no ?? bid.bid_no ?? '—'
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

                          {/* High Level Scope */}
                          <td className="p-3 border-r border-border truncate max-w-xs">
                            {!isReadOnly ? (
                              <input
                                type="text"
                                value={bid.high_level_scope || ''}
                                onChange={(e) => handleFieldChangeLocal(bid.id, 'high_level_scope', e.target.value)}
                                onBlur={(e) => handleFieldSave(bid.id, 'high_level_scope', e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                                className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary px-1 py-0.5 text-xs text-foreground rounded"
                                placeholder="High Level Scope"
                              />
                            ) : (
                              bid.high_level_scope ?? '—'
                            )}
                          </td>

                          {/* Quantity */}
                          <td className="p-3 border-r border-border">
                            {!isReadOnly ? (
                              <input
                                type="text"
                                value={bid.quantity ?? ''}
                                onChange={(e) => handleFieldChangeLocal(bid.id, 'quantity', e.target.value)}
                                onBlur={(e) => handleFieldSave(bid.id, 'quantity', e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                                className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary px-1 py-0.5 text-xs text-foreground rounded"
                                placeholder="Qty"
                              />
                            ) : (
                              bid.quantity ?? '—'
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

                          {/* 10b. No EMD (distinct from EMD Exempted — tender has no EMD clause at all) */}
                          <td className="p-3 border-r border-border">
                            {!isReadOnly ? (
                              <button
                                onClick={() => handleImmediateChangeAndSave(bid.id, 'emd_not_applicable', !bid.emd_not_applicable)}
                                disabled={!!bid.emd_exempted}
                                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                  bid.emd_not_applicable
                                    ? 'bg-slate-500 hover:bg-slate-600 text-white'
                                    : 'bg-muted hover:bg-muted/80 text-muted-foreground border border-border'
                                }`}
                              >
                                {bid.emd_not_applicable ? 'Yes' : 'No'}
                              </button>
                            ) : (
                              bid.emd_not_applicable ? (
                                <span className="text-slate-600 font-bold flex items-center gap-0.5">
                                  <Check className="size-3.5" /> Yes
                                </span>
                              ) : (
                                <span className="text-muted-foreground">No</span>
                              )
                            )}
                          </td>

                          {/* 11. EMD Exempted */}
                          <td className="p-3 border-r border-border">
                            {!isReadOnly ? (
                              <button
                                onClick={() => handleImmediateChangeAndSave(bid.id, 'emd_exempted', !bid.emd_exempted)}
                                disabled={!!bid.emd_not_applicable}
                                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                  bid.emd_exempted
                                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                                    : 'bg-muted hover:bg-muted/80 text-muted-foreground border border-border'
                                }`}
                              >
                                {bid.emd_exempted ? 'Yes' : 'No'}
                              </button>
                            ) : (
                              bid.emd_exempted ? (
                                <span className="text-emerald-600 font-bold flex items-center gap-0.5" title={formatEmdExemption(bid)}>
                                  <Check className="size-3.5" /> {formatEmdExemption(bid)}
                                </span>
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

                          {/* 14. Target Month Date */}
                          <td className="p-3 border-r border-border text-foreground font-medium">
                            {!isReadOnly ? (
                              <input 
                                type="date" 
                                value={safeDateInputFormat(bid.target_month_date)} 
                                onChange={(e) => handleImmediateChangeAndSave(bid.id, 'target_month_date', e.target.value)}
                                className="bg-transparent border-none text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary p-0.5 rounded"
                              />
                            ) : (
                              getTargetMonthDisplay(bid)
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

                          {/* 16. Closing Date (carries a real submission-deadline time) */}
                          <td className="p-3 border-r border-border text-muted-foreground">
                            {!isReadOnly ? (
                              <input
                                type="datetime-local"
                                value={safeDateTimeInputFormat(bid.closing_date)}
                                onChange={(e) => handleImmediateChangeAndSave(bid.id, 'closing_date', e.target.value)}
                                className="bg-transparent border-none text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary p-0.5 rounded"
                              />
                            ) : (
                              formatDateTime(bid.closing_date)
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

                          {/* GlobX Total — the final submitted bid price (Stage 7 / GeM Submission),
                               sourced automatically from the approved Pricing Request total. Read-only. */}
                          <td className="p-3 border-r border-border font-mono font-semibold text-foreground">
                            {bid.quoted_price !== null && bid.quoted_price !== undefined ? formatCurrency(bid.quoted_price) : '—'}
                          </td>

                          {/* 18. Tech Eval — the actual Technical Evaluation result, set only via the
                               Stage 10 workspace (captures the disqualification reason and correctly
                               closes the bid as LOST). Read-only here to avoid bypassing that. */}
                          <td className="p-3 border-r border-border">
                            {bid.technical_result === 'QUALIFIED' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <Check className="size-3" /> Qualified
                              </span>
                            ) : bid.technical_result === 'DISQUALIFIED' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                <XCircle className="size-3" /> Disqualified
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">Pending</span>
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
                                placeholder={getSubmissionStatusVal(bid)}
                              />
                            ) : (
                              <StatusTag text={getSubmissionStatusVal(bid)} />
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
                                placeholder={getFinEvalStatusVal(bid)}
                              />
                            ) : (
                              <StatusTag text={getFinEvalStatusVal(bid)} />
                            )}
                          </td>

                          {/* 21. PO Received — a clear Yes/No fact, mirrors the Stage 12 checklist */}
                          <td className="p-3 border-r border-border">
                            {!isReadOnly ? (
                              <button
                                onClick={() => handlePoReceivedToggle(bid.id, bid.po_received_status !== 'PO Received')}
                                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                                  bid.po_received_status === 'PO Received'
                                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                                    : 'bg-muted hover:bg-muted/80 text-muted-foreground border border-border'
                                }`}
                              >
                                {bid.po_received_status === 'PO Received' ? 'Yes' : 'No'}
                              </button>
                            ) : (
                              bid.po_received_status === 'PO Received' ? (
                                <span className="text-emerald-600 font-bold flex items-center gap-0.5"><Check className="size-3.5" /> Yes</span>
                              ) : (
                                <span className="text-muted-foreground">{getPoRecvStatusVal(bid) === 'N/A' ? 'N/A' : 'No'}</span>
                              )
                            )}
                          </td>

                          {/* PO Received / EMD Ready / BG Issued / Delivery Complete dates —
                               all read-only, set from their respective stage workspace actions. */}
                          <td className="p-3 border-r border-border text-muted-foreground">{formatDate(bid.po_received_date)}</td>
                          <td className="p-3 border-r border-border text-muted-foreground">{formatDate(bid.emd_ready_date)}</td>
                          <td className="p-3 border-r border-border text-muted-foreground">{formatDate(bid.bg_discharged_date)}</td>
                          <td className="p-3 border-r border-border text-muted-foreground">{formatDate(bid.delivery_complete_date)}</td>

                          {/* Our Rank - set at Financial Evaluation (L1 when won) */}
                          <td className="p-3 border-r border-border">
                            {!isReadOnly ? (
                              <input
                                type="text"
                                value={bid.our_rank ?? ''}
                                onChange={(e) => handleFieldChangeLocal(bid.id, 'our_rank', e.target.value)}
                                onBlur={(e) => handleFieldSave(bid.id, 'our_rank', e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                                className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary px-1 py-0.5 text-xs text-primary font-medium rounded font-mono"
                                placeholder="e.g. L2"
                              />
                            ) : (
                              bid.our_rank ?? '—'
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
                                placeholder={getBidResultVal(bid)}
                              />
                            ) : (
                              <StatusTag text={getBidResultVal(bid)} />
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
              </div>{/* close table card div */}

              {/* ── Sheet Audit Panel (Smooth Sliding Sidebar Drawer) ─────────────────── */}
              <AnimatePresence>
                {showAuditPanel && (
                  <motion.div
                    initial={{ opacity: 0, x: 60, scale: 0.96 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 60, scale: 0.96 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 320 }}
                    className="w-84 shrink-0 rounded-xl border border-indigo-200 bg-indigo-50/70 dark:bg-indigo-950/30 dark:border-indigo-900/60 shadow-lg overflow-hidden flex flex-col max-h-[80vh] sticky top-4"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-indigo-200 dark:border-indigo-900/60 bg-indigo-100/80 dark:bg-indigo-900/40 backdrop-blur-sm">
                      <div className="flex items-center gap-2">
                        <History className="size-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 tracking-wide">Database Audit Trail</span>
                        {sheetAuditLog.length > 0 && (
                          <span className="text-[10px] font-bold bg-indigo-600 text-white rounded-full px-2 py-0.5 shadow-xs">
                            {sheetAuditLog.length}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={fetchAuditLogs}
                          className="p-1 rounded-md text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200/60 dark:hover:bg-indigo-800/50 transition-colors"
                          title="Refresh Audit Logs"
                        >
                          <RefreshCw className={`size-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          onClick={() => setShowAuditPanel(false)}
                          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-indigo-200/60 dark:hover:bg-indigo-800/50 transition-colors"
                          title="Close / Minimize Panel"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    </div>

                    {/* Log entries */}
                    <div className="overflow-y-auto flex-1 divide-y divide-indigo-100 dark:divide-indigo-900/40">
                      {loadingAudit ? (
                        <div className="p-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                          <Loader2 className="size-5 animate-spin text-indigo-500" />
                          Loading database audit trail...
                        </div>
                      ) : sheetAuditLog.length === 0 ? (
                        <div className="p-6 text-center text-xs text-muted-foreground">
                          <History className="size-8 mx-auto mb-2 text-indigo-200" />
                          No system logs recorded yet.<br />Edit tender fields to create audit entries.
                        </div>
                      ) : sheetAuditLog.map(entry => {
                        const user = entry.transitioned_by || {}
                        const userName = user.full_name || user.username || 'System'
                        const userRole = user.role || 'USER'
                        const dateStr = entry.created_at ? new Date(entry.created_at) : new Date()

                        return (
                          <div key={entry.id} className="px-3.5 py-2.5 text-[11px] space-y-1.5 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/20 transition-colors">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-indigo-900 dark:text-indigo-300 truncate max-w-[170px]" title={entry.bid_title}>
                                {entry.bid_title}
                              </span>
                              <span className="text-muted-foreground text-[10px] shrink-0 ml-1">
                                {dateStr.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                              </span>
                            </div>

                            <div className="text-[11px] font-medium text-foreground bg-background/90 border border-indigo-100 dark:border-indigo-900/50 rounded-lg p-2 leading-snug shadow-2xs">
                              {entry.transition_reason || (
                                <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                                  Stage: {entry.from_stage ? `${entry.from_stage} → ` : ''}{entry.to_stage}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                              <div className="flex items-center gap-1">
                                <span>By</span>
                                <span className="font-semibold text-foreground">{userName}</span>
                                <span className="text-[9px] uppercase font-mono bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded px-1.5 py-0.2 font-semibold">
                                  {userRole}
                                </span>
                              </div>
                              <span>{dateStr.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
