import { apiFetch } from './auth'

// Every call resolves to { ok, status, ...body }; network/parse failures resolve to
// { ok: false, error: { message } } so callers never need their own try/catch.
async function call(path, fallback, method, payload) {
  try {
    const init = method ? { method } : undefined
    if (init && payload !== undefined) init.body = JSON.stringify(payload)
    const res = await apiFetch(`/api/v1${path}`, init)
    const data = await res.json()
    return { ok: res.ok, status: res.status, ...data }
  } catch (err) {
    return { ok: false, error: { message: err?.message || fallback } }
  }
}

const cal = (id) => `/calendars/${id}`

// ── Working Calendars ────────────────────────────────────────────────────────

export const getDefaultCalendar = () => call('/calendars/default', 'Failed to fetch default calendar')
export const updateCalendar = (calendarId, payload) => call(cal(calendarId), 'Failed to update calendar', 'PUT', payload)

// ── Holidays ─────────────────────────────────────────────────────────────────

export const getHolidays = (calendarId, year) =>
  call(`${cal(calendarId)}/holidays${year ? `?year=${year}` : ''}`, 'Failed to fetch holidays')
export const createHoliday = (calendarId, payload) =>
  call(`${cal(calendarId)}/holidays`, 'Failed to create holiday', 'POST', payload)
export const updateHoliday = (calendarId, holidayId, payload) =>
  call(`${cal(calendarId)}/holidays/${holidayId}`, 'Failed to update holiday', 'PUT', payload)
export const deleteHoliday = (calendarId, holidayId) =>
  call(`${cal(calendarId)}/holidays/${holidayId}`, 'Failed to delete holiday', 'DELETE')

// ── Special Exceptions ───────────────────────────────────────────────────────

export const getExceptions = (calendarId) => call(`${cal(calendarId)}/exceptions`, 'Failed to fetch exceptions')
export const createException = (calendarId, payload) =>
  call(`${cal(calendarId)}/exceptions`, 'Failed to create exception', 'POST', payload)
export const deleteException = (calendarId, exceptionId) =>
  call(`${cal(calendarId)}/exceptions/${exceptionId}`, 'Failed to delete exception', 'DELETE')

// ── Google Calendar Sync ─────────────────────────────────────────────────────

export const getGoogleIntegration = (calendarId) =>
  call(`${cal(calendarId)}/google-sync`, 'Failed to fetch Google Calendar configuration')
export const configureGoogleIntegration = (calendarId, payload) =>
  call(`${cal(calendarId)}/google-sync`, 'Failed to configure Google Calendar', 'POST', payload)
export const triggerGoogleSync = (calendarId) =>
  call(`${cal(calendarId)}/google-sync/trigger`, 'Failed to run Google sync', 'POST')
export const getSyncLogs = (calendarId, limit = 20) =>
  call(`${cal(calendarId)}/google-sync/logs?limit=${limit}`, 'Failed to fetch sync history')

// ── Tender Deadline Engine ──────────────────────────────────────────────────

export const getTenderWorkingDeadline = (tenderId) =>
  call(`/tenders/${tenderId}/working-deadline`, 'Failed to calculate tender deadline')
export const updateChecklistPriority = (checklistId, payload) =>
  call(`/checklists/${checklistId}/priority`, 'Failed to update checklist priority', 'PUT', payload)
export const evaluateDeadlines = () =>
  call('/calendars/evaluate-deadlines', 'Failed to trigger deadline evaluation', 'POST')
export const triggerRedZoneNotification = (tenderId, force = false) =>
  call(`/bids/${tenderId}/trigger-red-zone-notification${force ? '?force=true' : ''}`, 'Failed to trigger Red Zone notification', 'POST')
