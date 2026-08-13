import React, { useState } from 'react'
import { toast } from 'sonner'
import {
  MoreHorizontal, Pencil, Shield, KeyRound, Power, PowerOff,
  ChevronLeft, ChevronRight, Trash2, AlertTriangle
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

import { UserAvatar } from './UserAvatar'
import { RoleBadge } from './RoleBadge'
import { updateUserStatus, deleteUser } from '../../services/users'
import { tokenStorage } from '../../services/auth'

// ── Tiny helpers ─────────────────────────────────────────────────────────────
function formatDateTime(isoString) {
  if (!isoString) return 'Never'
  return new Date(isoString).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Delete Confirmation Dialog ────────────────────────────────────────────────
function DeleteConfirmDialog({ user, onClose, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-foreground/20 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 8 }}
        className="relative z-10 w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="size-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">Delete User Account</h3>
            <p className="text-xs text-muted-foreground">This action is permanent and cannot be undone.</p>
          </div>
        </div>

        <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 space-y-1">
          <p className="text-sm font-medium text-foreground">{user.full_name || user.username}</p>
          <p className="text-xs text-muted-foreground">@{user.username} · {user.employee_code}</p>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Deleting this user will permanently remove their account.
          All <strong>tender stage history and audit records will be preserved</strong> with a reference to "deleted user".
          Bid ownership will be unassigned.
        </p>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <span className="size-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />}
            Delete User
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Row Actions Menu ──────────────────────────────────────────────────────────
function RowActions({ user, canEdit, canDeactivate, canAssignRole, onEdit, onRoles, onForceReset, onStatusChange, onDelete }) {
  const [open, setOpen] = useState(false)
  const currentUser = tokenStorage.getUser()
  const isSelf = currentUser?.id === user.id || currentUser?.username === user.username
  const isSadmin = user.username === 'Sadmin'

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
          <div className="absolute right-0 top-8 z-20 w-52 rounded-lg border border-border bg-popover shadow-lg py-1 text-sm text-popover-foreground">
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
                Roles &amp; Permissions
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
            {canDeactivate && !isSelf && (
              <>
                <Separator className="my-1" />
                <button
                  className={`flex w-full items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-left
                    ${user.is_active ? 'text-amber-600' : 'text-emerald-700'}`}
                  onClick={() => handleAction(() => onStatusChange(user, !user.is_active))}
                >
                  {user.is_active
                    ? <PowerOff className="size-3.5" />
                    : <Power className="size-3.5" />
                  }
                  {user.is_active ? 'Deactivate' : 'Activate'}
                </button>
                {!isSadmin && (
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-left text-destructive"
                    onClick={() => handleAction(onDelete)}
                  >
                    <Trash2 className="size-3.5" />
                    Delete User
                  </button>
                )}
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
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

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

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const result = await deleteUser(deleteTarget.id)
      if (result.ok) {
        toast.success(`User @${deleteTarget.username} deleted successfully`)
        setDeleteTarget(null)
        onRefresh?.()
      } else {
        toast.error(result.error?.message || 'Failed to delete user')
      }
    } catch {
      toast.error('Network error.')
    } finally {
      setDeleting(false)
    }
  }

  const hasActions = canEdit || canDeactivate || canAssignRole
  const start = (page - 1) * limit + 1
  const end   = Math.min(page * limit, total)

  return (
    <>
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
                  Emp. Code
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
                    <div className="flex flex-wrap gap-1.5 max-w-[240px]">
                      {(user.roles || []).slice(0, 2).map((role, idx) => (
                        <RoleBadge
                          key={role}
                          role={role}
                          isPrimary={idx === 0}
                          isSecondary={idx === 1}
                        />
                      ))}
                      {(user.roles || []).length === 0 && (
                        <span className="text-xs text-muted-foreground italic">No roles</span>
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
                        <span className={`text-xs font-medium ${user.is_active ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {user.force_password_change && (
                          <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-200 bg-amber-50 ml-1">
                            Pwd reset
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
                        onDelete={() => setDeleteTarget(user)}
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

      {/* ── Delete Confirmation Dialog ────────────────────────────── */}
      <AnimatePresence>
        {deleteTarget && (
          <DeleteConfirmDialog
            user={deleteTarget}
            loading={deleting}
            onClose={() => !deleting && setDeleteTarget(null)}
            onConfirm={handleDelete}
          />
        )}
      </AnimatePresence>
    </>
  )
}
