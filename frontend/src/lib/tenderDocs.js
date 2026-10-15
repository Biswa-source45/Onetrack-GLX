// Mirrors the backend's validateTenderDoc allow-list (bid handler). The server
// checks the file's real bytes; this only saves a round trip for obvious mistakes.
export const ACCEPTED_TENDER_DOCS = '.pdf,.docx,.txt'
export const MAX_TENDER_DOC_BYTES = 25 * 1024 * 1024
export const DOC_NAME_PRESETS = ['RFP', 'ATC', 'Corrigendum', 'BOQ', 'Technical Specification', 'Commercial Terms', 'Addendum']
export const MAX_DOC_NAME = 60

export function formatBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

// Returns an error sentence, or '' when the file looks acceptable.
export function checkTenderDoc(file) {
  if (!file) return 'Choose a file'
  if (!/\.(pdf|docx|txt)$/i.test(file.name)) return 'Only PDF, DOCX or TXT files are allowed'
  if (file.size === 0) return 'The file is empty'
  if (file.size > MAX_TENDER_DOC_BYTES) return 'The file exceeds the 25 MB limit'
  return ''
}

// 'pdf' | 'docx' | 'txt' | '' from the stored name (the server only stores these three).
export function docKind(doc) {
  const m = /\.(pdf|docx|txt)$/i.exec(doc?.original_name || '')
  return m ? m[1].toLowerCase() : ''
}
