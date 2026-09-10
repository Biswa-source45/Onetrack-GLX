// Feedback Loop category list + color-coding. Colors are assigned
// deterministically from the category name (a hash into a fixed palette) —
// visually varied so categories are easy to tell apart at a glance, but
// stable: the same category is always the same color, never reshuffled on
// reload or when the list itself is reordered/extended.

export const TICKET_CATEGORIES = [
  'Tender Form (Add / Edit)',
  'Tender Metadata / Master Sheet',
  'Pricing & OEM Workspace',
  'EMD & Financials',
  'Checklist & Documents',
  'Stage Workflow & Approvals',
  'User & Role Management',
  'Reports & Analytics',
  'Login & Access',
  'Bug Report',
  'General Question',
  'Other',
]

const PALETTE = [
  { bg: 'bg-blue-100 dark:bg-blue-950/60',       text: 'text-blue-800 dark:text-blue-300',       border: 'border-blue-200 dark:border-blue-900' },
  { bg: 'bg-pink-100 dark:bg-pink-950/60',       text: 'text-pink-800 dark:text-pink-300',       border: 'border-pink-200 dark:border-pink-900' },
  { bg: 'bg-purple-100 dark:bg-purple-950/60',   text: 'text-purple-800 dark:text-purple-300',   border: 'border-purple-200 dark:border-purple-900' },
  { bg: 'bg-emerald-100 dark:bg-emerald-950/60', text: 'text-emerald-800 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-900' },
  { bg: 'bg-amber-100 dark:bg-amber-950/60',     text: 'text-amber-800 dark:text-amber-300',     border: 'border-amber-200 dark:border-amber-900' },
  { bg: 'bg-rose-100 dark:bg-rose-950/60',       text: 'text-rose-800 dark:text-rose-300',       border: 'border-rose-200 dark:border-rose-900' },
  { bg: 'bg-sky-100 dark:bg-sky-950/60',         text: 'text-sky-800 dark:text-sky-300',         border: 'border-sky-200 dark:border-sky-900' },
  { bg: 'bg-orange-100 dark:bg-orange-950/60',   text: 'text-orange-800 dark:text-orange-300',   border: 'border-orange-200 dark:border-orange-900' },
  { bg: 'bg-lime-100 dark:bg-lime-950/60',       text: 'text-lime-800 dark:text-lime-300',       border: 'border-lime-200 dark:border-lime-900' },
  { bg: 'bg-indigo-100 dark:bg-indigo-950/60',   text: 'text-indigo-800 dark:text-indigo-300',   border: 'border-indigo-200 dark:border-indigo-900' },
  { bg: 'bg-teal-100 dark:bg-teal-950/60',       text: 'text-teal-800 dark:text-teal-300',       border: 'border-teal-200 dark:border-teal-900' },
  { bg: 'bg-slate-100 dark:bg-slate-800/60',     text: 'text-slate-700 dark:text-slate-300',     border: 'border-slate-200 dark:border-slate-700' },
]

// categoryColor returns a stable {bg, text, border} Tailwind class set for
// a category label — same string always resolves to the same palette entry.
export function categoryColor(category) {
  const name = category || 'Other'
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

export const TICKET_STATUS_LABELS = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
}

export const TICKET_STATUS_CLASSES = {
  OPEN: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-900',
  IN_PROGRESS: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900',
  RESOLVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
}
