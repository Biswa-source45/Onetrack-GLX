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
import { transitionBidStage, recordBidOutcome, updateBid } from '../../services/bids'
import { usePermissions } from '../../hooks/usePermissions'
import { tokenStorage } from '../../services/auth'

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

      if (stageKey) {
        logStageInteraction(bidId, stageKey, `[Completed Stage Action]: ${remarks}`, null)
      }

      // Call workspace-specific side effect (alerts, confetti, etc.)
      // but NOT transitionBidStage — that would corrupt other stages!
      if (onComplete) {
        await onComplete(remarks)
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
  const user = userOverride || tokenStorage.getUser()
  const resolvedName = (user?.full_name && user.full_name !== 'Anonymous' && user.full_name !== 'Current User' && user.full_name !== 'User')
    ? user.full_name
    : (user?.username || 'Super Admin')

  const key = `onetrack_checklist_history_${bidId}`
  const existing = JSON.parse(localStorage.getItem(key) || '[]')
  const newEvent = {
    id: `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    from_stage: stageKey,
    to_stage: stageKey,
    transition_reason: actionReason,
    created_at: new Date().toISOString(),
    transitioned_by: {
      id: user?.id || 'user',
      full_name: resolvedName,
      username: user?.username || resolvedName
    }
  }
  localStorage.setItem(key, JSON.stringify([newEvent, ...existing]))
  window.dispatchEvent(new Event('onetrack_history_updated'))
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
  const [oems, setOems] = useState(() => {
    const saved = localStorage.getItem(key)
    if (saved) {
      try { return JSON.parse(saved) } catch { return [] }
    }
    return []
  })
  const [isEditing, setIsEditing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [newOemName, setNewOemName] = useState('')

  const saveOemsToStorage = (list) => {
    setOems(list)
    localStorage.setItem(key, JSON.stringify(list))
  }

  const addOem = () => {
    if (!newOemName.trim()) { toast.error('OEM Name required'); return }
    const entry = {
      id: Date.now(), name: newOemName.trim(),
      initiated: 'YES', maf: 'NOT RECEIVED', mii: 'NOT RECEIVED',
      noMalicious: 'NOT RECEIVED', additionalDocs: '',
      followUp: '', remark: '', clarificationRequired: '', clarificationProvided: ''
    }
    saveOemsToStorage([...oems, entry])
    setNewOemName('')
    toast.success(`OEM "${entry.name}" added to matrix`)
  }

  const updateOemField = (id, field, value) => {
    setOems(prev => prev.map(o => o.id === id ? { ...o, [field]: value } : o))
  }

  const handleSaveMatrix = () => {
    localStorage.setItem(key, JSON.stringify(oems))
    setIsEditing(false)
    toast.success('OEM Authorization Matrix saved successfully')
  }

  const deleteOem = (id) => {
    const updated = oems.filter(o => o.id !== id)
    saveOemsToStorage(updated)
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
  const key4 = `onetrack_pricing_${bid.id}`
  const [pricingData, setPricingData] = useState(() => JSON.parse(localStorage.getItem(key4) || JSON.stringify({
    phase: 'INIT', // INIT | AWAITING | QUOTING | APPROVAL
    distNames: [],
    quotes: [], // [{id,distName,items:[{desc,qty,basicPrice}]}]
    selectedDist: '',
    approvalRecipients: [],
  })))
  const [showModal, setShowModal] = useState(false)
  const [showRequestDlg, setShowRequestDlg] = useState(false)
  const [showQuoteDlg, setShowQuoteDlg] = useState(false)
  const [showApprovalDlg, setShowApprovalDlg] = useState(false)
  const [newDistNameInput, setNewDistNameInput] = useState('')
  const [initDistNames, setInitDistNames] = useState('')
  const [quoteDistSel, setQuoteDistSel] = useState('')
  const [quoteItems, setQuoteItems] = useState([{ desc: '', qty: 1, basicPrice: '' }])
  const [marginPct, setMarginPct] = useState(2.45)

  const save = (upd) => {
    const next = { ...pricingData, ...upd }
    setPricingData(next)
    localStorage.setItem(key4, JSON.stringify(next))
  }

  const handleSendRequest = () => {
    const names = initDistNames.split(',').map(s => s.trim()).filter(Boolean)
    if (!names.length) { toast.error('Enter at least one distributor name'); return }
    save({ phase: 'AWAITING', distNames: names })
    setShowRequestDlg(false)
    toast.success('Pricing request sent! Awaiting distributor response.')
  }

  const handleAddQuote = () => {
    const name = quoteDistSel || 'Others'
    if (!quoteItems.some(i => i.desc && i.basicPrice)) { toast.error('Fill at least one item'); return }
    const items = quoteItems.filter(i => i.desc && i.basicPrice).map(i => ({
      desc: i.desc, qty: Number(i.qty) || 1, basicPrice: Number(i.basicPrice) || 0
    }))
    const quotes = [...pricingData.quotes, { id: Date.now(), distName: name, items }]
    save({ phase: 'QUOTING', quotes })
    setShowQuoteDlg(false)
    setQuoteItems([{ desc: '', qty: 1, basicPrice: '' }])
    toast.success('Distributor quote added')
  }

  const handleSendApproval = () => {
    if (!pricingData.approvalRecipients.length) { toast.error('Select at least one recipient'); return }
    import('../../services/alerts').then(({ createAlert }) => {
      pricingData.approvalRecipients.forEach(role => {
        createAlert({ target_role: role.toUpperCase(), bid_id: bid.id, type: 'ACTION_REQUIRED',
          title: `Pricing Approval Required — ${bid.title}`,
          message: `Bid #${bid.gem_bid_no || bid.id}: Pricing calculation from L1 distributor is ready for approval. Please review and approve or request modification.`
        })
      })
    })
    save({ phase: 'APPROVAL' })
    setShowApprovalDlg(false)
    toast.success('Approval request sent to selected recipients!')
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
            {pricingData.phase === 'INIT' && (
              <Button size="sm" onClick={() => setShowRequestDlg(true)} className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs">
                <Send className="size-3.5" /> Send Pricing Request
              </Button>
            )}
            {(pricingData.phase === 'AWAITING' || pricingData.phase === 'QUOTING') && (
              <Button size="sm" variant="outline" onClick={() => setShowQuoteDlg(true)} className="gap-1.5 border-violet-300 text-violet-800 dark:text-violet-300 hover:bg-violet-100 text-xs">
                <Plus className="size-3.5" /> Add Distributor Quote
              </Button>
            )}
            {pricingData.phase === 'QUOTING' && l1Quote && (
              <Button size="sm" variant="outline" onClick={() => setShowApprovalDlg(true)} className="gap-1.5 border-amber-300 text-amber-800 dark:text-amber-300 hover:bg-amber-100 text-xs">
                <Send className="size-3.5" /> Send for Approval
              </Button>
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
              <div className="flex items-center gap-2 mb-2">
                <span className="font-bold text-foreground">{q.distName}</span>
                {l1Quote && l1Quote.id === q.id && <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-100 text-emerald-800 font-bold">L1 — Lowest Quote</span>}
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
              <Input type="number" value={marginPct} onChange={e => setMarginPct(Number(e.target.value))} className="w-20 h-7 text-xs font-bold text-center" step="0.01" />
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
                  <th className="border border-border p-2">GST</th>
                  <th className="border border-border p-2">Purchase Price with GST</th>
                  <th className="border border-border p-2">Total Purchase Price with GST</th>
                  <th className="border border-border p-2">Margin</th>
                  <th className="border border-border p-2">GlobX Unit Price</th>
                  <th className="border border-border p-2">GlobX Total Price</th>
                  <th className="border border-border p-2">Price Check</th>
                </tr>
              </thead>
              <tbody>
                {l1Quote.items.map((it, ii) => {
                  const gst = it.basicPrice * 0.18
                  const priceWithGst = it.basicPrice + gst
                  const totalWithGst = priceWithGst * it.qty
                  const marginAmt = priceWithGst * (marginPct / 100)
                  const globxUnit = priceWithGst + marginAmt
                  const globxTotal = globxUnit * it.qty
                  const priceCheck = globxTotal - totalWithGst
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
                      <td className={`border border-border p-1.5 font-mono font-bold ${priceCheck >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmtMoney(priceCheck)}</td>
                    </tr>
                  )
                })}
                <tr className="bg-emerald-50/60 font-bold">
                  <td colSpan={9} className="border border-border p-2 text-right text-xs font-bold">GlobX Grand Total:</td>
                  <td className="border border-border p-2 font-mono text-emerald-700 text-sm">
                    {fmtMoney(l1Quote.items.reduce((s, it) => {
                      const gstU = it.basicPrice * 0.18
                      const unit = (it.basicPrice + gstU) * (1 + marginPct / 100)
                      return s + unit * it.qty
                    }, 0))}
                  </td>
                  <td className="border border-border p-2"></td>
                </tr>
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
                <option value="Others">Others</option>
              </select>
              {quoteDistSel === 'Others' && (
                <Input value={newDistNameInput} onChange={e => setNewDistNameInput(e.target.value)} placeholder="Enter distributor name" className="text-xs mt-1" onBlur={() => { if (newDistNameInput) setQuoteDistSel(newDistNameInput) }} />
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
          <p className="text-xs text-purple-700 dark:text-purple-400">Ensure all mandatory bidder and OEM documents are compiled and verified.</p>
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

      <div className="p-4 rounded-xl border border-border bg-card space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Document Compilation Status</h4>
        <p className="text-xs text-muted-foreground">Use the Checklist tab above to check off individual items. When all documents are verified, proceed to EMD Processing.</p>
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

  const handleConfettiSubmit = async () => {
    try {
      if (typeof confetti === 'function') {
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })
      }
    } catch { /* non-fatal animation */ }
    onRefresh()
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

// ── Stage 11: Financial Evaluation ─────────────────────────────────────────
export function Stage11Workspace({ bid, onRefresh }) {
  const [showModal, setShowModal] = useState(false)
  const [outcome, setOutcome] = useState('WON')
  const [l1Name, setL1Name] = useState('')
  const [l1Price, setL1Price] = useState('')

  const handleFinancialResult = async (remarks) => {
    if (outcome === 'WON') {
      confetti({ particleCount: 150, spread: 90 })
      // Stage 11 completion is handled atomically by CompleteStageModal
    } else {
      await recordBidOutcome(bid.id, {
        bid_outcome: 'LOST',
        l1_price: l1Price ? Number(l1Price) : undefined,
        outcome_reason: `Lost to L1: ${l1Name || 'Competitor'}. ${remarks}`,
      })
    }
    onRefresh()
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-cyan-200 bg-cyan-50/50 dark:bg-cyan-950/20 dark:border-cyan-900/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-cyan-900 dark:text-cyan-300">Stage 11: Financial Evaluation & L1 Determination</h3>
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
          {outcome === 'LOST' && (
            <div className="space-y-3">
              <div className="space-y-1"><Label className="text-xs">L1 Company Name</Label><Input size="sm" value={l1Name} onChange={e=>setL1Name(e.target.value)} placeholder="Winning bidder name" className="h-8 text-xs"/></div>
              <div className="space-y-1"><Label className="text-xs">L1 Price (₹)</Label><Input type="number" size="sm" value={l1Price} onChange={e=>setL1Price(e.target.value)} placeholder="Winning price" className="h-8 text-xs"/></div>
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

  useEffect(() => {
    setEmdReturned(!!bid?.emd_returned)
    setBgProceeded(!!bid?.bg_discharged)
  }, [bid?.emd_returned, bid?.bg_discharged])

  const handleEmdToggle = async (checked) => {
    setEmdReturned(checked)
    try {
      const res = await updateBid(bid.id, { emd_returned: checked })
      if (res.ok) {
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
      const res = await updateBid(bid.id, { bg_discharged: checked })
      if (res.ok) {
        toast.success(checked ? 'PBG recorded as Issued & Submitted' : 'PBG marked pending')
        onRefresh()
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleFinalAward = async (remarks) => {
    await recordBidOutcome(bid.id, {
      bid_outcome: 'WON',
      outcome_reason: `Award & Handover Completed. EMD Returned: ${emdReturned ? 'Yes' : 'No'}, BG Proceeded: ${bgProceeded ? 'Yes' : 'No'}. ${remarks}`,
    })
    confetti({ particleCount: 200, spread: 100 })
    onRefresh()
  }

  const handleCompleteClick = () => {
    if (!emdReturned) {
      toast.error('Mandatory Checklist Required: EMD Return must be checked before completing Stage 12.')
      return
    }
    if (!bgProceeded) {
      toast.error('Mandatory Checklist Required: PBG Submission must be checked before completing Stage 12.')
      return
    }
    setShowModal(true)
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">Stage 12: Contract Award & Operations Handover</h3>
          <p className="text-xs text-emerald-700 dark:text-emerald-400">Final post-win maintenance (EMD return tracking, Bank Guarantee proceed, operations handover).</p>
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
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Post-Win Maintenance Checklist</h4>
        <div className="space-y-2 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={emdReturned} onChange={e => handleEmdToggle(e.target.checked)} className="rounded" />
            <span>EMD Returned by Procuring Authority</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={bgProceeded} onChange={e => handleBgToggle(e.target.checked)} className="rounded" />
            <span>Performance Bank Guarantee (PBG) Issued & Submitted</span>
          </label>
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
          onComplete={handleFinalAward}
        />
      )}
    </div>
  )
}

// ── Dynamic Dispatcher for Active Stage Workspace ────────────────────────────
export function DynamicStageWorkspace({ bid, selectedStage, onRefresh }) {
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
