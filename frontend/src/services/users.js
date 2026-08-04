import { apiFetch } from './auth'

// ── List Users ──────────────────────────────────────────────────────────────
// GET /api/v1/users?page=&limit=&search=&role=&is_active=&department=
export async function listUsers({ page = 1, limit = 20, search = '', role = '', is_active = '', department = '' } = {}) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))
  if (search)     params.set('search', search)
  if (role)       params.set('role', role)
  if (is_active !== '') params.set('is_active', String(is_active))
  if (department) params.set('department', department)

  const res = await apiFetch(`/api/v1/users?${params.toString()}`)
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Create User ─────────────────────────────────────────────────────────────
// POST /api/v1/users
// Required: employee_code, full_name, username, password, roles[]
// Optional: email, phone, department
export async function createUser(payload) {
  const res = await apiFetch('/api/v1/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Get User by ID ───────────────────────────────────────────────────────────
// GET /api/v1/users/{id}
export async function getUserById(id) {
  const res = await apiFetch(`/api/v1/users/${id}`)
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Get Own Profile ──────────────────────────────────────────────────────────
// GET /api/v1/users/me
export async function getMyProfile() {
  const res = await apiFetch('/api/v1/users/me')
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Update User Profile ──────────────────────────────────────────────────────
// PATCH /api/v1/users/{id}
// Updatable: full_name, email, phone, department
export async function updateUserProfile(id, payload) {
  const res = await apiFetch(`/api/v1/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Update User Status ───────────────────────────────────────────────────────
// PATCH /api/v1/users/{id}/status
// payload: { is_active: boolean }
export async function updateUserStatus(id, isActive) {
  const res = await apiFetch(`/api/v1/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: isActive }),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Update User Roles ────────────────────────────────────────────────────────
// PATCH /api/v1/users/{id}/roles
// payload: { roles: string[] }  — FULL REPLACEMENT, min 1 role
export async function updateUserRoles(id, roles) {
  const res = await apiFetch(`/api/v1/users/${id}/roles`, {
    method: 'PATCH',
    body: JSON.stringify({ roles }),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Update Permission Overrides ──────────────────────────────────────────────
// PATCH /api/v1/users/{id}/permissions
// payload: { allow: string[], deny: string[] }  — FULL REPLACEMENT
export async function updateUserPermissions(id, { allow = [], deny = [] } = {}) {
  const res = await apiFetch(`/api/v1/users/${id}/permissions`, {
    method: 'PATCH',
    body: JSON.stringify({ allow, deny }),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Force Password Reset ─────────────────────────────────────────────────────
// PATCH /api/v1/auth/force-reset
// Requires user.edit permission on the calling user
export async function forcePasswordReset(userId, newPassword) {
  const res = await apiFetch('/api/v1/auth/force-reset', {
    method: 'PATCH',
    body: JSON.stringify({ user_id: userId, new_password: newPassword }),
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}

// ── Delete User (Permanent) ───────────────────────────────────────────────────
// DELETE /api/v1/users/{id}
// Requires user.deactivate permission. Nullifies FK audit records (stage history preserved).
export async function deleteUser(id) {
  const res = await apiFetch(`/api/v1/users/${id}`, {
    method: 'DELETE',
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, ...data }
}
