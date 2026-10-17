// "Alert users" tab: which users are ticked, what the confirm dialog says, how far a batch has got.
// The server decides who is eligible (see backend/internal/credmail); this only narrows the choice down.

/** A user who was mailed this kind before is greyed out and unticked until "include already alerted" is on. */
export const isAlerted = (row) => !!row.last_alerted_at

/** Ids ticked when the list first shows (or when the toggle changes): everyone not alerted before. */
export function defaultSelection(rows, includeAlerted) {
  return new Set(rows.filter((r) => includeAlerted || !isAlerted(r)).map((r) => r.id))
}

/** Switching "include already alerted" off must drop any alerted user that was ticked. */
export function pruneSelection(selected, rows, includeAlerted) {
  if (includeAlerted) return new Set(selected)
  const alerted = new Set(rows.filter(isAlerted).map((r) => r.id))
  return new Set([...selected].filter((id) => !alerted.has(id)))
}

export function toggleId(selected, id) {
  const next = new Set(selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

/**
 * What would be sent: counts and the request body. Kinds with nothing ticked are left out.
 * "temp" users are the ones an admin force-reset: the admin types the password they set, the server checks it
 * against the saved one and mails it. Passwords are only sent for ticked temp users.
 */
export function buildSend({ initialIds, resetIds, tempIds = new Set(), passwords = {}, sendInitial, sendReset, sendTemp = false, includeAlerted }) {
  const kinds = []
  const ids = []
  const typed = {}
  if (sendInitial && initialIds.size) { kinds.push('INITIAL'); ids.push(...initialIds) }
  if (sendTemp && tempIds.size) {
    kinds.push('TEMP_PASSWORD'); ids.push(...tempIds)
    for (const id of tempIds) typed[id] = passwords[id] ?? ''
  }
  if (sendReset && resetIds.size) { kinds.push('RESET_CONFIRM'); ids.push(...resetIds) }
  return {
    initialCount: kinds.includes('INITIAL') ? initialIds.size : 0,
    tempCount: kinds.includes('TEMP_PASSWORD') ? tempIds.size : 0,
    resetCount: kinds.includes('RESET_CONFIRM') ? resetIds.size : 0,
    payload: { kinds, user_ids: ids, include_alerted: includeAlerted, passwords: typed },
  }
}

/** Ticked temp users whose password box is still empty (the send must wait for them). */
export const missingPasswords = (tempIds, passwords) => [...tempIds].filter((id) => !String(passwords[id] ?? '').trim())

export const isFinished = (batch) => !!batch && batch.status !== 'RUNNING'

/** 0-100 for the progress bar; a batch of 0 counts as complete. */
export function batchPercent(batch) {
  if (!batch || !batch.total) return batch ? 100 : 0
  return Math.min(100, Math.round(((batch.sent + batch.failed) / batch.total) * 100))
}

export const KIND_LABEL = { INITIAL: 'Login details', TEMP_PASSWORD: 'Login details', RESET_CONFIRM: 'Password-reset confirmation' }
