import React, { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, KeyRound, TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'

import { forcePasswordReset } from '../../services/users'

/**
 * ForceResetDialog
 *
 * Maps to: PATCH /api/v1/auth/force-reset
 * Requires: user.edit permission on the calling user
 *
 * After the call succeeds the target user will have:
 *   force_password_change = true
 * and will be required to change their password on next login.
 *
 * Props:
 *   open        {boolean}
 *   onOpenChange {(open: boolean) => void}
 *   user        {object}
 *   onDone      {() => void}
 */
export function ForceResetDialog({ open, onOpenChange, user, onDone }) {
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleClose(val) {
    if (!loading) {
      setNewPassword('')
      setError('')
      onOpenChange(val)
    }
  }

  async function handleConfirm() {
    if (newPassword.length < 8) {
      setError('Temporary password must be at least 8 characters.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const result = await forcePasswordReset(user.id, newPassword)
      if (result.ok && result.success) {
        toast.success(`Password reset for @${user.username}. They must change it on next login.`)
        onDone?.()
        handleClose(false)
      } else {
        const msg = result.error?.message || 'Failed to reset password'
        toast.error(msg)
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-amber-500" />
            Force Password Reset
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Set a temporary password for{' '}
                <span className="font-medium text-foreground">@{user.username}</span>.
                They will be required to change it on their next login.
              </p>
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                <TriangleAlert className="size-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                  This will invalidate their current session if they are logged in. The user will need to log in again with the temporary password.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fr-new-password" className="text-sm font-medium text-foreground">
                  Temporary Password <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="fr-new-password"
                  type="text"
                  placeholder="Min. 8 characters"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setError('') }}
                  disabled={loading}
                  aria-invalid={!!error}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          {/* AlertDialogCancel triggers Radix's close handler + our cleanup */}
          <AlertDialogCancel disabled={loading}>
            Cancel
          </AlertDialogCancel>
          {/* Use a plain Button for the async confirm action — NOT AlertDialogAction,
              because we need to control closing ourselves after the API responds. */}
          <Button
            variant="default"
            onClick={handleConfirm}
            disabled={loading || !newPassword}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            Reset Password
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
