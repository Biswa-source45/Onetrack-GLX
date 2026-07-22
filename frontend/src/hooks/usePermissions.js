import { useMemo } from 'react'
import { tokenStorage } from '../services/auth'

/**
 * Returns a stable helper for checking the current user's
 * roles and permissions derived from the JWT payload stored in localStorage.
 *
 * Usage:
 *   const { hasPermission, hasRole, user } = usePermissions()
 *   if (hasPermission('user.view')) { ... }
 *   if (hasRole('SUPER_ADMIN'))     { ... }
 */
export function usePermissions() {
  const user = useMemo(() => tokenStorage.getUser(), [])

  const permissions = useMemo(
    () => new Set(Array.isArray(user?.permissions) ? user.permissions : []),
    [user]
  )

  const roles = useMemo(
    () => new Set(Array.isArray(user?.roles) ? user.roles : []),
    [user]
  )

  /**
   * Check if the user has a specific permission string (e.g. 'user.view').
   */
  function hasPermission(permission) {
    return permissions.has(permission)
  }

  /**
   * Check if the user has ANY of the supplied permissions.
   */
  function hasAnyPermission(...perms) {
    return perms.some((p) => permissions.has(p))
  }

  /**
   * Check if the user has a specific role (e.g. 'SUPER_ADMIN').
   */
  function hasRole(role) {
    return roles.has(role)
  }

  return { user, hasPermission, hasAnyPermission, hasRole }
}
