// Who may use the EMD screens. One place, so the route, the sidebar, the EMD page, the dialog and the
// lifecycle card cannot disagree. This mirrors the server (bid/service isFinanceOrAdmin): EVERY change
// to an EMD (details, submit, payment, verify, refund) is Finance or Admin only, so those are the only
// roles that get edit controls. Account Managers may open the screens and read, nothing more.
export const EMD_EDIT_ROLES = [
  'FINANCE', 'FINANCE_MANAGER', 'FINANCE_EXECUTIVE',
  'MANAGING_DIRECTOR', 'ADMIN', 'SUPER_ADMIN',
]

export const EMD_VIEW_ROLES = [...EMD_EDIT_ROLES, 'ACCOUNT_MANAGER', 'SALES_MANAGER', 'ACCOUNTS_MANAGER']

/** hasRole is usePermissions().hasRole. */
export const canViewEmd = (hasRole) => EMD_VIEW_ROLES.some((r) => hasRole(r))
export const canEditEmd = (hasRole) => EMD_EDIT_ROLES.some((r) => hasRole(r))
