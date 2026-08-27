import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Loader2, AlertCircle, Clock, Building2,
  DollarSign, Users, Plus, ChevronRight, CheckCircle2, CheckSquare,
  XCircle, Edit2, Save, X, MoreHorizontal, Calendar,
  FileText, Activity, History, UserPlus, Target, ChevronDown,
  RotateCcw, Trash2, Trophy, Search, ShieldCheck, Share2, Coins, Eye,
  Send, Upload, Hourglass, Ban, ArrowRight, Layers, Lock, Check, Sparkles, AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  getBid, getBidStageHistory, transitionBidStage,
  addBidMember, removeBidMember, recordBidOutcome, archiveBid, updateBid,
  softDeleteBid, restoreBid, permanentDeleteBid,
  STAGE_LABELS, STAGE_COLORS, STATUS_COLORS, STAGE_TRANSITIONS,
  WORKFLOW_STAGES_ORDERED,
} from '../../services/bids'
import { usePermissions } from '../../hooks/usePermissions'
import { tokenStorage } from '../../services/auth'
import { ChecklistTab } from './ChecklistTab'
import { listUsers } from '../../services/users'
import { EditTenderDialog } from './EditTenderDialog'
import { DynamicStageWorkspace, checkStageState } from './StageWorkspaces'

function isValidDate(dt) {
  if (!dt) return false
  const d = new Date(dt)
  if (isNaN(d.getTime())) return false
  if (d.getFullYear() <= 1970) return false
  return true
}

function fmt(dt, fallback = '—') {
  if (!isValidDate(dt)) return fallback
  return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatFullDateTime(dt) {
  if (!isValidDate(dt)) return '—'
  const d = new Date(dt)
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

function getBidStartDate(bid) {
  if (!bid) return 'Not Specified'
  if (isValidDate(bid.start_date)) return fmt(bid.start_date)
  if (isValidDate(bid.opening_date)) return fmt(bid.opening_date)
  return 'Not Specified'
}

function getBidEndDate(bid) {
  if (!bid) return 'Not Specified'
  // end_date/closing_date/submission_deadline carry a real time-of-day —
  // show it in full so a same-day deadline isn't misread as "any time today".
  if (isValidDate(bid.end_date)) return formatFullDateTime(bid.end_date)
  if (isValidDate(bid.closing_date)) return formatFullDateTime(bid.closing_date)
  if (isValidDate(bid.submission_deadline)) return formatFullDateTime(bid.submission_deadline)
  if (isValidDate(bid.target_month_date)) return fmt(bid.target_month_date)
  return 'Not Specified'
}

function fmtMoney(v) {
  if (!v && v !== 0) return '—'
  if (v >= 10000000) return `₹${(v/10000000).toFixed(1)}Cr`
  if (v >= 100000) return `₹${(v/100000).toFixed(1)}L`
  return `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

function StageBadge({ stage }) {
  if (stage === 'CHECKLIST_UPDATE') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50">
        Checklist Activity
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${STAGE_COLORS[stage] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {STAGE_LABELS[stage] ?? stage}
    </span>
  )
}

// ── Workflow Stepper ─────────────────────────────────────────────────────────
function WorkflowStepper({ currentStage, stageCompletions = {} }) {
  const idx = WORKFLOW_STAGES_ORDERED.indexOf(currentStage)
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex items-center gap-0 min-w-max">
        {WORKFLOW_STAGES_ORDERED.map((stage, i) => {
          const isExplicitlyDone = stageCompletions[stage] === true
          const done   = i < idx || isExplicitlyDone
          const active = i === idx && !isExplicitlyDone
          return (
            <React.Fragment key={stage}>
              <div className="flex flex-col items-center gap-1">
                <div className={`size-6 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all
                  ${done   ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                  : active ? 'bg-primary/10 border-primary text-primary ring-2 ring-primary/20 font-bold'
                           : 'bg-background border-border text-muted-foreground'}`}>
                  {done ? <CheckCircle2 className="size-3.5" /> : i + 1}
                </div>
                <span className={`text-[10px] font-medium max-w-[60px] text-center leading-tight
                  ${active ? 'text-primary font-bold' : done ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-muted-foreground'}`}>
                  {STAGE_LABELS[stage]}
                </span>
              </div>
              {i < WORKFLOW_STAGES_ORDERED.length - 1 && (
                <div className={`h-0.5 w-8 mb-4 mx-0.5 transition-colors ${i < idx || isExplicitlyDone ? 'bg-emerald-600' : 'bg-border'}`} />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}


// ── Transition Dialog ────────────────────────────────────────────────────────
function TransitionDialog({ bid, onClose, onDone }) {
  const allowed = STAGE_TRANSITIONS[bid.workflow_stage] ?? []
  const [target, setTarget] = useState(allowed[0] ?? '')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!target) return
    setLoading(true)
    try {
      const res = await transitionBidStage(bid.id, target, reason)
      if (res.ok) { toast.success(`Stage moved to ${STAGE_LABELS[target]}`); onDone() }
      else toast.error(res.error?.message ?? 'Transition failed')
    } catch { toast.error('Network error') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
        className="absolute inset-0 bg-foreground/25 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{opacity:0,scale:0.95,y:10}} animate={{opacity:1,scale:1,y:0}}
        exit={{opacity:0,scale:0.95,y:10}}
        transition={{type:'spring',stiffness:400,damping:30}}
        className="relative z-10 w-full max-w-md bg-card border border-border rounded-xl shadow-xl p-6 space-y-4"
        onClick={e=>e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-semibold text-foreground">Advance Stage</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground"><X className="size-4"/></button>
        </div>
        <p className="text-xs text-muted-foreground">Current: <StageBadge stage={bid.workflow_stage} /></p>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Target Stage *</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild disabled={allowed.length === 0}>
                <Button variant="outline" size="sm" className="w-full h-9 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5 disabled:opacity-50">
                  <span>{target ? (STAGE_LABELS[target] ?? target) : 'Select target stage...'}</span>
                  <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
                <DropdownMenuLabel>Select Target Stage</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {allowed.map((s) => (
                  <DropdownMenuItem key={s} onSelect={() => setTarget(s)}>
                    {STAGE_LABELS[s]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Reason (optional)</Label>
            <Textarea value={reason} onChange={e=>setReason(e.target.value)}
              placeholder="Briefly describe why this stage is being advanced…" className="text-sm min-h-[60px]" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" size="sm" className="flex-1" disabled={loading || allowed.length === 0}>
              {loading && <Loader2 className="size-3.5 animate-spin mr-1"/>}Move Stage
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── Stage History Tab ────────────────────────────────────────────────────────
// ── Stage History Tab ────────────────────────────────────────────────────────
const STAGE_ICONS = {
  DISCOVERED:             Search,
  QUALIFICATION_REVIEW:   ShieldCheck,
  DOCUMENT_COMPILATION:   FileText,
  OEM_COORDINATION:       Share2,
  COMMERCIAL_PREPARATION: Coins,
  INTERNAL_REVIEW:        Eye,
  FINAL_APPROVAL:         CheckCircle2,
  READY_FOR_SUBMISSION:   Send,
  SUBMITTED:              Upload,
  RA_ACTIVE:              Activity,
  AWAITING_RESULT:        Hourglass,
  WON:                    Trophy,
  LOST:                   XCircle,
  CANCELLED:              Ban,
  CHECKLIST_UPDATE:       CheckSquare,
}

function getUserDisplayName(actor) {
  try {
    if (!actor) {
      const active = tokenStorage.getUser()
      return active?.full_name || active?.username || 'Super Admin'
    }
    if (typeof actor === 'string') {
      if (['user', 'User', 'Anonymous', 'Current User', ''].includes(actor.trim())) {
        const active = tokenStorage.getUser()
        return active?.full_name || active?.username || 'Super Admin'
      }
      return actor
    }
    if (typeof actor === 'object') {
      const fn = actor.full_name || actor.name || actor.displayName
      if (fn && !['Anonymous', 'User', 'Current User', 'user'].includes(fn.trim())) {
        return fn
      }
      if (actor.username && !['user', 'Anonymous', 'unknown'].includes(actor.username.trim())) {
        return actor.username
      }
      if (actor.email) {
        return actor.email.split('@')[0]
      }
    }
    const active = tokenStorage.getUser()
    return active?.full_name || active?.username || 'Super Admin'
  } catch {
    return 'Super Admin'
  }
}

function getEventTypeBadge(type) {
  switch (type) {
    case 'PRICING':
      return { label: 'Pricing & Quotes', class: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200' }
    case 'CHECKLIST':
      return { label: 'Checklist Audit', class: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200' }
    case 'ALERT':
      return { label: 'Alert & Mail Log', class: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200' }
    case 'OUTCOME':
      return { label: 'Bid Result / Outcome', class: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200' }
    case 'OEM':
      return { label: 'OEM Coordination', class: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200' }
    case 'STAGE_CHANGE':
    default:
      return { label: 'Stage Transition', class: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200' }
  }
}

function extractCommercialDetails(entry, bid) {
  if (!entry) return { hasCommercialData: false }
  const details = entry.details || {}
  
  let quotedPrice = details.quoted_price || details.final_price || details.offered_price || details.finalPrice
  let l1Price = details.l1_price || details.l1Price
  let l1Company = details.l1_company_name || details.l1Name || details.l1Distributor
  let priceDiffPct = details.price_difference_pct ?? details.priceDiffPct
  let ourRank = details.our_rank || details.ourRank
  let outcome = details.outcome || details.bid_outcome
  let marginPct = details.marginPct
  let grandTotalGlobxPrice = details.grandTotalGlobxPrice
  let grandTotalProfit = details.grandTotalProfit

  // Fallback: If stage is GEM_SUBMISSION and bid.quoted_price exists
  if (!quotedPrice && (entry.to_stage === 'GEM_SUBMISSION' || entry.from_stage === 'GEM_SUBMISSION') && bid?.quoted_price) {
    quotedPrice = bid.quoted_price
  }

  // Fallback: Parse from transition_reason if missing in details (e.g. ₹14,50,000)
  if (!quotedPrice && entry.transition_reason) {
    const match = entry.transition_reason.match(/₹\s*([\d,]+(?:\.\d+)?)/)
    if (match) {
      const cleanNum = Number(match[1].replace(/,/g, ''))
      if (!isNaN(cleanNum) && cleanNum > 0) {
        quotedPrice = cleanNum
      }
    }
  }

  if (!l1Price && entry.transition_reason) {
    const l1Match = entry.transition_reason.match(/L1.*quoted at ₹\s*([\d,]+(?:\.\d+)?)/i)
    if (l1Match) {
      const cleanNum = Number(l1Match[1].replace(/,/g, ''))
      if (!isNaN(cleanNum) && cleanNum > 0) {
        l1Price = cleanNum
      }
    }
  }

  return {
    quotedPrice,
    l1Price,
    l1Company,
    priceDiffPct,
    ourRank,
    outcome,
    marginPct,
    grandTotalGlobxPrice,
    grandTotalProfit,
    hasCommercialData: !!(quotedPrice || l1Price || outcome || marginPct || grandTotalGlobxPrice || l1Company)
  }
}

function StageDetailCard({ entry, isLatest, bid }) {
  if (!entry) return null

  const IconComponent = STAGE_ICONS[entry.to_stage] || Activity
  const stageColorClass = STAGE_COLORS[entry.to_stage] ?? 'bg-gray-100 text-gray-700 border-gray-200'
  const displayName = getUserDisplayName(entry.transitioned_by)
  const eventBadge = getEventTypeBadge(entry.event_type || (entry.to_stage === 'CHECKLIST_UPDATE' ? 'CHECKLIST' : 'STAGE_CHANGE'))
  const comm = extractCommercialDetails(entry, bid)

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-4 space-y-4 transition-all duration-300">
      {/* Inspector Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${eventBadge.class}`}>
              {eventBadge.label}
            </span>
            {isLatest && (
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 uppercase tracking-widest">
                Latest Action
              </span>
            )}
          </div>
          <h4 className="font-heading font-semibold text-foreground text-sm pt-1">
            {STAGE_LABELS[entry.to_stage] ?? entry.to_stage}
          </h4>
        </div>
        <div className={`p-2 rounded-lg border ${stageColorClass}`}>
          <IconComponent className="size-4 shrink-0" />
        </div>
      </div>

      {/* Transition Path */}
      <div className="space-y-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Stage Context / Lifecycle Target</span>
        <div className="flex items-center gap-1.5 flex-wrap bg-muted/30 p-2 rounded-md border border-border/40 text-xs">
          {entry.from_stage ? (
            <>
              <StageBadge stage={entry.from_stage} />
              <ArrowRight className="size-3 text-muted-foreground" />
            </>
          ) : (
            <span className="text-xs text-muted-foreground font-medium italic">Workspace Stage</span>
          )}
          <StageBadge stage={entry.to_stage} />
        </div>
      </div>

      {/* Time & Actor Audit */}
      <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
        <div>
          <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider block">Timestamp</span>
          <span className="font-medium text-foreground text-[11px] font-mono">{formatFullDateTime(entry.created_at)}</span>
        </div>
        <div>
          <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider block">Triggered By</span>
          <span className="font-semibold text-primary text-xs flex items-center gap-1">
            <Users className="size-3 text-primary/70" />
            {displayName}
          </span>
        </div>
      </div>

      {/* Commercial & Final Value Highlights Box */}
      {comm.hasCommercialData && (
        <div className="pt-3 border-t border-border/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <Coins className="size-3.5 text-emerald-600 dark:text-emerald-400" /> Commercial &amp; Final Submitted Value
            </span>
            {comm.outcome && (
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider border ${
                comm.outcome === 'WON' ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-200'
              }`}>
                {comm.outcome === 'WON' ? '🏆 WON / L1' : '❌ LOST'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5 bg-emerald-50/60 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/50">
            {comm.quotedPrice && (
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[10px] text-muted-foreground font-semibold block">Final Offered / Quoted Price</span>
                <span className="font-mono font-extrabold text-sm text-emerald-700 dark:text-emerald-300">
                  {fmtMoney(comm.quotedPrice)}
                </span>
              </div>
            )}
            {comm.grandTotalGlobxPrice && (
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[10px] text-muted-foreground font-semibold block">GlobX Total Selling Price</span>
                <span className="font-mono font-extrabold text-sm text-indigo-600 dark:text-indigo-300">
                  {fmtMoney(comm.grandTotalGlobxPrice)}
                </span>
              </div>
            )}
            {comm.grandTotalProfit && (
              <div>
                <span className="text-[10px] text-muted-foreground font-semibold block">Estimated GlobX Profit</span>
                <span className="font-mono font-extrabold text-xs text-emerald-600 dark:text-emerald-400">
                  {fmtMoney(comm.grandTotalProfit)} {comm.marginPct ? `(${comm.marginPct}%)` : ''}
                </span>
              </div>
            )}
            {comm.l1Company && (
              <div>
                <span className="text-[10px] text-muted-foreground font-semibold block">L1 Distributor / Company</span>
                <span className="font-bold text-xs text-foreground">{comm.l1Company}</span>
              </div>
            )}
            {comm.l1Price && (
              <div>
                <span className="text-[10px] text-muted-foreground font-semibold block">L1 Winning Bid Price</span>
                <span className="font-mono font-bold text-xs text-red-600 dark:text-red-400">{fmtMoney(comm.l1Price)}</span>
              </div>
            )}
            {comm.priceDiffPct != null && (
              <div>
                <span className="text-[10px] text-muted-foreground font-semibold block">Price Variance</span>
                <span className={`font-mono font-bold text-xs ${comm.priceDiffPct > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {comm.priceDiffPct > 0 ? '+' : ''}{comm.priceDiffPct}%
                </span>
              </div>
            )}
            {comm.ourRank && (
              <div>
                <span className="text-[10px] text-muted-foreground font-semibold block">GlobX Bid Rank</span>
                <span className="font-bold text-xs text-foreground">{comm.ourRank}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reason / Micro-Log Summary */}
      <div className="pt-3 border-t border-border/60 space-y-1">
        <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider block">Micro Event / Transition Summary</span>
        <div className="bg-muted/10 p-3 rounded-md border border-border/40 min-h-[60px] flex items-start gap-2">
          <FileText className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-foreground font-medium leading-relaxed whitespace-pre-wrap">
            {entry.transition_reason || 'No specific remarks recorded.'}
          </p>
        </div>
      </div>

      {/* Micro Details Payload Inspector */}
      {entry.details && typeof entry.details === 'object' && (
        <div className="pt-2 border-t border-border/60 space-y-1">
          <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider block">Recorded Payload Metadata</span>
          <div className="bg-slate-950 text-slate-100 p-2.5 rounded-md font-mono text-[11px] overflow-x-auto border border-slate-800">
            <pre>{JSON.stringify(entry.details, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

function StageHistoryTab({ bidId, bid }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const [filterType, setFilterType] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStageFilter, setSelectedStageFilter] = useState(null)

  const WORKFLOW_STAGES = [
    'DISCOVERED', 'OEM_AUTHORIZATION_REQUEST',
    'PRICING_REQUEST', 'DOCUMENT_CHECKLIST_PREPARATION', 'EMD_PROCESSING',
    'INTERNAL_APPROVAL', 'GEM_SUBMISSION',
    'TECHNICAL_EVALUATION', 'FINANCIAL_EVALUATION', 'AWARD_HANDOVER'
  ]

  useEffect(() => {
    function loadHistory() {
      getBidStageHistory(bidId).then(r => {
        let backendData = r.ok ? (r.data ?? []) : []
        const localHistoryKey = `onetrack_checklist_history_${bidId}`
        const localEvents = JSON.parse(localStorage.getItem(localHistoryKey) || '[]')

        // Combine and derive event_type for legacy events if missing
        const combined = [...backendData, ...localEvents].map(item => {
          let derivedType = item.event_type || item.eventType
          if (!derivedType) {
            if (item.to_stage === 'CHECKLIST_UPDATE' || item.transition_reason?.toLowerCase().includes('checklist')) {
              derivedType = 'CHECKLIST'
            } else if (item.transition_reason?.toLowerCase().includes('pricing') || item.transition_reason?.toLowerCase().includes('quote')) {
              derivedType = 'PRICING'
            } else if (item.transition_reason?.toLowerCase().includes('oem')) {
              derivedType = 'OEM'
            } else if (item.transition_reason?.toLowerCase().includes('alert') || item.transition_reason?.toLowerCase().includes('mail')) {
              derivedType = 'ALERT'
            } else if (item.transition_reason?.toLowerCase().includes('outcome')) {
              derivedType = 'OUTCOME'
            } else {
              derivedType = 'STAGE_CHANGE'
            }
          }
          return { ...item, event_type: derivedType }
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

        setHistory(combined)
        if (combined.length > 0) {
          setSelectedIndex(0)
        }
        setLoading(false)
      })
    }

    loadHistory()
    window.addEventListener('onetrack_history_updated', loadHistory)
    return () => window.removeEventListener('onetrack_history_updated', loadHistory)
  }, [bidId])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-primary"/></div>

  // Filter history
  const filteredHistory = history.filter(item => {
    if (filterType !== 'ALL' && item.event_type !== filterType) return false
    if (selectedStageFilter && item.to_stage !== selectedStageFilter && item.from_stage !== selectedStageFilter) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const reason = (item.transition_reason || '').toLowerCase()
      const user = getUserDisplayName(item.transitioned_by).toLowerCase()
      const stage = (item.to_stage || '').toLowerCase()
      return reason.includes(q) || user.includes(q) || stage.includes(q)
    }
    return true
  })

  // Stage event counters for graph
  const stageEventCounts = WORKFLOW_STAGES.reduce((acc, stg) => {
    acc[stg] = history.filter(h => h.to_stage === stg || h.from_stage === stg).length
    return acc
  }, {})

  // Right-panel preview index: hover previews without touching the click-selection
  // below, so hovering across a densely packed list doesn't repaint every card's
  // border/ring/scale on each pointer move (that coupling was the flicker bug).
  const activeIndex = hoveredIndex !== null ? hoveredIndex : (selectedIndex !== null ? selectedIndex : 0)
  const activeEntry = filteredHistory[activeIndex] || filteredHistory[0]
  const isLatestActive = activeIndex === 0 && filterType === 'ALL' && !searchQuery && !selectedStageFilter
  const listSelectedIndex = selectedIndex !== null ? selectedIndex : 0

  return (
    <div className="space-y-6">
      {/* Header Audit Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold font-heading text-foreground flex items-center gap-2">
              <History className="size-4 text-primary" /> Enterprise Stage & Audit History Log
            </h3>
            <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-200">
              Granular Micro-Traceability Active
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Complete event stream capturing stage advances, commercial quotes, alerts, checklist modifications, and bid outcome entries.
          </p>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search audit trail..."
            className="pl-9 text-xs h-9"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* 12-Stage Visual Stepper Pipeline Map */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="size-3.5 text-primary" /> Lifecycle Stage Activity Graph
          </span>
          {selectedStageFilter && (
            <button
              onClick={() => setSelectedStageFilter(null)}
              className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
            >
              Clear Stage Filter ({selectedStageFilter})
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-1">
          {WORKFLOW_STAGES.map((stg, i) => {
            const count = stageEventCounts[stg] || 0
            const isFilterActive = selectedStageFilter === stg
            return (
              <button
                key={stg}
                onClick={() => setSelectedStageFilter(isFilterActive ? null : stg)}
                className={`p-2 rounded-lg border text-left transition-all text-xs flex flex-col justify-between h-16 ${
                  isFilterActive
                    ? 'border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20'
                    : count > 0
                    ? 'border-border bg-muted/20 hover:border-primary/50'
                    : 'border-border/40 bg-muted/5 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-mono text-[9px] font-bold text-muted-foreground">S{i + 1}</span>
                  {count > 0 && (
                    <span className="text-[9px] font-bold bg-primary text-primary-foreground px-1.5 py-0.2 rounded-full">
                      {count}
                    </span>
                  )}
                </div>
                <span className="font-semibold text-[10px] line-clamp-1 text-foreground leading-tight">
                  {STAGE_LABELS[stg] || stg}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Filter Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'ALL', label: `All Events (${history.length})` },
          { id: 'STAGE_CHANGE', label: 'Stage Transitions' },
          { id: 'OEM', label: 'OEM Matrix' },
          { id: 'PRICING', label: 'Pricing & Quotes' },
          { id: 'CHECKLIST', label: 'Checklist Audit' },
          { id: 'ALERT', label: 'Alerts & Mail' },
          { id: 'OUTCOME', label: 'Bid Outcomes' }
        ].map(cat => (
          <button
            key={cat.id}
            onClick={() => setFilterType(cat.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${
              filterType === cat.id
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/30'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Timeline Stream & Inspector Grid */}
      {filteredHistory.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-border rounded-xl bg-card">
          <AlertCircle className="size-8 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium text-foreground">No events found matching your search or filters.</p>
          <p className="text-xs text-muted-foreground mt-1">Try resetting the stage filter or search term.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
          {/* Left Column: Interactive Audit Event Timeline */}
          <div className="md:col-span-3 space-y-4 relative pl-4">
            <div className="absolute left-[29px] top-4 bottom-4 w-0.5 bg-border/60" />

            <div className="space-y-4">
              {filteredHistory.map((h, i) => {
                // Click-driven only — deliberately NOT tied to hoveredIndex/activeIndex,
                // so moving the mouse across a densely packed list doesn't repaint
                // every card's border/ring/scale on each pointer move (flicker bug).
                const isSelected = i === listSelectedIndex
                const isLatest = i === 0 && filterType === 'ALL' && !searchQuery && !selectedStageFilter
                const IconComponent = STAGE_ICONS[h.to_stage] || Clock
                const badgeInfo = getEventTypeBadge(h.event_type)

                return (
                  <motion.div
                    key={h.id ?? i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => setSelectedIndex(i)}
                    className="relative cursor-pointer pl-8 group"
                  >
                    {/* Bullet Node */}
                    <div
                      className={`absolute left-0 top-1.5 size-6 rounded-full border bg-background flex items-center justify-center transition-all duration-300 z-10 shadow-sm
                        ${isSelected
                          ? 'border-primary ring-4 ring-primary/10 scale-110'
                          : isLatest
                          ? 'border-emerald-500 ring-2 ring-emerald-500/10'
                          : 'border-border group-hover:border-muted-foreground'
                        }`}
                    >
                      <IconComponent className={`size-3 transition-colors
                        ${isSelected
                          ? 'text-primary'
                          : isLatest
                          ? 'text-emerald-500'
                          : 'text-muted-foreground group-hover:text-foreground'
                        }`}
                      />
                    </div>

                    {/* Card Container */}
                    <div
                      className={`p-3.5 rounded-xl border transition-all duration-300 space-y-2
                        ${isSelected
                          ? 'bg-primary/5 border-primary/40 shadow-md ring-1 ring-primary/20'
                          : 'bg-card border-border/70 group-hover:border-border group-hover:bg-muted/10'
                        }`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${badgeInfo.class}`}>
                            {badgeInfo.label}
                          </span>
                          {h.from_stage && h.from_stage !== h.to_stage && (
                            <>
                              <StageBadge stage={h.from_stage} />
                              <ArrowRight className="size-3 text-muted-foreground" />
                            </>
                          )}
                          <StageBadge stage={h.to_stage} />
                        </div>
                        <span className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground font-medium bg-muted/40 px-2 py-0.5 rounded border border-border/40">
                          <Clock className="size-2.5" />
                          {formatFullDateTime(h.created_at)}
                        </span>
                      </div>

                      {h.transition_reason && (
                        <p className="text-xs text-foreground font-medium italic leading-relaxed">
                          "{h.transition_reason}"
                        </p>
                      )}

                      {/* Prominent Commercial & Final Price Chip */}
                      {(() => {
                        const c = extractCommercialDetails(h, bid)
                        if (!c.hasCommercialData) return null
                        return (
                          <div className="flex items-center gap-2 flex-wrap pt-1">
                            {c.quotedPrice && (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-extrabold px-2.5 py-1 rounded-md bg-emerald-500 text-white shadow-xs">
                                <Coins className="size-3.5 text-emerald-100" />
                                Final Price: {fmtMoney(c.quotedPrice)}
                              </span>
                            )}
                            {c.grandTotalGlobxPrice && !c.quotedPrice && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200 border border-indigo-300/60">
                                Total GlobX Price: {fmtMoney(c.grandTotalGlobxPrice)}
                              </span>
                            )}
                            {c.l1Price && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300/60">
                                L1: {fmtMoney(c.l1Price)}
                              </span>
                            )}
                            {c.outcome && (
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wider ${
                                c.outcome === 'WON' ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-200'
                              }`}>
                                {c.outcome === 'WON' ? 'WON / L1' : 'LOST'}
                              </span>
                            )}
                          </div>
                        )
                      })()}

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/40 pt-1.5">
                        <span className="font-semibold text-primary/90 flex items-center gap-1">
                          <Users className="size-3 text-primary/60" /> By {getUserDisplayName(h.transitioned_by)}
                        </span>
                        <span className="font-mono text-[9px]">ID: {h.id ? String(h.id).substring(0, 14) : `evt-${i}`}</span>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* Right Column: Audit Inspector Detail Card (Sticky) */}
          <div className="md:col-span-2 md:sticky md:top-4">
            <StageDetailCard entry={activeEntry} isLatest={isLatestActive} bid={bid} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Members Tab ──────────────────────────────────────────────────────────────
function MembersTab({ bid, onRefresh }) {
  const { hasPermission } = usePermissions()
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState('')
  const [role, setRole] = useState('MEMBER')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    listUsers({ limit: 100 }).then(r => {
      if (r.ok) setUsers(Array.isArray(r.data?.users) ? r.data.users : [])
    })
  }, [])

  async function handleAdd() {
    if (!selectedUser) return
    setLoading(true)
    try {
      const res = await addBidMember(bid.id, selectedUser, role)
      if (res.ok) { toast.success('Member added'); onRefresh(); setSelectedUser('') }
      else toast.error(res.error?.message ?? 'Failed to add member')
    } catch { toast.error('Network error') }
    finally { setLoading(false) }
  }

  async function handleRemove(userId) {
    try {
      const res = await removeBidMember(bid.id, userId)
      if (res.ok) { toast.success('Member removed'); onRefresh() }
      else toast.error(res.error?.message ?? 'Failed')
    } catch { toast.error('Network error') }
  }

  const ROLES = ['OWNER','MANAGER','MEMBER','REVIEWER','OBSERVER']
  return (
    <div className="space-y-4">
      {hasPermission('bid.edit') && !['ARCHIVED', 'CANCELLED', 'WON', 'LOST'].includes(bid.bid_status) && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Add Member</p>
          <div className="flex gap-2 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 min-w-[180px] h-8 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5">
                  <span>{selectedUser ? (users.find(u => u.id === selectedUser)?.full_name ?? 'Select user...') : 'Select user...'}</span>
                  <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-60 overflow-y-auto w-[220px]">
                <DropdownMenuLabel>Select User</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {users.map((u) => (
                  <DropdownMenuItem key={u.id} onSelect={() => setSelectedUser(u.id)}>
                    {u.full_name} (@{u.username})
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5 min-w-[100px]">
                  <span>{role}</span>
                  <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Select Role</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ROLES.map((r) => (
                  <DropdownMenuItem key={r} onSelect={() => setRole(r)}>
                    {r}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" className="h-8 gap-1" onClick={handleAdd} disabled={loading||!selectedUser}>
              {loading?<Loader2 className="size-3.5 animate-spin"/>:<Plus className="size-3.5"/>}Add
            </Button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {(bid.members ?? []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No members yet.</p>}
        {(bid.members ?? []).map((m,i)=>(
          <motion.div key={m.user_id} initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} transition={{delay:i*0.04}}
            className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                {m.full_name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{m.full_name}</p>
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{m.role}</span>
              </div>
            </div>
            {hasPermission('bid.edit') && !['ARCHIVED', 'CANCELLED', 'WON', 'LOST'].includes(bid.bid_status) && (
              <button onClick={()=>handleRemove(m.user_id)}
                className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <X className="size-3.5"/>
              </button>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ── Stage Sections Tab (Interactive 12-Stage Lifecycle Grid & Workspace) ─────
function StageSectionsTab({ bid, onRefresh, onAdvance }) {
  const currentIdx = WORKFLOW_STAGES_ORDERED.indexOf(bid.workflow_stage)
  const isTerminal = ['WON', 'LOST', 'CANCELLED', 'ARCHIVED'].includes(bid.bid_status)
  
  // Selected stage state (defaults to current active stage of the tender)
  const [selectedStage, setSelectedStage] = useState(bid.workflow_stage)
  const selectedIdx = WORKFLOW_STAGES_ORDERED.indexOf(selectedStage)

  const selectedGuide = STAGE_GUIDE[selectedStage] || {
    title: STAGE_LABELS[selectedStage] || selectedStage,
    description: 'Execute stage requirements.',
    responsible: 'Bid Team',
    actions: [],
    note: '',
  }

  // Action states for selected stage
  const [checkedActions, setCheckedActions] = useState({})
  const [stageNotes, setStageNotes] = useState('')
  const [updatingStage, setUpdatingStage] = useState(false)

  const isSelectedCompleted = selectedIdx < currentIdx || (isTerminal && selectedIdx <= currentIdx)
  const isSelectedCurrent = selectedIdx === currentIdx && !isTerminal

  async function handleSetCurrentStage(targetStage) {
    setUpdatingStage(true)
    try {
      const res = await transitionBidStage(bid.id, {
        target_stage: targetStage,
        remarks: `Navigated directly to stage: ${STAGE_LABELS[targetStage] || targetStage}`,
      })
      if (res.ok) {
        toast.success(`Workflow stage updated to ${STAGE_LABELS[targetStage] || targetStage}`)
        if (onRefresh) onRefresh()
      } else {
        toast.error(res.error?.message ?? 'Failed to update workflow stage')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setUpdatingStage(false)
    }
  }

  const toggleAction = (idx) => {
    setCheckedActions(prev => ({
      ...prev,
      [`${selectedStage}_${idx}`]: !prev[`${selectedStage}_${idx}`]
    }))
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-card border border-border p-4 rounded-xl">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Layers className="size-4 text-primary" /> Tender Lifecycle Stage Sections (1 to {WORKFLOW_STAGES_ORDERED.length})
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Click on <strong>any stage section below</strong> to view requirements, manage stage tasks, or set the active workflow stage.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="size-2 rounded-full bg-emerald-500" /> Completed
          </span>
          <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400 font-semibold">
            <span className="size-2 rounded-full bg-orange-500 animate-pulse" /> Marked for Review
          </span>
          <span className="flex items-center gap-1 text-primary font-medium">
            <span className="size-2 rounded-full bg-primary animate-pulse" /> Workflow Stage
          </span>
        </div>
      </div>

      {/* 12 Stage Selector Bar / Row */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Select Stage Section:</span>
          <span className="text-xs text-primary font-medium">Stage {selectedIdx + 1} of {WORKFLOW_STAGES_ORDERED.length} Selected</span>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {WORKFLOW_STAGES_ORDERED.map((stageKey, idx) => {
            const { isCompleted, isCurrent: isCurrentWorkflow, isLocked, isInReview, isEmdExempt, emdSkipReason } = checkStageState(bid, stageKey)
            const isSelected = selectedStage === stageKey
            const guide = STAGE_GUIDE[stageKey]

            return (
              <button
                key={stageKey}
                type="button"
                disabled={isEmdExempt}
                onClick={() => {
                  if (isEmdExempt) return
                  if (isLocked) {
                    toast.error(`Stage ${idx + 1} is locked. Complete preceding stages first.`)
                  }
                  setSelectedStage(stageKey)
                }}
                className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all relative overflow-hidden group ${
                  isEmdExempt
                    ? 'border-border/40 bg-muted/10 opacity-50 cursor-not-allowed'
                    : isSelected
                    ? isInReview
                      ? 'border-orange-500 ring-2 ring-orange-500/60 bg-gradient-to-br from-amber-500/20 via-orange-500/25 to-rose-500/20 shadow-md'
                      : isCompleted
                      ? 'border-emerald-500 ring-2 ring-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-950/30 shadow-sm'
                      : isCurrentWorkflow
                      ? 'border-primary ring-2 ring-primary/40 bg-primary/10 shadow-sm'
                      : 'border-primary ring-2 ring-primary/20 bg-primary/10 shadow-sm'
                    : isInReview
                    ? 'border-orange-400/90 bg-gradient-to-br from-amber-500/10 via-orange-500/15 to-rose-500/10 dark:from-amber-950/40 dark:via-orange-950/40 dark:to-rose-950/40 dark:border-orange-700 shadow-xs hover:border-orange-500'
                    : isCompleted
                    ? 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 dark:bg-emerald-950/15 dark:border-emerald-900/40'
                    : isCurrentWorkflow
                    ? 'border-indigo-300 bg-indigo-50/40 hover:bg-indigo-50 dark:bg-indigo-950/20'
                    : isLocked
                    ? 'border-amber-200/70 bg-amber-50/20 opacity-80 hover:opacity-100 dark:bg-amber-950/10 dark:border-amber-900/40'
                    : 'border-border/60 bg-card hover:bg-muted/40'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                    isEmdExempt
                      ? 'bg-muted text-muted-foreground/70'
                      : isInReview
                      ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-xs'
                      : isLocked
                      ? 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200'
                      : isCompleted
                      ? 'bg-emerald-500 text-white'
                      : isCurrentWorkflow
                      ? 'bg-primary text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    #{idx + 1}
                  </span>

                  {isEmdExempt ? (
                    <Ban className="size-3.5 text-muted-foreground/60" />
                  ) : isInReview ? (
                    <AlertTriangle className="size-3.5 text-orange-600 dark:text-orange-400 animate-pulse" />
                  ) : isLocked ? (
                    <Lock className="size-3.5 text-amber-500" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                  ) : isCurrentWorkflow ? (
                    <Sparkles className="size-3.5 text-primary animate-pulse" />
                  ) : null}
                </div>

                <span className={`text-xs font-bold line-clamp-1 ${
                  isEmdExempt
                    ? 'text-muted-foreground'
                    : isInReview
                    ? 'text-orange-950 dark:text-orange-200 font-extrabold'
                    : isSelected
                    ? 'text-primary'
                    : isCompleted
                    ? 'text-emerald-950 dark:text-emerald-200'
                    : 'text-foreground'
                }`}>
                  {guide?.title?.split('.')[1]?.trim() || STAGE_LABELS[stageKey] || stageKey}
                </span>

                <span className={`text-[9px] mt-0.5 truncate w-full ${
                  isEmdExempt
                    ? 'text-muted-foreground/70'
                    : isInReview
                    ? 'text-orange-600 dark:text-orange-400 font-extrabold flex items-center gap-0.5'
                    : isCompleted
                    ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                    : isCurrentWorkflow
                    ? 'text-primary font-medium'
                    : 'text-muted-foreground'
                }`}>
                  {isEmdExempt ? (emdSkipReason === 'NOT_APPLICABLE' ? '🚫 No EMD' : '🚫 EMD Exempted') : isInReview ? '⚠️ Marked for Review' : isLocked ? '🔒 Locked' : isCompleted ? '✓ Completed' : isCurrentWorkflow ? '● Active Workflow' : 'Available Stage'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Workspace Panel for Selected Stage */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedStage}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          className="rounded-xl border border-border bg-card p-5 shadow-sm"
        >
          <DynamicStageWorkspace bid={bid} selectedStage={selectedStage} onRefresh={onRefresh} />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ── Stage Action Panel ────────────────────────────────────────────────────────
// Displays per-stage instructions and required tasks per the OneTrack V2 spec.
const STAGE_GUIDE = {
  DISCOVERED: {
    title: '1. Search & Identification',
    GuideIcon: Search,
    color: 'text-slate-600',
    bg: 'bg-slate-50 border-slate-200 dark:bg-slate-900/30 dark:border-slate-700',
    description: 'Identify the tender opportunity from GeM or other portals. Capture all basic information.',
    responsible: 'Bid Executive / Pre-Sales',
    actions: [
      'Log the tender title and GeM Bid Number',
      'Record the estimated value and closing date',
      'Identify the procuring authority and department',
      'Select appropriate bid type (BID / BID to RA)',
    ],
    note: 'Advance to OEM Authorization Request once all basic information is captured (tenders are only added after eligibility has already been confirmed).',
  },
  OEM_AUTHORIZATION_REQUEST: {
    title: '2. OEM Authorization',
    GuideIcon: Building2,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-800',
    description: 'Request Manufacturer Authorization Form (MAF) and related certificates from OEM partners.',
    responsible: 'Manager / OEM Coordinator',
    actions: [
      'Identify required OEM partners for this tender',
      'Send MAF authorization request to OEM',
      'Request MII (Make In India) certificate if applicable',
      'Request "No Malicious Code" certificate from OEM',
      'Upload received OEM documents to checklist',
    ],
    note: 'Advance to Pricing Request once OEM authorization letters are received.',
  },
  PRICING_REQUEST: {
    title: '3. Pricing Request',
    GuideIcon: DollarSign,
    color: 'text-violet-600',
    bg: 'bg-violet-50 border-violet-200 dark:bg-violet-950/20 dark:border-violet-800',
    description: 'Obtain pricing from OEM/vendor and prepare commercial quotation for bid submission.',
    responsible: 'Pre-Sales / Finance',
    actions: [
      'Send pricing inquiry to OEM / distributor',
      'Receive commercial quotation from OEM',
      'Prepare internal cost sheet with margins',
      'Confirm final bid price with management',
      'Record final bid value in tender details',
    ],
    note: 'Advance to Document Checklist Preparation once commercial pricing is finalized.',
  },
  DOCUMENT_CHECKLIST_PREPARATION: {
    title: '4. Document Checklist Preparation',
    GuideIcon: CheckSquare,
    color: 'text-purple-600',
    bg: 'bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800',
    description: 'Compile all required bid documents as per tender specifications. Mark each checklist item.',
    responsible: 'Bid Executive',
    actions: [
      'Review tender document for all required certificates',
      'Prepare and collect experience certificates',
      'Compile company registration and IT return documents',
      'Collect technical compliance/datasheet documents',
      'Mark all Bidder & OEM checklist items as complete',
    ],
    note: 'Advance to EMD Processing once all documents are compiled and checklist is complete.',
  },
  EMD_PROCESSING: {
    title: '5. EMD Processing',
    GuideIcon: Coins,
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800',
    description: 'Process Earnest Money Deposit submission via online portal or Demand Draft.',
    responsible: 'Finance',
    actions: [
      'Verify EMD amount from tender document',
      'Confirm EMD mode (Online / DD / Exempted)',
      'Submit EMD via GeM portal or prepare DD',
      'Save EMD transaction reference/receipt',
      'Update EMD details in the tender workspace',
    ],
    note: 'Advance to Internal Approval once EMD is successfully submitted.',
  },
  INTERNAL_APPROVAL: {
    title: '6. Internal Approval',
    GuideIcon: Eye,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800',
    description: 'Internal review and management sign-off before final bid submission on GeM.',
    responsible: 'Manager / Director',
    actions: [
      'Present bid package to management for review',
      'Verify bid pricing aligns with strategy',
      'Confirm compliance with all tender conditions',
      'Obtain management sign-off/approval',
      'Note approval details in remarks',
    ],
    note: 'Advance to GeM Submission only after internal management approval is received.',
  },
  GEM_SUBMISSION: {
    title: '7. GeM Portal Submission',
    GuideIcon: Send,
    color: 'text-lime-700',
    bg: 'bg-lime-50 border-lime-200 dark:bg-lime-950/20 dark:border-lime-800',
    description: 'Submit the final bid on the GeM portal before the closing date and time.',
    responsible: 'Bid Executive / Manager',
    actions: [
      'Log in to GeM portal with authorised credentials',
      'Submit bid with all required documents',
      'Confirm bid submission acknowledgement received',
      'Note the submission timestamp and reference',
      'Record submission date in the tender details',
    ],
    note: 'After successful submission, advance to Technical Evaluation stage.',
  },
  TECHNICAL_EVALUATION: {
    title: '8. Technical Evaluation',
    GuideIcon: ShieldCheck,
    color: 'text-teal-600',
    bg: 'bg-teal-50 border-teal-200 dark:bg-teal-950/20 dark:border-teal-800',
    description: 'Monitor the technical bid opening and evaluation by the procuring authority.',
    responsible: 'Manager / Bid Executive',
    actions: [
      'Track the technical bid opening date on GeM',
      'Submit clarifications if requested by authority',
      'Respond to technical queries within deadline',
      'Monitor GeM portal for technical qualification result',
      'Update tech compliance status in remarks',
    ],
    note: 'Advance to Financial Evaluation after technical qualification is confirmed.',
  },
  FINANCIAL_EVALUATION: {
    title: '9. Financial Evaluation',
    GuideIcon: Activity,
    color: 'text-cyan-600',
    bg: 'bg-cyan-50 border-cyan-200 dark:bg-cyan-950/20 dark:border-cyan-800',
    description: 'Monitor financial/commercial bid opening and L1 price comparison on GeM.',
    responsible: 'Manager / Finance',
    actions: [
      'Track the financial bid opening date',
      'Record competitor pricing if publicly available',
      'Track L1 price and GlobX price comparison',
      'Update L1 price and quoted price in tender details',
      'Await final award decision from the authority',
    ],
    note: 'Advance to Award & Handover if GlobX wins. Record outcome (WON/LOST) accordingly.',
  },
  AWARD_HANDOVER: {
    title: '10. Award & Delivery Handover',
    GuideIcon: Trophy,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800',
    description: 'Manage purchase order receipt and hand over delivery to the operations team.',
    responsible: 'Manager / Operations',
    actions: [
      'Receive Purchase Order (PO) from GeM',
      'Verify PO value and delivery terms',
      'Coordinate with operations/delivery team',
      'Submit performance security/bank guarantee if required',
      'Record outcome as WON to close the bid workspace',
    ],
    note: 'Record bid outcome as WON to complete the tender lifecycle.',
  },
}

function StageActionPanel({ bid, onSelectStage }) {
  const remarks = bid?.stage_remarks || {}
  const reviews = bid?.stage_reviews || {}

  // Categorize all 12 stages into 3 buckets
  const completedStages = []
  const reviewStages = []
  const pendingStages = []

  WORKFLOW_STAGES_ORDERED.forEach((stageKey, idx) => {
    const { isCompleted, isCurrent, isLocked, isEmdExempt, emdSkipReason } = checkStageState(bid, stageKey)
    const isInReview = reviews[stageKey] === true || (remarks[stageKey] && typeof remarks[stageKey] === 'string' && remarks[stageKey].startsWith('[Re-Verification]'))
    const stageLabel = STAGE_LABELS[stageKey] || stageKey
    const num = idx + 1

    const item = { stageKey, stageLabel, num, isCurrent, isCompleted, isInReview, isLocked, isEmdExempt, emdSkipReason }

    if (isInReview) {
      reviewStages.push(item)
    } else if (isCompleted) {
      completedStages.push(item)
    } else {
      pendingStages.push(item)
    }
  })

  return (
    <div className="space-y-4">
      {/* 3 Grouped Stage Capsule / Pill Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Block 1: Completed Stages */}
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/30 dark:bg-emerald-950/10 dark:border-emerald-900/40 p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60 dark:border-emerald-900/40">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              <h5 className="text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">
                Completed Stages
              </h5>
            </div>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-300/40">
              {completedStages.length}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {completedStages.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No completed stages yet.</p>
            ) : (
              completedStages.map((stg) => (
                <button
                  key={stg.stageKey}
                  type="button"
                  disabled={stg.isEmdExempt}
                  onClick={() => !stg.isEmdExempt && onSelectStage && onSelectStage(stg.stageKey)}
                  className={stg.isEmdExempt
                    ? "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted/50 text-muted-foreground border border-border/60 opacity-60 cursor-not-allowed"
                    : "group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-100/80 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900/80 transition-all shadow-2xs cursor-pointer active:scale-95"}
                >
                  {stg.isEmdExempt ? (
                    <Ban className="size-3 text-muted-foreground/70 shrink-0" />
                  ) : (
                    <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}
                  <span>#{stg.num} {stg.stageLabel}</span>
                  {stg.isEmdExempt && <span className="text-[9px] bg-muted text-muted-foreground/80 px-1.5 py-0.2 rounded-full font-bold">{stg.emdSkipReason === 'NOT_APPLICABLE' ? 'No EMD' : 'Exempted'}</span>}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Block 2: Marked for Review (Red/Orange Mix Theme) */}
        <div className="rounded-xl border border-orange-300/90 bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-rose-500/10 dark:from-amber-950/30 dark:to-orange-950/40 dark:border-orange-800/80 p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-orange-300/60 dark:border-orange-900/40">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-orange-600 dark:text-orange-400" />
              <h5 className="text-xs font-bold text-orange-950 dark:text-orange-300 uppercase tracking-wider">
                Marked for Review
              </h5>
            </div>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-xs">
              {reviewStages.length}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {reviewStages.length === 0 ? (
              <p className="text-xs text-muted-foreground/70 italic">No stages currently marked for review.</p>
            ) : (
              reviewStages.map((stg) => (
                <button
                  key={stg.stageKey}
                  type="button"
                  onClick={() => onSelectStage && onSelectStage(stg.stageKey)}
                  className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-100 via-orange-100 to-rose-100 dark:from-amber-950/90 dark:via-orange-950/90 dark:to-rose-950/90 text-orange-950 dark:text-orange-200 border border-orange-300/80 dark:border-orange-700 hover:scale-102 transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <AlertTriangle className="size-3 text-orange-600 dark:text-orange-400 shrink-0 animate-pulse" />
                  <span>#{stg.num} {stg.stageLabel}</span>
                  <span className="text-[9px] bg-rose-500/20 text-rose-800 dark:text-rose-300 px-1.5 py-0.2 rounded-full font-bold">Review Needed</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Block 3: Pending / Not Completed Stages */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <h5 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Pending Stages
              </h5>
            </div>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
              {pendingStages.length}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {pendingStages.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">All stages completed!</p>
            ) : (
              pendingStages.map((stg) => (
                <button
                  key={stg.stageKey}
                  type="button"
                  onClick={() => onSelectStage && onSelectStage(stg.stageKey)}
                  className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all shadow-2xs cursor-pointer active:scale-95 ${
                    stg.isCurrent
                      ? 'bg-primary/15 text-primary border border-primary/40 font-bold hover:bg-primary/20'
                      : stg.isLocked
                      ? 'bg-muted/30 text-muted-foreground/60 border border-border/50 hover:bg-muted/50'
                      : 'bg-muted/60 text-muted-foreground border border-border hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {stg.isCurrent ? (
                    <span className="relative flex size-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full size-2 bg-primary"></span>
                    </span>
                  ) : stg.isLocked ? (
                    <Lock className="size-3 text-muted-foreground/50 shrink-0" />
                  ) : (
                    <Clock className="size-3 text-muted-foreground shrink-0" />
                  )}
                  <span>#{stg.num} {stg.stageLabel}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Outcome Panel (Read-only display of recorded outcome) ────────────────────
function OutcomePanel({ bid }) {
  if (!bid.bid_outcome) return null

  // Calculate price difference percentage dynamically from quoted_price and l1_price
  let priceDiffPct = null
  const ourP = bid.quoted_price ? Number(bid.quoted_price) : null
  const l1P = bid.l1_price ? Number(bid.l1_price) : null

  if (ourP != null && l1P != null && l1P > 0) {
    priceDiffPct = ((ourP - l1P) / l1P) * 100
  } else if (bid.price_difference_pct != null) {
    priceDiffPct = Number(bid.price_difference_pct)
  }

  return (
    <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/10">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Recorded Outcome</p>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
          bid.bid_outcome === 'WON'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50'
            : bid.bid_outcome === 'LOST'
            ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/50'
            : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800'
        }`}>
          {bid.bid_outcome === 'WON' ? '🏆 Won' : bid.bid_outcome === 'LOST' ? '❌ Lost' : '🛑 Cancelled'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        {bid.bid_outcome !== 'CANCELLED' && (
          <>
            <div>
              <span className="text-muted-foreground text-[10px] uppercase tracking-wider block">Our Quoted Price</span>
              <span className="font-semibold text-foreground">{bid.quoted_price ? fmtMoney(bid.quoted_price) : '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] uppercase tracking-wider block">Result Date</span>
              <span className="font-semibold text-foreground">{bid.result_date ? fmt(bid.result_date) : '—'}</span>
            </div>
            {bid.l1_price && (
              <div>
                <span className="text-muted-foreground text-[10px] uppercase tracking-wider block">L1 Price</span>
                <span className={`font-semibold ${bid.bid_outcome === 'LOST' ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>{fmtMoney(bid.l1_price)}</span>
              </div>
            )}
            {/* LOST-specific comparative analytics */}
            {bid.bid_outcome === 'LOST' && bid.l1_company_name && (
              <div>
                <span className="text-muted-foreground text-[10px] uppercase tracking-wider block">L1 Company</span>
                <span className="font-semibold text-foreground">{bid.l1_company_name}</span>
              </div>
            )}
            {bid.bid_outcome === 'LOST' && priceDiffPct != null && (
              <div className="col-span-2">
                <span className="text-muted-foreground text-[10px] uppercase tracking-wider block">Price Difference vs L1</span>
                <span className={`font-bold font-mono text-sm ${priceDiffPct > 0 ? 'text-red-600 dark:text-red-400' : priceDiffPct < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                  {priceDiffPct > 0 ? '+' : ''}{priceDiffPct.toFixed(2)}%
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    {priceDiffPct > 0
                      ? '(GlobX quoted higher than L1)'
                      : priceDiffPct < 0
                      ? '(GlobX quoted lower than L1)'
                      : '(Same price as L1)'}
                  </span>
                </span>
              </div>
            )}
          </>
        )}

        <div className="col-span-2">
          <span className="text-muted-foreground text-[10px] uppercase tracking-wider block">Formal Outcome Summary</span>
          <pre className="text-foreground mt-1 whitespace-pre-wrap text-xs bg-card p-3 rounded-lg border border-border/80 leading-relaxed font-sans">{bid.outcome_reason || 'No remarks provided.'}</pre>
        </div>
        {bid.bid_outcome !== 'CANCELLED' && bid.competitor_info && bid.competitor_info.length > 0 && (
          <div className="col-span-2 pt-2 border-t border-border/80">
            <span className="text-muted-foreground text-[10px] uppercase tracking-wider block mb-2">Competitors Info</span>
            <div className="overflow-hidden border border-border/80 rounded-lg">
              <table className="min-w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    <th className="p-2">Rank</th>
                    <th className="p-2">Name</th>
                    <th className="p-2 text-right">Quoted Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {bid.competitor_info.map((c, idx) => (
                    <tr key={idx} className="hover:bg-muted/20">
                      <td className="p-2 font-semibold text-primary">{c.rank || '—'}</td>
                      <td className="p-2 truncate font-medium text-foreground">{c.name || '—'}</td>
                      <td className="p-2 text-right text-foreground font-mono">{c.quoted_price ? fmtMoney(c.quoted_price) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Move to Tender Bin Confirmation Dialog ──────────────────────────────────
function ArchiveConfirmDialog({ bid, onClose, onDone }) {
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    try {
      const res = await softDeleteBid(bid.id)
      if (res.ok) {
        toast.success('Tender moved to Tender Bin')
        onDone()
      } else {
        toast.error(res.error?.message ?? 'Failed to move tender to Bin')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-foreground/15 backdrop-blur-[3px]" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative z-10 w-full max-w-md bg-card border border-border rounded-xl shadow-xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 text-rose-600">
          <Trash2 className="size-5 shrink-0" />
          <h3 className="font-heading font-semibold text-foreground">Move to Tender Bin</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Are you sure you want to delete <strong>{bid.title}</strong>?
          <br /><br />
          This tender will be moved to the <strong>Tender Bin</strong>. Items in the Bin are safely retained for <strong>15 days</strong> before automated permanent purging, and Super Admins can restore it at any time.
        </p>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="destructive" size="sm" className="bg-rose-600 hover:bg-rose-700 text-white" onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="size-3.5 animate-spin mr-1" />}Move to Tender Bin
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Outcome Input/Form Dialog ────────────────────────────────────────────────
function OutcomeDialog({ bid, defaultOutcome = 'WON', lockedOutcome = null, onClose, onDone }) {
  const [form, setForm] = useState({
    bid_outcome: lockedOutcome || defaultOutcome,
    final_bid_value: bid.final_bid_value || '',
    l1_price: bid.l1_price || '',
    quoted_price: bid.quoted_price || '',
    outcome_reason: bid.outcome_reason || '',
    result_date: bid.result_date ? new Date(bid.result_date).toISOString().split('T')[0] : '',
    competitor_info: bid.competitor_info || [],
  })
  const [newCompetitor, setNewCompetitor] = useState({ name: '', quoted_price: '', rank: '' })
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (form.bid_outcome === 'CANCELLED' && !form.outcome_reason.trim()) {
      toast.error('Please provide a reason for cancellation')
      return
    }
    setLoading(true)
    try {
      const payload = {
        bid_outcome: form.bid_outcome,
        outcome_reason: form.outcome_reason ? form.outcome_reason.trim() : undefined,
      }
      if (form.bid_outcome !== 'CANCELLED') {
        payload.final_bid_value = form.final_bid_value ? Number(form.final_bid_value) : undefined
        payload.l1_price = form.l1_price ? Number(form.l1_price) : undefined
        payload.quoted_price = form.quoted_price ? Number(form.quoted_price) : undefined
        payload.result_date = form.result_date ? new Date(form.result_date).toISOString() : undefined
        payload.competitor_info = form.competitor_info.map(c => ({
          name: c.name,
          quoted_price: c.quoted_price ? Number(c.quoted_price) : 0,
          rank: c.rank
        }))
      }
      const res = await recordBidOutcome(bid.id, payload)
      if (res.ok) {
        // For cancellations, also persist the reason in the bid's remarks field without touching bid_status or workflow_stage
        if (form.bid_outcome === 'CANCELLED' && form.outcome_reason?.trim()) {
          try {
            await updateBid(bid.id, {
              remarks: `[CANCELLED] ${form.outcome_reason.trim()}`,
            })
          } catch { /* non-fatal: outcome recorded, remarks update best-effort */ }
        }
        toast.success('Bid outcome recorded successfully')
        onDone()
      } else {
        toast.error(res.error?.message ?? 'Failed to record outcome')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  const addCompetitor = () => {
    if (!newCompetitor.name.trim()) {
      toast.error('Competitor name is required')
      return
    }
    setForm(f => ({
      ...f,
      competitor_info: [
        ...f.competitor_info,
        {
          name: newCompetitor.name.trim(),
          quoted_price: newCompetitor.quoted_price ? Number(newCompetitor.quoted_price) : 0,
          rank: newCompetitor.rank.trim() || undefined
        }
      ]
    }))
    setNewCompetitor({ name: '', quoted_price: '', rank: '' })
  }

  const removeCompetitor = (index) => {
    setForm(f => ({
      ...f,
      competitor_info: f.competitor_info.filter((_, i) => i !== index)
    }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-foreground/15 backdrop-blur-[3px]" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative z-10 w-full max-w-md bg-card border border-border rounded-xl shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-semibold text-foreground">
            {lockedOutcome === 'CANCELLED' ? 'Cancel Tender' : 'Record Outcome'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {!lockedOutcome && (
            <div className="space-y-1.5">
              <Label className="text-xs">Outcome Status</Label>
              <div className="flex rounded-lg bg-muted p-1 gap-1">
                {['WON', 'LOST', 'CANCELLED'].map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, bid_outcome: o }))}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      form.bid_outcome === o
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {o === 'WON' ? '🏆 Won' : o === 'LOST' ? '❌ Lost' : '🛑 Cancelled'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {form.bid_outcome === 'CANCELLED' ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Reason for Cancellation *</Label>
              <Textarea
                required
                value={form.outcome_reason}
                onChange={e => setForm(f => ({ ...f, outcome_reason: e.target.value }))}
                placeholder="Describe the reason for cancellation..."
                className="text-sm min-h-[100px]"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Final Value (₹)</Label>
                  <Input
                    type="number"
                    value={form.final_bid_value}
                    onChange={e => setForm(f => ({ ...f, final_bid_value: e.target.value }))}
                    placeholder="Final value"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Result Date</Label>
                  <Input
                    type="date"
                    value={form.result_date}
                    onChange={e => setForm(f => ({ ...f, result_date: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Quoted Price (₹)</Label>
                  <Input
                    type="number"
                    value={form.quoted_price}
                    onChange={e => setForm(f => ({ ...f, quoted_price: e.target.value }))}
                    placeholder="Quoted price"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">L1 Price (₹)</Label>
                  <Input
                    type="number"
                    value={form.l1_price}
                    onChange={e => setForm(f => ({ ...f, l1_price: e.target.value }))}
                    placeholder="L1 price"
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Reason / Remarks (optional)</Label>
                <Textarea
                  value={form.outcome_reason}
                  onChange={e => setForm(f => ({ ...f, outcome_reason: e.target.value }))}
                  placeholder="Outcome details..."
                  className="text-sm min-h-[60px]"
                />
              </div>

              {/* Competitor Info Section */}
              <div className="space-y-2 border-t border-border pt-3">
                <Label className="text-xs font-semibold text-foreground">Competitor Information</Label>
                
                {form.competitor_info.length > 0 && (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {form.competitor_info.map((comp, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-lg border border-border bg-muted/20">
                        <div className="flex items-center gap-2 truncate">
                          {comp.rank && <span className="font-semibold text-primary">{comp.rank}</span>}
                          <span className="truncate font-medium">{comp.name}</span>
                          {comp.quoted_price > 0 && <span className="text-muted-foreground font-mono">(₹{comp.quoted_price.toLocaleString('en-IN', { maximumFractionDigits: 2 })})</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCompetitor(idx)}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-12 gap-1.5 items-end">
                  <div className="col-span-5 space-y-1">
                    <span className="text-[10px] text-muted-foreground block">Competitor Name</span>
                    <Input
                      type="text"
                      placeholder="ABC Corp"
                      value={newCompetitor.name}
                      onChange={e => setNewCompetitor(nc => ({ ...nc, name: e.target.value }))}
                      className="h-7 text-xs px-2"
                    />
                  </div>
                  <div className="col-span-4 space-y-1">
                    <span className="text-[10px] text-muted-foreground block">Quoted Price (₹)</span>
                    <Input
                      type="number"
                      placeholder="Price"
                      value={newCompetitor.quoted_price}
                      onChange={e => setNewCompetitor(nc => ({ ...nc, quoted_price: e.target.value }))}
                      className="h-7 text-xs px-2"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <span className="text-[10px] text-muted-foreground block">Rank</span>
                    <Input
                      type="text"
                      placeholder="L2"
                      value={newCompetitor.rank}
                      onChange={e => setNewCompetitor(nc => ({ ...nc, rank: e.target.value }))}
                      className="h-7 text-xs px-1.5"
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addCompetitor}
                      className="h-7 w-full p-0 flex items-center justify-center border-primary/20 hover:border-primary/50 text-primary"
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="flex-1" disabled={loading}>
              {loading && <Loader2 className="size-3.5 animate-spin mr-1" />}
              {form.bid_outcome === 'CANCELLED' ? 'Confirm Cancellation' : 'Save Outcome'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── Main Detail Page ─────────────────────────────────────────────────────────
export function TenderDetailPage({ bidId: propBidId, onBack: propOnBack }) {
  const { bidId: routeBidId } = useParams()
  const navigate = useNavigate()
  const bidId = propBidId || routeBidId
  const onBack = propOnBack || (() => navigate('/dashboard/tenders'))

  const { hasPermission } = usePermissions()
  const [bid, setBid]               = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [activeTab, setActiveTab]   = useState('overview')
  const [showTransition, setShowTransition] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showOutcome, setShowOutcome] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)

  const loadBid = useCallback(async (showLoader = false) => {
    setLoading(prev => (prev || showLoader ? true : false))
    setError(null)
    try {
      const res = await getBid(bidId)
      if (res.ok) setBid(res.data)
      else setError(res.error?.message ?? 'Failed to load tender')
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }, [bidId])

  useEffect(() => {
    if (bidId) loadBid(true)
  }, [bidId, loadBid])

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
      <Loader2 className="size-5 animate-spin"/><span className="text-sm">Loading tender…</span>
    </div>
  )
  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
      <AlertCircle className="size-8 text-destructive/60"/><p className="text-sm">{error}</p>
      <Button variant="outline" size="sm" onClick={onBack}>Go Back</Button>
    </div>
  )
  if (!bid) return null

  const TABS = [
    { id:'overview', label:'Overview', icon:FileText },
    { id:'stages',   label:'Stage Lifecycle (12)', icon:Layers },
    { id:'checklist',label:'Checklist',icon:CheckSquare },
    { id:'history',  label:'Stage History', icon:History },
    { id:'members',  label:'Members',  icon:Users },
  ]

  const canTransition = hasPermission('bid.edit') && (STAGE_TRANSITIONS[bid.workflow_stage]?.length ?? 0) > 0

  return (
    <div className="space-y-5">
      {/* Breadcrumb + back */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="size-4"/>Tenders
          </button>
          <ChevronRight className="size-3.5 text-muted-foreground"/>
          <span className="text-sm text-foreground font-medium truncate max-w-[300px]">{bid.title}</span>
        </div>
      </div>

      {/* Archive / Bin Warning Banner */}
      {bid.deleted_at ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 flex items-center justify-between gap-4 text-rose-900 shadow-sm dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-300">
          <div className="flex items-start gap-3">
            <Trash2 className="size-5 shrink-0 text-rose-600 dark:text-rose-500 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-sm">Tender in Bin (Soft-Deleted)</p>
              <p className="text-xs text-rose-700 dark:text-rose-400">
                Deleted on {new Date(bid.deleted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}. 
                Will be permanently purged after 15 days of retention.
              </p>
            </div>
          </div>
          {hasPermission('bid.delete') && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="gap-1 border-rose-300 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:text-rose-300"
                onClick={async () => {
                  if (window.confirm(`Restore "${bid.title}" to active tenders?`)) {
                    const res = await restoreBid(bid.id)
                    if (res.ok) {
                      toast.success('Tender restored successfully!')
                      loadBid()
                    } else {
                      toast.error(res.error?.message ?? 'Failed to restore tender')
                    }
                  }
                }}
              >
                <RotateCcw className="size-3.5" />
                Restore
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="gap-1 bg-rose-600 hover:bg-rose-700 text-white"
                onClick={async () => {
                  if (window.confirm(`PERMANENTLY PURGE "${bid.title}"? This action CANNOT be undone.`)) {
                    const res = await permanentDeleteBid(bid.id)
                    if (res.ok) {
                      toast.success('Tender permanently purged')
                      onBack()
                    } else {
                      toast.error(res.error?.message ?? 'Failed to purge tender')
                    }
                  }
                }}
              >
                <Trash2 className="size-3.5" />
                Purge
              </Button>
            </div>
          )}
        </div>
      ) : bid.bid_status === 'ARCHIVED' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 flex items-start gap-3 text-amber-900 shadow-sm dark:bg-amber-950/15 dark:border-amber-900/50 dark:text-amber-300">
          <AlertCircle className="size-5 shrink-0 text-amber-600 dark:text-amber-500 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-sm">Tender Archived</p>
            <p className="text-xs text-amber-700 dark:text-amber-400">This tender workspace is archived. No further edits, stage transitions, tasks, or member updates can be performed.</p>
          </div>
        </div>
      )}

      {/* Header Card */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-heading text-xl font-semibold text-foreground leading-snug">{bid.title}</h1>
              {bid.deleted_at ? (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                  IN BIN
                </span>
              ) : bid.bid_status === 'ACTIVE' ? (
                <span className="relative flex size-2.5 shrink-0" title="Active">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500"></span>
                </span>
              ) : bid.bid_status === 'ARCHIVED' ? (
                <span className="size-2.5 rounded-full bg-slate-400 shrink-0" title="Archived" />
              ) : bid.bid_status === 'WON' ? (
                <span className="size-2.5 rounded-full bg-emerald-500 shrink-0" title="Won" />
              ) : (
                <span className="size-2.5 rounded-full bg-destructive shrink-0" title={bid.bid_status} />
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {bid.gem_bid_no && <span className="text-sm text-primary font-mono font-medium">{bid.gem_bid_no}</span>}
              {bid.bid_no && <span className="text-xs text-muted-foreground font-mono">{bid.bid_no}</span>}
              {bid.portal_source && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800">{bid.portal_source}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!bid.deleted_at && hasPermission('bid.edit') && !['ARCHIVED', 'CANCELLED', 'WON', 'LOST'].includes(bid.bid_status) && (
              <Button size="sm" variant="outline" className="gap-1.5 border-primary/20 hover:border-primary/50 text-foreground" onClick={()=>setShowEdit(true)}>
                <Edit2 className="size-3.5 text-primary"/>Edit Tender
              </Button>
            )}

            {!bid.deleted_at && hasPermission('bid.edit') && !['CANCELLED', 'WON', 'LOST'].includes(bid.bid_status) && !['CANCELLED', 'WON', 'LOST'].includes(bid.workflow_stage) && (
              <Button size="sm" variant="outline" className="gap-1.5 border-red-200 hover:border-red-500 text-red-600 hover:bg-red-50/50 dark:border-red-900/50 dark:hover:bg-red-950/20" onClick={()=>setShowCancel(true)}>
                <XCircle className="size-3.5"/>Cancel Tender
              </Button>
            )}
            {!bid.deleted_at && hasPermission('bid.edit') && (bid.bid_status === 'CANCELLED' || bid.workflow_stage === 'CANCELLED' || bid.bid_outcome === 'CANCELLED') && (
              <Button size="sm" variant="outline" className="gap-1.5 border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300" onClick={async ()=>{
                try {
                  const res = await transitionBidStage(bid.id, 'DISCOVERED', 'Revoked tender cancellation')
                  if (res.ok) {
                    toast.success('Tender cancellation revoked successfully')
                    loadBid()
                  } else {
                    toast.error(res.error?.message || 'Failed to revoke cancellation')
                  }
                } catch {
                  toast.error('Network error')
                }
              }}>
                <RotateCcw className="size-3.5"/>Revoke Cancellation
              </Button>
            )}
            {!bid.deleted_at && ['SUBMITTED', 'RA_ACTIVE', 'AWAITING_RESULT'].includes(bid.workflow_stage) && bid.bid_status === 'ACTIVE' && hasPermission('bid.edit') && (
              <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={()=>setShowOutcome(true)}>
                <Target className="size-3.5"/>Outcome
              </Button>
            )}
            {!bid.deleted_at && hasPermission('bid.delete') && !['ARCHIVED', 'CANCELLED', 'WON', 'LOST'].includes(bid.bid_status) && (
              <Button size="sm" variant="outline" className="border-destructive/20 hover:border-destructive text-destructive hover:bg-destructive/5 p-2 h-8" title="Move to Tender Bin" onClick={()=>setShowArchiveConfirm(true)}>
                <Trash2 className="size-3.5"/>
              </Button>
            )}
          </div>
        </div>

        {/* Visual 12-Stage Stepper */}
        <div className="pt-2 border-t border-border/40">
          <WorkflowStepper currentStage={bid.workflow_stage} stageCompletions={bid.stage_completions} />
        </div>

        {/* Quick meta */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {[
            { label:'Estimated Value', value: fmtMoney(bid.estimated_value), icon:DollarSign },
            { label:'EMD Amount',      value: bid.emd_not_applicable ? 'Not Applicable' : bid.emd_exempted ? 'Exempted' : fmtMoney(bid.emd_amount), icon:Target },
            { label:'Ending Date',      value: getBidEndDate(bid), icon:Calendar },
            { label:'Owner',           value: bid.bid_owner?.full_name ?? 'Unassigned', icon:Users },
          ].map(m=>(
            <div key={m.label} className="rounded-lg bg-muted/40 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <m.icon className="size-3 text-muted-foreground"/>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{m.label}</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{m.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(tab=>(
          <button key={tab.id}
            onClick={()=> !tab.disabled && setActiveTab(tab.id)}
            disabled={tab.disabled}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
              ${tab.disabled ? 'border-transparent text-muted-foreground/40 cursor-not-allowed' :
                activeTab===tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <tab.icon className="size-3.5"/>{tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:0.15}}>
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <StageActionPanel bid={bid} onSelectStage={(stageKey) => setActiveTab('stages')} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border p-4 space-y-3 bg-card shadow-sm">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="size-3.5 text-primary" /> Organization & Portal Metadata
                  </p>
                  <div className="space-y-2 text-sm">
                    {[
                      ['Owner', bid.bid_owner?.full_name || 'Unassigned'],
                      ['Organization Name', bid.organization_name || 'Not Specified'],
                      ['Department', bid.department_name || 'Not Specified'],
                      ['Category / Scope', bid.category || 'Not Specified'],
                      ['Portal Source', bid.portal_source || 'GeM'],
                      ['Bid Scope Type', bid.bid_type || 'CUSTOM_BID'],
                    ].map(([l,v])=>(
                      <div key={l} className="flex justify-between gap-4 border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
                        <span className="text-muted-foreground shrink-0">{l}</span>
                        <span className="font-medium text-foreground text-right">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-border p-4 space-y-3 bg-card shadow-sm">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-emerald-600" /> Compliance & Critical Dates
                  </p>
                  <div className="space-y-2 text-sm">
                    {[
                      ['EMD Processing Type', bid.emd_not_applicable ? 'NOT APPLICABLE' : bid.emd_exempted ? 'EXEMPTED' : (bid.emd_type || 'ONLINE')],
                      ...(bid.emd_exempted ? [[
                        'EMD Exemption Basis',
                        bid.emd_exemption_type === 'OTHER'
                          ? `Other — ${bid.emd_exemption_reason || 'N/A'}`
                          : bid.emd_exemption_type === 'MSME'
                            ? 'MSME'
                            : bid.emd_exemption_type === 'STARTUP'
                              ? 'Startup'
                              : '—',
                      ]] : []),
                      ['Start Date', getBidStartDate(bid)],
                      ['End Date', getBidEndDate(bid)],
                    ].map(([l,v])=>(
                      <div key={l} className="flex justify-between gap-4 border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
                        <span className="text-muted-foreground shrink-0">{l}</span>
                        <span className="font-medium text-foreground text-right">{v}</span>
                      </div>
                    ))}
                    {!bid.emd_exempted && bid.emd_type === 'ONLINE' && (
                      <>
                        {[
                          ['Bank Name', bid.emd_bank_name],
                          ['Account Number', bid.emd_account_number],
                          ['IFSC Code', bid.emd_ifsc_code],
                          ['Branch', bid.emd_branch],
                        ].filter(([, v]) => v).map(([l, v]) => (
                          <div key={l} className="flex justify-between gap-4 border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
                            <span className="text-muted-foreground shrink-0">{l}</span>
                            <span className="font-medium text-foreground text-right">{v}</span>
                          </div>
                        ))}
                      </>
                    )}
                    {!bid.emd_exempted && bid.emd_type === 'DD' && (
                      <>
                        {[
                          ['Beneficiary', bid.emd_beneficiary],
                          ['Payable At', bid.emd_payable_at],
                        ].filter(([, v]) => v).map(([l, v]) => (
                          <div key={l} className="flex justify-between gap-4 border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
                            <span className="text-muted-foreground shrink-0">{l}</span>
                            <span className="font-medium text-foreground text-right">{v}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>
              {bid.remarks && (
                <div className="rounded-lg border border-border p-4 bg-card shadow-sm">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Remarks & Detailed Notes</p>
                  <p className="text-sm text-foreground leading-relaxed">{bid.remarks}</p>
                </div>
              )}
              <OutcomePanel bid={bid} />
            </div>
          )}
          {activeTab === 'stages' && <StageSectionsTab bid={bid} onRefresh={loadBid} onAdvance={() => setShowTransition(true)} />}
          {activeTab === 'checklist' && <ChecklistTab bid={bid} onRefresh={loadBid}/>}
          {activeTab === 'history' && <StageHistoryTab bidId={bid.id} bid={bid} />}
          {activeTab === 'members' && <MembersTab bid={bid} onRefresh={loadBid}/>}
        </motion.div>
      </AnimatePresence>

      {/* Transition Dialog */}
      <AnimatePresence>
        {showTransition && (
          <TransitionDialog bid={bid} onClose={()=>setShowTransition(false)} onDone={()=>{setShowTransition(false);loadBid()}}/>
        )}
      </AnimatePresence>

      {/* Edit Tender Dialog */}
      <EditTenderDialog open={showEdit} onClose={()=>setShowEdit(false)} bid={bid} onUpdated={loadBid} />

      {/* Outcome Dialog */}
      <AnimatePresence>
        {showOutcome && (
          <OutcomeDialog bid={bid} onClose={()=>setShowOutcome(false)} onDone={()=>{setShowOutcome(false);loadBid()}} />
        )}
      </AnimatePresence>

      {/* Cancel Dialog */}
      <AnimatePresence>
        {showCancel && (
          <OutcomeDialog bid={bid} lockedOutcome="CANCELLED" onClose={()=>setShowCancel(false)} onDone={()=>{setShowCancel(false);loadBid()}} />
        )}
      </AnimatePresence>

      {/* Archive Confirmation Dialog */}
      <AnimatePresence>
        {showArchiveConfirm && (
          <ArchiveConfirmDialog bid={bid} onClose={()=>setShowArchiveConfirm(false)} onDone={()=>{setShowArchiveConfirm(false);loadBid()}} />
        )}
      </AnimatePresence>
    </div>
  )
}
