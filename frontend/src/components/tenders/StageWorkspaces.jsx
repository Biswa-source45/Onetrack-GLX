import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, ShieldCheck, Share2, Coins, FileText, CheckSquare,
  AlertCircle, CheckCircle2, Send, Upload, Hourglass, Trophy,
  XCircle, Plus, Trash2, ArrowRight, DollarSign, Building2,
  Lock, Sparkles, UserCheck, Bell, Calculator, ExternalLink, RefreshCw, Edit2, Loader2, AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'
import confetti from 'canvas-confetti'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { transitionBidStage, recordBidOutcome, updateBid } from '../../services/bids'
import { usePermissions } from '../../hooks/usePermissions'
import { tokenStorage } from '../../services/auth'
import { ChecklistTab } from './ChecklistTab'
import { logStageMicroEvent } from '../../services/auditLogger'

function fmtMoney(v) {
  if (!v && v !== 0) return '—'
  if (v >= 10000000) return `₹${(v/10000000).toFixed(2)} Cr`
  if (v >= 100000) return `₹${(v/100000).toFixed(2)} L`
  return `₹${Number(v).toLocaleString('en-IN')}`
}

function fmtDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Common Transition Dialog Component
// IMPORTANT: This modal ONLY marks stageKey as complete in stage_completions.
// It does NOT call transitionBidStage — that would move the workflow_stage pointer
// and cause a cascade overwrite on other stages. Each stage is completed atomically.
function CompleteStageModal({ title, description, stageKey, bidId, bid, onComplete, onClose, children }) {
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!remarks.trim()) {
      toast.error('Remarks are required to complete stage action')
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
      currentRemarks[stageKey] = `[Completed]: ${remarks}`

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
        if (stageKey === 'EMD_PROCESSING') {
          patchData.emd_ready = true
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
        sideEffectResult = await onComplete(remarks)
      }

      if (stageKey) {
        let actionReason = `[Completed Stage Action]: ${remarks}`
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
  'ELIGIBILITY_ASSESSMENT',
  'OEM_AUTHORIZATION_REQUEST',
  'PRICING_REQUEST',
  'DOCUMENT_CHECKLIST_PREPARATION',
  'EMD_PROCESSING',
  'BID_DOCUMENTATION',
  'INTERNAL_APPROVAL',
  'GEM_SUBMISSION',
  'TECHNICAL_EVALUATION',
  'FINANCIAL_EVALUATION',
  'AWARD_HANDOVER',
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

  // Stage 1 (DISCOVERED) is completed by default upon tender creation unless explicitly set to false
  const isCompleted = completions[stageKey] === true || (
    stageKey === 'DISCOVERED' && completions['DISCOVERED'] !== false
  ) || (isTerminal && stageIdx <= currentIdx && completions[stageKey] !== false)

  const isCurrent = stageIdx === currentIdx && !isTerminal

  // Stage Locking:
  // Stages 1 through 8 (indices 0 through 7) are NEVER locked.
  // Stage locking applies ONLY from GeM Portal Submission onwards (stageIdx >= 8).
  let isLocked = false
  if (stageIdx >= 8 && !isTerminal) {
    for (let i = 0; i < stageIdx; i++) {
      const priorKey = WORKFLOW_STAGES_ORDERED[i]
      const priorDone = completions[priorKey] === true || priorKey === 'DISCOVERED'
      if (!priorDone) {
        isLocked = true
        break
      }
    }
  }

  return { isCompleted, isCurrent, isLocked, isInReview, currentIdx, stageIdx }
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

export function StageHeaderActions({ bid, stageKey, onCompleteClick, onRefresh, completeLabel = "Complete & Advance", completeClass = "" }) {
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
        <Button size="sm" onClick={onCompleteClick} className={`gap-2 shadow-sm text-xs ${completeClass}`}>
          <CheckCircle2 className="size-4" /> {completeLabel}
        </Button>
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
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Authority & Financials</h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Authority:</span><span className="font-medium text-foreground">{bid.organization_name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Department:</span><span className="font-medium text-foreground">{bid.department_name || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Estimated Value:</span><span className="font-bold text-foreground">{fmtMoney(bid.estimated_value)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">EMD Required:</span><span className="font-medium text-foreground">{bid.emd_exempted ? 'Exempted' : fmtMoney(bid.emd_amount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Ending Date:</span><span className="font-medium text-foreground">{fmtDate(bid.closing_date)}</span></div>
          </div>
        </div>
      </div>

      {showModal && (
        <CompleteStageModal
          title="Complete Stage 1: Search & Identification"
          description="Marks Stage 1 as complete and sends an automated alert to the Pre-Sales team."
          stageKey="DISCOVERED"
          bidId={bid.id}
          bid={bid}
          onClose={() => setShowModal(false)}
          onComplete={async () => {
            try {
              const { createAlert } = await import('../../services/alerts')
              await createAlert({
                target_role: 'PRE_SALES',
                bid_id: bid.id,
                type: 'INFO',
                title: `New Tender for Eligibility Assessment — ${bid.title}`,
                message: `Tender ${bid.gem_bid_no || bid.id} has been identified and requires your eligibility assessment. Closing: ${fmtDate(bid.closing_date)}.`,
              })
            } catch {}
            toast.success('Pre-Sales team alerted!')
            onRefresh()
          }}
        />
      )}
    </div>
  )
}

// ── Stage 2: Eligibility Assessment ─────────────────────────────────────────
export function Stage2Workspace({ bid, onRefresh }) {
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/20 dark:border-indigo-900/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300">Stage 2: Eligibility Assessment</h3>
          <p className="text-xs text-indigo-700 dark:text-indigo-400">Pre-sales team reviews technical criteria, turnover, and experience eligibility.</p>
        </div>
        <StageHeaderActions
          bid={bid}
          stageKey="ELIGIBILITY_ASSESSMENT"
          onCompleteClick={() => setShowModal(true)}
          onRefresh={onRefresh}
          completeLabel="Mark as Eligible & Advance"
          completeClass="bg-indigo-600 hover:bg-indigo-700 text-white"
        />
      </div>

      <div className="p-4 rounded-xl border border-border bg-card space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pre-Sales Evaluation Checklist</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg border border-border bg-muted/20 flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <span>Turnover & Financial Standing Verification</span>
          </div>
          <div className="p-3 rounded-lg border border-border bg-muted/20 flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <span>Past Experience / Similar Work Order Check</span>
          </div>
          <div className="p-3 rounded-lg border border-border bg-muted/20 flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <span>GeM OEM Reseller / Authorization Feasibility</span>
          </div>
          <div className="p-3 rounded-lg border border-border bg-muted/20 flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <span>Blacklist & Anti-Corruption Declaration Check</span>
          </div>
        </div>
      </div>

      {showModal && (
        <CompleteStageModal
          title="Mark Tender as Eligible"
          description="Marks Stage 2 (Eligibility Assessment) as complete. Stage 3 OEM Authorization can now be worked on independently."
          stageKey="ELIGIBILITY_ASSESSMENT"
          bidId={bid.id}
          bid={bid}
          onClose={() => setShowModal(false)}
          onComplete={onRefresh}
        />
      )}
    </div>
  )
}

// ── Stage 3: OEM Authorization Request ─────────────────────────────────────
export function Stage3Workspace({ bid, onRefresh }) {
  const key = `onetrack_oem_${bid.id}`

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

  // Sync state if bid.oem_workspace changes from background sync or onRefresh
  useEffect(() => {
    if (bid.oem_workspace) {
      let serverOems = []
      if (Array.isArray(bid.oem_workspace)) {
        serverOems = bid.oem_workspace
      } else if (typeof bid.oem_workspace === 'object' && Array.isArray(bid.oem_workspace.oems)) {
        serverOems = bid.oem_workspace.oems
      }
      if (serverOems.length > 0) {
        setOems(serverOems)
        localStorage.setItem(key, JSON.stringify(serverOems))
      }
    }
  }, [bid.oem_workspace, key])

  const [isEditing, setIsEditing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [newOemName, setNewOemName] = useState('')

  const saveOems = (list) => {
    setOems(list)
    localStorage.setItem(key, JSON.stringify(list))
    // Persist to database so ALL users see the same data immediately
    updateBid(bid.id, { oem_workspace: JSON.stringify(list) }).catch((err) => {
      console.error('Failed to save OEM workspace to backend:', err)
    })
  }

  const addOem = () => {
    if (!newOemName.trim()) { toast.error('OEM Name required'); return }
    const entry = {
      id: Date.now(), name: newOemName.trim(),
      initiated: 'YES', maf: 'NOT RECEIVED', mii: 'NOT RECEIVED',
      noMalicious: 'NOT RECEIVED', additionalDocs: '',
      followUp: '', remark: '', clarificationRequired: '', clarificationProvided: ''
    }
    const nextList = [...oems, entry]
    saveOems(nextList)
    logStageMicroEvent(bid.id, {
      fromStage: 'OEM_AUTHORIZATION_REQUEST',
      toStage: 'OEM_AUTHORIZATION_REQUEST',
      eventType: 'OEM',
      transitionReason: `Added OEM authorization entry for "${entry.name}"`,
      details: { oem_name: entry.name }
    })
    setNewOemName('')
    toast.success(`OEM "${entry.name}" added to matrix`)
  }

  const updateOemField = (id, field, value) => {
    setOems(prev => prev.map(o => o.id === id ? { ...o, [field]: value } : o))
  }

  const handleSaveMatrix = () => {
    saveOems(oems)
    setIsEditing(false)
    logStageMicroEvent(bid.id, {
      fromStage: 'OEM_AUTHORIZATION_REQUEST',
      toStage: 'OEM_AUTHORIZATION_REQUEST',
      eventType: 'OEM',
      transitionReason: `Saved OEM Authorization Matrix updates (${oems.length} OEM entries tracked)`,
      details: { oems }
    })
    toast.success('OEM Authorization Matrix saved successfully')
    if (onRefresh) onRefresh()
  }

  const deleteOem = (id) => {
    const target = oems.find(o => o.id === id)
    const updated = oems.filter(o => o.id !== id)
    saveOems(updated)
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
    if (o.maf === 'RECEIVED') return { label: 'Permission to Proceed', cls: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300' }
    if (o.initiated === 'YES') return { label: 'Initiated (MAF Pending)', cls: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300' }
    return { label: 'Not Started', cls: 'bg-muted text-muted-foreground border-border' }
  }

  return (
    <div className="space-y-6">
      {/* Stage Header */}
      <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-900/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-purple-900 dark:text-purple-300">Stage 3: OEM Authorization Matrix</h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-200/80 text-purple-900 dark:bg-purple-900 dark:text-purple-200 font-semibold">{oems.length} OEMs Tracked</span>
          </div>
          <p className="text-xs text-purple-700 dark:text-purple-400 mt-0.5">Manage MAF, MII, No Malicious certificates, follow-ups, and OEM clarifications.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isEditing ? (
            <Button size="sm" onClick={handleSaveMatrix} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm text-xs">
              <CheckCircle2 className="size-4" /> Save Matrix
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="gap-1.5 border-purple-300 text-purple-900 dark:text-purple-200 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-xs">
              <Edit2 className="size-3.5" /> Edit Matrix
            </Button>
          )}
          <StageHeaderActions
            bid={bid}
            stageKey="OEM_AUTHORIZATION_REQUEST"
            onCompleteClick={() => setShowModal(true)}
            onRefresh={onRefresh}
            completeLabel="Complete & Advance"
            completeClass="bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
          />
        </div>
      </div>

      {/* OEM Authorization Matrix Table */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="size-4 text-purple-600" /> OEM Authorization Tracking Sheet
          </h4>
          <span className="text-xs text-muted-foreground font-mono">
            {isEditing ? '✏️ EDITING MODE ACTIVE' : '🔒 READ ONLY (Click Edit Matrix to make changes)'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground font-bold text-[11px]">
                <th className="border border-border p-2 text-center w-12">S.No</th>
                <th className="border border-border p-2">OEM Name</th>
                <th className="border border-border p-2 text-center">Process Initiated</th>
                <th className="border border-border p-2 text-center">MAF Cert</th>
                <th className="border border-border p-2 text-center">MII Cert</th>
                <th className="border border-border p-2 text-center">No Malicious</th>
                <th className="border border-border p-2">Additional Docs</th>
                <th className="border border-border p-2">Follow Up Date</th>
                <th className="border border-border p-2">Remarks</th>
                <th className="border border-border p-2">Clarification Needed</th>
                <th className="border border-border p-2">Clarification Provided</th>
                <th className="border border-border p-2 text-center">Stage Status</th>
                {isEditing && <th className="border border-border p-2 text-center w-12">Del</th>}
              </tr>
            </thead>
            <tbody>
              {oems.length === 0 ? (
                <tr>
                  <td colSpan={isEditing ? 13 : 12} className="p-6 text-center text-muted-foreground italic border border-border">
                    No OEM authorization rows recorded. {isEditing ? 'Add an OEM below.' : 'Click "Edit Matrix" above to add OEM entries.'}
                  </td>
                </tr>
              ) : (
                oems.map((o, idx) => {
                  const st = getStageStatus(o)
                  return (
                    <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                      {/* S.No */}
                      <td className="border border-border p-2 text-center font-mono font-bold text-muted-foreground">{idx + 1}</td>

                      {/* OEM Name */}
                      <td className="border border-border p-2 font-bold text-foreground">
                        {isEditing ? (
                          <Input size="sm" value={o.name} onChange={e => updateOemField(o.id, 'name', e.target.value)} className="h-7 text-xs font-semibold" />
                        ) : (
                          o.name
                        )}
                      </td>

                      {/* Process Initiated */}
                      <td className="border border-border p-2 text-center">
                        {isEditing ? (
                          <select value={o.initiated} onChange={e => updateOemField(o.id, 'initiated', e.target.value)} className="h-7 text-xs border border-border rounded px-1 bg-background font-medium">
                            <option value="YES">YES</option>
                            <option value="NO">NO</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${o.initiated === 'YES' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                            {o.initiated}
                          </span>
                        )}
                      </td>

                      {/* MAF Cert */}
                      <td className="border border-border p-2 text-center">
                        {isEditing ? (
                          <select value={o.maf} onChange={e => updateOemField(o.id, 'maf', e.target.value)} className="h-7 text-xs border border-border rounded px-1 bg-background font-medium">
                            <option value="NOT RECEIVED">NOT RECEIVED</option>
                            <option value="RECEIVED">RECEIVED</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${o.maf === 'RECEIVED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'}`}>
                            {o.maf}
                          </span>
                        )}
                      </td>

                      {/* MII Cert */}
                      <td className="border border-border p-2 text-center">
                        {isEditing ? (
                          <select value={o.mii} onChange={e => updateOemField(o.id, 'mii', e.target.value)} className="h-7 text-xs border border-border rounded px-1 bg-background font-medium">
                            <option value="NOT RECEIVED">NOT RECEIVED</option>
                            <option value="RECEIVED">RECEIVED</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${o.mii === 'RECEIVED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                            {o.mii}
                          </span>
                        )}
                      </td>

                      {/* No Malicious Cert */}
                      <td className="border border-border p-2 text-center">
                        {isEditing ? (
                          <select value={o.noMalicious} onChange={e => updateOemField(o.id, 'noMalicious', e.target.value)} className="h-7 text-xs border border-border rounded px-1 bg-background font-medium">
                            <option value="NOT RECEIVED">NOT RECEIVED</option>
                            <option value="RECEIVED">RECEIVED</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${o.noMalicious === 'RECEIVED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                            {o.noMalicious}
                          </span>
                        )}
                      </td>

                      {/* Additional Docs */}
                      <td className="border border-border p-2">
                        {isEditing ? (
                          <Input size="sm" value={o.additionalDocs} onChange={e => updateOemField(o.id, 'additionalDocs', e.target.value)} placeholder="e.g. OEM Compliance" className="h-7 text-xs" />
                        ) : (
                          <span className="text-muted-foreground">{o.additionalDocs || '—'}</span>
                        )}
                      </td>

                      {/* Follow Up Date */}
                      <td className="border border-border p-2">
                        {isEditing ? (
                          <input type="date" value={o.followUp} onChange={e => updateOemField(o.id, 'followUp', e.target.value)} className="h-7 text-xs border border-border rounded px-1.5 bg-background font-mono" />
                        ) : (
                          <span className="font-mono text-muted-foreground">{o.followUp || '—'}</span>
                        )}
                      </td>

                      {/* Remarks */}
                      <td className="border border-border p-2">
                        {isEditing ? (
                          <Input size="sm" value={o.remark} onChange={e => updateOemField(o.id, 'remark', e.target.value)} placeholder="Remark" className="h-7 text-xs" />
                        ) : (
                          <span className="text-muted-foreground">{o.remark || '—'}</span>
                        )}
                      </td>

                      {/* Clarification Required */}
                      <td className="border border-border p-2">
                        {isEditing ? (
                          <Input size="sm" value={o.clarificationRequired} onChange={e => updateOemField(o.id, 'clarificationRequired', e.target.value)} placeholder="Clarification needed" className="h-7 text-xs" />
                        ) : (
                          <span className="text-muted-foreground">{o.clarificationRequired || '—'}</span>
                        )}
                      </td>

                      {/* Clarification Provided */}
                      <td className="border border-border p-2">
                        {isEditing ? (
                          <Input size="sm" value={o.clarificationProvided} onChange={e => updateOemField(o.id, 'clarificationProvided', e.target.value)} placeholder="Clarification given" className="h-7 text-xs" />
                        ) : (
                          <span className="text-muted-foreground">{o.clarificationProvided || '—'}</span>
                        )}
                      </td>

                      {/* Stage Status */}
                      <td className="border border-border p-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${st.cls}`}>{st.label}</span>
                      </td>

                      {/* Action */}
                      {isEditing && (
                        <td className="border border-border p-2 text-center">
                          <button onClick={() => deleteOem(o.id)} className="text-destructive hover:bg-destructive/10 p-1 rounded transition-colors" title="Delete Row">
                            <Trash2 className="size-3.5" />
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

        {/* Add OEM Row Form (Visible when editing) */}
        {isEditing && (
          <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row gap-2 items-end">
            <div className="flex-1 w-full">
              <Label className="text-[11px] font-medium">Add New OEM Name</Label>
              <Input value={newOemName} onChange={e => setNewOemName(e.target.value)} placeholder="e.g. Cisco Systems, Dell Enterprise, HP Inc." className="h-8 text-xs" onKeyDown={e => e.key === 'Enter' && addOem()} />
            </div>
            <Button size="sm" onClick={addOem} className="h-8 text-xs gap-1.5 bg-purple-600 hover:bg-purple-700 text-white">
              <Plus className="size-3.5" /> Add OEM Row
            </Button>
          </div>
        )}
      </div>

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

// ── Stage 4: Pricing Request ────────────────────────────────────────────────
export function Stage4Workspace({ bid, onRefresh }) {
  const { hasRole } = usePermissions()
  // Presales can only VIEW Stage 4, not edit it
  const isReadOnly = hasRole('PRESALES')

  const key4 = `onetrack_pricing_${bid.id}`

  // Initialize: DB value (bid.pricing_workspace) takes priority, then localStorage cache
  const [pricingData, setPricingData] = useState(() => {
    const DEFAULTS = {
      phase: 'INIT', // INIT | AWAITING | QUOTING | APPROVAL
      distNames: [],
      quotes: [], // [{id,distName,items:[{desc,qty,basicPrice}]}]
      selectedDist: '',
      approvalRecipients: [],
      marginPct: 2.45,
    }
    // Prefer server-stored data (visible to all users)
    if (bid.pricing_workspace && typeof bid.pricing_workspace === 'object') {
      return { ...DEFAULTS, ...bid.pricing_workspace }
    }
    // Fallback: local cache (for backward compat)
    try {
      const cached = localStorage.getItem(key4)
      if (cached) return { ...DEFAULTS, ...JSON.parse(cached) }
    } catch (_) {}
    return DEFAULTS
  })

  const marginPct = pricingData.marginPct ?? 2.45
  const setMarginPct = (val) => save({ marginPct: Number(val) })

  const [showModal, setShowModal] = useState(false)
  const [showRequestDlg, setShowRequestDlg] = useState(false)
  const [showAddDistDlg, setShowAddDistDlg] = useState(false)
  const [showQuoteDlg, setShowQuoteDlg] = useState(false)
  const [showEditQuoteDlg, setShowEditQuoteDlg] = useState(false)
  const [editingQuoteId, setEditingQuoteId] = useState(null)
  const [showApprovalDlg, setShowApprovalDlg] = useState(false)
  const [quoteToDelete, setQuoteToDelete] = useState(null)
  const [newDistNameInput, setNewDistNameInput] = useState('')
  const [initDistNames, setInitDistNames] = useState('')
  const [addMoreDistNames, setAddMoreDistNames] = useState('')
  const [quoteDistSel, setQuoteDistSel] = useState('')
  const [quoteCustomName, setQuoteCustomName] = useState('')
  const [quoteItems, setQuoteItems] = useState([{ desc: '', qty: 1, basicPrice: '' }])

  // Keep localStorage in sync as a fast cache, but source of truth is DB
  const save = (upd) => {
    const next = { ...pricingData, ...upd }
    setPricingData(next)
    localStorage.setItem(key4, JSON.stringify(next))
    // Persist to database so ALL users see the same data
    updateBid(bid.id, { pricing_workspace: JSON.stringify(next) }).catch(() => {})
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

  const handleAddQuote = () => {
    const effectiveName = quoteDistSel === 'Others' ? (quoteCustomName.trim() || 'Others') : (quoteDistSel || 'Others')
    if (!quoteItems.some(i => i.desc && i.basicPrice)) { toast.error('Fill at least one item'); return }
    const items = quoteItems.filter(i => i.desc && i.basicPrice).map(i => ({
      desc: i.desc, qty: Number(i.qty) || 1, basicPrice: Number(i.basicPrice) || 0
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
    setQuoteItems([{ desc: '', qty: 1, basicPrice: '' }])
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
    setQuoteItems(q.items.map(i => ({ desc: i.desc, qty: i.qty, basicPrice: i.basicPrice })))
    setShowEditQuoteDlg(true)
  }

  const handleUpdateQuote = () => {
    const effectiveName = quoteDistSel === 'Others' ? (quoteCustomName.trim() || 'Others') : (quoteDistSel || 'Others')
    if (!quoteItems.some(i => i.desc && i.basicPrice)) { toast.error('Fill at least one item'); return }
    const items = quoteItems.filter(i => i.desc && i.basicPrice).map(i => ({
      desc: i.desc, qty: Number(i.qty) || 1, basicPrice: Number(i.basicPrice) || 0
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
    setQuoteItems([{ desc: '', qty: 1, basicPrice: '' }])
    toast.success('Distributor quote updated successfully')
  }

  const handleDeleteQuote = (quoteId, distName) => {
    setQuoteToDelete({ id: quoteId, distName })
  }

  const confirmDeleteQuote = () => {
    if (!quoteToDelete) return
    const { id: quoteId, distName } = quoteToDelete
    const updatedQuotes = pricingData.quotes.filter(q => q.id !== quoteId)
    save({ quotes: updatedQuotes })
    logStageMicroEvent(bid.id, {
      fromStage: 'PRICING_REQUEST',
      toStage: 'PRICING_REQUEST',
      eventType: 'PRICING',
      transitionReason: `Deleted commercial quotation for distributor "${distName}"`,
      details: { distName, quoteId, remainingQuotesCount: updatedQuotes.length }
    })
    setQuoteToDelete(null)
    toast.success(`Deleted distributor quote from "${distName}"`)
    if (typeof onRefresh === 'function') onRefresh()
  }

  const buildPricingTableHtml = (l1Q, margin) => {
    if (!l1Q || !l1Q.items) return ''

    let totalPurchaseWithGst = 0
    let totalGlobxPrice = 0
    let grandTotalProfit = 0

    const rowsHtml = l1Q.items.map((it, i) => {
      const basic = Number(it.basicPrice) || 0
      const qty = Number(it.qty) || 1
      const gst = basic * 0.18
      const priceWithGst = basic + gst
      const totalWithGst = priceWithGst * qty
      const marginAmt = priceWithGst * (margin / 100)
      const globxUnit = priceWithGst + marginAmt
      const globxTotal = globxUnit * qty
      const profitTotal = marginAmt * qty

      totalPurchaseWithGst += totalWithGst
      totalGlobxPrice += globxTotal
      grandTotalProfit += profitTotal

      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 10px; text-align: center; font-weight: bold; color: #64748b; font-family: monospace;">${i + 1}</td>
          <td style="padding: 8px 10px; font-weight: 600; color: #1e293b;">${it.desc}</td>
          <td style="padding: 8px 10px; text-align: center; color: #334155; font-weight: 500;">${qty}</td>
          <td style="padding: 8px 10px; text-align: right; font-family: monospace; color: #475569;">${fmtMoney(basic)}</td>
          <td style="padding: 8px 10px; text-align: right; font-family: monospace; color: #64748b;">${fmtMoney(gst)}</td>
          <td style="padding: 8px 10px; text-align: right; font-family: monospace; color: #334155;">${fmtMoney(priceWithGst)}</td>
          <td style="padding: 8px 10px; text-align: center; color: #4338ca; font-weight: 700;">${margin}%</td>
          <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-weight: 700; color: #4f46e5;">${fmtMoney(globxUnit)}</td>
          <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-weight: 700; color: #4f46e5; background-color: #f5f3ff;">${fmtMoney(globxTotal)}</td>
          <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-weight: 700; color: #059669; background-color: #ecfdf5;">${fmtMoney(profitTotal)}</td>
        </tr>
      `
    }).join('')

    return `
      <div style="margin-top: 14px; margin-bottom: 14px; border: 1px solid #c7d2fe; border-radius: 10px; overflow: hidden; background-color: #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); padding: 12px 16px; color: #ffffff; font-size: 13px; font-weight: 700;">
          📊 Commercial Pricing Calculation Breakdown — L1 Distributor: ${l1Q.distName}
        </div>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <thead>
              <tr style="background-color: #f8fafc; color: #475569; font-size: 11px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">
                <th style="padding: 10px; text-align: center; border-right: 1px solid #e2e8f0;">S.No</th>
                <th style="padding: 10px; border-right: 1px solid #e2e8f0;">Item Description</th>
                <th style="padding: 10px; text-align: center; border-right: 1px solid #e2e8f0;">Qty</th>
                <th style="padding: 10px; text-align: right; border-right: 1px solid #e2e8f0;">Basic (₹)</th>
                <th style="padding: 10px; text-align: right; border-right: 1px solid #e2e8f0;">GST 18%</th>
                <th style="padding: 10px; text-align: right; border-right: 1px solid #e2e8f0;">Purchase w/ GST</th>
                <th style="padding: 10px; text-align: center; border-right: 1px solid #e2e8f0;">Margin</th>
                <th style="padding: 10px; text-align: right; border-right: 1px solid #e2e8f0;">GlobX Unit</th>
                <th style="padding: 10px; text-align: right; border-right: 1px solid #e2e8f0; background-color: #ede9fe; color: #3730a3;">GlobX Total (₹)</th>
                <th style="padding: 10px; text-align: right; background-color: #d1fae5; color: #065f46;">Total Profit (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr style="background-color: #f8fafc; font-weight: bold; border-top: 2px solid #cbd5e1;">
                <td colspan="6" style="padding: 12px 10px; text-align: right; color: #334155; font-size: 12px; border-right: 1px solid #e2e8f0;">Grand Total Summary:</td>
                <td style="padding: 12px 10px; text-align: center; color: #4338ca; font-size: 12px; border-right: 1px solid #e2e8f0;">${margin}%</td>
                <td style="padding: 12px 10px; text-align: right; color: #64748b; font-size: 11px; border-right: 1px solid #e2e8f0;">TOTAL SELLING</td>
                <td style="padding: 12px 10px; text-align: right; font-family: monospace; font-size: 14px; font-weight: 800; color: #4338ca; background-color: #ede9fe; border-right: 1px solid #e2e8f0;">${fmtMoney(totalGlobxPrice)}</td>
                <td style="padding: 12px 10px; text-align: right; font-family: monospace; font-size: 14px; font-weight: 800; color: #047857; background-color: #d1fae5;">${fmtMoney(grandTotalProfit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `
  }

  const handleSendApproval = () => {
    if (!pricingData.approvalRecipients.length) { toast.error('Select at least one recipient'); return }
    const tableHtml = buildPricingTableHtml(l1Quote, marginPct)
    import('../../services/alerts').then(({ createAlert }) => {
      pricingData.approvalRecipients.forEach(role => {
        createAlert({ target_role: role.toUpperCase(), bid_id: bid.id, type: 'ACTION_REQUIRED',
          title: `Pricing Approval Required — ${bid.title}`,
          message: `<p style="margin: 0 0 12px 0;">Bid #${bid.gem_bid_no || bid.id}: Commercial pricing calculation from L1 distributor (<strong>${l1Quote?.distName || 'N/A'}</strong>) is ready for management & finance review.</p>${tableHtml}<p style="margin: 12px 0 0 0;">Please review, approve, or request a margin adjustment.</p>`
        })
      })
    })
    save({ phase: 'APPROVAL' })
    logStageMicroEvent(bid.id, {
      fromStage: 'PRICING_REQUEST',
      toStage: 'PRICING_REQUEST',
      eventType: 'ALERT',
      transitionReason: `Dispatched pricing approval notification with formatted commercial table to: ${pricingData.approvalRecipients.join(', ')} (Margin: ${marginPct}%, L1 Distributor: ${l1Quote?.distName || 'N/A'})`,
      details: { recipients: pricingData.approvalRecipients, marginPct, l1Distributor: l1Quote?.distName }
    })
    setShowApprovalDlg(false)
    toast.success('Approval request with formatted pricing table sent to selected recipients!')
  }

  const toggleRecipient = (r) => {
    const list = pricingData.approvalRecipients.includes(r)
      ? pricingData.approvalRecipients.filter(x => x !== r)
      : [...pricingData.approvalRecipients, r]
    save({ approvalRecipients: list })
  }

  // Find L1 (lowest total per item across all quotes)
  const allQuotes = pricingData.quotes
  const l1Quote = allQuotes.length > 0 ? allQuotes.reduce((best, q) => {
    const tot = q.items.reduce((s, i) => s + i.basicPrice * i.qty, 0)
    const bTot = best.items.reduce((s, i) => s + i.basicPrice * i.qty, 0)
    return tot < bTot ? q : best
  }, allQuotes[0]) : null

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
              <Button size="sm" variant="outline" onClick={() => setShowQuoteDlg(true)} className="gap-1.5 border-violet-300 text-violet-800 dark:text-violet-300 hover:bg-violet-100 text-xs">
                <Plus className="size-3.5" /> Add Distributor Quote
              </Button>
            )}
            {!isReadOnly && (pricingData.phase === 'QUOTING' || pricingData.phase === 'APPROVAL') && l1Quote && (
              <Button size="sm" variant="outline" onClick={() => setShowApprovalDlg(true)} className={`gap-1.5 text-xs ${pricingData.phase === 'APPROVAL' ? 'border-orange-300 text-orange-800 hover:bg-orange-100' : 'border-amber-300 text-amber-800 dark:text-amber-300 hover:bg-amber-100'}`}>
                <Send className="size-3.5" /> {pricingData.phase === 'APPROVAL' ? 'Resend Approval Request' : 'Send for Approval'}
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
            />
          </div>
        </div>
        <div className="mt-2 flex gap-2 flex-wrap">
          {['INIT','AWAITING','QUOTING','APPROVAL'].map((ph, i) => (
            <span key={ph} className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${pricingData.phase === ph ? 'bg-violet-600 text-white' : 'bg-muted text-muted-foreground'}`}>
              {i+1}. {ph === 'INIT' ? 'Request Not Sent' : ph === 'AWAITING' ? 'Awaiting Response' : ph === 'QUOTING' ? 'Quotes Received' : 'Sent for Approval'}
            </span>
          ))}
        </div>
      </div>

      {pricingData.distNames.length > 0 && (
        <div className="p-3 rounded-lg border border-border bg-card text-xs">
          <span className="font-semibold text-muted-foreground">Distributors Contacted: </span>
          {pricingData.distNames.map(n => <span key={n} className="ml-1 px-2 py-0.5 rounded bg-violet-50 text-violet-800 border border-violet-200">{n}</span>)}
        </div>
      )}

      {allQuotes.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Distributor Quotes Received</h4>
          {allQuotes.map(q => (
            <div key={q.id} className={`p-3 rounded-lg border text-xs ${l1Quote && l1Quote.id === q.id ? 'border-emerald-300 bg-emerald-50/40' : 'border-border bg-muted/20'}`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">{q.distName}</span>
                  {l1Quote && l1Quote.id === q.id && <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-100 text-emerald-800 font-bold">L1 — Lowest Quote</span>}
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
                      <Edit2 className="size-3" /> Edit Quote
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
                <thead><tr className="bg-muted/40 text-muted-foreground"><th className="border border-border p-1.5">Description</th><th className="border border-border p-1.5">Qty</th><th className="border border-border p-1.5">Basic Price</th><th className="border border-border p-1.5">Total</th></tr></thead>
                <tbody>
                  {q.items.map((it, ii) => (
                    <tr key={ii}><td className="border border-border p-1.5">{it.desc}</td><td className="border border-border p-1.5 text-center">{it.qty}</td><td className="border border-border p-1.5 font-mono">{fmtMoney(it.basicPrice)}</td><td className="border border-border p-1.5 font-mono font-semibold">{fmtMoney(it.basicPrice * it.qty)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {l1Quote && (
        <div className="rounded-xl border border-emerald-200 bg-card p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-2">
              <Calculator className="size-4" /> Pricing Calculation from L1 — {l1Quote.distName}
            </h4>
            <div className="flex items-center gap-2 text-xs">
              <Label className="text-xs">GlobX Margin (%):</Label>
              <Input
                type="number"
                value={marginPct}
                onChange={e => !isReadOnly && setMarginPct(Number(e.target.value))}
                readOnly={isReadOnly}
                disabled={isReadOnly}
                className={`w-20 h-7 text-xs font-bold text-center ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                step="0.01"
              />
              {isReadOnly && <span className="text-[10px] text-muted-foreground italic">(read-only)</span>}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground font-bold">
                  <th className="border border-border p-2">S.No</th>
                  <th className="border border-border p-2">Description</th>
                  <th className="border border-border p-2">Qty</th>
                  <th className="border border-border p-2">Purchase Price Basic</th>
                  <th className="border border-border p-2">GST (18%)</th>
                  <th className="border border-border p-2">Unit Price with GST</th>
                  <th className="border border-border p-2">Total Purchase Price with GST</th>
                  <th className="border border-border p-2">Margin %</th>
                  <th className="border border-border p-2">GlobX Unit Selling Price</th>
                  <th className="border border-border p-2">GlobX Total Price</th>
                  <th className="border border-border p-2">GlobX Profit (Per Unit)</th>
                  <th className="border border-border p-2">GlobX Profit (Total)</th>
                </tr>
              </thead>
              <tbody>
                {l1Quote.items.map((it, ii) => {
                  const gst = it.basicPrice * 0.18
                  const priceWithGst = it.basicPrice + gst
                  const totalWithGst = priceWithGst * it.qty
                  const marginAmt = priceWithGst * (marginPct / 100)     // profit per unit
                  const globxUnit = priceWithGst + marginAmt              // selling price per unit
                  const globxTotal = globxUnit * it.qty                   // total selling price
                  const profitPerUnit = marginAmt                         // same as marginAmt
                  const profitTotal = profitPerUnit * it.qty              // total profit
                  return (
                    <tr key={ii} className="hover:bg-muted/10">
                      <td className="border border-border p-1.5 text-center font-mono font-bold">{ii + 1}</td>
                      <td className="border border-border p-1.5">{it.desc}</td>
                      <td className="border border-border p-1.5 text-center">{it.qty}</td>
                      <td className="border border-border p-1.5 font-mono">{fmtMoney(it.basicPrice)}</td>
                      <td className="border border-border p-1.5 font-mono">{fmtMoney(gst)}</td>
                      <td className="border border-border p-1.5 font-mono">{fmtMoney(priceWithGst)}</td>
                      <td className="border border-border p-1.5 font-mono font-semibold">{fmtMoney(totalWithGst)}</td>
                      <td className="border border-border p-1.5 text-center">{marginPct}%</td>
                      <td className="border border-border p-1.5 font-mono text-violet-700 font-bold">{fmtMoney(globxUnit)}</td>
                      <td className="border border-border p-1.5 font-mono text-violet-700 font-bold">{fmtMoney(globxTotal)}</td>
                      <td className="border border-border p-1.5 font-mono text-emerald-700 font-semibold">{fmtMoney(profitPerUnit)}</td>
                      <td className="border border-border p-1.5 font-mono text-emerald-700 font-bold">{fmtMoney(profitTotal)}</td>
                    </tr>
                  )
                })}
                {/* Grand Total row */}
                {(() => {
                  const grandSell = l1Quote.items.reduce((s, it) => {
                    const gstU = it.basicPrice * 0.18
                    const unit = (it.basicPrice + gstU) * (1 + marginPct / 100)
                    return s + unit * it.qty
                  }, 0)
                  const grandCost = l1Quote.items.reduce((s, it) => {
                    const gstU = it.basicPrice * 0.18
                    return s + (it.basicPrice + gstU) * it.qty
                  }, 0)
                  const grandProfit = grandSell - grandCost
                  return (
                    <tr className="bg-emerald-50/60 dark:bg-emerald-950/20 font-bold">
                      <td colSpan={9} className="border border-border p-2 text-right text-xs font-bold">Grand Total:</td>
                      <td className="border border-border p-2 font-mono text-violet-700 text-sm font-bold">{fmtMoney(grandSell)}</td>
                      <td colSpan={1} className="border border-border p-2 text-center text-xs text-muted-foreground">—</td>
                      <td className="border border-border p-2 font-mono text-emerald-700 text-sm font-bold">{fmtMoney(grandProfit)}</td>
                    </tr>
                  )
                })()}
              </tbody>
            </table>
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
                <div key={ii} className="grid grid-cols-5 gap-1.5 items-end">
                  <div className="col-span-2"><Input value={it.desc} onChange={e => { const a = [...quoteItems]; a[ii].desc = e.target.value; setQuoteItems(a) }} placeholder="Description" className="h-8 text-xs" /></div>
                  <div><Input type="number" value={it.qty} onChange={e => { const a = [...quoteItems]; a[ii].qty = e.target.value; setQuoteItems(a) }} placeholder="Qty" className="h-8 text-xs" /></div>
                  <div><Input type="number" value={it.basicPrice} onChange={e => { const a = [...quoteItems]; a[ii].basicPrice = e.target.value; setQuoteItems(a) }} placeholder="Basic Price ₹" className="h-8 text-xs" /></div>
                  <button onClick={() => setQuoteItems(quoteItems.filter((_, i) => i !== ii))} className="h-8 text-destructive border border-border rounded px-2 text-xs">✕</button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setQuoteItems([...quoteItems, { desc: '', qty: 1, basicPrice: '' }])} className="text-xs gap-1"><Plus className="size-3" /> Add Line</Button>
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
                <div key={ii} className="grid grid-cols-5 gap-1.5 items-end">
                  <div className="col-span-2"><Input value={it.desc} onChange={e => { const a = [...quoteItems]; a[ii].desc = e.target.value; setQuoteItems(a) }} placeholder="Description" className="h-8 text-xs" /></div>
                  <div><Input type="number" value={it.qty} onChange={e => { const a = [...quoteItems]; a[ii].qty = e.target.value; setQuoteItems(a) }} placeholder="Qty" className="h-8 text-xs" /></div>
                  <div><Input type="number" value={it.basicPrice} onChange={e => { const a = [...quoteItems]; a[ii].basicPrice = e.target.value; setQuoteItems(a) }} placeholder="Basic Price ₹" className="h-8 text-xs" /></div>
                  <button onClick={() => setQuoteItems(quoteItems.filter((_, i) => i !== ii))} className="h-8 text-destructive border border-border rounded px-2 text-xs">✕</button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setQuoteItems([...quoteItems, { desc: '', qty: 1, basicPrice: '' }])} className="text-xs gap-1"><Plus className="size-3" /> Add Line</Button>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { setShowEditQuoteDlg(false); setEditingQuoteId(null); setQuoteDistSel(''); setQuoteCustomName(''); setQuoteItems([{ desc: '', qty: 1, basicPrice: '' }]) }}>Cancel</Button>
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
            <p className="text-xs text-muted-foreground">Select recipients who will receive an in-app alert + email with the pricing table.</p>
            <div className="space-y-2 text-xs">
              {['ADMIN','MANAGER','PRE_SALES'].map(r => (
                <label key={r} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={pricingData.approvalRecipients.includes(r)} onChange={() => toggleRecipient(r)} className="rounded" />
                  <span className="font-medium">{r.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowApprovalDlg(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSendApproval}>Send Alert & Email</Button>
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

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-900/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-300">Stage 5: Document Checklist Preparation</h3>
          <p className="text-xs text-purple-700 dark:text-purple-400">Ensure all mandatory bidder and OEM documents are compiled, verified, and tracked below.</p>
        </div>
        <StageHeaderActions
          bid={bid}
          stageKey="DOCUMENT_CHECKLIST_PREPARATION"
          onCompleteClick={() => setShowModal(true)}
          onRefresh={onRefresh}
          completeLabel="Complete Checklist & Advance"
          completeClass="bg-purple-600 hover:bg-purple-700 text-white"
        />
      </div>

      {/* Embedded Dynamic Interactive Checklist UI */}
      <div className="rounded-xl border border-border/80 bg-card p-1">
        <ChecklistTab bid={bid} onRefresh={onRefresh} />
      </div>

      {showModal && (
        <CompleteStageModal
          title="Complete Stage 5: Checklist Prep"
          description="Marks Stage 5 as complete. EMD Processing can now proceed independently."
          stageKey="DOCUMENT_CHECKLIST_PREPARATION"
          bidId={bid.id}
          bid={bid}
          onClose={() => setShowModal(false)}
          onComplete={onRefresh}
        />
      )}
    </div>
  )
}

// ── Stage 6: EMD Processing ─────────────────────────────────────────────────
export function Stage6Workspace({ bid, onRefresh }) {
  const [showModal, setShowModal] = useState(false)

  const handleAlertFinance = async () => {
    try {
      const { createAlert } = await import('../../services/alerts')
      await createAlert({
        target_role: 'FINANCE',
        bid_id: bid.id,
        type: 'ACTION_REQUIRED',
        title: `EMD Processing Required — ${bid.title}`,
        message: `Bid ${bid.gem_bid_no || bid.id} requires EMD/Bank Guarantee processing. EMD Amount: ${fmtMoney(bid.emd_amount)}. EMD Exempted: ${bid.emd_exempted ? 'Yes' : 'No'}. Please process and confirm.`,
      })
      logStageMicroEvent(bid.id, {
        fromStage: 'EMD_PROCESSING',
        toStage: 'EMD_PROCESSING',
        eventType: 'ALERT',
        transitionReason: `Alerted Finance Team for EMD/Bank Guarantee processing (EMD Amount: ${fmtMoney(bid.emd_amount)}, Exempted: ${bid.emd_exempted ? 'Yes' : 'No'})`,
        details: { emdAmount: bid.emd_amount, exempted: bid.emd_exempted }
      })
      toast.success('Finance team alerted via in-app notification + email!')
    } catch (e) {
      toast.error('Failed to send alert. Check your connection.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-300">Stage 6: EMD & Bank Guarantee Processing</h3>
          <p className="text-xs text-amber-700 dark:text-amber-400">Manage EMD payment / exemption certificates and BG issue requests.</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Button size="sm" variant="outline" onClick={handleAlertFinance} className="gap-1.5 border-amber-300 text-amber-900 dark:text-amber-300 hover:bg-amber-100 text-xs">
            <Bell className="size-3.5" /> Alert Finance Team
          </Button>
          <StageHeaderActions
            bid={bid}
            stageKey="EMD_PROCESSING"
            onCompleteClick={() => setShowModal(true)}
            onRefresh={onRefresh}
            completeLabel="EMD / BG Ready & Advance"
            completeClass="bg-amber-600 hover:bg-amber-700 text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card space-y-2 text-xs">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">EMD Requirements</h4>
          <div className="flex justify-between"><span className="text-muted-foreground">Status:</span><span className="font-semibold">{bid.emd_exempted ? 'EXEMPTED' : 'REQUIRED'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">EMD Amount:</span><span className="font-bold font-mono">{fmtMoney(bid.emd_amount)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Payment Mode:</span><span className="font-medium">{bid.emd_type || 'Online'}</span></div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card space-y-2 text-xs">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bank Guarantee Details</h4>
          <div className="flex justify-between"><span className="text-muted-foreground">BG Required:</span><span className="font-semibold">{bid.bg_required ? 'YES' : 'NO'}</span></div>
          {bid.bg_required && <div className="flex justify-between"><span className="text-muted-foreground">BG Rate:</span><span className="font-bold">{bid.bg_rate}%</span></div>}
        </div>
      </div>

      {showModal && (
        <CompleteStageModal
          title="Complete EMD Processing"
          description="Confirm EMD DD / Online Receipt / Exemption document is attached. Marks Stage 6 as complete."
          stageKey="EMD_PROCESSING"
          bidId={bid.id}
          bid={bid}
          onClose={() => setShowModal(false)}
          onComplete={onRefresh}
        />
      )}
    </div>
  )
}

// ── Stage 7: Bid Documentation ──────────────────────────────────────────────
export function Stage7Workspace({ bid, onRefresh }) {
  const [showModal, setShowModal] = useState(false)

  const handleNotifyAll = async () => {
    try {
      const { createAlert } = await import('../../services/alerts')
      await Promise.all(['ADMIN','MANAGER','PRE_SALES'].map(role =>
        createAlert({
          target_role: role,
          bid_id: bid.id,
          type: 'ACTION_REQUIRED',
          title: `All Bid Documents Ready — ${bid.title}`,
          message: `Bid ${bid.gem_bid_no || bid.id}: All documents are compiled and ready. Internal approval is required before GeM submission.`,
        })
      ))
      toast.success('Admin, Manager & Pre-Sales alerted!')
    } catch { toast.error('Failed to send alert') }
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-900/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-orange-900 dark:text-orange-300">Stage 7: Final Bid Documentation</h3>
          <p className="text-xs text-orange-700 dark:text-orange-400">Assemble final bid PDF package, technical bid, and financial proposal.</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Button size="sm" variant="outline" onClick={handleNotifyAll} className="gap-1.5 border-orange-300 text-orange-900 dark:text-orange-300 hover:bg-orange-100 text-xs">
            <Bell className="size-3.5" /> Notify All Stakeholders
          </Button>
          <StageHeaderActions
            bid={bid}
            stageKey="BID_DOCUMENTATION"
            onCompleteClick={() => setShowModal(true)}
            onRefresh={onRefresh}
            completeLabel="Ready for Internal Approval"
            completeClass="bg-orange-600 hover:bg-orange-700 text-white"
          />
        </div>
      </div>

      {showModal && (
        <CompleteStageModal
          title="Send Bid for Internal Approval"
          description="Marks Stage 7 (Bid Documentation) as complete. Notifies Managers, Admins, and Pre-Sales leads."
          stageKey="BID_DOCUMENTATION"
          bidId={bid.id}
          bid={bid}
          onClose={() => setShowModal(false)}
          onComplete={async () => {
            toast.success('Internal Approval request triggered!')
            onRefresh()
          }}
        />
      )}
    </div>
  )
}

// ── Stage 8: Internal Approval ──────────────────────────────────────────────
export function Stage8Workspace({ bid, onRefresh }) {
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20 dark:border-yellow-900/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-300">Stage 8: Internal Sign-off & Approval</h3>
          <p className="text-xs text-yellow-700 dark:text-yellow-400">Manager and Executive management review bid package before GeM submission.</p>
        </div>
        <StageHeaderActions
          bid={bid}
          stageKey="INTERNAL_APPROVAL"
          onCompleteClick={() => setShowModal(true)}
          onRefresh={onRefresh}
          completeLabel="Approve & Unlock GeM Submission"
          completeClass="bg-yellow-600 hover:bg-yellow-700 text-white"
        />
      </div>

      {showModal && (
        <CompleteStageModal
          title="Approve Bid Submission"
          description="Marks Stage 8 (Internal Approval) as complete. This will unlock Stage 9: GeM Submission."
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
  const [finalPrice, setFinalPrice] = useState('')
  const { isLocked } = checkStageState(bid, 'GEM_SUBMISSION')

  const handleConfettiSubmit = async (remarks) => {
    let priceNum = finalPrice ? Number(finalPrice) : (bid?.quoted_price ? Number(bid.quoted_price) : null)
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
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 max-w-sm mx-auto">GeM Submission is locked until Stage 8 (Internal Sign-off) is fully approved. Please complete internal approval first.</p>
          <span className="mt-3 inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold border border-amber-300">Current Stage: {bid.workflow_stage?.replace(/_/g,' ')}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-lime-200 bg-lime-50/50 dark:bg-lime-950/20 dark:border-lime-900/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-lime-900 dark:text-lime-300">Stage 9: Tender Submission — GeM Portal</h3>
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
          title="Record GeM Submission"
          description="Marks Stage 9 (GeM Submission) as complete. Enter final bid price submitted on GeM portal."
          stageKey="GEM_SUBMISSION"
          bidId={bid.id}
          bid={bid}
          onClose={() => setShowModal(false)}
          onComplete={handleConfettiSubmit}
        >
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Final Submitted Bid Price (₹) *</Label>
            <Input
              type="number"
              value={finalPrice}
              onChange={(e) => setFinalPrice(e.target.value)}
              placeholder="e.g. 1450000"
              required
            />
            <p className="text-[10px] text-muted-foreground">This is the exact price submitted on the GeM portal. It will be saved as your official quoted price for all further comparisons.</p>
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
      // Stage 10 completion is handled atomically by CompleteStageModal
    } else {
      await recordBidOutcome(bid.id, {
        bid_outcome: 'LOST',
        outcome_reason: `Disqualified in Technical Eval: ${disqualifyReason}`,
      })
    }
    onRefresh()
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/50 dark:bg-teal-950/20 dark:border-teal-900/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-teal-900 dark:text-teal-300">Stage 10: Technical Evaluation</h3>
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
          <h3 className="text-sm font-semibold text-cyan-900 dark:text-cyan-300">Stage 11: Financial Evaluation &amp; L1 Determination</h3>
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
          {/* Our GeM Submitted Price — pre-filled from Stage 9, always editable */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Our GeM Submitted Price (₹) *</Label>
              {stage9Price ? (
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 dark:bg-emerald-950/30 dark:text-emerald-400">
                  ✓ Auto-filled from Stage 9
                </span>
              ) : (
                <span className="text-[10px] text-amber-600 italic">Stage 9 price not set — enter manually</span>
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
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">L1 Company Name</Label><Input size="sm" value={l1Name} onChange={e => setL1Name(e.target.value)} placeholder="Winning bidder name" className="h-8 text-xs"/></div>
                <div className="space-y-1"><Label className="text-xs">Our Rank (e.g. L2, L3)</Label><Input size="sm" value={ourRank} onChange={e => setOurRank(e.target.value)} placeholder="e.g. L2" className="h-8 text-xs"/></div>
              </div>
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
export function Stage12Workspace({ bid, onRefresh }) {
  const [showModal, setShowModal] = useState(false)
  const [emdReturned, setEmdReturned] = useState(!!bid?.emd_returned)
  const [bgProceeded, setBgProceeded] = useState(!!bid?.bg_discharged)
  // PO Received: true when po_received_status === 'PO Received'
  const [poReceived, setPoReceived] = useState(bid?.po_received_status === 'PO Received')

  // Determine if this is a WON or LOST scenario
  // Lost is set when financial eval records LOST outcome, or bid_status is LOST
  const isLostScenario = bid?.bid_status === 'LOST' || bid?.bid_outcome === 'LOST'
  const isWonScenario = !isLostScenario

  useEffect(() => {
    setEmdReturned(!!bid?.emd_returned)
    setBgProceeded(!!bid?.bg_discharged)
    setPoReceived(bid?.po_received_status === 'PO Received')
  }, [bid?.emd_returned, bid?.bg_discharged, bid?.po_received_status])

  const handleEmdToggle = async (checked) => {
    setEmdReturned(checked)
    try {
      const res = await updateBid(bid.id, { emd_returned: checked })
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

  const handlePoReceivedToggle = async (checked) => {
    setPoReceived(checked)
    const newStatus = checked ? 'PO Received' : 'Pending'
    try {
      const res = await updateBid(bid.id, { po_received_status: newStatus })
      if (res.ok) {
        logStageMicroEvent(bid.id, {
          fromStage: 'AWARD_HANDOVER',
          toStage: 'AWARD_HANDOVER',
          eventType: 'FINANCE',
          transitionReason: checked
            ? 'Purchase Order (PO) confirmed as Received from Procuring Authority'
            : 'PO Received status reverted to Pending',
          details: { poReceived: checked, po_received_status: newStatus }
        })
        toast.success(checked ? '✅ PO marked as Received' : 'PO status set to Pending')
        onRefresh()
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleBgToggle = async (checked) => {
    setBgProceeded(checked)
    try {
      const res = await updateBid(bid.id, { bg_discharged: checked })
      if (res.ok) {
        logStageMicroEvent(bid.id, {
          fromStage: 'AWARD_HANDOVER',
          toStage: 'AWARD_HANDOVER',
          eventType: 'FINANCE',
          transitionReason: checked ? 'Marked Performance Bank Guarantee (PBG) as Issued & Submitted' : 'Marked PBG as Pending Submission',
          details: { bgDischarged: checked }
        })
        toast.success(checked ? 'PBG recorded as Issued & Submitted' : 'PBG marked pending')
        onRefresh()
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleFinalClose = async (remarks) => {
    if (isWonScenario) {
      await recordBidOutcome(bid.id, {
        bid_outcome: 'WON',
        outcome_reason: `Award & Handover Completed. EMD Returned: ${emdReturned ? 'Yes' : 'No'}, PBG Submitted: ${bgProceeded ? 'Yes' : 'No'}, PO Received: ${poReceived ? 'Yes' : 'Pending'}. ${remarks}`,
      })
      confetti({ particleCount: 200, spread: 100 })
    } else {
      // LOST — just mark closure with EMD return
      await updateBid(bid.id, {
        emd_returned: emdReturned,
      }).catch(() => {})
      // Update outcome reason if not already set
      await recordBidOutcome(bid.id, {
        bid_outcome: 'LOST',
        outcome_reason: `Bid closed as Lost. EMD Returned: ${emdReturned ? 'Yes' : 'No'}. ${remarks}`,
      }).catch(() => {})
    }
    onRefresh()
  }

  const handleCompleteClick = () => {
    if (!emdReturned) {
      toast.error('Mandatory: EMD Return must be confirmed before closing Stage 12.')
      return
    }
    if (isWonScenario && !bgProceeded) {
      toast.error('Mandatory: Performance Bank Guarantee (PBG) must be confirmed for WON bids.')
      return
    }
    setShowModal(true)
  }

  return (
    <div className="space-y-6">
      <div className={`p-4 rounded-xl border flex items-center justify-between ${
        isWonScenario
          ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/50'
          : 'border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/50'
      }`}>
        <div>
          <h3 className={`text-sm font-semibold ${isWonScenario ? 'text-emerald-900 dark:text-emerald-300' : 'text-red-900 dark:text-red-300'}`}>
            Stage 12: {isWonScenario ? 'Contract Award & Operations Handover' : 'Bid Closure (Lost)'}
          </h3>
          <p className={`text-xs ${isWonScenario ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
            {isWonScenario
              ? 'Final post-win maintenance (EMD return tracking, Performance Bank Guarantee, operations handover).'
              : 'Close out lost bid: confirm EMD return and record final closure remarks.'}
          </p>
        </div>
        <StageHeaderActions
          bid={bid}
          stageKey="AWARD_HANDOVER"
          onCompleteClick={handleCompleteClick}
          onRefresh={onRefresh}
          completeLabel={isWonScenario ? 'Close Bid as WON 🏆' : 'Close Bid as LOST ❌'}
          completeClass={isWonScenario ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}
        />
      </div>

      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Post-Bid Closure Checklist</h4>
        <div className="space-y-2 text-xs">
          {/* EMD Return — shown for BOTH WON and LOST */}
          <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border border-border hover:bg-muted/20 transition-colors">
            <input type="checkbox" checked={emdReturned} onChange={e => handleEmdToggle(e.target.checked)} className="rounded" />
            <div>
              <span className="font-medium">EMD Returned by Procuring Authority</span>
              <p className="text-muted-foreground text-[10px]">Confirm EMD amount has been refunded (applicable for both WON and LOST)</p>
            </div>
          </label>
          {/* PBG — shown ONLY for WON bids */}
          {isWonScenario && (
            <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border border-border hover:bg-muted/20 transition-colors">
              <input type="checkbox" checked={bgProceeded} onChange={e => handleBgToggle(e.target.checked)} className="rounded" />
              <div>
                <span className="font-medium">Performance Bank Guarantee (PBG) Issued &amp; Submitted</span>
                <p className="text-muted-foreground text-[10px]">Confirm PBG has been submitted to the procuring authority (WON bids only)</p>
              </div>
            </label>
          )}
          {/* PO Received — shown ONLY for WON bids */}
          {isWonScenario && (
            <label className={`flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border transition-colors ${
              poReceived
                ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                : 'border-amber-200 bg-amber-50/30 dark:bg-amber-950/10 hover:bg-amber-50/50'
            }`}>
              <input type="checkbox" checked={poReceived} onChange={e => handlePoReceivedToggle(e.target.checked)} className="rounded" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Purchase Order (PO) Received</span>
                  {poReceived ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 rounded px-1.5 py-0.5">✓ Received</span>
                  ) : (
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-300 rounded px-1.5 py-0.5">⏳ Pending</span>
                  )}
                </div>
                <p className="text-muted-foreground text-[10px] mt-0.5">Confirm Purchase Order has been formally received from the procuring authority (WON bids only)</p>
              </div>
            </label>
          )}
        </div>
      </div>

      {showModal && (
        <CompleteStageModal
          title={isWonScenario ? 'Finalize Contract Award & Close Workspace' : 'Close Bid as Lost'}
          description={isWonScenario ? 'Marks bid outcome as WON in analytics and completes tender lifecycle.' : 'Records final closure for lost bid. EMD return must be confirmed.'}
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

// ── Dynamic Dispatcher for Active Stage Workspace ────────────────────────────
export function DynamicStageWorkspace({ bid, selectedStage, onRefresh }) {
  const currentUser = tokenStorage.getUser()
  const userRoles = [
    ...(Array.isArray(currentUser?.roles) ? currentUser.roles : []),
    ...(currentUser?.role ? [currentUser.role] : [])
  ].map(r => String(r).toUpperCase())

  const stage = selectedStage || bid.workflow_stage
  const { isLocked, stageIdx } = checkStageState(bid, stage)

  if (isLocked) {
    const priorStageKey = WORKFLOW_STAGES_ORDERED[stageIdx - 1]
    return (
      <div className="p-8 rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/50 text-center space-y-4 max-w-2xl mx-auto my-6">
        <div className="size-14 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800 shadow-sm">
          <Lock className="size-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-foreground">Stage {stageIdx + 1} ({stage.replace(/_/g, ' ')}) is Locked</h3>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
            Strict enterprise stage-gating is active. All preceding stage sections (Stages 1 through {stageIdx}) must be completed before Stage {stageIdx + 1} can be accessed.
          </p>
        </div>
        <div className="pt-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Lock className="size-3.5" /> Pending Completion of Stage {stageIdx} ({priorStageKey?.replace(/_/g, ' ')})
          </span>
        </div>
      </div>
    )
  }

  // Full access roles (Super Admin, Admin, Manager, Bid Executive)
  const fullAccessRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'BID_EXECUTIVE']
  const isFullAccess = userRoles.some(r => fullAccessRoles.includes(r))

  if (!isFullAccess) {
    // Stages 1, 2, 4, 7, 8, 12 for PRE_SALES
    const preSalesStages = [
      'DISCOVERED',
      'ELIGIBILITY_ASSESSMENT',
      'PRICING_REQUEST',
      'BID_DOCUMENTATION',
      'INTERNAL_APPROVAL',
      'AWARD_HANDOVER'
    ]

    // Stages 1, 5, 6, 12 for FINANCE
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
    case 'ELIGIBILITY_ASSESSMENT':
      return <Stage2Workspace bid={bid} onRefresh={onRefresh} />
    case 'OEM_AUTHORIZATION_REQUEST':
      return <Stage3Workspace bid={bid} onRefresh={onRefresh} />
    case 'PRICING_REQUEST':
      return <Stage4Workspace bid={bid} onRefresh={onRefresh} />
    case 'DOCUMENT_CHECKLIST_PREPARATION':
      return <Stage5Workspace bid={bid} onRefresh={onRefresh} />
    case 'EMD_PROCESSING':
      return <Stage6Workspace bid={bid} onRefresh={onRefresh} />
    case 'BID_DOCUMENTATION':
      return <Stage7Workspace bid={bid} onRefresh={onRefresh} />
    case 'INTERNAL_APPROVAL':
      return <Stage8Workspace bid={bid} onRefresh={onRefresh} />
    case 'GEM_SUBMISSION':
      return <Stage9Workspace bid={bid} onRefresh={onRefresh} />
    case 'TECHNICAL_EVALUATION':
      return <Stage10Workspace bid={bid} onRefresh={onRefresh} />
    case 'FINANCIAL_EVALUATION':
      return <Stage11Workspace bid={bid} onRefresh={onRefresh} />
    case 'AWARD_HANDOVER':
      return <Stage12Workspace bid={bid} onRefresh={onRefresh} />
    default:
      return <Stage1Workspace bid={bid} onRefresh={onRefresh} />
  }
}
