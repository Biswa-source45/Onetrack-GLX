import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ListChecks, Search, RefreshCw, Filter, ChevronDown, Zap,
  Briefcase, Calendar, Clock, AlertTriangle, CheckCircle2,
  FileText, ShieldCheck, HelpCircle, ArrowUpRight, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  myTasks, TASK_TYPES, TASK_TYPE_LABELS, TASK_TYPE_ICONS,
  TASK_STATUSES, TASK_STATUS_COLORS, PRIORITY_COLORS, PRIORITY_DOT_COLORS,
} from '../../services/tasks'

function fmt(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function MyTasksPage() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [overdueFilter, setOverdueFilter] = useState(false)

  const loadTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await myTasks({ limit: 100 })
      if (res.ok) {
        setTasks(res.data ?? [])
      } else {
        setError(res.error?.message ?? 'Failed to load assigned tasks')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  // Client-side filtration over loaded tasks
  const filtered = tasks.filter(t => {
    const q = search.toLowerCase()
    const matchSearch = !q || t.title?.toLowerCase().includes(q) || t.bid_title?.toLowerCase().includes(q) || TASK_TYPE_LABELS[t.task_type]?.toLowerCase().includes(q)
    const matchStatus = statusFilter ? t.status === statusFilter : true
    const matchPriority = priorityFilter ? t.priority === priorityFilter : true
    const matchType = typeFilter ? t.task_type === typeFilter : true
    
    // Overdue check
    let matchOverdue = true
    if (overdueFilter) {
      if (!t.due_date) {
        matchOverdue = false
      } else {
        const left = Math.ceil((new Date(t.due_date) - Date.now()) / 86400000)
        matchOverdue = left < 0
      }
    }
    return matchSearch && matchStatus && matchPriority && matchType && matchOverdue
  })

  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length,
    highPriority: tasks.filter(t => (t.priority === 'HIGH' || t.priority === 'CRITICAL') && t.status !== 'COMPLETED').length,
    overdue: tasks.filter(t => {
      if (!t.due_date || t.status === 'COMPLETED' || t.status === 'CANCELLED') return false
      return new Date(t.due_date) < new Date()
    }).length,
  }

  const hasFilters = search || statusFilter || priorityFilter || typeFilter || overdueFilter

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">My Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track and complete items assigned to you across all active bid workspaces.
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-8" onClick={loadTasks} disabled={loading}>
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total Assigned</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Pending Action</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-2xl font-bold text-orange-600">{stats.highPriority}</p>
          <p className="text-xs text-muted-foreground mt-0.5">High & Critical</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Overdue Tasks</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by task title or bid..."
            className="h-8 pl-8 text-xs"
          />
        </div>

        {/* Status Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={`h-8 text-xs gap-1.5 ${statusFilter ? 'bg-primary/5 border-primary/30 text-primary' : ''}`}>
              <Filter className="size-3" />
              {statusFilter ? statusFilter.replace(/_/g, ' ') : 'Status'}
              <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-44">
            <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setStatusFilter('')}>All Statuses</DropdownMenuItem>
            {TASK_STATUSES.map(s => (
              <DropdownMenuItem key={s} onSelect={() => setStatusFilter(s)}>{s.replace(/_/g, ' ')}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Priority Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={`h-8 text-xs gap-1.5 ${priorityFilter ? 'bg-primary/5 border-primary/30 text-primary' : ''}`}>
              <Zap className="size-3" />
              {priorityFilter || 'Priority'}
              <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-36">
            <DropdownMenuLabel>Filter by Priority</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setPriorityFilter('')}>All Priorities</DropdownMenuItem>
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(p => (
              <DropdownMenuItem key={p} onSelect={() => setPriorityFilter(p)}>{p}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Task Type Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={`h-8 text-xs gap-1.5 ${typeFilter ? 'bg-primary/5 border-primary/30 text-primary' : ''}`}>
              {typeFilter ? TASK_TYPE_LABELS[typeFilter] : 'Type'}
              <ChevronDown className="size-3" />
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

        {/* Overdue toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOverdueFilter(p => !p)}
          className={`h-8 text-xs gap-1.5 ${overdueFilter ? 'bg-red-50 text-red-700 border-red-200' : ''}`}
        >
          <Clock className="size-3" />
          Overdue Only
        </Button>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setSearch(''); setStatusFilter(''); setPriorityFilter(''); setTypeFilter(''); setOverdueFilter(false) }}>
            Clear Filters
          </Button>
        )}
      </div>

      {/* Task List/Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl space-y-2">
          <AlertTriangle className="size-8 mx-auto text-destructive" />
          <p className="text-sm font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={loadTasks}>Retry</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl space-y-2">
          <ListChecks className="size-10 mx-auto text-muted-foreground/30" />
          <p className="text-sm font-medium">No tasks found</p>
          <p className="text-xs">You don't have any matching pending tasks assigned to you.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-xs font-semibold text-muted-foreground uppercase">
                  <th className="px-4 py-3">Task Details</th>
                  <th className="px-4 py-3">Tender / Bid</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {filtered.map((task, i) => {
                    const daysLeft = task.due_date ? Math.ceil((new Date(task.due_date) - Date.now()) / 86400000) : null
                    const isOverdue = daysLeft !== null && daysLeft < 0
                    return (
                      <motion.tr
                        key={task.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="border-b border-border hover:bg-muted/40 transition-colors group"
                      >
                        <td className="px-4 py-3">
                          <button onClick={() => navigate(`/dashboard/tasks/${task.id}`)} className="text-left font-medium text-sm text-foreground hover:text-primary transition-colors flex items-start gap-2 max-w-md">
                            <span className="text-base mt-0.5">{TASK_TYPE_ICONS[task.task_type] ?? '📋'}</span>
                            <div className="min-w-0">
                              <p className="font-semibold line-clamp-1">{task.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{TASK_TYPE_LABELS[task.task_type] ?? task.task_type}</p>
                            </div>
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => navigate(`/dashboard/tenders/${task.bid_id}`)} className="text-left text-xs font-medium text-muted-foreground hover:text-foreground line-clamp-1 max-w-xs transition-colors">
                            {task.bid_title || 'View Tender'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${PRIORITY_COLORS[task.priority] ?? ''}`}>
                            <span className={`size-1.5 rounded-full ${PRIORITY_DOT_COLORS[task.priority] ?? 'bg-slate-400'}`} />
                            {task.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${TASK_STATUS_COLORS[task.status] ?? ''}`}>
                            {task.status?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs ${isOverdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                            {task.due_date ? (isOverdue ? `Overdue by ${Math.abs(daysLeft)}d` : daysLeft === 0 ? 'Due today' : `Due in ${daysLeft}d`) : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => navigate(`/dashboard/tasks/${task.id}`)}>
                            <ArrowUpRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                          </Button>
                        </td>
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
