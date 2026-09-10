import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, ShieldCheck, Share2, Coins, FileText, CheckSquare,
  AlertCircle, CheckCircle2, Send, Upload, Hourglass, Trophy,
  XCircle, Plus, Trash2, ArrowRight, DollarSign, Building2,
  Lock, Sparkles, UserCheck, Bell, Calculator, ExternalLink, RefreshCw, Edit2, Loader2, AlertTriangle,
  Calendar, Clock, History, MessageSquare, Eye, ChevronRight, Ban, Users
} from 'lucide-react'
import { toast } from 'sonner'
import confetti from 'canvas-confetti'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { transitionBidStage, recordBidOutcome, updateBid, getBidStageHistory, toggleChecklist } from '../../services/bids'
import { usePermissions } from '../../hooks/usePermissions'
import { tokenStorage } from '../../services/auth'
import { ChecklistTab } from './ChecklistTab'
import { logStageMicroEvent } from '../../services/auditLogger'
import { useBidStore } from '../../store/useBidStore'
import { buildAlertNoteHtml } from '../../lib/tenderFormat'

function fmtMoney(v) {
  if (!v && v !== 0) return '—'
  if (v >= 10000000) return `₹${(v/10000000).toFixed(2)} Cr`
  if (v >= 100000) return `₹${(v/100000).toFixed(2)} L`
  return `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

function fmtDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateTime(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Pre-Sales' per-product OEM used to be one free-text string per product
// index; it's now an array of candidates. Old tenders still carry the
// string, so every read goes through here. A legacy single value is treated
// as "suggested" so it keeps winning over the static requested_products
// seed in resolveProductOem below — an old tender must not visibly change.
function normalizeOemCandidates(stored) {
  if (Array.isArray(stored)) return stored.filter(c => c && c.oem)
  if (typeof stored === 'string' && stored.trim()) {
    return [{ oem: stored.trim(), remarks: '', suggested: true }]
  }
  return []
}

// Single source of truth for "which OEM applies to requested_products[index]".
// Priority: Account Manager's final pick > Pre-Sales' suggested candidate >
// Pre-Sales' first candidate > the static Add/Edit-Tender seed.
function resolveProductOem(bid, index) {
  const pr = (bid?.primary_review && typeof bid.primary_review === 'object') ? bid.primary_review : {}
  const am = (pr.amOemSelections || {})[index]
  if (am) return am
  const cands = normalizeOemCandidates((pr.presalesProducts || {})[index])
  const pick = cands.find(c => c.suggested) || cands[0]
  if (pick?.oem) return pick.oem
  return (bid?.requested_products || [])[index]?.oem || ''
}

// Local-id generator for OEM-candidate/matrix rows that only need a stable
// React key — Date.now() alone collides when several rows are created in
// the same tick (e.g. "Add" clicked twice fast).
let __oemRowSeq = 0
function nextLocalId() { return `${Date.now()}-${__oemRowSeq++}` }

// Builds Pre-Sales' per-product OEM-candidate rows from primary_review —
// shared by Stage2PrimaryReviewWorkspace's initial useState and its resync
// effect, so a refresh rebuilds this the exact same way mount did.
function buildPresalesCands(products, primaryReview) {
  const saved = primaryReview.presalesProducts || {}
  return products.map((p, i) => {
    const rows = normalizeOemCandidates(saved[i])
    if (rows.length) return rows.map(c => ({ id: nextLocalId(), oem: c.oem, remarks: c.remarks || '', suggested: !!c.suggested }))
    return p.oem ? [{ id: nextLocalId(), oem: p.oem, remarks: '', suggested: true }] : []
  })
}

// The OEM Authorization matrix row shape — shared by the manual "Add OEM
// Row" action and the Primary-Review auto-seed, so both produce identical rows.
function makeOemRow(name, origin, byName) {
  return {
    id: nextLocalId(), name, origin,
    // Never auto-initiated — a row appearing on the sheet (whether seeded
    // from Primary Review or added by hand) is not the same as someone
    // having actually kicked off the OEM authorization process for it.
    initiated: 'NO', initiatedByName: '',
    contactName: '', contactEmail: '',
    docStatus: {},
    maf: 'NOT RECEIVED',
    compliance: 'NA',
    followUp: '', followUps: [], remark: '',
  }
}

// Renders a tender's key facts as an HTML table so identification alert
// emails carry full detail dynamically, not a one-line mention the recipient
// has to open the app to expand on. The backend's alert mailer passes HTML
// straight through once it detects a <table>/<div>/<p> in the message.
function buildTenderDetailHtml(bid) {
  const rows = [
    ['Tender Title', bid.title],
    ['GeM / RFP No.', bid.gem_bid_no || bid.bid_no],
    ['Account Name', bid.organization_name],
    ['Department / Ministry', bid.department_name],
    ['Location', bid.location],
    ['Category', bid.category],
    ['High-Level Scope', bid.high_level_scope],
    ['Estimated Value', fmtMoney(bid.estimated_value)],
    ['EMD Amount', bid.emd_not_applicable ? 'Not Applicable' : fmtMoney(bid.emd_amount)],
    ['EMD Online Available', bid.emd_bank_name ? `Yes — ${bid.emd_bank_name}` : 'No'],
    ['EMD DD Available', bid.emd_beneficiary ? `Yes — ${bid.emd_beneficiary}` : 'No'],
    ['Exemptions Listed', (bid.emd_exemption_types || []).join(', ')],
    ['Bank Guarantee', bid.bg_required ? `Required — ${bid.bg_rate ?? '—'}%${bid.bg_duration_months ? `, ${bid.bg_duration_months} mo` : ''}` : 'Not Required'],
    ['Closing Date', fmtDate(bid.closing_date)],
  ].filter(([, v]) => v)
  const body = rows.map(([k, v]) => `<tr><td style="padding:4px 14px 4px 0;color:#64748b;font-weight:600;white-space:nowrap;vertical-align:top;">${k}</td><td style="padding:4px 0;color:#0f172a;">${v}</td></tr>`).join('')
  return `<table style="border-collapse:collapse;width:100%;font-size:13px;margin-top:8px;">${body}</table>${buildAlertNoteHtml(bid.alert_note)}`
}

// Common Transition Dialog Component
// IMPORTANT: This modal ONLY marks stageKey as complete in stage_completions.
// It does NOT call transitionBidStage — that would move the workflow_stage pointer
// and cause a cascade overwrite on other stages. Each stage is completed atomically.
function CompleteStageModal({ title, description, stageKey, bidId, bid, onComplete, onClose, children, hideDefaultRemarks, remarksValue }) {
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // When a caller already collects its own mandatory reason (e.g. a
  // disqualification reason), it can suppress the built-in remarks field
  // via hideDefaultRemarks and supply that reason as remarksValue instead
  // of asking for the same information twice.
  const effectiveRemarks = hideDefaultRemarks ? (remarksValue || '') : remarks

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!effectiveRemarks.trim()) {
      toast.error(hideDefaultRemarks ? 'Please provide the required reason before completing this stage' : 'Remarks are required to complete stage action')
      return
    }
    setSubmitting(true)
    try {
      // ── Atomic single-stage patch ────────────────────────────────────────
      // We read current completions from the bid prop and ONLY toggle the
      // specific stageKey to true. Nothing else is touched.
      const currentCompletions = { ...(bid?.stage_completions || {}) }
      currentCompletions[stageKey] = true   // ← mark ONLY this stage complete

      const currentRemarks = { ...(bid?.stage_remarks || {}) }
      currentRemarks[stageKey] = `[Completed]: ${effectiveRemarks}`

      const currentReviews = { ...(bid?.stage_reviews || {}) }
      currentReviews[stageKey] = false  // clear any review flag

      if (bidId) {
        let nextStage = bid?.workflow_stage
        const completedIdx = WORKFLOW_STAGES_ORDERED.indexOf(stageKey)
        const currentIdx = WORKFLOW_STAGES_ORDERED.indexOf(bid?.workflow_stage || 'DISCOVERED')
        if (completedIdx >= currentIdx && completedIdx + 1 < WORKFLOW_STAGES_ORDERED.length) {
          nextStage = WORKFLOW_STAGES_ORDERED[completedIdx + 1]
        }

        const patchData = {
          stage_completions: currentCompletions,
          stage_remarks: currentRemarks,
          stage_reviews: currentReviews,
          workflow_stage: nextStage,
        }
        const res = await updateBid(bidId, patchData)
        if (!res.ok) {
          toast.error(res.error?.message || 'Failed to save stage completion')
          return
        }
      }

      // Call workspace-specific side effect (alerts, confetti, quoted_price update, etc.) FIRST
      let sideEffectResult = null
      if (onComplete) {
        sideEffectResult = await onComplete(effectiveRemarks)
      }

      if (stageKey) {
        let actionReason = `[Completed Stage Action]: ${effectiveRemarks}`
        let detailsPayload = null

        if (sideEffectResult && typeof sideEffectResult === 'object') {
          if (sideEffectResult.customReason) {
            actionReason = sideEffectResult.customReason
          }
          const { customReason, ...restDetails } = sideEffectResult
          if (Object.keys(restDetails).length > 0) {
            detailsPayload = restDetails
          }
        }

        logStageInteraction(bidId, stageKey, actionReason, null, detailsPayload)
      }

      toast.success('Stage marked as completed!')
      onClose()
    } catch (err) {
      toast.error('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-xl space-y-4">
        <h3 className="text-base font-semibold font-heading text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {children}
          {!hideDefaultRemarks && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Stage Completion Remarks *</Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Provide mandatory completion/handover remarks..."
                className="text-xs min-h-[80px]"
                required
              />
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button type="submit" size="sm" disabled={submitting} className="gap-2">
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                'Confirm & Complete Stage'
              )}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}


export const WORKFLOW_STAGES_ORDERED = [
  'DISCOVERED',
  'PRIMARY_REVIEW',
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

// Stages gated behind Primary Review — locked (even though they otherwise
// don't require strict prior-stage sequencing among themselves) until the
// Account Manager marks PRIMARY_REVIEW complete.
const STAGES_GATED_BY_PRIMARY_REVIEW = [
  'OEM_AUTHORIZATION_REQUEST',
  'PRICING_REQUEST',
  'DOCUMENT_CHECKLIST_PREPARATION',
  'EMD_PROCESSING',
]

export function logStageInteraction(bidId, stageKey, actionReason, userOverride) {
  if (!bidId) return
  logStageMicroEvent(bidId, {
    fromStage: stageKey,
    toStage: stageKey,
    eventType: 'STAGE_CHANGE',
    transitionReason: actionReason
  })
}

export function checkStageState(bid, stageKey) {
  const currentStage = bid?.workflow_stage || 'DISCOVERED'
  const currentIdx = WORKFLOW_STAGES_ORDERED.indexOf(currentStage)
  const stageIdx = WORKFLOW_STAGES_ORDERED.indexOf(stageKey)
  const isTerminal = ['WON', 'LOST', 'CANCELLED', 'ARCHIVED'].includes(bid?.bid_status)

  const completions = bid?.stage_completions || {}
  const remarks = bid?.stage_remarks || {}
  const reviews = bid?.stage_reviews || {}

  const isInReview = reviews[stageKey] === true || (
    remarks[stageKey] && typeof remarks[stageKey] === 'string' && remarks[stageKey].startsWith('[Re-Verification]')
  )

  // EMD Processing has nothing to configure when EMD is exempted OR not applicable
  // for this tender — treat it as auto-done so it doesn't block later stages from
  // unlocking. The two are distinct facts (exempted = EMD required but excused;
  // not applicable = tender has no EMD clause at all) so callers that need to
  // label this state get `emdSkipReason` to tell them apart.
  const isEmdExempt = stageKey === 'EMD_PROCESSING' && !!(bid?.emd_exempted || bid?.emd_not_applicable)
  const emdSkipReason = stageKey === 'EMD_PROCESSING'
    ? (bid?.emd_not_applicable ? 'NOT_APPLICABLE' : bid?.emd_exempted ? 'EXEMPTED' : null)
    : null

  // Stage 1 (DISCOVERED) is completed by default upon tender creation unless explicitly set to false
  // NOTE: the terminal-state fallback below only backfills stages *before* the
  // current one (stageIdx < currentIdx) — never the current stage itself. A WON
  // or LOST outcome recorded at Financial Evaluation sets bid_status to that
  // terminal value immediately, while workflow_stage advances to Award &
  // Handover for its own separate closing checklist (PO/BG/Delivery/EMD or the
  // EMD Return workspace) — using <= here would have force-completed that
  // stage before its real closing action ever ran.
  const isCompleted = completions[stageKey] === true || (
    stageKey === 'DISCOVERED' && completions['DISCOVERED'] !== false
  ) || isEmdExempt || (isTerminal && stageIdx < currentIdx && completions[stageKey] !== false)

  const isCurrent = stageIdx === currentIdx && !isTerminal && !isEmdExempt

  // Stage Locking:
  // 1. OEM Authorization / Pricing Request / Document Checklist Prep / EMD
  //    Processing are locked until the Account Manager completes Primary
  //    Review — but NOT sequentially gated against each other (they stay
  //    parallel-accessible once unlocked, matching how the team actually
  //    works them).
  // 2. From Bid Submission onwards, every prior stage must actually be
  //    complete (looked up by name, not a hardcoded index, so inserting a
  //    stage earlier in the pipeline can't silently shift this boundary).
  let isLocked = false
  const primaryReviewDone = completions['PRIMARY_REVIEW'] === true
  if (!isTerminal && STAGES_GATED_BY_PRIMARY_REVIEW.includes(stageKey) && !primaryReviewDone) {
    isLocked = true
  }
  const gemSubmissionIdx = WORKFLOW_STAGES_ORDERED.indexOf('GEM_SUBMISSION')
  if (!isLocked && stageIdx >= gemSubmissionIdx && !isTerminal) {
    for (let i = 0; i < stageIdx; i++) {
      const priorKey = WORKFLOW_STAGES_ORDERED[i]
      const priorDone = completions[priorKey] === true || priorKey === 'DISCOVERED' || (priorKey === 'EMD_PROCESSING' && !!(bid?.emd_exempted || bid?.emd_not_applicable))
      if (!priorDone) {
        isLocked = true
        break
      }
    }
  }

  return { isCompleted, isCurrent, isLocked, isInReview, isEmdExempt, emdSkipReason, currentIdx, stageIdx }
}

export function ReVerificationModal({ title, stageKey, bidId, bid, onClose, onComplete }) {
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!remarks.trim()) {
      toast.error('Re-verification remarks are required')
      return
    }
    setSubmitting(true)
    try {
      // IMPORTANT: We patch stage_completions directly WITHOUT moving workflow_stage.
      // This ensures higher completed stages are NOT reset.
      const currentCompletions = { ...(bid?.stage_completions || {}) }
      currentCompletions[stageKey] = false

      const currentRemarks = { ...(bid?.stage_remarks || {}) }
      currentRemarks[stageKey] = `[Re-Verification]: ${remarks}`

      const currentReviews = { ...(bid?.stage_reviews || {}) }
      currentReviews[stageKey] = true

      const res = await updateBid(bidId, {
        stage_completions: currentCompletions,
        stage_remarks: currentRemarks,
        stage_reviews: currentReviews,
      })
      if (res.ok) {
        logStageInteraction(bidId, stageKey, `[Re-Verification Flagged]: ${remarks}`, null)
        toast.success(`Stage "${stageKey.replace(/_/g, ' ')}" marked for re-verification. Workflow stage unchanged.`)
        if (onComplete) onComplete()
      } else {
        toast.error(res.error?.message || 'Failed to mark stage for re-verification')
      }
      onClose()
    } catch {
      toast.error('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <RefreshCw className="size-5 text-amber-500" />
          <h3 className="text-base font-semibold font-heading text-foreground">{title || 'Mark Stage for Re-Verification'}</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          This will flag <strong>{stageKey.replace(/_/g, ' ')}</strong> for re-inspection. The workflow stage and all other stage completions will remain <strong>unchanged</strong>.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Reason for Re-Verification / Review *</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="State the findings, discrepancies, or reasons for re-verification..."
              className="text-xs min-h-[90px]"
              required
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button type="submit" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white gap-2" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Flagging...</span>
                </>
              ) : (
                'Confirm & Mark for Review'
              )}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

export function StageHeaderActions({ bid, stageKey, onCompleteClick, onRefresh, completeLabel = "Complete & Advance", completeClass = "", disabled = false, disabledTooltip = "" }) {
  const [showReVerify, setShowReVerify] = useState(false)
  const { isCompleted } = checkStageState(bid, stageKey)
  const remarks = bid?.stage_remarks || {}
  const reviews = bid?.stage_reviews || {}
  const isInReview = reviews[stageKey] === true || (remarks[stageKey] && typeof remarks[stageKey] === 'string' && remarks[stageKey].startsWith('[Re-Verification]'))

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {isInReview ? (
        <>
          <span className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-100 via-orange-100 to-rose-100 dark:from-amber-950 dark:via-orange-950 dark:to-rose-950 text-orange-950 dark:text-orange-200 font-extrabold text-xs flex items-center gap-1.5 border border-orange-300 dark:border-orange-700 shadow-xs">
            <AlertTriangle className="size-3.5 text-orange-600 dark:text-orange-400 animate-pulse" /> Marked for Review
          </span>
          <Button size="sm" onClick={onCompleteClick} className="gap-2 shadow-sm text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
            <CheckCircle2 className="size-4" /> Resolve Review & Mark Success
          </Button>
        </>
      ) : isCompleted ? (
        <>
          <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-semibold text-xs flex items-center gap-1.5 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" /> Stage Completed
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowReVerify(true)}
            className="gap-1.5 border-orange-300 text-orange-900 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-950/40 text-xs font-medium"
          >
            <RefreshCw className="size-3.5 text-orange-600" /> Mark for Re-Verification
          </Button>
        </>
      ) : (
        <span title={disabled ? disabledTooltip : undefined}>
          <Button size="sm" onClick={onCompleteClick} disabled={disabled} className={`gap-2 shadow-sm text-xs ${disabled ? 'opacity-50 cursor-not-allowed' : completeClass}`}>
            <CheckCircle2 className="size-4" /> {completeLabel}
          </Button>
        </span>
      )}

      {showReVerify && (
        <ReVerificationModal
          title={`Mark ${stageKey.replace(/_/g, ' ')} for Re-Verification`}
          stageKey={stageKey}
          bidId={bid.id}
          bid={bid}
          onClose={() => setShowReVerify(false)}
          onComplete={onRefresh}
        />
      )}
    </div>
  )
}

// ── Stage 1: Tender Search & Identification ─────────────────────────────────
export function Stage1Workspace({ bid, onRefresh }) {
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300">Stage 1: Tender Search & Identification</h3>
          <p className="text-xs text-blue-700 dark:text-blue-400">Review core specifications, high-level scope, and initialize eligibility assessment.</p>
        </div>
        <StageHeaderActions
          bid={bid}
          stageKey="DISCOVERED"
          onCompleteClick={() => setShowModal(true)}
          onRefresh={onRefresh}
          completeLabel="Mark Completed & Notify Pre-Sales"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Scope & Overview</h4>
          <div className="space-y-2 text-xs">
            <div><span className="text-muted-foreground block">Title:</span> <span className="font-semibold text-foreground">{bid.title}</span></div>
            <div><span className="text-muted-foreground block">GeM Bid No:</span> <span className="font-mono text-primary font-medium">{bid.gem_bid_no || 'N/A'}</span></div>
            <div><span className="text-muted-foreground block">High Level Scope:</span> <p className="mt-1 text-foreground bg-muted/40 p-2.5 rounded border border-border/50 leading-relaxed">{bid.high_level_scope || 'No detailed scope provided during creation.'}</p></div>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Account & Financials</h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Account Name:</span><span className="font-medium text-foreground">{bid.organization_name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Department:</span><span className="font-medium text-foreground">{bid.department_name || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Estimated Value:</span><span className="font-bold text-foreground">{fmtMoney(bid.estimated_value)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">EMD Required:</span><span className="font-medium text-foreground">{bid.emd_not_applicable ? 'Not Applicable' : bid.emd_exempted ? 'Exempted' : fmtMoney(bid.emd_amount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Ending Date:</span><span className="font-medium text-foreground">{fmtDate(bid.closing_date)}</span></div>
          </div>
        </div>
      </div>

      {showModal && (
        <CompleteStageModal
          title="Complete Stage 1: Search & Identification"
          description="Marks Stage 1 as complete and alerts the Account Manager that Primary Review is ready."
          stageKey="DISCOVERED"
          bidId={bid.id}
          bid={bid}
          onClose={() => setShowModal(false)}
          onComplete={async () => {
            try {
              const { createAlert } = await import('../../services/alerts')
              if (bid.account_manager?.id) {
                await createAlert({
                  user_id: bid.account_manager.id,
                  bid_id: bid.id,
                  type: 'INFO',
                  title: `Ready for Primary Review — ${bid.title}`,
                  message: `<p>Tender ${bid.gem_bid_no || bid.id} has been identified and is ready for your Primary Review (Go/No-Go).</p>${buildTenderDetailHtml(bid)}`,
                })
              }
            } catch {}
            toast.success('Account Manager alerted!')
            onRefresh()
          }}
        />
      )}
    </div>
  )
}

// ── Stage 2: Primary Review ──────────────────────────────────────────────────
// The Account Manager's Go/No-Go gate. Go unlocks OEM Authorization, Pricing
// Request, Document Checklist Prep, and EMD Processing (see the
// STAGES_GATED_BY_PRIMARY_REVIEW check in checkStageState above); No-Go
// cancels the tender via the existing recordBidOutcome flow. Pre-Sales (if
// assigned) gets its own tab to map each requested product to an OEM — that
// tab's "mark done" is informational only and does not advance the stage.
function NoGoModal({ bid, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!reason.trim()) { toast.error('A reason is required to cancel the tender'); return }
    setSubmitting(true)
    try {
      const res = await recordBidOutcome(bid.id, { bid_outcome: 'CANCELLED', outcome_reason: reason.trim() })
      if (!res.ok) {
        toast.error(res.error?.message || 'Failed to cancel tender')
        return
      }
      logStageInteraction(bid.id, 'PRIMARY_REVIEW', `[No-Go] Tender cancelled at Primary Review: ${reason.trim()}`)
      toast.success('Tender marked No-Go and cancelled')
      onDone()
    } catch {
      toast.error('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
          <Ban className="size-5" />
          <h3 className="text-base font-semibold font-heading text-foreground">No-Go — Cancel Tender</h3>
        </div>
        <p className="text-xs text-muted-foreground">This cancels the tender. This cannot be undone from here — a cancelled tender can only be revived by an Admin.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Reason for No-Go *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this tender not being pursued?" className="text-xs min-h-[80px]" required />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button type="submit" size="sm" disabled={submitting} className="gap-2 bg-rose-600 hover:bg-rose-700 text-white">
              {submitting ? <><Loader2 className="size-3.5 animate-spin" /> Cancelling...</> : 'Confirm No-Go'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

function EmdDecisionModal({ bid, onClose, onDone }) {
  // Only offer the modes the tender document actually raised at Add/Edit
  // Tender time — Online/DD are "available" when their fields were filled in,
  // exemption is available when at least one criterion was ticked. Not
  // Applicable always stays as a fallback override for a mistaken raw capture.
  const hasOnline = !!bid.emd_bank_name
  const hasDD = !!bid.emd_beneficiary
  const rawExemptionTypes = Array.isArray(bid.emd_exemption_types) ? bid.emd_exemption_types : []
  const hasExemption = rawExemptionTypes.length > 0
  const availableModes = [
    ...(hasOnline ? ['ONLINE'] : []),
    ...(hasDD ? ['DD'] : []),
    ...(hasExemption ? ['EXEMPTED'] : []),
    'NOT_APPLICABLE',
  ]
  const exemptionChoices = hasExemption ? rawExemptionTypes : ['MSME', 'STARTUP', 'OTHER']

  const [emdType, setEmdType] = useState(() => {
    if (bid.emd_not_applicable) return 'NOT_APPLICABLE'
    if (bid.emd_exempted) return 'EXEMPTED'
    if (bid.emd_type && availableModes.includes(bid.emd_type)) return bid.emd_type
    return availableModes[0] || 'NOT_APPLICABLE'
  })
  const [exemptionType, setExemptionType] = useState(bid.emd_exemption_type || '')
  const [exemptionReason, setExemptionReason] = useState(bid.emd_exemption_reason || '')
  const [bankName, setBankName] = useState(bid.emd_bank_name || '')
  const [accountNumber, setAccountNumber] = useState(bid.emd_account_number || '')
  const [ifscCode, setIfscCode] = useState(bid.emd_ifsc_code || '')
  const [branch, setBranch] = useState(bid.emd_branch || '')
  const [beneficiary, setBeneficiary] = useState(bid.emd_beneficiary || '')
  const [payableAt, setPayableAt] = useState(bid.emd_payable_at || '')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (emdType === 'EXEMPTED' && !exemptionType) { toast.error('Select the exemption criterion (MSME / Startup / Other)'); return }
    if (emdType === 'EXEMPTED' && exemptionType === 'OTHER' && !exemptionReason.trim()) { toast.error('Specify the reason for the Other exemption'); return }
    if (emdType === 'ONLINE' && (!bankName.trim() || !accountNumber.trim() || !ifscCode.trim())) { toast.error('Bank name, account number, and IFSC code are required for Online EMD'); return }
    if (emdType === 'DD' && (!beneficiary.trim() || !payableAt.trim())) { toast.error('Beneficiary and payable-at location are required for DD EMD'); return }
    setSubmitting(true)
    try {
      const payload = {
        emd_not_applicable: emdType === 'NOT_APPLICABLE',
        emd_exempted: emdType === 'EXEMPTED',
        emd_type: emdType === 'EXEMPTED' || emdType === 'NOT_APPLICABLE' ? bid.emd_type || 'ONLINE' : emdType,
        emd_exemption_type: emdType === 'EXEMPTED' ? exemptionType : '',
        emd_exemption_reason: emdType === 'EXEMPTED' && exemptionType === 'OTHER' ? exemptionReason.trim() : '',
        emd_bank_name: emdType === 'ONLINE' ? bankName.trim() : bid.emd_bank_name || '',
        emd_account_number: emdType === 'ONLINE' ? accountNumber.trim() : bid.emd_account_number || '',
        emd_ifsc_code: emdType === 'ONLINE' ? ifscCode.trim() : bid.emd_ifsc_code || '',
        emd_branch: emdType === 'ONLINE' ? branch.trim() : bid.emd_branch || '',
        emd_beneficiary: emdType === 'DD' ? beneficiary.trim() : bid.emd_beneficiary || '',
        emd_payable_at: emdType === 'DD' ? payableAt.trim() : bid.emd_payable_at || '',
      }
      const res = await updateBid(bid.id, payload)
      if (!res.ok) { toast.error(res.error?.message || 'Failed to save EMD decision'); return }
      logStageInteraction(bid.id, 'PRIMARY_REVIEW', `EMD decision confirmed: ${emdType}${exemptionType ? ` (${exemptionType})` : ''}`)
      toast.success('EMD decision saved')
      onDone()
    } catch {
      toast.error('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-xl space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center gap-2 text-foreground">
          <Coins className="size-5 text-amber-600" />
          <h3 className="text-base font-semibold font-heading">Confirm EMD Decision</h3>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">EMD Mode</Label>
            <div className="flex flex-wrap gap-2">
              {availableModes.map((t) => (
                <button key={t} type="button" onClick={() => setEmdType(t)}
                  className={`text-xs px-3 py-1.5 rounded-md border font-medium transition-colors ${emdType === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input text-foreground hover:bg-muted/50'}`}>
                  {t === 'ONLINE' ? 'Online Payment' : t === 'DD' ? 'DD (Demand Draft)' : t === 'EXEMPTED' ? 'Exempted' : 'Not Applicable'}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">Only the modes ticked on this tender at Add/Edit Tender time are offered here.</p>
          </div>
          {emdType === 'ONLINE' && (
            <div className="space-y-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <p className="text-xs font-semibold text-blue-800 dark:text-blue-200">Bank Details *</p>
              <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Bank Name" className="text-xs h-8" />
              <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Account Number" className="text-xs h-8" />
              <Input value={ifscCode} onChange={(e) => setIfscCode(e.target.value.toUpperCase())} placeholder="IFSC Code" className="text-xs h-8" />
              <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Branch (if required)" className="text-xs h-8" />
            </div>
          )}
          {emdType === 'DD' && (
            <div className="space-y-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">DD Details *</p>
              <Input value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} placeholder="Beneficiary" className="text-xs h-8" />
              <Input value={payableAt} onChange={(e) => setPayableAt(e.target.value)} placeholder="Payable At" className="text-xs h-8" />
            </div>
          )}
          {emdType === 'EXEMPTED' && (
            <div className="space-y-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">Exemption Basis *</p>
              <div className="flex flex-wrap items-center gap-4">
                {exemptionChoices.map((t) => (
                  <label key={t} className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-foreground">
                    <input type="radio" name="pr_emd_exemption" checked={exemptionType === t} onChange={() => setExemptionType(t)} className="accent-primary" />
                    {t === 'OTHER' ? 'Other' : t === 'STARTUP' ? 'Startup' : t === 'MSME' ? 'MSME' : t}
                  </label>
                ))}
              </div>
              {exemptionType === 'OTHER' && (
                <Input value={exemptionReason} onChange={(e) => setExemptionReason(e.target.value)} placeholder="Specify the reason" className="text-xs h-8" />
              )}
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button type="submit" size="sm" disabled={submitting} className="gap-2">
              {submitting ? <><Loader2 className="size-3.5 animate-spin" /> Saving...</> : 'Confirm EMD Decision'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

function AssignPresalesModal({ bid, users, onClose, onDone }) {
  const [presalesId, setPresalesId] = useState(bid.presales?.id || '')
  const [submitting, setSubmitting] = useState(false)
  const presalesUsers = users.filter(u => Array.isArray(u.roles) && u.roles.includes('PRE_SALES'))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!presalesId) { toast.error('Select a Pre-Sales user'); return }
    setSubmitting(true)
    try {
      const res = await updateBid(bid.id, { presales_id: presalesId })
      if (!res.ok) { toast.error(res.error?.message || 'Failed to assign Pre-Sales'); return }
      const person = presalesUsers.find(u => u.id === presalesId)
      logStageInteraction(bid.id, 'PRIMARY_REVIEW', `Pre-Sales assigned: ${person?.full_name || presalesId}`)
      toast.success('Pre-Sales assigned — they have been notified')
      onDone()
    } catch {
      toast.error('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-foreground">
          <Users className="size-5 text-violet-600" />
          <h3 className="text-base font-semibold font-heading">{bid.presales ? 'Reassign Pre-Sales' : 'Assign Pre-Sales'}</h3>
        </div>
        {bid.presales && (
          <div className="px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900 text-xs">
            <span className="text-muted-foreground">Currently assigned: </span>
            <span className="font-semibold text-foreground">{bid.presales.full_name}</span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{bid.presales ? 'Reassign To *' : 'Pre-Sales User *'}</Label>
            {presalesUsers.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No users hold the Pre-Sales role yet.</p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                {presalesUsers.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-xs cursor-pointer p-2 rounded-md border border-border/60 hover:bg-muted/40">
                    <input type="radio" name="pr_presales" checked={presalesId === u.id} onChange={() => setPresalesId(u.id)} className="accent-primary" />
                    {u.full_name}
                    {bid.presales?.id === u.id && (
                      <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400">(current)</span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button type="submit" size="sm" disabled={submitting || presalesUsers.length === 0} className="gap-2">
              {submitting ? <><Loader2 className="size-3.5 animate-spin" /> Assigning...</> : 'Assign'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// Who completed a given stage, and when — read back from the shared stage
// history (every CompleteStageModal submission logs a STAGE_CHANGE event via
// logStageInteraction), rather than a stage-specific field. Same technique
// Stage6Workspace already uses for "who alerted Finance", generalized so
// Stage3 (OEM Authorization) and Stage8 (Internal Approval) can show the
// same "completed by / on" line instead of leaving the completion silent.
function useStageCompletedBy(bidId, stageKey, enabled) {
  const [completedBy, setCompletedBy] = useState(null)
  useEffect(() => {
    if (!enabled) { setCompletedBy(null); return }
    let cancelled = false
    // limit: 200 — this scans for one specific event, not a page to render,
    // so it needs a generous window rather than the default page size.
    getBidStageHistory(bidId, { limit: 200 }).then((res) => {
      if (cancelled || !res.ok) return
      // res.data is newest-first (server-paginated, see getBidStageHistory).
      const entries = (res.data || []).filter(
        (h) => h.to_stage === stageKey && h.event_type === 'STAGE_CHANGE'
      )
      const last = entries[0]
      if (last?.transitioned_by) {
        setCompletedBy({
          name: last.transitioned_by.full_name || last.transitioned_by.username || 'someone',
          at: last.created_at,
        })
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [bidId, stageKey, enabled])
  return completedBy
}

function fmtEmdSummary(bid) {
  if (bid.emd_not_applicable) return 'Not Applicable'
  if (bid.emd_exempted) {
    const base = `Exempted (${bid.emd_exemption_type || '—'})`
    return bid.emd_exemption_type === 'OTHER' && bid.emd_exemption_reason ? `${base}: ${bid.emd_exemption_reason}` : base
  }
  return bid.emd_type === 'DD' ? 'DD (Demand Draft)' : 'Online Payment'
}

export function Stage2PrimaryReviewWorkspace({ bid, onRefresh }) {
  const { user: currentUser, isAdmin } = usePermissions()
  const { users, loadUsers } = useBidStore()
  useEffect(() => { loadUsers() }, [loadUsers])

  const isAssignedAM = !!currentUser?.id && currentUser.id === bid?.account_manager?.id
  const isAssignedPresales = !!currentUser?.id && currentUser.id === bid?.presales?.id
  const canManageAM = isAssignedAM || isAdmin
  const canManagePresales = isAssignedPresales || isAdmin
  // Once Go is recorded (stage complete), No-Go no longer applies here — cancelling
  // an already-approved tender goes through the top-right "Cancel Tender" action instead.
  const primaryReviewCompleted = bid?.stage_completions?.PRIMARY_REVIEW === true

  const [activeTab, setActiveTab] = useState((isAssignedPresales && !canManageAM) ? 'presales' : 'account_manager')
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [showNoGoModal, setShowNoGoModal] = useState(false)
  const [showEmdModal, setShowEmdModal] = useState(false)
  const [showAssignPresalesModal, setShowAssignPresalesModal] = useState(false)

  const products = Array.isArray(bid.requested_products) ? bid.requested_products : []
  const primaryReview = bid.primary_review && typeof bid.primary_review === 'object' ? bid.primary_review : {}
  // Each product gets a list of OEM candidates (name + remarks + an optional
  // "suggested" flag), not a single string — backward-compatible with old
  // tenders whose saved value is still a bare string (normalizeOemCandidates
  // wraps it as one suggested candidate).
  const [presalesCands, setPresalesCands] = useState(() => buildPresalesCands(products, primaryReview))
  const presalesCompleted = !!primaryReview.presalesCompleted

  // Resync when bid.primary_review changes after mount (a refresh, or
  // another session's edit) — without this, a refresh updates the
  // surrounding chrome (option lists, "Finalized" badge) but leaves the
  // actual candidate rows frozen at whatever they were on mount.
  useEffect(() => {
    setPresalesCands(buildPresalesCands(products, primaryReview))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bid.primary_review, bid.requested_products])

  const addCand = (i) => setPresalesCands(prev => prev.map((rows, j) => j === i ? [...rows, { id: nextLocalId(), oem: '', remarks: '', suggested: false }] : rows))
  const rmCand = (i, id) => setPresalesCands(prev => prev.map((rows, j) => j === i ? rows.filter(r => r.id !== id) : rows))
  const updCand = (i, id, field, value) => setPresalesCands(prev => prev.map((rows, j) => j === i ? rows.map(r => r.id === id ? { ...r, [field]: value } : r) : rows))
  const toggleSuggested = (i, id) => setPresalesCands(prev => prev.map((rows, j) => j === i ? rows.map(r => ({ ...r, suggested: r.id === id ? !r.suggested : false })) : rows))

  const savePresalesOems = async (next, markComplete) => {
    const map = {}
    next.forEach((rows, i) => {
      const clean = rows.filter(r => r.oem.trim()).map(({ id, ...rest }) => ({ ...rest, oem: rest.oem.trim() }))
      if (clean.length) map[i] = clean
    })
    const payload = {
      ...primaryReview,
      presalesProducts: map,
      ...(markComplete !== undefined ? {
        presalesCompleted: markComplete,
        presalesCompletedAt: markComplete ? new Date().toISOString() : '',
        presalesCompletedBy: markComplete ? (currentUser?.full_name || currentUser?.username || '') : '',
      } : {}),
    }
    const res = await updateBid(bid.id, { primary_review: JSON.stringify(payload) })
    if (!res.ok) { toast.error(res.error?.message || 'Failed to save'); return false }
    return true
  }

  const handleSaveOems = async () => {
    const ok = await savePresalesOems(presalesCands)
    if (ok) { toast.success('OEM mapping saved'); onRefresh() }
  }

  const handleTogglePresalesComplete = async () => {
    const ok = await savePresalesOems(presalesCands, !presalesCompleted)
    if (ok) {
      logStageInteraction(bid.id, 'PRIMARY_REVIEW', presalesCompleted ? 'Pre-Sales reopened their OEM mapping' : 'Pre-Sales marked their Primary Review task complete')
      toast.success(presalesCompleted ? 'Marked as in progress again' : 'Marked your part complete')
      onRefresh()
    }
  }

  // Account Manager's per-product final OEM pick, finalized separately from
  // Pre-Sales' candidate list below (see the "Finalize Product OEMs" card).
  const [amPicks, setAmPicks] = useState(() => products.map((p, i) => (primaryReview.amOemSelections || {})[i] || ''))
  const [amPickOther, setAmPickOther] = useState(() => products.map(() => false))
  // Same resync need as presalesCands above — otherwise a refresh leaves the
  // AM's dropdown selections frozen at mount even though the dropdown's own
  // option list (built straight off primaryReview) updates fine.
  useEffect(() => {
    setAmPicks(products.map((p, i) => (primaryReview.amOemSelections || {})[i] || ''))
    setAmPickOther(products.map(() => false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bid.primary_review, bid.requested_products])
  const amOemComplete = products.length === 0 || products.every((p, i) => !!(primaryReview.amOemSelections || {})[i])

  const handleSaveAmOems = async () => {
    const map = {}
    amPicks.forEach((v, i) => { if (v && v.trim()) map[i] = v.trim() })
    const payload = {
      ...primaryReview,
      amOemSelections: map,
      amOemFinalizedAt: new Date().toISOString(),
      amOemFinalizedBy: currentUser?.full_name || currentUser?.username || '',
    }
    const res = await updateBid(bid.id, { primary_review: JSON.stringify(payload) })
    if (!res.ok) { toast.error(res.error?.message || 'Failed to save'); return }
    logStageInteraction(bid.id, 'PRIMARY_REVIEW', 'Account Manager finalized the product→OEM selections')
    toast.success('OEM selections saved')
    onRefresh()
  }

  const showTabs = !!bid.presales

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900/50 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-rose-900 dark:text-rose-300">Stage 2: Primary Review</h3>
          <p className="text-xs text-rose-700 dark:text-rose-400">Account Manager Go/No-Go — unlocks OEM Authorization, Pricing, Document Checklist &amp; EMD Processing.</p>
        </div>
        <StageHeaderActions
          bid={bid}
          stageKey="PRIMARY_REVIEW"
          onCompleteClick={() => setShowCompleteModal(true)}
          onRefresh={onRefresh}
          completeLabel="Mark Primary Review Complete"
          disabled={!canManageAM || !amOemComplete}
          disabledTooltip={!canManageAM ? 'Only the assigned Account Manager (or an Admin) can complete Primary Review.' : 'Finalize the OEM for every product before completing Primary Review.'}
        />
      </div>

      {showTabs && (
        <div className="flex gap-1 border-b border-border/60">
          <button onClick={() => setActiveTab('account_manager')}
            className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'account_manager' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            Account Manager
          </button>
          <button onClick={() => setActiveTab('presales')}
            className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'presales' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            Pre-Sales
            {presalesCompleted && <CheckCircle2 className="size-3.5 text-emerald-500" />}
          </button>
        </div>
      )}

      {(!showTabs || activeTab === 'account_manager') && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-border bg-card space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tender Overview</h4>
              <div className="space-y-2 text-xs">
                <div><span className="text-muted-foreground block">Title:</span> <span className="font-semibold text-foreground">{bid.title}</span></div>
                <div><span className="text-muted-foreground block">Account Name:</span> <span className="font-medium text-foreground">{bid.organization_name || '—'}</span></div>
                <div><span className="text-muted-foreground block">Department:</span> <span className="font-medium text-foreground">{bid.department_name || '—'}</span></div>
                <div><span className="text-muted-foreground block">Location:</span> <span className="font-medium text-foreground">{bid.location || '—'}</span></div>
                <div><span className="text-muted-foreground block">Category:</span> <span className="font-medium text-foreground">{bid.category || '—'}</span></div>
              </div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Financials</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Estimated Value:</span><span className="font-bold text-foreground">{fmtMoney(bid.estimated_value)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">EMD Amount:</span><span className="font-medium text-foreground">{bid.emd_not_applicable ? 'Not Applicable' : fmtMoney(bid.emd_amount)}</span></div>
                {!bid.emd_not_applicable && (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">EMD Online:</span><span className="font-medium text-foreground">{bid.emd_bank_name ? `Offered — ${bid.emd_bank_name}` : 'Not Offered'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">EMD DD:</span><span className="font-medium text-foreground">{bid.emd_beneficiary ? `Offered — ${bid.emd_beneficiary}` : 'Not Offered'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Exemptions Listed:</span><span className="font-medium text-foreground">{(bid.emd_exemption_types || []).length ? bid.emd_exemption_types.join(', ') : 'None'}</span></div>
                  </>
                )}
                <div className="flex justify-between border-t border-border/60 pt-2 mt-1"><span className="text-muted-foreground">AM Decision:</span><span className="font-semibold text-foreground">{(bid.emd_type || bid.emd_exempted || bid.emd_not_applicable) ? fmtEmdSummary(bid) : 'Pending'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">BG Required:</span><span className="font-medium text-foreground">{bid.bg_required ? `Yes — ${bid.bg_rate ?? '—'}%${bid.bg_duration_months ? `, ${bid.bg_duration_months} mo` : ''}` : 'No'}</span></div>
              </div>
            </div>
          </div>

          {products.length > 0 && (
            <div className="p-4 rounded-xl border border-border bg-card space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Products/Services Asked in the RFP</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product/Service</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-20">Qty</TableHead>
                    <TableHead>OEM</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>{p.product || '—'}</TableCell>
                      <TableCell>{p.description || '—'}</TableCell>
                      <TableCell>{p.qty || '—'}</TableCell>
                      <TableCell>{resolveProductOem(bid, i) || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {products.length > 0 && (
            <div className="p-4 rounded-xl border border-border bg-card space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Finalize Product OEMs</h4>
                {primaryReview.amOemFinalizedAt && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Finalized {fmtDate(primaryReview.amOemFinalizedAt)}
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {products.map((p, i) => {
                  const cands = normalizeOemCandidates(primaryReview.presalesProducts?.[i])
                  const isOther = amPickOther[i] || (amPicks[i] && !cands.some(c => c.oem === amPicks[i]))
                  return (
                    <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="text-xs font-medium text-foreground sm:w-40 shrink-0">{p.product || `Product ${i + 1}`}</span>
                      <select
                        className="h-8 text-xs bg-background border border-input rounded-md px-2 flex-1"
                        disabled={!canManageAM}
                        value={isOther ? '__other' : (amPicks[i] || '')}
                        onChange={(e) => {
                          const v = e.target.value
                          setAmPickOther(prev => prev.map((x, j) => j === i ? v === '__other' : x))
                          if (v !== '__other') setAmPicks(prev => prev.map((x, j) => j === i ? v : x))
                        }}
                      >
                        <option value="">Select OEM…</option>
                        {cands.map((c) => (
                          <option key={c.oem} value={c.oem}>{c.oem}{c.suggested ? ' — suggested by Pre-Sales' : ''}</option>
                        ))}
                        <option value="__other">Other…</option>
                      </select>
                      {isOther && (
                        <Input
                          value={amPicks[i] || ''}
                          onChange={(e) => setAmPicks(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                          placeholder="Enter OEM name"
                          disabled={!canManageAM}
                          className="h-8 text-xs bg-background sm:w-48"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-end">
                <span title={!canManageAM ? 'Only the assigned Account Manager (or an Admin) can act here' : undefined}>
                  <Button size="sm" disabled={!canManageAM} onClick={handleSaveAmOems} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-semibold disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none">Save OEM Selections</Button>
                </span>
              </div>
            </div>
          )}

          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Account Manager Actions</h4>
            <div className="flex flex-wrap gap-2">
              <span title={!canManageAM ? 'Only the assigned Account Manager (or an Admin) can act here' : undefined}>
                <Button size="sm" variant="outline" disabled={!canManageAM} onClick={() => setShowEmdModal(true)} className="gap-1.5 text-xs">
                  <Coins className="size-3.5" /> {bid.emd_type || bid.emd_exempted || bid.emd_not_applicable ? 'Update EMD Details' : 'Set EMD Decision'}
                </Button>
              </span>
              <span title={!canManageAM ? 'Only the assigned Account Manager (or an Admin) can act here' : undefined}>
                <Button size="sm" variant="outline" disabled={!canManageAM} onClick={() => setShowAssignPresalesModal(true)} className="gap-1.5 text-xs">
                  <Users className="size-3.5" /> {bid.presales ? 'Reassign Pre-Sales' : 'Assign Pre-Sales'}
                </Button>
              </span>
              {!primaryReviewCompleted && (
                <span title={!canManageAM ? 'Only the assigned Account Manager (or an Admin) can act here' : undefined}>
                  <Button size="sm" variant="outline" disabled={!canManageAM} onClick={() => setShowNoGoModal(true)} className="gap-1.5 text-xs border-rose-300 text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-800 dark:hover:bg-rose-950/40">
                    <Ban className="size-3.5" /> No-Go — Cancel Tender
                  </Button>
                </span>
              )}
            </div>
            {primaryReviewCompleted && (
              <p className="text-[11px] text-muted-foreground italic">Go was recorded for this tender — to cancel it now, use "Cancel Tender" at the top of the page.</p>
            )}
            {bid.presales && (
              <p className="text-xs text-muted-foreground">Pre-Sales: <span className="font-semibold text-foreground">{bid.presales.full_name}</span>{presalesCompleted && <span className="text-emerald-600 dark:text-emerald-400"> — marked their part complete{primaryReview.presalesCompletedAt ? ` on ${fmtDate(primaryReview.presalesCompletedAt)}` : ''}</span>}</p>
            )}
          </div>
        </div>
      )}

      {showTabs && activeTab === 'presales' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Map Each Product to an OEM</h4>
              {presalesCompleted && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">Marked Complete</span>
              )}
            </div>
            {products.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No products were added to this tender at creation time.</p>
            ) : (
              <div className="space-y-4">
                {products.map((p, i) => (
                  <div key={i} className="rounded-lg border border-border/70 p-3 space-y-2">
                    <div className="flex items-baseline justify-between gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-foreground">{p.product || `Product ${i + 1}`}</span>
                      <span className="text-[11px] text-muted-foreground">{p.description || '—'} {p.qty ? `· Qty ${p.qty}` : ''}</span>
                    </div>
                    <div className="space-y-1.5">
                      {(presalesCands[i] || []).map((c) => (
                        <div key={c.id} className={`flex items-center gap-1.5 p-1.5 rounded-md border ${c.suggested ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800' : 'border-transparent'}`}>
                          <input
                            type="checkbox"
                            checked={c.suggested}
                            onChange={() => toggleSuggested(i, c.id)}
                            disabled={!canManagePresales}
                            title="Suggested by Pre-Sales"
                            className="size-3.5 accent-amber-500 shrink-0"
                          />
                          <Input
                            value={c.oem}
                            onChange={(e) => updCand(i, c.id, 'oem', e.target.value)}
                            placeholder="OEM name"
                            disabled={!canManagePresales}
                            className="h-8 text-xs bg-background flex-1 min-w-[100px]"
                          />
                          <Input
                            value={c.remarks}
                            onChange={(e) => updCand(i, c.id, 'remarks', e.target.value)}
                            placeholder="Remarks (optional)"
                            disabled={!canManagePresales}
                            className="h-8 text-xs bg-background flex-1 min-w-[120px]"
                          />
                          <button type="button" onClick={() => rmCand(i, c.id)} disabled={!canManagePresales}
                            className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0">
                            <XCircle className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <Button type="button" size="sm" variant="outline" disabled={!canManagePresales} onClick={() => addCand(i)} className="h-7 text-[11px] gap-1">
                      <Plus className="size-3" /> Add OEM
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <span title={!canManagePresales ? 'Only the assigned Pre-Sales user (or an Admin) can act here' : undefined}>
                <Button size="sm" variant="outline" disabled={!canManagePresales || products.length === 0} onClick={handleSaveOems} className="text-xs">Save</Button>
              </span>
              <span title={!canManagePresales ? 'Only the assigned Pre-Sales user (or an Admin) can act here' : undefined}>
                <Button size="sm" disabled={!canManagePresales} onClick={handleTogglePresalesComplete}
                  className={`text-xs gap-1.5 ${presalesCompleted ? '' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                  variant={presalesCompleted ? 'outline' : 'default'}>
                  <CheckCircle2 className="size-3.5" /> {presalesCompleted ? 'Reopen' : 'Mark My Part Complete'}
                </Button>
              </span>
            </div>
          </div>
        </div>
      )}

      {showCompleteModal && (
        <CompleteStageModal
          title="Complete Primary Review"
          description="Marks Primary Review complete and unlocks OEM Authorization, Pricing Request, Document Checklist Preparation, and EMD Processing."
          stageKey="PRIMARY_REVIEW"
          bidId={bid.id}
          bid={bid}
          onClose={() => setShowCompleteModal(false)}
          onComplete={async () => {
            try {
              const { createAlert } = await import('../../services/alerts')
              await createAlert({
                user_id: bid.created_by,
                bid_id: bid.id,
                type: 'INFO',
                title: `Primary Review Complete — ${bid.title}`,
                message: `Primary Review is complete for '${bid.title}'. EMD mode: ${fmtEmdSummary(bid)}. OEM Authorization, Pricing, Document Checklist, and EMD Processing are now unlocked.`,
              })
              if (bid.presales?.id) {
                await createAlert({
                  user_id: bid.presales.id,
                  bid_id: bid.id,
                  type: 'INFO',
                  title: `Tender Approved — ${bid.title}`,
                  message: `The Account Manager has approved '${bid.title}' at Primary Review. Please review and verify your OEM mapping.`,
                })
              }
            } catch {}
            toast.success('Primary Review complete — pipeline unlocked!')
            onRefresh()
          }}
        />
      )}

      {showNoGoModal && (
        <NoGoModal bid={bid} onClose={() => setShowNoGoModal(false)} onDone={() => { setShowNoGoModal(false); onRefresh() }} />
      )}

      {showEmdModal && (
        <EmdDecisionModal bid={bid} onClose={() => setShowEmdModal(false)} onDone={() => { setShowEmdModal(false); onRefresh() }} />
      )}

      {showAssignPresalesModal && (
        <AssignPresalesModal bid={bid} users={users} onClose={() => setShowAssignPresalesModal(false)} onDone={() => { setShowAssignPresalesModal(false); onRefresh() }} />
      )}
    </div>
  )
}

// ── Stage 2: Eligibility Assessment ─────────────────────────────────────────
// ── Helper to extract follow-up array safely ──────────────────────────────────
function getOemFollowUps(oem) {
  if (!oem) return []
  const user = tokenStorage.getUser()
  const activeUserLabel = user?.full_name || user?.username || 'Super Admin'

  if (Array.isArray(oem.followUps) && oem.followUps.length > 0) {
    return oem.followUps.map(fu => ({
      ...fu,
      loggedBy: (!fu.loggedBy || fu.loggedBy === 'System' || fu.loggedBy === 'system') ? activeUserLabel : fu.loggedBy
    }))
  }
  if (oem.followUp && typeof oem.followUp === 'string' && oem.followUp.trim() !== '') {
    return [
      {
        id: `legacy-${oem.id || Date.now()}`,
        date: oem.followUp,
        remarks: oem.remark || 'Follow-up date scheduled/recorded',
        loggedBy: activeUserLabel,
        createdAt: new Date().toISOString()
      }
    ]
  }
  return []
}

// ── OEM Follow-up Log History Modal Component ─────────────────────────────────
function OEMFollowUpModal({ oem, bidId, onClose, onSaveFollowUps }) {
  const initialFollowUps = useMemo(() => getOemFollowUps(oem), [oem])
  const [followUps, setFollowUps] = useState(initialFollowUps)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])
  const [newDate, setNewDate] = useState(todayStr)
  const [newRemarks, setNewRemarks] = useState('')

  const handleAddFollowUp = (e) => {
    e.preventDefault()
    if (!newDate) {
      toast.error('Follow-up date is required')
      return
    }
    if (newDate > todayStr) {
      toast.error('Follow-up date cannot be a future date (maximum allowed date is today)')
      return
    }
    const user = tokenStorage.getUser()
    const currentUserLabel = user?.full_name || user?.username || 'Super Admin'
    
    const newEntry = {
      id: `fu-${Date.now()}`,
      date: newDate,
      remarks: newRemarks.trim() || `Follow-up #${followUps.length + 1} recorded`,
      loggedBy: currentUserLabel,
      createdAt: new Date().toISOString()
    }

    const updated = [newEntry, ...followUps]
    setFollowUps(updated)
    setNewRemarks('')

    const latestDate = newEntry.date
    onSaveFollowUps(oem.id, updated, latestDate)

    logStageMicroEvent(bidId, {
      fromStage: 'OEM_AUTHORIZATION_REQUEST',
      toStage: 'OEM_AUTHORIZATION_REQUEST',
      eventType: 'OEM',
      transitionReason: `Logged Follow-up #${updated.length} for OEM "${oem.name}" (Date: ${newDate})`,
      details: {
        oem_name: oem.name,
        follow_up_date: newDate,
        follow_up_remarks: newEntry.remarks,
        total_follow_ups: updated.length
      }
    })

    toast.success(`Follow-up #${updated.length} logged for "${oem.name}"`)
  }

  const handleDeleteFollowUp = (fuId) => {
    const updated = followUps.filter(f => f.id !== fuId)
    setFollowUps(updated)
    const latestDate = updated.length > 0 ? updated[0].date : ''
    onSaveFollowUps(oem.id, updated, latestDate)
    toast.success('Follow-up log entry removed')
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-xl bg-card border-border shadow-2xl p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="p-5 bg-purple-50/80 dark:bg-purple-950/40 border-b border-purple-200/60 dark:border-purple-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-600 text-white shadow-md">
              <History className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold font-heading text-purple-950 dark:text-purple-200">
                OEM Follow-up Tracking Log
              </DialogTitle>
              <DialogDescription className="text-xs text-purple-700 dark:text-purple-400 mt-0.5">
                Manage multiple follow-up dates &amp; interaction notes for <strong className="text-purple-900 dark:text-purple-100">{oem?.name}</strong>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* New Follow-up Form */}
          <form onSubmit={handleAddFollowUp} className="p-4 rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-950/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Plus className="size-3.5 text-purple-600" /> Log New Follow-up
              </span>
              <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50 px-2.5 py-0.5 rounded-full">
                Total Logged: {followUps.length}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1 sm:col-span-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">Follow-up Date *</Label>
                <Input
                  type="date"
                  max={todayStr}
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="h-8 text-xs font-mono bg-background"
                  required
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[11px] font-semibold text-muted-foreground">Remarks / Response Note</Label>
                <Input
                  value={newRemarks}
                  onChange={e => setNewRemarks(e.target.value)}
                  placeholder="e.g. Sent 2nd reminder email / Phone call with OEM head..."
                  className="h-8 text-xs bg-background"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button type="submit" size="sm" className="h-8 text-xs gap-1.5 bg-purple-600 hover:bg-purple-700 text-white shadow-sm font-semibold">
                <Plus className="size-3.5" /> Record Follow-up Entry
              </Button>
            </div>
          </form>

          {/* Timeline History */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Follow-up History Log</span>
              <span className="text-[11px] font-normal text-muted-foreground">Chronological Timeline</span>
            </h4>

            {followUps.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-border rounded-xl bg-muted/20 text-muted-foreground">
                <Clock className="size-6 text-muted-foreground/40 mx-auto mb-1.5" />
                <p className="text-xs font-medium">No follow-ups logged yet for {oem?.name}.</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Record your first follow-up using the input form above.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {followUps.map((fu, idx) => {
                  const currentUser = tokenStorage.getUser()
                  const activeUserLabel = currentUser?.full_name || currentUser?.username || 'Super Admin'
                  const displayAuthor = (!fu.loggedBy || fu.loggedBy === 'System' || fu.loggedBy === 'system') ? activeUserLabel : fu.loggedBy

                  return (
                    <div key={fu.id || idx} className="p-3.5 rounded-xl border border-border bg-card shadow-2xs hover:border-purple-300 dark:hover:border-purple-800 transition-all space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200">
                            Follow-up #{followUps.length - idx}
                          </span>
                          <span className="font-mono text-xs font-bold text-foreground flex items-center gap-1">
                            <Calendar className="size-3 text-purple-600" />
                            {fu.date}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded">
                            by {displayAuthor}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteFollowUp(fu.id)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-muted transition-colors"
                            title="Delete follow-up entry"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-foreground font-medium leading-relaxed bg-muted/30 p-2.5 rounded-lg border border-border/40">
                        {fu.remarks || 'No remarks added.'}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="p-4 bg-muted/40 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">
            💡 All follow-up logs are synced to the workspace database.
          </span>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Done &amp; Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Stage 3: OEM Authorization Request ─────────────────────────────────────
export function Stage3Workspace({ bid, onRefresh }) {
  const key = `onetrack_oem_${bid.id}`
  // Declared early (used as a guard by the sync effect right below) rather
  // than lower with the rest of the UI state — while the matrix is open for
  // editing, a background refresh must not clobber in-progress row edits.
  const [isEditing, setIsEditing] = useState(false)

  // Initialize: DB value (bid.oem_workspace) takes priority, then localStorage cache
  const [oems, setOems] = useState(() => {
    if (bid.oem_workspace) {
      if (Array.isArray(bid.oem_workspace)) return bid.oem_workspace
      if (typeof bid.oem_workspace === 'object' && Array.isArray(bid.oem_workspace.oems)) return bid.oem_workspace.oems
    }
    try {
      const saved = localStorage.getItem(key)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) return parsed
      }
    } catch (_) {}
    return []
  })

  // Sync state if bid.oem_workspace changes from background sync or onRefresh.
  // Skipped while the matrix is open for editing — a refresh landing mid-edit
  // (another session's change, or this session's own header refresh button)
  // must not silently discard in-progress row edits.
  useEffect(() => {
    if (isEditing) return
    if (bid.oem_workspace) {
      let serverOems = null
      if (Array.isArray(bid.oem_workspace)) {
        serverOems = bid.oem_workspace
      } else if (typeof bid.oem_workspace === 'object' && Array.isArray(bid.oem_workspace.oems)) {
        serverOems = bid.oem_workspace.oems
      }
      // Array.isArray (not a length check) — an empty array is a legitimate
      // "every row was deleted elsewhere" state and must propagate too.
      if (Array.isArray(serverOems)) {
        setOems(serverOems)
        localStorage.setItem(key, JSON.stringify(serverOems))
      }
    }
  }, [bid.oem_workspace, key, isEditing])

  // Rows are no longer added by hand — the sheet is kept in sync with
  // whatever the Account Manager has finalized in Primary Review. A local
  // "dismissed" set (mirrored into primary_review.oemRowsDismissed for
  // persistence) remembers rows the user deliberately deleted, so the sync
  // below doesn't immediately resurrect them. It's read from local state
  // rather than straight off `bid` so a delete takes effect on the very
  // next render, before the backend round-trip that persists it completes.
  const [dismissedNames, setDismissedNames] = useState(() => {
    const pr = (bid.primary_review && typeof bid.primary_review === 'object') ? bid.primary_review : {}
    return new Set((pr.oemRowsDismissed || []).map(n => n.trim().toLowerCase()))
  })
  useEffect(() => {
    const pr = (bid.primary_review && typeof bid.primary_review === 'object') ? bid.primary_review : {}
    const fromServer = (pr.oemRowsDismissed || []).map(n => n.trim().toLowerCase())
    if (!fromServer.length) return
    setDismissedNames(prev => {
      // Bail out to the same Set (no state change, no re-render) when there's
      // nothing new — every refresh gives bid.primary_review a fresh object
      // identity even with identical content, and a new Set here would
      // re-trigger the additive-sync effect below on every single refresh.
      const missing = fromServer.filter(n => !prev.has(n))
      if (!missing.length) return prev
      return new Set([...prev, ...missing])
    })
  }, [bid.primary_review])

  // Additive sync: every OEM the Account Manager has finalized gets a row on
  // this sheet if it doesn't have one already — not just the first time, so
  // a later addition in Primary Review still lands here without a manual
  // "Add OEM Row" step. Runs on every render where `oems` or the AM's
  // selections change; it's a no-op (checked via existingNames) once nothing
  // is missing, so it settles after one write instead of looping.
  useEffect(() => {
    const pr = (bid.primary_review && typeof bid.primary_review === 'object') ? bid.primary_review : {}
    const picks = [...new Set(Object.values(pr.amOemSelections || {}).filter(Boolean))]
    if (!picks.length) return
    const existingNames = new Set(oems.map(o => o.name.trim().toLowerCase()))
    const missing = picks.filter(n => !existingNames.has(n.trim().toLowerCase()) && !dismissedNames.has(n.trim().toLowerCase()))
    if (!missing.length) return
    const newRows = missing.map(n => makeOemRow(n, 'presales', ''))
    const rows = [...oems, ...newRows]
    setOems(rows)
    localStorage.setItem(key, JSON.stringify(rows))
    updateBid(bid.id, { oem_workspace: JSON.stringify(rows) }).then(() => { if (onRefresh) onRefresh() }).catch(() => {})
    logStageMicroEvent(bid.id, {
      fromStage: 'OEM_AUTHORIZATION_REQUEST',
      toStage: 'OEM_AUTHORIZATION_REQUEST',
      eventType: 'OEM',
      transitionReason: `Auto-created ${newRows.length} OEM row(s) from the Account Manager's finalized selections`,
      details: { oems: missing },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bid.primary_review, bid.id, oems, dismissedNames])

  const [showModal, setShowModal] = useState(false)
  const [activeFollowUpOem, setActiveFollowUpOem] = useState(null)
  const stageCompleted = bid?.stage_completions?.OEM_AUTHORIZATION_REQUEST === true
  const completedBy = useStageCompletedBy(bid.id, 'OEM_AUTHORIZATION_REQUEST', stageCompleted)

  // Awaitable — a caller that immediately follows a save with onRefresh()
  // (a GET) must wait for this PATCH to actually land first, or the GET can
  // win the race and the sync effect above overwrites the just-saved edit
  // with pre-save data.
  const saveOems = async (list) => {
    setOems(list)
    localStorage.setItem(key, JSON.stringify(list))
    try {
      await updateBid(bid.id, { oem_workspace: JSON.stringify(list) })
    } catch (err) {
      console.error('Failed to save OEM workspace to backend:', err)
    }
  }

  const updateOemField = (id, field, value) => {
    setOems(prev => prev.map(o => o.id === id ? { ...o, [field]: value } : o))
  }

  const handleSaveFollowUpsForOem = (oemId, newFollowUps, latestDate) => {
    setOems(prev => {
      const nextList = prev.map(o => {
        if (o.id === oemId) {
          return {
            ...o,
            followUps: newFollowUps,
            followUp: latestDate || o.followUp || ''
          }
        }
        return o
      })
      saveOems(nextList)
      return nextList
    })
  }

  const handleSaveMatrix = async () => {
    await saveOems(oems)
    setIsEditing(false)
    logStageMicroEvent(bid.id, {
      fromStage: 'OEM_AUTHORIZATION_REQUEST',
      toStage: 'OEM_AUTHORIZATION_REQUEST',
      eventType: 'OEM',
      transitionReason: `Saved OEM Authorization Matrix updates (${oems.length} OEM entries tracked)`,
      details: { oems }
    })
    // Bidirectional sync: the linked Document Checklist item is complete only
    // once EVERY tracked OEM has that document RECEIVED — with 2+ OEMs a
    // single "yes" doesn't mean the requirement is satisfied for all of
    // them, so this can't complete on just one row being RECEIVED. The
    // reverse direction lives in ChecklistTab. Collected and awaited so the
    // follow-up onRefresh() below can't race ahead of these writes either.
    const checklistSyncs = []
    oemChecklistItems.forEach(col => {
      const shouldBeDone = oems.length > 0 && oems.every(o => (o.docStatus || {})[col.id] === 'RECEIVED')
      if (!!col.is_done !== shouldBeDone) {
        checklistSyncs.push(toggleChecklist(bid.id, col.id, shouldBeDone).catch(() => {}))
      }
    })
    if (mafChecklistItem) {
      const mafShouldBeDone = oems.length > 0 && oems.every(o => o.maf === 'RECEIVED')
      if (!!mafChecklistItem.is_done !== mafShouldBeDone) {
        checklistSyncs.push(toggleChecklist(bid.id, mafChecklistItem.id, mafShouldBeDone).catch(() => {}))
      }
    }
    await Promise.all(checklistSyncs)
    toast.success('OEM Authorization Matrix saved successfully')
    if (onRefresh) await onRefresh()
  }

  const deleteOem = (id) => {
    const target = oems.find(o => o.id === id)
    const updated = oems.filter(o => o.id !== id)
    saveOems(updated)
    if (target?.name) {
      const normalized = target.name.trim().toLowerCase()
      setDismissedNames(prev => new Set([...prev, normalized]))
      const pr = (bid.primary_review && typeof bid.primary_review === 'object') ? bid.primary_review : {}
      const nextDismissed = [...new Set([...(pr.oemRowsDismissed || []), target.name])]
      updateBid(bid.id, { primary_review: JSON.stringify({ ...pr, oemRowsDismissed: nextDismissed }) }).catch(() => {})
    }
    logStageMicroEvent(bid.id, {
      fromStage: 'OEM_AUTHORIZATION_REQUEST',
      toStage: 'OEM_AUTHORIZATION_REQUEST',
      eventType: 'OEM',
      transitionReason: `Deleted OEM authorization entry for "${target?.name || 'OEM'}"`,
      details: { oem_name: target?.name }
    })
    toast.success('OEM removed')
  }

  const getStageStatus = (o) => {
    const allDocsReceived = docColumns.length > 0 && docColumns.every(col => getDocStatus(o, col) === 'RECEIVED')
    if (allDocsReceived) return { label: 'Permission to Proceed', cls: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300' }
    if (o.initiated === 'YES') return { label: 'Initiated (MAF Pending)', cls: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300' }
    return { label: 'Not Started', cls: 'bg-muted text-muted-foreground border-border' }
  }

  // MAF is always tracked (GlobX requires it for every OEM regardless of the
  // tender's own checklist). Every other document column is driven live by
  // this tender's OEM checklist — add one there and it appears here; delete
  // it there and it disappears here. (The checklist item titled like "MAF
  // ..." is excluded from the dynamic list so it doesn't duplicate the fixed
  // MAF column.) Deleting a checklist item never touches stage/audit history
  // — that trail is append-only and unaffected by this.
  const oemChecklistItems = (bid.checklists || [])
    .filter(c => (c.checklist_group === 'OEM' || c.title.startsWith('[OEM]')) && !/\bmaf\b/i.test(c.title))
    .map(c => ({ ...c, title: c.title.replace(/^\[OEM\]\s*/, '') }))
  // The checklist item behind the fixed MAF column above — kept separate
  // from oemChecklistItems (which excludes it) so Save Matrix can still
  // back-sync it to the Document Checklist tab, matching every other OEM doc.
  const mafChecklistItem = (bid.checklists || [])
    .find(c => (c.checklist_group === 'OEM' || c.title.startsWith('[OEM]')) && /\bmaf\b/i.test(c.title))
  const docColumns = [
    { id: 'maf', title: 'MAF Cert', legacy: true },
    ...oemChecklistItems.map(c => ({ id: c.id, title: c.title, legacy: false })),
  ]
  const getDocStatus = (o, col) => col.legacy ? (o[col.id] || 'NOT RECEIVED') : ((o.docStatus || {})[col.id] || 'NOT RECEIVED')
  const setDocStatus = (oemId, col, value) => {
    if (col.legacy) { updateOemField(oemId, col.id, value); return }
    setOems(prev => prev.map(o => o.id === oemId ? { ...o, docStatus: { ...(o.docStatus || {}), [col.id]: value } } : o))
  }

  // Pre-Sales' own current product→OEM mapping (Primary Review), if they've
  // ever saved one — the thing that can go stale when they revise it. Deliberately
  // excludes the tender's static requested_products.oem seed value: that's
  // fixed metadata from Add/Edit Tender time, not something Pre-Sales
  // actively maintains, so a matrix row matching only that seed was never
  // actually "confirmed" by a Pre-Sales mapping in the first place.
  const presalesConfirmedNames = useMemo(() => {
    const pr = (bid.primary_review && typeof bid.primary_review === 'object') ? bid.primary_review : {}
    // presalesProducts values are now arrays of {oem,remarks,suggested}
    // candidates (previously a single string) — flatten through the shared
    // normalizer rather than Object.values() directly, which would put
    // whole candidate arrays into the Set instead of OEM name strings. An
    // Account-Manager-finalized pick counts as confirmed too.
    const cands = Object.values(pr.presalesProducts || {}).flatMap(v => normalizeOemCandidates(v).map(c => c.oem))
    return new Set([...cands, ...Object.values(pr.amOemSelections || {})].filter(Boolean))
  }, [bid.primary_review])

  const totalOEMs = oems.length
  const totalFollowUpsCount = useMemo(() => {
    return oems.reduce((acc, o) => acc + getOemFollowUps(o).length, 0)
  }, [oems])
  const docsCompleteCount = useMemo(() => {
    if (docColumns.length === 0) return 0
    return oems.filter(o => docColumns.every(col => getDocStatus(o, col) === 'RECEIVED')).length
  }, [oems, docColumns])
  const compliantCount = useMemo(() => {
    return oems.filter(o => o.compliance === 'COMPLIANT').length
  }, [oems])

  return (
    <div className="space-y-6">
      {/* Stage Header */}
      <div className="p-4.5 rounded-2xl border border-purple-200/90 bg-purple-50/60 dark:bg-purple-950/30 dark:border-purple-900/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-600 text-white shadow-xs">
              <ShieldCheck className="size-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-purple-950 dark:text-purple-200">Stage 3: OEM Authorization Matrix</h3>
              <p className="text-xs text-purple-700 dark:text-purple-400 mt-0.5">Track MAF, MII, certificates, multiple follow-up logs, and OEM clarifications.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isEditing ? (
            <Button size="sm" onClick={handleSaveMatrix} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm text-xs font-semibold">
              <CheckCircle2 className="size-4" /> Save Matrix
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="gap-1.5 border-purple-300 text-purple-900 dark:text-purple-200 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-xs font-medium">
              <Edit2 className="size-3.5" /> Edit Matrix
            </Button>
          )}
        </div>
      </div>

      {/* OEM Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
            <Building2 className="size-4" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">OEMs Tracked</div>
            <div className="text-base font-extrabold text-foreground font-mono">{totalOEMs}</div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20 shadow-2xs flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-600 text-white shadow-2xs">
            <History className="size-4" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-purple-800 dark:text-purple-300 uppercase tracking-wider">Total Follow-ups</div>
            <div className="text-base font-extrabold text-purple-950 dark:text-purple-100 font-mono">{totalFollowUpsCount} Logged</div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-4" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Docs Complete</div>
            <div className="text-base font-extrabold text-foreground font-mono">{docsCompleteCount} / {totalOEMs}</div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
            <ShieldCheck className="size-4" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">OEM Compliant</div>
            <div className="text-base font-extrabold text-foreground font-mono">{compliantCount} / {totalOEMs}</div>
          </div>
        </div>
      </div>

      {/* OEM Authorization Tracking Sheet */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-foreground flex items-center gap-2">
              <ShieldCheck className="size-4 text-purple-600" /> OEM Authorization Tracking Sheet
            </h4>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-bold border border-purple-200">
              Multiple Follow-up System
            </span>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            {isEditing ? '✏️ EDITING MODE ACTIVE' : '🔒 READ ONLY (Click "Edit Matrix" to modify)'}
          </span>
        </div>

        {/* Clean, Formatted & Spacious Table */}
        <div className="overflow-x-auto rounded-xl border border-border/80 shadow-2xs">
          <table className="w-full text-xs text-left border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-muted/70 text-muted-foreground font-bold text-[11px] border-b border-border">
                <th className="p-3 text-center w-12 border-r border-border/60">S.No</th>
                <th className="p-3 border-r border-border/60 min-w-[150px]">OEM Name</th>
                <th className="p-3 border-r border-border/60 min-w-[160px]">OEM Contact</th>
                <th className="p-3 text-center border-r border-border/60 min-w-[120px]">Initiated By</th>
                {docColumns.map(col => (
                  <th key={col.id} className="p-3 text-center border-r border-border/60">{col.title}</th>
                ))}
                <th className="p-3 text-center border-r border-border/60 min-w-[110px]">OEM Compliance</th>
                <th className="p-3 border-r border-border/60 bg-purple-50/50 dark:bg-purple-950/20 text-purple-900 dark:text-purple-300 min-w-[180px]">
                  <div className="flex items-center gap-1">
                    <History className="size-3 text-purple-600" />
                    <span>Follow-up History &amp; Logs</span>
                  </div>
                </th>
                <th className="p-3 border-r border-border/60 min-w-[130px]">Remarks</th>
                <th className="p-3 text-center border-r border-border/60">Stage Status</th>
                {isEditing && <th className="p-3 text-center w-12">Del</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {oems.length === 0 ? (
                <tr>
                  <td colSpan={8 + docColumns.length + (isEditing ? 1 : 0)} className="p-8 text-center text-muted-foreground italic">
                    <Building2 className="size-8 text-muted-foreground/30 mx-auto mb-2" />
                    No OEM authorization rows recorded yet. Finalize the product OEM selections in Primary Review to populate this sheet automatically.
                  </td>
                </tr>
              ) : (
                oems.map((o, idx) => {
                  const st = getStageStatus(o)
                  const fus = getOemFollowUps(o)
                  const followUpCount = fus.length
                  const latestFollowUpDate = fus.length > 0 ? fus[0].date : (o.followUp || '')

                  return (
                    <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                      {/* S.No */}
                      <td className="p-3 text-center font-mono font-bold text-muted-foreground border-r border-border/60 bg-muted/10">{idx + 1}</td>

                      {/* OEM Name */}
                      <td className="p-3 font-bold text-foreground border-r border-border/60">
                        {isEditing ? (
                          <Input size="sm" value={o.name} onChange={e => updateOemField(o.id, 'name', e.target.value)} className="h-8 text-xs font-bold" />
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-extrabold text-foreground">{o.name}</span>
                            {o.origin === 'presales' && presalesConfirmedNames.size > 0 && !presalesConfirmedNames.has(o.name) && (
                              <span
                                className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                                title="No longer matches any current Pre-Sales product→OEM mapping — rename this row or leave it if it's still valid."
                              >
                                Unmapped
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* OEM Contact Person */}
                      <td className="p-3 border-r border-border/60">
                        {isEditing ? (
                          <div className="space-y-1">
                            <Input size="sm" value={o.contactName || ''} onChange={e => updateOemField(o.id, 'contactName', e.target.value)} placeholder="Contact name" className="h-7 text-xs" />
                            <Input size="sm" value={o.contactEmail || ''} onChange={e => updateOemField(o.id, 'contactEmail', e.target.value)} placeholder="Contact email" className="h-7 text-xs" />
                          </div>
                        ) : (
                          <div className="text-xs">
                            <div className="font-semibold text-foreground">{o.contactName || '—'}</div>
                            {o.contactEmail && <div className="text-muted-foreground">{o.contactEmail}</div>}
                          </div>
                        )}
                      </td>

                      {/* Process Initiated (by whom) */}
                      <td className="p-3 text-center border-r border-border/60">
                        {isEditing ? (
                          <select
                            value={o.initiated}
                            onChange={e => {
                              const value = e.target.value
                              updateOemField(o.id, 'initiated', value)
                              if (value === 'YES' && !o.initiatedByName) {
                                const cu = tokenStorage.getUser()
                                updateOemField(o.id, 'initiatedByName', cu?.full_name || cu?.username || '')
                              }
                            }}
                            className="h-7 text-xs border border-border rounded-md px-1.5 bg-background font-semibold">
                            <option value="YES">YES</option>
                            <option value="NO">NO</option>
                          </select>
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold border ${o.initiated === 'YES' ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-muted text-muted-foreground border-border'}`}>
                              {o.initiated}
                            </span>
                            {o.initiated === 'YES' && o.initiatedByName && (
                              <span className="text-[10px] text-muted-foreground font-medium">by {o.initiatedByName}</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Document status columns — dynamic, driven by this tender's OEM checklist items */}
                      {docColumns.map(col => (
                        <td key={col.id} className="p-3 text-center border-r border-border/60">
                          {isEditing ? (
                            <select value={getDocStatus(o, col)} onChange={e => setDocStatus(o.id, col, e.target.value)} className="h-7 text-xs border border-border rounded-md px-1.5 bg-background font-semibold">
                              <option value="NOT RECEIVED">NOT RECEIVED</option>
                              <option value="RECEIVED">RECEIVED</option>
                            </select>
                          ) : (
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold border ${getDocStatus(o, col) === 'RECEIVED' ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300'}`}>
                              {getDocStatus(o, col)}
                            </span>
                          )}
                        </td>
                      ))}

                      {/* OEM Compliance */}
                      <td className="p-3 text-center border-r border-border/60">
                        {isEditing ? (
                          <select value={o.compliance || 'NA'} onChange={e => updateOemField(o.id, 'compliance', e.target.value)} className="h-7 text-xs border border-border rounded-md px-1.5 bg-background font-semibold">
                            <option value="COMPLIANT">Compliant</option>
                            <option value="NOT_COMPLIANT">Not Compliant</option>
                            <option value="PARTIAL_COMPLIANT">Partial Compliant</option>
                            <option value="NA">NA</option>
                          </select>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold border whitespace-nowrap ${
                            o.compliance === 'COMPLIANT' ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : o.compliance === 'NOT_COMPLIANT' ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300'
                            : o.compliance === 'PARTIAL_COMPLIANT' ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-muted text-muted-foreground border-border'
                          }`}>
                            {o.compliance === 'COMPLIANT' ? 'Compliant' : o.compliance === 'NOT_COMPLIANT' ? 'Not Compliant' : o.compliance === 'PARTIAL_COMPLIANT' ? 'Partial' : 'NA'}
                          </span>
                        )}
                      </td>

                      {/* Follow-up Tracking Cell (Multiple Follow-ups Supported) */}
                      <td className="p-3 border-r border-border/60 bg-purple-50/20 dark:bg-purple-950/10">
                        <div className="flex flex-col gap-1.5 items-start">
                          <button
                            type="button"
                            onClick={() => setActiveFollowUpOem(o)}
                            className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-950/70 text-purple-900 dark:text-purple-200 border border-purple-300/80 dark:border-purple-800 hover:bg-purple-200 dark:hover:bg-purple-900 transition-all shadow-2xs group"
                            title="Click to view full follow-up history & log new follow-up"
                          >
                            <History className="size-3 text-purple-600 dark:text-purple-400 group-hover:rotate-45 transition-transform" />
                            <span>{followUpCount > 0 ? `${followUpCount} Follow-up${followUpCount > 1 ? 's' : ''}` : '+ Log Follow-up'}</span>
                            <ChevronRight className="size-3 opacity-60" />
                          </button>
                          
                          {latestFollowUpDate ? (
                            <span className="text-[10px] font-mono text-purple-900 dark:text-purple-300 flex items-center gap-1 font-semibold pl-0.5">
                              <Calendar className="size-3 text-purple-600" />
                              Latest: <span>{latestFollowUpDate}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] italic text-muted-foreground pl-0.5">No follow-ups logged</span>
                          )}
                        </div>
                      </td>

                      {/* Remarks */}
                      <td className="p-3 border-r border-border/60">
                        {isEditing ? (
                          <Input size="sm" value={o.remark} onChange={e => updateOemField(o.id, 'remark', e.target.value)} placeholder="Remark" className="h-7 text-xs" />
                        ) : (
                          <span className="text-xs text-muted-foreground font-medium">{o.remark || '—'}</span>
                        )}
                      </td>

                      {/* Stage Status */}
                      <td className="p-3 text-center border-r border-border/60">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold border whitespace-nowrap ${st.cls}`}>{st.label}</span>
                      </td>

                      {/* Action */}
                      {isEditing && (
                        <td className="p-3 text-center">
                          <button onClick={() => deleteOem(o.id)} className="text-destructive hover:bg-destructive/10 p-1.5 rounded-md transition-colors" title="Delete Row">
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stage completion action — kept separate from Edit/Save Matrix above to avoid confusion */}
      <div className="flex items-center justify-end gap-3">
        {stageCompleted && completedBy && (
          <span className="text-[11px] text-muted-foreground">
            Completed by <span className="font-semibold text-foreground">{completedBy.name}</span> on {fmtDate(completedBy.at)}
          </span>
        )}
        <StageHeaderActions
          bid={bid}
          stageKey="OEM_AUTHORIZATION_REQUEST"
          onCompleteClick={() => setShowModal(true)}
          onRefresh={onRefresh}
          completeLabel="Complete & Advance"
          completeClass="bg-purple-600 hover:bg-purple-700 text-white shadow-sm font-semibold"
        />
      </div>

      {/* OEM Follow-up Log History Modal */}
      {activeFollowUpOem && (
        <OEMFollowUpModal
          oem={activeFollowUpOem}
          bidId={bid.id}
          onClose={() => setActiveFollowUpOem(null)}
          onSaveFollowUps={handleSaveFollowUpsForOem}
        />
      )}

      {showModal && (
        <CompleteStageModal
          title="Complete OEM Authorization Stage"
          description="Marks Stage 3 as complete. Ensure all required MAF & MII certificates are received."
          stageKey="OEM_AUTHORIZATION_REQUEST"
          bidId={bid.id}
          bid={bid}
          onClose={() => setShowModal(false)}
          onComplete={onRefresh}
        />
      )}
    </div>
  )
}

// Shared L1-quote-plus-GST calculation, used by both Stage 4 (Pricing Request,
// where it's the live working calculation) and Stage 8 (Bid Submission, where
// it's a fallback for pricing sheets that were never sent through approval).
// Calculation sequence: Base Purchase Price -> Margin % (applied to Base) ->
// GlobX Unit Price Excl GST -> GST -> GlobX Unit Price w/GST -> GlobX Total.
function computeL1PricingSummary(pricingData, fallbackMarginPct = 2.45) {
  const marginPct = pricingData?.marginPct ?? fallbackMarginPct
  const allQuotes = pricingData?.quotes || []
  const l1Quote = allQuotes.length > 0 ? allQuotes.reduce((best, q) => {
    const tot = q.items.reduce((s, i) => s + (Number(i.basicPrice) || 0) * (Number(i.qty) || 1), 0)
    const bTot = best.items.reduce((s, i) => s + (Number(i.basicPrice) || 0) * (Number(i.qty) || 1), 0)
    return tot < bTot ? q : best
  }, allQuotes[0]) : null

  if (!l1Quote || !l1Quote.items || l1Quote.items.length === 0) {
    return { l1Quote, l1Calculations: null }
  }

  let grandBaseCost = 0
  let grandSellingExclGst = 0
  let grandGstAmount = 0
  let grandGlobxTotal = 0
  let grandTotalProfit = 0

  const items = l1Quote.items.map((it, idx) => {
    const qty = Number(it.qty) || 1
    const basicPrice = Number(it.basicPrice) || 0
    const itemMargin = it.marginPct != null && it.marginPct !== '' ? Number(it.marginPct) : marginPct
    const itemGstRate = it.gstPct != null && it.gstPct !== '' ? Number(it.gstPct) : 18

    const profitPerUnit = basicPrice * (itemMargin / 100)
    const unitPriceExclGst = basicPrice + profitPerUnit
    const unitGst = unitPriceExclGst * (itemGstRate / 100)
    const globxUnit = unitPriceExclGst + unitGst

    const totalBase = basicPrice * qty
    const totalSellingExclGst = unitPriceExclGst * qty
    const totalGst = unitGst * qty
    const globxTotal = globxUnit * qty
    const profitTotal = profitPerUnit * qty

    grandBaseCost += totalBase
    grandSellingExclGst += totalSellingExclGst
    grandGstAmount += totalGst
    grandGlobxTotal += globxTotal
    grandTotalProfit += profitTotal

    return {
      sNo: idx + 1, desc: it.desc, oem: it.oem || '', qty, basicPrice, itemMargin,
      profitPerUnit, unitPriceExclGst, itemGstRate, unitGst, globxUnit,
      totalBase, totalSellingExclGst, totalGst, globxTotal, profitTotal,
    }
  })

  const effectiveMarginPct = grandBaseCost > 0 ? (grandTotalProfit / grandBaseCost) * 100 : marginPct

  return {
    l1Quote,
    l1Calculations: {
      items, grandBaseCost, grandSellingExclGst, grandGstAmount,
      grandGlobxTotal, grandTotalProfit, effectiveMarginPct,
    },
  }
}

// Highlighted callouts shared by the pricing approval request, reminder, and
// approved alert/email bodies. Deliberately not red/green/blue — those read
// as pass/fail state elsewhere in the app — and kept as inline `style=`
// rather than Tailwind classes, since these strings are injected via
// dangerouslySetInnerHTML and mailed verbatim; a class name that only ever
// exists inside a runtime template literal is never emitted into the
// Tailwind build.
function buildRemarkCalloutHtml(name, text, label = 'Remarks') {
  if (!text) return ''
  return `<div style="margin:0 0 12px 0;padding:10px 14px;border-radius:8px;background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #f59e0b;color:#78350f;font-size:12px;"><strong style="color:#78350f;">⚑ ${label} from ${name}:</strong> ${text}</div>`
}
function buildValuesAdjustedBannerHtml(reqMargin, finalMargin, reqTotal, finalTotal) {
  return `<div style="margin:0 0 12px 0;padding:10px 14px;border-radius:8px;background:#f5f3ff;border:1px solid #ddd6fe;border-left:4px solid #8b5cf6;color:#5b21b6;font-size:12px;font-weight:600;">⚠ Values were adjusted before approval — Margin: ${Number(reqMargin).toFixed(2)}% → ${Number(finalMargin).toFixed(2)}%, GlobX Total (incl. GST): ${fmtMoney(reqTotal)} → ${fmtMoney(finalTotal)}</div>`
}

// Module scope (not just the useState initializer) so the resync effect
// below can reuse the exact same shape instead of redeclaring it.
const PRICING_DEFAULTS = {
  phase: 'INIT', // INIT | AWAITING | QUOTING | APPROVAL
  distNames: [],
  quotes: [], // [{id,distName,items:[{desc,qty,basicPrice}]}]
  selectedDist: '',
  // Single-approver pricing sign-off (replaces the old role-broadcast)
  approverId: '',
  approverName: '',
  approvalRequestedAt: '',
  approvalRemarks: '',
  approvalStatus: '', // '' | 'PENDING' | 'APPROVED'
  approvedAt: '',
  reminders: [], // [{ sentAt, sentBy }]
  marginPct: 2.45,
}

// ── Stage 4: Pricing Request ────────────────────────────────────────────────
export function Stage4Workspace({ bid, onRefresh }) {
  const { hasRole, user: currentUser, isAdmin } = usePermissions()
  // Presales can only VIEW Stage 4, not edit it — unless they also hold a
  // higher role (e.g. an Account Manager who has PRE_SALES as a secondary
  // role must still be able to edit pricing on their own tender).
  // Sending/managing pricing (request, quotes, approval routing) is the Bid
  // Executive's job. Account Manager only approves — their own "Approve
  // Pricing" action below is gated separately by canApprovePricing and isn't
  // affected by this flag.
  const isReadOnly = (hasRole('PRE_SALES') || hasRole('ACCOUNT_MANAGER')) && !hasRole('MANAGER') && !hasRole('BID_EXECUTIVE') && !isAdmin

  const { users, loadUsers } = useBidStore()
  useEffect(() => { loadUsers() }, [loadUsers])

  const key4 = `onetrack_pricing_${bid.id}`

  // Initialize: DB value (bid.pricing_workspace) takes priority, then localStorage cache
  const [pricingData, setPricingData] = useState(() => {
    // Prefer server-stored data (visible to all users)
    if (bid.pricing_workspace && typeof bid.pricing_workspace === 'object') {
      return { ...PRICING_DEFAULTS, ...bid.pricing_workspace }
    }
    // Fallback: local cache (for backward compat)
    try {
      const cached = localStorage.getItem(key4)
      if (cached) return { ...PRICING_DEFAULTS, ...JSON.parse(cached) }
    } catch (_) {}
    return PRICING_DEFAULTS
  })

  // Resync when bid.pricing_workspace changes after mount (a refresh, or
  // another session's edit) — without this, Pricing Request's whole UI
  // (phase, quotes, approval status, margin) stays frozen at whatever it was
  // when the stage tab was first opened, since the workspace is never
  // remounted on a bid refresh.
  useEffect(() => {
    if (bid.pricing_workspace && typeof bid.pricing_workspace === 'object') {
      const next = { ...PRICING_DEFAULTS, ...bid.pricing_workspace }
      setPricingData(next)
      localStorage.setItem(key4, JSON.stringify(next))
    }
  }, [bid.pricing_workspace, key4])

  const marginPct = pricingData.marginPct ?? 2.45

  const [showModal, setShowModal] = useState(false)
  const [showRequestDlg, setShowRequestDlg] = useState(false)
  const [showAddDistDlg, setShowAddDistDlg] = useState(false)
  const [showQuoteDlg, setShowQuoteDlg] = useState(false)
  const [showEditQuoteDlg, setShowEditQuoteDlg] = useState(false)
  const [editingQuoteId, setEditingQuoteId] = useState(null)
  const [showApprovalDlg, setShowApprovalDlg] = useState(false)
  const [showMarginDlg, setShowMarginDlg] = useState(false)
  const [approverSelId, setApproverSelId] = useState('')
  const [approvalRemarks, setApprovalRemarks] = useState('')
  const [quoteToDelete, setQuoteToDelete] = useState(null)
  const [newDistNameInput, setNewDistNameInput] = useState('')
  const [initDistNames, setInitDistNames] = useState('')
  const [addMoreDistNames, setAddMoreDistNames] = useState('')
  const [quoteDistSel, setQuoteDistSel] = useState('')
  const [quoteCustomName, setQuoteCustomName] = useState('')
  const [quoteItems, setQuoteItems] = useState([{ desc: '', qty: 1, basicPrice: '', marginPct: '', oem: '' }])
  const requestedProductNames = (bid.requested_products || []).map(p => p.product).filter(Boolean)
  // Selecting a product line-item seeds its quantity from what was actually
  // requested — the distributor is quoting against a known ask, not a blank
  // field — but the value stays a normal editable input afterward, since a
  // distributor's quote quantity can legitimately differ.
  const requestedProductQtyByName = Object.fromEntries(
    (bid.requested_products || []).filter(p => p.product && p.qty).map(p => [p.product, p.qty])
  )
  // Same idea, for the OEM finalized (or suggested) back in Primary Review —
  // seeded onto a line item the same way qty is, and used as a fallback for
  // rendering the OEM column on quotes saved before this field existed.
  const resolvedOemByProductName = Object.fromEntries(
    (bid.requested_products || [])
      .map((p, i) => [p.product, resolveProductOem(bid, i)])
      .filter(([n, o]) => n && o)
  )

  // Keep localStorage in sync as a fast cache, but source of truth is DB.
  // Awaitable — a caller that follows a save with onRefresh() (a GET) must
  // wait for this PATCH to land first, or the GET can win the race and
  // overwrite the just-saved edit with pre-save data.
  const save = async (upd) => {
    const next = { ...pricingData, ...upd }
    setPricingData(next)
    localStorage.setItem(key4, JSON.stringify(next))
    try {
      await updateBid(bid.id, { pricing_workspace: JSON.stringify(next) })
    } catch (err) {
      console.error('Failed to save pricing workspace to backend:', err)
    }
    return next
  }

  const handleSendRequest = () => {
    const names = initDistNames.split(',').map(s => s.trim()).filter(Boolean)
    if (!names.length) { toast.error('Enter at least one distributor name'); return }
    save({ phase: 'AWAITING', distNames: names })
    logStageMicroEvent(bid.id, {
      fromStage: 'PRICING_REQUEST',
      toStage: 'PRICING_REQUEST',
      eventType: 'PRICING',
      transitionReason: `Sent pricing request inquiry to ${names.length} distributor(s): ${names.join(', ')}`,
      details: { distNames: names }
    })
    setShowRequestDlg(false)
    setInitDistNames('')
    toast.success('Pricing request sent! Awaiting distributor response.')
  }

  const handleAddMoreDistributors = () => {
    const newNames = addMoreDistNames.split(',').map(s => s.trim()).filter(Boolean)
    if (!newNames.length) { toast.error('Enter at least one distributor name'); return }
    const merged = [...new Set([...pricingData.distNames, ...newNames])]
    save({ distNames: merged })
    logStageMicroEvent(bid.id, {
      fromStage: 'PRICING_REQUEST',
      toStage: 'PRICING_REQUEST',
      eventType: 'PRICING',
      transitionReason: `Added ${newNames.length} new distributor(s) to pricing request list: ${newNames.join(', ')}`,
      details: { newDistributors: newNames, totalDistributors: merged }
    })
    setShowAddDistDlg(false)
    setAddMoreDistNames('')
    toast.success(`Added ${newNames.length} distributor(s) to the request list`)
  }

  const handleOpenAddQuote = () => {
    setQuoteDistSel('')
    setQuoteCustomName('')
    // Seed one line per requested product instead of a single blank row, so
    // the user only has to fill in the base price per item — qty comes from
    // what was actually requested, OEM from the finalized Primary Review
    // pick (both already editable afterward, same as a manually typed row).
    const seeded = (bid.requested_products || [])
      .filter(p => p.product)
      .map(p => ({
        desc: p.product,
        qty: requestedProductQtyByName[p.product] ?? (p.qty || 1),
        basicPrice: '',
        marginPct: '',
        oem: resolvedOemByProductName[p.product] || '',
      }))
    setQuoteItems(seeded.length ? seeded : [{ desc: '', qty: 1, basicPrice: '', marginPct: '', oem: '' }])
    setShowQuoteDlg(true)
  }

  const handleAddQuote = () => {
    const effectiveName = quoteDistSel === 'Others' ? (quoteCustomName.trim() || 'Others') : (quoteDistSel || 'Others')
    if (!quoteItems.some(i => i.desc && i.basicPrice)) { toast.error('Fill at least one item'); return }
    const items = quoteItems.filter(i => i.desc && i.basicPrice).map(i => ({
      desc: i.desc, qty: Number(i.qty) || 1, basicPrice: Number(i.basicPrice) || 0,
      ...(i.marginPct !== '' && i.marginPct != null ? { marginPct: Number(i.marginPct) } : {}),
      ...(i.oem ? { oem: i.oem } : {}),
    }))
    const quotes = [...pricingData.quotes, { id: Date.now(), distName: effectiveName, items }]
    save({ phase: pricingData.phase === 'APPROVAL' ? 'APPROVAL' : 'QUOTING', quotes })
    logStageMicroEvent(bid.id, {
      fromStage: 'PRICING_REQUEST',
      toStage: 'PRICING_REQUEST',
      eventType: 'PRICING',
      transitionReason: `Recorded commercial quotation from distributor "${effectiveName}" with ${items.length} line item(s)`,
      details: { distName: effectiveName, itemsCount: items.length }
    })
    setShowQuoteDlg(false)
    setQuoteDistSel('')
    setQuoteCustomName('')
    setQuoteItems([{ desc: '', qty: 1, basicPrice: '', marginPct: '', oem: '' }])
    toast.success('Distributor quote added')
  }

  const handleOpenEditQuote = (q) => {
    setEditingQuoteId(q.id)
    if (pricingData.distNames.includes(q.distName)) {
      setQuoteDistSel(q.distName)
      setQuoteCustomName('')
    } else {
      setQuoteDistSel('Others')
      setQuoteCustomName(q.distName)
    }
    setQuoteItems(q.items.map(i => ({ desc: i.desc, qty: i.qty, basicPrice: i.basicPrice, marginPct: i.marginPct ?? '', oem: i.oem || '' })))
    setShowEditQuoteDlg(true)
  }

  const handleUpdateQuote = () => {
    const effectiveName = quoteDistSel === 'Others' ? (quoteCustomName.trim() || 'Others') : (quoteDistSel || 'Others')
    if (!quoteItems.some(i => i.desc && i.basicPrice)) { toast.error('Fill at least one item'); return }
    const items = quoteItems.filter(i => i.desc && i.basicPrice).map(i => ({
      desc: i.desc, qty: Number(i.qty) || 1, basicPrice: Number(i.basicPrice) || 0,
      ...(i.marginPct !== '' && i.marginPct != null ? { marginPct: Number(i.marginPct) } : {}),
      ...(i.oem ? { oem: i.oem } : {}),
    }))
    const updatedQuotes = pricingData.quotes.map(q => q.id === editingQuoteId ? { ...q, distName: effectiveName, items } : q)
    save({ quotes: updatedQuotes })
    logStageMicroEvent(bid.id, {
      fromStage: 'PRICING_REQUEST',
      toStage: 'PRICING_REQUEST',
      eventType: 'PRICING',
      transitionReason: `Updated commercial quotation for distributor "${effectiveName}" with ${items.length} line item(s)`,
      details: { distName: effectiveName, itemsCount: items.length }
    })
    setShowEditQuoteDlg(false)
    setEditingQuoteId(null)
    setQuoteDistSel('')
    setQuoteCustomName('')
    setQuoteItems([{ desc: '', qty: 1, basicPrice: '', marginPct: '', oem: '' }])
    toast.success('Distributor quote updated successfully')
  }

  const handleDeleteQuote = (quoteId, distName) => {
    setQuoteToDelete({ id: quoteId, distName })
  }

  const confirmDeleteQuote = async () => {
    if (!quoteToDelete) return
    const { id: quoteId, distName } = quoteToDelete
    const updatedQuotes = pricingData.quotes.filter(q => q.id !== quoteId)
    await save({ quotes: updatedQuotes })
    logStageMicroEvent(bid.id, {
      fromStage: 'PRICING_REQUEST',
      toStage: 'PRICING_REQUEST',
      eventType: 'PRICING',
      transitionReason: `Deleted commercial quotation for distributor "${distName}"`,
      details: { distName, quoteId, remainingQuotesCount: updatedQuotes.length }
    })
    setQuoteToDelete(null)
    toast.success(`Deleted distributor quote from "${distName}"`)
    if (typeof onRefresh === 'function') await onRefresh()
  }

  const buildPricingTableHtml = (l1Q, margin) => {
    if (!l1Q || !l1Q.items) return ''

    let grandBasePurchase = 0
    let grandSellingExclGst = 0
    let grandTotalGst = 0
    let grandGlobxTotal = 0
    let grandTotalProfit = 0

    const rowsHtml = l1Q.items.map((it, i) => {
      const basic = Number(it.basicPrice) || 0
      const qty = Number(it.qty) || 1
      const itMargin = it.marginPct != null && it.marginPct !== '' ? Number(it.marginPct) : margin
      const itGstPct = it.gstPct != null && it.gstPct !== '' ? Number(it.gstPct) : 18

      const profitPerUnit = basic * (itMargin / 100)
      const unitPriceExclGst = basic + profitPerUnit
      const unitGst = unitPriceExclGst * (itGstPct / 100)
      const globxUnit = unitPriceExclGst + unitGst
      const totalBase = basic * qty
      const globxTotal = globxUnit * qty
      const profitTotal = profitPerUnit * qty
      const totalGst = unitGst * qty

      grandBasePurchase += totalBase
      grandSellingExclGst += unitPriceExclGst * qty
      grandTotalGst += totalGst
      grandGlobxTotal += globxTotal
      grandTotalProfit += profitTotal

      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 10px; text-align: center; font-weight: bold; color: #64748b; font-family: monospace;">${i + 1}</td>
          <td style="padding: 8px 10px; font-weight: 600; color: #1e293b;">${it.desc}</td>
          <td style="padding: 8px 10px; text-align: center; color: #334155; font-weight: 500;">${qty}</td>
          <td style="padding: 8px 10px; text-align: right; font-family: monospace; color: #475569;">${fmtMoney(basic)}</td>
          <td style="padding: 8px 10px; text-align: center; color: #4338ca; font-weight: 700;">${itMargin}%</td>
          <td style="padding: 8px 10px; text-align: right; font-family: monospace; color: #334155;">${fmtMoney(unitPriceExclGst)}</td>
          <td style="padding: 8px 10px; text-align: right; font-family: monospace; color: #64748b;">${fmtMoney(unitGst)} <span style="font-size:10px;color:#94a3b8;">(${itGstPct}%)</span></td>
          <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-weight: 700; color: #4f46e5;">${fmtMoney(globxUnit)}</td>
          <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-weight: 700; color: #4f46e5; background-color: #f5f3ff;">${fmtMoney(globxTotal)}</td>
        </tr>
      `
    }).join('')

    const effectiveMargin = grandBasePurchase > 0 ? ((grandTotalProfit / grandBasePurchase) * 100).toFixed(2) : margin

    return `
      <div style="margin-top: 14px; margin-bottom: 14px; border: 1px solid #c7d2fe; border-radius: 10px; overflow: hidden; background-color: #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); padding: 12px 16px; color: #ffffff; font-size: 13px; font-weight: 700; display: flex; justify-content: space-between; align-items: center;">
          <span>📊 Commercial Pricing Breakdown (Base → Margin → Unit Price w/ GST → GlobX Total)</span>
          <span style="font-size: 11px; background: rgba(255,255,255,0.2); padding: 3px 8px; border-radius: 4px;">L1 Distributor: ${l1Q.distName}</span>
        </div>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <thead>
              <tr style="background-color: #f8fafc; color: #475569; font-size: 11px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">
                <th style="padding: 10px; text-align: center; border-right: 1px solid #e2e8f0;">S.No</th>
                <th style="padding: 10px; border-right: 1px solid #e2e8f0;">Item Description</th>
                <th style="padding: 10px; text-align: center; border-right: 1px solid #e2e8f0;">Qty</th>
                <th style="padding: 10px; text-align: right; border-right: 1px solid #e2e8f0;">Base Purchase Price</th>
                <th style="padding: 10px; text-align: center; border-right: 1px solid #e2e8f0;">Margin %</th>
                <th style="padding: 10px; text-align: right; border-right: 1px solid #e2e8f0;">GlobX Unit Price Excl GST</th>
                <th style="padding: 10px; text-align: right; border-right: 1px solid #e2e8f0;">GST (₹)</th>
                <th style="padding: 10px; text-align: right; border-right: 1px solid #e2e8f0;">GlobX Unit Price w/GST</th>
                <th style="padding: 10px; text-align: right; background-color: #ede9fe; color: #3730a3;">GlobX Total (incl. GST) (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr style="background-color: #f8fafc; font-weight: bold; border-top: 2px solid #cbd5e1;">
                <td colspan="4" style="padding: 12px 10px; text-align: right; color: #334155; font-size: 12px; border-right: 1px solid #e2e8f0;">Grand Total Summary (Base Cost: ${fmtMoney(grandBasePurchase)}):</td>
                <td style="padding: 12px 10px; text-align: center; color: #4338ca; font-size: 12px; border-right: 1px solid #e2e8f0;">${effectiveMargin}%</td>
                <td colspan="3" style="padding: 12px 10px; text-align: right; color: #64748b; font-size: 11px; border-right: 1px solid #e2e8f0;">TOTAL OFFERED VALUE (INCL. GST)</td>
                <td style="padding: 12px 10px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 800; color: #4338ca; background-color: #ede9fe;">${fmtMoney(grandGlobxTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `
  }

  const handleSendApproval = () => {
    if (!approverSelId) { toast.error('Select the person to send this pricing sheet for approval'); return }
    if (!approvalRemarks.trim()) { toast.error('Add a remark for the approver before sending'); return }
    const approver = users.find(u => u.id === approverSelId)
    const remarks = approvalRemarks.trim()
    // The blended per-item margin — not the flat `marginPct` default, which
    // is never actually written once quotes carry their own per-item
    // margins — is what "before" and "after" must both be measured against
    // at approval time, or an edit here would never register as a change.
    const marginAtRequest = l1Calculations?.effectiveMarginPct ?? marginPct
    const tableHtml = buildPricingTableHtml(l1Quote, marginPct)
    const remarksHtml = buildRemarkCalloutHtml(currentUser?.full_name || currentUser?.username || 'requester', remarks)
    const nowISO = new Date().toISOString()
    import('../../services/alerts').then(({ createAlert }) => {
      createAlert({ user_id: approverSelId, bid_id: bid.id, type: 'ACTION_REQUIRED', created_by: currentUser?.id,
        title: `Pricing Approval Required — ${bid.title}`,
        message: `<p style="margin: 0 0 12px 0;">Bid #${bid.gem_bid_no || bid.id}: Commercial pricing calculation from L1 distributor (<strong>${l1Quote?.distName || 'N/A'}</strong>) is ready for your review and approval.</p>${remarksHtml}${tableHtml}<p style="margin: 12px 0 0 0;">Please review and approve from the tender's Pricing Request stage.</p>`
      })
    })
    save({
      phase: 'APPROVAL',
      approverId: approverSelId,
      approverName: approver?.full_name || approver?.username || 'Unknown',
      approvalRequestedAt: nowISO,
      approvalStatus: 'PENDING',
      approvedAt: '',
      approvalRemarks: remarks,
      reminders: [],
      // Snapshot of the values at request time, so the approval email can
      // flag it if the approver adjusts margin/pricing before accepting.
      requestedById: currentUser?.id || '',
      requestedByName: currentUser?.full_name || currentUser?.username || 'Unknown',
      requestedMarginPct: marginAtRequest,
      requestedGrandTotal: l1Calculations?.grandGlobxTotal ?? null,
    })
    logStageMicroEvent(bid.id, {
      fromStage: 'PRICING_REQUEST',
      toStage: 'PRICING_REQUEST',
      eventType: 'ALERT',
      transitionReason: `Sent pricing approval request to ${approver?.full_name || approver?.username || approverSelId} (Margin: ${marginAtRequest.toFixed(2)}%, L1 Distributor: ${l1Quote?.distName || 'N/A'}) — Remarks: ${remarks}`,
      details: { approverId: approverSelId, marginPct: marginAtRequest, l1Distributor: l1Quote?.distName, remarks }
    })
    setShowApprovalDlg(false)
    toast.success(`Approval request with formatted pricing table sent to ${approver?.full_name || 'the selected approver'}!`)
  }

  const handleSendReminder = () => {
    if (!pricingData.approverId) return
    const tableHtml = buildPricingTableHtml(l1Quote, marginPct)
    const remarksHtml = buildRemarkCalloutHtml(pricingData.requestedByName || 'requester', pricingData.approvalRemarks)
    const reminderHeaderHtml = `<div style="margin:0 0 12px 0;padding:10px 14px;border-radius:8px;background:#fff7ed;border:1px solid #fed7aa;border-left:4px solid #fb923c;color:#9a3412;font-size:12px;font-weight:700;">🔔 Reminder — Bid #${bid.gem_bid_no || bid.id}: this commercial pricing calculation is still awaiting your approval.</div>`
    const nowISO = new Date().toISOString()
    import('../../services/alerts').then(({ createAlert }) => {
      createAlert({ user_id: pricingData.approverId, bid_id: bid.id, type: 'ACTION_REQUIRED', created_by: currentUser?.id,
        title: `Reminder: Pricing Approval Pending — ${bid.title}`,
        message: `${reminderHeaderHtml}${remarksHtml}${tableHtml}`
      })
    })
    const reminders = [...(pricingData.reminders || []), { sentAt: nowISO, sentBy: currentUser?.full_name || currentUser?.username || 'Unknown' }]
    save({ reminders })
    logStageMicroEvent(bid.id, {
      fromStage: 'PRICING_REQUEST',
      toStage: 'PRICING_REQUEST',
      eventType: 'ALERT',
      transitionReason: `Sent a pricing approval reminder to ${pricingData.approverName || pricingData.approverId}`,
      details: { reminderCount: reminders.length }
    })
    toast.success('Reminder sent!')
  }

  const canApprovePricing = !!currentUser?.id && (currentUser.id === pricingData.approverId || isAdmin)

  const handleApprovePricing = async () => {
    const nowISO = new Date().toISOString()
    const finalMargin = l1Calculations?.effectiveMarginPct ?? marginPct
    const finalTotal = l1Calculations?.grandGlobxTotal ?? null
    const reqMargin = pricingData.requestedMarginPct
    const reqTotal = pricingData.requestedGrandTotal
    const marginChanged = reqMargin != null && Math.abs(Number(reqMargin) - Number(finalMargin)) > 0.001
    const totalChanged = reqTotal != null && finalTotal != null && Math.abs(Number(reqTotal) - Number(finalTotal)) > 0.01
    const valuesChanged = marginChanged || totalChanged
    // Legacy pricing sheets sent before requestedMarginPct existed leave
    // reqMargin null — fall back to finalMargin so that case reads as "no
    // margin change" instead of a bogus "0.00% -> X%".
    const reqMarginDisplay = reqMargin ?? finalMargin
    const changeNote = valuesChanged
      ? ` Values were adjusted before approval — Margin: ${Number(reqMarginDisplay).toFixed(2)}% → ${Number(finalMargin).toFixed(2)}%, GlobX Total (incl. GST): ${fmtMoney(reqTotal)} → ${fmtMoney(finalTotal)}.`
      : ''

    await save({ approvalStatus: 'APPROVED', approvedAt: nowISO, approvedGrandTotal: finalTotal })

    // Notify the tender owner (and the original requester, if different) that
    // pricing has been approved — this was previously silent; only the
    // "request sent" email existed before.
    const tableHtml = buildPricingTableHtml(l1Quote, finalMargin)
    const changeBannerHtml = valuesChanged
      ? buildValuesAdjustedBannerHtml(reqMarginDisplay, finalMargin, reqTotal, finalTotal)
      : ''
    const remarksHtml = buildRemarkCalloutHtml(pricingData.requestedByName || 'requester', pricingData.approvalRemarks, 'Original remarks')
    const recipientIds = new Set()
    if (bid.bid_owner?.id) recipientIds.add(bid.bid_owner.id)
    if (pricingData.requestedById) recipientIds.add(pricingData.requestedById)
    import('../../services/alerts').then(({ createAlert }) => {
      recipientIds.forEach((uid) => {
        createAlert({ user_id: uid, bid_id: bid.id, type: 'APPROVAL', created_by: currentUser?.id,
          title: `Pricing Approved — ${bid.title}`,
          message: `<p style="margin: 0 0 12px 0;">Bid #${bid.gem_bid_no || bid.id}: the commercial pricing sheet has been <strong>approved</strong> by ${currentUser?.full_name || currentUser?.username || 'the approver'}.</p>${changeBannerHtml}${remarksHtml}${tableHtml}`
        })
      })
    })

    logStageMicroEvent(bid.id, {
      fromStage: 'PRICING_REQUEST',
      toStage: 'PRICING_REQUEST',
      eventType: 'PRICING',
      transitionReason: `Pricing approved by ${currentUser?.full_name || currentUser?.username || 'Unknown'}${finalTotal != null ? ` — GlobX Total (incl. GST): ${fmtMoney(finalTotal)}` : ''}.${changeNote}`,
      details: { approvedBy: currentUser?.id, approvedGrandTotal: finalTotal, requestedMarginPct: reqMargin, finalMarginPct: finalMargin, requestedGrandTotal: reqTotal, valuesChanged }
    })
    toast.success(valuesChanged ? 'Pricing approved — owner notified of the adjusted values!' : 'Pricing approved — owner notified!')
    if (onRefresh) await onRefresh()
  }

  // Find L1 (lowest total basic cost across all quotes) and the calculation breakdown
  const allQuotes = pricingData.quotes
  const { l1Quote, l1Calculations } = useMemo(
    () => computeL1PricingSummary(pricingData, 2.45),
    [pricingData]
  )

  // Same comparison handleApprovePricing uses to decide which email to send —
  // surfaced here too so the Approve button's own label can tell the
  // approver, before they click, whether they're about to trigger the
  // plain-approval email or the "values were adjusted" one.
  const pendingApprovalValuesChanged = (() => {
    const reqMargin = pricingData.requestedMarginPct
    const reqTotal = pricingData.requestedGrandTotal
    const finalMargin = l1Calculations?.effectiveMarginPct ?? marginPct
    const finalTotal = l1Calculations?.grandGlobxTotal ?? null
    const marginChanged = reqMargin != null && Math.abs(Number(reqMargin) - Number(finalMargin)) > 0.001
    const totalChanged = reqTotal != null && finalTotal != null && Math.abs(Number(reqTotal) - Number(finalTotal)) > 0.01
    return marginChanged || totalChanged
  })()

  // Margin is set per product on the L1 quote, from a dedicated dialog — not
  // at quote-entry time, and not as one global preset. Blank clears back to
  // the fallback margin used by computeL1PricingSummary.
  const [marginEdits, setMarginEdits] = useState({})
  const openMarginDlg = () => {
    const seed = {}
    ;(l1Quote?.items || []).forEach((it, idx) => { seed[idx] = it.marginPct != null && it.marginPct !== '' ? String(it.marginPct) : '' })
    setMarginEdits(seed)
    setShowMarginDlg(true)
  }
  const handleSaveMargins = () => {
    if (!l1Quote) return
    const updatedQuotes = pricingData.quotes.map(q => {
      if (q.id !== l1Quote.id) return q
      return {
        ...q,
        items: q.items.map((it, idx) => {
          const val = marginEdits[idx]
          if (val === '' || val == null) {
            const { marginPct, ...rest } = it
            return rest
          }
          return { ...it, marginPct: Number(val) }
        }),
      }
    })
    save({ quotes: updatedQuotes })
    logStageMicroEvent(bid.id, {
      fromStage: 'PRICING_REQUEST',
      toStage: 'PRICING_REQUEST',
      eventType: 'PRICING',
      transitionReason: `Updated per-product margins for L1 distributor "${l1Quote.distName}"`,
      details: { distName: l1Quote.distName, margins: marginEdits },
    })
    setShowMarginDlg(false)
    toast.success('Margins saved')
  }

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl border border-violet-200 bg-violet-50/50 dark:bg-violet-950/20 dark:border-violet-900/50">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-violet-900 dark:text-violet-300">Stage 4: Pricing Request & Commercial Calculation</h3>
            <p className="text-xs text-violet-700 dark:text-violet-400">Send pricing request → Collect distributor quotes → Calculate GlobX pricing → Send for approval</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {!isReadOnly && pricingData.phase === 'INIT' && (
              <Button size="sm" onClick={() => setShowRequestDlg(true)} className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs">
                <Send className="size-3.5" /> Send Pricing Request
              </Button>
            )}
            {isReadOnly && pricingData.phase === 'INIT' && (
              <span className="text-[10px] font-semibold text-violet-500 italic px-2 py-1 rounded bg-violet-50 border border-violet-200 dark:bg-violet-950/40 dark:border-violet-800">
                👁️ View only — awaiting pricing request
              </span>
            )}
            {!isReadOnly && pricingData.phase !== 'INIT' && (
              <Button size="sm" variant="outline" onClick={() => setShowAddDistDlg(true)} className="gap-1.5 border-violet-300 text-violet-800 dark:text-violet-300 hover:bg-violet-100 text-xs">
                <Plus className="size-3.5" /> Add More Distributors
              </Button>
            )}
            {!isReadOnly && pricingData.phase !== 'INIT' && (
              <span title={requestedProductNames.length === 0 ? 'Add requested products to this tender (via Edit Tender) before a quote can be entered' : undefined}>
                <Button size="sm" variant="outline" disabled={requestedProductNames.length === 0} onClick={handleOpenAddQuote} className="gap-1.5 border-violet-300 text-violet-800 dark:text-violet-300 hover:bg-violet-100 text-xs">
                  <Plus className="size-3.5" /> Add Distributor Quote
                </Button>
              </span>
            )}
            {!isReadOnly && (pricingData.phase === 'QUOTING' || pricingData.phase === 'APPROVAL') && l1Quote && pricingData.approvalStatus !== 'APPROVED' && (
              <Button size="sm" variant="outline" onClick={() => { setApproverSelId(pricingData.approverId || ''); setApprovalRemarks(pricingData.approvalRemarks || ''); setShowApprovalDlg(true) }} className={`gap-1.5 text-xs ${pricingData.phase === 'APPROVAL' ? 'border-orange-300 text-orange-800 hover:bg-orange-100' : 'border-amber-300 text-amber-800 dark:text-amber-300 hover:bg-amber-100'}`}>
                <Send className="size-3.5" /> {pricingData.phase === 'APPROVAL' ? 'Resend Approval Request' : 'Send for Approval'}
              </Button>
            )}
            {pricingData.approvalStatus === 'PENDING' && !isReadOnly && (
              <Button size="sm" variant="outline" onClick={handleSendReminder} className="gap-1.5 text-xs border-amber-300 text-amber-800 dark:text-amber-300 hover:bg-amber-100">
                <Bell className="size-3.5" /> Send Reminder
              </Button>
            )}
            {pricingData.approvalStatus === 'PENDING' && canApprovePricing && (
              <Button size="sm" onClick={handleApprovePricing} className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold">
                <CheckCircle2 className="size-3.5" /> {pendingApprovalValuesChanged ? 'Update & Approve Pricing' : 'Approve Pricing'}
              </Button>
            )}
            {isReadOnly && pricingData.phase !== 'INIT' && (
              <span className="text-[10px] font-semibold text-amber-600 italic px-2 py-1 rounded bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800">
                🔒 Read-only access — contact bid executive to make changes
              </span>
            )}
            <StageHeaderActions
              bid={bid}
              stageKey="PRICING_REQUEST"
              onCompleteClick={() => setShowModal(true)}
              onRefresh={onRefresh}
              completeLabel="Save Commercial & Advance"
              completeClass="bg-violet-600 hover:bg-violet-700 text-white"
              disabled={pricingData.phase === 'APPROVAL' && pricingData.approvalStatus !== 'APPROVED'}
              disabledTooltip="Pricing approval not done"
            />
          </div>
        </div>

        {pricingData.approverId && (() => {
          const activity = [
            { type: 'SENT', by: pricingData.requestedByName, at: pricingData.approvalRequestedAt },
            ...(pricingData.reminders || []).map(r => ({ type: 'REMINDER', by: r.sentBy, at: r.sentAt })),
            ...(pricingData.approvalStatus === 'APPROVED'
              ? [{ type: 'ACCEPTED', by: pricingData.approverName, at: pricingData.approvedAt }]
              : []),
          ].filter(a => a.at).sort((a, b) => new Date(a.at) - new Date(b.at))
          const eventStyle = {
            SENT: 'bg-muted text-muted-foreground border-border',
            REMINDER: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
            ACCEPTED: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
          }
          const eventLabel = { SENT: 'Sent', REMINDER: 'Reminder', ACCEPTED: 'Accepted' }
          return (
            <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px]">
              {pricingData.approvalStatus === 'APPROVED' ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-300 dark:border-emerald-800">
                  ✓ Approved by {pricingData.approverName} on {fmtDate(pricingData.approvedAt)}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold border border-amber-300 dark:border-amber-800">
                  ⏳ Pending approval from {pricingData.approverName}
                </span>
              )}
              {pricingData.approvalRemarks && (
                <span className="w-full px-2.5 py-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 border-l-4 border-l-amber-500 text-amber-900 dark:text-amber-200">
                  <strong className="font-semibold">⚑ Remarks:</strong> {pricingData.approvalRemarks}
                </span>
              )}
              {activity.length > 0 && (
                <div className="w-full mt-1 overflow-hidden rounded-md border border-border/60">
                  <table className="text-[11px] w-full">
                    <thead>
                      <tr className="bg-muted/50 text-muted-foreground">
                        <th className="px-2 py-1 text-left font-semibold w-8">#</th>
                        <th className="px-2 py-1 text-left font-semibold">Event</th>
                        <th className="px-2 py-1 text-left font-semibold">By</th>
                        <th className="px-2 py-1 text-left font-semibold">At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activity.map((a, i) => (
                        <tr key={i} className="border-t border-border/60">
                          <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                          <td className="px-2 py-1">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${eventStyle[a.type]}`}>{eventLabel[a.type]}</span>
                          </td>
                          <td className="px-2 py-1 text-foreground font-medium">{a.by}</td>
                          <td className="px-2 py-1 text-muted-foreground">{fmtDateTime(a.at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })()}
        <div className="mt-2 flex gap-2 flex-wrap">
          {['INIT','AWAITING','QUOTING','APPROVAL'].map((ph, i) => (
            <span key={ph} className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${pricingData.phase === ph ? 'bg-violet-600 text-white' : 'bg-muted text-muted-foreground'}`}>
              {i+1}. {ph === 'INIT' ? 'Request Not Sent' : ph === 'AWAITING' ? 'Awaiting Response' : ph === 'QUOTING' ? 'Quotes Received' : 'Sent for Approval'}
            </span>
          ))}
        </div>
      </div>

      {pricingData.distNames.length > 0 && (
        <div className="p-3 rounded-lg border border-border bg-card text-xs flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-muted-foreground">Distributors Contacted:</span>
          {pricingData.distNames.map(n => <span key={n} className="px-2 py-0.5 rounded bg-violet-50 dark:bg-violet-950/50 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-800 font-medium">{n}</span>)}
        </div>
      )}

      {allQuotes.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Distributor Quotes Received ({allQuotes.length})</h4>
            <span className="text-[11px] text-muted-foreground">L1 selection determined by lowest basic purchase cost</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allQuotes.map(q => {
              const qTotal = q.items.reduce((s, it) => s + (Number(it.basicPrice) || 0) * (Number(it.qty) || 1), 0)
              const isL1 = l1Quote && l1Quote.id === q.id
              return (
                <div key={q.id} className={`p-3 rounded-xl border text-xs transition-all ${isL1 ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm ring-1 ring-emerald-400/30' : 'border-border bg-card hover:border-border/80'}`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{q.distName}</span>
                      {isL1 && (
                        <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-600 text-white font-bold tracking-wide">
                          ⭐ L1 Lowest Quote
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {!isReadOnly && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[11px] gap-1 border-violet-200 hover:border-violet-400 text-violet-700 hover:bg-violet-50 dark:border-violet-900 dark:text-violet-300"
                          onClick={() => handleOpenEditQuote(q)}
                          title="Edit Distributor Quote"
                        >
                          <Edit2 className="size-3" /> Edit
                        </Button>
                      )}
                      {!isReadOnly && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          onClick={() => handleDeleteQuote(q.id, q.distName)}
                          title="Delete Quote"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-muted/40 text-muted-foreground">
                        <th className="border border-border p-1.5 text-left">Description</th>
                        <th className="border border-border p-1.5 text-center">Qty</th>
                        <th className="border border-border p-1.5 text-right">Base Price</th>
                        <th className="border border-border p-1.5 text-right">Total Base</th>
                      </tr>
                    </thead>
                    <tbody>
                      {q.items.map((it, ii) => (
                        <tr key={ii} className="hover:bg-muted/20">
                          <td className="border border-border p-1.5">{it.desc}</td>
                          <td className="border border-border p-1.5 text-center">{it.qty}</td>
                          <td className="border border-border p-1.5 text-right font-mono">{fmtMoney(it.basicPrice)}</td>
                          <td className="border border-border p-1.5 text-right font-mono font-semibold text-foreground">{fmtMoney((Number(it.basicPrice) || 0) * (Number(it.qty) || 1))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/30 font-bold border-t border-border">
                        <td colSpan={3} className="border border-border p-1.5 text-right text-muted-foreground text-[10px]">Total Base Value:</td>
                        <td className="border border-border p-1.5 text-right font-mono text-foreground">{fmtMoney(qTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {l1Quote && l1Calculations && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-card p-5 space-y-4 shadow-sm">
          {/* Header & Margin Selector */}
          <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-border">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  <Calculator className="size-4" />
                </div>
                <h4 className="text-sm font-bold text-foreground">
                  Commercial Pricing Calculation (from L1: <span className="text-indigo-600 dark:text-indigo-400">{l1Quote.distName}</span>)
                </h4>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Calculation Sequence: <strong>Base Purchase Price → Margin % (applied to Base) → GlobX Unit Price Excl GST → GST (18%) → GlobX Unit Price w/GST → GlobX Total Price</strong>
              </p>
            </div>

            {/* The assigned approver can always adjust margin before signing
                off, even though they can't send/manage pricing otherwise —
                canApprovePricing overrides the general read-only gate. */}
            <Button size="sm" variant="outline" disabled={isReadOnly && !canApprovePricing} onClick={openMarginDlg} className="gap-1.5 text-xs font-semibold">
              <Plus className="size-3.5" /> {pricingData.phase === 'APPROVAL' ? 'Update Margin' : 'Add Margin'}
            </Button>
          </div>

          {/* Interactive Pricing Calculation Table */}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-muted/60 text-muted-foreground font-bold text-[10px] uppercase tracking-wider">
                  <th className="border border-border p-2 text-center">S.No</th>
                  <th className="border border-border p-2 text-left">Item Description</th>
                  <th className="border border-border p-2 text-left">OEM</th>
                  <th className="border border-border p-2 text-center">Qty</th>
                  <th className="border border-border p-2 text-right">Base Purchase Price</th>
                  <th className="border border-border p-2 text-center">Margin %</th>
                  <th className="border border-border p-2 text-right">GlobX Unit Price Excl GST</th>
                  <th className="border border-border p-2 text-right">GST (₹)</th>
                  <th className="border border-border p-2 text-right">GlobX Unit Price w/GST</th>
                  <th className="border border-border p-2 text-right bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200">GlobX Total (incl. GST) (₹)</th>
                </tr>
              </thead>
              <tbody>
                {l1Calculations.items.map((row) => (
                  <tr key={row.sNo} className="hover:bg-muted/10 transition-colors">
                    <td className="border border-border p-2 text-center font-mono font-bold text-muted-foreground">{row.sNo}</td>
                    <td className="border border-border p-2 font-medium text-foreground">{row.desc}</td>
                    <td className="border border-border p-2 text-muted-foreground">{row.oem || resolvedOemByProductName[row.desc] || '—'}</td>
                    <td className="border border-border p-2 text-center font-semibold">{row.qty}</td>
                    <td className="border border-border p-2 text-right font-mono text-muted-foreground">{fmtMoney(row.basicPrice)}</td>
                    <td className="border border-border p-2 text-center font-semibold text-indigo-600 dark:text-indigo-400">{row.itemMargin}%</td>
                    <td className="border border-border p-2 text-right font-mono text-foreground">{fmtMoney(row.unitPriceExclGst)}</td>
                    <td className="border border-border p-2 text-right font-mono text-muted-foreground">
                      {fmtMoney(row.unitGst)} <span className="text-[9px] text-muted-foreground/70">({row.itemGstRate}%)</span>
                    </td>
                    <td className="border border-border p-2 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">{fmtMoney(row.globxUnit)}</td>
                    <td className="border border-border p-2 text-right font-mono font-extrabold text-indigo-700 dark:text-indigo-300 bg-indigo-50/40 dark:bg-indigo-950/20">{fmtMoney(row.globxTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40 font-bold border-t-2 border-border text-xs">
                  <td colSpan={4} className="border border-border p-2.5 text-right text-muted-foreground uppercase tracking-wider">Grand Total Summary:</td>
                  <td className="border border-border p-2.5 text-right font-mono font-bold text-foreground">{fmtMoney(l1Calculations.grandBaseCost)}</td>
                  <td className="border border-border p-2.5 text-center font-bold text-indigo-700 dark:text-indigo-300">{l1Calculations.effectiveMarginPct.toFixed(2)}%</td>
                  <td colSpan={3} className="border border-border p-2.5 text-right text-muted-foreground uppercase tracking-wider">Total Offered Value (Incl. GST):</td>
                  <td className="border border-border p-2.5 text-right font-mono text-sm font-extrabold text-indigo-700 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-950/40">{fmtMoney(l1Calculations.grandGlobxTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Quick Metrics Summary Cards — shown below the table so the row-by-row breakdown reads first */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="p-3 rounded-lg border border-border bg-muted/20">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Base Purchase Cost</div>
              <div className="text-sm font-bold font-mono text-foreground mt-0.5">{fmtMoney(l1Calculations.grandBaseCost)}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">L1: {l1Quote.distName}</div>
            </div>
            <div className="p-3 rounded-lg border border-border bg-muted/20">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Selling (Excl. GST)</div>
              <div className="text-sm font-bold font-mono text-foreground mt-0.5">{fmtMoney(l1Calculations.grandSellingExclGst)}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Base + Profit Margin</div>
            </div>
            <div className="p-3 rounded-lg border border-border bg-muted/20">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">GST Tax Component</div>
              <div className="text-sm font-bold font-mono text-foreground mt-0.5">{fmtMoney(l1Calculations.grandGstAmount)}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Standard 18% Output</div>
            </div>
            <div className="p-3 rounded-lg border border-indigo-300 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/30">
              <div className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">GlobX Total (incl. GST)</div>
              <div className="text-base font-extrabold font-mono text-indigo-700 dark:text-indigo-300 mt-0.5">{fmtMoney(l1Calculations.grandGlobxTotal)}</div>
              <div className="text-[10px] font-semibold text-indigo-600/80 dark:text-indigo-400 mt-0.5">Final Quoted Bid Value</div>
            </div>
            <div className="p-3 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30">
              <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Net Profit</div>
              <div className="text-base font-extrabold font-mono text-emerald-700 dark:text-emerald-300 mt-0.5">{fmtMoney(l1Calculations.grandTotalProfit)}</div>
              <div className="text-[10px] font-semibold text-emerald-600/80 dark:text-emerald-400 mt-0.5">{l1Calculations.effectiveMarginPct.toFixed(2)}% of Base Cost</div>
            </div>
          </div>
        </div>
      )}

      {/* Send Pricing Request Dialog */}
      {showRequestDlg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-card border border-border rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold">Send Pricing Request to Distributors</h3>
            <div className="space-y-1.5">
              <Label className="text-xs">Distributor Names (comma separated)</Label>
              <Input value={initDistNames} onChange={e => setInitDistNames(e.target.value)} placeholder="e.g. Ingram Micro, Redington, TD SYNNEX" className="text-xs" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowRequestDlg(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSendRequest}>Send Request</Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add Distributor Quote Dialog */}
      {showQuoteDlg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-2xl bg-card border border-border rounded-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-semibold">Add Distributor Quote</h3>
            <div className="space-y-1.5">
              <Label className="text-xs">Select Distributor</Label>
              <select value={quoteDistSel} onChange={e => setQuoteDistSel(e.target.value)} className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background">
                <option value="">-- Select --</option>
                {pricingData.distNames.map(n => <option key={n} value={n}>{n}</option>)}
                <option value="Others">Others (New Distributor)</option>
              </select>
              {quoteDistSel === 'Others' && (
                <Input value={quoteCustomName} onChange={e => setQuoteCustomName(e.target.value)} placeholder="Enter new distributor name" className="text-xs mt-1" />
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Line Items</Label>
              {quoteItems.map((it, ii) => (
                <div key={ii} className="grid grid-cols-6 gap-1.5 items-end">
                  <div className="col-span-2 h-8 flex items-center px-2 text-xs font-medium text-foreground truncate" title={it.desc}>{it.desc || '—'}</div>
                  <div className="h-8 flex items-center px-2 text-xs text-muted-foreground truncate" title={it.oem ? `OEM: ${it.oem}` : 'No OEM finalized for this product'}>{it.oem || '—'}</div>
                  <div><Input type="number" value={it.qty} onChange={e => { const a = [...quoteItems]; a[ii].qty = e.target.value; setQuoteItems(a) }} placeholder="Qty" className="h-8 text-xs" /></div>
                  <div><Input type="number" value={it.basicPrice} onChange={e => { const a = [...quoteItems]; a[ii].basicPrice = e.target.value; setQuoteItems(a) }} placeholder="Basic Price ₹" className="h-8 text-xs" /></div>
                  <button onClick={() => setQuoteItems(quoteItems.filter((_, i) => i !== ii))} className="h-8 text-destructive border border-border rounded px-2 text-xs">✕</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowQuoteDlg(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAddQuote}>Save Quote</Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Distributor Quote Dialog */}
      {showEditQuoteDlg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-2xl bg-card border border-border rounded-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-semibold">Edit Distributor Quote</h3>
            <div className="space-y-1.5">
              <Label className="text-xs">Select Distributor</Label>
              <select value={quoteDistSel} onChange={e => setQuoteDistSel(e.target.value)} className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background">
                <option value="">-- Select --</option>
                {pricingData.distNames.map(n => <option key={n} value={n}>{n}</option>)}
                <option value="Others">Others (New Distributor)</option>
              </select>
              {quoteDistSel === 'Others' && (
                <Input value={quoteCustomName} onChange={e => setQuoteCustomName(e.target.value)} placeholder="Enter new distributor name" className="text-xs mt-1" />
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Line Items</Label>
              {quoteItems.map((it, ii) => (
                <div key={ii} className="grid grid-cols-6 gap-1.5 items-end">
                  <div className="col-span-2 h-8 flex items-center px-2 text-xs font-medium text-foreground truncate" title={it.desc}>{it.desc || '—'}</div>
                  <div className="h-8 flex items-center px-2 text-xs text-muted-foreground truncate" title={it.oem ? `OEM: ${it.oem}` : 'No OEM finalized for this product'}>{it.oem || '—'}</div>
                  <div><Input type="number" value={it.qty} onChange={e => { const a = [...quoteItems]; a[ii].qty = e.target.value; setQuoteItems(a) }} placeholder="Qty" className="h-8 text-xs" /></div>
                  <div><Input type="number" value={it.basicPrice} onChange={e => { const a = [...quoteItems]; a[ii].basicPrice = e.target.value; setQuoteItems(a) }} placeholder="Basic Price ₹" className="h-8 text-xs" /></div>
                  <button onClick={() => setQuoteItems(quoteItems.filter((_, i) => i !== ii))} className="h-8 text-destructive border border-border rounded px-2 text-xs">✕</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { setShowEditQuoteDlg(false); setEditingQuoteId(null); setQuoteDistSel(''); setQuoteCustomName(''); setQuoteItems([{ desc: '', qty: 1, basicPrice: '', marginPct: '', oem: '' }]) }}>Cancel</Button>
              <Button size="sm" onClick={handleUpdateQuote} className="bg-violet-600 hover:bg-violet-700 text-white">Update Quote</Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Send for Approval Dialog */}
      {showApprovalDlg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm bg-card border border-border rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold">Send Pricing for Approval</h3>
            <p className="text-xs text-muted-foreground">Only this tender's Account Manager can approve pricing — they'll get an in-app alert and email with the pricing table.</p>
            <div className="space-y-1.5">
              <Label className="text-xs">Send to</Label>
              {bid.account_manager ? (
                <select value={approverSelId} onChange={e => setApproverSelId(e.target.value)} className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background">
                  <option value="">-- Select approver --</option>
                  <option value={bid.account_manager.id}>{bid.account_manager.full_name} (Account Manager)</option>
                </select>
              ) : (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">No Account Manager is assigned to this tender — assign one from Primary Review before sending for approval.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Remarks *</Label>
              <Textarea value={approvalRemarks} onChange={e => setApprovalRemarks(e.target.value)} placeholder="Add context for the approver — e.g. why this margin, anything to double-check..." className="text-xs min-h-[70px]" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowApprovalDlg(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSendApproval}>Send Alert &amp; Email</Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add Margin Dialog — per-product margin on the L1 quote */}
      {showMarginDlg && l1Quote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg bg-card border border-border rounded-xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <h3 className="text-sm font-semibold">Add Margin — {l1Quote.distName} (L1)</h3>
            <p className="text-xs text-muted-foreground">Set a margin per product. Leave blank to use the fallback margin (2.45%) in the calculation.</p>
            <div className="space-y-2">
              {l1Quote.items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-5 gap-2 items-center p-2 rounded-md border border-border/60">
                  <div className="col-span-2 text-xs font-medium text-foreground truncate">{it.desc}</div>
                  <div className="text-xs text-muted-foreground">Qty {it.qty}</div>
                  <div className="text-xs text-muted-foreground">₹{it.basicPrice}</div>
                  <Input
                    type="number" step="any"
                    value={marginEdits[idx] ?? ''}
                    onChange={e => setMarginEdits(prev => ({ ...prev, [idx]: e.target.value }))}
                    placeholder="Margin %"
                    className="h-8 text-xs"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowMarginDlg(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveMargins}>Save Margins</Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add More Distributors Dialog */}
      {showAddDistDlg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-card border border-border rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold">Add More Distributors to Request</h3>
            <p className="text-xs text-muted-foreground">Already contacted: <span className="font-medium text-foreground">{pricingData.distNames.join(', ')}</span></p>
            <div className="space-y-1.5">
              <Label className="text-xs">New Distributor Names (comma separated)</Label>
              <Input value={addMoreDistNames} onChange={e => setAddMoreDistNames(e.target.value)} placeholder="e.g. Ingram Micro, ScanPoint" className="text-xs" onKeyDown={e => e.key === 'Enter' && handleAddMoreDistributors()} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { setShowAddDistDlg(false); setAddMoreDistNames('') }}>Cancel</Button>
              <Button size="sm" onClick={handleAddMoreDistributors} className="bg-violet-600 hover:bg-violet-700 text-white">Add Distributors</Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Quote Confirmation Dialog */}
      <Dialog open={!!quoteToDelete} onOpenChange={(open) => !open && setQuoteToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-600 dark:text-rose-400 flex items-center gap-2 text-base font-bold">
              <Trash2 className="size-5" /> Confirm Quotation Deletion
            </DialogTitle>
            <DialogDescription className="pt-2 text-foreground/80 text-xs leading-relaxed">
              Are you sure you want to delete the commercial quotation from <strong className="text-foreground font-semibold">{quoteToDelete?.distName}</strong>? This action will remove all recorded line items and recalculate L1 pricing.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-4">
            <Button variant="outline" size="sm" onClick={() => setQuoteToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={confirmDeleteQuote}>
              Yes, Delete Quote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showModal && (
        <CompleteStageModal
          title="Save Commercial & Complete Stage 4"
          description="Marks Stage 4 (Pricing Request) as complete. Document Checklist Preparation can now be started independently."
          stageKey="PRICING_REQUEST"
          bidId={bid.id}
          bid={bid}
          onClose={() => setShowModal(false)}
          onComplete={onRefresh}
        />
      )}
    </div>
  )
}

// ── Stage 5: Document Checklist Preparation ────────────────────────────────
export function Stage5Workspace({ bid, onRefresh }) {
  const [showModal, setShowModal] = useState(false)
  const [handoffRemarks, setHandoffRemarks] = useState('')
  // EMD isn't required, so completing the checklist is the actual moment
  // this tender becomes ready for Internal Approval — the backend fires
  // that notification off this exact transition (see notifyInternalApprovalReady
  // in bid_service.go). When EMD IS required, that moment is EMD Processing's
  // own completion instead (Stage6Workspace carries the equivalent framing).
  const emdNotRequired = !!(bid.emd_exempted || bid.emd_not_applicable)

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-900/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-300">Stage 5: Document Checklist Preparation</h3>
          <p className="text-xs text-purple-700 dark:text-purple-400">Ensure all mandatory bidder and OEM documents are compiled, verified, and tracked below.</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <StageHeaderActions
            bid={bid}
            stageKey="DOCUMENT_CHECKLIST_PREPARATION"
            onCompleteClick={() => setShowModal(true)}
            onRefresh={onRefresh}
            completeLabel="Complete Checklist & Advance"
            completeClass="bg-purple-600 hover:bg-purple-700 text-white"
          />
        </div>
      </div>

      {/* Embedded Dynamic Interactive Checklist UI */}
      <div className="rounded-xl border border-border/80 bg-card p-1">
        <ChecklistTab bid={bid} onRefresh={onRefresh} />
      </div>

      {showModal && (
        <CompleteStageModal
          title="Complete Stage 5: Checklist Prep"
          description={
            emdNotRequired
              ? `Marks Stage 5 as complete. This tender has no EMD to process, so completing this will notify ${bid.account_manager?.full_name || 'the Account Manager'} and ${bid.presales?.full_name || 'Pre-Sales'} that it's ready for Internal Approval.`
              : "Marks Stage 5 as complete. EMD Processing can now proceed independently."
          }
          stageKey="DOCUMENT_CHECKLIST_PREPARATION"
          bidId={bid.id}
          bid={bid}
          onClose={() => setShowModal(false)}
          onComplete={onRefresh}
          hideDefaultRemarks={emdNotRequired}
          remarksValue={handoffRemarks}
        >
          {emdNotRequired && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Message for Account Manager &amp; Pre-Sales</Label>
              <Textarea
                value={handoffRemarks}
                onChange={(e) => setHandoffRemarks(e.target.value)}
                placeholder="Anything they should know before reviewing for Internal Approval..."
                className="text-xs min-h-[80px]"
                required
              />
            </div>
          )}
        </CompleteStageModal>
      )}
    </div>
  )
}

// Builds the same EMD detail HTML table used by both the manual "Alert Finance
// Team" action here and the automatic on-creation alert on the backend, so the
// in-app alert and email always render identically formatted.
function buildEmdDetailsTableHtml(bid) {
  const rows = [
    ['EMD Amount', fmtMoney(bid.emd_amount)],
    ['Payment Mode', bid.emd_exempted ? 'EXEMPTED' : (bid.emd_type || 'N/A')],
  ]
  if (!bid.emd_exempted && bid.emd_type === 'ONLINE') {
    rows.push(
      ['Bank Name', bid.emd_bank_name || 'N/A'],
      ['Account Number', bid.emd_account_number || 'N/A'],
      ['IFSC Code', bid.emd_ifsc_code || 'N/A'],
    )
    if (bid.emd_branch) rows.push(['Branch', bid.emd_branch])
  } else if (!bid.emd_exempted && bid.emd_type === 'DD') {
    rows.push(
      ['Beneficiary', bid.emd_beneficiary || 'N/A'],
      ['Payable At', bid.emd_payable_at || 'N/A'],
    )
  }

  const rowsHtml = rows.map(([label, value]) => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 8px 12px; font-weight: 600; color: #475569; background-color: #f8fafc; width: 40%;">${label}</td>
      <td style="padding: 8px 12px; color: #1e293b; font-family: monospace;">${value}</td>
    </tr>
  `).join('')

  return `
    <div style="margin-top: 14px; margin-bottom: 14px; border: 1px solid #fde68a; border-radius: 10px; overflow: hidden; background-color: #ffffff;">
      <div style="background: linear-gradient(135deg, #d97706 0%, #b45309 100%); padding: 12px 16px; color: #ffffff; font-size: 13px; font-weight: 700;">
        💰 EMD Payment Details — ${bid.title}
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `
}

// ── Stage 6: EMD Processing ─────────────────────────────────────────────────
export function Stage6Workspace({ bid, onRefresh }) {
  const [showModal, setShowModal] = useState(false)
  const [showAlertDlg, setShowAlertDlg] = useState(false)
  const [alertRemarks, setAlertRemarks] = useState('')
  const [handoffRemarks, setHandoffRemarks] = useState('')
  const { hasRole, isAdmin } = usePermissions()
  const isFinance = hasRole('FINANCE')
  // EMD alerts must be triggered by someone other than Finance — Bid Executive,
  // Manager, or Admin — so Finance can't self-trigger its own processing request.
  const canTriggerEmdAlert = isAdmin || hasRole('MANAGER') || hasRole('ACCOUNT_MANAGER') || hasRole('BID_EXECUTIVE')
  // EMD isn't required, so completing THIS stage is handled by Stage 5
  // instead — Internal-Approval readiness is only framed here when EMD
  // actually has to be processed (mirrors Stage5Workspace's emdNotRequired).
  const emdRequired = !bid.emd_exempted && !bid.emd_not_applicable

  // Every "Alert Finance" / reminder sent for this stage — resolved from the
  // shared (DB-backed) stage history, same technique as useStageCompletedBy,
  // so no new field is needed to track alert/reminder history or who to
  // notify back once Finance confirms it's ready.
  const [emdAlertHistory, setEmdAlertHistory] = useState([])
  const [emdHistoryReload, setEmdHistoryReload] = useState(0)
  useEffect(() => {
    let cancelled = false
    // limit: 200 — collects every matching alert, not a page to render.
    getBidStageHistory(bid.id, { limit: 200 }).then((res) => {
      if (cancelled || !res.ok) return
      const entries = (res.data || [])
        .filter((h) => h.to_stage === 'EMD_PROCESSING' && (h.event_type === 'ALERT' || h.event_type === 'REMINDER'))
        .map((h) => ({
          type: h.event_type,
          by: h.transitioned_by?.full_name || h.transitioned_by?.username || 'someone',
          byId: h.transitioned_by?.id,
          at: h.created_at,
        }))
      setEmdAlertHistory(entries)
    }).catch(() => {})
    return () => { cancelled = true }
    // bid.updated_at (bumped by the backend on every write) makes the header
    // refresh button re-fetch this too, on top of emdHistoryReload covering
    // this session's own handleAlertFinance sends.
  }, [bid.id, bid.updated_at, emdHistoryReload])
  const emdTriggeredBy = emdAlertHistory.length > 0
    ? { id: emdAlertHistory[emdAlertHistory.length - 1].byId, name: emdAlertHistory[emdAlertHistory.length - 1].by }
    : null

  const handleMarkEmdReady = async () => {
    try {
      const res = await updateBid(bid.id, { emd_ready: true, emd_ready_date: new Date().toISOString() })
      if (res.ok) {
        logStageMicroEvent(bid.id, {
          fromStage: 'EMD_PROCESSING',
          toStage: 'EMD_PROCESSING',
          eventType: 'FINANCE',
          transitionReason: 'Finance confirmed EMD is ready',
        })

        // Notify whoever triggered the EMD request (falls back to the tender
        // owner) that EMD is now ready, with the full payment/exemption details.
        const notifyId = emdTriggeredBy?.id || bid.bid_owner?.id
        if (notifyId) {
          const currentUser = tokenStorage.getUser()
          const tableHtml = buildEmdDetailsTableHtml(bid)
          import('../../services/alerts').then(({ createAlert }) => {
            createAlert({
              user_id: notifyId,
              bid_id: bid.id,
              type: 'EMD',
              created_by: currentUser?.id,
              title: `EMD Ready — ${bid.title}`,
              message: `<p style="margin: 0 0 8px 0;">EMD for tender <strong>${bid.title}</strong> (GeM Bid No: ${bid.gem_bid_no || 'N/A'}) has been confirmed <strong>ready</strong> by Finance (${currentUser?.full_name || currentUser?.username || 'Finance'}).</p>${tableHtml}`,
            })
          })
        }

        toast.success('EMD marked as Ready! Requester notified.')
        onRefresh()
      } else {
        toast.error(res.error?.message || 'Failed to mark EMD ready')
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleAlertFinance = async () => {
    const isReminder = emdAlertHistory.length > 0
    try {
      const { createAlert } = await import('../../services/alerts')
      const currentUser = tokenStorage.getUser()
      const tableHtml = buildEmdDetailsTableHtml(bid)
      const remarks = alertRemarks.trim()
      const remarksHtml = remarks
        ? `<div style="margin:0 0 12px 0;padding:10px 14px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;color:#334155;font-size:12px;"><strong style="color:#1e293b;">Clarification from ${currentUser?.full_name || currentUser?.username || 'requester'}:</strong> ${remarks}</div>`
        : ''

      await createAlert({
        target_role: 'FINANCE',
        bid_id: bid.id,
        created_by: currentUser?.id,
        type: 'ACTION_REQUIRED',
        title: `${isReminder ? 'Reminder: ' : ''}EMD Processing Required — ${bid.title}`,
        message: `<p style="margin: 0 0 8px 0;">Tender: <strong>${bid.title}</strong> (GeM Bid No: ${bid.gem_bid_no || 'N/A'}) requires EMD processing.</p>${remarksHtml}${tableHtml}`,
      })
      logStageMicroEvent(bid.id, {
        fromStage: 'EMD_PROCESSING',
        toStage: 'EMD_PROCESSING',
        eventType: isReminder ? 'REMINDER' : 'ALERT',
        transitionReason: `${isReminder ? 'Sent a reminder to' : 'Alerted'} Finance Team for EMD processing (Amount: ${fmtMoney(bid.emd_amount)}, Mode: ${bid.emd_exempted ? 'EXEMPTED' : bid.emd_type})${remarks ? ` — ${remarks}` : ''}`,
        details: { emdAmount: bid.emd_amount, exempted: bid.emd_exempted, remarks }
      })
      toast.success(`Finance team ${isReminder ? 'reminded' : 'alerted'} via in-app notification + email (CC sent to you)!`)
      setShowAlertDlg(false)
      setAlertRemarks('')
      setEmdHistoryReload((n) => n + 1)
      onRefresh()
    } catch (e) {
      toast.error('Failed to send alert. Check your connection.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-300">Stage 6: EMD Processing</h3>
          <p className="text-xs text-amber-700 dark:text-amber-400">Manage EMD payment or exemption certificates. Bank Guarantee is tracked later, after Purchase Order receipt.</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {canTriggerEmdAlert && !bid.emd_ready ? (
            <Button size="sm" variant="outline" onClick={() => setShowAlertDlg(true)} className="gap-1.5 border-amber-300 text-amber-900 dark:text-amber-300 hover:bg-amber-100 text-xs">
              <Bell className="size-3.5" /> {emdAlertHistory.length > 0 ? 'Send Reminder' : 'Alert Finance Team'}
            </Button>
          ) : isFinance && !bid.emd_ready ? (
            <span className="text-[10px] font-semibold text-amber-600 italic px-2 py-1 rounded bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800" title="Finance cannot self-trigger the EMD alert — ask a Bid Executive, Manager, or Admin to initiate it.">
              🔒 EMD alert must be triggered by a Bid Executive/Manager/Admin
            </span>
          ) : null}
          {isFinance && !bid.emd_ready && (
            <Button size="sm" onClick={handleMarkEmdReady} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">
              <CheckCircle2 className="size-3.5" /> Mark EMD Ready
            </Button>
          )}
          <StageHeaderActions
            bid={bid}
            stageKey="EMD_PROCESSING"
            onCompleteClick={() => setShowModal(true)}
            onRefresh={onRefresh}
            completeLabel="EMD Ready & Advance"
            completeClass="bg-amber-600 hover:bg-amber-700 text-white"
            disabled={!bid.emd_ready || isFinance}
            disabledTooltip={isFinance ? 'Advancing this stage is a Bid Executive/Account Manager action, not Finance.' : 'Awaiting EMD Ready confirmation from Finance'}
          />
        </div>
      </div>

      {emdAlertHistory.length > 0 && (
        <div className="max-w-md overflow-hidden rounded-md border border-border/60">
          <table className="text-[11px] w-full">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground">
                <th className="px-2 py-1 text-left font-semibold w-8">#</th>
                <th className="px-2 py-1 text-left font-semibold">Event</th>
                <th className="px-2 py-1 text-left font-semibold">By</th>
                <th className="px-2 py-1 text-left font-semibold">At</th>
              </tr>
            </thead>
            <tbody>
              {emdAlertHistory.map((a, i) => (
                <tr key={i} className="border-t border-border/60">
                  <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-1">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${a.type === 'ALERT' ? 'bg-muted text-muted-foreground border-border' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'}`}>
                      {a.type === 'ALERT' ? 'Alert' : 'Reminder'}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-foreground font-medium">{a.by}</td>
                  <td className="px-2 py-1 text-muted-foreground">{fmtDateTime(a.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {bid.emd_ready ? (
        <div className="px-3.5 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 max-w-md">
          <CheckCircle2 className="size-3.5" /> EMD Ready — confirmed{bid.emd_ready_date ? ` on ${fmtDate(bid.emd_ready_date)}` : ''}
        </div>
      ) : (
        <div className="px-3.5 py-2 rounded-lg bg-muted/40 border border-border text-xs font-medium text-muted-foreground flex items-center gap-1.5 max-w-md">
          <Hourglass className="size-3.5" /> {isFinance ? 'Click "Mark EMD Ready" once EMD is processed' : 'Awaiting confirmation from the Finance team'}
        </div>
      )}

      <div className="p-4 rounded-xl border border-border bg-card space-y-2 text-xs max-w-md">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">EMD Requirements</h4>
        <div className="flex justify-between"><span className="text-muted-foreground">Status:</span><span className="font-semibold">{bid.emd_exempted ? 'EXEMPTED' : 'REQUIRED'}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">EMD Amount:</span><span className="font-bold font-mono">{fmtMoney(bid.emd_amount)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Payment Mode:</span><span className="font-medium">{bid.emd_exempted ? 'EXEMPTED' : (bid.emd_type || 'ONLINE')}</span></div>

        {!bid.emd_exempted && bid.emd_type === 'ONLINE' && (
          <div className="mt-3 pt-3 border-t border-border/60 space-y-1.5">
            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">Online Payment Details</span>
            <div className="flex justify-between"><span className="text-muted-foreground">Bank Name:</span><span className="font-medium text-foreground">{bid.emd_bank_name || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Account Number:</span><span className="font-mono font-medium text-foreground">{bid.emd_account_number || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">IFSC Code:</span><span className="font-mono font-medium text-foreground">{bid.emd_ifsc_code || '—'}</span></div>
            {bid.emd_branch && <div className="flex justify-between"><span className="text-muted-foreground">Branch:</span><span className="font-medium text-foreground">{bid.emd_branch}</span></div>}
          </div>
        )}

        {!bid.emd_exempted && bid.emd_type === 'DD' && (
          <div className="mt-3 pt-3 border-t border-border/60 space-y-1.5">
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">Demand Draft (DD) Details</span>
            <div className="flex justify-between"><span className="text-muted-foreground">Beneficiary:</span><span className="font-medium text-foreground">{bid.emd_beneficiary || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Payable At:</span><span className="font-medium text-foreground">{bid.emd_payable_at || '—'}</span></div>
          </div>
        )}
      </div>

      {showAlertDlg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-foreground">
              <Bell className="size-5 text-amber-600" />
              <h3 className="text-base font-semibold font-heading">{emdAlertHistory.length > 0 ? 'Send Reminder to Finance' : 'Alert Finance Team'}</h3>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Clarification remarks (optional)</Label>
              <Textarea
                value={alertRemarks}
                onChange={(e) => setAlertRemarks(e.target.value)}
                placeholder="Anything Finance should know before processing this EMD..."
                className="text-xs min-h-[70px]"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowAlertDlg(false); setAlertRemarks('') }}>Cancel</Button>
              <Button size="sm" onClick={handleAlertFinance} className="gap-1.5">
                <Bell className="size-3.5" /> {emdAlertHistory.length > 0 ? 'Send Reminder' : 'Send Alert'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {showModal && (
        <CompleteStageModal
          title="Complete EMD Processing"
          description={
            emdRequired
              ? `Confirm EMD DD / Online Receipt / Exemption document is attached. Marks Stage 6 as complete — this will notify ${bid.account_manager?.full_name || 'the Account Manager'} and ${bid.presales?.full_name || 'Pre-Sales'} that it's ready for Internal Approval.`
              : "Confirm EMD DD / Online Receipt / Exemption document is attached. Marks Stage 6 as complete."
          }
          stageKey="EMD_PROCESSING"
          bidId={bid.id}
          bid={bid}
          onClose={() => setShowModal(false)}
          onComplete={onRefresh}
          hideDefaultRemarks={emdRequired}
          remarksValue={handoffRemarks}
        >
          {emdRequired && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Message for Account Manager &amp; Pre-Sales</Label>
              <Textarea
                value={handoffRemarks}
                onChange={(e) => setHandoffRemarks(e.target.value)}
                placeholder="Anything they should know before reviewing for Internal Approval..."
                className="text-xs min-h-[80px]"
                required
              />
            </div>
          )}
        </CompleteStageModal>
      )}
    </div>
  )
}


// ── Stage 8: Internal Approval ──────────────────────────────────────────────
// Both the Account Manager and Pre-Sales assigned to a tender must sign off
// Internal Approval independently — resolved from the shared stage history
// (eventType 'APPROVAL', details.role) rather than a new backend column,
// the same audit-trail-first approach as useStageCompletedBy.
function useInternalApprovals(bidId, bid) {
  const [approvals, setApprovals] = useState({ ACCOUNT_MANAGER: null, PRESALES: null })
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let cancelled = false
    // limit: 200 — scans for the latest approval per role, not a page to render.
    getBidStageHistory(bidId, { limit: 200 }).then((res) => {
      if (cancelled || !res.ok) return
      const next = { ACCOUNT_MANAGER: null, PRESALES: null }
      // res.data is newest-first — only fill a role from its first (i.e.
      // most recent) matching entry, so an older approval can't overwrite it.
      ;(res.data || [])
        .filter((h) => h.to_stage === 'INTERNAL_APPROVAL' && h.event_type === 'APPROVAL')
        .forEach((h) => {
          const role = h.details?.role
          if ((role === 'ACCOUNT_MANAGER' || role === 'PRESALES') && !next[role]) {
            next[role] = {
              name: h.transitioned_by?.full_name || h.transitioned_by?.username || 'someone',
              comment: h.details?.comment || h.transition_reason || '',
              at: h.created_at,
            }
          }
        })
      setApprovals(next)
    }).catch(() => {})
    return () => { cancelled = true }
    // bid?.updated_at (bumped by the backend on every write) makes the
    // header refresh button re-fetch this too — bid was already accepted as
    // a param for this but wasn't actually used anywhere.
  }, [bidId, reload, bid?.updated_at])
  return [approvals, () => setReload((n) => n + 1)]
}

function InternalApprovalDialog({ role, roleLabel, bid, onClose, onDone }) {
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!comment.trim()) { toast.error('A comment is required before approving'); return }
    setSubmitting(true)
    try {
      await logStageMicroEvent(bid.id, {
        fromStage: 'INTERNAL_APPROVAL',
        toStage: 'INTERNAL_APPROVAL',
        eventType: 'APPROVAL',
        transitionReason: comment.trim(),
        details: { role, comment: comment.trim() },
      })
      const currentUser = tokenStorage.getUser()
      if (bid.bid_owner?.id) {
        import('../../services/alerts').then(({ createAlert }) => {
          createAlert({
            user_id: bid.bid_owner.id,
            bid_id: bid.id,
            type: 'APPROVAL',
            created_by: currentUser?.id,
            title: `Internal Approval — ${roleLabel} signed off: ${bid.title}`,
            message: `<p style="margin:0 0 12px 0;">${currentUser?.full_name || currentUser?.username || roleLabel} (${roleLabel}) approved Internal Approval for '<strong>${bid.title}</strong>'.</p><div style="margin:0;padding:10px 14px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;color:#334155;font-size:13px;">${comment.trim()}</div>`,
          })
        })
      }
      toast.success(`Approved as ${roleLabel}`)
      onDone()
    } catch {
      toast.error('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-foreground">
          <CheckCircle2 className="size-5 text-yellow-600" />
          <h3 className="text-base font-semibold font-heading">Approve as {roleLabel}</h3>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Comment *</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What you reviewed, any conditions, or context for the Bid Executive..."
              className="text-xs min-h-[120px]"
              required
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button type="submit" size="sm" disabled={submitting} className="gap-2">
              {submitting ? <><Loader2 className="size-3.5 animate-spin" /> Approving...</> : 'Approve'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

export function Stage8Workspace({ bid, onRefresh }) {
  const [showModal, setShowModal] = useState(false)
  const [approvingRole, setApprovingRole] = useState(null) // 'ACCOUNT_MANAGER' | null
  const { user: currentUser, isAdmin } = usePermissions()
  const isAssignedAM = !!currentUser?.id && currentUser.id === bid?.account_manager?.id
  const [approvals, refetchApprovals] = useInternalApprovals(bid.id, bid)
  // Only the Account Manager's sign-off is required to advance this stage —
  // Pre-Sales approval was dropped from the gate (they can still view the
  // stage; see the PRE_SALES access-control list elsewhere in this file).
  const amApproved = !!approvals.ACCOUNT_MANAGER
  const stageCompleted = bid?.stage_completions?.INTERNAL_APPROVAL === true
  const completedBy = useStageCompletedBy(bid.id, 'INTERNAL_APPROVAL', stageCompleted)

  const handleReminder = async (role, name, userId) => {
    if (!userId) return
    const currentUser = tokenStorage.getUser()
    try {
      await import('../../services/alerts').then(({ createAlert }) =>
        createAlert({
          user_id: userId,
          bid_id: bid.id,
          type: 'ACTION_REQUIRED',
          created_by: currentUser?.id,
          title: `Reminder: Internal Approval needed — ${bid.title}`,
          message: `<p>Tender '${bid.title}' is still awaiting your Internal Approval sign-off.</p>`,
        })
      )
      logStageMicroEvent(bid.id, {
        fromStage: 'INTERNAL_APPROVAL',
        toStage: 'INTERNAL_APPROVAL',
        eventType: 'REMINDER',
        transitionReason: `Sent an Internal Approval reminder to ${name} (Account Manager)`,
      })
      toast.success(`Reminder sent to ${name}`)
    } catch {
      toast.error('Failed to send reminder')
    }
  }

  const rows = [
    { role: 'ACCOUNT_MANAGER', label: 'Account Manager', person: bid.account_manager, approval: approvals.ACCOUNT_MANAGER, isAssigned: isAssignedAM },
  ]

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20 dark:border-yellow-900/50 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-300">Stage 7: Internal Sign-off & Approval</h3>
          <p className="text-xs text-yellow-700 dark:text-yellow-400">
            The assigned Account Manager must approve.
          </p>
        </div>
        <StageHeaderActions
          bid={bid}
          stageKey="INTERNAL_APPROVAL"
          onCompleteClick={() => setShowModal(true)}
          onRefresh={onRefresh}
          completeLabel="Approve & Unlock Bid Submission"
          completeClass="bg-yellow-600 hover:bg-yellow-700 text-white"
          disabled={!amApproved || !(isAssignedAM || isAdmin)}
          disabledTooltip={!amApproved ? 'The Account Manager must approve first.' : 'Only the assigned Account Manager or an Admin can advance this stage.'}
        />
      </div>

      {stageCompleted && completedBy && (
        <div className="px-3.5 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 max-w-md">
          <CheckCircle2 className="size-3.5" /> Advanced by {completedBy.name} on {fmtDate(completedBy.at)}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Approvals</h4>
        <div className="overflow-x-auto rounded-md border border-border/60">
          <table className="text-xs w-full">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground">
                <th className="px-3 py-1.5 text-left font-semibold">Role</th>
                <th className="px-3 py-1.5 text-left font-semibold">Name</th>
                <th className="px-3 py-1.5 text-left font-semibold">Status</th>
                <th className="px-3 py-1.5 text-left font-semibold min-w-[220px]">Comment</th>
                <th className="px-3 py-1.5 text-left font-semibold">Approved At</th>
                <th className="px-3 py-1.5 text-left font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.role} className="border-t border-border/60">
                  <td className="px-3 py-2 font-semibold text-foreground">{r.label}</td>
                  <td className="px-3 py-2 text-foreground">{r.person?.full_name || '—'}</td>
                  <td className="px-3 py-2">
                    {r.approval ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-300 dark:border-emerald-800 text-[10px]">✓ Approved</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold border border-amber-300 dark:border-amber-800 text-[10px]">⏳ Pending</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.approval?.comment || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.approval ? fmtDateTime(r.approval.at) : '—'}</td>
                  <td className="px-3 py-2">
                    {r.approval ? null : r.isAssigned ? (
                      <Button size="sm" onClick={() => setApprovingRole(r.role)} className="h-7 text-[11px] gap-1 bg-yellow-600 hover:bg-yellow-700 text-white">
                        <CheckCircle2 className="size-3" /> Approve
                      </Button>
                    ) : r.person ? (
                      <Button size="sm" variant="outline" onClick={() => handleReminder(r.role, r.person.full_name, r.person.id)} className="h-7 text-[11px] gap-1">
                        <Bell className="size-3" /> Remind
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {approvingRole && (
        <InternalApprovalDialog
          role={approvingRole}
          roleLabel="Account Manager"
          bid={bid}
          onClose={() => setApprovingRole(null)}
          onDone={() => { setApprovingRole(null); refetchApprovals(); onRefresh() }}
        />
      )}

      {showModal && (
        <CompleteStageModal
          title="Approve Bid Submission"
          description="Marks Stage 7 (Internal Approval) as complete. This will unlock Stage 8: Bid Submission."
          stageKey="INTERNAL_APPROVAL"
          bidId={bid.id}
          bid={bid}
          onClose={() => setShowModal(false)}
          onComplete={onRefresh}
        />
      )}
    </div>
  )
}

// ── Stage 9: Tender Submission (GeM Portal) ─────────────────────────────────
export function Stage9Workspace({ bid, onRefresh }) {
  const [showModal, setShowModal] = useState(false)
  const { isLocked } = checkStageState(bid, 'GEM_SUBMISSION')

  // Final submitted price is no longer hand-typed — it's sourced from Stage 4's
  // (Pricing Request) approved GlobX Total (incl. GST). If pricing was never
  // sent through approval, fall back to a live recalculation so the stage
  // isn't blocked, but flag it clearly since it isn't a locked-in figure yet.
  const pricingWorkspace = bid?.pricing_workspace && typeof bid.pricing_workspace === 'object' ? bid.pricing_workspace : null
  let finalPriceNum = pricingWorkspace?.approvedGrandTotal ?? null
  let priceSource = finalPriceNum != null ? 'approved' : 'none'
  if (finalPriceNum == null && pricingWorkspace) {
    const { l1Calculations } = computeL1PricingSummary(pricingWorkspace)
    if (l1Calculations) {
      finalPriceNum = l1Calculations.grandGlobxTotal
      priceSource = 'live'
    }
  }

  const handleConfettiSubmit = async (remarks) => {
    let priceNum = finalPriceNum != null ? Number(finalPriceNum) : (bid?.quoted_price ? Number(bid.quoted_price) : null)
    try {
      // Save the final quoted price submitted on GeM to the bid record
      if (priceNum) {
        await updateBid(bid.id, { quoted_price: priceNum }).catch(() => {})
      }
      if (typeof confetti === 'function') {
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })
      }
    } catch { /* non-fatal animation */ }
    onRefresh()

    return {
      customReason: priceNum
        ? `Tender Final Submission Recorded — Offered Price on GeM Portal: ${fmtMoney(priceNum)} (Remarks: ${remarks})`
        : `Tender Final Submission Recorded on GeM Portal (Remarks: ${remarks})`,
      quoted_price: priceNum,
      submission_portal: 'GeM Portal',
      submitted_at: new Date().toISOString(),
      remarks: remarks
    }
  }

  if (isLocked) {
    return (
      <div className="space-y-4">
        <div className="p-6 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 text-center">
          <Hourglass className="size-10 mx-auto text-amber-500 mb-3" />
          <h3 className="text-base font-bold text-amber-900 dark:text-amber-300">Stage Locked — Awaiting Internal Approval</h3>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 max-w-sm mx-auto">Bid Submission is locked until Stage 7 (Internal Sign-off) is fully approved. Please complete internal approval first.</p>
          <span className="mt-3 inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold border border-amber-300">Current Stage: {bid.workflow_stage?.replace(/_/g,' ')}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-lime-200 bg-lime-50/50 dark:bg-lime-950/20 dark:border-lime-900/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-lime-900 dark:text-lime-300">Stage 8: Tender Submission — GeM Portal</h3>
          <p className="text-xs text-lime-700 dark:text-lime-400">Record GeM Portal submission confirmation and final offered bid price.</p>
        </div>
        <StageHeaderActions
          bid={bid}
          stageKey="GEM_SUBMISSION"
          onCompleteClick={() => setShowModal(true)}
          onRefresh={onRefresh}
          completeLabel="Mark Submission Done 🎉"
          completeClass="bg-lime-600 hover:bg-lime-700 text-white"
        />
      </div>

      {showModal && (
        <CompleteStageModal
          title="Record Bid Submission"
          description="Marks Stage 8 (Bid Submission) as complete. Enter final bid price submitted on GeM portal."
          stageKey="GEM_SUBMISSION"
          bidId={bid.id}
          bid={bid}
          onClose={() => setShowModal(false)}
          onComplete={handleConfettiSubmit}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Final Submitted Bid Price (₹)</Label>
              {priceSource === 'approved' && (
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 dark:bg-emerald-950/30 dark:text-emerald-400">
                  ✓ From Stage 4's approved pricing
                </span>
              )}
              {priceSource === 'live' && (
                <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 dark:bg-amber-950/30 dark:text-amber-400">
                  ⚠ Not yet approved — live calculation
                </span>
              )}
            </div>
            <div className="h-9 px-3 border border-input rounded-md bg-muted/30 flex items-center text-sm font-mono font-bold text-foreground">
              {finalPriceNum != null ? fmtMoney(finalPriceNum) : 'Not set — complete Stage 4 (Pricing Request) first'}
            </div>
            <p className="text-[10px] text-muted-foreground">This value comes from the Pricing Request stage's GlobX Total (incl. GST) — it is not editable here. It will be saved as your official quoted price for all further comparisons.</p>
          </div>
        </CompleteStageModal>
      )}
    </div>
  )
}

// ── Stage 10: Technical Evaluation ─────────────────────────────────────────
export function Stage10Workspace({ bid, onRefresh }) {
  const [showModal, setShowModal] = useState(false)
  const [status, setStatus] = useState('QUALIFIED')
  const [disqualifyReason, setDisqualifyReason] = useState('')

  const handleResult = async (remarks) => {
    if (status === 'QUALIFIED') {
      confetti({ particleCount: 100, spread: 60 })
      // Stage 9 completion is handled atomically by CompleteStageModal
      await updateBid(bid.id, { technical_result: 'QUALIFIED' })
    } else {
      // Setting technical_result to DISQUALIFIED triggers the backend's
      // auto-disqualification rule: it forces bid_status/bid_outcome to LOST,
      // writes stage history, and sets workflow_stage to the terminal LOST
      // state directly — so Financial Evaluation and Award & Handover are
      // correctly locked out instead of being left reachable.
      await updateBid(bid.id, {
        technical_result: 'DISQUALIFIED',
        disqualification_reason: disqualifyReason,
      })
    }
    onRefresh()
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/50 dark:bg-teal-950/20 dark:border-teal-900/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-teal-900 dark:text-teal-300">Stage 9: Technical Evaluation</h3>
          <p className="text-xs text-teal-700 dark:text-teal-400">Record official technical qualification status from procuring authority.</p>
        </div>
        <StageHeaderActions
          bid={bid}
          stageKey="TECHNICAL_EVALUATION"
          onCompleteClick={() => setShowModal(true)}
          onRefresh={onRefresh}
          completeLabel="Add Technical Eval Result"
          completeClass="bg-teal-600 hover:bg-teal-700 text-white"
        />
      </div>

      {showModal && (
        <CompleteStageModal
          title="Record Technical Evaluation Result"
          stageKey="TECHNICAL_EVALUATION"
          bidId={bid.id}
          bid={bid}
          onClose={() => setShowModal(false)}
          onComplete={handleResult}
          hideDefaultRemarks={status === 'DISQUALIFIED'}
          remarksValue={status === 'DISQUALIFIED' ? disqualifyReason : undefined}
        >
          <div className="space-y-2">
            <Label className="text-xs font-medium">Evaluation Decision *</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="radio" name="techeval" checked={status === 'QUALIFIED'} onChange={() => setStatus('QUALIFIED')} />
                <span className="font-semibold text-emerald-600">✓ Technically Qualified</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="radio" name="techeval" checked={status === 'DISQUALIFIED'} onChange={() => setStatus('DISQUALIFIED')} />
                <span className="font-semibold text-destructive">✕ Disqualified</span>
              </label>
            </div>
          </div>
          {status === 'DISQUALIFIED' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Disqualification Reason *</Label>
              <Textarea value={disqualifyReason} onChange={e => setDisqualifyReason(e.target.value)} placeholder="Specify reason..." required />
            </div>
          )}
        </CompleteStageModal>
      )}
    </div>
  )
}


export function Stage11Workspace({ bid, onRefresh }) {
  const [showModal, setShowModal] = useState(false)
  const [outcome, setOutcome] = useState('WON')
  const [l1Name, setL1Name] = useState(bid?.l1_company_name || '')
  const [l1Price, setL1Price] = useState(bid?.l1_price ? String(bid.l1_price) : '')
  const [ourRank, setOurRank] = useState(bid?.our_rank || '')

  // Pre-populate from Stage 9: quoted_price is saved when Stage 9 completes.
  // gem_submission_price is an alternate field. User can still edit if needed.
  const stage9Price = bid?.quoted_price || bid?.gem_submission_price || ''
  const [ourPrice, setOurPrice] = useState(stage9Price ? String(stage9Price) : '')

  // Resync when the bid prop updates after mount (e.g. switching stage tabs
  // without a full remount) — otherwise a real Stage 9 price can be masked by
  // the stale one-time useState initializer above.
  useEffect(() => {
    if (stage9Price) setOurPrice(String(stage9Price))
  }, [stage9Price])
  // Same resync need for the L1/rank fields — a refresh (this session's own
  // header button, or another session's edit) otherwise leaves these frozen
  // at whatever they were when this stage tab was first opened.
  useEffect(() => {
    setL1Name(bid?.l1_company_name || '')
    setL1Price(bid?.l1_price ? String(bid.l1_price) : '')
    setOurRank(bid?.our_rank || '')
  }, [bid?.l1_company_name, bid?.l1_price, bid?.our_rank])

  const l1PriceNum = Number(l1Price) || 0
  const ourPriceNum = Number(ourPrice) || 0
  const priceDiffPct = (l1PriceNum > 0 && ourPriceNum > 0)
    ? (((ourPriceNum - l1PriceNum) / l1PriceNum) * 100)
    : null

  const buildFormalReason = (remarks) => {
    const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    if (outcome === 'LOST') {
      return [
        `Financial Opening Result — ${date}`,
        ``,
        `Outcome: LOST`,
        `L1 (Lowest Bidder): ${l1Name || 'N/A'} quoted at ${fmtMoney(l1PriceNum)}.`,
        `GlobX Quoted Price (as submitted on GeM Portal): ${fmtMoney(ourPriceNum)}.`,
        `GlobX Rank: ${ourRank || 'N/A'}.`,
        `Price Variance vs L1: ${priceDiffPct !== null ? (priceDiffPct > 0 ? '+' : '') + priceDiffPct.toFixed(2) + '% (GlobX quoted ' + (priceDiffPct > 0 ? 'higher' : 'lower') + ' than L1)' : 'N/A'}.`,
        ``,
        `Additional Remarks: ${remarks}`,
      ].join('\n')
    } else {
      return [
        `Financial Opening Result — ${date}`,
        ``,
        `Outcome: WON / L1`,
        `GlobX has been determined as the L1 bidder.`,
        `GlobX Quoted Price (as submitted on GeM Portal): ${fmtMoney(ourPriceNum)}.`,
        ``,
        `Additional Remarks: ${remarks}`,
      ].join('\n')
    }
  }

  const handleFinancialResult = async (remarks) => {
    const formalReason = buildFormalReason(remarks)
    const nowISO = new Date().toISOString()
    if (outcome === 'WON') {
      confetti({ particleCount: 150, spread: 90 })
      await updateBid(bid.id, {
        bid_outcome: 'WON',
        outcome_reason: formalReason,
        our_rank: 'L1',
      }).catch(() => {})
      await recordBidOutcome(bid.id, {
        bid_outcome: 'WON',
        quoted_price: ourPriceNum || undefined,
        outcome_reason: formalReason,
        result_date: nowISO,
      }).catch(() => {})
    } else {
      // Persist all L1 analytics to the bid record via PATCH
      await updateBid(bid.id, {
        l1_company_name: l1Name || undefined,
        l1_price: l1PriceNum || undefined,
        quoted_price: ourPriceNum || undefined,
        price_difference_pct: priceDiffPct !== null ? Number(priceDiffPct.toFixed(2)) : undefined,
        our_rank: ourRank || undefined,
      }).catch(() => {})
      await recordBidOutcome(bid.id, {
        bid_outcome: 'LOST',
        l1_price: l1PriceNum || undefined,
        quoted_price: ourPriceNum || undefined,
        outcome_reason: formalReason,
        result_date: nowISO,
      })
    }
    onRefresh()

    return {
      customReason: outcome === 'WON'
        ? `Financial Opening Outcome: WON / L1 — Offered Price: ${fmtMoney(ourPriceNum)} (Remarks: ${remarks})`
        : `Financial Opening Outcome: LOST — L1 Bidder (${l1Name || 'N/A'}) @ ${fmtMoney(l1PriceNum)} vs GlobX @ ${fmtMoney(ourPriceNum)} (Diff: ${priceDiffPct !== null ? (priceDiffPct > 0 ? '+' : '') + priceDiffPct.toFixed(2) + '%' : 'N/A'}) (Remarks: ${remarks})`,
      outcome: outcome,
      quoted_price: ourPriceNum || null,
      l1_price: l1PriceNum || null,
      l1_company_name: l1Name || null,
      price_difference_pct: priceDiffPct !== null ? Number(priceDiffPct.toFixed(2)) : null,
      our_rank: ourRank || null,
      remarks: remarks
    }
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-cyan-200 bg-cyan-50/50 dark:bg-cyan-950/20 dark:border-cyan-900/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-cyan-900 dark:text-cyan-300">Stage 10: Financial Evaluation &amp; L1 Determination</h3>
          <p className="text-xs text-cyan-700 dark:text-cyan-400">Record financial bid opening outcome (L1 / Won / Lost).</p>
        </div>
        <StageHeaderActions
          bid={bid}
          stageKey="FINANCIAL_EVALUATION"
          onCompleteClick={() => setShowModal(true)}
          onRefresh={onRefresh}
          completeLabel="Record Financial Result"
          completeClass="bg-cyan-600 hover:bg-cyan-700 text-white"
        />
      </div>

      {/* Show existing L1 result if already recorded */}
      {(bid?.l1_company_name || bid?.l1_price || bid?.our_rank) && (
        <div className="rounded-xl border border-cyan-200 bg-cyan-50/30 dark:bg-cyan-950/10 p-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">Recorded Financial Result</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {bid.l1_company_name && <div><span className="text-muted-foreground block">L1 Company</span><span className="font-bold text-foreground">{bid.l1_company_name}</span></div>}
            {bid.l1_price && <div><span className="text-muted-foreground block">L1 Price</span><span className="font-mono font-bold text-red-600">{fmtMoney(bid.l1_price)}</span></div>}
            {bid.quoted_price && <div><span className="text-muted-foreground block">Our Quoted Price</span><span className="font-mono font-bold text-foreground">{fmtMoney(bid.quoted_price)}</span></div>}
            {bid.our_rank && <div><span className="text-muted-foreground block">Our Rank</span><span className="font-bold text-foreground">{bid.our_rank}</span></div>}
            {bid.price_diff_pct != null && (
              <div><span className="text-muted-foreground block">Price Difference</span>
                <span className={`font-bold font-mono ${bid.price_diff_pct > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {bid.price_diff_pct > 0 ? '+' : ''}{bid.price_diff_pct.toFixed(2)}%
                  <span className="ml-1 text-muted-foreground font-normal">{bid.price_diff_pct > 0 ? '(we quoted higher)' : '(we quoted lower)'}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <CompleteStageModal
          title="Record Financial Opening Result"
          stageKey="FINANCIAL_EVALUATION"
          bidId={bid.id}
          bid={bid}
          onClose={() => setShowModal(false)}
          onComplete={handleFinancialResult}
        >
          <div className="space-y-2">
            <Label className="text-xs font-medium">Outcome Status *</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="radio" name="fineval" checked={outcome === 'WON'} onChange={() => setOutcome('WON')} />
                <span className="font-semibold text-emerald-600">🏆 L1 / Won</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="radio" name="fineval" checked={outcome === 'LOST'} onChange={() => setOutcome('LOST')} />
                <span className="font-semibold text-destructive">❌ Lost</span>
              </label>
            </div>
          </div>
          {/* Our GeM Submitted Price — pre-filled from Stage 8, always editable. Our Rank sits
              beside it (not beside L1 Company) since Rank qualifies our own price, not L1's. */}
          <div className={`grid gap-3 ${outcome === 'LOST' ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Our GeM Submitted Price (₹) *</Label>
                {stage9Price ? (
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 dark:bg-emerald-950/30 dark:text-emerald-400">
                    ✓ Auto-filled from Stage 8
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-600 italic">Stage 8 price not set — enter manually</span>
                )}
              </div>
              <Input
                type="number"
                value={ourPrice}
                onChange={e => setOurPrice(e.target.value)}
                placeholder="Enter the exact price submitted on GeM portal"
                className={`h-8 text-xs font-mono ${stage9Price && !ourPrice ? 'border-amber-300' : ''}`}
              />
              {ourPriceNum > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  ≈ {fmtMoney(ourPriceNum)} — this is the price GlobX submitted on GeM Portal
                </p>
              )}
            </div>
            {outcome === 'LOST' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Our Rank (e.g. L2, L3)</Label>
                <Input size="sm" value={ourRank} onChange={e => setOurRank(e.target.value)} placeholder="e.g. L2" className="h-8 text-xs"/>
              </div>
            )}
          </div>
          {outcome === 'LOST' && (
            <div className="space-y-3">
              <div className="space-y-1"><Label className="text-xs">L1 Company Name</Label><Input size="sm" value={l1Name} onChange={e => setL1Name(e.target.value)} placeholder="Winning bidder name" className="h-8 text-xs"/></div>
              <div className="space-y-1"><Label className="text-xs">L1 Price (₹)</Label><Input type="number" size="sm" value={l1Price} onChange={e => setL1Price(e.target.value)} placeholder="Winning price" className="h-8 text-xs"/></div>
              {/* Auto price-diff calculation */}
              {l1PriceNum > 0 && ourPriceNum > 0 && (
                <div className={`p-2.5 rounded-lg border text-xs space-y-1 ${priceDiffPct > 0 ? 'bg-red-50 border-red-200 dark:bg-red-950/20' : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20'}`}>
                  <p className="font-semibold text-muted-foreground">Auto Price Comparison</p>
                  <div className="flex justify-between"><span>Our Price:</span><span className="font-mono font-bold">{fmtMoney(ourPriceNum)}</span></div>
                  <div className="flex justify-between"><span>L1 Price:</span><span className="font-mono font-bold text-red-600">{fmtMoney(l1PriceNum)}</span></div>
                  <div className="flex justify-between border-t border-border/60 pt-1">
                    <span>Difference:</span>
                    <span className={`font-mono font-bold ${priceDiffPct > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {priceDiffPct > 0 ? '+' : ''}{priceDiffPct.toFixed(2)}% {priceDiffPct > 0 ? '(we quoted higher by this %)' : '(we quoted lower)'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </CompleteStageModal>
      )}
    </div>
  )
}

// ── Stage 12: Award & Handover ──────────────────────────────────────────────
// Award & Delivery (WON path only — LOST/CANCELLED tenders render EmdReturnWorkspace
// or a disabled panel instead, dispatched by DynamicStageWorkspace based on outcome).
// Flow: PO Received first — everything else stays disabled until it's checked.
// Once received, EMD Returned is always available; BG Submitted only appears
// when the tender actually requires a Bank Guarantee.
export function Stage12Workspace({ bid, onRefresh }) {
  const [showModal, setShowModal] = useState(false)
  const [emdReturned, setEmdReturned] = useState(!!bid?.emd_returned)
  const [bgProceeded, setBgProceeded] = useState(!!bid?.bg_discharged)
  const [poReceived, setPoReceived] = useState(bid?.po_received_status === 'PO Received')
  const [deliveryComplete, setDeliveryComplete] = useState(!!bid?.delivery_complete)
  const [bgTargetDate, setBgTargetDate] = useState(bid?.bg_target_date ? bid.bg_target_date.slice(0, 10) : '')

  const bgRequired = !!bid?.bg_required
  const emdNotApplicable = !!bid?.emd_not_applicable
  const emdExempted = !!bid?.emd_exempted || emdNotApplicable

  useEffect(() => {
    setEmdReturned(!!bid?.emd_returned)
    setBgProceeded(!!bid?.bg_discharged)
    setPoReceived(bid?.po_received_status === 'PO Received')
    setDeliveryComplete(!!bid?.delivery_complete)
    setBgTargetDate(bid?.bg_target_date ? bid.bg_target_date.slice(0, 10) : '')
  }, [bid?.emd_returned, bid?.bg_discharged, bid?.po_received_status, bid?.delivery_complete, bid?.bg_target_date])

  const handlePoReceivedToggle = async (checked) => {
    setPoReceived(checked)
    try {
      const res = await updateBid(bid.id, {
        po_received_status: checked ? 'PO Received' : 'Pending',
        po_received_date: checked ? new Date().toISOString() : null,
      })
      if (res.ok) {
        logStageMicroEvent(bid.id, {
          fromStage: 'AWARD_HANDOVER',
          toStage: 'AWARD_HANDOVER',
          eventType: 'FINANCE',
          transitionReason: checked
            ? 'Purchase Order (PO) confirmed as Received from Procuring Authority'
            : 'PO Received status reverted to Pending',
          details: { poReceived: checked }
        })
        toast.success(checked ? '✅ PO marked as Received' : 'PO status set to Pending')
        onRefresh()
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleBgTargetDateChange = async (value) => {
    setBgTargetDate(value)
    if (!value) return
    try {
      const res = await updateBid(bid.id, { bg_target_date: new Date(value).toISOString() })
      if (res.ok) {
        logStageMicroEvent(bid.id, {
          fromStage: 'AWARD_HANDOVER',
          toStage: 'AWARD_HANDOVER',
          eventType: 'FINANCE',
          transitionReason: `Set target date for Bank Guarantee issuance: ${value}`,
          details: { bgTargetDate: value }
        })
        toast.success('BG target date saved')
        onRefresh()
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleEmdToggle = async (checked) => {
    setEmdReturned(checked)
    try {
      const res = await updateBid(bid.id, {
        emd_returned: checked,
        emd_returned_date: checked ? new Date().toISOString() : null,
      })
      if (res.ok) {
        logStageMicroEvent(bid.id, {
          fromStage: 'AWARD_HANDOVER',
          toStage: 'AWARD_HANDOVER',
          eventType: 'FINANCE',
          transitionReason: checked ? 'Marked EMD as Refunded / Returned by Procuring Authority' : 'Marked EMD Return as Pending',
          details: { emdReturned: checked }
        })
        toast.success(checked ? 'EMD marked as Returned' : 'EMD marked as Pending Return')
        onRefresh()
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleBgToggle = async (checked) => {
    setBgProceeded(checked)
    try {
      const res = await updateBid(bid.id, {
        bg_discharged: checked,
        bg_discharged_date: checked ? new Date().toISOString() : null,
      })
      if (res.ok) {
        logStageMicroEvent(bid.id, {
          fromStage: 'AWARD_HANDOVER',
          toStage: 'AWARD_HANDOVER',
          eventType: 'FINANCE',
          transitionReason: checked ? 'Marked Bank Guarantee (BG) as Issued' : 'Marked BG as Pending Issuance',
          details: { bgDischarged: checked }
        })
        toast.success(checked ? 'BG recorded as Issued' : 'BG marked pending')
        onRefresh()
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleDeliveryToggle = async (checked) => {
    setDeliveryComplete(checked)
    try {
      const res = await updateBid(bid.id, {
        delivery_complete: checked,
        delivery_complete_date: checked ? new Date().toISOString() : null,
      })
      if (res.ok) {
        logStageMicroEvent(bid.id, {
          fromStage: 'AWARD_HANDOVER',
          toStage: 'AWARD_HANDOVER',
          eventType: 'FINANCE',
          transitionReason: checked ? 'Marked Delivery / Work as Complete' : 'Delivery / Work Complete reverted to pending',
          details: { deliveryComplete: checked }
        })
        toast.success(checked ? 'Delivery / Work marked Complete' : 'Delivery / Work marked pending')
        onRefresh()
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleFinalClose = async (remarks) => {
    await recordBidOutcome(bid.id, {
      bid_outcome: 'WON',
      outcome_reason: `Award & Handover Completed. PO Received: ${poReceived ? 'Yes' : 'Pending'}${bgRequired ? `, BG Issued: ${bgProceeded ? 'Yes' : 'No'}` : ''}, Delivery/Work Complete: ${deliveryComplete ? 'Yes' : 'No'}${emdNotApplicable ? ', EMD: Not Applicable' : emdExempted ? ', EMD: Exempted' : `, EMD Returned: ${emdReturned ? 'Yes' : 'No'}`}. ${remarks}`,
    })
    confetti({ particleCount: 200, spread: 100 })
    onRefresh()
  }

  const handleCompleteClick = () => {
    if (!poReceived) {
      toast.error('Mandatory: Purchase Order (PO) must be marked Received first.')
      return
    }
    if (bgRequired && !bgProceeded) {
      toast.error('Mandatory: Bank Guarantee (BG) must be confirmed for this tender.')
      return
    }
    if (!deliveryComplete) {
      toast.error('Mandatory: Delivery / Work Complete must be confirmed before closing this stage.')
      return
    }
    if (!emdExempted && !emdReturned) {
      toast.error('Mandatory: EMD Return must be confirmed before closing this stage.')
      return
    }
    setShowModal(true)
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">Stage 11: Contract Award &amp; Operations Handover</h3>
          <p className="text-xs text-emerald-700 dark:text-emerald-400">Confirm Purchase Order receipt, then Bank Guarantee (if required), Delivery/Work Complete, and EMD return — in that order.</p>
        </div>
        <StageHeaderActions
          bid={bid}
          stageKey="AWARD_HANDOVER"
          onCompleteClick={handleCompleteClick}
          onRefresh={onRefresh}
          completeLabel="Close Bid as WON 🏆"
          completeClass="bg-emerald-600 hover:bg-emerald-700 text-white"
        />
      </div>

      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Award &amp; Delivery Checklist</h4>
        <div className="space-y-2 text-xs">
          {/* Order: PO Received -> Bank Guarantee Issued (if required) -> Delivery/Work
              Complete -> EMD Returned (last). Step numbers adapt to which optional
              steps actually apply to this tender. */}
          {(() => {
            let n = 1
            const poStep = n
            const bgStep = bgRequired ? ++n : null
            const deliveryStep = ++n
            const emdStep = !emdExempted ? ++n : null
            return (
              <>
                {/* Step 1: PO Received — always enabled, gates everything else */}
                <label className={`flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border transition-colors ${
                  poReceived
                    ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                    : 'border-amber-200 bg-amber-50/30 dark:bg-amber-950/10 hover:bg-amber-50/50'
                }`}>
                  <input type="checkbox" checked={poReceived} onChange={e => handlePoReceivedToggle(e.target.checked)} className="rounded" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{poStep}. Purchase Order (PO) Received</span>
                      {poReceived ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 rounded px-1.5 py-0.5">✓ Received</span>
                      ) : (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-300 rounded px-1.5 py-0.5">⏳ Pending</span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-[10px] mt-0.5">Confirm Purchase Order has been formally received from the procuring authority</p>
                    {bid?.po_received_date && <p className="text-muted-foreground text-[10px] font-mono">Received: {new Date(bid.po_received_date).toLocaleDateString('en-IN')}</p>}
                  </div>
                </label>

                {/* Step (conditional): Bank Guarantee Issued — enabled only once PO received, shown only if BG required */}
                {bgRequired && (
                  <label className={`flex items-center gap-2 p-2.5 rounded-lg border transition-colors ${
                    poReceived ? 'cursor-pointer border-border hover:bg-muted/20' : 'cursor-not-allowed border-border/50 opacity-50'
                  }`}>
                    <input type="checkbox" checked={bgProceeded} disabled={!poReceived} onChange={e => handleBgToggle(e.target.checked)} className="rounded" />
                    <div className="flex-1">
                      <span className="font-medium">{bgStep}. Bank Guarantee Issued</span>
                      <p className="text-muted-foreground text-[10px]">{poReceived ? 'Confirm the Bank Guarantee has been issued to the procuring authority' : 'Unlocks once PO is marked Received'}</p>
                      {bid?.bg_discharged_date && <p className="text-muted-foreground text-[10px] font-mono">Issued: {new Date(bid.bg_discharged_date).toLocaleDateString('en-IN')}</p>}
                      {poReceived && (
                        <div className="mt-1.5" onClick={e => e.stopPropagation()}>
                          <Label className="text-[10px] font-medium text-muted-foreground">BG to be issued by</Label>
                          <Input type="date" value={bgTargetDate} onChange={e => handleBgTargetDateChange(e.target.value)} className="h-7 text-[11px] mt-0.5 max-w-[160px]" />
                        </div>
                      )}
                    </div>
                  </label>
                )}

                {/* Step: Delivery / Work Complete — enabled only once PO received (and BG issued, if required) */}
                <label className={`flex items-center gap-2 p-2.5 rounded-lg border transition-colors ${
                  poReceived && (!bgRequired || bgProceeded) ? 'cursor-pointer border-border hover:bg-muted/20' : 'cursor-not-allowed border-border/50 opacity-50'
                }`}>
                  <input type="checkbox" checked={deliveryComplete} disabled={!poReceived || (bgRequired && !bgProceeded)} onChange={e => handleDeliveryToggle(e.target.checked)} className="rounded" />
                  <div>
                    <span className="font-medium">{deliveryStep}. Delivery / Work Complete</span>
                    <p className="text-muted-foreground text-[10px]">
                      {!poReceived ? 'Unlocks once PO is marked Received' : (bgRequired && !bgProceeded) ? 'Unlocks once Bank Guarantee is Issued' : 'Confirm delivery, installation, or work has been completed'}
                    </p>
                    {bid?.delivery_complete_date && <p className="text-muted-foreground text-[10px] font-mono">Completed: {new Date(bid.delivery_complete_date).toLocaleDateString('en-IN')}</p>}
                  </div>
                </label>

                {/* Step (conditional): EMD Returned — only when EMD wasn't exempted; last in the order,
                    unlocked only once every step before it (PO, BG if required, Delivery) is done */}
                {!emdExempted && (() => {
                  const emdUnlocked = poReceived && (!bgRequired || bgProceeded) && deliveryComplete
                  return (
                    <label className={`flex items-center gap-2 p-2.5 rounded-lg border transition-colors ${
                      emdUnlocked ? 'cursor-pointer border-border hover:bg-muted/20' : 'cursor-not-allowed border-border/50 opacity-50'
                    }`}>
                      <input type="checkbox" checked={emdReturned} disabled={!emdUnlocked} onChange={e => handleEmdToggle(e.target.checked)} className="rounded" />
                      <div>
                        <span className="font-medium">{emdStep}. EMD Returned by Procuring Authority</span>
                        <p className="text-muted-foreground text-[10px]">
                          {!poReceived ? 'Unlocks once PO is marked Received' : (bgRequired && !bgProceeded) ? 'Unlocks once Bank Guarantee is Issued' : !deliveryComplete ? 'Unlocks once Delivery / Work Complete is confirmed' : 'Confirm EMD amount has been refunded'}
                        </p>
                        {bid?.emd_returned_date && <p className="text-muted-foreground text-[10px] font-mono">Returned: {new Date(bid.emd_returned_date).toLocaleDateString('en-IN')}</p>}
                      </div>
                    </label>
                  )
                })()}

                {emdExempted && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 bg-muted/10 text-muted-foreground">
                    <Ban className="size-3.5 shrink-0" />
                    <span className="text-[11px]">{emdNotApplicable ? 'This tender had no EMD requirement — no EMD return to track.' : 'EMD was exempted for this tender — no EMD return to track.'}</span>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      </div>

      {showModal && (
        <CompleteStageModal
          title="Finalize Contract Award & Close Workspace"
          description="Marks bid outcome as WON in analytics and completes tender lifecycle."
          stageKey="AWARD_HANDOVER"
          bidId={bid.id}
          bid={bid}
          onClose={() => setShowModal(false)}
          onComplete={handleFinalClose}
        />
      )}
    </div>
  )
}

// EMD Return — the Award & Handover slot's content for a LOST/CANCELLED tender
// that actually collected an EMD (not exempted). There's no award to hand over,
// just the deposit to track back.
export function EmdReturnWorkspace({ bid, onRefresh }) {
  const [showModal, setShowModal] = useState(false)
  const [emdReturned, setEmdReturned] = useState(!!bid?.emd_returned)

  useEffect(() => {
    setEmdReturned(!!bid?.emd_returned)
  }, [bid?.emd_returned])

  const handleEmdToggle = async (checked) => {
    setEmdReturned(checked)
    try {
      const res = await updateBid(bid.id, {
        emd_returned: checked,
        emd_returned_date: checked ? new Date().toISOString() : undefined,
      })
      if (res.ok) {
        logStageMicroEvent(bid.id, {
          fromStage: 'AWARD_HANDOVER',
          toStage: 'AWARD_HANDOVER',
          eventType: 'FINANCE',
          transitionReason: checked ? 'Marked EMD as Refunded / Returned by Procuring Authority' : 'Marked EMD Return as Pending',
          details: { emdReturned: checked }
        })
        toast.success(checked ? 'EMD marked as Returned' : 'EMD marked as Pending Return')
        onRefresh()
      }
    } catch {
      toast.error('Network error')
    }
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-red-900 dark:text-red-300">EMD Return</h3>
          <p className="text-xs text-red-700 dark:text-red-400">
            {bid?.bid_status === 'CANCELLED' ? 'This tender was cancelled.' : 'This tender was lost.'} Track the EMD deposit back to closure.
          </p>
        </div>
        <StageHeaderActions
          bid={bid}
          stageKey="AWARD_HANDOVER"
          onCompleteClick={() => {
            if (!emdReturned) { toast.error('Mandatory: EMD Return must be confirmed before closing.'); return }
            setShowModal(true)
          }}
          onRefresh={onRefresh}
          completeLabel="Close Workspace"
          completeClass="bg-red-600 hover:bg-red-700 text-white"
        />
      </div>

      <div className="p-4 rounded-xl border border-border bg-card space-y-3 max-w-md">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">EMD Closure</h4>
        <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border border-border hover:bg-muted/20 transition-colors text-xs">
          <input type="checkbox" checked={emdReturned} onChange={e => handleEmdToggle(e.target.checked)} className="rounded" />
          <div>
            <span className="font-medium">EMD Returned by Procuring Authority</span>
            <p className="text-muted-foreground text-[10px]">EMD Amount: {fmtMoney(bid?.emd_amount)}</p>
            {bid?.emd_returned_date && <p className="text-muted-foreground text-[10px] font-mono">Returned: {new Date(bid.emd_returned_date).toLocaleDateString('en-IN')}</p>}
          </div>
        </label>
      </div>

      {showModal && (
        <CompleteStageModal
          title="Close EMD Return Workspace"
          description="Records final closure with EMD return confirmed."
          stageKey="AWARD_HANDOVER"
          bidId={bid.id}
          bid={bid}
          onClose={() => setShowModal(false)}
          onComplete={async (remarks) => {
            await updateBid(bid.id, { emd_returned: emdReturned }).catch(() => {})
            onRefresh()
          }}
        />
      )}
    </div>
  )
}

// ── Dynamic Dispatcher for Active Stage Workspace ────────────────────────────
export function DynamicStageWorkspace({ bid, selectedStage, onRefresh }) {
  const currentUser = tokenStorage.getUser()
  const userRoles = [
    ...(Array.isArray(currentUser?.roles) ? currentUser.roles : []),
    ...(currentUser?.role ? [currentUser.role] : [])
  ].map(r => String(r).toUpperCase())

  const stage = selectedStage || bid.workflow_stage
  const { isLocked, stageIdx } = checkStageState(bid, stage)

  // A Technical Evaluation disqualification is terminal (workflow_stage becomes
  // LOST) — Financial Evaluation was never legitimately reached, so it stays
  // locked regardless of the generic terminal-stage completion logic above.
  // Award & Handover's own outcome-aware rendering (WON / EMD Return / disabled)
  // handles the disqualified case separately, so it's excluded here.
  if (bid?.technical_result === 'DISQUALIFIED' && stage === 'FINANCIAL_EVALUATION') {
    return (
      <div className="p-8 rounded-xl border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900/50 text-center space-y-4 max-w-2xl mx-auto my-6">
        <div className="size-14 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center mx-auto text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800 shadow-sm">
          <Lock className="size-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-foreground">Financial Evaluation is Locked</h3>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
            This tender was disqualified in Technical Evaluation and did not proceed to Financial Evaluation.
          </p>
          {bid?.disqualification_reason && (
            <p className="text-xs text-rose-700 dark:text-rose-400 font-medium max-w-md mx-auto">
              Reason: {bid.disqualification_reason}
            </p>
          )}
        </div>
      </div>
    )
  }

  if (isLocked) {
    const priorStageKey = WORKFLOW_STAGES_ORDERED[stageIdx - 1]
    const gatedByPrimaryReview = STAGES_GATED_BY_PRIMARY_REVIEW.includes(stage)
    return (
      <div className="p-8 rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/50 text-center space-y-4 max-w-2xl mx-auto my-6">
        <div className="size-14 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800 shadow-sm">
          <Lock className="size-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-foreground">Stage {stageIdx + 1} ({stage.replace(/_/g, ' ')}) is Locked</h3>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
            {gatedByPrimaryReview
              ? 'This section opens once the Account Manager completes Primary Review (Go decision).'
              : `Strict enterprise stage-gating is active. All preceding stage sections (Stages 1 through ${stageIdx}) must be completed before Stage ${stageIdx + 1} can be accessed.`}
          </p>
        </div>
        <div className="pt-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Lock className="size-3.5" /> Pending Completion of {gatedByPrimaryReview ? 'Primary Review' : `Stage ${stageIdx} (${priorStageKey?.replace(/_/g, ' ')})`}
          </span>
        </div>
      </div>
    )
  }

  // Full access roles (Super Admin, Admin, Manager, Account Manager, Bid Executive)
  const fullAccessRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNT_MANAGER', 'BID_EXECUTIVE']
  const isFullAccess = userRoles.some(r => fullAccessRoles.includes(r))

  if (!isFullAccess) {
    // Stages 1, 2 (own Primary Review tab, when assigned), 4, 7, 11 for PRE_SALES
    const preSalesStages = [
      'DISCOVERED',
      'PRIMARY_REVIEW',
      'PRICING_REQUEST',
      'INTERNAL_APPROVAL',
      'AWARD_HANDOVER'
    ]

    // Stages 1, 5, 6, 11 for FINANCE
    const financeStages = [
      'DISCOVERED',
      'DOCUMENT_CHECKLIST_PREPARATION',
      'EMD_PROCESSING',
      'AWARD_HANDOVER'
    ]

    const isPreSales = userRoles.includes('PRE_SALES')
    const isFinance = userRoles.includes('FINANCE')

    let isAuthorized = false
    if (isPreSales && preSalesStages.includes(stage)) {
      isAuthorized = true
    } else if (isFinance && financeStages.includes(stage)) {
      isAuthorized = true
    }

    if (!isAuthorized) {
      const primaryRole = userRoles[0] ? userRoles[0].replace(/_/g, ' ') : 'USER'
      return (
        <div className="p-8 rounded-xl border border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/20 text-center space-y-4 max-w-2xl mx-auto my-6 shadow-sm">
          <div className="size-14 rounded-full bg-rose-500/10 dark:bg-rose-950/50 flex items-center justify-center mx-auto text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-xs">
            <AlertCircle className="size-7" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-foreground">Unauthorized Access</h3>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
              Your role (<span className="font-semibold text-rose-600 dark:text-rose-400">{primaryRole}</span>) is not authorized to access <span className="font-semibold text-foreground">Stage {stageIdx + 1}: {stage.replace(/_/g, ' ')}</span>.
            </p>
          </div>
          <div className="pt-2 flex justify-center">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-full bg-rose-500/10 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-500/20">
              <Lock className="size-3.5" /> Restricted Stage Workspace
            </span>
          </div>
        </div>
      )
    }
  }

  switch (stage) {
    case 'DISCOVERED':
      return <Stage1Workspace bid={bid} onRefresh={onRefresh} />
    case 'PRIMARY_REVIEW':
      return <Stage2PrimaryReviewWorkspace bid={bid} onRefresh={onRefresh} />
    case 'OEM_AUTHORIZATION_REQUEST':
      return <Stage3Workspace bid={bid} onRefresh={onRefresh} />
    case 'PRICING_REQUEST':
      return <Stage4Workspace bid={bid} onRefresh={onRefresh} />
    case 'DOCUMENT_CHECKLIST_PREPARATION':
      return <Stage5Workspace bid={bid} onRefresh={onRefresh} />
    case 'EMD_PROCESSING':
      if (bid?.emd_not_applicable) {
        return (
          <div className="p-8 rounded-xl border border-border bg-muted/20 text-center space-y-3 max-w-2xl mx-auto my-6">
            <div className="size-14 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground border border-border">
              <Lock className="size-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">No EMD</h3>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
                This tender has no EMD requirement at all — there is nothing to process at this stage.
              </p>
            </div>
          </div>
        )
      }
      if (bid?.emd_exempted) {
        return (
          <div className="p-8 rounded-xl border border-border bg-muted/20 text-center space-y-3 max-w-2xl mx-auto my-6">
            <div className="size-14 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground border border-border">
              <Lock className="size-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">EMD Exempted</h3>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
                This tender is exempted from EMD — there is nothing to process at this stage.
              </p>
            </div>
          </div>
        )
      }
      return <Stage6Workspace bid={bid} onRefresh={onRefresh} />
    case 'INTERNAL_APPROVAL':
      return <Stage8Workspace bid={bid} onRefresh={onRefresh} />
    case 'GEM_SUBMISSION':
      return <Stage9Workspace bid={bid} onRefresh={onRefresh} />
    case 'TECHNICAL_EVALUATION':
      return <Stage10Workspace bid={bid} onRefresh={onRefresh} />
    case 'FINANCIAL_EVALUATION':
      return <Stage11Workspace bid={bid} onRefresh={onRefresh} />
    case 'AWARD_HANDOVER': {
      const outcomeIsLostOrCancelled = ['LOST', 'CANCELLED'].includes(bid?.bid_status) || ['LOST', 'CANCELLED'].includes(bid?.bid_outcome)
      if (outcomeIsLostOrCancelled) {
        if (!bid?.emd_exempted && !bid?.emd_not_applicable) {
          return <EmdReturnWorkspace bid={bid} onRefresh={onRefresh} />
        }
        return (
          <div className="p-8 rounded-xl border border-border bg-muted/20 text-center space-y-3 max-w-2xl mx-auto my-6">
            <div className="size-14 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground border border-border">
              <Lock className="size-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">Tender Closed</h3>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
                This tender was {bid?.bid_status === 'CANCELLED' || bid?.bid_outcome === 'CANCELLED' ? 'cancelled' : 'lost'} and {bid?.emd_not_applicable ? 'had no EMD requirement' : 'EMD was exempted'} — there is nothing further to track for Award &amp; Handover.
              </p>
            </div>
          </div>
        )
      }
      return <Stage12Workspace bid={bid} onRefresh={onRefresh} />
    }
    default:
      return <Stage1Workspace bid={bid} onRefresh={onRefresh} />
  }
}
