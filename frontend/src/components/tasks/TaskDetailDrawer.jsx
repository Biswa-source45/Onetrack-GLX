import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Loader2, CheckSquare, Square, Plus, Trash2,
  MessageSquare, Phone, Clock, User, ChevronDown,
  Send, AlertCircle, CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  getTask, updateTaskStatus, assignTask,
  getSubtasks, createSubtask,
  addActivity, listActivities,
  getChecklists, addChecklist, toggleChecklist, deleteChecklist,
  TASK_STATUSES, TASK_STATUS_COLORS, TASK_TYPE_LABELS,
  PRIORITY_COLORS, ACTIVITY_TYPE_LABELS,
} from '../../services/tasks'
import { usePermissions } from '../../hooks/usePermissions'
import { listUsers } from '../../services/users'

function fmt(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
}

// ── Checklist Panel ───────────────────────────────────────────────────────────
function ChecklistPanel({ taskId, isArchived }) {
  const { hasPermission } = usePermissions()
  const [items, setItems]     = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const res = await getChecklists(taskId)
    if (res.ok) setItems(res.data ?? [])
  }, [taskId])

  useEffect(() => { load() }, [load])

  const done  = items.filter(i => i.is_done).length
  const pct   = items.length ? Math.round((done / items.length) * 100) : 0

  async function toggle(item) {
    await toggleChecklist(taskId, item.id, !item.is_done)
    load()
  }

  async function addItem() {
    if (!newTitle.trim()) return
    setLoading(true)
    await addChecklist(taskId, newTitle.trim(), items.length)
    setNewTitle('')
    load()
    setLoading(false)
  }

  async function removeItem(itemId) {
    await deleteChecklist(taskId, itemId)
    load()
  }

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{width:`${pct}%`}}/>
          </div>
          <span className="text-xs text-muted-foreground">{done}/{items.length}</span>
        </div>
      )}
      <div className="space-y-1">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2 group">
            <button onClick={() => hasPermission('task.edit') && !isArchived && toggle(item)}
              className={`shrink-0 ${hasPermission('task.edit') && !isArchived ? 'cursor-pointer' : 'cursor-default'}`}>
              {item.is_done
                ? <CheckSquare className="size-4 text-primary"/>
                : <Square className="size-4 text-muted-foreground"/>}
            </button>
            <span className={`text-sm flex-1 ${item.is_done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {item.title}
            </span>
            {hasPermission('task.edit') && !isArchived && (
              <button onClick={() => removeItem(item.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all">
                <Trash2 className="size-3"/>
              </button>
            )}
          </div>
        ))}
      </div>
      {hasPermission('task.edit') && !isArchived && (
        <div className="flex gap-1.5">
          <Input value={newTitle} onChange={e=>setNewTitle(e.target.value)}
            placeholder="Add checklist item…" className="h-7 text-xs flex-1"
            onKeyDown={e=>{ if(e.key==='Enter'){e.preventDefault();addItem()} }}/>
          <Button size="sm" className="h-7 px-2" onClick={addItem} disabled={loading||!newTitle.trim()}>
            {loading ? <Loader2 className="size-3 animate-spin"/> : <Plus className="size-3"/>}
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Activity Timeline ─────────────────────────────────────────────────────────
function ActivityTimeline({ taskId, isArchived }) {
  const { hasPermission } = usePermissions()
  const [activities, setActivities] = useState([])
  const [loading, setLoading]       = useState(true)
  const [comment, setComment]       = useState('')
  const [sending, setSending]       = useState(false)

  const load = useCallback(async () => {
    const res = await listActivities(taskId)
    if (res.ok) setActivities((res.data ?? []).reverse())
    setLoading(false)
  }, [taskId])

  useEffect(() => { load() }, [load])

  async function sendComment() {
    if (!comment.trim()) return
    setSending(true)
    try {
      const res = await addActivity(taskId, 'COMMENT', { message: comment.trim() })
      if (res.ok) { setComment(''); load() }
      else toast.error('Failed to post comment')
    } catch { toast.error('Network error') }
    finally { setSending(false) }
  }

  const activityIcon = (type) => {
    const map = {
      COMMENT: <MessageSquare className="size-3 text-blue-500"/>,
      STATUS_CHANGED: <CheckCircle2 className="size-3 text-emerald-500"/>,
      CALL_LOGGED: <Phone className="size-3 text-violet-500"/>,
      ASSIGNED: <User className="size-3 text-orange-500"/>,
    }
    return map[type] ?? <AlertCircle className="size-3 text-muted-foreground"/>
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="size-4 animate-spin text-muted-foreground"/></div>
      ) : (
        <ScrollArea className="max-h-64 pr-1">
          <div className="space-y-3">
          {activities.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No activity yet.</p>}
          {activities.map((a,i)=>(
            <motion.div key={a.id??i} initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} transition={{delay:i*0.03}}
              className="flex gap-2.5 items-start">
              <div className="size-5 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                {activityIcon(a.activity_type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-xs font-medium text-foreground">{a.performed_by?.full_name ?? 'System'}</span>
                  <span className="text-[10px] text-muted-foreground">{ACTIVITY_TYPE_LABELS[a.activity_type]??a.activity_type}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{fmt(a.created_at)}</span>
                </div>
                {a.activity_type === 'COMMENT' && a.activity_data?.message && (
                  <p className="text-xs text-foreground mt-0.5 bg-muted/50 rounded-md px-2 py-1.5">{a.activity_data.message}</p>
                )}
                {a.activity_type === 'STATUS_CHANGED' && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {a.activity_data?.from} → {a.activity_data?.to}
                  </p>
                )}
                {a.activity_type === 'CALL_LOGGED' && a.activity_data && (
                  <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                    <p>📞 {a.activity_data.contact}</p>
                    {a.activity_data.summary && <p>{a.activity_data.summary}</p>}
                    {a.activity_data.duration_minutes && <p>{a.activity_data.duration_minutes} min</p>}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          </div>
        </ScrollArea>
      )}

      {hasPermission('task.edit') && !isArchived && (
        <div className="flex gap-1.5 pt-1 border-t border-border">
          <Textarea value={comment} onChange={e=>setComment(e.target.value)}
            placeholder="Write a comment…" className="text-xs min-h-[36px] flex-1 resize-none py-2"
            onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendComment()} }}/>
          <Button size="sm" className="h-9 px-2" onClick={sendComment} disabled={sending||!comment.trim()}>
            {sending?<Loader2 className="size-3.5 animate-spin"/>:<Send className="size-3.5"/>}
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Subtasks Panel ─────────────────────────────────────────────────────────────
function SubtasksPanel({ taskId, isArchived }) {
  const { hasPermission } = usePermissions()
  const [subtasks, setSubtasks] = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [loading, setLoading]   = useState(false)

  const load = useCallback(async () => {
    const res = await getSubtasks(taskId)
    if (res.ok) setSubtasks(res.data ?? [])
  }, [taskId])

  useEffect(() => { load() }, [load])

  async function addSub() {
    if (!newTitle.trim()) return
    setLoading(true)
    try {
      const res = await createSubtask(taskId, { title: newTitle.trim() })
      if (res.ok) { setNewTitle(''); load() }
      else toast.error('Failed')
    } catch { toast.error('Network error') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-2">
      {subtasks.map((s,i)=>(
        <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20 text-sm">
          <div className={`size-1.5 rounded-full ${s.status==='COMPLETED'?'bg-emerald-500':'bg-blue-500'}`}/>
          <span className="flex-1 text-xs text-foreground">{s.title}</span>
          <span className="text-[10px] text-muted-foreground">{s.status?.replace(/_/g,' ')}</span>
        </div>
      ))}
      {subtasks.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No subtasks.</p>}
      {hasPermission('task.create') && !isArchived && (
        <div className="flex gap-1.5">
          <Input value={newTitle} onChange={e=>setNewTitle(e.target.value)}
            placeholder="Add subtask…" className="h-7 text-xs flex-1"
            onKeyDown={e=>{ if(e.key==='Enter'){e.preventDefault();addSub()} }}/>
          <Button size="sm" className="h-7 px-2" onClick={addSub} disabled={loading||!newTitle.trim()}>
            {loading?<Loader2 className="size-3 animate-spin"/>:<Plus className="size-3"/>}
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Main Drawer ───────────────────────────────────────────────────────────────
export function TaskDetailDrawer({ task, open, onClose, onUpdated, isArchived }) {
  const { hasPermission } = usePermissions()
  const [fullTask, setFullTask]   = useState(null)
  const [loading, setLoading]     = useState(false)
  const [statusLoading, setSL]    = useState(false)
  const [users, setUsers]         = useState([])

  useEffect(() => {
    if (open && task?.id) {
      setLoading(true)
      getTask(task.id).then(r => { if(r.ok) setFullTask(r.data); setLoading(false) })
      listUsers({ limit:100 }).then(r => {
        if(r.ok) setUsers(Array.isArray(r.data?.users) ? r.data.users : [])
      })
    }
  }, [open, task?.id])

  async function changeStatus(newStatus) {
    setSL(true)
    try {
      const res = await updateTaskStatus(task.id, newStatus)
      if (res.ok) { toast.success('Status updated'); onUpdated(); getTask(task.id).then(r=>{ if(r.ok) setFullTask(r.data) }) }
      else toast.error(res.error?.message ?? 'Failed')
    } catch { toast.error('Network error') }
    finally { setSL(false) }
  }

  const t = fullTask ?? task

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="flex-1 bg-foreground/20 backdrop-blur-sm" onClick={onClose}/>

          {/* Drawer */}
          <motion.div
            initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}}
            transition={{type:'spring',stiffness:320,damping:32}}
            className="w-full max-w-md bg-card border-l border-border flex flex-col shadow-2xl overflow-hidden"
            onClick={e=>e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20 shrink-0">
              <div className="flex-1 min-w-0 mr-2">
                <p className="font-heading font-semibold text-foreground text-sm truncate">{t?.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {t?.task_type && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {TASK_TYPE_LABELS[t.task_type] ?? t.task_type}
                    </span>
                  )}
                  {t?.priority && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-medium ${PRIORITY_COLORS[t.priority]??''}`}>
                      {t.priority}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0">
                <X className="size-4"/>
              </button>
            </div>

            {/* Body */}
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground"/></div>
              ) : (
                <div className="p-5 space-y-5">
                  {/* Status + Assign */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={!hasPermission('task.edit') || statusLoading || isArchived}>
                          <Button variant="outline" size="sm" className="w-full h-8 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5 disabled:opacity-60">
                            <span>{t?.status ? t.status.replace(/_/g, ' ') : 'Select status...'}</span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[180px]">
                          <DropdownMenuLabel>Select Status</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {TASK_STATUSES.map((s) => (
                            <DropdownMenuItem key={s} onSelect={() => changeStatus(s)}>
                              {s.replace(/_/g, ' ')}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Due Date</Label>
                      <p className="text-sm font-medium text-foreground h-8 flex items-center">
                        {fmt(t?.due_date)}
                      </p>
                    </div>
                  </div>

                  {t?.description && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Description</Label>
                      <p className="text-sm text-foreground leading-relaxed">{t.description}</p>
                    </div>
                  )}

                  {/* Sections */}
                  {[
                    { label:'Checklist', content:<ChecklistPanel taskId={t?.id} isArchived={isArchived}/> },
                    { label:'Subtasks',  content:<SubtasksPanel  taskId={t?.id} isArchived={isArchived}/> },
                    { label:'Activity',  content:<ActivityTimeline taskId={t?.id} isArchived={isArchived}/> },
                  ].map(section => (
                    <div key={section.label} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{section.label}</p>
                        <div className="flex-1 h-px bg-border"/>
                      </div>
                      {section.content}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
