import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Loader2, AlertCircle, Clock, Building2,
  DollarSign, Users, Plus, ChevronRight, CheckCircle2, CheckSquare,
  XCircle, Edit2, Save, X, MoreHorizontal, Calendar,
  FileText, Activity, History, UserPlus, Target, ChevronDown,
  Trash2, Trophy, Search, ShieldCheck, Share2, Coins, Eye,
  Send, Upload, Hourglass, Ban, ArrowRight
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
  STAGE_LABELS, STAGE_COLORS, STATUS_COLORS, STAGE_TRANSITIONS,
  WORKFLOW_STAGES_ORDERED,
} from '../../services/bids'
import { usePermissions } from '../../hooks/usePermissions'
import { TaskDashboard } from '../tasks/TaskDashboard'
import { ChecklistTab } from './ChecklistTab'
import { listUsers } from '../../services/users'
import { EditTenderDialog } from './EditTenderDialog'

function fmt(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtMoney(v) {
  if (!v && v !== 0) return '—'
  if (v >= 10000000) return `₹${(v/10000000).toFixed(1)}Cr`
  if (v >= 100000) return `₹${(v/100000).toFixed(1)}L`
  return `₹${v.toLocaleString('en-IN')}`
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
function WorkflowStepper({ currentStage }) {
  const idx = WORKFLOW_STAGES_ORDERED.indexOf(currentStage)
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex items-center gap-0 min-w-max">
        {WORKFLOW_STAGES_ORDERED.map((stage, i) => {
          const done   = i < idx
          const active = i === idx
          return (
            <React.Fragment key={stage}>
              <div className="flex flex-col items-center gap-1">
                <div className={`size-6 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all
                  ${done   ? 'bg-primary border-primary text-primary-foreground'
                  : active ? 'bg-primary/10 border-primary text-primary'
                           : 'bg-background border-border text-muted-foreground'}`}>
                  {done ? <CheckCircle2 className="size-3.5" /> : i + 1}
                </div>
                <span className={`text-[10px] font-medium max-w-[60px] text-center leading-tight
                  ${active ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {STAGE_LABELS[stage]}
                </span>
              </div>
              {i < WORKFLOW_STAGES_ORDERED.length - 1 && (
                <div className={`h-0.5 w-8 mb-4 mx-0.5 transition-colors ${i < idx ? 'bg-primary' : 'bg-border'}`} />
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

function formatDuration(ms) {
  if (ms === null || ms < 0) return '—'
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    const remainingHours = hours % 24
    return `${days}d ${remainingHours}h`
  }
  if (hours > 0) {
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m`
  }
  return `${seconds}s`
}

function StageDetailCard({ entry, isLatest }) {
  if (!entry) return null

  const IconComponent = STAGE_ICONS[entry.to_stage] || Clock
  const stageColorClass = STAGE_COLORS[entry.to_stage] ?? 'bg-gray-100 text-gray-700 border-gray-200'

  const displayName = entry.transitioned_by?.full_name || entry.transitioned_by?.username || 'System'

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-4 space-y-4 transition-all duration-300">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
            {isLatest ? 'Current Stage' : 'Stage Details'}
          </span>
          <h4 className="font-heading font-semibold text-foreground text-sm">
            {STAGE_LABELS[entry.to_stage] ?? entry.to_stage}
          </h4>
        </div>
        <div className={`p-2 rounded-lg border ${stageColorClass}`}>
          <IconComponent className="size-4 shrink-0" />
        </div>
      </div>

      {/* Transition Path */}
      <div className="space-y-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Transition Path</span>
        <div className="flex items-center gap-1.5 flex-wrap bg-muted/30 p-2 rounded-md border border-border/40 text-xs">
          {entry.from_stage ? (
            <>
              <StageBadge stage={entry.from_stage} />
              <ArrowRight className="size-3 text-muted-foreground" />
            </>
          ) : (
            <span className="text-xs text-muted-foreground font-medium italic">Start</span>
          )}
          <StageBadge stage={entry.to_stage} />
        </div>
      </div>

      {/* Time Audit */}
      <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
        <div>
          <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider block">Entered Stage</span>
          <span className="font-medium text-foreground">{fmt(entry.created_at)}</span>
          <span className="text-[9px] text-muted-foreground block font-mono mt-0.5">
            {new Date(entry.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider block">
            {isLatest ? 'Time Active' : 'Time in Stage'}
          </span>
          <span className="font-semibold text-primary">
            {entry.durationMs !== null ? formatDuration(entry.durationMs) : '—'}
          </span>
        </div>
      </div>

      {/* Transition Actor */}
      <div className="pt-3 border-t border-border/60 space-y-1">
        <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider block">Actioned By</span>
        <div className="flex items-center gap-2 bg-muted/20 p-2 rounded-md border border-border/40">
          <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 text-xs">
            <p className="font-semibold text-foreground truncate">{displayName}</p>
            <p className="text-[9px] text-muted-foreground font-mono truncate">ID: {entry.transitioned_by?.id ?? 'system-auto'}</p>
          </div>
        </div>
      </div>

      {/* Reason */}
      <div className="pt-3 border-t border-border/60 space-y-1">
        <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider block">Transition Reason</span>
        <div className="bg-muted/10 p-2.5 rounded-md border border-border/40 min-h-[50px] flex items-start gap-1.5">
          <FileText className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-foreground italic leading-normal whitespace-pre-wrap">
            {entry.transition_reason || 'No comments provided.'}
          </p>
        </div>
      </div>
    </div>
  )
}

function StageHistoryTab({ bidId }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [hoveredIndex, setHoveredIndex] = useState(null)

  useEffect(() => {
    getBidStageHistory(bidId).then(r => {
      let backendData = []
      if (r.ok) {
        backendData = r.data ?? []
      }

      // Read local checklist events
      const localHistoryKey = `onetrack_checklist_history_${bidId}`
      const localEvents = JSON.parse(localStorage.getItem(localHistoryKey) || '[]')

      // Merge and sort chronologically (oldest to newest)
      const combined = [...backendData, ...localEvents].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      )

      setHistory(combined)
      if (combined.length > 0) {
        setSelectedIndex(combined.length - 1)
      }
      setLoading(false)
    })
  }, [bidId])

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground"/></div>
  if (history.length === 0) return <p className="text-sm text-muted-foreground py-4 text-center">No stage history yet.</p>

  // Compute duration spent in each stage
  const historyWithDuration = history.map((h, i) => {
    const currentEntryTime = new Date(h.created_at).getTime()
    let durationMs = null

    if (i < history.length - 1) {
      const nextEntryTime = new Date(history[i + 1].created_at).getTime()
      durationMs = nextEntryTime - currentEntryTime
    } else {
      durationMs = Date.now() - currentEntryTime
    }

    return {
      ...h,
      durationMs,
    }
  })

  const activeIndex = hoveredIndex !== null ? hoveredIndex : (selectedIndex !== null ? selectedIndex : history.length - 1)
  const activeEntry = historyWithDuration[activeIndex]
  const isLatestActive = activeIndex === history.length - 1

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
      {/* Left Column: Interactive Timeline Tree */}
      <div className="md:col-span-3 space-y-4 relative pl-4">
        {/* Timeline Connecting Line */}
        <div className="absolute left-[29px] top-4 bottom-4 w-0.5 bg-border/60" />

        <div className="space-y-4">
          {historyWithDuration.map((h, i) => {
            const isSelected = i === activeIndex
            const isLatest = i === history.length - 1
            const IconComponent = STAGE_ICONS[h.to_stage] || Clock
            const stageColorClass = STAGE_COLORS[h.to_stage] ?? 'bg-gray-100 text-gray-700'

            return (
              <motion.div
                key={h.id ?? i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => setSelectedIndex(i)}
                className="relative cursor-pointer pl-8 group"
              >
                {/* Node Bullet Icon */}
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

                {/* Node Card */}
                <div
                  className={`p-3 rounded-lg border transition-all duration-300
                    ${isSelected
                      ? 'bg-primary/5 border-primary/30 shadow-sm'
                      : 'bg-card border-border/50 group-hover:border-border group-hover:bg-muted/10'
                    }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {h.from_stage && (
                        <>
                          <StageBadge stage={h.from_stage} />
                          <ArrowRight className="size-3 text-muted-foreground" />
                        </>
                      )}
                      <StageBadge stage={h.to_stage} />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {fmt(h.created_at)}
                    </span>
                  </div>

                  {h.transition_reason && (
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1 italic">
                      "{h.transition_reason}"
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground border-t border-border/30 pt-1.5">
                    <span>
                      By {h.transitioned_by?.full_name && h.transitioned_by?.full_name !== 'Anonymous' ? h.transitioned_by.full_name : (h.transitioned_by?.username || 'System')}
                    </span>
                    {h.durationMs !== null && (
                      <span className="flex items-center gap-1 font-medium text-primary bg-primary/5 px-1.5 py-0.5 rounded">
                        <Clock className="size-2.5" />
                        {formatDuration(h.durationMs)}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Right Column: Dynamic Info Card (Sticky) */}
      <div className="md:col-span-2 md:sticky md:top-4">
        <StageDetailCard entry={activeEntry} isLatest={isLatestActive} />
      </div>
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

// ── Outcome Panel (Read-only display of recorded outcome) ────────────────────
function OutcomePanel({ bid }) {
  if (!bid.bid_outcome) return null

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
              <span className="text-muted-foreground text-[10px] uppercase tracking-wider block">Final Value</span>
              <span className="font-semibold text-foreground">{fmtMoney(bid.final_bid_value)}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] uppercase tracking-wider block">Result Date</span>
              <span className="font-semibold text-foreground">{fmt(bid.result_date)}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] uppercase tracking-wider block">Quoted Price</span>
              <span className="font-semibold text-foreground">{fmtMoney(bid.quoted_price)}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] uppercase tracking-wider block">L1 Price</span>
              <span className="font-semibold text-foreground">{fmtMoney(bid.l1_price)}</span>
            </div>
          </>
        )}
        <div className="col-span-2">
          <span className="text-muted-foreground text-[10px] uppercase tracking-wider block">Reason / Remarks</span>
          <p className="text-foreground mt-1 whitespace-pre-wrap text-xs bg-card p-3 rounded-lg border border-border/80 leading-relaxed">{bid.outcome_reason || 'No remarks provided.'}</p>
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

// ── Archive Confirmation Dialog ──────────────────────────────────────────────
function ArchiveConfirmDialog({ bid, onClose, onDone }) {
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    try {
      const res = await archiveBid(bid.id)
      if (res.ok) {
        toast.success('Tender archived successfully')
        onDone()
      } else {
        toast.error(res.error?.message ?? 'Failed to archive tender')
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
        <div className="flex items-center gap-2.5 text-destructive">
          <AlertCircle className="size-5 shrink-0" />
          <h3 className="font-heading font-semibold text-foreground">Archive Tender</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Are you sure you want to archive <strong>{bid.title}</strong>?
          <br /><br />
          This will set its status to <strong>ARCHIVED</strong>. Once archived, all operations (edits, stage transitions, tasks, and members) will be permanently read-only.
        </p>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="size-3.5 animate-spin mr-1" />}Archive Tender
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
        // For cancellations, also persist the reason in the bid's remarks field
        if (form.bid_outcome === 'CANCELLED' && form.outcome_reason?.trim()) {
          try {
            await updateBid(bid.id, {
              title: bid.title, bid_no: bid.bid_no, gem_bid_no: bid.gem_bid_no,
              organization_name: bid.organization_name, department_name: bid.department_name,
              portal_source: bid.portal_source, bid_type: bid.bid_type,
              category: bid.category,
              estimated_value: bid.estimated_value !== null ? Number(bid.estimated_value) : null,
              emd_amount: bid.emd_amount !== null ? Number(bid.emd_amount) : null,
              emd_type: bid.emd_type, emd_exempted: !!bid.emd_exempted,
              oem_required: !!bid.oem_required, has_tech_eval: !!bid.has_tech_eval,
              opening_date: bid.opening_date ? new Date(bid.opening_date).toISOString() : null,
              closing_date: bid.closing_date ? new Date(bid.closing_date).toISOString() : null,
              bid_owner_id: bid.bid_owner?.id || bid.bid_owner_id,
              bid_status: bid.bid_status, workflow_stage: bid.workflow_stage,
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
                          {comp.quoted_price > 0 && <span className="text-muted-foreground font-mono">(₹{comp.quoted_price.toLocaleString('en-IN')})</span>}
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

  const loadBid = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await getBid(bidId)
      if (res.ok) setBid(res.data)
      else setError(res.error?.message ?? 'Failed to load tender')
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }, [bidId])

  useEffect(() => { loadBid() }, [loadBid])

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

      {/* Archive Warning Banner */}
      {bid.bid_status === 'ARCHIVED' && (
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
              {bid.bid_status === 'ACTIVE' ? (
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
            {hasPermission('bid.edit') && !['ARCHIVED', 'CANCELLED', 'WON', 'LOST'].includes(bid.bid_status) && (
              <Button size="sm" variant="outline" className="gap-1.5 border-primary/20 hover:border-primary/50 text-foreground" onClick={()=>setShowEdit(true)}>
                <Edit2 className="size-3.5 text-primary"/>Edit Tender
              </Button>
            )}
            {canTransition && !['ARCHIVED', 'CANCELLED', 'WON', 'LOST'].includes(bid.bid_status) && (
              <Button size="sm" className="gap-1.5" onClick={()=>setShowTransition(true)}>
                <ChevronRight className="size-3.5"/>Advance Stage
              </Button>
            )}
            {hasPermission('bid.edit') && bid.bid_status === 'ACTIVE' && (
              <Button size="sm" variant="outline" className="gap-1.5 border-red-200 hover:border-red-500 text-red-600 hover:bg-red-50/50 dark:border-red-900/50 dark:hover:bg-red-950/20" onClick={()=>setShowCancel(true)}>
                <XCircle className="size-3.5"/>Cancel Tender
              </Button>
            )}
            {['SUBMITTED', 'RA_ACTIVE', 'AWAITING_RESULT'].includes(bid.workflow_stage) && bid.bid_status === 'ACTIVE' && hasPermission('bid.edit') && (
              <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={()=>setShowOutcome(true)}>
                <Target className="size-3.5"/>Outcome
              </Button>
            )}
            {hasPermission('bid.delete') && !['ARCHIVED', 'CANCELLED', 'WON', 'LOST'].includes(bid.bid_status) && (
              <Button size="sm" variant="outline" className="border-destructive/20 hover:border-destructive text-destructive hover:bg-destructive/5 p-2 h-8" title="Delete Tender" onClick={()=>setShowArchiveConfirm(true)}>
                <Trash2 className="size-3.5"/>
              </Button>
            )}
          </div>
        </div>

        {/* Stepper (Hidden for now)
        <WorkflowStepper currentStage={bid.workflow_stage}/>
        */}

        {/* Quick meta */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {[
            { label:'Estimated Value', value: fmtMoney(bid.estimated_value), icon:DollarSign },
            { label:'EMD Amount',      value: bid.emd_exempted ? 'Exempted' : fmtMoney(bid.emd_amount), icon:Target },
            { label:'Closing Date',    value: fmt(bid.closing_date), icon:Calendar },
            { label:'Owner',           value: bid.bid_owner?.full_name ?? '—', icon:Users },
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
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Organization</p>
                  <div className="space-y-1.5 text-sm">
                    {[['Organization',bid.organization_name],['Department',bid.department_name],['Category',bid.category],['Bid Type',bid.bid_type]].map(([l,v])=>(
                      <div key={l} className="flex justify-between gap-4">
                        <span className="text-muted-foreground shrink-0">{l}</span>
                        <span className="font-medium text-foreground text-right">{v||'—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Compliance</p>
                  <div className="space-y-1.5 text-sm">
                    {[
                      ['OEM Required', bid.oem_required ? '✅ Yes' : '❌ No'],
                      ['Tech Evaluation', bid.has_tech_eval ? '✅ Yes' : '❌ No'],
                      ['EMD Type', bid.emd_type || '—'],
                      ['Opening Date', fmt(bid.opening_date)],
                    ].map(([l,v])=>(
                      <div key={l} className="flex justify-between gap-4">
                        <span className="text-muted-foreground shrink-0">{l}</span>
                        <span className="font-medium text-foreground text-right">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {bid.remarks && (
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Remarks</p>
                  <p className="text-sm text-foreground">{bid.remarks}</p>
                </div>
              )}
              <OutcomePanel bid={bid} />
            </div>
          )}
          {activeTab === 'checklist' && <ChecklistTab bid={bid} onRefresh={loadBid}/>}
          {activeTab === 'history' && <StageHistoryTab bidId={bid.id}/>}
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
