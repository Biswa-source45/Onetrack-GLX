import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff, UserPlus, X } from 'lucide-react'

import { Button }    from '@/components/ui/button'
import { Input }     from '@/components/ui/input'
import { Label }     from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'

import { createUser } from '../../services/users'
import { ALL_ROLES, ROLE_LABELS } from './RoleBadge'

// ── Form initial state ────────────────────────────────────────────────────────
const INITIAL_FORM = {
  employee_code: '',
  full_name:     '',
  username:      '',
  email:         '',
  phone:         '',
  department:    '',
  password:      '',
  roles:         [],
}

// ── Framer Motion variants ────────────────────────────────────────────────────
const backdropVariants = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.22, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.18, ease: 'easeIn' },
  },
}

const panelVariants = {
  hidden: { x: '100%' },
  visible: {
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 320,
      damping: 32,
      mass: 0.85,
    },
  },
  exit: {
    x: '100%',
    transition: {
      type: 'tween',
      duration: 0.22,
      ease: [0.32, 0.72, 0, 1],
    },
  },
}

// Floating close button: enters from the left as panel opens
const closeButtonVariants = {
  hidden:  { opacity: 0, scale: 0.7, x: 16 },
  visible: {
    opacity: 1,
    scale: 1,
    x: 0,
    transition: { delay: 0.12, type: 'spring', stiffness: 400, damping: 28 },
  },
  exit: {
    opacity: 0,
    scale: 0.7,
    x: 16,
    transition: { duration: 0.12 },
  },
}

/**
 * CreateUserSheet
 *
 * A right-panel drawer (50% viewport width) that slides in from the right
 * using Framer Motion. A floating circular close button hangs off the left
 * edge of the panel.
 *
 * Props — same interface as the old CreateUserDialog:
 *   open        {boolean}
 *   onOpenChange {(open: boolean) => void}
 *   onCreated   {(user) => void}
 */
export function CreateUserSheet({ open, onOpenChange, onCreated }) {
  const [form, setForm]               = useState(INITIAL_FORM)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [fieldErrors, setFieldErrors]   = useState({})

  // Lock body scroll while sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Close on Escape key
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape' && open && !loading) requestClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, loading])

  function resetForm() {
    setForm(INITIAL_FORM)
    setFieldErrors({})
    setShowPassword(false)
  }

  function requestClose() {
    if (loading) return
    resetForm()
    onOpenChange(false)
  }

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function toggleRole(role) {
    setForm((prev) => {
      const has = prev.roles.includes(role)
      return {
        ...prev,
        roles: has ? prev.roles.filter((r) => r !== role) : [...prev.roles, role],
      }
    })
  }

  function validate() {
    const errors = {}
    if (!form.employee_code.trim()) errors.employee_code = 'Required'
    if (!form.full_name.trim())     errors.full_name     = 'Required'
    if (!form.username.trim())      errors.username      = 'Required'
    if (!form.password)             errors.password      = 'Required'
    else if (form.password.length < 8) errors.password   = 'Minimum 8 characters'
    if (form.roles.length === 0)    errors.roles         = 'Select at least one role'
    return errors
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errors = validate()
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return }

    setLoading(true)
    try {
      const payload = {
        employee_code: form.employee_code.trim(),
        full_name:     form.full_name.trim(),
        username:      form.username.trim(),
        password:      form.password,
        roles:         form.roles,
        ...(form.email.trim()      && { email:      form.email.trim() }),
        ...(form.phone.trim()      && { phone:      form.phone.trim() }),
        ...(form.department.trim() && { department: form.department.trim() }),
      }

      const result = await createUser(payload)

      if (result.ok && result.success) {
        toast.success(`User "@${form.username}" created successfully`)
        onCreated?.(result.data)
        requestClose()
      } else {
        const msg  = result.error?.message || 'Failed to create user'
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

  // ── Render via portal so nothing clips ───────────────────────────────────
  const content = (
    <AnimatePresence mode="wait">
      {open && (
        <>
          {/* ── Backdrop ──────────────────────────────────────────────────── */}
          <motion.div
            key="cu-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-40 bg-foreground/10 backdrop-blur-[2px]"
            onClick={requestClose}
            aria-hidden="true"
          />

          {/* ── Panel wrapper (relative anchor for floating button) ─────── */}
          <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-1/2 flex">

            {/* ── Floating close button ──────────────────────────────────── */}
            {/* Positioned outside the panel's left edge, vertically centered */}
            <motion.button
              key="cu-close-btn"
              variants={closeButtonVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={requestClose}
              disabled={loading}
              aria-label="Close panel"
              className="
                absolute -left-15 top-1/2 -translate-y-1/2
                size-12 rounded-full
                bg-primary text-primary-foreground shadow-xl
                flex items-center justify-center
                hover:bg-primary/90 hover:scale-110
                active:scale-95
                transition-all duration-150
                disabled:pointer-events-none disabled:opacity-50
                z-10
              "
            >
              <X className="size-4" />
            </motion.button>

            {/* ── Sliding panel ─────────────────────────────────────────── */}
            <motion.div
              key="cu-panel"
              variants={panelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="
                flex flex-col w-full
                bg-card border-l border-border shadow-2xl
                overflow-hidden
              "
              role="dialog"
              aria-modal="true"
              aria-label="Create new user"
            >
              {/* ── Panel Header ──────────────────────────────────────────── */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
                <div className="space-y-0.5">
                  <h2 className="font-heading text-base font-semibold text-foreground flex items-center gap-2">
                    <UserPlus className="size-4 text-primary" />
                    Create New User
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    The user will receive a temporary password and be prompted to change it on first login.
                  </p>
                </div>
                {/* Mobile close button (hidden on sm+, where the floating btn is visible) */}
                <button
                  onClick={requestClose}
                  disabled={loading}
                  className="
                    sm:hidden size-8 rounded-md flex items-center justify-center
                    text-muted-foreground hover:text-foreground hover:bg-muted
                    transition-colors disabled:pointer-events-none
                  "
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* ── Scrollable Form Body ───────────────────────────────────── */}
              <ScrollArea className="flex-1">
                <div className="px-6 py-6">
                <form id="create-user-sheet-form" onSubmit={handleSubmit} noValidate>
                  <div className="grid gap-5">

                    {/* Row 1: Employee Code + Full Name */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="cus-employee-code">
                          Employee Code <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="cus-employee-code"
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
                        <Label htmlFor="cus-full-name">
                          Full Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="cus-full-name"
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
                      <Label htmlFor="cus-username">
                        Username <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="cus-username"
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
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="cus-email">Email</Label>
                        <Input
                          id="cus-email"
                          type="email"
                          placeholder="jane@company.com"
                          value={form.email}
                          onChange={(e) => setField('email', e.target.value)}
                          disabled={loading}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="cus-phone">Phone</Label>
                        <Input
                          id="cus-phone"
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
                      <Label htmlFor="cus-department">Department</Label>
                      <Input
                        id="cus-department"
                        placeholder="e.g. IT, Sales, Finance"
                        value={form.department}
                        onChange={(e) => setField('department', e.target.value)}
                        disabled={loading}
                      />
                    </div>

                    {/* Row 5: Temporary Password */}
                    <div className="space-y-1.5">
                      <Label htmlFor="cus-password">
                        Temporary Password <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="cus-password"
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
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
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
                          {form.roles.length} selected
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {ALL_ROLES.map((role) => {
                          const checked = form.roles.includes(role)
                          return (
                            <button
                              key={role}
                              type="button"
                              onClick={() => toggleRole(role)}
                              disabled={loading}
                              className={`
                                flex items-center gap-2 rounded-md border px-3 py-2.5
                                text-xs font-medium text-left transition-all duration-150
                                ${checked
                                  ? 'border-primary bg-primary/5 text-primary shadow-sm'
                                  : 'border-border bg-background text-muted-foreground hover:bg-muted hover:border-muted-foreground/30'
                                }
                              `}
                            >
                              <span
                                className={`
                                  size-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 transition-colors
                                  ${checked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'}
                                `}
                              >
                                {checked && (
                                  <svg viewBox="0 0 10 10" className="size-2.5 fill-current">
                                    <path
                                      d="M1.5 5L4 7.5L8.5 2.5"
                                      stroke="currentColor"
                                      strokeWidth="1.5"
                                      fill="none"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
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
                </div>
              </ScrollArea>

              {/* ── Sticky Footer ─────────────────────────────────────────── */}
              <div className="shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-card">
                <Button
                  variant="outline"
                  onClick={requestClose}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="create-user-sheet-form"
                  disabled={loading}
                  className="min-w-[120px]"
                >
                  {loading
                    ? <><Loader2 className="size-4 animate-spin" /> Creating…</>
                    : 'Create User'
                  }
                </Button>
              </div>

            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )

  // Portal to document.body so nothing clips or z-index-fights with the layout
  return createPortal(content, document.body)
}
