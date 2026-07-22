import React from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * All roles that exist in the system (from DB seed + API docs).
 * Maps role name → display label + visual style class.
 */
const ROLE_CONFIG = {
  SUPER_ADMIN:  { label: 'Super Admin',  className: 'bg-violet-50 text-violet-700 border-violet-200' },
  ADMIN:        { label: 'Admin',        className: 'bg-blue-50 text-blue-700 border-blue-200' },
  BID_MANAGER:  { label: 'Bid Manager',  className: 'bg-sky-50 text-sky-700 border-sky-200' },
  BID_OWNER:    { label: 'Bid Owner',    className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  REVIEWER:     { label: 'Reviewer',     className: 'bg-amber-50 text-amber-700 border-amber-200' },
  FINANCE:      { label: 'Finance',      className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  MANAGEMENT:   { label: 'Management',   className: 'bg-orange-50 text-orange-700 border-orange-200' },
  OPERATOR:     { label: 'Operator',     className: 'bg-neutral-100 text-neutral-600 border-neutral-200' },
}

/**
 * Renders a styled role badge. Falls back gracefully for unknown roles.
 *
 * @param {string} role - e.g. 'BID_MANAGER'
 * @param {string} [className]
 */
export function RoleBadge({ role, className }) {
  const config = ROLE_CONFIG[role] ?? { label: role, className: 'bg-neutral-100 text-neutral-600 border-neutral-200' }
  return (
    <Badge
      variant="outline"
      className={cn('text-[11px] font-semibold tracking-wide border', config.className, className)}
    >
      {config.label}
    </Badge>
  )
}

/**
 * Exported constants so other components can reference the
 * complete list of system roles without duplicating them.
 */
export const ALL_ROLES = Object.keys(ROLE_CONFIG)
export const ROLE_LABELS = ROLE_CONFIG
