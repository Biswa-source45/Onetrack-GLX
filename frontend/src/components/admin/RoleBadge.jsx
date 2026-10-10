import React from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * V2 System Roles — defined in OneTrack RBAC architecture
 */
const ROLE_CONFIG = {
  // Organisation roles — the ones assigned from now on, in business-sheet order.
  MANAGING_DIRECTOR:  { label: 'Managing Director',  className: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/30 dark:text-fuchsia-400 dark:border-fuchsia-800' },
  ACCOUNTS_MANAGER:   { label: 'Accounts Manager',   className: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-800' },
  PRESALES_MANAGER:   { label: 'Presales Manager',   className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800' },
  SALES_MANAGER:      { label: 'Sales Manager',      className: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800' },
  REPORTING_MANAGER:  { label: 'Reporting Manager',  className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800' },
  BID_MANAGER:        { label: 'Bid Manager',        className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800' },
  BID_EXECUTIVE:      { label: 'Bid Executive',      className: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-800' },
  DELIVERY_MANAGER:   { label: 'Delivery Manager',   className: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800' },
  FINANCE_MANAGER:    { label: 'Finance Manager',    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800' },
  FINANCE_EXECUTIVE:  { label: 'Finance Executive',  className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800' },
  SOFTWARE_DEVELOPER: { label: 'Software Developer', className: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800' },
  // Legacy roles — still work, hidden from the role picker, reassigned over time.
  SUPER_ADMIN:   { label: 'Super Admin',   className: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800' },
  ADMIN:         { label: 'Admin',         className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800' },
  MANAGER:       { label: 'Manager (old)',       className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800' },
  ACCOUNT_MANAGER: { label: 'Account Manager (old)', className: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800' },
  PRE_SALES:     { label: 'Pre-Sales (old)', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800' },
  FINANCE:       { label: 'Finance (old)', className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800' },
}

/**
 * Renders a styled role badge with optional Primary / Secondary indicators.
 */
export function RoleBadge({ role, isPrimary, isSecondary, className }) {
  const config = ROLE_CONFIG[role] ?? { label: role, className: 'bg-neutral-100 text-neutral-600 border-neutral-200' }
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[11px] font-semibold tracking-wide border inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md shadow-2xs',
        config.className,
        className
      )}
    >
      {isPrimary && <span className="text-amber-500 font-bold text-xs leading-none">★</span>}
      <span>{config.label}</span>
      {isPrimary && (
        <span className="text-[9px] bg-primary/10 text-primary px-1 py-0.2 rounded font-medium tracking-tight">
          Primary
        </span>
      )}
      {isSecondary && (
        <span className="text-[9px] bg-muted text-muted-foreground px-1 py-0.2 rounded font-normal tracking-tight">
          Secondary
        </span>
      )}
    </Badge>
  )
}

export const ALL_ROLES = Object.keys(ROLE_CONFIG)
// What the create-user / role-assignment pickers offer: the 11 organisation roles.
export const ASSIGNABLE_ROLES = ALL_ROLES.slice(0, 11)
export const ROLE_LABELS = ROLE_CONFIG
