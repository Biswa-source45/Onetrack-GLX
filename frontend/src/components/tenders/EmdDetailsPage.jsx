import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, IndianRupee, Landmark, Search, Filter, Download,
  RefreshCw, ChevronDown, ChevronRight, Clock, Calendar, CheckCircle2,
  AlertCircle, AlertTriangle, XCircle, FileText, ExternalLink,
  Copy, Check, Layers, Eye, Pencil, ArrowUpRight, Building2,
  User, Wallet, Receipt, FileSpreadsheet, Sparkles, RotateCcw,
  Info, ChevronLeft, ArrowUpDown, ArrowLeft, SearchX
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import { listAllBids } from '../../services/bids'
import { getEmdDetails, EMD_STATUS_CONFIG, REFUND_STATUS_CONFIG, fmtMoney } from '../../services/emd'
import {
  formatCurrency, formatAmount, formatDate, formatDateTime,
  formatEmdExemption, getBidEndDate, getTargetMonthDisplay
} from '../../lib/tenderFormat'
import { StageBadge, StatusBadge } from '../../lib/tenderDisplay'
import { usePermissions } from '../../hooks/usePermissions'
import { downloadExcel } from '../../lib/excelExport'
import { ExportSuccessDialog } from './ExportSuccessDialog'
import { EmdDetailsDialog } from './EmdDetailsDialog'
import { ReceiptPreviewModal } from './EmdLifecycleCard'
import { ImportedPill } from './ImportedPill'
import { InProgressPill } from './InProgressPill'

// ── Helpers ──────────────────────────────────────────────────────────────────
function isPreSubmission(b) {
  if (b.submission_done) return false
  if (b.submission_status === 'SUBMITTED' || b.bid_status === 'SUBMITTED') return false
  const submittedStages = ['GEM_SUBMISSION', 'TECHNICAL_EVALUATION', 'FINANCIAL_EVALUATION', 'AWARD_HANDOVER', 'WON']
  if (submittedStages.includes(b.workflow_stage)) return false
  return true
}

function isEmdRequired(b) {
  if (b.emd_not_applicable) return false
  if (b.emd_exempted) return false
  if (Array.isArray(b.emd_exemption_types) && b.emd_exemption_types.length > 0) return false
  return (Number(b.emd_amount) || 0) > 0
}

function isActivePipeline(b) {
  const terminal = ['CANCELLED', 'CLOSED', 'LOST']
  if (terminal.includes(b.workflow_stage)) return false
  if (terminal.includes(b.bid_status)) return false
  if (b.bid_outcome === 'LOST' || b.bid_outcome === 'CANCELLED') return false
  return true
}

function getDeadlineDate(b) {
  const dt = b.closing_date || b.end_date || b.submission_deadline
  if (!dt) return null
  const d = new Date(dt)
  return isNaN(d.getTime()) || d.getFullYear() <= 1970 ? null : d
}

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)
  if (!text || text === '—') return null
  const handleCopy = (e) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success(`Copied: ${text}`)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors inline-flex items-center ml-1"
      title={label}
    >
      {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
    </button>
  )
}

// ── Master EMD Details Page Component ─────────────────────────────────────────
export function EmdDetailsPage() {
  const navigate = useNavigate()
  const { hasRole, hasPermission } = usePermissions()

  // Restriction: Only Managing Director (MD), Finance, and Account Manager can see and access EMD details.
  // All other roles are strictly restricted.
  const canAccess = hasRole('FINANCE') || hasRole('FINANCE_MANAGER') || hasRole('FINANCE_EXECUTIVE') ||
    hasRole('MANAGING_DIRECTOR') || hasRole('ADMIN') || hasRole('SUPER_ADMIN') ||
    hasRole('ACCOUNT_MANAGER') || hasRole('SALES_MANAGER') || hasRole('ACCOUNTS_MANAGER')
  const canManage = canAccess

  // State
  const [bids, setBids] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [emdDetailsCache, setEmdDetailsCache] = useState({})
  const [expandedBidIds, setExpandedBidIds] = useState(new Set())

  // Dialogs
  const [activeDialogBid, setActiveDialogBid] = useState(null)
  const [dialogSection, setDialogSection] = useState('basic')
  const [receiptModal, setReceiptModal] = useState({ open: false, url: '', title: '' })
  const [exportResult, setExportResult] = useState(null)
  const [exporting, setExporting] = useState(false)

  // Filters
  const [activePill, setActivePill] = useState('total')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('all')
  const [selectedReturnStatus, setSelectedReturnStatus] = useState('all')
  const [selectedMdStatus, setSelectedMdStatus] = useState('all')
  const [selectedStage, setSelectedStage] = useState('all')
  const [sortBy, setSortBy] = useState('deadline_asc')

  // Pagination
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)

  // ── Load Bids ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async (isRefresh = false) => {
    if (!canAccess) return
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const res = await listAllBids()
      if (res.ok && Array.isArray(res.data)) {
        setBids(res.data)
      } else {
        toast.error('Failed to load tenders for EMD register')
      }
    } catch (err) {
      console.error('Failed loading tenders:', err)
      toast.error('Network error loading tenders')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Pre-fetch single EMD details on expand
  const fetchSingleEmdDetails = useCallback(async (bidId) => {
    if (emdDetailsCache[bidId]) return emdDetailsCache[bidId]
    try {
      const res = await getEmdDetails(bidId)
      if (res.ok && res.data) {
        setEmdDetailsCache((prev) => ({ ...prev, [bidId]: res.data }))
        return res.data
      }
    } catch {
      // ignore
    }
    return null
  }, [emdDetailsCache])

  const toggleRowExpand = (bidId) => {
    setExpandedBidIds((prev) => {
      const next = new Set(prev)
      if (next.has(bidId)) {
        next.delete(bidId)
      } else {
        next.add(bidId)
        fetchSingleEmdDetails(bidId)
      }
      return next
    })
  }

  const handleOpenDialog = (bid, section = 'basic') => {
    setActiveDialogBid(bid)
    setDialogSection(section)
  }

  const handleDialogSuccess = () => {
    if (activeDialogBid?.id) {
      fetchSingleEmdDetails(activeDialogBid.id)
    }
    loadData(true)
  }

  // ── Transform & Enrich Bid Row ─────────────────────────────────────────────
  const enrichedBids = useMemo(() => {
    return bids.map((b) => {
      const emd = emdDetailsCache[b.id] || {}
      const emdAmt = Number(b.emd_amount) || 0
      const isReq = isEmdRequired(b)
      const isExempt = b.emd_exempted || b.emd_not_applicable || (Array.isArray(b.emd_exemption_types) && b.emd_exemption_types.length > 0)
      const isReady = Boolean(b.emd_ready)
      const isReturned = Boolean(b.emd_returned || emd.refund_status === 'Refunded')
      const isPre = isPreSubmission(b)
      const isActive = isActivePipeline(b)

      // Payment Mode
      const paymentMode = emd.payment_mode || b.emd_type || (isExempt ? 'Exempted' : (b.emd_ready ? 'Online' : '—'))

      // Who will give payment / Depositor Name & Dept
      const depositor = emd.depositor_name
        ? `${emd.depositor_name}${emd.depositor_department ? ` (${emd.depositor_department})` : ''}`
        : (isReady ? 'Finance Dept' : (isExempt ? 'N/A (Exempted)' : 'Pending Prep'))

      // Payment Amount
      const paymentAmount = emd.payment_amount != null
        ? Number(emd.payment_amount)
        : (isReady ? emdAmt : 0)

      // Payment Date
      const paymentDate = emd.payment_date || b.emd_ready_date || null

      // Payment Reference / UTR
      const paymentRef = emd.payment_reference || (isReady ? (b.gem_bid_no ? `UTR-${b.gem_bid_no.slice(-6)}` : 'Recorded') : '—')

      // MD Approval Status
      const mdStatus = emd.status || (isReady ? 'MD Approved' : (isExempt ? 'Exempted' : 'Pending MD Approval'))

      // EMD Return or Not
      const returnOrNot = isReturned
        ? 'Returned'
        : (isReady && !isPre ? 'Not Returned (Pending)' : (isPre ? 'Not Submitted Yet' : 'N/A'))

      // How much will return / Refund Amount (₹)
      const refundAmount = emd.refund_amount != null
        ? Number(emd.refund_amount)
        : (isReturned ? emdAmt : (isReady && !isPre ? emdAmt : 0))

      // Refund Status
      const refundStatus = isReturned
        ? 'Refunded'
        : (emd.refund_status || (isReady && !isPre ? 'Pending' : 'Not Applicable'))

      // Actual Return Date
      const actualRefundDate = emd.actual_refund_date || b.emd_returned_date || null

      // Refund Reference / UTR
      const refundRef = emd.refund_reference_no || (isReturned ? 'Settled to Bank' : '—')

      return {
        ...b,
        emdAmt,
        isReq,
        isExempt,
        isReady,
        isReturned,
        isPre,
        isActive,
        paymentMode,
        depositor,
        paymentAmount,
        paymentDate,
        paymentRef,
        paymentReceiptUrl: emd.payment_receipt_url,
        mdStatus,
        returnOrNot,
        refundAmount,
        refundStatus,
        actualRefundDate,
        refundRef,
        refundReceiptUrl: emd.refund_receipt_url,
        bankName: b.emd_bank_name || '—',
        accountNumber: b.emd_account_number || '—',
        ifscCode: b.emd_ifsc_code || '—',
        beneficiary: b.emd_beneficiary || '—',
        branch: b.emd_branch || '—',
        payableAt: b.emd_payable_at || '—',
        remarks: b.emd_remarks || emd.remarks || emd.refund_remarks || '—',
      }
    })
  }, [bids, emdDetailsCache])

  function formatInr(val) {
    if (!val || isNaN(val) || val <= 0) return '₹0'
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`
    return `₹${Math.round(val).toLocaleString('en-IN')}`
  }

  // ── Counts for Filter Pills ───────────────────────────────────────────────
  const counts = useMemo(() => {
    let total = enrichedBids.length
    let returned = 0
    let awaiting = 0
    let ready = 0
    let needsArrangement = 0
    let exempted = 0

    for (const b of enrichedBids) {
      const isRet = b.isReturned || b.refund_status === 'Refunded'
      const isAwaiting = !isRet && !b.isExempt && (b.refund_status === 'Initiated' || b.refund_status === 'Pending' || (b.isReady && !b.isPre))

      if (isRet) returned++
      if (isAwaiting) awaiting++
      if (b.isReady) ready++
      if (b.isReq && b.isActive && b.isPre && !b.isReady) needsArrangement++
      if (b.isExempt) exempted++
    }

    return { total, returned, awaiting, ready, needsArrangement, exempted }
  }, [enrichedBids])

  // ── Financial Reconciliation Summary Metrics ─────────────────────────────
  const financialMetrics = useMemo(() => {
    let disbursedSum = 0
    let recoveredSum = 0
    let outstandingSum = 0
    let lostPendingCount = 0
    let lostPendingSum = 0

    for (const b of enrichedBids) {
      if (b.isExempt) continue
      const amt = Number(b.payment_amount) || Number(b.emd_amount) || 0
      const refAmt = Number(b.refund_amount) || (b.isReturned || b.refund_status === 'Refunded' ? amt : 0)

      const isRet = b.isReturned || b.refund_status === 'Refunded'
      const isDisbursed = b.isReady || b.isPaid || isRet || b.refund_status === 'Initiated'

      if (isDisbursed) {
        disbursedSum += amt
      }
      if (isRet) {
        recoveredSum += refAmt
      } else if (isDisbursed) {
        outstandingSum += Math.max(0, amt - refAmt)
      }

      const isLost = b.bid_status === 'LOST' || b.workflow_stage === 'LOST' || b.bid_outcome === 'LOST' || b.technical_result === 'DISQUALIFIED'
      if (isLost && !isRet && (isDisbursed || amt > 0)) {
        lostPendingCount++
        lostPendingSum += Math.max(0, amt - refAmt)
      }
    }

    const recoveryRate = disbursedSum > 0 ? Math.round((recoveredSum / disbursedSum) * 100) : 100

    return {
      disbursedSum,
      recoveredSum,
      outstandingSum,
      lostPendingCount,
      lostPendingSum,
      recoveryRate,
    }
  }, [enrichedBids])

  // ── Filter Pills Definition ───────────────────────────────────────────────
  const PILLS = [
    { key: 'total', label: 'Total', count: counts.total },
    { key: 'returned', label: 'EMD Returned', count: counts.returned, color: 'text-teal-600 dark:text-teal-400' },
    { key: 'awaiting', label: 'Awaiting Refund / Initiated', count: counts.awaiting, color: 'text-indigo-600 dark:text-indigo-400' },
    { key: 'ready', label: 'EMD Ready / Paid', count: counts.ready, color: 'text-emerald-600 dark:text-emerald-400' },
    { key: 'needs_arrangement', label: 'Needs Arrangement', count: counts.needsArrangement, color: 'text-amber-600 dark:text-amber-400' },
    { key: 'exempted', label: 'Exempted / No EMD', count: counts.exempted },
  ]

  // ── Filter & Sort Logic ───────────────────────────────────────────────────
  const filteredBids = useMemo(() => {
    return enrichedBids.filter((b) => {
      const isRet = b.isReturned || b.refund_status === 'Refunded'
      const isAwaiting = !isRet && !b.isExempt && (b.refund_status === 'Initiated' || b.refund_status === 'Pending' || (b.isReady && !b.isPre))

      // 1. Pill Filter
      if (activePill === 'returned' && !isRet) return false
      if (activePill === 'awaiting' && !isAwaiting) return false
      if (activePill === 'ready' && !b.isReady) return false
      if (activePill === 'needs_arrangement' && (!b.isReq || !b.isActive || !b.isPre || b.isReady)) return false
      if (activePill === 'exempted' && !b.isExempt) return false

      // 2. Search Term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        const match = [
          b.organization_name,
          b.title,
          b.bid_no,
          b.gem_bid_no,
          b.depositor,
          b.paymentMode,
          b.paymentRef,
          b.refundRef,
          b.bankName,
          b.beneficiary,
          b.accountNumber,
          b.ifscCode,
          b.remarks,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!match.includes(q)) return false
      }

      // 3. Payment Mode Filter
      if (selectedPaymentMode !== 'all') {
        const mode = (b.paymentMode || '').toUpperCase()
        if (selectedPaymentMode === 'ONLINE' && !mode.includes('ONLINE') && mode !== 'NETBANKING' && mode !== 'RTGS') return false
        if (selectedPaymentMode === 'DD' && !mode.includes('DD') && !mode.includes('DEMAND DRAFT')) return false
        if (selectedPaymentMode === 'CHEQUE' && !mode.includes('CHEQUE')) return false
        if (selectedPaymentMode === 'CHALLAN' && !mode.includes('CHALLAN')) return false
        if (selectedPaymentMode === 'BG' && !mode.includes('BG') && !mode.includes('BANK GUARANTEE')) return false
        if (selectedPaymentMode === 'FDR' && !mode.includes('FDR') && !mode.includes('FIXED DEPOSIT')) return false
      }

      // 4. Return Status Filter
      if (selectedReturnStatus === 'RETURNED' && !b.isReturned) return false
      if (selectedReturnStatus === 'PENDING' && (b.isReturned || !b.isReady || b.isPre)) return false
      if (selectedReturnStatus === 'NOT_APPLICABLE' && b.isReq) return false

      // 5. MD Approval Status Filter
      if (selectedMdStatus !== 'all') {
        const md = (b.mdStatus || '').toUpperCase()
        if (selectedMdStatus === 'APPROVED' && !md.includes('APPROVED')) return false
        if (selectedMdStatus === 'PENDING' && !md.includes('PENDING')) return false
        if (selectedMdStatus === 'REJECTED' && !md.includes('REJECTED')) return false
      }

      // 6. Workflow Stage Filter
      if (selectedStage !== 'all') {
        if (selectedStage === 'PRE_SUBMISSION' && !b.isPre) return false
        if (selectedStage === 'SUBMITTED' && (b.isPre || ['WON', 'LOST', 'CANCELLED'].includes(b.workflow_stage))) return false
        if (selectedStage === 'WON' && b.bid_status !== 'WON' && b.workflow_stage !== 'WON' && b.bid_outcome !== 'WON') return false
        if (selectedStage === 'LOST' && b.bid_status !== 'LOST' && b.workflow_stage !== 'LOST' && b.bid_outcome !== 'LOST') return false
      }

      return true
    }).sort((a, b) => {
      if (sortBy === 'deadline_asc') {
        const da = getDeadlineDate(a)
        const db = getDeadlineDate(b)
        if (!da && !db) return 0
        if (!da) return 1
        if (!db) return -1
        return da.getTime() - db.getTime()
      }
      if (sortBy === 'deadline_desc') {
        const da = getDeadlineDate(a)
        const db = getDeadlineDate(b)
        if (!da && !db) return 0
        if (!da) return 1
        if (!db) return -1
        return db.getTime() - da.getTime()
      }
      if (sortBy === 'amount_desc') {
        return (Number(b.emdAmt) || 0) - (Number(a.emdAmt) || 0)
      }
      if (sortBy === 'amount_asc') {
        return (Number(a.emdAmt) || 0) - (Number(b.emdAmt) || 0)
      }
      if (sortBy === 'refund_desc') {
        return (Number(b.refundAmount) || 0) - (Number(a.refundAmount) || 0)
      }
      if (sortBy === 'account_asc') {
        return (a.organization_name || '').localeCompare(b.organization_name || '')
      }
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    })
  }, [
    enrichedBids, activePill, searchTerm, selectedPaymentMode,
    selectedReturnStatus, selectedMdStatus, selectedStage, sortBy
  ])

  // Active filter count
  const activeFiltersCount = useMemo(() => {
    let c = 0
    if (activePill !== 'total') c++
    if (searchTerm.trim()) c++
    if (selectedPaymentMode !== 'all') c++
    if (selectedReturnStatus !== 'all') c++
    if (selectedMdStatus !== 'all') c++
    if (selectedStage !== 'all') c++
    return c
  }, [activePill, searchTerm, selectedPaymentMode, selectedReturnStatus, selectedMdStatus, selectedStage])

  const handleResetFilters = () => {
    setActivePill('total')
    setSearchTerm('')
    setSelectedPaymentMode('all')
    setSelectedReturnStatus('all')
    setSelectedMdStatus('all')
    setSelectedStage('all')
    setSortBy('deadline_asc')
    setCurrentPage(1)
  }

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredBids.length / pageSize))
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredBids.slice(start, start + pageSize)
  }, [filteredBids, currentPage, pageSize])

  // ── Excel Export ───────────────────────────────────────────────────────────
  async function handleExportExcel() {
    if (filteredBids.length === 0) {
      toast.info('No EMD records to export for this filter')
      return
    }

    setExporting(true)
    const toastId = toast.loading('Generating Excel sheet with full EMD details…')

    try {
      const headers = [
        'Account Name / Client',
        'Tender Title',
        'Bid Number / RFP Number',
        'End Date / Deadline',
        'EMD Amount (₹)',
        'EMD Required / Exemption',
        'EMD Initiated / Ready Status',
        'EMD Initiated Date',
        'Payment Mode',
        'Who Will Give Payment / Depositor',
        'Payment Amount (₹)',
        'Payment Date',
        'Payment Ref / UTR',
        'MD Approval Status',
        'EMD Return or Not',
        'How Much Will Return / Refund Amount (₹)',
        'Refund Status',
        'Actual Return Date',
        'Refund Ref / UTR',
        'Bank Name',
        'Account Number',
        'IFSC Code',
        'Beneficiary Name',
        'Branch',
        'Payable At',
        'Workflow Stage',
        'Result / Status',
        'Remarks'
      ]

      const rows = filteredBids.map((b) => [
        b.organization_name || b.authority || '',
        b.title || '',
        b.gem_bid_no || b.bid_no || '',
        formatDate(b.closing_date || b.end_date || b.submission_deadline),
        b.emdAmt || '',
        formatEmdExemption(b),
        b.isReady ? 'Ready / Initiated' : (b.isExempt ? 'Exempted' : 'Needs Arrangement'),
        formatDate(b.emd_ready_date),
        b.paymentMode || '',
        b.depositor || '',
        b.paymentAmount || '',
        formatDate(b.paymentDate),
        b.paymentRef !== '—' ? b.paymentRef : '',
        b.mdStatus || '',
        b.returnOrNot,
        b.refundAmount || '',
        b.refundStatus,
        formatDate(b.actualRefundDate),
        b.refundRef !== '—' ? b.refundRef : '',
        b.bankName !== '—' ? b.bankName : '',
        b.accountNumber !== '—' ? b.accountNumber : '',
        b.ifscCode !== '—' ? b.ifscCode : '',
        b.beneficiary !== '—' ? b.beneficiary : '',
        b.branch !== '—' ? b.branch : '',
        b.payableAt !== '—' ? b.payableAt : '',
        b.workflow_stage || '',
        b.bid_status || b.bid_outcome || '',
        b.remarks !== '—' ? b.remarks : ''
      ])

      const stamp = new Date().toISOString().slice(0, 10)
      const filename = `EMD_Master_Sheet_Reconciliation_${activePill}_${stamp}.xlsx`

      await downloadExcel({
        sheetName: 'EMD Master Sheet',
        headers,
        rows,
        filename,
      })

      toast.dismiss(toastId)
      setExportResult({ count: filteredBids.length, filename })
    } catch (err) {
      console.error('Excel export error:', err)
      toast.error(err.message || 'Excel export failed', { id: toastId })
    } finally {
      setExporting(false)
    }
  }

  // Pre-fetch single EMD details in background for current page
  useEffect(() => {
    paginatedRows.forEach((b) => {
      if (!emdDetailsCache[b.id] && isEmdRequired(b)) {
        fetchSingleEmdDetails(b.id)
      }
    })
  }, [paginatedRows, emdDetailsCache, fetchSingleEmdDetails])

  if (!canAccess) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full p-8 rounded-2xl border border-border bg-card text-center space-y-4 shadow-sm">
          <div className="size-16 rounded-full bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center mx-auto text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
            <ShieldCheck className="size-8" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-foreground">Access Restricted</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The EMD Details page is strictly restricted to <strong className="text-foreground">Managing Director (MD)</strong>, <strong className="text-foreground">Finance</strong>, and <strong className="text-foreground">Account Manager</strong>.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')} className="mt-2 text-xs">
            Return to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 lg:p-8 space-y-4">
      {/* ── Top Header (Matches Master Sheet Layout) ──────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="size-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {activePill === 'returned'
                    ? 'EMD Returned · Master Sheet'
                    : activePill === 'awaiting'
                      ? 'EMD Awaiting Refund · Reconciliation'
                      : activePill === 'ready'
                        ? 'EMD Ready & Prepared'
                        : activePill === 'needs_arrangement'
                          ? 'EMD Needs Arrangement'
                          : 'EMD Details · Master Sheet'}
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                {activePill === 'returned'
                  ? 'Tenders whose EMD has been refunded'
                  : activePill === 'awaiting'
                    ? 'Submitted tenders with deposited EMD awaiting return from procuring authority'
                    : activePill === 'ready'
                      ? 'Tenders where EMD payment / bank guarantee has been prepared & confirmed'
                      : activePill === 'needs_arrangement'
                        ? 'Active pipeline tenders requiring EMD funds / BG arrangement before deadline'
                        : 'Master financial reconciliation of EMD deposits, readiness, payments, MD sign-offs, and refund recovery'}
                {' '}· <strong className="text-foreground">{filteredBids.length} tenders</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
            className="gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin text-primary' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={exporting || filteredBids.length === 0}
            className="gap-1.5 text-xs font-semibold shadow-xs"
          >
            <Download className="size-3.5" />
            Export to Excel
          </Button>
        </div>
      </div>

      {/* ── Financial Reconciliation Summary Cards ───────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Disbursed */}
        <div className="bg-card border border-border/80 rounded-xl p-3.5 shadow-2xs hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-[11px] font-semibold tracking-wide uppercase">Total EMD Disbursed</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <Wallet className="size-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-foreground">
            {formatInr(financialMetrics.disbursedSum)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Capital deposited across tenders
          </p>
        </div>

        {/* Card 2: Total Recovered */}
        <div className="bg-card border border-border/80 rounded-xl p-3.5 shadow-2xs hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-[11px] font-semibold tracking-wide uppercase">Total EMD Recovered</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatInr(financialMetrics.recoveredSum)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">{financialMetrics.recoveryRate}%</span> recovered back to accounts
          </p>
        </div>

        {/* Card 3: Outstanding in Recovery */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setActivePill('awaiting')
            setCurrentPage(1)
          }}
          className={`bg-card border rounded-xl p-3.5 shadow-2xs cursor-pointer transition-all ${activePill === 'awaiting'
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/20'
            : 'border-border/80 hover:border-indigo-400/60 hover:bg-muted/30'
            }`}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-[11px] font-semibold tracking-wide uppercase">Outstanding in Recovery</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {formatInr(financialMetrics.outstandingSum)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            <span className="font-semibold text-foreground">{counts.awaiting} tenders</span> awaiting authority return
          </p>
        </div>

        {/* Card 4: Lost Tenders Pending Refund */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setActivePill('awaiting')
            setStageFilter('ALL')
            setSearchTerm('LOST')
            setCurrentPage(1)
          }}
          className={`bg-card border rounded-xl p-3.5 shadow-2xs cursor-pointer transition-all ${searchTerm === 'LOST'
            ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20 dark:bg-rose-950/20'
            : 'border-border/80 hover:border-rose-400/60 hover:bg-muted/30'
            }`}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-[11px] font-semibold tracking-wide uppercase">Lost Bids In Recovery</span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <RotateCcw className="size-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400">
            {formatInr(financialMetrics.lostPendingSum)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            <span className="font-semibold text-foreground">{financialMetrics.lostPendingCount} lost bids</span> (auto-initiated)
          </p>
        </div>
      </div>

      {/* ── Filter Pills (Exact Pill Bar) ─────────────────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {PILLS.map((pill) => {
          const active = activePill === pill.key
          return (
            <button
              key={pill.key}
              onClick={() => {
                setActivePill(pill.key)
                setCurrentPage(1)
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${active
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
            >
              <span>{pill.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-background text-foreground'
                }`}>
                {pill.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Secondary Filter & Search Controls ────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg p-3 shadow-2xs space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              placeholder="Filter by account, tender title, bid no, UTR, depositor..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-9 h-8 text-xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Payment Mode Selector */}
          <div>
            <select
              value={selectedPaymentMode}
              onChange={(e) => {
                setSelectedPaymentMode(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">Payment Mode: All</option>
              <option value="ONLINE">Online (Netbanking/NEFT/RTGS)</option>
              <option value="DD">Demand Draft (DD)</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CHALLAN">Treasury Challan</option>
              <option value="BG">Bank Guarantee (BG)</option>
              <option value="FDR">Fixed Deposit (FDR)</option>
            </select>
          </div>

          {/* Return Status Selector */}
          <div>
            <select
              value={selectedReturnStatus}
              onChange={(e) => {
                setSelectedReturnStatus(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">EMD Return: All</option>
              <option value="RETURNED">Returned (Refunded)</option>
              <option value="PENDING">Pending Return</option>
              <option value="NOT_APPLICABLE">Not Applicable</option>
            </select>
          </div>

          {/* Stage Selector */}
          <div>
            <select
              value={selectedStage}
              onChange={(e) => {
                setSelectedStage(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">Stage: All</option>
              <option value="PRE_SUBMISSION">Pre-Submission (Live)</option>
              <option value="SUBMITTED">Submitted / In Evaluation</option>
              <option value="WON">Won / Awarded</option>
              <option value="LOST">Lost</option>
            </select>
          </div>
        </div>

        {/* Sub-bar: Sort & Clear Filter */}
        <div className="flex items-center justify-between text-xs pt-2 border-t border-border/40">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-medium">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-7 rounded border border-input bg-background px-2 py-0.5 text-xs shadow-xs"
            >
              <option value="deadline_asc">End Date (Earliest First)</option>
              <option value="deadline_desc">End Date (Latest First)</option>
              <option value="amount_desc">EMD Amount (Highest First)</option>
              <option value="amount_asc">EMD Amount (Lowest First)</option>
              <option value="refund_desc">Refund Amount (Highest First)</option>
              <option value="account_asc">Account Name (A–Z)</option>
            </select>

            <span className="text-muted-foreground ml-3">
              Showing <strong>{filteredBids.length}</strong> matching tenders
            </span>
          </div>

          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-7 px-2 text-xs font-semibold text-destructive hover:bg-destructive/10"
            >
              <RotateCcw className="size-3 mr-1" /> Clear All Filters ({activeFiltersCount})
            </Button>
          )}
        </div>
      </div>

      {/* ── The Master EMD Sheet Table (Exact Spreadsheet Data Grid) ──────── */}
      <div className="border border-border rounded-lg overflow-auto max-h-[75vh] shadow-xs">
        <table className="min-w-full w-max text-left border-collapse text-xs">
          <thead className="sticky top-0 z-20">
            <tr className="bg-muted/90 backdrop-blur border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
              {/* Pinned Sticky Left: Account Name */}
              <th className="p-3 border-r border-border sticky left-0 z-30 bg-[color-mix(in_srgb,var(--muted)_90%,var(--card))] min-w-[260px]">
                ACCOUNT NAME
              </th>
              <th className="p-3 border-r border-border min-w-[240px]">TENDER TITLE</th>
              <th className="p-3 border-r border-border min-w-[190px]">
                BID NUMBER / RFP NUMBER
                <span className="block text-[10px] font-medium normal-case tracking-normal text-primary/80">Click the number to open the tender page</span>
              </th>
              <th className="p-3 border-r border-border min-w-[150px]">END DATE</th>
              <th className="p-3 border-r border-border min-w-[140px]">EMD AMOUNT (₹)</th>
              <th className="p-3 border-r border-border min-w-[130px]">EMD EXEMPTION</th>
              <th className="p-3 border-r border-border min-w-[160px]">EMD INITIATED / READY</th>
              <th className="p-3 border-r border-border min-w-[140px]">EMD READY DATE</th>
              <th className="p-3 border-r border-border min-w-[140px]">PAYMENT MODE</th>
              <th className="p-3 border-r border-border min-w-[200px]">WHO WILL GIVE PAYMENT</th>
              <th className="p-3 border-r border-border min-w-[140px]">PAYMENT AMOUNT (₹)</th>
              <th className="p-3 border-r border-border min-w-[140px]">PAYMENT DATE</th>
              <th className="p-3 border-r border-border min-w-[180px]">PAYMENT REF / UTR</th>
              <th className="p-3 border-r border-border min-w-[150px]">MD APPROVAL</th>
              <th className="p-3 border-r border-border min-w-[150px]">EMD RETURN OR NOT</th>
              <th className="p-3 border-r border-border min-w-[160px]">HOW MUCH WILL RETURN (₹)</th>
              <th className="p-3 border-r border-border min-w-[130px]">REFUND STATUS</th>
              <th className="p-3 border-r border-border min-w-[140px]">ACTUAL RETURN DATE</th>
              <th className="p-3 border-r border-border min-w-[180px]">REFUND REF / UTR</th>
              <th className="p-3 border-r border-border min-w-[160px]">BANK NAME</th>
              <th className="p-3 border-r border-border min-w-[160px]">ACCOUNT NUMBER</th>
              <th className="p-3 border-r border-border min-w-[130px]">IFSC CODE</th>
              <th className="p-3 border-r border-border min-w-[180px]">BENEFICIARY</th>
              <th className="p-3 border-r border-border min-w-[130px]">STAGE</th>
              <th className="p-3 border-r border-border min-w-[110px]">RESULT</th>
              <th className="p-3 border-r border-border min-w-[220px]">REMARKS</th>
              <th className="p-3 min-w-[100px] text-center sticky right-0 z-30 bg-[color-mix(in_srgb,var(--muted)_90%,var(--card))]">
                ACTION
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={27} className="p-12 text-center text-muted-foreground">
                  <RefreshCw className="size-6 text-primary animate-spin inline mr-2" />
                  Loading EMD register details…
                </td>
              </tr>
            ) : paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={27} className="p-12 text-center text-muted-foreground">
                  No tenders match your current filter selections.
                </td>
              </tr>
            ) : (
              paginatedRows.map((b) => {
                const isExpanded = expandedBidIds.has(b.id)
                return (
                  <React.Fragment key={b.id}>
                    <tr
                      className="hover:bg-muted/30 transition-colors whitespace-nowrap align-middle"
                    >
                      {/* Pinned Sticky Left: Account Name */}
                      <td className="p-3 border-r border-border sticky left-0 z-10 bg-card font-semibold text-foreground max-w-xs truncate">
                        <div className="flex items-center gap-1.5">
                          {b.is_imported && <ImportedPill compact />}
                          {b.derived_status === 'ACTIVE' && <InProgressPill compact />}
                          <span className="truncate hover:text-primary transition-colors cursor-pointer" onClick={() => navigate(`/dashboard/tenders/${b.id}`)} title={b.organization_name || b.authority || '—'}>
                            {b.organization_name || b.authority || '—'}
                          </span>
                        </div>
                      </td>

                      {/* Tender Title */}
                      <td className="p-3 border-r border-border max-w-xs truncate text-foreground font-medium">
                        <span className="truncate hover:underline cursor-pointer" onClick={() => navigate(`/dashboard/tenders/${b.id}`)} title={b.title}>
                          {b.title}
                        </span>
                      </td>

                      {/* Bid Number / RFP Number (clickable) */}
                      <td className="p-3 border-r border-border font-mono text-primary max-w-xs truncate">
                        <span
                          onClick={() => navigate(`/dashboard/tenders/${b.id}`)}
                          className="hover:underline cursor-pointer"
                          title="Click to open tender"
                        >
                          {b.gem_bid_no || b.bid_no || '—'}
                        </span>
                        {(b.gem_bid_no || b.bid_no) && <CopyButton text={b.gem_bid_no || b.bid_no} label="Copy Bid ID" />}
                      </td>

                      {/* End Date */}
                      <td className="p-3 border-r border-border text-foreground">
                        {formatDateTime(b.closing_date || b.end_date || b.submission_deadline)}
                      </td>

                      {/* EMD Amount (₹) */}
                      <td className="p-3 border-r border-border font-medium text-foreground">
                        {b.emdAmt > 0 ? formatAmount(b.emdAmt) : '—'}
                      </td>

                      {/* EMD Exemption */}
                      <td className="p-3 border-r border-border">
                        {b.isExempt ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                            {formatEmdExemption(b)}
                          </span>
                        ) : (
                          'Required'
                        )}
                      </td>

                      {/* EMD Initiated / Ready Status */}
                      <td className="p-3 border-r border-border">
                        {b.isReady ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <Check className="size-3" /> Ready / Initiated
                          </span>
                        ) : b.isExempt ? (
                          <span className="text-muted-foreground text-[11px]">Exempted</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Clock className="size-3" /> Needs Arrangement
                          </span>
                        )}
                      </td>

                      {/* EMD Ready Date */}
                      <td className="p-3 border-r border-border text-foreground">
                        {formatDate(b.emd_ready_date)}
                      </td>

                      {/* Payment Mode */}
                      <td className="p-3 border-r border-border">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-secondary text-secondary-foreground">
                          {b.paymentMode}
                        </span>
                      </td>

                      {/* Who Will Give Payment / Depositor */}
                      <td className="p-3 border-r border-border text-foreground max-w-xs truncate font-medium">
                        <span title={b.depositor}>{b.depositor}</span>
                      </td>

                      {/* Payment Amount (₹) */}
                      <td className="p-3 border-r border-border font-medium text-foreground">
                        {b.paymentAmount > 0 ? formatAmount(b.paymentAmount) : '—'}
                      </td>

                      {/* Payment Date */}
                      <td className="p-3 border-r border-border text-foreground">
                        {formatDate(b.paymentDate)}
                      </td>

                      {/* Payment Ref / UTR */}
                      <td className="p-3 border-r border-border font-mono text-xs">
                        <span className="truncate">{b.paymentRef}</span>
                        {b.paymentRef !== '—' && <CopyButton text={b.paymentRef} label="Copy UTR" />}
                        {b.paymentReceiptUrl && (
                          <button
                            type="button"
                            onClick={() => setReceiptModal({ open: true, url: b.paymentReceiptUrl, title: `Payment Receipt: ${b.title}` })}
                            className="ml-1 text-[10px] text-primary hover:underline inline-flex items-center gap-0.5"
                          >
                            <Receipt className="size-3" /> Proof
                          </button>
                        )}
                      </td>

                      {/* MD Approval Status */}
                      <td className="p-3 border-r border-border">
                        {b.mdStatus.includes('Approved') ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            MD Approved
                          </span>
                        ) : b.mdStatus.includes('Pending') ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-200 dark:border-orange-800 animate-pulse">
                            Pending MD
                          </span>
                        ) : b.mdStatus.includes('Rejected') ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            Rejected
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{b.mdStatus}</span>
                        )}
                      </td>

                      {/* EMD Return or Not */}
                      <td className="p-3 border-r border-border">
                        {b.isReturned ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-teal-50 text-teal-800 dark:bg-teal-950/50 dark:text-teal-200 border border-teal-300 dark:border-teal-700">
                            <Check className="size-3 text-teal-600" /> Returned
                          </span>
                        ) : b.isReady && !b.isPre ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                            <Clock className="size-3 text-amber-600" /> Not Returned (Pending)
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">
                            {b.isPre ? 'Not Submitted' : 'N/A'}
                          </span>
                        )}
                      </td>

                      {/* How Much Will Return / Refund Amount (₹) */}
                      <td className="p-3 border-r border-border font-bold text-foreground">
                        {b.refundAmount > 0 ? (
                          <span className="text-teal-600 dark:text-teal-400">
                            {formatAmount(b.refundAmount)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Refund Status */}
                      <td className="p-3 border-r border-border font-medium">
                        {b.refundStatus}
                      </td>

                      {/* Actual Return Date */}
                      <td className="p-3 border-r border-border text-foreground">
                        {formatDate(b.actualRefundDate)}
                      </td>

                      {/* Refund Ref / UTR */}
                      <td className="p-3 border-r border-border font-mono text-xs">
                        <span className="truncate">{b.refundRef}</span>
                        {b.refundRef !== '—' && <CopyButton text={b.refundRef} label="Copy Refund UTR" />}
                        {b.refundReceiptUrl && (
                          <button
                            type="button"
                            onClick={() => setReceiptModal({ open: true, url: b.refundReceiptUrl, title: `Refund Receipt: ${b.title}` })}
                            className="ml-1 text-[10px] text-teal-600 hover:underline inline-flex items-center gap-0.5"
                          >
                            <Receipt className="size-3" /> Proof
                          </button>
                        )}
                      </td>

                      {/* Bank Name */}
                      <td className="p-3 border-r border-border text-foreground max-w-xs truncate">
                        <span title={b.bankName}>{b.bankName}</span>
                      </td>

                      {/* Account Number */}
                      <td className="p-3 border-r border-border font-mono text-xs">
                        <span>{b.accountNumber}</span>
                        {b.accountNumber !== '—' && <CopyButton text={b.accountNumber} label="Copy Account" />}
                      </td>

                      {/* IFSC Code */}
                      <td className="p-3 border-r border-border font-mono text-xs">
                        <span>{b.ifscCode}</span>
                        {b.ifscCode !== '—' && <CopyButton text={b.ifscCode} label="Copy IFSC" />}
                      </td>

                      {/* Beneficiary */}
                      <td className="p-3 border-r border-border text-foreground max-w-xs truncate">
                        <span title={b.beneficiary}>{b.beneficiary}</span>
                      </td>

                      {/* Stage */}
                      <td className="p-3 border-r border-border">
                        <StageBadge stage={b.workflow_stage} />
                      </td>

                      {/* Result */}
                      <td className="p-3 border-r border-border font-medium">
                        {b.bid_status || b.bid_outcome || '—'}
                      </td>

                      {/* Remarks */}
                      <td className="p-3 border-r border-border text-muted-foreground max-w-xs truncate">
                        <span title={b.remarks}>{b.remarks}</span>
                      </td>

                      {/* Action */}
                      <td className="p-2 text-center sticky right-0 z-10 bg-card">
                        {canManage ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDialog(b, 'basic')}
                            className="h-7 px-2.5 text-xs font-semibold gap-1 text-primary border-primary/30 hover:bg-primary/5"
                            title="Manage & Edit EMD Details"
                          >
                            <Pencil className="size-3" />
                            <span>Manage</span>
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDialog(b, 'basic')}
                            className="h-7 px-2.5 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground"
                            title="View EMD Lifecycle Details (Read-Only)"
                          >
                            <Eye className="size-3" />
                            <span>View</span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  </React.Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Table Footer & Pagination Controls ────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground pt-1">
        <div className="flex items-center gap-2">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setCurrentPage(1)
            }}
            className="h-7 rounded border border-input bg-background px-2 py-0.5 text-xs shadow-xs"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
          </select>
          <span>entries per page · Showing {filteredBids.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filteredBids.length)} of {filteredBids.length} tenders</span>
        </div>

        <div className="flex items-center gap-1 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="h-7 px-2 text-xs"
          >
            <ChevronLeft className="size-3.5 mr-0.5" /> Previous
          </Button>
          <span className="px-2 font-medium text-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="h-7 px-2 text-xs"
          >
            Next <ChevronRight className="size-3.5 ml-0.5" />
          </Button>
        </div>
      </div>

      {/* ── Dialogs ───────────────────────────────────────────────────────── */}
      {/* 1. EmdDetailsDialog */}
      {activeDialogBid && (
        <EmdDetailsDialog
          open={Boolean(activeDialogBid)}
          onClose={() => setActiveDialogBid(null)}
          bid={activeDialogBid}
          onSuccess={handleDialogSuccess}
          initialSection={dialogSection}
        />
      )}

      {/* 2. ReceiptPreviewModal */}
      {receiptModal.open && (
        <ReceiptPreviewModal
          open={receiptModal.open}
          onClose={() => setReceiptModal({ open: false, url: '', title: '' })}
          url={receiptModal.url}
          title={receiptModal.title}
        />
      )}

      {/* 3. ExportSuccessDialog */}
      {exportResult && (
        <ExportSuccessDialog
          result={exportResult}
          onClose={() => setExportResult(null)}
        />
      )}
    </div>
  )
}

export default EmdDetailsPage
