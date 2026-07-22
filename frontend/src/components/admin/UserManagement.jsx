import React, { useState, useEffect, useCallback } from 'react'
import { Search, UserPlus, RefreshCw, Users, X, ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

import { usePermissions } from '../../hooks/usePermissions'
import { listUsers } from '../../services/users'

import { UserTable }              from './UserTable'
import { CreateUserSheet }        from './CreateUserSheet'
import { EditUserDialog }         from './EditUserDialog'
import { RolesPermissionsDialog } from './RolesPermissionsDialog'
import { ForceResetDialog }       from './ForceResetDialog'
import { ALL_ROLES, ROLE_LABELS } from './RoleBadge'

const LIMIT = 20

// ── Simple debounce hook ──────────────────────────────────────────────────────
function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/**
 * UserManagement — the full Admin panel view.
 *
 * This component is only rendered when the logged-in user has the
 * `user.view` permission (enforced by the parent Dashboard).
 */
export function UserManagement() {
  const { hasPermission } = usePermissions()

  // ── Permission flags (derived from JWT payload, never hardcoded) ──────────
  const canCreate     = hasPermission('user.create')
  const canEdit       = hasPermission('user.edit')
  const canDeactivate = hasPermission('user.deactivate')
  const canAssignRole = hasPermission('user.assign_role')

  // ── Filter / search state ────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('')
  const [roleFilter, setRoleFilter]   = useState('')
  const [activeFilter, setActiveFilter] = useState('') // '' | 'true' | 'false'
  const debouncedSearch = useDebounce(searchInput)

  // ── Pagination ────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1)

  // ── Data state ────────────────────────────────────────────────────────────
  const [users, setUsers]           = useState([])
  const [total, setTotal]           = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading]       = useState(false)
  const [fetchError, setFetchError] = useState(null)

  // ── Dialog state ─────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen]       = useState(false)
  const [editUser, setEditUser]           = useState(null) // user object | null
  const [rolesUser, setRolesUser]         = useState(null)
  const [resetUser, setResetUser]         = useState(null)

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async (options = {}) => {
    setLoading(true)
    setFetchError(null)
    try {
      const result = await listUsers({
        page:      options.page      ?? page,
        limit:     LIMIT,
        search:    options.search    ?? debouncedSearch,
        role:      options.role      ?? roleFilter,
        is_active: options.is_active ?? activeFilter,
      })

      if (result.ok && result.success) {
        setUsers(result.data.users ?? [])
        setTotal(result.data.total ?? 0)
        setTotalPages(result.data.total_pages ?? 1)
      } else {
        setFetchError(result.error?.message || 'Failed to load users')
        setUsers([])
      }
    } catch {
      setFetchError('Network error. Could not reach the server.')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, roleFilter, activeFilter])

  // Refetch whenever filters or page changes
  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, roleFilter, activeFilter])

  function handleRefresh() {
    fetchUsers({ page })
  }

  function clearFilters() {
    setSearchInput('')
    setRoleFilter('')
    setActiveFilter('')
    setPage(1)
  }

  const hasActiveFilters = searchInput || roleFilter || activeFilter !== ''

  return (
    <div className="space-y-6">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold text-foreground flex items-center gap-2">
            <Users className="size-5 text-primary" />
            User Management
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total > 0 ? `${total} user${total !== 1 ? 's' : ''} in the system` : 'Manage system users and permissions'}
          </p>
        </div>

        {canCreate && (
          <Button
            onClick={() => setCreateOpen(true)}
            className="self-start sm:self-auto gap-1.5"
          >
            <UserPlus className="size-4" />
            Add User
          </Button>
        )}
      </div>

      <Separator />

      {/* ── Filters Bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

        {/* Search */}
        <div className="relative flex-1 min-w-0 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            id="um-search"
            placeholder="Search by name, username, or code…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Role filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button id="um-role-filter" variant="outline" size="sm" className="h-9 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5 min-w-[130px]">
              <span>{roleFilter ? (ROLE_LABELS[roleFilter]?.label ?? roleFilter) : 'All Roles'}</span>
              <ChevronDown className="size-3 text-muted-foreground ml-auto" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[150px]">
            <DropdownMenuLabel>Filter by Role</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setRoleFilter('')}>
              All Roles
            </DropdownMenuItem>
            {ALL_ROLES.map((role) => (
              <DropdownMenuItem key={role} onSelect={() => setRoleFilter(role)}>
                {ROLE_LABELS[role]?.label ?? role}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Status filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button id="um-status-filter" variant="outline" size="sm" className="h-9 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5 min-w-[130px]">
              <span>{activeFilter === 'true' ? 'Active' : activeFilter === 'false' ? 'Inactive' : 'All Status'}</span>
              <ChevronDown className="size-3 text-muted-foreground ml-auto" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[150px]">
            <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setActiveFilter('')}>
              All Status
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setActiveFilter('true')}>
              Active
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setActiveFilter('false')}>
              Inactive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Refresh */}
        <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading} aria-label="Refresh">
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
            <X className="size-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Active filter indicators */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {searchInput && (
            <Badge variant="secondary" className="gap-1 text-xs">
              Search: "{searchInput}"
              <button onClick={() => setSearchInput('')}><X className="size-3" /></button>
            </Badge>
          )}
          {roleFilter && (
            <Badge variant="secondary" className="gap-1 text-xs">
              Role: {ROLE_LABELS[roleFilter]?.label ?? roleFilter}
              <button onClick={() => setRoleFilter('')}><X className="size-3" /></button>
            </Badge>
          )}
          {activeFilter !== '' && (
            <Badge variant="secondary" className="gap-1 text-xs">
              Status: {activeFilter === 'true' ? 'Active' : 'Inactive'}
              <button onClick={() => setActiveFilter('')}><X className="size-3" /></button>
            </Badge>
          )}
        </div>
      )}

      {/* ── Error State ──────────────────────────────────────────────────── */}
      {fetchError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center justify-between">
          <span>{fetchError}</span>
          <Button size="sm" variant="outline" onClick={handleRefresh}>Retry</Button>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <UserTable
        users={users}
        loading={loading}
        total={total}
        page={page}
        limit={LIMIT}
        totalPages={totalPages}
        onPageChange={(p) => setPage(p)}
        canEdit={canEdit}
        canDeactivate={canDeactivate}
        canAssignRole={canAssignRole}
        onEdit={(user) => setEditUser(user)}
        onRoles={(user) => setRolesUser(user)}
        onForceReset={(user) => setResetUser(user)}
        onRefresh={handleRefresh}
      />

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      {canCreate && (
        <CreateUserSheet
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={() => { setPage(1); handleRefresh() }}
        />
      )}

      {canEdit && (
        <EditUserDialog
          open={!!editUser}
          onOpenChange={(v) => !v && setEditUser(null)}
          user={editUser}
          onUpdated={handleRefresh}
        />
      )}

      {canAssignRole && (
        <RolesPermissionsDialog
          open={!!rolesUser}
          onOpenChange={(v) => !v && setRolesUser(null)}
          user={rolesUser}
          onUpdated={handleRefresh}
        />
      )}

      {canEdit && (
        <ForceResetDialog
          open={!!resetUser}
          onOpenChange={(v) => !v && setResetUser(null)}
          user={resetUser}
          onDone={handleRefresh}
        />
      )}
    </div>
  )
}
