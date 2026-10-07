import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign, CheckCircle2, Clock, XCircle, FileText, User,
  ArrowRight, ShieldCheck, History, Edit2, Plus, RefreshCw,
  AlertCircle, AlertTriangle, ExternalLink, HelpCircle,
  Eye, Download, CreditCard, Receipt, FileCheck, Phone, Mail,
  X, Building2, Tag, Calendar, Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  getEmdDetails, submitEmdForMdApproval, EMD_STATUS_CONFIG, REFUND_STATUS_CONFIG
} from '../../services/emd'
import { usePermissions } from '../../hooks/usePermissions'
import { EmdDetailsDialog } from './EmdDetailsDialog'
import { EmdApprovalDialog } from './EmdApprovalDialog'
import { EmdAuditDialog } from './EmdAuditDialog'

function fmtDate(dt) {
  if (!dt) return '—'
  const d = new Date(dt)
  if (isNaN(d.getTime()) || d.getFullYear() <= 1970) return '—'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtMoney(v) {
  if (!v && v !== 0) return '—'
  return `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

// ── Interactive In-App Receipt / Proof Viewer Modal ─────────────────────────
function ReceiptPreviewModal({ open, onClose, url, title }) {
  const [blobUrl, setBlobUrl] = useState('')
  const [loadingDoc, setLoadingDoc] = useState(true)
  const [docError, setDocError] = useState(false)

  const isPdf = Boolean(url && (url.toLowerCase().includes('.pdf') || url.toLowerCase().endsWith('.pdf')))

  useEffect(() => {
    if (!open || !url) {
      setBlobUrl('')
      setLoadingDoc(false)
      setDocError(false)
      return
    }

    let active = true
    setLoadingDoc(true)
    setDocError(false)

    const token = localStorage.getItem('onetrack_access_token') || ''
    const headers = token ? { Authorization: `Bearer ${token}` } : {}

    fetch(url, { headers })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        return res.blob()
      })
      .then((blob) => {
        if (active) {
          const objUrl = URL.createObjectURL(blob)
          setBlobUrl(objUrl)
          setLoadingDoc(false)
        }
      })
      .catch((err) => {
        console.error('Failed to load receipt:', err)
        if (active) {
          setDocError(true)
          setLoadingDoc(false)
        }
      })

    return () => {
      active = false
    }
  }, [open, url])

  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
      }
    }
  }, [blobUrl])

  if (!open || !url) return null

  const token = localStorage.getItem('onetrack_access_token') || ''
  const directUrlWithToken = token ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : url

  const handleDownload = () => {
    const downloadTarget = blobUrl || directUrlWithToken
    const a = document.createElement('a')
    a.href = downloadTarget
    const ext = url.split('.').pop()?.split('?')[0] || (isPdf ? 'pdf' : 'png')
    a.download = `emd_receipt_${Date.now()}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleOpenNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank')
    } else {
      window.open(directUrlWithToken, '_blank')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-4xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FileCheck className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">{title || 'Receipt Document Preview'}</h3>
              <p className="text-[11px] text-muted-foreground truncate max-w-md">{url}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenNewTab}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <ExternalLink className="size-3.5" /> Open in New Tab
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
            >
              <Download className="size-3.5" /> Download
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Close Preview"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-muted/10 min-h-[420px]">
          {loadingDoc ? (
            <div className="flex flex-col items-center justify-center gap-2.5 text-muted-foreground py-20">
              <Loader2 className="size-8 animate-spin text-primary" />
              <span className="text-xs font-medium">Loading receipt document...</span>
            </div>
          ) : docError ? (
            <div className="flex flex-col items-center justify-center gap-3 text-destructive py-20 max-w-md text-center">
              <div className="size-12 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center">
                <AlertCircle className="size-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Could not load document preview</p>
                <p className="text-xs text-muted-foreground mt-1">
                  The file might be temporarily unreachable or permissions need to be refreshed.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
                >
                  Download Directly
                </button>
                <button
                  type="button"
                  onClick={handleOpenNewTab}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted"
                >
                  Open in New Tab
                </button>
              </div>
            </div>
          ) : isPdf ? (
            <iframe
              src={blobUrl || directUrlWithToken}
              title={title}
              className="w-full h-[72vh] rounded-lg border border-border bg-white"
            />
          ) : (
            <img
              src={blobUrl || directUrlWithToken}
              alt={title}
              className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg border border-border shadow-sm bg-background"
            />
          )}
        </div>
      </motion.div>
    </div>
  )
}

export function EmdLifecycleCard({ bid, onRefresh }) {
  const { hasRole, isAdmin } = usePermissions()
  const isFinance = hasRole('FINANCE')
  const canEdit = isFinance || isAdmin

  const [emd, setEmd] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [approvalMode, setApprovalMode] = useState('approve')
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [submittingApproval, setSubmittingApproval] = useState(false)

  // Receipt Preview State
  const [previewProof, setPreviewProof] = useState({ open: false, url: '', title: '' })

  const loadEmd = useCallback(async () => {
    if (!bid?.id) return
    setLoading(true)
    try {
      const res = await getEmdDetails(bid.id)
      if (res.ok) {
        setEmd(res.data)
      }
    } catch {
      // quiet fail on initial fetch
    } finally {
      setLoading(false)
    }
  }, [bid?.id])

  useEffect(() => {
    loadEmd()
  }, [loadEmd, bid?.updated_at])

  // Safely parse mode-specific payment details (JSONB)
  const paymentDetails = useMemo(() => {
    if (!emd?.payment_details) return {}
    if (typeof emd.payment_details === 'string') {
      try {
        return JSON.parse(emd.payment_details)
      } catch {
        return {}
      }
    }
    return emd.payment_details || {}
  }, [emd?.payment_details])

  // Payment receipt document URL (from direct column or nested details)
  const effectiveReceiptUrl = emd?.payment_receipt_url || paymentDetails.receipt_url || ''

  // Is MD Approval button enabled?
  const isRequiredInfoComplete = Boolean(
    emd &&
    emd.emd_amount > 0 &&
    emd.due_date &&
    emd.reference_number?.trim() &&
    emd.purpose?.trim()
  )

  const isPendingMDApproval = emd?.status === 'Pending MD Approval'
  const isMDApproved = emd?.is_md_approved || emd?.status === 'Approved' || emd?.status === 'MD Approved' || emd?.status === 'Paid' || emd?.status === 'Verified' || emd?.status === 'Released' || emd?.status === 'Refunded' || emd?.is_paid
  const canSubmitForApproval = canEdit && isRequiredInfoComplete && !isPendingMDApproval && !isMDApproved

  const handleSubmitForApproval = async () => {
    if (!isRequiredInfoComplete) {
      toast.error('Please complete all required EMD fields (Amount, Due Date, Reference Number, Purpose) before submitting for MD Approval.')
      setShowDetailsModal(true)
      return
    }

    setSubmittingApproval(true)
    try {
      const res = await submitEmdForMdApproval(bid.id, emd?.remarks || '')
      if (res.ok) {
        toast.success('EMD submitted for MD Approval! Managing Director has been alerted.')
        loadEmd()
        onRefresh?.()
      } else {
        toast.error(res.message || 'Failed to submit for MD Approval')
      }
    } catch {
      toast.error('Network error during MD submission')
    } finally {
      setSubmittingApproval(false)
    }
  }

  const handleOpenApprovalDialog = (mode) => {
    setApprovalMode(mode)
    setShowApprovalModal(true)
  }

  const handleViewProof = (url, title) => {
    if (!url) return
    setPreviewProof({ open: true, url, title })
  }

  const paymentModeName = emd?.payment_mode || bid?.emd_type || 'Online'

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header Banner */}
      <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <DollarSign className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground font-heading">
                EMD DETAILS
              </h3>
              {emd?.status && (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${EMD_STATUS_CONFIG[emd.status]?.color || 'bg-muted'}`}>
                  <span className={`size-1.5 rounded-full ${EMD_STATUS_CONFIG[emd.status]?.dot || 'bg-gray-400'}`} />
                  {EMD_STATUS_CONFIG[emd.status]?.label || emd.status}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Earnest Money Deposit verification, executive approval, payment and refund monitoring
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAuditModal(true)}
            className="text-xs gap-1.5 text-muted-foreground hover:text-foreground h-8"
          >
            <History className="size-3.5" />
            Audit History
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadEmd}
            disabled={loading}
            title="Refresh EMD Data"
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Main Grid: Card content mirroring Section 15 of CR */}
      <div className="p-5 sm:p-6 space-y-6">
        {/* Section 1: EMD & Payment Facts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-xs">
          <div className="flex justify-between items-center py-1.5 border-b border-border/50">
            <span className="text-muted-foreground">EMD Amount</span>
            <span className="font-bold text-foreground font-mono text-sm">
              {fmtMoney(emd?.emd_amount ?? bid?.emd_amount)}
            </span>
          </div>

          <div className="flex justify-between items-center py-1.5 border-b border-border/50">
            <span className="text-muted-foreground">Payment Status</span>
            <span className="font-semibold text-foreground">
              {emd?.payment_status || (emd?.is_paid ? 'Paid' : 'Unpaid')}
            </span>
          </div>

          <div className="flex justify-between items-center py-1.5 border-b border-border/50">
            <span className="text-muted-foreground">EMD Status</span>
            <span className="font-semibold text-foreground">
              {emd?.status || 'Pending'}
            </span>
          </div>

          <div className="flex justify-between items-center py-1.5 border-b border-border/50">
            <span className="text-muted-foreground">Payment Mode</span>
            <span className="font-medium text-foreground">
              {emd?.payment_mode || (bid?.emd_type || 'Online')}
            </span>
          </div>

          <div className="flex justify-between items-center py-1.5 border-b border-border/50">
            <span className="text-muted-foreground">Due / Submission Date</span>
            <span className="font-medium text-foreground">
              {fmtDate(emd?.due_date ?? bid?.closing_date)}
            </span>
          </div>

          <div className="flex justify-between items-center py-1.5 border-b border-border/50">
            <span className="text-muted-foreground">Payment Reference</span>
            <span className="font-mono font-medium text-foreground">
              {emd?.payment_reference || '—'}
            </span>
          </div>

          <div className="flex justify-between items-center py-1.5 border-b border-border/50">
            <span className="text-muted-foreground">EMD Reference Number</span>
            <span className="font-mono font-medium text-foreground">
              {emd?.reference_number || bid?.gem_bid_no || bid?.bid_no || '—'}
            </span>
          </div>

          <div className="flex justify-between items-center py-1.5 border-b border-border/50">
            <span className="text-muted-foreground">Payment Date</span>
            <span className="font-medium text-foreground">
              {fmtDate(emd?.payment_date)}
            </span>
          </div>
        </div>

        {/* Section 2: Mode-Specific Payment Details (All Payment Mode Details) */}
        <div className="p-4 rounded-xl border border-blue-200/80 bg-blue-50/20 dark:bg-blue-950/10 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
              <CreditCard className="size-3.5 text-blue-600 dark:text-blue-400" />
              {paymentModeName} Payment Details
            </h4>
            <Badge variant="outline" className="text-[10px] font-semibold bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
              Mode: {paymentModeName}
            </Badge>
          </div>

          {/* If Mode is Cheque */}
          {(paymentModeName.toLowerCase() === 'cheque' || (bid?.emd_type || '').toLowerCase() === 'dd') && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Bank Name:</span>
                <span className="font-semibold text-foreground">
                  {paymentDetails.bank_name || bid?.emd_bank_name || '—'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Cheque / DD Number:</span>
                <span className="font-mono font-semibold text-foreground">
                  {paymentDetails.cheque_number || emd?.payment_reference || '—'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Cheque Date:</span>
                <span className="font-medium text-foreground">
                  {fmtDate(paymentDetails.cheque_date)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Submission Date:</span>
                <span className="font-medium text-foreground">
                  {fmtDate(paymentDetails.submission_date || emd?.payment_date)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Branch Name:</span>
                <span className="font-medium text-foreground">
                  {paymentDetails.branch_name || bid?.emd_branch || '—'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Account Holder Name:</span>
                <span className="font-medium text-foreground">
                  {paymentDetails.account_holder_name || bid?.emd_beneficiary || '—'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Cheque Status:</span>
                <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                  {paymentDetails.cheque_status || emd?.payment_status || 'Submitted'}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Cheque Amount:</span>
                <span className="font-mono font-bold text-foreground">
                  {fmtMoney(paymentDetails.amount || emd?.payment_amount || emd?.emd_amount)}
                </span>
              </div>
            </div>
          )}

          {/* If Mode is Online */}
          {paymentModeName.toLowerCase() === 'online' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Bank Name:</span>
                <span className="font-semibold text-foreground">
                  {paymentDetails.bank_name || bid?.emd_bank_name || '—'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Transaction ID / UTR:</span>
                <span className="font-mono font-semibold text-foreground">
                  {paymentDetails.transaction_id || emd?.payment_reference || '—'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Payment Gateway:</span>
                <span className="font-medium text-foreground">
                  {paymentDetails.payment_gateway || '—'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Transaction Date/Time:</span>
                <span className="font-medium text-foreground">
                  {paymentDetails.transaction_datetime ? fmtDate(paymentDetails.transaction_datetime) : fmtDate(emd?.payment_date)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Account Number:</span>
                <span className="font-mono font-medium text-foreground">
                  {paymentDetails.account_number || bid?.emd_account_number || '—'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">IFSC Code:</span>
                <span className="font-mono font-medium text-foreground">
                  {paymentDetails.ifsc_code || bid?.emd_ifsc_code || '—'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Payment Status:</span>
                <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                  {paymentDetails.payment_status || emd?.payment_status || 'Successful'}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Paid Amount:</span>
                <span className="font-mono font-bold text-foreground">
                  {fmtMoney(paymentDetails.payment_amount || emd?.payment_amount || emd?.emd_amount)}
                </span>
              </div>
            </div>
          )}

          {/* If Mode is Challan */}
          {paymentModeName.toLowerCase() === 'challan' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Bank Name:</span>
                <span className="font-semibold text-foreground">
                  {paymentDetails.bank_name || '—'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Challan Number:</span>
                <span className="font-mono font-semibold text-foreground">
                  {paymentDetails.challan_number || emd?.payment_reference || '—'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Challan Date:</span>
                <span className="font-medium text-foreground">
                  {fmtDate(paymentDetails.challan_date || emd?.payment_date)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Branch Name:</span>
                <span className="font-medium text-foreground">
                  {paymentDetails.branch_name || '—'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Challan Type / Purpose:</span>
                <span className="font-medium text-foreground">
                  {paymentDetails.challan_type || '—'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Challan Status:</span>
                <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                  {paymentDetails.challan_status || emd?.payment_status || 'Submitted'}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Challan Amount:</span>
                <span className="font-mono font-bold text-foreground">
                  {fmtMoney(paymentDetails.amount || emd?.payment_amount || emd?.emd_amount)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Payment Reference:</span>
                <span className="font-mono font-medium text-foreground">
                  {emd?.payment_reference || '—'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Uploaded Proof & Receipt Documents */}
        <div className="p-4 rounded-xl border border-emerald-200/80 bg-emerald-50/20 dark:bg-emerald-950/10 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
              <FileCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              Uploaded Proof &amp; Receipt Documents
            </h4>
            <span className="text-[10px] text-muted-foreground">Scanned Verification Evidence</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Payment Proof Card */}
            <div className="p-3 rounded-lg border border-border bg-card flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0">
                  <span className="font-semibold text-foreground text-xs block truncate">
                    EMD Payment Proof / Receipt
                  </span>
                  <span className="text-[10px] text-muted-foreground block truncate">
                    {effectiveReceiptUrl ? 'Document attached & verified' : 'No document uploaded yet'}
                  </span>
                </div>
              </div>

              {effectiveReceiptUrl ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewProof(effectiveReceiptUrl, 'EMD Payment Receipt')}
                    className="h-7 px-2.5 text-[11px] gap-1 text-primary hover:bg-primary/5 font-medium"
                  >
                    <Eye className="size-3" /> View Proof
                  </Button>
                  <a
                    href={effectiveReceiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="inline-flex items-center justify-center size-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Download receipt"
                  >
                    <Download className="size-3" />
                  </a>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowDetailsModal(true)}
                  className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Upload Proof
                </Button>
              )}
            </div>

            {/* Refund Proof Card */}
            <div className="p-3 rounded-lg border border-border bg-card flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-9 rounded-lg bg-teal-100 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
                  <Receipt className="size-4" />
                </div>
                <div className="min-w-0">
                  <span className="font-semibold text-foreground text-xs block truncate">
                    Refund Advice / Proof
                  </span>
                  <span className="text-[10px] text-muted-foreground block truncate">
                    {emd?.refund_receipt_url ? 'Refund advice uploaded' : 'Pending release/refund'}
                  </span>
                </div>
              </div>

              {emd?.refund_receipt_url ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewProof(emd.refund_receipt_url, 'Refund Advice / Proof')}
                    className="h-7 px-2.5 text-[11px] gap-1 text-teal-700 hover:bg-teal-50 font-medium"
                  >
                    <Eye className="size-3" /> View Proof
                  </Button>
                  <a
                    href={emd.refund_receipt_url}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="inline-flex items-center justify-center size-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Download refund proof"
                  >
                    <Download className="size-3" />
                  </a>
                </div>
              ) : (
                <span className="text-[11px] text-muted-foreground pr-2 italic">
                  {emd?.refund_status === 'Refunded' ? 'Not uploaded' : '—'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Section 4: Depositor Details (All Depositor / Person Details) */}
        <div className="p-4 rounded-xl border border-purple-200/80 bg-purple-50/20 dark:bg-purple-950/10 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
              <User className="size-3.5 text-purple-600 dark:text-purple-400" /> Depositor / Person Details
            </h4>
            <span className="text-[10px] text-muted-foreground">Authorized Depositor Information</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">Deposited By:</span>
              <span className="font-semibold text-foreground">
                {emd?.depositor_name || '—'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Employee ID:</span>
              <span className="font-mono font-medium text-foreground">
                {emd?.depositor_employee_id || '—'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Department:</span>
              <span className="font-medium text-foreground">
                {emd?.depositor_department || '—'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Designation:</span>
              <span className="font-medium text-foreground">
                {emd?.depositor_designation || '—'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Contact Number:</span>
              <span className="font-mono font-medium text-foreground flex items-center gap-1">
                {emd?.depositor_contact ? (
                  <>
                    <Phone className="size-3 text-muted-foreground" />
                    {emd.depositor_contact}
                  </>
                ) : '—'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Email ID:</span>
              <span className="font-medium text-foreground truncate block" title={emd?.depositor_email}>
                {emd?.depositor_email ? (
                  <span className="flex items-center gap-1">
                    <Mail className="size-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{emd.depositor_email}</span>
                  </span>
                ) : '—'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Deposit Date:</span>
              <span className="font-medium text-foreground">
                {fmtDate(emd?.deposit_date)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Depositor Remarks:</span>
              <span className="font-medium text-foreground italic truncate block" title={emd?.depositor_remarks}>
                {emd?.depositor_remarks || 'None'}
              </span>
            </div>
          </div>
        </div>

        {/* Section 5: Refund Tracking */}
        <div className="p-4 rounded-xl border border-teal-200/80 bg-teal-50/20 dark:bg-teal-950/10 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-teal-900 dark:text-teal-300 flex items-center gap-1.5">
              <ArrowRight className="size-3.5 text-teal-600" /> EMD Release &amp; Refund Status
            </h4>
            <span className="text-[10px] text-muted-foreground">Post-Bid Closure Tracking</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">Refund Status:</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border mt-0.5 ${REFUND_STATUS_CONFIG[emd?.refund_status]?.color || 'bg-muted'}`}>
                {emd?.refund_status || 'Pending'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Expected Refund Date:</span>
              <span className="font-medium text-foreground">
                {fmtDate(emd?.expected_refund_date)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Actual Refund Date:</span>
              <span className="font-medium text-foreground">
                {fmtDate(emd?.actual_refund_date)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Refund Mode:</span>
              <span className="font-medium text-foreground">
                {emd?.refund_mode || '—'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Refund Reference / UTR:</span>
              <span className="font-mono font-medium text-foreground">
                {emd?.refund_reference_no || emd?.refund_transaction_id || '—'}
              </span>
            </div>
            <div className="sm:col-span-3">
              <span className="text-muted-foreground block text-[11px]">Refund Remarks:</span>
              <span className="font-medium text-foreground italic">
                {emd?.refund_remarks || '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Alerts based on State */}
        {isPendingMDApproval && (
          <div className="p-3.5 rounded-xl bg-orange-50/70 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 text-xs text-orange-900 dark:text-orange-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="size-4 shrink-0 text-orange-600 animate-pulse" />
              <span>
                <strong>Awaiting MD Approval:</strong> Submitted by {emd?.md_submitted_by?.full_name || 'Finance'}. Payment details will unlock once signed off.
              </span>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={() => handleOpenApprovalDialog('approve')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7"
                >
                  <CheckCircle2 className="size-3.5 mr-1" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenApprovalDialog('reject')}
                  className="border-rose-300 text-rose-700 hover:bg-rose-50 text-xs h-7"
                >
                  <XCircle className="size-3.5 mr-1" /> Reject
                </Button>
              </div>
            )}
          </div>
        )}

        {emd?.status === 'Rejected' && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-xs text-rose-900 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-rose-600" />
            <div>
              <span className="font-bold">Rejected by MD:</span> "{emd?.md_decision_remarks || 'Discrepancy found'}"
              <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-0.5">
                Returned to Finance for correction. Click "Edit EMD Details" below to resolve and re-submit.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="p-4 sm:p-5 border-t border-border bg-muted/10 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {/* Button 1: MD Approval */}
          {canEdit && (
            <span
              title={
                !isRequiredInfoComplete
                  ? 'Complete required EMD amount, due date, reference number and purpose to enable MD Approval'
                  : isMDApproved
                  ? 'EMD is already MD Approved'
                  : isPendingMDApproval
                  ? 'Already submitted for MD Approval'
                  : 'Submit verified EMD details for executive sign-off'
              }
            >
              <Button
                size="sm"
                variant="outline"
                disabled={!canSubmitForApproval || submittingApproval}
                onClick={handleSubmitForApproval}
                className="gap-1.5 border-orange-300 text-orange-900 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/40 text-xs font-semibold disabled:opacity-50"
              >
                <Clock className="size-3.5 text-orange-600" />
                {isMDApproved ? 'MD Approved ✓' : isPendingMDApproval ? 'Pending MD Approval' : 'MD Approval'}
              </Button>
            </span>
          )}

          {/* Button 2: Add EMD Details / Edit EMD Details */}
          <Button
            size="sm"
            onClick={() => setShowDetailsModal(true)}
            className="gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {canEdit ? (emd?.emd_amount ? <Edit2 className="size-3.5" /> : <Plus className="size-3.5" />) : <FileText className="size-3.5" />}
            {canEdit ? (emd?.emd_amount ? 'Edit EMD Details' : 'Add EMD Details') : 'View EMD Details'}
          </Button>

          {/* Quick View Proof shortcut in footer if receipt exists */}
          {effectiveReceiptUrl && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleViewProof(effectiveReceiptUrl, 'EMD Payment Receipt')}
              className="gap-1.5 text-xs font-medium border-emerald-300 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            >
              <Eye className="size-3.5 text-emerald-600" /> View Receipt Proof
            </Button>
          )}
        </div>

        {/* Status Tag on the right */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {emd?.verified_at && (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="size-3.5" /> Verified by Finance
            </span>
          )}
          {emd?.actual_refund_date && (
            <span className="flex items-center gap-1 text-teal-600 dark:text-teal-400 font-medium">
              <ArrowRight className="size-3.5" /> Refund Completed
            </span>
          )}
        </div>
      </div>

      {/* Interactive Lightbox / Modal for Viewing Uploaded Proof Documents */}
      <ReceiptPreviewModal
        open={previewProof.open}
        onClose={() => setPreviewProof({ open: false, url: '', title: '' })}
        url={previewProof.url}
        title={previewProof.title}
      />

      {/* EMD Details Dialog (Finance Modal) */}
      <EmdDetailsDialog
        open={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        bid={bid}
        onSuccess={() => {
          loadEmd()
          onRefresh?.()
        }}
      />

      {/* MD Executive Approval Dialog */}
      <EmdApprovalDialog
        open={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        bid={bid}
        emd={emd}
        mode={approvalMode}
        onSuccess={() => {
          loadEmd()
          onRefresh?.()
        }}
      />

      {/* EMD Audit Trail Modal */}
      <EmdAuditDialog
        open={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        bidId={bid?.id}
        bidTitle={bid?.title}
      />
    </div>
  )
}
