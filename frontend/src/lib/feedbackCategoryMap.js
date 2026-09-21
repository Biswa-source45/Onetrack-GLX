// Best-effort category guess for the Ctrl+I screenshot capture — matched
// against TICKET_CATEGORIES (ticketCategories.js). Always editable in the
// form either way, so an unmatched page just resolves to '' (nothing
// pre-selected) rather than guessing wrong.

// Tender detail page sub-tabs carry their own stage in ?stage=, which maps
// far more precisely than the shared /tenders/:bidId path ever could.
const STAGE_CATEGORY_MAP = {
  PRICING_REQUEST: 'Pricing & OEM Workspace',
  OEM_AUTHORIZATION_REQUEST: 'Pricing & OEM Workspace',
  EMD_PROCESSING: 'EMD & Financials',
  DOCUMENT_CHECKLIST_PREPARATION: 'Checklist & Documents',
  INTERNAL_APPROVAL: 'Stage Workflow & Approvals',
  GEM_SUBMISSION: 'Stage Workflow & Approvals',
}

// Ordered longest-prefix-first so a more specific route (tenders/master)
// wins over a shorter one that would also match (tenders).
const PATH_CATEGORY_MAP = [
  ['/dashboard/tenders/master', 'Tender Metadata / Master Sheet'],
  ['/dashboard/tenders/new', 'Tender Form (Add / Edit)'],
  ['/dashboard/tenders/owned', 'Tender Form (Add / Edit)'],
  ['/dashboard/analytics', 'Reports & Analytics'],
  ['/dashboard/bulk-import', 'Tender Metadata / Master Sheet'],
  ['/dashboard/users', 'User & Role Management'],
  ['/dashboard/tenders', 'Tender Form (Add / Edit)'],
]

export function guessFeedbackCategory(pathname, search) {
  const stage = new URLSearchParams(search).get('stage')
  if (stage && STAGE_CATEGORY_MAP[stage]) return STAGE_CATEGORY_MAP[stage]

  for (const [prefix, category] of PATH_CATEGORY_MAP) {
    if (pathname.startsWith(prefix)) return category
  }
  return ''
}
