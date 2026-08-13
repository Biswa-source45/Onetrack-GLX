import { useMemo, useState, useEffect } from 'react'
import { tokenStorage } from '../services/auth'

/**
 * Returns a reactive helper for checking the current user's
 * roles and permissions derived from the JWT payload / stored user profile.
 *
 * Usage:
 *   const { hasPermission, hasRole, user, primaryRole, secondaryRole, isAdmin } = usePermissions()
 *   if (hasPermission('user.view')) { ... }
 *   if (hasRole('SUPER_ADMIN'))     { ... }
 */
export function usePermissions() {
  const [currentUser, setCurrentUser] = useState(() => tokenStorage.getUser())

  // Keep state in sync if localStorage user is updated in another event/call
  useEffect(() => {
    const checkUser = () => {
      const u = tokenStorage.getUser()
      setCurrentUser(u)
    }

    window.addEventListener('storage', checkUser)
    window.addEventListener('onetrack_user_updated', checkUser)
    return () => {
      window.removeEventListener('storage', checkUser)
      window.removeEventListener('onetrack_user_updated', checkUser)
    }
  }, [])

  const user = currentUser

  const permissions = useMemo(
    () => new Set(Array.isArray(user?.permissions) ? user.permissions : []),
    [user]
  )

  const roles = useMemo(
    () => new Set(Array.isArray(user?.roles) ? user.roles : []),
    [user]
  )

  const primaryRole = Array.isArray(user?.roles) && user.roles.length > 0 ? user.roles[0] : 'USER'
  const secondaryRole = Array.isArray(user?.roles) && user.roles.length > 1 ? user.roles[1] : null
  const isAdmin = roles.has('SUPER_ADMIN') || roles.has('ADMIN') || permissions.has('admin.system')

  /**
   * Check if the user has a specific permission string (e.g. 'user.view').
   * Admin and Super Admin automatically inherit all permissions.
   */
  function hasPermission(permission) {
    if (isAdmin) return true
    return permissions.has(permission)
  }

  /**
   * Check if the user has ANY of the supplied permissions.
   */
  function hasAnyPermission(...perms) {
    if (isAdmin) return true
    return perms.some((p) => permissions.has(p))
  }

  /**
   * Check if the user has a specific role (e.g. 'SUPER_ADMIN').
   */
  function hasRole(role) {
    return roles.has(role)
  }

  return {
    user,
    roles,
    permissions,
    primaryRole,
    secondaryRole,
    isAdmin,
    hasPermission,
    hasAnyPermission,
    hasRole,
  }
}
