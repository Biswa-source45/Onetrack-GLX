import React, { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2, Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

import { updateUserProfile } from '../../services/users'

/**
 * EditUserDialog
 *
 * Maps to: PATCH /api/v1/users/{id}
 * Updatable fields per API: full_name, email, phone, department
 *
 * Props:
 *   open        {boolean}
 *   onOpenChange {(open: boolean) => void}
 *   user        {object}  — the user object from list/detail response
 *   onUpdated   {(user) => void}
 */
export function EditUserDialog({ open, onOpenChange, user, onUpdated }) {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', department: '' })
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})

  // Sync form when `user` changes (dialog re-open with different user)
  useEffect(() => {
    if (user) {
      setForm({
        full_name:  user.full_name  ?? '',
        email:      user.email      ?? '',
        phone:      user.phone      ?? '',
        department: user.department ?? '',
      })
      setFieldErrors({})
    }
  }, [user])

  function handleClose(val) {
    if (!loading) onOpenChange(val)
  }

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    // API requires at least one field in payload
    const payload = {}
    if (form.full_name.trim()  !== (user?.full_name  ?? '')) payload.full_name  = form.full_name.trim()
    if (form.email.trim()      !== (user?.email      ?? '')) payload.email      = form.email.trim()
    if (form.phone.trim()      !== (user?.phone      ?? '')) payload.phone      = form.phone.trim()
    if (form.department.trim() !== (user?.department ?? '')) payload.department = form.department.trim()

    if (Object.keys(payload).length === 0) {
      toast.info('No changes to save.')
      handleClose(false)
      return
    }

    setLoading(true)
    try {
      const result = await updateUserProfile(user.id, payload)
      if (result.ok && result.success) {
        toast.success('Profile updated successfully')
        onUpdated?.(result.data)
        handleClose(false)
      } else {
        toast.error(result.error?.message || 'Failed to update profile')
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4 text-primary" />
            Edit Profile
          </DialogTitle>
          <DialogDescription>
            Updating profile for <span className="font-medium text-foreground">@{user.username}</span>
          </DialogDescription>
        </DialogHeader>

        <form id="edit-user-form" onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4">

            <div className="space-y-1.5">
              <Label htmlFor="eu-full-name">Full Name</Label>
              <Input
                id="eu-full-name"
                placeholder="Jane Smith"
                value={form.full_name}
                onChange={(e) => setField('full_name', e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="eu-email">Email</Label>
              <Input
                id="eu-email"
                type="email"
                placeholder="jane@company.com"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                aria-invalid={!!fieldErrors.email}
                disabled={loading}
              />
              {fieldErrors.email && (
                <p className="text-xs text-destructive">{fieldErrors.email}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="eu-phone">Phone</Label>
                <Input
                  id="eu-phone"
                  type="tel"
                  placeholder="9876543210"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eu-department">Department</Label>
                <Input
                  id="eu-department"
                  placeholder="e.g. Sales"
                  value={form.department}
                  onChange={(e) => setField('department', e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="edit-user-form" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
