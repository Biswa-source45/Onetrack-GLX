import React, { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2, ShieldCheck, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

import { updateUserRoles, updateUserPermissions } from '../../services/users'
import { ALL_ROLES, ROLE_LABELS } from './RoleBadge'

/**
 * Full list of system permissions derived from DB seed data.
 * Grouped for readability in the override UI.
 */
const ALL_PERMISSIONS = [
  // Bid
  'bid.create', 'bid.view', 'bid.edit', 'bid.delete', 'bid.assign',
  // Task
  'task.create', 'task.view', 'task.edit', 'task.assign', 'task.complete',
  // Document
  'document.upload', 'document.view', 'document.delete',
  // Qualification
  'qualification.view', 'qualification.override', 'qualification.approve',
  // Quotation
  'quotation.create', 'quotation.view', 'quotation.edit', 'quotation.approve', 'quotation.lock',
  // Costing
  'costing.view', 'costing.edit',
  // User management
  'user.create', 'user.view', 'user.edit', 'user.deactivate', 'user.assign_role',
  // Workflow
  'workflow.transition', 'workflow.override',
  // Notification
  'notification.view', 'notification.manage',
  // Analytics
  'analytics.view', 'analytics.export',
  // Admin
  'admin.system',
]

/**
 * RolesPermissionsDialog
 *
 * Covers two API endpoints:
 *   PATCH /api/v1/users/{id}/roles       — requires user.assign_role
 *   PATCH /api/v1/users/{id}/permissions — requires user.assign_role
 *
 * Props:
 *   open        {boolean}
 *   onOpenChange {(open: boolean) => void}
 *   user        {object}
 *   onUpdated   {() => void}
 */
export function RolesPermissionsDialog({ open, onOpenChange, user, onUpdated }) {
  const [selectedRoles, setSelectedRoles] = useState([])
  const [allowInput, setAllowInput] = useState('')
  const [denyInput, setDenyInput]   = useState('')
  const [allowList, setAllowList]   = useState([])
  const [denyList, setDenyList]     = useState([])
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [loadingPerms, setLoadingPerms] = useState(false)

  useEffect(() => {
    if (user) {
      setSelectedRoles(user.roles ?? [])
      setAllowList([])
      setDenyList([])
      setAllowInput('')
      setDenyInput('')
    }
  }, [user])

  function handleClose(val) {
    if (!loadingRoles && !loadingPerms) onOpenChange(val)
  }

  function toggleRole(role) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }

  function addToList(setList, list, value) {
    const v = value.trim()
    if (!v || list.includes(v)) return
    setList((prev) => [...prev, v])
  }

  function removeFromList(setList, value) {
    setList((prev) => prev.filter((x) => x !== value))
  }

  async function saveRoles() {
    if (selectedRoles.length === 0) {
      toast.error('At least one role must be assigned.')
      return
    }
    setLoadingRoles(true)
    try {
      const result = await updateUserRoles(user.id, selectedRoles)
      if (result.ok && result.success) {
        toast.success('Roles updated successfully')
        onUpdated?.()
      } else {
        toast.error(result.error?.message || 'Failed to update roles')
      }
    } catch {
      toast.error('Network error.')
    } finally {
      setLoadingRoles(false)
    }
  }

  async function savePermissions() {
    setLoadingPerms(true)
    try {
      // API: FULL replacement of overrides — send current allow/deny arrays
      const result = await updateUserPermissions(user.id, { allow: allowList, deny: denyList })
      if (result.ok && result.success) {
        toast.success('Permission overrides updated')
        onUpdated?.()
      } else {
        toast.error(result.error?.message || 'Failed to update permissions')
      }
    } catch {
      toast.error('Network error.')
    } finally {
      setLoadingPerms(false)
    }
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            Roles & Permissions
          </DialogTitle>
          <DialogDescription>
            Managing access for <span className="font-medium text-foreground">@{user.username}</span>.
            Role changes are full replacements. Override changes replace all existing overrides.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh]">
          <div className="space-y-6 pr-1">

          {/* ── Section 1: Roles ─────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Assigned Roles</Label>
              <span className="text-xs text-muted-foreground">Min. 1 required</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ALL_ROLES.map((role) => {
                const checked = selectedRoles.includes(role)
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    disabled={loadingRoles}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium text-left transition-colors
                      ${checked
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                      }`}
                  >
                    <span className={`size-3.5 rounded-sm border flex items-center justify-center flex-shrink-0
                      ${checked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'}`}
                    >
                      {checked && (
                        <svg viewBox="0 0 10 10" className="size-2.5 fill-current">
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    {ROLE_LABELS[role]?.label ?? role}
                  </button>
                )
              })}
            </div>
            <Button
              size="sm"
              onClick={saveRoles}
              disabled={loadingRoles || loadingPerms}
            >
              {loadingRoles && <Loader2 className="size-3.5 animate-spin" />}
              Save Roles
            </Button>
          </div>

          <Separator />

          {/* ── Section 2: Permission Overrides ──────────────────── */}
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold">Permission Overrides</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Override formula: <code className="text-[11px] bg-muted px-1 rounded">(role permissions − deny) + allow</code>
              </p>
            </div>

            {/* Allow list */}
            <div className="space-y-2">
              <Label htmlFor="rp-allow-input" className="text-xs font-medium text-emerald-700">
                Explicitly Allow
              </Label>
              <div className="flex gap-2">
                <Input
                  id="rp-allow-input"
                  list="rp-perm-datalist"
                  placeholder="e.g. bid.delete"
                  value={allowInput}
                  onChange={(e) => setAllowInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addToList(setAllowList, allowList, allowInput)
                      setAllowInput('')
                    }
                  }}
                  className="h-8 text-xs"
                  disabled={loadingPerms}
                />
                <Button size="sm" variant="outline" className="shrink-0"
                  onClick={() => { addToList(setAllowList, allowList, allowInput); setAllowInput('') }}
                  disabled={loadingPerms}
                >
                  Add
                </Button>
              </div>
              {allowList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 rounded-md bg-emerald-50 border border-emerald-100">
                  {allowList.map((perm) => (
                    <span key={perm}
                      className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full"
                    >
                      {perm}
                      <button type="button" onClick={() => removeFromList(setAllowList, perm)}
                        className="hover:text-emerald-950 ml-0.5">
                        <X className="size-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Deny list */}
            <div className="space-y-2">
              <Label htmlFor="rp-deny-input" className="text-xs font-medium text-destructive">
                Explicitly Deny
              </Label>
              <div className="flex gap-2">
                <Input
                  id="rp-deny-input"
                  list="rp-perm-datalist"
                  placeholder="e.g. quotation.approve"
                  value={denyInput}
                  onChange={(e) => setDenyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addToList(setDenyList, denyList, denyInput)
                      setDenyInput('')
                    }
                  }}
                  className="h-8 text-xs"
                  disabled={loadingPerms}
                />
                <Button size="sm" variant="outline" className="shrink-0"
                  onClick={() => { addToList(setDenyList, denyList, denyInput); setDenyInput('') }}
                  disabled={loadingPerms}
                >
                  Add
                </Button>
              </div>
              {denyList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 rounded-md bg-red-50 border border-red-100">
                  {denyList.map((perm) => (
                    <span key={perm}
                      className="inline-flex items-center gap-1 text-[11px] font-medium bg-red-100 text-red-800 px-2 py-0.5 rounded-full"
                    >
                      {perm}
                      <button type="button" onClick={() => removeFromList(setDenyList, perm)}
                        className="hover:text-red-950 ml-0.5">
                        <X className="size-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Datalist for autocomplete */}
            <datalist id="rp-perm-datalist">
              {ALL_PERMISSIONS.map((p) => <option key={p} value={p} />)}
            </datalist>

            <Button
              size="sm"
              onClick={savePermissions}
              disabled={loadingPerms || loadingRoles || (allowList.length === 0 && denyList.length === 0)}
            >
              {loadingPerms && <Loader2 className="size-3.5 animate-spin" />}
              Save Overrides
            </Button>
          </div>

          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={loadingRoles || loadingPerms}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
