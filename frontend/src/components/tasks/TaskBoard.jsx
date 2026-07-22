import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Loader2, AlertCircle, CheckCircle2, Clock, User,
  X, ChevronDown, Filter, RefreshCw, MoreHorizontal,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  createTask, listTasks,
  TASK_TYPES, TASK_TYPE_LABELS,
  TASK_STATUSES, TASK_STATUS_COLORS,
  PRIORITY_COLORS,
} from '../../services/tasks'
import { usePermissions } from '../../hooks/usePermissions'
import { listUsers } from '../../services/users'
import { TaskDetailDrawer } from './TaskDetailDrawer'

function PriorityDot({ priority }) {
  const map = { LOW:'bg-slate-400', MEDIUM:'bg-blue-500', HIGH:'bg-orange-500', CRITICAL:'bg-red-500' }
  return <span className={`size-2 rounded-full ${map[priority]??'bg-slate-400'} shrink-0`}/>
}

function StatusChip({ status }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${TASK_STATUS_COLORS[status]??'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {status?.replace('_',' ')}
    </span>
  )
}

// ── Create Task Dialog ────────────────────────────────────────────────────────
function CreateTaskDialog({ bidId, open, onClose, onCreated, originRef }) {
  const [form, setForm] = useState({
    task_type:'GENERAL', title:'', description:'',
    priority:'MEDIUM', assigned_to:'', due_date:'',
  })
  const [loading, setLoading] = useState(false)
  const [users, setUsers]     = useState([])
  const [errors, setErrors]   = useState({})

  useEffect(() => {
    if (open) listUsers({ limit:100 }).then(r => {
      if(r.ok) setUsers(Array.isArray(r.data?.users) ? r.data.users : [])
    })
  }, [open])

  function set(f,v) { setForm(p=>({...p,[f]:v})); setErrors(p=>({...p,[f]:undefined})) }

  async function submit(e) {
    e.preventDefault()
    if (!form.title.trim()) { setErrors({title:'Title required'}); return }
    setLoading(true)
    try {
      const payload = {
        ...form,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : undefined,
      }
      if (!payload.assigned_to) delete payload.assigned_to
      if (!payload.due_date)    delete payload.due_date
      if (!payload.description) delete payload.description

      const res = await createTask(bidId, payload)
      if (res.ok) { toast.success('Task created'); onCreated() }
      else toast.error(res.error?.message ?? 'Failed to create task')
    } catch { toast.error('Network error') }
    finally { setLoading(false) }
  }

  // Get origin for macOS spring
  const originRect = originRef?.current?.getBoundingClientRect()
  const cx = typeof window !== 'undefined' ? window.innerWidth/2 : 0
  const cy = typeof window !== 'undefined' ? window.innerHeight/2 : 0
  const dx = originRect ? originRect.left + originRect.width/2 - cx : 0
  const dy = originRect ? originRect.top  + originRect.height/2 - cy : 0

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="absolute inset-0 bg-foreground/25 backdrop-blur-sm" onClick={onClose}/>
          <motion.div
            initial={{opacity:0,scale:0.5,x:dx,y:dy}}
            animate={{opacity:1,scale:1,x:0,y:0}}
            exit={{opacity:0,scale:0.5,x:dx,y:dy}}
            transition={{type:'spring',stiffness:380,damping:30,mass:0.8}}
            className="relative z-10 w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
            onClick={e=>e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
              <h3 className="font-heading font-semibold text-foreground">Create Task</h3>
              <button onClick={onClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground"><X className="size-4"/></button>
            </div>

            <form onSubmit={submit} className="p-5 space-y-3">
              {/* Task Type */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Task Type</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full h-8 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5">
                        <span>{TASK_TYPE_LABELS[form.task_type] ?? form.task_type}</span>
                        <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[180px]">
                      <DropdownMenuLabel>Select Task Type</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {TASK_TYPES.map((t) => (
                        <DropdownMenuItem key={t} onSelect={() => set('task_type', t)}>
                          {TASK_TYPE_LABELS[t]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Priority</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full h-8 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5">
                        <span>{form.priority}</span>
                        <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[180px]">
                      <DropdownMenuLabel>Select Priority</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => (
                        <DropdownMenuItem key={p} onSelect={() => set('priority', p)}>
                          {p}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <Label className="text-xs">Title <span className="text-destructive">*</span></Label>
                <Input value={form.title} onChange={e=>set('title',e.target.value)}
                  placeholder="e.g. Upload EMD Certificate"
                  className={`h-8 text-sm ${errors.title?'border-destructive':''}`}/>
                {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Textarea value={form.description} onChange={e=>set('description',e.target.value)}
                  placeholder="Detailed instructions…" className="text-sm min-h-[60px]"/>
              </div>

              {/* Assign + Due */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Assign To</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full h-8 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5">
                        <span>{form.assigned_to ? (users.find(u => u.id === form.assigned_to)?.full_name ?? 'Unassigned') : 'Unassigned'}</span>
                        <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-60 overflow-y-auto w-[180px]">
                      <DropdownMenuLabel>Select User</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => set('assigned_to', '')}>
                        Unassigned
                      </DropdownMenuItem>
                      {users.map((u) => (
                        <DropdownMenuItem key={u.id} onSelect={() => set('assigned_to', u.id)}>
                          {u.full_name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Due Date</Label>
                  <Input type="date" value={form.due_date} onChange={e=>set('due_date',e.target.value)} className="h-8 text-sm"/>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
                <Button type="submit" size="sm" className="flex-1" disabled={loading}>
                  {loading && <Loader2 className="size-3.5 animate-spin mr-1"/>}Create Task
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// ── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onClick }) {
  const daysLeft = task.due_date
    ? Math.ceil((new Date(task.due_date) - Date.now()) / 86400000)
    : null
  const overdue = daysLeft !== null && daysLeft < 0

  return (
    <motion.div
      initial={{opacity:0,y:4}} animate={{opacity:1,y:0}}
      whileHover={{y:-1}} transition={{duration:0.15}}
      onClick={onClick}
      className="rounded-lg border border-border bg-card p-3.5 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all space-y-2.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <PriorityDot priority={task.priority}/>
          <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">{task.title}</p>
        </div>
        <StatusChip status={task.status}/>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {task.task_type && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {TASK_TYPE_LABELS[task.task_type] ?? task.task_type}
          </span>
        )}
        {task.due_date && (
          <span className={`flex items-center gap-1 text-[10px] ${overdue?'text-red-600':'text-muted-foreground'}`}>
            <Clock className="size-2.5"/>
            {overdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
          </span>
        )}
        {task.assigned_to && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <User className="size-2.5"/>{task.assigned_to_name ?? 'Assigned'}
          </span>
        )}
      </div>
    </motion.div>
  )
}

// ── Task Board ────────────────────────────────────────────────────────────────
export function TaskBoard({ bid }) {
  const { hasPermission } = usePermissions()
  const [tasks, setTasks]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [statusFilter, setStatus] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const createBtnRef = React.useRef(null)

  const loadTasks = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await listTasks(bid.id, { status: statusFilter, limit: 50, parent_only: true })
      if (res.ok) setTasks(res.data ?? [])
      else setError(res.error?.message ?? 'Failed to load tasks')
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }, [bid.id, statusFilter])

  useEffect(() => { loadTasks() }, [loadTasks])

  // Group tasks by status for kanban
  const STATUS_GROUPS = [
    { key: 'OPEN',        label: 'Open',        color: 'border-slate-300' },
    { key: 'IN_PROGRESS', label: 'In Progress', color: 'border-blue-400' },
    { key: 'UNDER_REVIEW',label: 'Under Review',color: 'border-violet-400' },
    { key: 'COMPLETED',   label: 'Completed',   color: 'border-emerald-400' },
  ]

  const grouped = STATUS_GROUPS.map(g => ({
    ...g,
    tasks: tasks.filter(t => t.status === g.key),
  }))
  const uncategorized = tasks.filter(t => !STATUS_GROUPS.find(g => g.key === t.status))

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5 min-w-[120px]">
                <span>{statusFilter ? statusFilter.replace(/_/g, ' ') : 'All Statuses'}</span>
                <ChevronDown className="size-3 text-muted-foreground ml-auto" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setStatus('')}>
                All Statuses
              </DropdownMenuItem>
              {TASK_STATUSES.map((s) => (
                <DropdownMenuItem key={s} onSelect={() => setStatus(s)}>
                  {s.replace(/_/g, ' ')}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={loadTasks} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading?'animate-spin':''}`}/>
          </Button>
        </div>
        {hasPermission('task.create') && bid.bid_status !== 'ARCHIVED' && (
          <motion.div whileHover={{scale:1.02}} whileTap={{scale:0.98}}>
            <Button ref={createBtnRef} size="sm" className="gap-1.5 h-8" onClick={()=>setShowCreate(true)}>
              <Plus className="size-3.5"/>New Task
            </Button>
          </motion.div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground"/></div>
      ) : error ? (
        <div className="flex flex-col items-center py-12 gap-3 text-muted-foreground">
          <AlertCircle className="size-7 text-destructive/60"/>
          <p className="text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={loadTasks}>Retry</Button>
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground">
          <CheckCircle2 className="size-10 text-muted-foreground/30"/>
          <div className="text-center">
            <p className="font-medium text-sm">No tasks yet</p>
            <p className="text-xs mt-0.5">Create tasks to track work on this tender</p>
          </div>
          {hasPermission('task.create') && bid.bid_status !== 'ARCHIVED' && (
            <Button size="sm" className="gap-1.5 mt-1" onClick={()=>setShowCreate(true)}>
              <Plus className="size-3.5"/>Create First Task
            </Button>
          )}
        </div>
      ) : (
        /* Kanban columns */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {grouped.map(group => (
            <div key={group.key} className={`rounded-lg border-t-2 ${group.color} bg-muted/20 p-3 space-y-2`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</p>
                <span className="text-xs font-medium text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
                  {group.tasks.length}
                </span>
              </div>
              <AnimatePresence>
                {group.tasks.map(task => (
                  <TaskCard key={task.id} task={task} onClick={()=>setSelectedTask(task)}/>
                ))}
              </AnimatePresence>
              {group.tasks.length === 0 && (
                <p className="text-xs text-muted-foreground/50 text-center py-4">No tasks</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Other statuses as list */}
      {uncategorized.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Other</p>
          {uncategorized.map(task => (
            <TaskCard key={task.id} task={task} onClick={()=>setSelectedTask(task)}/>
          ))}
        </div>
      )}

      {/* Create Task Dialog */}
      <CreateTaskDialog
        bidId={bid.id}
        open={showCreate}
        onClose={()=>setShowCreate(false)}
        onCreated={()=>{ setShowCreate(false); loadTasks() }}
        originRef={createBtnRef}
      />

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        open={!!selectedTask}
        onClose={()=>setSelectedTask(null)}
        onUpdated={loadTasks}
        isArchived={bid.bid_status === 'ARCHIVED'}
      />
    </div>
  )
}
