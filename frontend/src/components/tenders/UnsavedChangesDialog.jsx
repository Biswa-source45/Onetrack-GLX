import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, Trash2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Dialogue box shown whenever a user tries to navigate away or close an incomplete form
 * (e.g. "Add Tender", "Edit Tender") before submitting or finishing the form.
 */
export function UnsavedChangesDialog({
  open,
  isOpen,
  title = 'Discard Incomplete Form?',
  description = 'You have entered information in this form that has not been saved. If you leave now, your progress will be lost.',
  confirmLabel = 'Discard & Leave',
  cancelLabel = 'Keep Editing',
  onConfirm,
  onCancel,
}) {
  const isVisible = Boolean(open ?? isOpen)
  if (!isVisible) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-foreground/35 backdrop-blur-sm"
          onClick={onCancel}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 10 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          className="relative z-10 w-full max-w-md bg-card border border-rose-300/80 dark:border-rose-800/60 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start gap-3.5">
            <div className="size-10 rounded-xl bg-rose-100 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 flex items-center justify-center shrink-0 shadow-xs">
              <AlertCircle className="size-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="space-y-1">
              <h3 className="font-heading text-base font-semibold text-foreground">
                {title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {description}
              </p>
            </div>
          </div>

          <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 rounded-xl p-3 text-xs text-rose-900 dark:text-rose-300">
            ⚠️ Any text, document attachments, and field selections you made will be completely cleared.
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
            <Button
              id="keep-editing-btn"
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="text-xs"
            >
              {cancelLabel}
            </Button>
            <Button
              id="discard-leave-btn"
              type="button"
              variant="destructive"
              size="sm"
              onClick={onConfirm}
              className="gap-1.5 text-xs font-semibold shadow-sm"
            >
              <Trash2 className="size-3.5" />
              {confirmLabel}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
