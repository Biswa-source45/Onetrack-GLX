import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Dialogue box triggered whenever a user attempts to edit or save changes to a field
 * after the initial approval and completion of the respective workflow stage.
 */
export function StageModificationWarningDialog({
  open,
  isOpen,
  stageTitle = 'Current Stage',
  stageKey,
  fieldLabel,
  description,
  confirmLabel = 'Proceed with Modification',
  cancelLabel = 'Cancel',
  loading = false,
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
          onClick={loading ? undefined : onCancel}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 10 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          className="relative z-10 w-full max-w-md bg-card border border-amber-300/80 dark:border-amber-700/60 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start gap-3.5">
            <div className="size-10 rounded-xl bg-amber-100 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800 flex items-center justify-center shrink-0 shadow-xs">
              <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-heading text-base font-semibold text-foreground">
                  Modify Approved Stage?
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="size-2.5 text-emerald-600 dark:text-emerald-400" />
                  Completed
                </span>
              </div>
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Stage: {stageTitle}
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 rounded-xl p-3.5 text-xs text-muted-foreground leading-relaxed space-y-2">
            <p>
              {description || (
                <>
                  This stage (<strong className="text-foreground">{stageTitle}</strong>) has already received initial approval and was marked as completed.
                </>
              )}
            </p>
            <p className="text-foreground/90 font-medium">
              Modifying any fields now will update previously finalized data, record an audit event, and may necessitate re-verification by approvers or downstream stakeholders.
            </p>
            {fieldLabel && (
              <p className="text-[11px] text-amber-800 dark:text-amber-300 font-mono bg-amber-100/50 dark:bg-amber-900/30 px-2 py-1 rounded border border-amber-200/50">
                Target Field: {fieldLabel}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
            <Button
              id="stage-mod-cancel-btn"
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={onCancel}
              className="text-xs"
            >
              {cancelLabel}
            </Button>
            <Button
              id="stage-mod-proceed-btn"
              type="button"
              size="sm"
              disabled={loading}
              onClick={onConfirm}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 text-xs font-semibold shadow-sm"
            >
              <ShieldAlert className="size-3.5" />
              {confirmLabel}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
