import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Check, AlertCircle, Loader2, FileText, CheckCircle2,
  DollarSign, User, ShieldCheck, ArrowRight, ArrowLeft, Clock,
  ExternalLink, RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  getEmdDetails, updateBasicEmd, submitEmdForMdApproval,
  recordEmdPayment, verifyEmdPayment, updateEmdRefund, uploadEmdReceipt,
  EMD_STATUS_CONFIG, REFUND_STATUS_CONFIG, safeReceiptUrl, openReceipt
} from '../../services/emd'
import { usePermissions } from '../../hooks/usePermissions'

const SECTIONS = [
  { id: 'basic', step: 1, label: 'Basic EMD Info', shortLabel: 'Basic Info', icon: FileText },
  { id: 'approval', step: 2, label: 'MD Approval', shortLabel: 'MD Approval', icon: Clock },
  { id: 'payment', step: 3, label: 'Payment Details', shortLabel: 'Payment', icon: DollarSign },
  { id: 'depositor', step: 4, label: 'Depositor Info', shortLabel: 'Depositor', icon: User },
  { id: 'verification', step: 5, label: 'Verification', shortLabel: 'Verify', icon: ShieldCheck },
  { id: 'refund', step: 6, label: 'Release / Refund', shortLabel: 'Refund', icon: ArrowRight },
]

function fmtDate(dt) {
  if (!dt) return ''
  const d = new Date(dt)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().split('T')[0]
}

function fmtMoney(v) {
  if (!v && v !== 0) return '—'
  return `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

export function EmdDetailsDialog({ open, onClose, bid, onSuccess }) {
  const { hasRole } = usePermissions()
  const canEdit = hasRole('FINANCE') || hasRole('ADMIN') || hasRole('SUPER_ADMIN')

  const [activeSection, setActiveSection] = useState('basic')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [emd, setEmd] = useState(null)

  // Section A: Basic Form State
  const [basicAmount, setBasicAmount] = useState('')
  const [basicDueDate, setBasicDueDate] = useState('')
  const [basicRefNo, setBasicRefNo] = useState('')
  const [basicPurpose, setBasicPurpose] = useState('')
  const [basicRemarks, setBasicRemarks] = useState('')

  // Section C: Payment Form State
  const [paymentMode, setPaymentMode] = useState('Online')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('Successful')
  const [paymentReceiptUrl, setPaymentReceiptUrl] = useState('')
  const [uploadingReceipt, setUploadingReceipt] = useState(false)

  // Online Details
  const [onlineUtr, setOnlineUtr] = useState('')
  const [onlineGateway, setOnlineGateway] = useState('Razorpay')
  const [onlineBank, setOnlineBank] = useState('')
  const [onlineDateTime, setOnlineDateTime] = useState('')

  // Cheque Details
  const [chequeNo, setChequeNo] = useState('')
  const [chequeDate, setChequeDate] = useState('')
  const [chequeBank, setChequeBank] = useState('')
  const [chequeBranch, setChequeBranch] = useState('')
  const [chequeHolder, setChequeHolder] = useState('')
  const [chequeSubDate, setChequeSubDate] = useState('')
  const [chequeStatus, setChequeStatus] = useState('Submitted')

  // Challan Details
  const [challanNo, setChallanNo] = useState('')
  const [challanDate, setChallanDate] = useState('')
  const [challanBank, setChallanBank] = useState('')
  const [challanBranch, setChallanBranch] = useState('')
  const [challanType, setChallanType] = useState('Treasury Challan')
  const [challanStatus, setChallanStatus] = useState('Submitted')

  // Section D: Depositor Form State
  const [depName, setDepName] = useState('')
  const [depEmpId, setDepEmpId] = useState('')
  const [depDept, setDepDept] = useState('Finance')
  const [depDesignation, setDepDesignation] = useState('')
  const [depContact, setDepContact] = useState('')
  const [depEmail, setDepEmail] = useState('')
  const [depDate, setDepDate] = useState('')
  const [depRemarks, setDepRemarks] = useState('')

  // Section E: Verification Form State
  const [verStatus, setVerStatus] = useState('Pending Verification')
  const [verRemarks, setVerRemarks] = useState('')

  // Section F: Refund Form State
  const [refStatus, setRefStatus] = useState('Pending')
  const [refExpectedDate, setRefExpectedDate] = useState('')
  const [refActualDate, setRefActualDate] = useState('')
  const [refAmount, setRefAmount] = useState('')
  const [refRefNo, setRefRefNo] = useState('')
  const [refUtr, setRefUtr] = useState('')
  const [refMode, setRefMode] = useState('Online')
  const [refRemarks, setRefRemarks] = useState('')
  const [refReceiptUrl, setRefReceiptUrl] = useState('')
  const [uploadingRefundReceipt, setUploadingRefundReceipt] = useState(false)

  // Derived validation properties
  const targetEmdAmount = Number(emd?.emd_amount || basicAmount || 0)
  const parsedPaymentAmt = parseFloat(paymentAmount)
  const hasPaymentInput = !isNaN(parsedPaymentAmt) && paymentAmount !== ''
  const isPaymentLess = targetEmdAmount > 0 && hasPaymentInput && parsedPaymentAmt < targetEmdAmount - 0.009
  const isPaymentGreater = targetEmdAmount > 0 && hasPaymentInput && parsedPaymentAmt > targetEmdAmount + 0.009
  const isPaymentExact = targetEmdAmount > 0 && hasPaymentInput && !isPaymentLess && !isPaymentGreater
  const isPaymentMismatched = isPaymentLess || isPaymentGreater

  // Step completion indicators
  const isBasicDone = Boolean(emd && (emd.emd_amount > 0 || parseFloat(basicAmount) > 0) && (emd.due_date || basicDueDate) && (emd.reference_number || basicRefNo))
  const isApprovalDone = Boolean(emd?.is_md_approved)
  const isPaymentDone = Boolean(emd && (emd.payment_amount > 0 || (paymentAmount && !isPaymentMismatched)) && (emd.payment_date || paymentDate))
  const isDepositorDone = Boolean(emd && (emd.depositor_name?.trim() || depName?.trim()))
  const isVerificationDone = Boolean(emd && emd.verification_status === 'Verified')
  const isRefundDone = Boolean(emd && (emd.refund_status === 'Refunded' || emd.refund_status === 'Released'))

  const sectionStatus = {
    basic: isBasicDone,
    approval: isApprovalDone,
    payment: isPaymentDone,
    depositor: isDepositorDone,
    verification: isVerificationDone,
    refund: isRefundDone,
  }

  const loadData = async () => {
    if (!bid?.id) return
    setLoading(true)
    try {
      const res = await getEmdDetails(bid.id)
      if (res.ok && res.data) {
        const d = res.data
        setEmd(d)

        // Initialize Basic
        setBasicAmount(d.emd_amount ? String(d.emd_amount) : '')
        setBasicDueDate(fmtDate(d.due_date))
        setBasicRefNo(d.reference_number || '')
        setBasicPurpose(d.purpose || `EMD for ${bid.title}`)
        setBasicRemarks(d.remarks || '')

        // Initialize Payment
        setPaymentMode(d.payment_mode || 'Online')
        setPaymentAmount(d.payment_amount ? String(d.payment_amount) : String(d.emd_amount || ''))
        setPaymentDate(fmtDate(d.payment_date) || fmtDate(new Date()))
        setPaymentStatus(d.payment_status || 'Successful')
        setPaymentReceiptUrl(safeReceiptUrl(bid.id, d.payment_receipt_url))

        // Parse Mode details
        if (d.payment_details) {
          let pd = d.payment_details
          if (typeof pd === 'string') {
            try {
              pd = JSON.parse(pd)
            } catch {
              pd = {}
            }
          }
          if (d.payment_mode === 'Online') {
            setOnlineUtr(pd.transaction_id || d.payment_reference || '')
            setOnlineGateway(pd.payment_gateway || 'Razorpay')
            setOnlineBank(pd.bank_name || '')
            setOnlineDateTime(pd.transaction_datetime ? fmtDate(pd.transaction_datetime) : '')
          } else if (d.payment_mode === 'Cheque') {
            setChequeNo(pd.cheque_number || d.payment_reference || '')
            setChequeDate(fmtDate(pd.cheque_date))
            setChequeBank(pd.bank_name || '')
            setChequeBranch(pd.branch_name || '')
            setChequeHolder(pd.account_holder_name || '')
            setChequeSubDate(fmtDate(pd.submission_date))
            setChequeStatus(pd.cheque_status || 'Submitted')
          } else if (d.payment_mode === 'Challan') {
            setChallanNo(pd.challan_number || d.payment_reference || '')
            setChallanDate(fmtDate(pd.challan_date))
            setChallanBank(pd.bank_name || '')
            setChallanBranch(pd.branch_name || '')
            setChallanType(pd.challan_type || 'Treasury Challan')
            setChallanStatus(pd.challan_status || 'Submitted')
          }
        }

        // Initialize Depositor
        setDepName(d.depositor_name || '')
        setDepEmpId(d.depositor_employee_id || '')
        setDepDept(d.depositor_department || 'Finance')
        setDepDesignation(d.depositor_designation || '')
        setDepContact(d.depositor_contact || '')
        setDepEmail(d.depositor_email || '')
        setDepDate(fmtDate(d.deposit_date) || fmtDate(new Date()))
        setDepRemarks(d.depositor_remarks || '')

        // Initialize Verification
        setVerStatus(d.verification_status || 'Pending Verification')
        setVerRemarks(d.verification_remarks || '')

        // Initialize Refund
        setRefStatus(d.refund_status || 'Pending')
        setRefExpectedDate(fmtDate(d.expected_refund_date))
        setRefActualDate(fmtDate(d.actual_refund_date))
        setRefAmount(d.refund_amount ? String(d.refund_amount) : String(d.emd_amount || ''))
        setRefRefNo(d.refund_reference_no || '')
        setRefUtr(d.refund_transaction_id || '')
        setRefMode(d.refund_mode || 'Online')
        setRefRemarks(d.refund_remarks || '')
        setRefReceiptUrl(safeReceiptUrl(bid.id, d.refund_receipt_url))
      }
    } catch {
      toast.error('Failed to load EMD details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open, bid?.id])

  if (!open) return null

  const handleOpenReceipt = (url) => {
    openReceipt(url).catch(() => toast.error('Could not open the receipt'))
  }

  // ── Handler for Saving Basic Info ──────────────────────────────────────────
  const handleSaveBasic = async (e) => {
    e?.preventDefault()
    if (!canEdit) {
      toast.error('Only Super Admin, Admin, and Finance Manager are authorized to modify EMD details.')
      return
    }
    const amt = parseFloat(basicAmount)
    if (isNaN(amt) || amt <= 0) {
      toast.error('EMD Amount cannot be empty or zero')
      return
    }
    if (!basicDueDate) {
      toast.error('EMD Due / Submission Date is required')
      return
    }
    if (!basicRefNo.trim()) {
      toast.error('EMD Reference Number is required')
      return
    }
    if (!basicPurpose.trim()) {
      toast.error('EMD Purpose is required')
      return
    }

    setSaving(true)
    try {
      const res = await updateBasicEmd(bid.id, {
        due_date: basicDueDate,
        reference_number: basicRefNo.trim(),
        purpose: basicPurpose.trim(),
        remarks: basicRemarks.trim(),
      })
      if (res.ok) {
        toast.success('Basic EMD details saved successfully!')
        setEmd(res.data)
        onSuccess?.()
      } else {
        toast.error(res.message || 'Failed to update EMD')
      }
    } catch {
      toast.error('Network error while saving EMD')
    } finally {
      setSaving(false)
    }
  }

  // ── Handler for Submitting for MD Approval ─────────────────────────────────
  const handleSubmitMDApproval = async () => {
    if (!canEdit) {
      toast.error('Only Super Admin, Admin, and Finance Manager are authorized to submit EMD for MD approval.')
      return
    }
    const amt = parseFloat(basicAmount)
    if (isNaN(amt) || amt <= 0 || !basicDueDate || !basicRefNo.trim() || !basicPurpose.trim()) {
      toast.error('Please complete all required fields in Basic EMD Info first.')
      setActiveSection('basic')
      return
    }

    setSaving(true)
    try {
      // Save basic details first to ensure DB is current
      await updateBasicEmd(bid.id, {
        due_date: basicDueDate,
        reference_number: basicRefNo.trim(),
        purpose: basicPurpose.trim(),
        remarks: basicRemarks.trim(),
      })

      const res = await submitEmdForMdApproval(bid.id, basicRemarks.trim())
      if (res.ok) {
        toast.success('EMD submitted for MD Approval! The Managing Director has been notified.')
        setEmd(res.data)
        onSuccess?.()
      } else {
        toast.error(res.message || 'Failed to submit for MD Approval')
      }
    } catch {
      toast.error('Network error during MD submission')
    } finally {
      setSaving(false)
    }
  }

  // ── Handler for Navigating from Payment Details to Depositor Info ───────────
  const handleProceedToDepositor = (e) => {
    e?.preventDefault()
    if (!canEdit) {
      toast.error('Only Super Admin, Admin, and Finance Manager are authorized to record EMD payment.')
      return
    }

    const payAmt = parseFloat(paymentAmount)
    if (isNaN(payAmt) || payAmt <= 0) {
      toast.error('Payment Amount must be greater than zero')
      return
    }

    // Validation: Payment Amount cannot be less or greater than required EMD Amount
    if (targetEmdAmount > 0) {
      if (payAmt < targetEmdAmount - 0.009) {
        toast.error(`Payment amount (${fmtMoney(payAmt)}) cannot be less than required EMD amount (${fmtMoney(targetEmdAmount)}). It must match exactly.`)
        return
      }
      if (payAmt > targetEmdAmount + 0.009) {
        toast.error(`Payment amount (${fmtMoney(payAmt)}) cannot be greater than required EMD amount (${fmtMoney(targetEmdAmount)}). It must match exactly.`)
        return
      }
    }

    if (!paymentDate) {
      toast.error('Payment Date is required')
      return
    }

    if (paymentMode === 'Online') {
      if (!onlineUtr.trim()) {
        toast.error('Transaction ID / UTR Number is required for Online Payment')
        return
      }
      if (!onlineGateway.trim()) {
        toast.error('Payment Gateway is required')
        return
      }
    } else if (paymentMode === 'Cheque') {
      if (!chequeNo.trim() || !chequeDate || !chequeBank.trim() || !chequeSubDate) {
        toast.error('Cheque Number, Cheque Date, Bank Name, and Submission Date are required')
        return
      }
    } else if (paymentMode === 'Challan') {
      if (!challanNo.trim() || !challanDate || !challanBank.trim() || !challanType.trim()) {
        toast.error('Challan Number, Challan Date, Bank Name, and Challan Type are required')
        return
      }
    }

    // Proceed to Step 4: Depositor Info
    setActiveSection('depositor')
  }

  // ── Handler for Directly Saving Payment & Depositor Details ────────────────
  const handleSavePayment = async (e) => {
    e?.preventDefault()
    if (!canEdit) {
      toast.error('Only Super Admin, Admin, and Finance Manager are authorized to record EMD payment details.')
      return
    }

    // 1. Payment Details check (in case user jumped directly to depositor tab)
    const payAmt = parseFloat(paymentAmount)
    if (isNaN(payAmt) || payAmt <= 0) {
      toast.error('Please complete Payment Amount in Step 3 (Payment Details)')
      setActiveSection('payment')
      return
    }

    // Validation: Payment Amount cannot be less or greater than required EMD Amount
    if (targetEmdAmount > 0) {
      if (payAmt < targetEmdAmount - 0.009) {
        toast.error(`Payment amount (${fmtMoney(payAmt)}) cannot be less than required EMD amount (${fmtMoney(targetEmdAmount)}). It must match exactly.`)
        setActiveSection('payment')
        return
      }
      if (payAmt > targetEmdAmount + 0.009) {
        toast.error(`Payment amount (${fmtMoney(payAmt)}) cannot be greater than required EMD amount (${fmtMoney(targetEmdAmount)}). It must match exactly.`)
        setActiveSection('payment')
        return
      }
    }

    if (!paymentDate) {
      toast.error('Please set Payment Date in Step 3 (Payment Details)')
      setActiveSection('payment')
      return
    }

    if (paymentMode === 'Online') {
      if (!onlineUtr.trim() || !onlineGateway.trim()) {
        toast.error('Please complete Online Payment details in Step 3')
        setActiveSection('payment')
        return
      }
    } else if (paymentMode === 'Cheque') {
      if (!chequeNo.trim() || !chequeDate || !chequeBank.trim() || !chequeSubDate) {
        toast.error('Please complete Cheque details in Step 3')
        setActiveSection('payment')
        return
      }
    } else if (paymentMode === 'Challan') {
      if (!challanNo.trim() || !challanDate || !challanBank.trim() || !challanType.trim()) {
        toast.error('Please complete Challan details in Step 3')
        setActiveSection('payment')
        return
      }
    }

    // 2. Depositor validation
    if (!depName.trim()) {
      toast.error('Depositor Person Name is required')
      return
    }
    if (!depDept.trim()) {
      toast.error('Depositor Department is required')
      return
    }
    if (!depDate) {
      toast.error('Deposit / Submission Date is required')
      return
    }

    const payload = {
      payment_mode: paymentMode,
      payment_amount: payAmt,
      payment_date: paymentDate,
      payment_status: paymentStatus,
      payment_receipt_url: paymentReceiptUrl || undefined,
      depositor: {
        name: depName.trim(),
        employee_id: depEmpId.trim() || undefined,
        department: depDept.trim(),
        designation: depDesignation.trim() || undefined,
        contact_number: depContact.trim() || undefined,
        email_id: depEmail.trim() || undefined,
        deposit_date: depDate,
        remarks: depRemarks.trim() || undefined,
      },
    }

    if (paymentMode === 'Online') {
      payload.payment_reference = onlineUtr.trim()
      payload.online_details = {
        transaction_id: onlineUtr.trim(),
        payment_gateway: onlineGateway.trim(),
        bank_name: onlineBank.trim() || undefined,
        transaction_datetime: onlineDateTime || new Date().toISOString(),
        payment_amount: payAmt,
        payment_status: paymentStatus,
        receipt_url: paymentReceiptUrl || undefined,
      }
    } else if (paymentMode === 'Cheque') {
      payload.payment_reference = chequeNo.trim()
      payload.cheque_details = {
        cheque_number: chequeNo.trim(),
        cheque_date: chequeDate,
        bank_name: chequeBank.trim(),
        branch_name: chequeBranch.trim() || undefined,
        account_holder_name: chequeHolder.trim() || undefined,
        amount: payAmt,
        submission_date: chequeSubDate,
        cheque_status: chequeStatus,
        receipt_url: paymentReceiptUrl || undefined,
      }
    } else if (paymentMode === 'Challan') {
      payload.payment_reference = challanNo.trim()
      payload.challan_details = {
        challan_number: challanNo.trim(),
        challan_date: challanDate,
        bank_name: challanBank.trim(),
        branch_name: challanBranch.trim() || undefined,
        amount: payAmt,
        challan_type: challanType.trim(),
        challan_status: challanStatus,
        receipt_url: paymentReceiptUrl || undefined,
      }
    }

    setSaving(true)
    try {
      const res = await recordEmdPayment(bid.id, payload)
      if (res.ok) {
        toast.success('EMD Payment & Depositor details recorded and saved directly!')
        setEmd(res.data)
        onSuccess?.()
      } else {
        toast.error(res.message || 'Failed to record payment')
      }
    } catch {
      toast.error('Network error recording payment')
    } finally {
      setSaving(false)
    }
  }

  // ── Handler for Payment Verification ───────────────────────────────────────
  const handleVerify = async (status) => {
    if (!canEdit) {
      toast.error('Only Super Admin, Admin, and Finance Manager are authorized to verify EMD payment.')
      return
    }
    setSaving(true)
    try {
      const res = await verifyEmdPayment(bid.id, {
        status,
        remarks: verRemarks.trim() || undefined,
      })
      if (res.ok) {
        toast.success(`EMD payment verification set to ${status}!`)
        setEmd(res.data)
        setVerStatus(status)
        onSuccess?.()
      } else {
        toast.error(res.message || 'Failed to verify payment')
      }
    } catch {
      toast.error('Network error during verification')
    } finally {
      setSaving(false)
    }
  }

  // ── Handler for Release / Refund ───────────────────────────────────────────
  const handleSaveRefund = async (e) => {
    e?.preventDefault()
    if (!canEdit) {
      toast.error('Only Super Admin, Admin, and Finance Manager are authorized to update EMD refund information.')
      return
    }
    if (refStatus === 'Refunded' && !refActualDate) {
      toast.error('Actual Refund Date is mandatory when status is Refunded')
      return
    }
    if (refStatus === 'Refunded' && refMode === 'Online' && !refUtr.trim()) {
      toast.error('Refund Transaction/UTR Number is mandatory for online refunds')
      return
    }

    const refAmt = refAmount ? parseFloat(refAmount) : undefined
    if (refAmt && emd?.emd_amount && refAmt > emd.emd_amount) {
      toast.error(`Refund amount cannot exceed EMD amount (${fmtMoney(emd.emd_amount)})`)
      return
    }

    setSaving(true)
    try {
      const res = await updateEmdRefund(bid.id, {
        refund_status: refStatus,
        expected_refund_date: refExpectedDate || undefined,
        actual_refund_date: refActualDate || undefined,
        refund_amount: refAmt,
        refund_reference_number: refRefNo.trim() || undefined,
        refund_transaction_id: refUtr.trim() || undefined,
        refund_mode: refMode || undefined,
        refund_remarks: refRemarks.trim() || undefined,
        refund_receipt_url: refReceiptUrl || undefined,
      })
      if (res.ok) {
        toast.success('EMD Release / Refund tracking updated!')
        setEmd(res.data)
        onSuccess?.()
      } else {
        toast.error(res.message || 'Failed to update refund')
      }
    } catch {
      toast.error('Network error updating refund')
    } finally {
      setSaving(false)
    }
  }

  // ── Receipt Upload Helper ──────────────────────────────────────────────────
  const handleReceiptUpload = async (e, type = 'payment') => {
    if (!canEdit) {
      toast.error('Only Super Admin, Admin, and Finance Manager are authorized to upload EMD receipts.')
      return
    }
    const file = e.target.files?.[0]
    if (!file) return

    if (type === 'payment') setUploadingReceipt(true)
    else setUploadingRefundReceipt(true)

    try {
      const res = await uploadEmdReceipt(bid.id, file)
      if (res.ok && res.data?.receipt_url) {
        toast.success('Receipt uploaded successfully!')
        if (type === 'payment') {
          setPaymentReceiptUrl(res.data.receipt_url)
        } else {
          setRefReceiptUrl(res.data.receipt_url)
        }
      } else {
        toast.error(res.message || 'Upload failed')
      }
    } catch {
      toast.error('Network error uploading file')
    } finally {
      if (type === 'payment') setUploadingReceipt(false)
      else setUploadingRefundReceipt(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-4xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <DollarSign className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">EMD Lifecycle &amp; Payment Manager</h2>
                {!canEdit && (
                  <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border font-medium">
                    View Only
                  </Badge>
                )}
                {emd?.status && (
                  <Badge variant="outline" className={`text-xs font-semibold ${EMD_STATUS_CONFIG[emd.status]?.color || 'bg-muted'}`}>
                    {EMD_STATUS_CONFIG[emd.status]?.label || emd.status}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {bid?.title} {bid?.gem_bid_no ? `• GeM No: ${bid.gem_bid_no}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              title="Refresh EMD Data"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Modern Stepper Navigation Bar — Scrollbar completely hidden & beautiful */}
        <div className="border-b border-border/80 bg-muted/20 px-3 sm:px-4 py-2 select-none">
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto overflow-y-hidden no-scrollbar scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {SECTIONS.map((sec) => {
              const Icon = sec.icon
              const isActive = activeSection === sec.id
              const isCompleted = sectionStatus[sec.id]
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSection(sec.id)}
                  className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-all duration-150 whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-background text-foreground shadow-xs font-semibold ring-1 ring-border/80 dark:ring-border'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/50 font-medium'
                  }`}
                >
                  {/* Step Number / Completed Check Badge */}
                  <span
                    className={`flex items-center justify-center size-5 rounded-full text-[10px] font-bold transition-all shrink-0 ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : isCompleted
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold'
                        : 'bg-muted text-muted-foreground group-hover:bg-muted/80'
                    }`}
                  >
                    {isCompleted && !isActive ? (
                      <Check className="size-3 stroke-[2.5]" />
                    ) : (
                      sec.step
                    )}
                  </span>

                  {/* Icon & Label */}
                  <span className="flex items-center gap-1.5">
                    <Icon
                      className={`size-3.5 transition-colors shrink-0 ${
                        isActive
                          ? 'text-primary'
                          : isCompleted
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-muted-foreground group-hover:text-foreground'
                      }`}
                    />
                    <span className="tracking-tight">
                      <span className="hidden sm:inline">{sec.label}</span>
                      <span className="inline sm:hidden">{sec.shortLabel || sec.label}</span>
                    </span>
                  </span>

                  {/* Active Indicator Underline */}
                  {isActive && (
                    <motion.div
                      layoutId="activeTabUnderline"
                      className="absolute inset-x-2 -bottom-2 h-0.5 bg-primary rounded-full"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-xs">Loading EMD information...</p>
            </div>
          ) : (
            <>
              {!canEdit && (
                <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2.5">
                  <ShieldCheck className="size-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-semibold">View-Only Mode</p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                      Only Super Admin, Admin, and Finance Manager (FM) are authorized to add or edit EMD details. Other roles have view-only access.
                    </p>
                  </div>
                </div>
              )}
              <AnimatePresence mode="wait">
              {/* ── SECTION 1: BASIC EMD INFORMATION ── */}
              {activeSection === 'basic' && (
                <motion.form
                  key="sec-basic"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleSaveBasic}
                  className="space-y-4 max-w-2xl"
                >
                  <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-300">
                    <p className="font-semibold flex items-center gap-1.5">
                      <FileText className="size-4" /> Finance Manager Re-verification
                    </p>
                    <p className="text-[11px] mt-1 text-blue-700 dark:text-blue-400">
                      Verify EMD terms against tender schedule. Once confirmed, submit this record for MD Approval.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">EMD Amount (₹) — set on the tender</Label>
                      <Input
                        type="number"
                        disabled
                        value={basicAmount}
                        readOnly
                        className="text-xs font-mono font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">EMD Due / Submission Date *</Label>
                      <Input
                        type="date"
                        required
                        disabled={!canEdit}
                        value={basicDueDate}
                        onChange={(e) => setBasicDueDate(e.target.value)}
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">EMD Reference Number *</Label>
                      <Input
                        type="text"
                        required
                        disabled={!canEdit}
                        value={basicRefNo}
                        onChange={(e) => setBasicRefNo(e.target.value)}
                        placeholder="e.g. GEM/2026/B/881923"
                        className="text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">EMD Status</Label>
                      <div className="h-9 flex items-center text-xs font-semibold">{emd?.status || 'Pending'}</div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">EMD Purpose / Description *</Label>
                    <Input
                      type="text"
                      required
                      disabled={!canEdit}
                      value={basicPurpose}
                      onChange={(e) => setBasicPurpose(e.target.value)}
                      placeholder="e.g. Bid Security for High-Performance Compute Cluster"
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Finance Remarks / Clarifications</Label>
                    <Textarea
                      disabled={!canEdit}
                      value={basicRemarks}
                      onChange={(e) => setBasicRemarks(e.target.value)}
                      placeholder="Notes on exemption eligibility, DD details, or bank instructions..."
                      className="text-xs min-h-[75px]"
                    />
                  </div>

                  {canEdit && (
                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={saving}
                        onClick={handleSubmitMDApproval}
                        className="gap-1.5 text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        <Clock className="size-3.5" />
                        Submit for MD Approval
                      </Button>

                      <Button type="submit" size="sm" disabled={saving} className="gap-1.5 text-xs font-semibold">
                        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                        Save Basic Details
                      </Button>
                    </div>
                  )}
                </motion.form>
              )}

              {/* ── SECTION 2: MD APPROVAL GATE ── */}
              {activeSection === 'approval' && (
                <motion.div
                  key="sec-approval"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4 max-w-2xl"
                >
                  <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-border/60">
                      <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Current Approval Status</span>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${EMD_STATUS_CONFIG[emd?.status]?.color || 'bg-muted'}`}>
                        <span className={`size-2 rounded-full ${EMD_STATUS_CONFIG[emd?.status]?.dot || 'bg-gray-400'}`} />
                        {emd?.status || 'Pending'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Submitted for Approval By:</span>
                        <span className="font-semibold text-foreground">
                          {emd?.md_submitted_by ? `${emd.md_submitted_by.full_name} (${emd.md_submitted_by.role || 'FM'})` : 'Not submitted yet'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Submission Date &amp; Time:</span>
                        <span className="font-medium text-foreground">
                          {emd?.md_submitted_at ? fmtDate(emd.md_submitted_at) : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Executive Decided By:</span>
                        <span className="font-semibold text-foreground">
                          {emd?.md_decided_by ? `${emd.md_decided_by.full_name} (${emd.md_decided_by.role || 'MD'})` : 'Awaiting MD Decision'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Decision Date &amp; Time:</span>
                        <span className="font-medium text-foreground">
                          {emd?.md_decided_at ? fmtDate(emd.md_decided_at) : '—'}
                        </span>
                      </div>
                    </div>

                    {emd?.md_decision_remarks && (
                      <div className="mt-3 p-3 rounded-lg bg-muted/40 border border-border/60 text-xs">
                        <span className="text-muted-foreground font-semibold block text-[11px] mb-1">Managing Director Remarks:</span>
                        <p className="text-foreground italic">"{emd.md_decision_remarks}"</p>
                      </div>
                    )}
                  </div>

                  {emd?.status === 'Pending MD Approval' && (
                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-300 flex items-center gap-2">
                      <Clock className="size-4 shrink-0 text-amber-600 animate-pulse" />
                      <span>This tender EMD is currently pending executive review by the Managing Director / Super Admin.</span>
                    </div>
                  )}

                  {emd?.is_md_approved && (
                    <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                      <span>EMD has been officially MD Approved / Paid! Payment details and depositor information recorded directly.</span>
                    </div>
                  )}

                  {emd?.status === 'Rejected' && (
                    <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-xs text-rose-900 dark:text-rose-300 flex items-center gap-2">
                      <AlertCircle className="size-4 shrink-0 text-rose-600" />
                      <span>EMD was rejected by the MD. Finance can correct the details in Section 1 and re-submit for MD Approval.</span>
                    </div>
                  )}

                  {(emd?.status === 'Pending' || emd?.status === 'Rejected') && canEdit && (
                    <div className="pt-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={saving}
                        onClick={handleSubmitMDApproval}
                        className="gap-1.5 text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        <Clock className="size-3.5" />
                        {emd.status === 'Rejected' ? 'Re-submit for MD Approval' : 'Submit for MD Approval Now'}
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── SECTION 3: PAYMENT DETAILS ── */}
              {activeSection === 'payment' && (
                <motion.form
                  key="sec-payment"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleProceedToDepositor}
                  className="space-y-4 max-w-2xl"
                >
                  {/* Mode Selector Tabs */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Payment Mode *</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Online', 'Cheque', 'Challan'].map((m) => (
                        <button
                          key={m}
                          type="button"
                          disabled={!canEdit}
                          onClick={() => setPaymentMode(m)}
                          className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                            paymentMode === m
                              ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20 shadow-xs'
                              : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">Payment Amount (₹) *</Label>
                        {targetEmdAmount > 0 && (
                          <span className="text-[11px] font-medium text-muted-foreground">
                            Required: <span className="font-semibold text-foreground font-mono">{fmtMoney(targetEmdAmount)}</span>
                          </span>
                        )}
                      </div>
                      <Input
                        type="number"
                        min="1"
                        step="0.01"
                        required
                        disabled={!canEdit}
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder={targetEmdAmount > 0 ? String(targetEmdAmount) : "50000"}
                        className={`text-xs font-mono font-medium transition-colors ${
                          isPaymentMismatched
                            ? 'border-rose-500 ring-1 ring-rose-500/40 focus-visible:ring-rose-500 bg-rose-50/10'
                            : isPaymentExact
                            ? 'border-emerald-500 ring-1 ring-emerald-500/40 focus-visible:ring-emerald-500 bg-emerald-50/10'
                            : ''
                        }`}
                      />
                      {targetEmdAmount > 0 && (
                        <div className="text-[11px] pt-0.5 space-y-1">
                          {isPaymentLess && (
                            <p className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-medium">
                              <AlertCircle className="size-3.5 shrink-0" />
                              Amount is less than required EMD ({fmtMoney(targetEmdAmount)}). It will not submit.
                            </p>
                          )}
                          {isPaymentGreater && (
                            <p className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-medium">
                              <AlertCircle className="size-3.5 shrink-0" />
                              Amount is greater than required EMD ({fmtMoney(targetEmdAmount)}). It will not submit.
                            </p>
                          )}
                          {isPaymentExact && (
                            <p className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                              <CheckCircle2 className="size-3.5 shrink-0" />
                              Payment matches required EMD amount exactly ({fmtMoney(targetEmdAmount)}).
                            </p>
                          )}
                          {canEdit && isPaymentMismatched && (
                            <button
                              type="button"
                              onClick={() => setPaymentAmount(String(targetEmdAmount))}
                              className="text-[11px] text-primary hover:underline font-semibold block"
                            >
                              Auto-fill required amount ({fmtMoney(targetEmdAmount)})
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Payment Date *</Label>
                      <Input
                        type="date"
                        required
                        disabled={!canEdit}
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>

                  {/* Dynamic Fields: ONLINE */}
                  {paymentMode === 'Online' && (
                    <div className="p-4 rounded-xl border border-blue-200/80 bg-blue-50/30 dark:bg-blue-950/10 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                        Online Payment Details
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">Transaction ID / UTR Number *</Label>
                          <Input
                            required
                            disabled={!canEdit}
                            value={onlineUtr}
                            onChange={(e) => setOnlineUtr(e.target.value)}
                            placeholder="e.g. HDFC123456789"
                            className="text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">Payment Gateway *</Label>
                          <Input
                            required
                            disabled={!canEdit}
                            value={onlineGateway}
                            onChange={(e) => setOnlineGateway(e.target.value)}
                            placeholder="e.g. Razorpay / GeM e-PBG / SBI ePay"
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">Bank Name (Recommended)</Label>
                          <Input
                            disabled={!canEdit}
                            value={onlineBank}
                            onChange={(e) => setOnlineBank(e.target.value)}
                            placeholder="e.g. HDFC Bank"
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">Payment Status *</Label>
                          <select
                            disabled={!canEdit}
                            value={paymentStatus}
                            onChange={(e) => setPaymentStatus(e.target.value)}
                            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <option value="Successful">Successful</option>
                            <option value="Pending">Pending</option>
                            <option value="Failed">Failed</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dynamic Fields: CHEQUE */}
                  {paymentMode === 'Cheque' && (
                    <div className="p-4 rounded-xl border border-amber-200/80 bg-amber-50/30 dark:bg-amber-950/10 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                        Cheque Payment Details
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">Cheque Number *</Label>
                          <Input
                            required
                            disabled={!canEdit}
                            value={chequeNo}
                            onChange={(e) => setChequeNo(e.target.value)}
                            placeholder="e.g. 000492"
                            className="text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">Cheque Date *</Label>
                          <Input
                            type="date"
                            required
                            disabled={!canEdit}
                            value={chequeDate}
                            onChange={(e) => setChequeDate(e.target.value)}
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">Bank Name *</Label>
                          <Input
                            required
                            disabled={!canEdit}
                            value={chequeBank}
                            onChange={(e) => setChequeBank(e.target.value)}
                            placeholder="e.g. State Bank of India"
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">Branch Name</Label>
                          <Input
                            disabled={!canEdit}
                            value={chequeBranch}
                            onChange={(e) => setChequeBranch(e.target.value)}
                            placeholder="e.g. Connaught Place"
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">Account Holder Name</Label>
                          <Input
                            disabled={!canEdit}
                            value={chequeHolder}
                            onChange={(e) => setChequeHolder(e.target.value)}
                            placeholder="GlobX Technologies Pvt Ltd"
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">Cheque Submission Date *</Label>
                          <Input
                            type="date"
                            required
                            disabled={!canEdit}
                            value={chequeSubDate}
                            onChange={(e) => setChequeSubDate(e.target.value)}
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-[11px] font-semibold">Cheque Status *</Label>
                          <select
                            disabled={!canEdit}
                            value={chequeStatus}
                            onChange={(e) => setChequeStatus(e.target.value)}
                            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <option value="Submitted">Submitted</option>
                            <option value="Deposited">Deposited</option>
                            <option value="Cleared">Cleared</option>
                            <option value="Bounced">Bounced</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dynamic Fields: CHALLAN */}
                  {paymentMode === 'Challan' && (
                    <div className="p-4 rounded-xl border border-teal-200/80 bg-teal-50/30 dark:bg-teal-950/10 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-teal-900 dark:text-teal-300">
                        Challan Payment Details
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">Challan Number *</Label>
                          <Input
                            required
                            disabled={!canEdit}
                            value={challanNo}
                            onChange={(e) => setChallanNo(e.target.value)}
                            placeholder="e.g. TR-2026-981"
                            className="text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">Challan Date *</Label>
                          <Input
                            type="date"
                            required
                            disabled={!canEdit}
                            value={challanDate}
                            onChange={(e) => setChallanDate(e.target.value)}
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">Bank Name *</Label>
                          <Input
                            required
                            disabled={!canEdit}
                            value={challanBank}
                            onChange={(e) => setChallanBank(e.target.value)}
                            placeholder="e.g. Punjab National Bank"
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">Branch Name</Label>
                          <Input
                            disabled={!canEdit}
                            value={challanBranch}
                            onChange={(e) => setChallanBranch(e.target.value)}
                            placeholder="Branch location"
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">Challan Type / Purpose *</Label>
                          <Input
                            required
                            disabled={!canEdit}
                            value={challanType}
                            onChange={(e) => setChallanType(e.target.value)}
                            placeholder="e.g. Treasury Challan TR-6"
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">Challan Status *</Label>
                          <select
                            disabled={!canEdit}
                            value={challanStatus}
                            onChange={(e) => setChallanStatus(e.target.value)}
                            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <option value="Submitted">Submitted</option>
                            <option value="Verified">Verified</option>
                            <option value="Rejected">Rejected</option>
                            <option value="Paid">Paid</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Receipt Upload / View */}
                  <div className="space-y-1.5 p-3.5 rounded-xl border border-border bg-muted/20">
                    <Label className="text-xs font-semibold flex items-center justify-between">
                      <span>Payment Receipt / Scanned Proof</span>
                      {paymentReceiptUrl && (
                        <button
                          type="button"
                          onClick={() => handleOpenReceipt(paymentReceiptUrl)}
                          className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                        >
                          <ExternalLink className="size-3" /> View Uploaded Receipt
                        </button>
                      )}
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        disabled={!canEdit || uploadingReceipt}
                        onChange={(e) => handleReceiptUpload(e, 'payment')}
                        className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90"
                      />
                      {uploadingReceipt && <Loader2 className="size-4 animate-spin text-primary" />}
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex justify-end pt-3 border-t border-border">
                      <Button
                        type="submit"
                        size="sm"
                        disabled={isPaymentMismatched}
                        title={isPaymentMismatched ? 'Payment amount must match required EMD amount' : 'Proceed to Depositor Info'}
                        className="gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm disabled:opacity-50"
                      >
                        Next Step: Depositor Info
                        <ArrowRight className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </motion.form>
              )}

              {/* ── SECTION 4: DEPOSITOR / PERSON DETAILS ── */}
              {activeSection === 'depositor' && (
                <motion.form
                  key="sec-depositor"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleSavePayment}
                  className="space-y-4 max-w-2xl"
                >
                  {isPaymentMismatched && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="size-4 shrink-0" />
                        <span>Payment amount in Step 3 does not match required EMD ({fmtMoney(targetEmdAmount)}). Submission is blocked.</span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveSection('payment')}
                        className="text-xs h-7 border-rose-300 hover:bg-rose-50"
                      >
                        Correct Amount
                      </Button>
                    </div>
                  )}

                  <div className="p-3.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 text-xs text-purple-900 dark:text-purple-300">
                    <p className="font-semibold flex items-center gap-1.5">
                      <User className="size-4" /> Depositor &amp; Person Responsible
                    </p>
                    <p className="text-[11px] mt-1 text-purple-700 dark:text-purple-400">
                      Identifies the exact employee who physically deposited or electronically processed the EMD transaction.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Person Name *</Label>
                      <Input
                        required
                        disabled={!canEdit}
                        value={depName}
                        onChange={(e) => setDepName(e.target.value)}
                        placeholder="e.g. Rahul Kumar"
                        className="text-xs font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Employee ID (Recommended)</Label>
                      <Input
                        disabled={!canEdit}
                        value={depEmpId}
                        onChange={(e) => setDepEmpId(e.target.value)}
                        placeholder="e.g. GLX-082"
                        className="text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Department *</Label>
                      <Input
                        required
                        disabled={!canEdit}
                        value={depDept}
                        onChange={(e) => setDepDept(e.target.value)}
                        placeholder="Finance & Accounts"
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Designation</Label>
                      <Input
                        disabled={!canEdit}
                        value={depDesignation}
                        onChange={(e) => setDepDesignation(e.target.value)}
                        placeholder="Senior Finance Executive"
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Contact Number</Label>
                      <Input
                        type="tel"
                        disabled={!canEdit}
                        value={depContact}
                        onChange={(e) => setDepContact(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Email ID</Label>
                      <Input
                        type="email"
                        disabled={!canEdit}
                        value={depEmail}
                        onChange={(e) => setDepEmail(e.target.value)}
                        placeholder="rahul.k@globx.co.in"
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-semibold">Deposit / Submission Date *</Label>
                      <Input
                        type="date"
                        required
                        disabled={!canEdit}
                        value={depDate}
                        onChange={(e) => setDepDate(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Depositor Remarks (Optional)</Label>
                    <Textarea
                      disabled={!canEdit}
                      value={depRemarks}
                      onChange={(e) => setDepRemarks(e.target.value)}
                      placeholder="Bank counter details, slip number, or processing notes..."
                      className="text-xs min-h-[70px]"
                    />
                  </div>

                  {canEdit && (
                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveSection('payment')}
                        className="gap-1.5 text-xs font-semibold"
                      >
                        <ArrowLeft className="size-3.5" />
                        Back to Payment Details
                      </Button>

                      <Button
                        type="submit"
                        size="sm"
                        disabled={saving || isPaymentMismatched}
                        title={isPaymentMismatched ? 'Payment amount in Step 3 must match required EMD amount' : 'Record and save payment'}
                        className="gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                        Record &amp; Save Payment Details
                      </Button>
                    </div>
                  )}
                </motion.form>
              )}

              {/* ── SECTION 5: VERIFICATION ── */}
              {activeSection === 'verification' && (
                <motion.div
                  key="sec-verification"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4 max-w-2xl"
                >
                  <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900 text-xs text-indigo-900 dark:text-indigo-300">
                    <p className="font-semibold flex items-center gap-1.5">
                      <ShieldCheck className="size-4" /> Finance Payment Verification
                    </p>
                    <p className="text-[11px] mt-1 text-indigo-700 dark:text-indigo-400">
                      Re-verify that the payment has cleared GlobX's bank/portal ledger and receipts match the required tender terms.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-border/60 text-xs">
                      <span className="text-muted-foreground font-semibold">Current Verification Status:</span>
                      <Badge
                        variant="outline"
                        className={`text-xs font-bold ${
                          verStatus === 'Verified'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : verStatus === 'Rejected'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {verStatus}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Verified By:</span>
                        <span className="font-semibold text-foreground">
                          {emd?.verified_by ? `${emd.verified_by.full_name} (${emd.verified_by.role || 'FM'})` : 'Pending'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Verified At:</span>
                        <span className="font-medium text-foreground">
                          {emd?.verified_at ? fmtDate(emd.verified_at) : '—'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2">
                      <Label className="text-xs font-semibold">Verification Remarks / Audit Notes</Label>
                      <Textarea
                        disabled={!canEdit}
                        value={verRemarks}
                        onChange={(e) => setVerRemarks(e.target.value)}
                        placeholder="Confirm bank statement match, challan stamp check, or reason if rejected..."
                        className="text-xs min-h-[75px]"
                      />
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving || !emd?.payment_amount}
                        onClick={() => handleVerify('Rejected')}
                        className="gap-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      >
                        <X className="size-3.5" />
                        Reject Verification
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={saving || !emd?.payment_amount}
                        onClick={() => handleVerify('Verified')}
                        className="gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <CheckCircle2 className="size-3.5" />
                        Mark as Verified
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── SECTION 6: RELEASE / REFUND TRACKING ── */}
              {activeSection === 'refund' && (
                <motion.form
                  key="sec-refund"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleSaveRefund}
                  className="space-y-4 max-w-2xl"
                >
                  <div className="p-3.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900 text-xs text-teal-900 dark:text-teal-300">
                    <p className="font-semibold flex items-center gap-1.5">
                      <ArrowRight className="size-4" /> Maturity, Release &amp; Refund Monitoring
                    </p>
                    <p className="text-[11px] mt-1 text-teal-700 dark:text-teal-400">
                      Track the return of the EMD after tender completion or PO receipt. Actual Refund Date and UTR are strictly recorded on refund receipt.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">EMD Release/Refund Status *</Label>
                      <select
                        disabled={!canEdit}
                        value={refStatus}
                        onChange={(e) => setRefStatus(e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {Object.keys(REFUND_STATUS_CONFIG).map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Refund Mode</Label>
                      <select
                        disabled={!canEdit}
                        value={refMode}
                        onChange={(e) => setRefMode(e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="Online">Online Transfer / RTGS</option>
                        <option value="Cheque">Cheque Return</option>
                        <option value="Portal Auto-Credit">GeM Portal Auto-Credit</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Expected Refund Date (Recommended)</Label>
                      <Input
                        type="date"
                        disabled={!canEdit}
                        value={refExpectedDate}
                        onChange={(e) => setRefExpectedDate(e.target.value)}
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold flex items-center justify-between">
                        <span>Actual Refund Date</span>
                        {refStatus === 'Refunded' && <span className="text-rose-500 text-[10px]">Mandatory</span>}
                      </Label>
                      <Input
                        type="date"
                        required={refStatus === 'Refunded'}
                        disabled={!canEdit}
                        value={refActualDate}
                        onChange={(e) => setRefActualDate(e.target.value)}
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Refund Amount (₹)</Label>
                      <Input
                        type="number"
                        min="1"
                        step="0.01"
                        disabled={!canEdit}
                        value={refAmount}
                        onChange={(e) => setRefAmount(e.target.value)}
                        placeholder="50000"
                        className="text-xs font-mono font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Refund Reference Number</Label>
                      <Input
                        disabled={!canEdit}
                        value={refRefNo}
                        onChange={(e) => setRefRefNo(e.target.value)}
                        placeholder="REF-REFUND-991"
                        className="text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-semibold flex items-center justify-between">
                        <span>Refund Transaction / UTR Number</span>
                        {refStatus === 'Refunded' && refMode === 'Online' && (
                          <span className="text-rose-500 text-[10px]">Mandatory for Online</span>
                        )}
                      </Label>
                      <Input
                        required={refStatus === 'Refunded' && refMode === 'Online'}
                        disabled={!canEdit}
                        value={refUtr}
                        onChange={(e) => setRefUtr(e.target.value)}
                        placeholder="e.g. CMS1882949102"
                        className="text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Refund Remarks (Optional)</Label>
                    <Textarea
                      disabled={!canEdit}
                      value={refRemarks}
                      onChange={(e) => setRefRemarks(e.target.value)}
                      placeholder="e.g. Bank credit received in HDFC account on tender closure..."
                      className="text-xs min-h-[70px]"
                    />
                  </div>

                  {/* Refund Proof Upload */}
                  <div className="space-y-1.5 p-3.5 rounded-xl border border-border bg-muted/20">
                    <Label className="text-xs font-semibold flex items-center justify-between">
                      <span>Refund Proof / Bank Statement Receipt</span>
                      {refReceiptUrl && (
                        <button
                          type="button"
                          onClick={() => handleOpenReceipt(refReceiptUrl)}
                          className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                        >
                          <ExternalLink className="size-3" /> View Refund Proof
                        </button>
                      )}
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        disabled={!canEdit || uploadingRefundReceipt}
                        onChange={(e) => handleReceiptUpload(e, 'refund')}
                        className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90"
                      />
                      {uploadingRefundReceipt && <Loader2 className="size-4 animate-spin text-primary" />}
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex justify-end pt-3 border-t border-border">
                      <Button type="submit" size="sm" disabled={saving} className="gap-1.5 text-xs font-semibold">
                        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                        Save Release / Refund Information
                      </Button>
                    </div>
                  )}
                </motion.form>
              )}
            </AnimatePresence>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-border bg-muted/20 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {canEdit
              ? (hasRole('FINANCE') ? 'Role: Finance Manager (Authorized Editor)' : 'Role: Administrator (Authorized Editor)')
              : 'Role: Read-Only Viewer (Only Super Admin, Admin & FM can add/edit EMD)'}
          </span>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close Dialog
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
