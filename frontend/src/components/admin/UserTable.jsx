import React, { useState } from 'react'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Shield, KeyRound, Power, PowerOff, ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

import { UserAvatar } from './UserAvatar'
import { RoleBadge } from './RoleBadge'
import { updateUserStatus } from '../../services/users'

// ── Tiny helpers ─────────────────────────────────────────────────────────────
function formatDate(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function formatDateTime(isoString) {
  if (!isoString) return 'Never'
  return new Date(isoString).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Row Actions Menu (portal-less dropdown built with state) ──────────────────
function RowActions({ user, canEdit, canDeactivate, canAssignRole, onEdit, onRoles, onForceReset, onStatusChange }) {
  const [open, setOpen] = useState(false)

  function handleAction(fn) {
    setOpen(false)
    fn()
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen((v) => !v)}
        aria-label="User actions"
      >
        <MoreHorizontal className="size-4" />
      </Button>

      {open && (
        <>
          {/* click-away backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 w-48 rounded-lg border border-border bg-popover shadow-md py-1 text-sm text-popover-foreground">
            {canEdit && (
              <button
                className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-left"
                onClick={() => handleAction(onEdit)}
              >
                <Pencil className="size-3.5 text-muted-foreground" />
                Edit Profile
              </button>
            )}
            {canAssignRole && (
              <button
                className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-left"
                onClick={() => handleAction(onRoles)}
              >
                <Shield className="size-3.5 text-muted-foreground" />
                Roles & Permissions
              </button>
            )}
            {canEdit && (
              <button
                className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-left"
                onClick={() => handleAction(onForceReset)}
              >
                <KeyRound className="size-3.5 text-muted-foreground" />
                Force Password Reset
              </button>
            )}
            {canDeactivate && (
              <>
                <Separator className="my-1" />
                <button
                  className={`flex w-full items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-left
                    ${user.is_active ? 'text-destructive' : 'text-emerald-700'}`}
                  onClick={() => handleAction(() => onStatusChange(user, !user.is_active))}
                >
                  {user.is_active
                    ? <PowerOff className="size-3.5" />
                    : <Power className="size-3.5" />
                  }
                  {user.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Skeleton Row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="border-b border-border">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 w-full rounded-md bg-muted animate-pulse" />
        </td>
      ))}
    </tr>
  )
}

/**
 * UserTable
 *
 * Props:
 *   users          {object[]}
 *   loading        {boolean}
 *   total          {number}
 *   page           {number}
 *   limit          {number}
 *   totalPages     {number}
 *   onPageChange   {(page: number) => void}
 *   canEdit        {boolean}  — user.edit permission
 *   canDeactivate  {boolean}  — user.deactivate permission
 *   canAssignRole  {boolean}  — user.assign_role permission
 *   onEdit         {(user) => void}
 *   onRoles        {(user) => void}
 *   onForceReset   {(user) => void}
 *   onRefresh      {() => void}
 */
export function UserTable({
  users = [],
  loading = false,
  total = 0,
  page = 1,
  limit = 20,
  totalPages = 1,
  onPageChange,
  canEdit = false,
  canDeactivate = false,
  canAssignRole = false,
  onEdit,
  onRoles,
  onForceReset,
  onRefresh,
}) {
  const [togglingId, setTogglingId] = useState(null)

  async function handleStatusChange(user, newStatus) {
    setTogglingId(user.id)
    try {
      const result = await updateUserStatus(user.id, newStatus)
      if (result.ok && result.success) {
        toast.success(newStatus ? `@${user.username} activated` : `@${user.username} deactivated`)
        onRefresh?.()
      } else {
        toast.error(result.error?.message || 'Failed to update status')
      }
    } catch {
      toast.error('Network error.')
    } finally {
      setTogglingId(null)
    }
  }

  const hasActions = canEdit || canDeactivate || canAssignRole
  const start = (page - 1) * limit + 1
  const end   = Math.min(page * limit, total)

  return (
    <div className="flex flex-col gap-0">
      {/* ── Table ───────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                Employee Code
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                Department
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Roles
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">
                Last Login
              </th>
              {hasActions && (
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 && (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            )}

            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={hasActions ? 7 : 6} className="px-4 py-16 text-center text-muted-foreground">
                  <div className="space-y-1">
                    <p className="font-medium">No users found</p>
                    <p className="text-xs">Try adjusting your search or filters.</p>
                  </div>
                </td>
              </tr>
            )}

            {users.map((user) => (
              <tr
                key={user.id}
                className="border-b border-border hover:bg-muted/20 transition-colors"
              >
                {/* User identity */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar fullName={user.full_name} username={user.username} size="sm" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate max-w-[160px]">
                        {user.full_name || user.username}
                      </p>
                      <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                        @{user.username}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Employee code */}
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="font-mono text-xs text-muted-foreground">{user.employee_code}</span>
                </td>

                {/* Department */}
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-sm text-muted-foreground">{user.department || '—'}</span>
                </td>

                {/* Roles */}
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {(user.roles || []).slice(0, 2).map((role) => (
                      <RoleBadge key={role} role={role} />
                    ))}
                    {(user.roles || []).length > 2 && (
                      <Badge variant="outline" className="text-[11px] text-muted-foreground">
                        +{user.roles.length - 2}
                      </Badge>
                    )}
                  </div>
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  {togglingId === user.id ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="size-2 rounded-full bg-muted animate-pulse" />
                      Updating…
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className={`size-1.5 rounded-full flex-shrink-0 ${user.is_active ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
                      <span className={`text-xs font-medium ${user.is_active ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {user.force_password_change && (
                        <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-200 bg-amber-50 ml-1">
                          Pwd change
                        </Badge>
                      )}
                    </div>
                  )}
                </td>

                {/* Last login */}
                <td className="px-4 py-3 hidden xl:table-cell">
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(user.last_login_at)}
                  </span>
                </td>

                {/* Actions */}
                {hasActions && (
                  <td className="px-4 py-3 text-right">
                    <RowActions
                      user={user}
                      canEdit={canEdit}
                      canDeactivate={canDeactivate}
                      canAssignRole={canAssignRole}
                      onEdit={() => onEdit?.(user)}
                      onRoles={() => onRoles?.(user)}
                      onForceReset={() => onForceReset?.(user)}
                      onStatusChange={handleStatusChange}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ──────────────────────────────────────────── */}
      {total > 0 && (
        <div className="flex items-center justify-between px-1 pt-3">
          <p className="text-xs text-muted-foreground">
            Showing {start}–{end} of {total} users
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1 || loading}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-xs font-medium text-muted-foreground px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages || loading}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
