import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Loader2, CheckSquare, Square, Plus, Trash2,
  MessageSquare, Phone, Clock, User, ChevronDown, Send,
  AlertCircle, CheckCircle2, ShieldAlert, Award, FileCheck,
  Building2, Calendar, FileText, CheckCircle, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  getTask, updateTaskStatus, assignTask,
  getSubtasks, createSubtask,
  addActivity, listActivities,
  getChecklists, addChecklist, toggleChecklist, deleteChecklist,
  submitApprovalDecision, addOEMFollowUp,
  TASK_STATUSES, TASK_STATUS_COLORS, TASK_TYPE_LABELS, TASK_TYPE_ICONS,
  PRIORITY_COLORS, PRIORITY_DOT_COLORS, ACTIVITY_TYPE_LABELS,
  OEM_STATES, OEM_STATE_LABELS,
} from '../../services/tasks'
import { usePermissions } from '../../hooks/usePermissions'
import { listUsers } from '../../services/users'

function fmt(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function TaskDetailPage() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()

  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [users, setUsers] = useState([])
  const [statusLoading, setSL] = useState(false)
  const [assignLoading, setAL] = useState(false)

  // Sub-panel state refresh triggers
  const [checklistTrigger, setChecklistTrigger] = useState(0)
  const [subtasksTrigger, setSubtasksTrigger] = useState(0)
  const [activityTrigger, setActivityTrigger] = useState(0)

  // Approval Form State
  const [approvalComment, setApprovalComment] = useState('')
  const [approvalLoading, setApprovalLoading] = useState(false)

  // OEM Followup Form State
  const [oemNote, setOemNote] = useState('')
  const [newOemState, setNewOemState] = useState('FOLLOW_UP_PENDING')
  const [oemResponseStatus, setOemResponseStatus] = useState('')
  const [oemLoading, setOemLoading] = useState(false)

  const loadTaskDetails = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getTask(taskId)
      if (res.ok) {
        setTask(res.data)
      } else {
        setError(res.error?.message ?? 'Failed to load task details')
      }
    } catch {
      setError('Network error loading task')
    } finally {
      setLoading(false)
    }
  }, [taskId])

  const loadUsers = useCallback(async () => {
    try {
      const res = await listUsers({ limit: 100 })
      if (res.ok) {
        setUsers(Array.isArray(res.data?.users) ? res.data.users : [])
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    loadTaskDetails()
    loadUsers()
  }, [loadTaskDetails, loadUsers])

  const handleStatusChange = async (newStatus) => {
    setSL(true)
    try {
      const res = await updateTaskStatus(taskId, newStatus)
      if (res.ok) {
        toast.success(`Status updated to ${newStatus.replace(/_/g, ' ')}`)
        setTask(prev => prev ? { ...prev, status: newStatus } : null)
        setActivityTrigger(p => p + 1)
      } else {
        toast.error(res.error?.message ?? 'Failed to update status')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSL(false)
    }
  }

  const handleAssigneeChange = async (userId) => {
    setAL(true)
    try {
      const res = await assignTask(taskId, userId)
      if (res.ok) {
        toast.success('Assignee updated')
        loadTaskDetails()
        setActivityTrigger(p => p + 1)
      } else {
        toast.error(res.error?.message ?? 'Failed to assign task')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setAL(false)
    }
  }

  const handleApproval = async (decision) => {
    setApprovalLoading(true)
    try {
      const res = await submitApprovalDecision(taskId, decision, approvalComment)
      if (res.ok) {
        toast.success(`Decision: ${decision} submitted`)
        setApprovalComment('')
        loadTaskDetails()
        setActivityTrigger(p => p + 1)
      } else {
        toast.error(res.error?.message ?? 'Failed to submit decision')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setApprovalLoading(false)
    }
  }

  const handleOEMFollowUpSubmit = async (e) => {
    e.preventDefault()
    if (!oemNote.trim()) {
      toast.error('Follow-up note is required')
      return
    }
    setOemLoading(true)
    try {
      const res = await addOEMFollowUp(taskId, {
        note: oemNote.trim(),
        new_oem_state: newOemState,
        response_status: oemResponseStatus.trim(),
      })
      if (res.ok) {
        toast.success('OEM Follow-up logged successfully')
        setOemNote('')
        setOemResponseStatus('')
        loadTaskDetails()
        setActivityTrigger(p => p + 1)
      } else {
        toast.error(res.error?.message ?? 'Failed to log follow-up')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setOemLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Loading task details...</p>
      </div>
    )
  }

  if (error || !task) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center space-y-4">
        <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-full w-fit mx-auto">
          <AlertCircle className="size-8" />
        </div>
        <h2 className="font-heading text-lg font-semibold">Error Loading Task</h2>
        <p className="text-sm text-muted-foreground">{error ?? 'Task not found'}</p>
        <Button onClick={() => navigate(-1)} variant="outline" className="gap-2">
          <ArrowLeft className="size-4" /> Go Back
        </Button>
      </div>
    )
  }

  const isArchived = task.bid_status === 'ARCHIVED'
  const isReadOnly = isArchived || task.status === 'COMPLETED' || task.status === 'CANCELLED'

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Back & Breadcrumb */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="gap-1.5 h-8">
          <ArrowLeft className="size-3.5" /> Back
        </Button>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <span className="hover:underline cursor-pointer" onClick={() => navigate(`/dashboard/tenders/${task.bid_id}`)}>
            {task.bid_title || 'Tender Workspace'}
          </span>
          <span>/</span>
          <span className="text-foreground font-medium">Task details</span>
        </div>
      </div>

      {/* Task Header Information */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col md:flex-row justify-between gap-6">
        <div className="space-y-3 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl">{TASK_TYPE_ICONS[task.task_type] ?? '📋'}</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {TASK_TYPE_LABELS[task.task_type] ?? task.task_type} Task
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${PRIORITY_COLORS[task.priority] ?? ''}`}>
              {task.priority}
            </span>
          </div>

          <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground truncate">{task.title}</h1>
          
          {task.description && (
            <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">{task.description}</p>
          )}

          <div className="flex items-center gap-6 text-xs text-muted-foreground flex-wrap pt-2">
            <span className="flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              Due: {task.due_date ? fmt(task.due_date) : 'No due date'}
            </span>
            {task.created_at && (
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" />
                Created: {fmt(task.created_at)}
              </span>
            )}
          </div>
        </div>

        {/* Configuration Actions */}
        <div className="flex flex-col sm:flex-row md:flex-col gap-4 shrink-0 justify-end md:justify-start">
          {/* Status Dropdown */}
          <div className="space-y-1.5 min-w-[160px]">
            <Label className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Status</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild disabled={!hasPermission('task.edit') || statusLoading || isArchived}>
                <Button variant="outline" size="sm" className="w-full h-8.5 text-xs justify-between gap-2 bg-background">
                  <span className={`inline-block size-2 rounded-full ${task.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                  <span className="truncate">{task.status?.replace(/_/g, ' ')}</span>
                  <ChevronDown className="size-3.5 text-muted-foreground ml-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[180px]">
                <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {TASK_STATUSES.map(s => (
                  <DropdownMenuItem key={s} onSelect={() => handleStatusChange(s)}>
                    {s.replace(/_/g, ' ')}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Assignee Selector */}
          <div className="space-y-1.5 min-w-[160px]">
            <Label className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Assignee</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild disabled={!hasPermission('task.assign') || assignLoading || isArchived}>
                <Button variant="outline" size="sm" className="w-full h-8.5 text-xs justify-between gap-2 bg-background">
                  <User className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">
                    {task.assigned_to?.full_name ?? task.assigned_to_name ?? 'Unassigned'}
                  </span>
                  <ChevronDown className="size-3.5 text-muted-foreground ml-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[200px] max-h-[250px] overflow-y-auto">
                <DropdownMenuLabel>Assign User</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => handleAssigneeChange('')}>Unassign</DropdownMenuItem>
                {users.map(u => (
                  <DropdownMenuItem key={u.id} onSelect={() => handleAssigneeChange(u.id)}>
                    {u.full_name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Type-Specific Details & Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. APPROVAL TYPE PANEL */}
          {task.task_type === 'APPROVAL' && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <ShieldAlert className="size-4.5 text-amber-500" />
                <h3 className="font-heading font-semibold text-sm text-foreground">Formal Approval Decision</h3>
              </div>

              {/* Display Decision Log */}
              {task.metadata?.approval_decision ? (
                <div className={`p-4 rounded-lg border ${
                  task.metadata.approval_decision === 'APPROVED' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                  task.metadata.approval_decision === 'REJECTED' ? 'bg-red-50 border-red-200 text-red-800' :
                  'bg-amber-50 border-amber-200 text-amber-800'
                } space-y-2`}>
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <CheckCircle className="size-4" />
                    Decision: {task.metadata.approval_decision}
                  </div>
                  {task.metadata.decision_comment && (
                    <p className="text-xs italic leading-relaxed">"{task.metadata.decision_comment}"</p>
                  )}
                  {task.metadata.decision_at && (
                    <p className="text-[10px] opacity-75">Decision Logged At: {fmt(task.metadata.decision_at)}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Pending decision from the assigned approver.</p>
              )}

              {/* Submit Decision Actions (Visible only to assignee or editor) */}
              {!isReadOnly && !task.metadata?.approval_decision && (
                <div className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Approval Remarks / Notes</Label>
                    <Textarea
                      value={approvalComment}
                      onChange={e => setApprovalComment(e.target.value)}
                      placeholder="Enter details, budget confirmation, or reasons for rejection..."
                      className="text-xs min-h-[70px] resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      onClick={() => handleApproval('APPROVED')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-8"
                      disabled={approvalLoading}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApproval('REJECTED')}
                      variant="destructive"
                      className="text-xs h-8 font-medium"
                      disabled={approvalLoading}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApproval('DEFERRED')}
                      variant="outline"
                      className="text-xs h-8 font-medium"
                      disabled={approvalLoading}
                    >
                      Defer Decision
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. OEM COORDINATION TYPE PANEL */}
          {task.task_type === 'OEM_COORDINATION' && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <Building2 className="size-4.5 text-blue-500" />
                <h3 className="font-heading font-semibold text-sm text-foreground">OEM Partner Details</h3>
              </div>

              {/* Contact Specs */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-muted-foreground">OEM Name</p>
                  <p className="font-semibold text-foreground mt-0.5">{task.metadata?.oem_name || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Contact Person</p>
                  <p className="font-semibold text-foreground mt-0.5">{task.metadata?.contact_person || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Contact Email</p>
                  <p className="font-semibold text-foreground mt-0.5">{task.metadata?.contact_email || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">OEM Status State</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-100">
                    {OEM_STATE_LABELS[task.metadata?.oem_state] ?? task.metadata?.oem_state}
                  </span>
                </div>
                {task.metadata?.last_follow_up_at && (
                  <div>
                    <p className="text-muted-foreground">Last Follow-up</p>
                    <p className="font-semibold text-foreground mt-0.5">{fmt(task.metadata.last_follow_up_at)}</p>
                  </div>
                )}
              </div>

              {/* Follow-up Logging Interface */}
              {!isReadOnly && (
                <form onSubmit={handleOEMFollowUpSubmit} className="space-y-3 pt-3 border-t border-border">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Log OEM Follow-up</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">New OEM State</Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="outline" size="sm" className="w-full h-8 justify-between text-xs font-normal">
                            {OEM_STATE_LABELS[newOemState] ?? newOemState}
                            <ChevronDown className="size-3 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[200px]">
                          {OEM_STATES.map(s => (
                            <DropdownMenuItem key={s} onSelect={() => setNewOemState(s)}>
                              {OEM_STATE_LABELS[s] ?? s}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Response Status Note</Label>
                      <Input
                        value={oemResponseStatus}
                        onChange={e => setOemResponseStatus(e.target.value)}
                        placeholder="e.g. In legal review..."
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Follow-up Remarks</Label>
                    <Textarea
                      value={oemNote}
                      onChange={e => setOemNote(e.target.value)}
                      placeholder="Add details about contact, call results, or issues..."
                      className="text-xs min-h-[50px] resize-none"
                    />
                  </div>

                  <Button type="submit" size="sm" className="h-8 text-xs font-semibold" disabled={oemLoading}>
                    {oemLoading ? 'Logging...' : 'Record Follow-up'}
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* 3. DOCUMENT COLLECTION TYPE PANEL */}
          {task.task_type === 'DOCUMENT_COLLECTION' && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <FileText className="size-4.5 text-indigo-500" />
                <h3 className="font-heading font-semibold text-sm text-foreground">Document Checklist Status</h3>
              </div>

              {/* Required Documents List */}
              <div className="space-y-2">
                {Array.isArray(task.metadata?.required_docs) ? (
                  task.metadata.required_docs.map((doc, idx) => {
                    const isUploaded = Array.isArray(task.metadata?.uploaded_docs) && task.metadata.uploaded_docs.includes(doc)
                    return (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/20 text-xs">
                        <span className="font-medium text-foreground">{doc}</span>
                        {isUploaded ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                            Uploaded
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                            Pending upload
                          </span>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <p className="text-xs text-muted-foreground">No documents configured in requirement.</p>
                )}
              </div>

              {/* completion flag indicator */}
              <div className="flex items-center gap-2 p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg text-xs text-indigo-800">
                <AlertTriangle className="size-4 shrink-0 text-indigo-600" />
                <span>
                  All required documents listed above must be verified as uploaded before you can mark this task as complete.
                </span>
              </div>
            </div>
          )}

          {/* Checklist Panel */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-sm">
            <h3 className="font-heading font-semibold text-sm text-foreground uppercase tracking-wider">Task Checklist</h3>
            <ChecklistPanel taskId={taskId} isArchived={isReadOnly} key={`chk-${checklistTrigger}`} />
          </div>

          {/* Subtasks Panel */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-sm">
            <h3 className="font-heading font-semibold text-sm text-foreground uppercase tracking-wider">Subtasks</h3>
            <SubtasksPanel taskId={taskId} isArchived={isReadOnly} key={`sub-${subtasksTrigger}`} />
          </div>
        </div>

        {/* Right Side: Activity Log & Comments */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-sm h-full flex flex-col min-h-[450px]">
            <h3 className="font-heading font-semibold text-sm text-foreground uppercase tracking-wider pb-2 border-b border-border">
              Timeline & Comments
            </h3>
            <div className="flex-1 overflow-hidden">
              <ActivityTimeline taskId={taskId} isArchived={isReadOnly} key={`act-${activityTrigger}`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Shared Sub-Panels (Matching Drawer exactly, but styled for layout spacing) ───────────────────────────

function ChecklistPanel({ taskId, isArchived }) {
  const { hasPermission } = usePermissions()
  const [items, setItems] = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const res = await getChecklists(taskId)
    if (res.ok) setItems(res.data ?? [])
  }, [taskId])

  useEffect(() => { load() }, [load])

  const done = items.filter(i => i.is_done).length
  const pct = items.length ? Math.round((done / items.length) * 100) : 0

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
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-muted-foreground">{done}/{items.length}</span>
        </div>
      )}
      <div className="space-y-1">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2 group p-1 hover:bg-muted/10 rounded">
            <button onClick={() => hasPermission('task.edit') && !isArchived && toggle(item)}
              className={`shrink-0 ${hasPermission('task.edit') && !isArchived ? 'cursor-pointer' : 'cursor-default'}`}>
              {item.is_done
                ? <CheckCircle2 className="size-4.5 text-primary" />
                : <Square className="size-4.5 text-muted-foreground" />}
            </button>
            <span className={`text-xs flex-1 ${item.is_done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {item.title}
            </span>
            {hasPermission('task.edit') && !isArchived && (
              <button onClick={() => removeItem(item.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all">
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      {hasPermission('task.edit') && !isArchived && (
        <div className="flex gap-1.5 mt-2">
          <Input value={newTitle} onChange={e => setNewTitle(e.target.value)}
            placeholder="Add checklist item…" className="h-8 text-xs flex-1"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }} />
          <Button size="sm" className="h-8 px-2" onClick={addItem} disabled={loading || !newTitle.trim()}>
            {loading ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3.5" />}
          </Button>
        </div>
      )}
    </div>
  )
}

function SubtasksPanel({ taskId, isArchived }) {
  const { hasPermission } = usePermissions()
  const [subtasks, setSubtasks] = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [loading, setLoading] = useState(false)

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
      else toast.error('Failed to create subtask')
    } catch { toast.error('Network error') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-3">
      {subtasks.map(s => (
        <div key={s.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-muted/20 text-xs">
          <div className={`size-2 rounded-full ${s.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
          <span className="flex-1 text-foreground font-medium">{s.title}</span>
          <span className="text-[10px] text-muted-foreground uppercase">{s.status?.replace(/_/g, ' ')}</span>
        </div>
      ))}
      {subtasks.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No subtasks found.</p>}
      {hasPermission('task.create') && !isArchived && (
        <div className="flex gap-1.5 pt-1">
          <Input value={newTitle} onChange={e => setNewTitle(e.target.value)}
            placeholder="Add subtask…" className="h-8 text-xs flex-1"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSub() } }} />
          <Button size="sm" className="h-8 px-2" onClick={addSub} disabled={loading || !newTitle.trim()}>
            {loading ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3.5" />}
          </Button>
        </div>
      )}
    </div>
  )
}

function ActivityTimeline({ taskId, isArchived }) {
  const { hasPermission } = usePermissions()
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)

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
      COMMENT: <MessageSquare className="size-3.5 text-blue-500" />,
      STATUS_CHANGED: <CheckCircle2 className="size-3.5 text-emerald-500" />,
      CALL_LOGGED: <Phone className="size-3.5 text-violet-500" />,
      ASSIGNED: <User className="size-3.5 text-orange-500" />,
    }
    return map[type] ?? <AlertCircle className="size-3.5 text-muted-foreground" />
  }

  return (
    <div className="space-y-4 flex flex-col h-full justify-between">
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <ScrollArea className="flex-1 max-h-[350px] pr-2">
          <div className="space-y-3.5">
            {activities.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No activity logged.</p>}
            {activities.map((a, i) => (
              <motion.div key={a.id ?? i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                className="flex gap-2.5 items-start">
                <div className="size-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  {activityIcon(a.activity_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-foreground">{a.performed_by?.full_name ?? 'System'}</span>
                    <span className="text-[10px] text-muted-foreground">{ACTIVITY_TYPE_LABELS[a.activity_type] ?? a.activity_type}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{fmt(a.created_at)}</span>
                  </div>
                  {a.activity_type === 'COMMENT' && a.activity_data?.message && (
                    <p className="text-xs text-foreground mt-1 bg-muted/40 rounded-md px-2.5 py-2 leading-relaxed">
                      {a.activity_data.message}
                    </p>
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
        <div className="flex gap-1.5 pt-3 border-t border-border mt-auto">
          <Textarea value={comment} onChange={e => setComment(e.target.value)}
            placeholder="Write a comment…" className="text-xs min-h-[36px] flex-1 resize-none py-2 h-8"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment() } }} />
          <Button size="sm" className="h-9 px-3.5" onClick={sendComment} disabled={sending || !comment.trim()}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      )}
    </div>
  )
}
