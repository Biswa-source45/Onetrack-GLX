import { uploadLeadDocument } from '../services/leads'

// Mirrors the backend's validateDocument allow-list (lead handler).
export const ACCEPTED_DOC_TYPES = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx'
export const MAX_DOC_BYTES = 25 * 1024 * 1024

export function formatBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

let rowSeq = 0
export const newCategoryRow = () => ({ key: ++rowSeq, category: '', files: [] })
export const emptyDocs = () => ({ bulk: [], rows: [newCategoryRow()] })

// Flattens the picker's state into one upload per file.
export function toUploadItems(docs) {
  return [
    ...docs.bulk.map((file) => ({ file, category: '' })),
    ...docs.rows.flatMap((r) => r.files.map((file) => ({ file, category: r.category.trim() }))),
  ]
}

// A categorised row with files but no type name would silently land as an
// uncategorised upload — block that instead.
export function validateDocs(docs) {
  return docs.rows.some((r) => r.files.length && !r.category.trim())
    ? 'Name the document type for every row that has files'
    : ''
}

// Uploads sequentially (one request per file) and reports progress;
// resolves to the items that failed, each with the server's reason.
export async function uploadAll(leadId, items, onProgress = () => {}) {
  const failed = []
  for (let i = 0; i < items.length; i++) {
    onProgress(i + 1, items.length)
    try {
      const res = await uploadLeadDocument(leadId, items[i].file, items[i].category)
      if (!res.ok) failed.push({ ...items[i], reason: res.error?.message || res.message || 'Upload failed' })
    } catch {
      failed.push({ ...items[i], reason: 'Network error' })
    }
  }
  return failed
}
