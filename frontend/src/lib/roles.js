// Organisation roles -> the legacy roles whose behaviour they carry. Most of the
// app still gates on ADMIN / MANAGER / FINANCE / ...; usePermissions expands a
// user's roles through this map so those checks accept the organisation roles.
// Keep in sync with backend/internal/platform/roles/roles.go.
const ACTS_AS = {
  SOFTWARE_DEVELOPER: ['SUPER_ADMIN'],
  MANAGING_DIRECTOR: ['ADMIN'],
  REPORTING_MANAGER: ['MANAGER'],
  BID_MANAGER: ['MANAGER'],
  PRESALES_MANAGER: ['MANAGER', 'PRE_SALES'],
  SALES_MANAGER: ['ACCOUNT_MANAGER'],
  ACCOUNTS_MANAGER: ['ACCOUNT_MANAGER'],
  FINANCE_MANAGER: ['FINANCE'],
  FINANCE_EXECUTIVE: ['FINANCE'],
  DELIVERY_MANAGER: ['MANAGER'],
}

// View-only roles see what their legacy role sees but are never offered as an
// approver / assignee (writes are blocked by their permissions, not here).
const VIEW_ONLY = new Set(['DELIVERY_MANAGER'])

/** The held roles plus the legacy roles each one acts as; order kept, no duplicates. */
export function expandRoles(held) {
  const base = Array.isArray(held) ? held : []
  return [...new Set([...base, ...base.flatMap((r) => ACTS_AS[r] ?? [])])]
}

/**
 * True when the user holds one of `legacy` roles directly, or through a
 * non-view-only organisation role that acts as it. For picking people (Account
 * Manager, Pre-Sales, approvers) from a user list — not for the viewer's own
 * access, which usePermissions().hasRole covers.
 */
export function actsAs(user, ...legacy) {
  return (user?.roles ?? []).some(
    (r) => legacy.includes(r) || (!VIEW_ONLY.has(r) && (ACTS_AS[r] ?? []).some((l) => legacy.includes(l)))
  )
}
