import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign, CheckCircle2, Clock, XCircle, FileText, User,
  ArrowRight, ShieldCheck, History, Edit2, Plus, RefreshCw,
  AlertCircle, ExternalLink,
  Eye, Download, CreditCard, Receipt, FileCheck, Phone, Mail,
  X, Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  getEmdDetails, submitEmdForMdApproval, fetchReceiptBlob, safeReceiptUrl, EMD_STATUS_CONFIG, REFUND_STATUS_CONFIG, fmtMoney
} from '../../services/emd'
import { formatDate as fmtDate } from '../../lib/tenderFormat'
import { usePermissions } from '../../hooks/usePermissions'
import { EmdDetailsDialog } from './EmdDetailsDialog'
import { EmdApprovalDialog } from './EmdApprovalDialog'
import { EmdAuditDialog } from './EmdAuditDialog'

// ── Interactive In-App Receipt / Proof Viewer Modal ─────────────────────────
function ReceiptPreviewModal({ open, onClose, url, title }) {
  const [blobUrl, setBlobUrl] = useState('')
  const [loadingDoc, setLoadingDoc] = useState(true)
  const [docError, setDocError] = useState(false)

  const isPdf = Boolean(url?.toLowerCase().endsWith('.pdf'))

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

    fetchReceiptBlob(url)
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

  const handleDownload = () => {
    if (!blobUrl) return
    const a = document.createElement('a')
    a.href = blobUrl
    const ext = url.split('.').pop()?.split('?')[0] || (isPdf ? 'pdf' : 'png')
    a.download = `emd_receipt_${Date.now()}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleOpenNewTab = () => {
    if (blobUrl) window.open(blobUrl, '_blank')
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
              disabled={!blobUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ExternalLink className="size-3.5" /> Open in New Tab
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!blobUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
            </div>
          ) : isPdf ? (
            <iframe
              src={blobUrl}
              title={title}
              className="w-full h-[72vh] rounded-lg border border-border bg-white"
            />
          ) : (
            <img
              src={blobUrl}
              alt={title}
              className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg border border-border shadow-sm bg-background"
            />
          )}
        </div>
      </motion.div>
    </div>
  )
}

// Mode-specific payment details arrive as JSON (an object, or a string).
function parsePaymentDetails(raw) {
  if (typeof raw !== 'string') return raw || {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

// Small presentational helpers: value classes, a labelled info cell, and the
// bordered section / proof-card shells used by the card below.
const V = {
  sb: 'font-semibold text-foreground',
  md: 'font-medium text-foreground',
  mono: 'font-mono font-semibold text-foreground',
  monoMd: 'font-mono font-medium text-foreground',
  monoB: 'font-mono font-bold text-foreground',
}
const BADGE = 'badge'

function Info({ label, value, cls, extra }) {
  const { wrap, ...rest } = extra || {}
  return (
    <div className={wrap}>
      <span className="text-muted-foreground block text-[11px]">{`${label}:`}</span>
      {cls === BADGE ? (
        <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
          {value}
        </Badge>
      ) : (
        <span className={cls} {...rest}>{value}</span>
      )}
    </div>
  )
}

// rows: [label, value, value class (or BADGE), optional { wrap, ...spanProps }]
function InfoGrid({ rows, gap = 'gap-3' }) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-4 ${gap} text-xs`}>
      {rows.map(([label, value, cls, extra]) => (
        <Info key={label} label={label} value={value} cls={cls} extra={extra} />
      ))}
    </div>
  )
}

function Section({ box, h, title, right, children }) {
  return (
    <div className={`p-4 rounded-xl border ${box} space-y-3`}>
      <div className="flex items-center justify-between">
        <h4 className={`text-[11px] font-bold uppercase tracking-wider ${h} flex items-center gap-1.5`}>{title}</h4>
        {right}
      </div>
      {children}
    </div>
  )
}

function ProofCard({ iconBox, icon, title, sub, action }) {
  return (
    <div className="p-3 rounded-lg border border-border bg-card flex items-center justify-between gap-3 shadow-2xs">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`size-9 rounded-lg ${iconBox} flex items-center justify-center shrink-0`}>{icon}</div>
        <div className="min-w-0">
          <span className="font-semibold text-foreground text-xs block truncate">{title}</span>
          <span className="text-[10px] text-muted-foreground block truncate">{sub}</span>
        </div>
      </div>
      {action}
    </div>
  )
}

export function EmdLifecycleCard({ bid, onRefresh }) {
  const { hasRole, user } = usePermissions()
  const isFinance = hasRole('FINANCE')
  const isMD = hasRole('ADMIN') || hasRole('SUPER_ADMIN')
  const canEdit = isFinance || isMD
  const notRequired = Boolean(bid?.emd_exempted || bid?.emd_not_applicable)

  const [emd, setEmd] = useState(null)
  const [loading, setLoading] = useState(!notRequired)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [approvalMode, setApprovalMode] = useState('approve')
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [submittingApproval, setSubmittingApproval] = useState(false)

  // Receipt Preview State
  const [previewProof, setPreviewProof] = useState({ open: false, url: '', title: '' })

  const bidId = bid?.id
  const loadEmd = useCallback(async () => {
    if (!bidId || notRequired) return
    setLoading(true)
    try {
      const res = await getEmdDetails(bidId)
      if (res.ok) {
        setEmd(res.data)
      } else {
        toast.error(res.message || 'Could not load EMD details')
      }
    } catch {
      toast.error('Network error while loading EMD details')
    } finally {
      setLoading(false)
    }
  }, [bidId, notRequired])

  useEffect(() => {
    loadEmd()
  }, [loadEmd, bid?.updated_at])

  const paymentDetails = parsePaymentDetails(emd?.payment_details)

  // Receipt links are shown only if they are the exact shape the server issues.
  const paymentReceiptUrl = safeReceiptUrl(bid?.id, emd?.payment_receipt_url || paymentDetails.receipt_url)
  const refundReceiptUrl = safeReceiptUrl(bid?.id, emd?.refund_receipt_url)

  // Is MD Approval button enabled?
  const isRequiredInfoComplete = Boolean(
    emd &&
    emd.emd_amount > 0 &&
    emd.due_date &&
    emd.reference_number?.trim() &&
    emd.purpose?.trim()
  )

  const isPendingMDApproval = emd?.status === 'Pending MD Approval'
  const isRejected = emd?.status === 'Rejected'
  const isMDApproved = Boolean(emd?.is_md_approved)
  const canSubmitForApproval = canEdit && isRequiredInfoComplete && (emd?.status === 'Pending' || isRejected)
  // The approver must be someone other than whoever submitted (unless SUPER_ADMIN override).
  const submittedBySelf = Boolean(user?.id && emd?.md_submitted_by?.id === user.id && !hasRole('SUPER_ADMIN'))

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

  // [show?, rows] per payment mode, in render order (not mutually exclusive).
  const pd = paymentDetails
  const modeBlocks = [
    [paymentModeName.toLowerCase() === 'cheque' || (bid?.emd_type || '').toLowerCase() === 'dd', [
      ['Bank Name', pd.bank_name || bid?.emd_bank_name || '—', V.sb],
      ['Cheque / DD Number', pd.cheque_number || emd?.payment_reference || '—', V.mono],
      ['Cheque Date', fmtDate(pd.cheque_date), V.md],
      ['Submission Date', fmtDate(pd.submission_date || emd?.payment_date), V.md],
      ['Branch Name', pd.branch_name || bid?.emd_branch || '—', V.md],
      ['Account Holder Name', pd.account_holder_name || bid?.emd_beneficiary || '—', V.md],
      ['Cheque Status', pd.cheque_status || emd?.payment_status || 'Submitted', BADGE],
      ['Cheque Amount', fmtMoney(pd.amount || emd?.payment_amount || emd?.emd_amount), V.monoB],
    ]],
    [paymentModeName.toLowerCase() === 'online', [
      ['Bank Name', pd.bank_name || bid?.emd_bank_name || '—', V.sb],
      ['Transaction ID / UTR', pd.transaction_id || emd?.payment_reference || '—', V.mono],
      ['Payment Gateway', pd.payment_gateway || '—', V.md],
      ['Transaction Date/Time', pd.transaction_datetime ? fmtDate(pd.transaction_datetime) : fmtDate(emd?.payment_date), V.md],
      ['Account Number', pd.account_number || bid?.emd_account_number || '—', V.monoMd],
      ['IFSC Code', pd.ifsc_code || bid?.emd_ifsc_code || '—', V.monoMd],
      ['Payment Status', pd.payment_status || emd?.payment_status || 'Successful', BADGE],
      ['Paid Amount', fmtMoney(pd.payment_amount || emd?.payment_amount || emd?.emd_amount), V.monoB],
    ]],
    [paymentModeName.toLowerCase() === 'challan', [
      ['Bank Name', pd.bank_name || '—', V.sb],
      ['Challan Number', pd.challan_number || emd?.payment_reference || '—', V.mono],
      ['Challan Date', fmtDate(pd.challan_date || emd?.payment_date), V.md],
      ['Branch Name', pd.branch_name || '—', V.md],
      ['Challan Type / Purpose', pd.challan_type || '—', V.md],
      ['Challan Status', pd.challan_status || emd?.payment_status || 'Submitted', BADGE],
      ['Challan Amount', fmtMoney(pd.amount || emd?.payment_amount || emd?.emd_amount), V.monoB],
      ['Payment Reference', emd?.payment_reference || '—', V.monoMd],
    ]],
  ]

  if (notRequired) {
    return (
      <div className="rounded-2xl border border-border bg-muted/20 px-5 py-4 flex items-center gap-2.5 text-xs">
        <ShieldCheck className="size-4 text-muted-foreground shrink-0" />
        <span className="font-semibold text-foreground">
          {bid.emd_exempted
            ? `EMD Exempted — ${fmtMoney(bid.emd_amount)} waived${bid.emd_exemption_type ? ` (${bid.emd_exemption_type}${bid.emd_exemption_reason ? `: ${bid.emd_exemption_reason}` : ''})` : ''}`
            : 'No EMD required for this tender'}
        </span>
      </div>
    )
  }

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
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAuditModal(true)}
              className="text-xs gap-1.5 text-muted-foreground hover:text-foreground h-8"
            >
              <History className="size-3.5" />
              Audit History
            </Button>
          )}

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
          {[
            // [label, value, value class, finance/admin only]
            ['EMD Amount', fmtMoney(emd?.emd_amount ?? bid?.emd_amount), 'font-bold text-foreground font-mono text-sm'],
            ['Payment Status', emd?.payment_status || (emd?.is_paid ? 'Paid' : 'Unpaid'), V.sb, true],
            ['EMD Status', emd?.status || 'Pending', V.sb],
            ['Payment Mode', emd?.payment_mode || (bid?.emd_type || 'Online'), V.md, true],
            ['Due / Submission Date', fmtDate(emd?.due_date ?? bid?.closing_date), V.md],
            ['Payment Reference', emd?.payment_reference || '—', V.monoMd, true],
            ['EMD Reference Number', emd?.reference_number || bid?.gem_bid_no || bid?.bid_no || '—', V.monoMd],
            ['Payment Date', fmtDate(emd?.payment_date), V.md, true],
          ].map(([label, value, cls, adminOnly]) => (!adminOnly || canEdit) && (
            <div key={label} className="flex justify-between items-center py-1.5 border-b border-border/50">
              <span className="text-muted-foreground">{label}</span>
              <span className={cls}>{value}</span>
            </div>
          ))}
        </div>

        {canEdit && (<>
        {/* Section 2: Mode-Specific Payment Details (All Payment Mode Details) */}
        <Section
          box="border-blue-200/80 bg-blue-50/20 dark:bg-blue-950/10"
          h="text-blue-900 dark:text-blue-300"
          title={<>
            <CreditCard className="size-3.5 text-blue-600 dark:text-blue-400" />
            {paymentModeName} Payment Details
          </>}
          right={
            <Badge variant="outline" className="text-[10px] font-semibold bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
              Mode: {paymentModeName}
            </Badge>
          }
        >
          {modeBlocks.map(([show, rows], i) => show && <InfoGrid key={i} rows={rows} />)}
        </Section>

        {/* Section 3: Uploaded Proof & Receipt Documents */}
        <Section
          box="border-emerald-200/80 bg-emerald-50/20 dark:bg-emerald-950/10"
          h="text-emerald-900 dark:text-emerald-300"
          title={<>
            <FileCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            Uploaded Proof &amp; Receipt Documents
          </>}
          right={<span className="text-[10px] text-muted-foreground">Scanned Verification Evidence</span>}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <ProofCard
              iconBox="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
              icon={<FileText className="size-4" />}
              title="EMD Payment Proof / Receipt"
              sub={paymentReceiptUrl ? 'Document attached' : 'No document uploaded yet'}
              action={paymentReceiptUrl ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleViewProof(paymentReceiptUrl, 'EMD Payment Receipt')}
                  className="h-7 px-2.5 text-[11px] gap-1 text-primary hover:bg-primary/5 font-medium shrink-0"
                >
                  <Eye className="size-3" /> View Proof
                </Button>
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
            />
            <ProofCard
              iconBox="bg-teal-100 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300"
              icon={<Receipt className="size-4" />}
              title="Refund Advice / Proof"
              sub={refundReceiptUrl ? 'Refund advice uploaded' : 'Pending release/refund'}
              action={refundReceiptUrl ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleViewProof(refundReceiptUrl, 'Refund Advice / Proof')}
                  className="h-7 px-2.5 text-[11px] gap-1 text-teal-700 hover:bg-teal-50 font-medium shrink-0"
                >
                  <Eye className="size-3" /> View Proof
                </Button>
              ) : (
                <span className="text-[11px] text-muted-foreground pr-2 italic">
                  {emd?.refund_status === 'Refunded' ? 'Not uploaded' : '—'}
                </span>
              )}
            />
          </div>
        </Section>

        {/* Section 4: Depositor Details (All Depositor / Person Details) */}
        <Section
          box="border-purple-200/80 bg-purple-50/20 dark:bg-purple-950/10"
          h="text-purple-900 dark:text-purple-300"
          title={<><User className="size-3.5 text-purple-600 dark:text-purple-400" /> Depositor / Person Details</>}
          right={<span className="text-[10px] text-muted-foreground">Authorized Depositor Information</span>}
        >
          <InfoGrid gap="gap-3.5" rows={[
            ['Deposited By', emd?.depositor_name || '—', V.sb],
            ['Employee ID', emd?.depositor_employee_id || '—', V.monoMd],
            ['Department', emd?.depositor_department || '—', V.md],
            ['Designation', emd?.depositor_designation || '—', V.md],
            ['Contact Number', emd?.depositor_contact ? (
              <>
                <Phone className="size-3 text-muted-foreground" />
                {emd.depositor_contact}
              </>
            ) : '—', `${V.monoMd} flex items-center gap-1`],
            ['Email ID', emd?.depositor_email ? (
              <span className="flex items-center gap-1">
                <Mail className="size-3 text-muted-foreground shrink-0" />
                <span className="truncate">{emd.depositor_email}</span>
              </span>
            ) : '—', `${V.md} truncate block`, { title: emd?.depositor_email }],
            ['Deposit Date', fmtDate(emd?.deposit_date), V.md],
            ['Depositor Remarks', emd?.depositor_remarks || 'None', `${V.md} italic truncate block`, { title: emd?.depositor_remarks }],
          ]} />
        </Section>

        {/* Section 5: Refund Tracking */}
        <Section
          box="border-teal-200/80 bg-teal-50/20 dark:bg-teal-950/10"
          h="text-teal-900 dark:text-teal-300"
          title={<><ArrowRight className="size-3.5 text-teal-600" /> EMD Release &amp; Refund Status</>}
          right={<span className="text-[10px] text-muted-foreground">Post-Bid Closure Tracking</span>}
        >
          <InfoGrid rows={[
            ['Refund Status', emd?.refund_status || 'Pending', `inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border mt-0.5 ${REFUND_STATUS_CONFIG[emd?.refund_status]?.color || 'bg-muted'}`],
            ['Expected Refund Date', fmtDate(emd?.expected_refund_date), V.md],
            ['Actual Refund Date', fmtDate(emd?.actual_refund_date), V.md],
            ['Refund Mode', emd?.refund_mode || '—', V.md],
            ['Refund Reference / UTR', emd?.refund_reference_no || emd?.refund_transaction_id || '—', V.monoMd],
            ['Refund Remarks', emd?.refund_remarks || '—', `${V.md} italic`, { wrap: 'sm:col-span-3' }],
          ]} />
        </Section>

        </>)}

        {/* Dynamic Alerts based on State */}
        {isPendingMDApproval && (
          <div className="p-3.5 rounded-xl bg-orange-50/70 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 text-xs text-orange-900 dark:text-orange-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="size-4 shrink-0 text-orange-600 animate-pulse" />
              <span>
                <strong>Awaiting MD Approval:</strong> Submitted by {emd?.md_submitted_by?.full_name || 'Finance'}. Payment details will unlock once signed off.
              </span>
            </div>
            {isMD && submittedBySelf && (
              <span className="text-[11px] italic shrink-0">You submitted this, so another administrator must decide.</span>
            )}
            {isMD && !submittedBySelf && (
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

        {isRejected && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-xs text-rose-900 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-rose-600" />
            <div>
              <span className="font-bold">Rejected by MD:</span> "{emd?.md_decision_remarks || 'Discrepancy found'}"
              <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-0.5">
                Returned to Finance for correction.{canEdit && ' Fix the details with "Edit EMD Details", then re-submit for approval.'}
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
                {isMDApproved ? 'MD Approved ✓' : isPendingMDApproval ? 'Pending MD Approval' : isRejected ? 'Re-submit for Approval' : 'MD Approval'}
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
          {canEdit && paymentReceiptUrl && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleViewProof(paymentReceiptUrl, 'EMD Payment Receipt')}
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
