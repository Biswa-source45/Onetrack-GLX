import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Loader2, AlertCircle, Search, RefreshCw,
  ListChecks, Clock, User, TrendingUp, CheckCircle2,
  XCircle, AlertTriangle, Zap, Filter, ChevronDown,
  Calendar, ArrowUpRight, MoreHorizontal, UserCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  listTasks, updateTaskStatus, assignTask, deleteTask,
  TASK_TYPES, TASK_TYPE_LABELS, TASK_TYPE_ICONS,
  TASK_STATUSES, TASK_STATUS_COLORS,
  PRIORITY_COLORS, PRIORITY_DOT_COLORS,
} from '../../services/tasks'
import { usePermissions } from '../../hooks/usePermissions'
import { listUsers } from '../../services/users'
import { CreateTaskDialog } from './CreateTaskDialog'

function fmt(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border ${TASK_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  )
}

function PriorityBadge({ priority }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${PRIORITY_COLORS[priority] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      <span className={`size-1.5 rounded-full ${PRIORITY_DOT_COLORS[priority] ?? 'bg-gray-400'}`} />
      {priority}
    </span>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, bg, border, active, onClick }) {
  return (
    <motion.button
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`text-left rounded-xl border p-3.5 transition-all cursor-pointer ${
        active ? `${bg} ${border} ring-2 ring-offset-1 ring-current/20` : `bg-card ${border} hover:shadow-sm`
      }`}
    >
      <div className={`size-8 rounded-lg ${bg} border ${border} flex items-center justify-center mb-2.5`}>
        <Icon className={`size-3.5 ${color}`} />
      </div>
      <p className={`text-xl font-bold font-heading ${color}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
    </motion.button>
  )
}

// ── Task Row ──────────────────────────────────────────────────────────────────
function TaskRow({ task, users, onView, onReassign, onCancel, isArchived, canEdit, canAssign, canDelete, index }) {
  const navigate = useNavigate()
  const [actionLoading, setActionLoading] = useState(false)
  const daysLeft = task.due_date ? Math.ceil((new Date(task.due_date) - Date.now()) / 86400000) : null
  const overdue = daysLeft !== null && daysLeft < 0
  const assigneeName = task.assigned_to_name
    ?? users.find(u => u.id === task.assigned_to)?.full_name
    ?? (task.assigned_to ? 'Assigned' : '—')

  async function doReassign(userId) {
    setActionLoading(true)
    const res = await assignTask(task.id, userId)
    setActionLoading(false)
    if (res.ok) { toast.success('Task reassigned'); onReassign() }
    else toast.error(res.error?.message ?? 'Failed to reassign')
  }

  async function doCancel() {
    setActionLoading(true)
    const res = await deleteTask(task.id)
    setActionLoading(false)
    if (res.ok) { toast.success('Task cancelled'); onCancel() }
    else toast.error(res.error?.message ?? 'Failed')
  }

  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      whileHover={{ backgroundColor: 'hsl(var(--muted)/0.4)' }}
      className="group border-b border-border/50 last:border-0 transition-colors"
    >
      {/* Title + Type */}
      <td className="py-3 px-4">
        <button onClick={() => navigate(`/dashboard/tasks/${task.id}`)}
          className="flex items-start gap-2.5 text-left group/title hover:text-primary transition-colors">
          <span className="text-lg leading-none mt-0.5">{TASK_TYPE_ICONS[task.task_type] ?? '📋'}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground group-hover/title:text-primary line-clamp-1 transition-colors">
              {task.title}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{TASK_TYPE_LABELS[task.task_type] ?? task.task_type}</p>
          </div>
        </button>
      </td>

      {/* Assignee */}
      <td className="py-3 px-3">
        <div className="flex items-center gap-1.5">
          <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-[9px] font-semibold text-primary">{assigneeName[0]?.toUpperCase() ?? '?'}</span>
          </div>
          <span className="text-xs text-foreground max-w-[100px] truncate">{assigneeName}</span>
        </div>
      </td>

      {/* Priority */}
      <td className="py-3 px-3"><PriorityBadge priority={task.priority} /></td>

      {/* Status */}
      <td className="py-3 px-3"><StatusBadge status={task.status} /></td>

      {/* Due Date */}
      <td className="py-3 px-3">
        <span className={`text-xs flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
          <Calendar className="size-3 shrink-0" />
          {task.due_date ? (overdue ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`) : '—'}
        </span>
      </td>

      {/* Completion % */}
      <td className="py-3 px-3">
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${task.completion_percentage ?? 0}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">{task.completion_percentage ?? 0}%</span>
        </div>
      </td>

      {/* Created */}
      <td className="py-3 px-3 text-xs text-muted-foreground">{fmt(task.created_at)}</td>

      {/* Actions */}
      <td className="py-3 px-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
            onClick={() => navigate(`/dashboard/tasks/${task.id}`)}>
            <ArrowUpRight className="size-3" />
          </Button>
          {!isArchived && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-6 px-1.5" disabled={actionLoading}>
                  {actionLoading ? <Loader2 className="size-3 animate-spin" /> : <MoreHorizontal className="size-3" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate(`/dashboard/tasks/${task.id}`)}>
                  View Details
                </DropdownMenuItem>
                {canAssign && (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted rounded flex items-center gap-2">
                      <UserCheck className="size-3.5" /> Reassign
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-48 overflow-y-auto w-44">
                      {users.map(u => (
                        <DropdownMenuItem key={u.id} onSelect={() => doReassign(u.id)}>
                          {u.full_name || u.username}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {canDelete && task.status !== 'CANCELLED' && task.status !== 'COMPLETED' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={doCancel} className="text-destructive focus:text-destructive">
                      Cancel Task
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </td>
    </motion.tr>
  )
}

// ── Main Task Dashboard ───────────────────────────────────────────────────────
export function TaskDashboard({ bid }) {
  const { hasPermission } = usePermissions()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [users, setUsers] = useState([])
  const [showCreate, setShowCreate] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [activeStatCard, setActiveStatCard] = useState('')

  const canEdit   = hasPermission('task.edit')   && bid?.bid_status !== 'ARCHIVED'
  const canCreate = hasPermission('task.create') && bid?.bid_status !== 'ARCHIVED'
  const canAssign = hasPermission('task.assign') && bid?.bid_status !== 'ARCHIVED'
  const canDelete = hasPermission('task.delete') && bid?.bid_status !== 'ARCHIVED'

  const loadTasks = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await listTasks(bid.id, { limit: 100, parent_only: true })
      if (res.ok) setTasks(res.data ?? [])
      else setError(res.error?.message ?? 'Failed to load tasks')
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }, [bid.id])

  useEffect(() => { loadTasks() }, [loadTasks])
  useEffect(() => {
    listUsers({ limit: 100 }).then(r => {
      if (r.ok) setUsers(Array.isArray(r.data?.users) ? r.data.users : [])
    })
  }, [])

  // Stats
  const stats = {
    total:       tasks.length,
    assigned:    tasks.filter(t => t.status === 'ASSIGNED').length,
    in_progress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
    under_review:tasks.filter(t => t.status === 'UNDER_REVIEW').length,
    completed:   tasks.filter(t => t.status === 'COMPLETED').length,
    cancelled:   tasks.filter(t => t.status === 'CANCELLED').length,
    escalated:   tasks.filter(t => t.status === 'ESCALATED').length,
  }

  const statCards = [
    { key: '',            label: 'Total Tasks',   value: stats.total,        icon: ListChecks,   color: 'text-slate-600',   bg: 'bg-slate-50',   border: 'border-slate-200' },
    { key: 'ASSIGNED',    label: 'Assigned',       value: stats.assigned,     icon: User,         color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200' },
    { key: 'IN_PROGRESS', label: 'In Progress',    value: stats.in_progress,  icon: TrendingUp,   color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-200' },
    { key: 'UNDER_REVIEW',label: 'Under Review',   value: stats.under_review, icon: Clock,        color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-200' },
    { key: 'COMPLETED',   label: 'Completed',      value: stats.completed,    icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { key: 'CANCELLED',   label: 'Cancelled',      value: stats.cancelled,    icon: XCircle,      color: 'text-gray-500',    bg: 'bg-gray-50',    border: 'border-gray-200' },
    { key: 'ESCALATED',   label: 'Escalated',      value: stats.escalated,    icon: AlertTriangle,color: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-200' },
  ]

  // Filtered tasks
  const filtered = tasks.filter(t => {
    const q = search.toLowerCase()
    const matchSearch = !q || t.title?.toLowerCase().includes(q) || TASK_TYPE_LABELS[t.task_type]?.toLowerCase().includes(q)
    const matchStatus = statusFilter ? t.status === statusFilter : true
    const matchPriority = priorityFilter ? t.priority === priorityFilter : true
    const matchType = typeFilter ? t.task_type === typeFilter : true
    const matchAssignee = assigneeFilter ? t.assigned_to === assigneeFilter : true
    const matchStatCard = activeStatCard ? t.status === activeStatCard : true
    return matchSearch && matchStatus && matchPriority && matchType && matchAssignee && matchStatCard
  })

  function handleStatCard(key) {
    setActiveStatCard(prev => prev === key ? '' : key)
    setStatusFilter('')
  }

  const hasFilters = search || statusFilter || priorityFilter || typeFilter || assigneeFilter || activeStatCard

  return (
    <div className="space-y-5">

      {/* Stats Cards */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2.5">
        {statCards.map((s, i) => (
          <motion.div key={s.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <StatCard
              {...s}
              active={activeStatCard === s.key && s.key !== '' ? true : false}
              onClick={() => handleStatCard(s.key)}
            />
          </motion.div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search tasks…" className="h-8 pl-8 text-xs" />
        </div>

        {/* Status filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm"
              className={`h-8 text-xs gap-1.5 ${statusFilter ? 'bg-primary/5 border-primary/30 text-primary' : ''}`}>
              <Filter className="size-3" />
              {statusFilter ? statusFilter.replace(/_/g, ' ') : 'Status'}
              <ChevronDown className="size-3 ml-auto" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-44">
            <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setStatusFilter('')}>All Statuses</DropdownMenuItem>
            {TASK_STATUSES.map(s => <DropdownMenuItem key={s} onSelect={() => setStatusFilter(s)}>{s.replace(/_/g, ' ')}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Priority filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm"
              className={`h-8 text-xs gap-1.5 ${priorityFilter ? 'bg-primary/5 border-primary/30 text-primary' : ''}`}>
              <Zap className="size-3" />
              {priorityFilter || 'Priority'}
              <ChevronDown className="size-3 ml-auto" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-36">
            <DropdownMenuLabel>Filter by Priority</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setPriorityFilter('')}>All</DropdownMenuItem>
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(p => <DropdownMenuItem key={p} onSelect={() => setPriorityFilter(p)}>{p}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Task type filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm"
              className={`h-8 text-xs gap-1.5 ${typeFilter ? 'bg-primary/5 border-primary/30 text-primary' : ''}`}>
              {typeFilter ? TASK_TYPE_LABELS[typeFilter] : 'Type'}
              <ChevronDown className="size-3 ml-auto" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48">
            <DropdownMenuLabel>Filter by Type</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setTypeFilter('')}>All Types</DropdownMenuItem>
            {TASK_TYPES.map(t => (
              <DropdownMenuItem key={t} onSelect={() => setTypeFilter(t)}>
                {TASK_TYPE_ICONS[t]} {TASK_TYPE_LABELS[t]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Assignee filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm"
              className={`h-8 text-xs gap-1.5 ${assigneeFilter ? 'bg-primary/5 border-primary/30 text-primary' : ''}`}>
              <User className="size-3" />
              {assigneeFilter ? (users.find(u => u.id === assigneeFilter)?.full_name ?? 'User') : 'Assignee'}
              <ChevronDown className="size-3 ml-auto" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-52 overflow-y-auto w-44">
            <DropdownMenuLabel>Filter by Assignee</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setAssigneeFilter('')}>All</DropdownMenuItem>
            {users.map(u => <DropdownMenuItem key={u.id} onSelect={() => setAssigneeFilter(u.id)}>{u.full_name || u.username}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground"
            onClick={() => { setSearch(''); setStatusFilter(''); setPriorityFilter(''); setTypeFilter(''); setAssigneeFilter(''); setActiveStatCard('') }}>
            Clear filters
          </Button>
        )}

        <div className="flex-1" />
        <Button variant="ghost" size="sm" className="h-8" onClick={loadTasks} disabled={loading}>
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        {canCreate && (
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button size="sm" className="h-8 gap-1.5" onClick={() => setShowCreate(true)}>
              <Plus className="size-3.5" /> New Task
            </Button>
          </motion.div>
        )}
      </div>

      {/* Task Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground">
          <AlertCircle className="size-8 text-destructive/60" />
          <p className="text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={loadTasks}>Retry</Button>
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center py-16 gap-3 text-muted-foreground">
          <CheckCircle2 className="size-12 text-muted-foreground/20" />
          <div className="text-center">
            <p className="font-medium text-sm">{tasks.length === 0 ? 'No tasks yet' : 'No tasks match your filters'}</p>
            <p className="text-xs mt-1">{tasks.length === 0 ? 'Create tasks to start tracking work on this tender.' : 'Try adjusting your search or filters.'}</p>
          </div>
          {tasks.length === 0 && canCreate && (
            <Button size="sm" className="gap-1.5 mt-1" onClick={() => setShowCreate(true)}>
              <Plus className="size-3.5" /> Create First Task
            </Button>
          )}
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-xl border border-border overflow-hidden bg-card">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/20">
            <p className="text-xs font-medium text-muted-foreground">
              {filtered.length} task{filtered.length !== 1 ? 's' : ''}
              {hasFilters && ` (filtered from ${tasks.length})`}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5">Task</th>
                  <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2.5">Assignee</th>
                  <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2.5">Priority</th>
                  <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2.5">Status</th>
                  <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2.5">Due</th>
                  <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2.5">Progress</th>
                  <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2.5">Created</th>
                  <th className="px-3 py-2.5 w-16" />
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {filtered.map((task, i) => (
                    <TaskRow key={task.id} task={task} users={users} index={i}
                      isArchived={bid?.bid_status === 'ARCHIVED'}
                      canEdit={canEdit} canAssign={canAssign} canDelete={canDelete}
                      onReassign={loadTasks} onCancel={loadTasks}
                      onView={() => {}} />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      <CreateTaskDialog
        bidId={bid.id}
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); loadTasks() }}
      />
    </div>
  )
}
