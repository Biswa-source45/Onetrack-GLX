import { apiFetch } from './auth'

// ── Working Calendars ────────────────────────────────────────────────────────

export async function getDefaultCalendar() {
  try {
    const res = await apiFetch('/api/v1/calendars/default')
    const data = await res.json()
    return { ok: res.ok, status: res.status, ...data }
  } catch (err) {
    return { ok: false, error: { message: err?.message || 'Failed to fetch default calendar' } }
  }
}

export async function updateCalendar(calendarId, payload) {
  try {
    const res = await apiFetch(`/api/v1/calendars/${calendarId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    return { ok: res.ok, status: res.status, ...data }
  } catch (err) {
    return { ok: false, error: { message: err?.message || 'Failed to update calendar' } }
  }
}

// ── Holidays ─────────────────────────────────────────────────────────────────

export async function getHolidays(calendarId, year) {
  try {
    const query = year ? `?year=${year}` : ''
    const res = await apiFetch(`/api/v1/calendars/${calendarId}/holidays${query}`)
    const data = await res.json()
    return { ok: res.ok, status: res.status, ...data }
  } catch (err) {
    return { ok: false, error: { message: err?.message || 'Failed to fetch holidays' } }
  }
}

export async function createHoliday(calendarId, payload) {
  try {
    const res = await apiFetch(`/api/v1/calendars/${calendarId}/holidays`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    return { ok: res.ok, status: res.status, ...data }
  } catch (err) {
    return { ok: false, error: { message: err?.message || 'Failed to create holiday' } }
  }
}

export async function updateHoliday(calendarId, holidayId, payload) {
  try {
    const res = await apiFetch(`/api/v1/calendars/${calendarId}/holidays/${holidayId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    return { ok: res.ok, status: res.status, ...data }
  } catch (err) {
    return { ok: false, error: { message: err?.message || 'Failed to update holiday' } }
  }
}

export async function deleteHoliday(calendarId, holidayId) {
  try {
    const res = await apiFetch(`/api/v1/calendars/${calendarId}/holidays/${holidayId}`, {
      method: 'DELETE',
    })
    const data = await res.json()
    return { ok: res.ok, status: res.status, ...data }
  } catch (err) {
    return { ok: false, error: { message: err?.message || 'Failed to delete holiday' } }
  }
}

// ── Special Exceptions ───────────────────────────────────────────────────────

export async function getExceptions(calendarId) {
  try {
    const res = await apiFetch(`/api/v1/calendars/${calendarId}/exceptions`)
    const data = await res.json()
    return { ok: res.ok, status: res.status, ...data }
  } catch (err) {
    return { ok: false, error: { message: err?.message || 'Failed to fetch exceptions' } }
  }
}

export async function createException(calendarId, payload) {
  try {
    const res = await apiFetch(`/api/v1/calendars/${calendarId}/exceptions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    return { ok: res.ok, status: res.status, ...data }
  } catch (err) {
    return { ok: false, error: { message: err?.message || 'Failed to create exception' } }
  }
}

export async function deleteException(calendarId, exceptionId) {
  try {
    const res = await apiFetch(`/api/v1/calendars/${calendarId}/exceptions/${exceptionId}`, {
      method: 'DELETE',
    })
    const data = await res.json()
    return { ok: res.ok, status: res.status, ...data }
  } catch (err) {
    return { ok: false, error: { message: err?.message || 'Failed to delete exception' } }
  }
}

// ── Google Calendar Sync ─────────────────────────────────────────────────────

export async function getGoogleIntegration(calendarId) {
  try {
    const res = await apiFetch(`/api/v1/calendars/${calendarId}/google-sync`)
    const data = await res.json()
    return { ok: res.ok, status: res.status, ...data }
  } catch (err) {
    return { ok: false, error: { message: err?.message || 'Failed to fetch Google Calendar configuration' } }
  }
}

export async function configureGoogleIntegration(calendarId, payload) {
  try {
    const res = await apiFetch(`/api/v1/calendars/${calendarId}/google-sync`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    return { ok: res.ok, status: res.status, ...data }
  } catch (err) {
    return { ok: false, error: { message: err?.message || 'Failed to configure Google Calendar' } }
  }
}

export async function triggerGoogleSync(calendarId) {
  try {
    const res = await apiFetch(`/api/v1/calendars/${calendarId}/google-sync/trigger`, {
      method: 'POST',
    })
    const data = await res.json()
    return { ok: res.ok, status: res.status, ...data }
  } catch (err) {
    return { ok: false, error: { message: err?.message || 'Failed to run Google sync' } }
  }
}

export async function getSyncLogs(calendarId, limit = 20) {
  try {
    const res = await apiFetch(`/api/v1/calendars/${calendarId}/google-sync/logs?limit=${limit}`)
    const data = await res.json()
    return { ok: res.ok, status: res.status, ...data }
  } catch (err) {
    return { ok: false, error: { message: err?.message || 'Failed to fetch sync history' } }
  }
}

// ── Tender Deadline Engine ──────────────────────────────────────────────────

export async function getTenderWorkingDeadline(tenderId) {
  try {
    const res = await apiFetch(`/api/v1/tenders/${tenderId}/working-deadline`)
    const data = await res.json()
    return { ok: res.ok, status: res.status, ...data }
  } catch (err) {
    return { ok: false, error: { message: err?.message || 'Failed to calculate tender deadline' } }
  }
}

export async function updateChecklistPriority(checklistId, payload) {
  try {
    const res = await apiFetch(`/api/v1/checklists/${checklistId}/priority`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    return { ok: res.ok, status: res.status, ...data }
  } catch (err) {
    return { ok: false, error: { message: err?.message || 'Failed to update checklist priority' } }
  }
}

export async function evaluateDeadlines() {
  try {
    const res = await apiFetch('/api/v1/calendars/evaluate-deadlines', {
      method: 'POST',
    })
    const data = await res.json()
    return { ok: res.ok, status: res.status, ...data }
  } catch (err) {
    return { ok: false, error: { message: err?.message || 'Failed to trigger deadline evaluation' } }
  }
}

export async function triggerRedZoneNotification(tenderId, force = false) {
  try {
    const res = await apiFetch(`/api/v1/bids/${tenderId}/trigger-red-zone-notification${force ? '?force=true' : ''}`, {
      method: 'POST',
    })
    const data = await res.json()
    return { ok: res.ok, status: res.status, ...data }
  } catch (err) {
    return { ok: false, error: { message: err?.message || 'Failed to trigger Red Zone notification' } }
  }
}

