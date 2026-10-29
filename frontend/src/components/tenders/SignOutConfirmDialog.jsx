import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * SignOutConfirmDialog
 * Shown before logout when there are 0 pending tasks, asking:
 * "Are you sure you want to sign out?" with Yes/No choices.
 */
export function SignOutConfirmDialog({
  open,
  isOpen,
  title = 'Sign Out Confirmation',
  description = 'Are you sure you want to log out? You will need to sign in again to access your dashboard.',
  onConfirm,
  onCancel,
}) {
  const isVisible = Boolean(open ?? isOpen)
  if (!isVisible) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
          onClick={onCancel}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 10 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          className="relative z-10 w-full max-w-sm bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start gap-3.5">
            <div className="size-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 shadow-xs">
              <LogOut className="size-5 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="font-heading text-base font-bold text-foreground">
                {title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {description}
              </p>
            </div>
          </div>

          {/* Quick Notice */}
          <div className="p-3 rounded-xl bg-muted/50 border border-border/60 text-xs text-muted-foreground flex items-center gap-2">
            <HelpCircle className="size-4 text-primary shrink-0" />
            <span>You have 0 pending deadline tasks. All your work is up to date.</span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
            <Button
              id="cancel-signout-btn"
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="text-xs font-medium"
            >
              No, Cancel
            </Button>
            <Button
              id="confirm-signout-btn"
              type="button"
              variant="default"
              size="sm"
              onClick={onConfirm}
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 text-xs font-semibold shadow-sm"
            >
              <LogOut className="size-3.5" />
              Yes, Sign Out
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
