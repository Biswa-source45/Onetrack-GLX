import React, { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff, UserPlus, Star, Shield, ArrowLeftRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

import { createUser } from '../../services/users'
import { ALL_ROLES, ROLE_LABELS } from './RoleBadge'

const INITIAL_FORM = {
  employee_code: '',
  full_name: '',
  username: '',
  email: '',
  phone: '',
  department: '',
  password: '',
  roles: [],
}

/**
 * CreateUserDialog
 *
 * Modal for creating a user with primary and secondary role designation (max 2 roles).
 */
export function CreateUserDialog({ open, onOpenChange, onCreated }) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})

  function resetForm() {
    setForm(INITIAL_FORM)
    setFieldErrors({})
    setShowPassword(false)
  }

  function handleClose(val) {
    if (!loading) {
      resetForm()
      onOpenChange(val)
    }
  }

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function toggleRole(role) {
    setForm((prev) => {
      const isAlreadySelected = prev.roles.includes(role)
      if (isAlreadySelected) {
        return { ...prev, roles: prev.roles.filter((r) => r !== role) }
      }

      if (prev.roles.length >= 2) {
        toast.warning('Maximum 2 roles allowed per user (1 Primary + 1 Secondary).')
        return prev
      }

      return { ...prev, roles: [...prev.roles, role] }
    })
    if (fieldErrors.roles) setFieldErrors((prev) => ({ ...prev, roles: undefined }))
  }

  function handleSwapRoles() {
    if (form.roles.length === 2) {
      setForm((prev) => ({
        ...prev,
        roles: [prev.roles[1], prev.roles[0]],
      }))
      toast.info('Swapped Primary and Secondary roles.')
    }
  }

  function validate() {
    const errors = {}
    if (!form.employee_code.trim()) errors.employee_code = 'Required'
    if (!form.full_name.trim())    errors.full_name = 'Required'
    if (!form.username.trim())     errors.username = 'Required'
    if (!form.password)            errors.password = 'Required'
    else if (form.password.length < 8) errors.password = 'Minimum 8 characters'
    if (form.roles.length === 0)   errors.roles = 'Select at least one role'
    else if (form.roles.length > 2) errors.roles = 'Maximum 2 roles allowed'
    return errors
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    try {
      const payload = {
        employee_code: form.employee_code.trim(),
        full_name:     form.full_name.trim(),
        username:      form.username.trim().toLowerCase(),
        password:      form.password,
        roles:         form.roles,
        ...(form.email.trim()      && { email: form.email.trim() }),
        ...(form.phone.trim()      && { phone: form.phone.trim() }),
        ...(form.department.trim() && { department: form.department.trim() }),
      }

      const result = await createUser(payload)

      if (result.ok && result.success) {
        toast.success(`User "${form.username}" created successfully`)
        onCreated?.(result.data)
        handleClose(false)
      } else {
        const msg = result.error?.message || 'Failed to create user'
        const code = result.error?.code
        if (code === 'CONFLICT' && msg.toLowerCase().includes('username')) {
          setFieldErrors({ username: 'Username already exists' })
        } else if (code === 'CONFLICT' && msg.toLowerCase().includes('employee')) {
          setFieldErrors({ employee_code: 'Employee code already exists' })
        } else if (code === 'VALIDATION_ERROR' && msg.toLowerCase().includes('role')) {
          setFieldErrors({ roles: result.error?.details || msg })
        } else {
          toast.error(msg)
        }
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const primaryRole = form.roles[0] || null
  const secondaryRole = form.roles[1] || null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-4 text-primary" />
            Create New User
          </DialogTitle>
          <DialogDescription>
            Assign basic details and up to 2 system roles (Primary & Secondary).
          </DialogDescription>
        </DialogHeader>

        <form id="create-user-form" onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4">

            {/* Row 1: Employee Code + Full Name */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cu-employee-code">
                  Employee Code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cu-employee-code"
                  placeholder="EMP001"
                  value={form.employee_code}
                  onChange={(e) => setField('employee_code', e.target.value)}
                  aria-invalid={!!fieldErrors.employee_code}
                  disabled={loading}
                />
                {fieldErrors.employee_code && (
                  <p className="text-xs text-destructive">{fieldErrors.employee_code}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cu-full-name">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cu-full-name"
                  placeholder="Jane Smith"
                  value={form.full_name}
                  onChange={(e) => setField('full_name', e.target.value)}
                  aria-invalid={!!fieldErrors.full_name}
                  disabled={loading}
                />
                {fieldErrors.full_name && (
                  <p className="text-xs text-destructive">{fieldErrors.full_name}</p>
                )}
              </div>
            </div>

            {/* Row 2: Username */}
            <div className="space-y-1.5">
              <Label htmlFor="cu-username">
                Username <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cu-username"
                placeholder="jane.smith"
                value={form.username}
                onChange={(e) => setField('username', e.target.value)}
                aria-invalid={!!fieldErrors.username}
                disabled={loading}
              />
              {fieldErrors.username && (
                <p className="text-xs text-destructive">{fieldErrors.username}</p>
              )}
            </div>

            {/* Row 3: Email + Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cu-email">Email</Label>
                <Input
                  id="cu-email"
                  type="email"
                  placeholder="jane@company.com"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cu-phone">Phone</Label>
                <Input
                  id="cu-phone"
                  type="tel"
                  placeholder="9876543210"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Row 4: Department */}
            <div className="space-y-1.5">
              <Label htmlFor="cu-department">Department</Label>
              <Input
                id="cu-department"
                placeholder="e.g. IT, Sales, Finance"
                value={form.department}
                onChange={(e) => setField('department', e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Row 5: Temporary Password */}
            <div className="space-y-1.5">
              <Label htmlFor="cu-password">
                Temporary Password <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="cu-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                  aria-invalid={!!fieldErrors.password}
                  disabled={loading}
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-xs text-destructive">{fieldErrors.password}</p>
              )}
            </div>

            <Separator />

            {/* Row 6: Role Selection */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label>
                  Roles <span className="text-destructive">*</span>
                </Label>
                <span className="text-xs text-muted-foreground">
                  {form.roles.length} of 2 selected
                </span>
              </div>

              {/* Priority preview */}
              {form.roles.length > 0 && (
                <div className="p-2.5 rounded-lg border border-primary/20 bg-primary/5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[11px] uppercase tracking-wide">Role Assignment</span>
                    {form.roles.length === 2 && (
                      <button
                        type="button"
                        onClick={handleSwapRoles}
                        className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-1"
                      >
                        <ArrowLeftRight className="size-3" /> Swap Roles
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {primaryRole && (
                      <Badge className="text-[10px] font-bold bg-amber-500 text-white gap-1 py-0.5 px-2">
                        <Star className="size-2.5 fill-white" /> Primary: {ROLE_LABELS[primaryRole]?.label || primaryRole}
                      </Badge>
                    )}
                    {secondaryRole && (
                      <Badge className="text-[10px] font-bold bg-blue-600 text-white gap-1 py-0.5 px-2">
                        <Shield className="size-2.5" /> Secondary: {ROLE_LABELS[secondaryRole]?.label || secondaryRole}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {ALL_ROLES.map((role) => {
                  const isPrimary = form.roles[0] === role
                  const isSecondary = form.roles[1] === role
                  const checked = isPrimary || isSecondary
                  const isLimitReached = form.roles.length >= 2 && !checked

                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => !isLimitReached && toggleRole(role)}
                      disabled={loading || isLimitReached}
                      className={`flex items-center justify-between gap-1.5 rounded-md border px-3 py-2 text-xs font-medium text-left transition-colors
                        ${isLimitReached
                          ? 'opacity-40 cursor-not-allowed border-border bg-muted/20 text-muted-foreground'
                          : isPrimary
                          ? 'border-amber-400 bg-amber-500/10 text-foreground shadow-2xs'
                          : isSecondary
                          ? 'border-blue-400 bg-blue-500/10 text-foreground shadow-2xs'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted'
                        }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={`size-3.5 rounded-sm border flex items-center justify-center shrink-0
                          ${isPrimary
                            ? 'border-amber-500 bg-amber-500 text-white'
                            : isSecondary
                            ? 'border-blue-500 bg-blue-500 text-white'
                            : 'border-muted-foreground/40'}`}
                        >
                          {checked && (
                            <svg viewBox="0 0 10 10" className="size-2.5 fill-current">
                              <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <span className="truncate">{ROLE_LABELS[role]?.label ?? role}</span>
                      </div>
                      {isPrimary && <span className="text-[9px] font-bold text-amber-600 shrink-0">★ 1st</span>}
                      {isSecondary && <span className="text-[9px] font-semibold text-blue-600 shrink-0">2nd</span>}
                    </button>
                  )
                })}
              </div>
              {fieldErrors.roles && (
                <p className="text-xs text-destructive">{fieldErrors.roles}</p>
              )}
            </div>

          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="create-user-form" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            Create User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
