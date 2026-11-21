import { apiFetch } from './auth.js'

/**
 * Fetch chat messages for a specific tender from the backend PostgreSQL database.
 */
export async function getTenderChatMessages(bidId, { limit = 100, offset = 0 } = {}) {
  try {
    const res = await apiFetch(`/api/v1/bids/${bidId}/chat?limit=${limit}&offset=${offset}`)
    const json = await res.json().catch(() => ({}))
    return {
      ok: res.ok,
      status: res.status,
      data: Array.isArray(json.data) ? json.data : [],
      message: json.message || json.error?.message,
    }
  } catch (err) {
    console.error('Failed to fetch tender chat messages:', err)
    return { ok: false, data: [], error: err.message }
  }
}

/**
 * Send a new chat message for a tender to the backend.
 * @param {string} bidId
 * @param {Object} payload { content, message_type: 'CHAT'|'QUESTION'|'ANNOUNCEMENT', mentions: string[], attachments: [] }
 */
export async function sendTenderChatMessage(bidId, payload) {
  try {
    const res = await apiFetch(`/api/v1/bids/${bidId}/chat`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))
    return {
      ok: res.ok,
      status: res.status,
      data: json.data || null,
      message: json.message || json.error?.message,
    }
  } catch (err) {
    console.error('Failed to send tender chat message:', err)
    return { ok: false, error: err.message }
  }
}

/**
 * Fetch eligible team members and workspace owners that can be @mentioned for this tender.
 */
export async function getTenderChatMembers(bidId) {
  try {
    const res = await apiFetch(`/api/v1/bids/${bidId}/chat/members`)
    const json = await res.json().catch(() => ({}))
    return {
      ok: res.ok,
      status: res.status,
      data: Array.isArray(json.data) ? json.data : [],
      message: json.message || json.error?.message,
    }
  } catch (err) {
    console.error('Failed to fetch mentionable members:', err)
    return { ok: false, data: [], error: err.message }
  }
}
