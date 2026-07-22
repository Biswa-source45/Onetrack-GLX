import { apiFetch } from './auth'

const BASE = '/api/v1'

// ── Create Task (generic, under a bid) ──────────────────────────────────────
export async function createTask(bidId, payload) {
  const res = await apiFetch(`${BASE}/bids/${bidId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Create Approval Task (typed endpoint) ───────────────────────────────────
export async function createApprovalTask(bidId, payload) {
  const res = await apiFetch(`${BASE}/bids/${bidId}/tasks/approval`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Create OEM Task (typed endpoint) ────────────────────────────────────────
export async function createOEMTask(bidId, payload) {
  const res = await apiFetch(`${BASE}/bids/${bidId}/tasks/oem`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Create Document Collection Task (typed endpoint) ────────────────────────
export async function createDocumentTask(bidId, payload) {
  const res = await apiFetch(`${BASE}/bids/${bidId}/tasks/document`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── List Tasks for a Bid ─────────────────────────────────────────────────────
export async function listTasks(bidId, { page = 1, limit = 50, status = '', priority = '', assigned_to = '', task_type = '', parent_only = false } = {}) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))
  if (status)      params.set('status', status)
  if (priority)    params.set('priority', priority)
  if (assigned_to) params.set('assigned_to', assigned_to)
  if (task_type)   params.set('task_type', task_type)
  if (parent_only) params.set('parent_only', 'true')

  const res = await apiFetch(`${BASE}/bids/${bidId}/tasks?${params.toString()}`)
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── My Tasks (cross-bid, assigned to current user) ──────────────────────────
export async function myTasks({ page = 1, limit = 50, status = '', priority = '', task_type = '', overdue = false } = {}) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))
  if (status)    params.set('status', status)
  if (priority)  params.set('priority', priority)
  if (task_type) params.set('task_type', task_type)
  if (overdue)   params.set('overdue', 'true')

  const res = await apiFetch(`${BASE}/me/tasks?${params.toString()}`)
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Get Task ─────────────────────────────────────────────────────────────────
export async function getTask(id) {
  const res = await apiFetch(`${BASE}/tasks/${id}`)
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Update Task ──────────────────────────────────────────────────────────────
export async function updateTask(id, payload) {
  const res = await apiFetch(`${BASE}/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Update Task Status ───────────────────────────────────────────────────────
export async function updateTaskStatus(id, status) {
  const res = await apiFetch(`${BASE}/tasks/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Assign Task ──────────────────────────────────────────────────────────────
export async function assignTask(id, assigned_to) {
  const res = await apiFetch(`${BASE}/tasks/${id}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ assigned_to }),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Delete / Cancel Task ─────────────────────────────────────────────────────
export async function deleteTask(id) {
  const res = await apiFetch(`${BASE}/tasks/${id}`, { method: 'DELETE' })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Submit Approval Decision ─────────────────────────────────────────────────
export async function submitApprovalDecision(taskId, decision, comment = '') {
  const res = await apiFetch(`${BASE}/tasks/${taskId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ decision, comment }),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Add OEM Follow-Up ────────────────────────────────────────────────────────
export async function addOEMFollowUp(taskId, payload) {
  const res = await apiFetch(`${BASE}/tasks/${taskId}/oem-followup`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Create Subtask ───────────────────────────────────────────────────────────
export async function createSubtask(parentId, payload) {
  const res = await apiFetch(`${BASE}/tasks/${parentId}/subtasks`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Get Subtasks ─────────────────────────────────────────────────────────────
export async function getSubtasks(parentId) {
  const res = await apiFetch(`${BASE}/tasks/${parentId}/subtasks`)
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Add Activity ─────────────────────────────────────────────────────────────
export async function addActivity(taskId, activity_type, activity_data) {
  const res = await apiFetch(`${BASE}/tasks/${taskId}/activities`, {
    method: 'POST',
    body: JSON.stringify({ activity_type, activity_data }),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── List Activities ──────────────────────────────────────────────────────────
export async function listActivities(taskId, { page = 1, limit = 50 } = {}) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))
  const res = await apiFetch(`${BASE}/tasks/${taskId}/activities?${params.toString()}`)
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Add Checklist Item ───────────────────────────────────────────────────────
export async function addChecklist(taskId, title, sort_order = 0) {
  const res = await apiFetch(`${BASE}/tasks/${taskId}/checklists`, {
    method: 'POST',
    body: JSON.stringify({ title, sort_order }),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Get Checklists ───────────────────────────────────────────────────────────
export async function getChecklists(taskId) {
  const res = await apiFetch(`${BASE}/tasks/${taskId}/checklists`)
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Toggle Checklist Item ────────────────────────────────────────────────────
export async function toggleChecklist(taskId, checklistId, is_done) {
  const res = await apiFetch(`${BASE}/tasks/${taskId}/checklists/${checklistId}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_done }),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Delete Checklist Item ────────────────────────────────────────────────────
export async function deleteChecklist(taskId, checklistId) {
  const res = await apiFetch(`${BASE}/tasks/${taskId}/checklists/${checklistId}`, {
    method: 'DELETE',
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const TASK_TYPES = [
  'GENERAL',
  'DOCUMENT_COLLECTION',
  'OEM_COORDINATION',
  'QUALIFICATION',
  'COMMERCIAL',
  'APPROVAL',
  'REVIEW',
  'SUBMISSION',
  'CHECKLIST',
  'CUSTOM',
]

export const TASK_TYPE_LABELS = {
  GENERAL:              'General',
  DOCUMENT_COLLECTION:  'Document Collection',
  OEM_COORDINATION:     'OEM Coordination',
  QUALIFICATION:        'Qualification',
  COMMERCIAL:           'Commercial',
  APPROVAL:             'Approval',
  REVIEW:               'Review',
  SUBMISSION:           'Submission',
  CHECKLIST:            'Checklist',
  CUSTOM:               'Custom',
}

export const TASK_TYPE_ICONS = {
  GENERAL:              '📋',
  DOCUMENT_COLLECTION:  '📄',
  OEM_COORDINATION:     '🏭',
  QUALIFICATION:        '✅',
  COMMERCIAL:           '💰',
  APPROVAL:             '🔏',
  REVIEW:               '🔍',
  SUBMISSION:           '📤',
  CHECKLIST:            '☑️',
  CUSTOM:               '⚙️',
}

export const TASK_STATUSES = [
  'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_EXTERNAL',
  'BLOCKED', 'UNDER_REVIEW', 'COMPLETED', 'CANCELLED', 'ESCALATED', 'REOPENED',
]

export const TASK_STATUS_COLORS = {
  OPEN:             'bg-slate-100 text-slate-600 border-slate-200',
  ASSIGNED:         'bg-blue-50 text-blue-700 border-blue-200',
  IN_PROGRESS:      'bg-indigo-50 text-indigo-700 border-indigo-200',
  WAITING_EXTERNAL: 'bg-amber-50 text-amber-700 border-amber-200',
  BLOCKED:          'bg-red-50 text-red-700 border-red-200',
  UNDER_REVIEW:     'bg-violet-50 text-violet-700 border-violet-200',
  COMPLETED:        'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED:        'bg-gray-100 text-gray-500 border-gray-200',
  ESCALATED:        'bg-orange-50 text-orange-700 border-orange-200',
  REOPENED:         'bg-yellow-50 text-yellow-700 border-yellow-200',
}

export const PRIORITY_COLORS = {
  LOW:      'bg-slate-100 text-slate-600 border-slate-200',
  MEDIUM:   'bg-blue-50 text-blue-700 border-blue-200',
  HIGH:     'bg-orange-50 text-orange-700 border-orange-200',
  CRITICAL: 'bg-red-50 text-red-700 border-red-200',
}

export const PRIORITY_DOT_COLORS = {
  LOW:      'bg-slate-400',
  MEDIUM:   'bg-blue-500',
  HIGH:     'bg-orange-500',
  CRITICAL: 'bg-red-500',
}

export const ACTIVITY_TYPE_LABELS = {
  COMMENT:          'commented',
  STATUS_CHANGED:   'changed status',
  ASSIGNED:         'assigned task',
  ATTACHMENT_ADDED: 'added attachment',
  CALL_LOGGED:      'logged a call',
  EMAIL_LOGGED:     'logged an email',
  ESCALATED:        'escalated task',
  DEADLINE_CHANGED: 'changed deadline',
  APPROVAL_GRANTED: 'approved',
  APPROVAL_REJECTED:'rejected',
  OEM_FOLLOW_UP:    'recorded OEM follow-up',
}

export const OEM_STATES = [
  'REQUEST_INITIATED',
  'FOLLOW_UP_PENDING',
  'RESPONSE_RECEIVED',
  'DOCUMENT_PENDING',
  'COMPLETED',
  'REJECTED',
  'ESCALATED',
]

export const OEM_STATE_LABELS = {
  REQUEST_INITIATED: 'Request Initiated',
  FOLLOW_UP_PENDING: 'Follow-Up Pending',
  RESPONSE_RECEIVED: 'Response Received',
  DOCUMENT_PENDING:  'Document Pending',
  COMPLETED:         'Completed',
  REJECTED:          'Rejected',
  ESCALATED:         'Escalated',
}
