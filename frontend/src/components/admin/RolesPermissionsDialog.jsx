import React, { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import {
  ShieldCheck, Loader2, X, Info, Search, Check, ChevronDown,
  Sparkles, CheckCircle2, XCircle, Shield, KeyRound
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

import { updateUserRoles, updateUserPermissions } from '../../services/users'
import { ALL_ROLES } from './RoleBadge'
import {
  PERMISSION_METADATA,
  PERMISSION_CATEGORIES,
  ROLE_DETAILS,
} from './permissionMetaData'

/**
 * Interactive Info Tooltip Icon for Roles & Permissions
 */
function InfoButton({ title, code, summary, description }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="p-1 rounded-md text-muted-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
            aria-label="Permission Info"
          >
            <Info className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="end"
          sideOffset={6}
          className="w-72 sm:w-80 p-3.5 bg-popover border border-border text-popover-foreground shadow-2xl rounded-xl space-y-2 text-left z-[200]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
            <span className="font-bold text-xs text-foreground tracking-tight">{title}</span>
            {code && (
              <code className="text-[10px] bg-muted/80 border border-border px-1.5 py-0.5 rounded-md text-muted-foreground font-mono font-medium shrink-0">
                {code}
              </code>
            )}
          </div>
          {summary && (
            <p className="text-[11px] font-semibold text-primary">{summary}</p>
          )}
          <p className="text-[11px] text-muted-foreground leading-relaxed font-normal">
            {description}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function RolesPermissionsDialog({ open, onOpenChange, user, onUpdated }) {
  const [selectedRoles, setSelectedRoles] = useState([])
  const [allowList, setAllowList] = useState([])
  const [denyList, setDenyList] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')

  const [loadingRoles, setLoadingRoles] = useState(false)
  const [loadingPerms, setLoadingPerms] = useState(false)

  useEffect(() => {
    if (user) {
      setSelectedRoles(user.roles ?? [])
      setAllowList([])
      setDenyList([])
      setSearchQuery('')
      setSelectedCategory('ALL')
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

  function addAllow(permKey) {
    if (!permKey) return
    setAllowList((prev) => (prev.includes(permKey) ? prev : [...prev, permKey]))
    setDenyList((prev) => prev.filter((p) => p !== permKey))
  }

  function addDeny(permKey) {
    if (!permKey) return
    setDenyList((prev) => (prev.includes(permKey) ? prev : [...prev, permKey]))
    setAllowList((prev) => prev.filter((p) => p !== permKey))
  }

  function removeAllow(permKey) {
    setAllowList((prev) => prev.filter((p) => p !== permKey))
  }

  function removeDeny(permKey) {
    setDenyList((prev) => prev.filter((p) => p !== permKey))
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
        toast.success('User roles updated successfully!')
        onUpdated?.()
      } else {
        toast.error(result.error?.message || 'Failed to update roles')
      }
    } catch {
      toast.error('Network error occurred.')
    } finally {
      setLoadingRoles(false)
    }
  }

  async function savePermissions() {
    setLoadingPerms(true)
    try {
      const result = await updateUserPermissions(user.id, {
        allow: allowList,
        deny: denyList,
      })
      if (result.ok && result.success) {
        toast.success('Permission overrides updated successfully!')
        onUpdated?.()
      } else {
        toast.error(result.error?.message || 'Failed to update permission overrides')
      }
    } catch {
      toast.error('Network error occurred.')
    } finally {
      setLoadingPerms(false)
    }
  }

  // Filter available permissions for the dropdown selector
  const filteredPermissions = useMemo(() => {
    return Object.entries(PERMISSION_METADATA).filter(([key, meta]) => {
      const matchesCategory =
        selectedCategory === 'ALL' || meta.category === selectedCategory
      const matchesSearch =
        !searchQuery ||
        meta.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meta.description.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [selectedCategory, searchQuery])

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:max-w-3xl md:max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border-border bg-card shadow-2xl">
        {/* Modal Header */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border/80 bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <ShieldCheck className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2 truncate">
                Role & Access Control
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate mt-0.5">
                Configuring access & granular overrides for{' '}
                <span className="font-semibold text-foreground">
                  {user.full_name} (@{user.username})
                </span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Main Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-h-[calc(92vh-130px)]">
          
          {/* SECTION 1: System Roles */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-2">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Shield className="size-4 text-primary" /> Assigned Roles
                </Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Select baseline operational roles for this user.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-semibold bg-muted/30 shrink-0">
                  Min 1 Role Required
                </Badge>
                <Button
                  size="sm"
                  onClick={saveRoles}
                  disabled={loadingRoles || loadingPerms}
                  className="gap-1.5 h-8 text-xs font-semibold px-3.5 shadow-sm shrink-0"
                >
                  {loadingRoles ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  Save Roles
                </Button>
              </div>
            </div>

            {/* Grid of System Roles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
              {ALL_ROLES.map((role) => {
                const checked = selectedRoles.includes(role)
                const details = ROLE_DETAILS[role] ?? {
                  label: role,
                  summary: 'System Role',
                  description: 'Grants access to role specific features.',
                }

                return (
                  <div
                    key={role}
                    onClick={() => toggleRole(role)}
                    className={`group flex items-start justify-between p-3 rounded-xl border transition-all cursor-pointer select-none relative
                      ${
                        checked
                          ? 'border-primary bg-primary/5 shadow-xs text-foreground ring-1 ring-primary/20'
                          : 'border-border/80 bg-background hover:bg-muted/30 text-muted-foreground'
                      }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1 pr-1">
                      <div
                        className={`size-4 rounded border flex items-center justify-center transition-colors shrink-0 mt-0.5
                          ${
                            checked
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-muted-foreground/40 bg-background group-hover:border-primary/50'
                          }`}
                      >
                        {checked && <Check className="size-3 stroke-[3]" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-foreground block truncate">
                          {details.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground block truncate mt-0.5">
                          {details.summary}
                        </span>
                      </div>
                    </div>

                    {/* Hover Info Tooltip */}
                    <InfoButton
                      title={details.label}
                      code={role}
                      summary={details.summary}
                      description={details.description}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          <Separator className="bg-border/60" />

          {/* SECTION 2: Granular Permission Overrides */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-2">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-4 text-amber-500" /> Permission Overrides
                </Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Formula:{' '}
                  <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">
                    Effective Rights = (Role Permissions − Denied) + Allowed
                  </code>
                </p>
              </div>

              <Button
                size="sm"
                onClick={savePermissions}
                disabled={loadingPerms || loadingRoles}
                className="gap-1.5 h-8 text-xs font-semibold px-3.5 shadow-sm self-start sm:self-auto shrink-0"
              >
                {loadingPerms ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                Save Overrides
              </Button>
            </div>

            {/* Permission Selector Card */}
            <div className="p-4 rounded-xl border border-border/80 bg-muted/15 space-y-3 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <KeyRound className="size-3.5 text-primary" /> Select Permission to Add
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Use readable names below or filter by category
                </span>
              </div>

              {/* Filters & Search Row */}
              <div className="flex flex-col sm:flex-row gap-2">
                {/* Category Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs justify-between bg-background border-input font-medium shrink-0 w-full sm:w-52"
                    >
                      <span className="truncate">
                        {selectedCategory === 'ALL'
                          ? 'All Categories'
                          : PERMISSION_CATEGORIES[selectedCategory]?.label ??
                            selectedCategory}
                      </span>
                      <ChevronDown className="size-3.5 text-muted-foreground ml-1 shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 max-h-64 overflow-y-auto z-[120]">
                    <DropdownMenuItem
                      onSelect={() => setSelectedCategory('ALL')}
                      className="text-xs font-medium"
                    >
                      All Categories
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {Object.entries(PERMISSION_CATEGORIES).map(
                      ([catKey, cat]) => (
                        <DropdownMenuItem
                          key={catKey}
                          onSelect={() => setSelectedCategory(catKey)}
                          className="text-xs justify-between"
                        >
                          <span>{cat.label}</span>
                        </DropdownMenuItem>
                      )
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search permission e.g. Create Bid, View Directory..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-9 text-xs bg-background"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable Permissions List */}
              <div className="border border-border/70 rounded-xl max-h-56 overflow-y-auto bg-background divide-y divide-border/50">
                {filteredPermissions.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    No permissions match search criteria.
                  </div>
                ) : (
                  filteredPermissions.map(([permKey, meta]) => {
                    const isAllowed = allowList.includes(permKey)
                    const isDenied = denyList.includes(permKey)
                    const catInfo = PERMISSION_CATEGORIES[meta.category]

                    return (
                      <div
                        key={permKey}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 sm:px-3 hover:bg-muted/30 transition-colors gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Badge
                            variant="outline"
                            className={`text-[10px] shrink-0 font-semibold px-2 py-0.5 border ${
                              catInfo?.bgColor ?? 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {catInfo?.label ?? meta.category}
                          </Badge>
                          <span className="font-bold text-foreground truncate">
                            {meta.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground/70 font-mono hidden md:inline shrink-0">
                            ({permKey})
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                          {/* Hover info button */}
                          <InfoButton
                            title={meta.label}
                            code={permKey}
                            summary={`Category: ${catInfo?.label ?? meta.category}`}
                            description={meta.description}
                          />

                          {/* Explicit Allow Button */}
                          <Button
                            type="button"
                            size="sm"
                            variant={isAllowed ? 'default' : 'outline'}
                            onClick={() => addAllow(permKey)}
                            className={`h-7 px-2.5 text-[11px] font-semibold gap-1 transition-all ${
                              isAllowed
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                : 'hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50/50'
                            }`}
                          >
                            <CheckCircle2 className="size-3.5" /> Allow
                          </Button>

                          {/* Explicit Deny Button */}
                          <Button
                            type="button"
                            size="sm"
                            variant={isDenied ? 'destructive' : 'outline'}
                            onClick={() => addDeny(permKey)}
                            className={`h-7 px-2.5 text-[11px] font-semibold gap-1 transition-all ${
                              isDenied
                                ? 'bg-destructive text-destructive-foreground shadow-xs'
                                : 'hover:border-destructive hover:text-destructive hover:bg-red-50/50'
                            }`}
                          >
                            <XCircle className="size-3.5" /> Deny
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Active Overrides Containers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Allowed Chips */}
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-emerald-600" /> Explicitly Allowed ({allowList.length})
                  </span>
                </div>
                {allowList.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground/80 italic py-2 text-center">
                    No explicit allow overrides configured.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-1">
                    {allowList.map((permKey) => {
                      const meta = PERMISSION_METADATA[permKey]
                      return (
                        <div
                          key={permKey}
                          className="inline-flex items-center gap-1.5 bg-emerald-100 border border-emerald-300 text-emerald-900 text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-2xs"
                        >
                          <span>{meta?.label ?? permKey}</span>
                          <InfoButton
                            title={meta?.label ?? permKey}
                            code={permKey}
                            description={meta?.description}
                          />
                          <button
                            type="button"
                            onClick={() => removeAllow(permKey)}
                            className="text-emerald-700 hover:text-emerald-950 p-0.5 rounded hover:bg-emerald-200 ml-0.5 transition-colors"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Denied Chips */}
              <div className="p-3.5 rounded-xl border border-red-200 bg-red-50/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-800 flex items-center gap-1.5">
                    <XCircle className="size-4 text-red-600" /> Explicitly Denied ({denyList.length})
                  </span>
                </div>
                {denyList.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground/80 italic py-2 text-center">
                    No explicit deny overrides configured.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-1">
                    {denyList.map((permKey) => {
                      const meta = PERMISSION_METADATA[permKey]
                      return (
                        <div
                          key={permKey}
                          className="inline-flex items-center gap-1.5 bg-red-100 border border-red-300 text-red-900 text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-2xs"
                        >
                          <span>{meta?.label ?? permKey}</span>
                          <InfoButton
                            title={meta?.label ?? permKey}
                            code={permKey}
                            description={meta?.description}
                          />
                          <button
                            type="button"
                            onClick={() => removeDeny(permKey)}
                            className="text-red-700 hover:text-red-950 p-0.5 rounded hover:bg-red-200 ml-0.5 transition-colors"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <DialogFooter className="p-3.5 sm:p-4 border-t border-border/80 bg-muted/30 flex items-center justify-end shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleClose(false)}
            disabled={loadingRoles || loadingPerms}
            className="text-xs font-semibold px-5"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
