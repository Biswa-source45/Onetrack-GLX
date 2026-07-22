import React, { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff, UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
 * Props:
 *   open       {boolean}
 *   onOpenChange {(open: boolean) => void}
 *   onCreated  {(user) => void}  — called after successful creation
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
      const has = prev.roles.includes(role)
      return { ...prev, roles: has ? prev.roles.filter((r) => r !== role) : [...prev.roles, role] }
    })
  }

  function validate() {
    const errors = {}
    if (!form.employee_code.trim()) errors.employee_code = 'Required'
    if (!form.full_name.trim())    errors.full_name = 'Required'
    if (!form.username.trim())     errors.username = 'Required'
    if (!form.password)            errors.password = 'Required'
    else if (form.password.length < 8) errors.password = 'Minimum 8 characters'
    if (form.roles.length === 0)   errors.roles = 'Select at least one role'
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
        username:      form.username.trim(),
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
        // Show backend error messages clearly
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-4 text-primary" />
            Create New User
          </DialogTitle>
          <DialogDescription>
            The user will receive a temporary password and be prompted to change it on first login.
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
            <div className="space-y-2">
              <Label>
                Roles <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_ROLES.map((role) => {
                  const checked = form.roles.includes(role)
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(role)}
                      disabled={loading}
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
