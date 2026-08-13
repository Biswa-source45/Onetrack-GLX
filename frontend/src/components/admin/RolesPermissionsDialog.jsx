import React, { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  ShieldCheck, Loader2, Info, Check, Sparkles, Shield,
  ArrowLeftRight, Star, AlertCircle, CheckCircle2
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { updateUserRoles } from '../../services/users'
import { ALL_ROLES } from './RoleBadge'
import { ROLE_DETAILS } from './permissionMetaData'

/**
 * Interactive Info Tooltip for Role cards
 */
function RoleInfoButton({ title, summary, description }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="p-1 rounded-md text-muted-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
            aria-label="Role Details"
          >
            <Info className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="end"
          sideOffset={6}
          className="w-72 p-3 bg-popover border border-border text-popover-foreground shadow-2xl rounded-xl space-y-1.5 text-left z-[200]"
        >
          <p className="font-bold text-xs text-foreground">{title}</p>
          {summary && <p className="text-[11px] font-semibold text-primary">{summary}</p>}
          <p className="text-[11px] text-muted-foreground leading-relaxed font-normal">
            {description}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function RolesPermissionsDialog({ open, onOpenChange, user, onUpdated }) {
  // Ordered array of selected roles: index 0 is Primary, index 1 (if present) is Secondary
  const [selectedRoles, setSelectedRoles] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      const userRoles = Array.isArray(user.roles) ? [...user.roles] : []
      // Enforce max 2 roles if incoming user had more
      setSelectedRoles(userRoles.slice(0, 2))
    }
  }, [user])

  function handleClose(val) {
    if (!loading) onOpenChange(val)
  }

  function handleToggleRole(role) {
    const isAlreadySelected = selectedRoles.includes(role)

    if (isAlreadySelected) {
      // Remove the role
      setSelectedRoles((prev) => prev.filter((r) => r !== role))
    } else {
      // Check limit of 2 roles
      if (selectedRoles.length >= 2) {
        toast.warning('Maximum 2 roles allowed per user (1 Primary + 1 Secondary).')
        return
      }
      // Add as secondary if primary already exists
      setSelectedRoles((prev) => [...prev, role])
    }
  }

  function handleSetAsPrimary(role) {
    if (!selectedRoles.includes(role)) return
    if (selectedRoles[0] === role) return // Already primary

    // Put this role first, and the other as secondary
    const remaining = selectedRoles.filter((r) => r !== role)
    setSelectedRoles([role, ...remaining])
    toast.info(`Designated ${ROLE_DETAILS[role]?.label || role} as Primary role.`)
  }

  function handleSwapRoles() {
    if (selectedRoles.length === 2) {
      setSelectedRoles([selectedRoles[1], selectedRoles[0]])
      toast.info('Primary and Secondary roles swapped.')
    }
  }

  async function handleSave() {
    if (selectedRoles.length === 0) {
      toast.error('Please assign at least one role to the user.')
      return
    }

    if (selectedRoles.length > 2) {
      toast.error('A user cannot have more than 2 roles.')
      return
    }

    setLoading(true)
    try {
      // Save ordered roles: [primaryRole, secondaryRole?]
      const result = await updateUserRoles(user.id, selectedRoles)
      if (result.ok && result.success) {
        toast.success(`Roles updated for ${user.full_name || user.username}`)
        window.dispatchEvent(new Event('onetrack_user_updated'))
        onUpdated?.()
        handleClose(false)
      } else {
        toast.error(result.error?.message || 'Failed to update user roles')
      }
    } catch {
      toast.error('Network error occurred while saving roles.')
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  const primaryRole = selectedRoles[0] || null
  const secondaryRole = selectedRoles[1] || null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:max-w-2xl md:max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border-border bg-card shadow-2xl">
        {/* Modal Header */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border/80 bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <ShieldCheck className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2 truncate">
                Role & Access Assignment
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate mt-0.5">
                Configure Primary and Secondary operational roles for{' '}
                <span className="font-semibold text-foreground">
                  {user.full_name || user.username} (@{user.username})
                </span>
              </DialogDescription>
            </div>
            <Badge variant="outline" className="text-[11px] font-semibold border-primary/30 text-primary bg-primary/5 hidden sm:inline-flex">
              Max 2 Roles Enforced
            </Badge>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 max-h-[calc(92vh-130px)]">
          {/* Primary / Secondary Designation Summary Card */}
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-amber-500 shrink-0" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                  Assigned Role Configuration ({selectedRoles.length}/2)
                </span>
              </div>

              {selectedRoles.length === 2 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSwapRoles}
                  className="h-7 text-xs font-medium gap-1.5 border-primary/30 text-primary hover:bg-primary/10 self-start sm:self-auto shadow-2xs"
                >
                  <ArrowLeftRight className="size-3" />
                  Swap Primary & Secondary
                </Button>
              )}
            </div>

            {selectedRoles.length === 0 ? (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-amber-300 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 text-xs">
                <AlertCircle className="size-4 shrink-0" />
                <span>No roles currently selected. Select at least 1 role below to assign access privileges.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Primary Role Box */}
                <div className="p-3 rounded-xl border border-amber-300/80 bg-amber-50/70 dark:bg-amber-950/25 dark:border-amber-700/50 relative">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[11px] font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1 uppercase tracking-wider">
                      <Star className="size-3.5 fill-amber-500 text-amber-500" /> Primary Role
                    </span>
                    <Badge variant="outline" className="text-[9px] font-semibold border-amber-300 dark:border-amber-700 bg-white/70 dark:bg-amber-900/40 text-amber-900 dark:text-amber-300">
                      Profile Display & Lead
                    </Badge>
                  </div>
                  <div className="text-xs font-bold text-foreground mt-1">
                    {ROLE_DETAILS[primaryRole]?.label || primaryRole}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                    {ROLE_DETAILS[primaryRole]?.summary || 'Primary operational responsibility'}
                  </p>
                </div>

                {/* Secondary Role Box */}
                <div className={`p-3 rounded-xl border transition-all ${
                  secondaryRole
                    ? 'border-blue-300/80 bg-blue-50/70 dark:bg-blue-950/25 dark:border-blue-700/50'
                    : 'border-dashed border-border/80 bg-muted/20 text-muted-foreground'
                }`}>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[11px] font-bold flex items-center gap-1 uppercase tracking-wider text-foreground">
                      <Shield className="size-3.5 text-blue-500" /> Secondary Role
                    </span>
                    <Badge variant="outline" className="text-[9px] font-medium border-border/60 bg-background/50">
                      Additional Access
                    </Badge>
                  </div>
                  {secondaryRole ? (
                    <>
                      <div className="text-xs font-bold text-foreground mt-1 flex items-center justify-between">
                        <span>{ROLE_DETAILS[secondaryRole]?.label || secondaryRole}</span>
                        <button
                          type="button"
                          onClick={() => handleSetAsPrimary(secondaryRole)}
                          className="text-[10px] text-primary hover:underline font-semibold"
                        >
                          Make Primary
                        </button>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                        {ROLE_DETAILS[secondaryRole]?.summary || 'Inherits all secondary role permissions'}
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic mt-1">
                      Optional: Click another role below to grant secondary permissions (e.g. Admin).
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Select Roles Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Shield className="size-4 text-primary" /> Select Operational Roles
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Click to assign or toggle. You can select a maximum of 2 roles.
                </p>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">
                Selected: <strong className="text-foreground">{selectedRoles.length}</strong> / 2
              </span>
            </div>

            {/* Grid of 6 System Roles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
              {ALL_ROLES.map((role) => {
                const isPrimary = selectedRoles[0] === role
                const isSecondary = selectedRoles[1] === role
                const isSelected = isPrimary || isSecondary
                const isLimitReached = selectedRoles.length >= 2 && !isSelected
                const details = ROLE_DETAILS[role] ?? {
                  label: role,
                  summary: 'System Role',
                  description: 'Grants access to role specific features.',
                }

                return (
                  <div
                    key={role}
                    onClick={() => !isLimitReached && handleToggleRole(role)}
                    className={`group flex flex-col justify-between p-3.5 rounded-xl border transition-all select-none relative ${
                      isLimitReached
                        ? 'opacity-50 cursor-not-allowed border-border/50 bg-muted/10'
                        : isPrimary
                        ? 'border-amber-400 dark:border-amber-500 bg-amber-500/10 shadow-xs cursor-pointer ring-1 ring-amber-400/40'
                        : isSecondary
                        ? 'border-blue-400 dark:border-blue-500 bg-blue-500/10 shadow-xs cursor-pointer ring-1 ring-blue-400/40'
                        : 'border-border bg-card hover:bg-muted/30 hover:border-primary/40 cursor-pointer'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`size-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                              isPrimary
                                ? 'bg-amber-500 border-amber-500 text-white'
                                : isSecondary
                                ? 'bg-blue-500 border-blue-500 text-white'
                                : 'border-muted-foreground/40 bg-background group-hover:border-primary/50'
                            }`}
                          >
                            {isSelected && <Check className="size-3 stroke-[3]" />}
                          </div>
                          <span className="text-xs font-bold text-foreground">
                            {details.label}
                          </span>
                        </div>

                        <RoleInfoButton
                          title={details.label}
                          summary={details.summary}
                          description={details.description}
                        />
                      </div>

                      <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                        {details.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between gap-1">
                      {isPrimary && (
                        <Badge className="text-[9px] font-bold bg-amber-500 hover:bg-amber-500 text-white border-0 py-0.5 px-2 flex items-center gap-1 shadow-2xs">
                          <Star className="size-2.5 fill-white" /> Primary Role
                        </Badge>
                      )}
                      {isSecondary && (
                        <Badge className="text-[9px] font-bold bg-blue-600 hover:bg-blue-600 text-white border-0 py-0.5 px-2 flex items-center gap-1 shadow-2xs">
                          <Shield className="size-2.5" /> Secondary Role
                        </Badge>
                      )}
                      {!isSelected && (
                        <span className="text-[10px] text-muted-foreground/80 font-medium">
                          {isLimitReached ? 'Max 2 reached' : 'Click to assign'}
                        </span>
                      )}

                      {isSecondary && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSetAsPrimary(role)
                          }}
                          className="text-[10px] font-semibold text-primary hover:underline ml-auto"
                        >
                          Set Primary
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Access Rules & Permission Propagation Note */}
          <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 text-xs text-muted-foreground space-y-1.5">
            <p className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
              <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
              Unified Access Privilege Rule:
            </p>
            <p className="text-[11px] leading-relaxed">
              When a secondary role (such as <strong>Admin</strong>) is paired with an operational primary role (such as <strong>Bid Executive</strong>), the user seamlessly inherits all administrative controls including user management, role modification, and full tender authority without permission conflicts.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <DialogFooter className="p-3.5 sm:p-4 border-t border-border/80 bg-muted/30 flex flex-row items-center justify-between gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleClose(false)}
            disabled={loading}
            className="text-xs font-semibold px-4"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={loading || selectedRoles.length === 0}
            className="text-xs font-semibold px-5 gap-1.5 shadow-sm"
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            Save Role Assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
