import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

/**
 * In-app replacement for window.prompt() when rejecting a pending tender
 * action (Edit/Cancel/Delete approval) — collects an optional reason without
 * falling back to a native browser dialog. Renders nothing when closed.
 *
 * z-[70]: sits above EditTenderDialog's own root (z-50) and its nested
 * amOwnerCaution confirm (z-[60]), since this can be opened from within it.
 */
export function RejectReasonDialog({
  open, title = 'Reject', description, confirmLabel = 'Reject',
  loading = false, onConfirm, onCancel,
}) {
  const [reason, setReason] = useState('')

  const cancel = () => {
    if (loading) return
    setReason('')
    onCancel()
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
            onClick={cancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="relative z-10 w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl p-5 space-y-3"
          >
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {description && (
              <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
            )}
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)…"
              className="text-xs min-h-[80px]"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" disabled={loading} onClick={cancel}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={loading}
                onClick={() => onConfirm(reason.trim())}
              >
                {loading && <Loader2 className="size-3.5 animate-spin mr-1" />}
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
