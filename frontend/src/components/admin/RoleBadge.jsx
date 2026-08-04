import React from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * V2 System Roles — exactly as defined in OneTrack_Migration.pdf
 */
const ROLE_CONFIG = {
  SUPER_ADMIN:   { label: 'Super Admin',   className: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800' },
  ADMIN:         { label: 'Admin',         className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800' },
  MANAGER:       { label: 'Manager',       className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800' },
  BID_EXECUTIVE: { label: 'Bid Executive', className: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-800' },
  PRE_SALES:     { label: 'Pre-Sales',     className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800' },
  FINANCE:       { label: 'Finance',       className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800' },
}

/**
 * Renders a styled role badge. Falls back gracefully for unknown roles.
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

export const ALL_ROLES = Object.keys(ROLE_CONFIG)
export const ROLE_LABELS = ROLE_CONFIG

