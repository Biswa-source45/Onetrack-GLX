import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Loader2, ChevronDown, Plus, Trash2,
  FileText, ShieldCheck, Building2, CheckSquare,
  Briefcase, BarChart2, Send, Eye, Settings, List,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  createTask, createApprovalTask, createOEMTask, createDocumentTask,
  TASK_TYPES, TASK_TYPE_LABELS,
} from '../../services/tasks'
import { listUsers } from '../../services/users'

// Icon per task type
const TYPE_ICONS = {
  GENERAL:             Briefcase,
  DOCUMENT_COLLECTION: FileText,
  OEM_COORDINATION:    Building2,
  QUALIFICATION:       CheckSquare,
  COMMERCIAL:          BarChart2,
  APPROVAL:            ShieldCheck,
  REVIEW:              Eye,
  SUBMISSION:          Send,
  CHECKLIST:           List,
  CUSTOM:              Settings,
}

const TYPE_COLORS = {
  GENERAL:             'text-slate-600 bg-slate-50 border-slate-200',
  DOCUMENT_COLLECTION: 'text-blue-600 bg-blue-50 border-blue-200',
  OEM_COORDINATION:    'text-purple-600 bg-purple-50 border-purple-200',
  QUALIFICATION:       'text-emerald-600 bg-emerald-50 border-emerald-200',
  COMMERCIAL:          'text-amber-600 bg-amber-50 border-amber-200',
  APPROVAL:            'text-red-600 bg-red-50 border-red-200',
  REVIEW:              'text-indigo-600 bg-indigo-50 border-indigo-200',
  SUBMISSION:          'text-cyan-600 bg-cyan-50 border-cyan-200',
  CHECKLIST:           'text-teal-600 bg-teal-50 border-teal-200',
  CUSTOM:              'text-gray-600 bg-gray-50 border-gray-200',
}

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const PRIORITY_COLORS_MAP = {
  LOW: 'text-slate-600', MEDIUM: 'text-blue-600',
  HIGH: 'text-orange-600', CRITICAL: 'text-red-600',
}

// ── Shared field component ──────────────────────────────────────────────────
function Field({ label, required, error, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function SelectButton({ value, onChange, options, placeholder = 'Select…', valueLabel }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm"
          className="w-full h-8 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5">
          <span>{valueLabel ?? (value ? value.replace(/_/g, ' ') : placeholder)}</span>
          <ChevronDown className="size-3 text-muted-foreground ml-auto shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-64 overflow-y-auto w-52">
        {options.map(opt => (
          <DropdownMenuItem key={opt.value ?? opt} onSelect={() => onChange(opt.value ?? opt)}>
            {opt.label ?? opt.replace(/_/g, ' ')}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Type-specific extra fields ──────────────────────────────────────────────
function ApprovalFields({ form, set, errors, users }) {
  return (
    <motion.div key="approval" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="space-y-3">
      <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
        <p className="text-xs font-medium text-red-700">Approval Task</p>
        <p className="text-[11px] text-red-600 mt-0.5">Cannot be completed until an approval decision is recorded.</p>
      </div>
      <Field label="Approver" required error={errors.approver_id}>
        <SelectButton
          value={form.approver_id}
          onChange={v => set('approver_id', v)}
          placeholder="Select approver…"
          valueLabel={form.approver_id ? (users.find(u => u.id === form.approver_id)?.full_name ?? 'Selected') : undefined}
          options={users.map(u => ({ value: u.id, label: u.full_name || u.username }))}
        />
      </Field>
      <Field label="SLA Deadline">
        <Input type="date" value={form.sla_deadline} onChange={e => set('sla_deadline', e.target.value)} className="h-8 text-sm" />
      </Field>
    </motion.div>
  )
}

function OEMFields({ form, set, errors }) {
  return (
    <motion.div key="oem" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="space-y-3">
      <div className="rounded-lg bg-purple-50 border border-purple-100 px-3 py-2">
        <p className="text-xs font-medium text-purple-700">OEM Coordination Task</p>
        <p className="text-[11px] text-purple-600 mt-0.5">Tracks OEM authorization letter (MAF) collection lifecycle.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="OEM Name" required error={errors.oem_name}>
          <Input value={form.oem_name} onChange={e => set('oem_name', e.target.value)}
            placeholder="e.g. Cisco India" className={`h-8 text-sm ${errors.oem_name ? 'border-destructive' : ''}`} />
        </Field>
        <Field label="Contact Person" required error={errors.contact_person}>
          <Input value={form.contact_person} onChange={e => set('contact_person', e.target.value)}
            placeholder="Contact name" className={`h-8 text-sm ${errors.contact_person ? 'border-destructive' : ''}`} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Contact Email">
          <Input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)}
            placeholder="email@oem.com" className="h-8 text-sm" />
        </Field>
        <Field label="Contact Phone">
          <Input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)}
            placeholder="+91-9876543210" className="h-8 text-sm" />
        </Field>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="maf_required" checked={form.maf_required}
          onChange={e => set('maf_required', e.target.checked)}
          className="size-3.5 rounded border-input accent-primary" />
        <label htmlFor="maf_required" className="text-xs text-foreground cursor-pointer">
          MAF / Authorization letter required
        </label>
      </div>
      <Field label="SLA Deadline">
        <Input type="date" value={form.sla_deadline} onChange={e => set('sla_deadline', e.target.value)} className="h-8 text-sm" />
      </Field>
    </motion.div>
  )
}

function DocumentFields({ form, set }) {
  const [newDoc, setNewDoc] = useState('')

  function addDoc() {
    if (!newDoc.trim()) return
    set('required_docs', [...(form.required_docs || []), newDoc.trim()])
    setNewDoc('')
  }
  function removeDoc(i) {
    set('required_docs', (form.required_docs || []).filter((_, idx) => idx !== i))
  }

  return (
    <motion.div key="document" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="space-y-3">
      <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
        <p className="text-xs font-medium text-blue-700">Document Collection Task</p>
        <p className="text-[11px] text-blue-600 mt-0.5">Cannot be completed until all required documents are uploaded.</p>
      </div>
      <Field label="Required Documents">
        <div className="space-y-2">
          {(form.required_docs || []).map((doc, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/50 border border-border group">
              <FileText className="size-3 text-blue-500 shrink-0" />
              <span className="text-xs text-foreground flex-1">{doc}</span>
              <button onClick={() => removeDoc(i)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all">
                <Trash2 className="size-3" />
              </button>
            </motion.div>
          ))}
          <div className="flex gap-1.5">
            <Input value={newDoc} onChange={e => setNewDoc(e.target.value)}
              placeholder="Add required document…" className="h-7 text-xs flex-1"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDoc() } }} />
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={addDoc} disabled={!newDoc.trim()}>
              <Plus className="size-3" />
            </Button>
          </div>
        </div>
      </Field>
      <Field label="SLA Deadline">
        <Input type="date" value={form.sla_deadline} onChange={e => set('sla_deadline', e.target.value)} className="h-8 text-sm" />
      </Field>
    </motion.div>
  )
}

// ── Main Dialog ──────────────────────────────────────────────────────────────
export function CreateTaskDialog({ bidId, open, onClose, onCreated }) {
  const [taskType, setTaskType] = useState('GENERAL')
  const [form, setForm] = useState({
    title: '', description: '', priority: 'MEDIUM',
    assigned_to: '', due_date: '', sla_deadline: '',
    // Approval
    approver_id: '',
    // OEM
    oem_name: '', contact_person: '', contact_email: '', contact_phone: '', maf_required: false,
    // Document
    required_docs: [],
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState([])

  useEffect(() => {
    if (open) {
      listUsers({ limit: 100 }).then(r => {
        if (r.ok) setUsers(Array.isArray(r.data?.users) ? r.data.users : [])
      })
      // Reset on open
      setForm({
        title: '', description: '', priority: 'MEDIUM',
        assigned_to: '', due_date: '', sla_deadline: '',
        approver_id: '', oem_name: '', contact_person: '',
        contact_email: '', contact_phone: '', maf_required: false,
        required_docs: [],
      })
      setErrors({})
      setTaskType('GENERAL')
    }
  }, [open])

  function set(field, value) {
    setForm(p => ({ ...p, [field]: value }))
    setErrors(p => ({ ...p, [field]: undefined }))
  }

  function validate() {
    const e = {}
    if (!form.title.trim()) e.title = 'Title is required'
    if (taskType === 'APPROVAL' && !form.approver_id) e.approver_id = 'Approver is required'
    if (taskType === 'OEM_COORDINATION') {
      if (!form.oem_name.trim()) e.oem_name = 'OEM name is required'
      if (!form.contact_person.trim()) e.contact_person = 'Contact person is required'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit(e) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const base = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority,
        assigned_to: form.assigned_to || undefined,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : undefined,
      }

      let res
      if (taskType === 'APPROVAL') {
        res = await createApprovalTask(bidId, {
          ...base,
          approver_id: form.approver_id,
          sla_deadline: form.sla_deadline ? new Date(form.sla_deadline).toISOString() : undefined,
        })
      } else if (taskType === 'OEM_COORDINATION') {
        res = await createOEMTask(bidId, {
          ...base,
          oem_name: form.oem_name,
          contact_person: form.contact_person,
          contact_email: form.contact_email || undefined,
          contact_phone: form.contact_phone || undefined,
          maf_required: form.maf_required,
          sla_deadline: form.sla_deadline ? new Date(form.sla_deadline).toISOString() : undefined,
        })
      } else if (taskType === 'DOCUMENT_COLLECTION') {
        res = await createDocumentTask(bidId, {
          ...base,
          required_docs: form.required_docs.length ? form.required_docs : undefined,
          sla_deadline: form.sla_deadline ? new Date(form.sla_deadline).toISOString() : undefined,
        })
      } else {
        res = await createTask(bidId, { ...base, task_type: taskType })
      }

      if (res.ok) {
        toast.success('Task created successfully')
        onCreated()
      } else {
        toast.error(res.error?.message ?? res.message ?? 'Failed to create task')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  const TypeIcon = TYPE_ICONS[taskType] ?? Briefcase

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-foreground/25 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.8 }}
            className="relative z-10 w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2.5">
                <div className={`size-7 rounded-lg border flex items-center justify-center ${TYPE_COLORS[taskType]}`}>
                  <TypeIcon className="size-3.5" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-foreground text-sm">Create Task</h3>
                  <p className="text-[11px] text-muted-foreground">{TASK_TYPE_LABELS[taskType]}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <X className="size-4" />
              </button>
            </div>

            {/* Task Type Picker */}
            <div className="px-5 pt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Task Type</p>
              <div className="grid grid-cols-5 gap-1.5">
                {TASK_TYPES.map(type => {
                  const Icon = TYPE_ICONS[type] ?? Briefcase
                  const active = taskType === type
                  return (
                    <button key={type} onClick={() => setTaskType(type)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-all ${
                        active ? TYPE_COLORS[type] + ' border-current shadow-sm' : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}>
                      <Icon className="size-3.5" />
                      <span className="text-[9px] font-medium leading-tight">{TASK_TYPE_LABELS[type]}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={submit} className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
              {/* Generic fields */}
              <Field label="Title" required error={errors.title}>
                <Input value={form.title} onChange={e => set('title', e.target.value)}
                  placeholder="e.g. Upload EMD Certificate"
                  className={`h-8 text-sm ${errors.title ? 'border-destructive' : ''}`} />
              </Field>

              <Field label="Description">
                <Textarea value={form.description} onChange={e => set('description', e.target.value)}
                  placeholder="Detailed instructions…" className="text-sm min-h-[60px] resize-none" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Priority">
                  <SelectButton value={form.priority} onChange={v => set('priority', v)}
                    options={PRIORITIES.map(p => ({ value: p, label: p }))}
                    valueLabel={<span className={`font-medium ${PRIORITY_COLORS_MAP[form.priority]}`}>{form.priority}</span>}
                  />
                </Field>
                <Field label="Due Date">
                  <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="h-8 text-sm" />
                </Field>
              </div>

              <Field label="Assign To">
                <SelectButton value={form.assigned_to} onChange={v => set('assigned_to', v)}
                  placeholder="Unassigned"
                  valueLabel={form.assigned_to ? (users.find(u => u.id === form.assigned_to)?.full_name ?? 'Selected') : 'Unassigned'}
                  options={[{ value: '', label: 'Unassigned' }, ...users.map(u => ({ value: u.id, label: u.full_name || u.username }))]}
                />
              </Field>

              {/* Type-specific extra fields */}
              <AnimatePresence mode="wait">
                {taskType === 'APPROVAL' && (
                  <ApprovalFields key="approval" form={form} set={set} errors={errors} users={users} />
                )}
                {taskType === 'OEM_COORDINATION' && (
                  <OEMFields key="oem" form={form} set={set} errors={errors} />
                )}
                {taskType === 'DOCUMENT_COLLECTION' && (
                  <DocumentFields key="document" form={form} set={set} />
                )}
              </AnimatePresence>
            </form>

            {/* Footer */}
            <div className="flex gap-2 px-5 pb-5">
              <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button size="sm" className="flex-1 gap-1.5" onClick={submit} disabled={loading}>
                {loading && <Loader2 className="size-3.5 animate-spin" />}
                Create Task
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
