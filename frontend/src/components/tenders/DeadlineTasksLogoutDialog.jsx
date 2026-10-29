import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Hourglass, AlertOctagon, AlarmClock, Siren, FileWarning, CheckCircle2, LogOut, ArrowRight, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

function formatApprovalKind(kind) {
  if (!kind) return 'Approval'
  switch (kind) {
    case 'PRICING':
      return 'Pricing Approval'
    case 'INTERNAL_APPROVAL':
      return 'Internal Sign-off'
    case 'DOC_SHORTFALL':
      return 'Document Shortfall'
    case 'EDIT':
      return 'Tender Edit Approval'
    case 'CANCEL':
      return 'Tender Cancellation'
    case 'DELETE':
      return 'Tender Deletion'
    default:
      return kind.replace(/_/g, ' ')
  }
}

export function getTaskDestination(tasks) {
  const { pendingApprovals = [], shortfallBids = [], endingSoonBids = [] } = tasks || {}

  // 1. Pending Approvals awaiting user
  if (pendingApprovals.length > 0) {
    const first = pendingApprovals[0]
    if (first.link) return first.link
    const bidId = first.bid_id || first.id
    if (bidId) {
      const stage = first.kind || first.type || 'INTERNAL_APPROVAL'
      return `/dashboard/tenders/${bidId}?tab=stages&stage=${stage}`
    }
  }

  // 2. Open Document Shortfall deadlines
  if (shortfallBids.length > 0) {
    const first = shortfallBids[0]
    if (first.id) {
      return `/dashboard/tenders/${first.id}?tab=stages&stage=TECHNICAL_EVALUATION`
    }
  }

  // 3. Tenders closing soon
  if (endingSoonBids.length > 0) {
    const first = endingSoonBids[0]
    if (first.id) {
      return `/dashboard/tenders/${first.id}`
    }
  }

  return '/dashboard/tenders/todos'
}

/**
 * Dialogue box shown when a user attempts to sign out while there are still
 * uncompleted deadline tasks, pending approvals, or high-alert tenders.
 */
export function DeadlineTasksLogoutDialog({
  open,
  isOpen,
  tasks = {
    pendingApprovals: [],
    endingSoonBids: [],
    shortfallBids: [],
  },
  onReview,
  onConfirmSignout,
  onCancel,
}) {
  const isVisible = Boolean(open ?? isOpen)
  if (!isVisible) return null

  const { pendingApprovals = [], endingSoonBids = [], shortfallBids = [] } = tasks
  const totalTasks = pendingApprovals.length + endingSoonBids.length + shortfallBids.length
  const primaryTaskLink = getTaskDestination(tasks)

  const handleReviewClick = (targetLink) => {
    const destination = targetLink || primaryTaskLink
    if (typeof onReview === 'function') {
      onReview(destination)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
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
          className="relative z-10 w-full max-w-lg bg-card border border-amber-300 dark:border-amber-700 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start gap-3.5">
            <div className="size-11 rounded-xl bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 flex items-center justify-center shrink-0 shadow-xs">
              <AlertOctagon className="size-6 text-amber-600 dark:text-amber-400 animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-heading text-lg font-bold text-foreground">
                  Incomplete Deadline Tasks
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  {totalTasks} Pending
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                You have active deadline tasks or urgent items requiring attention. Click any task below or click &quot;Review Tasks First&quot; to go directly to it.
              </p>
            </div>
          </div>

          {/* Task Summary List */}
          <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1 text-xs">
            {pendingApprovals.length > 0 && (
              <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 space-y-2">
                <div className="flex items-center justify-between font-semibold text-purple-900 dark:text-purple-300">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-purple-600 dark:text-purple-400" />
                    Pending Approvals Awaiting You
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200">
                    {pendingApprovals.length} item{pendingApprovals.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {pendingApprovals.slice(0, 4).map((a, i) => {
                    const taskLink = a.link || (a.bid_id ? `/dashboard/tenders/${a.bid_id}?tab=stages&stage=${a.kind || 'INTERNAL_APPROVAL'}` : null)
                    const label = formatApprovalKind(a.kind || a.type)
                    const title = a.bid_title || a.title || a.gem_bid_no || a.bid_no || 'Tender Approval'
                    return (
                      <button
                        key={a.id || a.bid_id || i}
                        type="button"
                        onClick={() => handleReviewClick(taskLink)}
                        className="w-full text-left p-2.5 rounded-xl bg-background/80 hover:bg-purple-100/70 dark:hover:bg-purple-900/40 border border-purple-200/60 dark:border-purple-800/50 transition-all flex items-center justify-between group shadow-2xs hover:shadow-xs hover:border-purple-300 cursor-pointer"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-purple-900 dark:text-purple-300 text-xs">
                              {label}
                            </span>
                            {a.gem_bid_no && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200">
                                {a.gem_bid_no}
                              </span>
                            )}
                          </div>
                          <p className="font-medium text-foreground text-xs truncate mt-0.5">
                            {title}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 dark:text-purple-300 shrink-0 bg-purple-100/70 dark:bg-purple-900/50 px-2 py-1 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition-all">
                          Go to Task <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      </button>
                    )
                  })}
                  {pendingApprovals.length > 4 && (
                    <p className="text-[10px] italic text-muted-foreground/80 pl-1">
                      +{pendingApprovals.length - 4} more approvals pending
                    </p>
                  )}
                </div>
              </div>
            )}

            {endingSoonBids.length > 0 && (
              <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800/60 space-y-2">
                <div className="flex items-center justify-between font-semibold text-rose-900 dark:text-rose-300">
                  <span className="flex items-center gap-1.5">
                    <Siren className="size-4 text-rose-600 dark:text-rose-400 animate-pulse" />
                    Red Zone Tenders (Critical Closing Deadline)
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200">
                    {endingSoonBids.length} item{endingSoonBids.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {endingSoonBids.slice(0, 4).map((b) => {
                    const taskLink = `/dashboard/tenders/${b.id}`
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleReviewClick(taskLink)}
                        className="w-full text-left p-2.5 rounded-xl bg-background/80 hover:bg-rose-100/70 dark:hover:bg-rose-900/40 border border-rose-200/60 dark:border-rose-800/50 transition-all flex items-center justify-between group shadow-2xs hover:shadow-xs hover:border-rose-300 cursor-pointer"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold tracking-wide shadow-2xs">
                              RED ZONE
                            </span>
                            {b.gem_bid_no && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200">
                                {b.gem_bid_no}
                              </span>
                            )}
                          </div>
                          <p className="font-medium text-foreground text-xs truncate mt-1">
                            {b.title}
                          </p>
                          <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 font-medium flex items-center gap-1">
                            <span>Threshold Reached · Closes</span>
                            <span>{b.closing_date ? new Date(b.closing_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Soon'}</span>
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300 shrink-0 bg-rose-100/70 dark:bg-rose-900/50 px-2 py-1 rounded-lg group-hover:bg-rose-600 group-hover:text-white transition-all">
                          Go to Tender <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      </button>
                    )
                  })}
                  {endingSoonBids.length > 4 && (
                    <p className="text-[10px] italic text-muted-foreground/80 pl-1">
                      +{endingSoonBids.length - 4} more red zone tenders
                    </p>
                  )}
                </div>
              </div>
            )}

            {shortfallBids.length > 0 && (
              <div className="p-3 rounded-xl bg-yellow-50/70 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800/60 space-y-2">
                <div className="flex items-center justify-between font-semibold text-yellow-900 dark:text-yellow-300">
                  <span className="flex items-center gap-1.5">
                    <FileWarning className="size-4 text-yellow-600 dark:text-yellow-400" />
                    Document Shortfall Deadlines Open
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200">
                    {shortfallBids.length} item{shortfallBids.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {shortfallBids.slice(0, 4).map((b) => {
                    const taskLink = `/dashboard/tenders/${b.id}?tab=stages&stage=TECHNICAL_EVALUATION`
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleReviewClick(taskLink)}
                        className="w-full text-left p-2.5 rounded-xl bg-background/80 hover:bg-yellow-100/70 dark:hover:bg-yellow-900/40 border border-yellow-200/60 dark:border-yellow-800/50 transition-all flex items-center justify-between group shadow-2xs hover:shadow-xs hover:border-yellow-300 cursor-pointer"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-yellow-900 dark:text-yellow-300 text-xs">
                              Document Shortfall
                            </span>
                            {b.gem_bid_no && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/60 text-yellow-800 dark:text-yellow-200">
                                {b.gem_bid_no}
                              </span>
                            )}
                          </div>
                          <p className="font-medium text-foreground text-xs truncate mt-0.5">
                            {b.title}
                          </p>
                          <p className="text-[10px] text-yellow-700 dark:text-yellow-400 mt-0.5 font-medium">
                            Shortfall response deadline active
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-yellow-800 dark:text-yellow-200 shrink-0 bg-yellow-100/70 dark:bg-yellow-900/50 px-2 py-1 rounded-lg group-hover:bg-yellow-600 group-hover:text-white transition-all">
                          Go to Task <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      </button>
                    )
                  })}
                  {shortfallBids.length > 4 && (
                    <p className="text-[10px] italic text-muted-foreground/80 pl-1">
                      +{shortfallBids.length - 4} more shortfall rounds
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-border/60">
            <Button
              id="signout-anyway-btn"
              type="button"
              variant="ghost"
              size="sm"
              onClick={onConfirmSignout}
              className="text-xs text-muted-foreground hover:text-destructive w-full sm:w-auto order-2 sm:order-1"
            >
              <LogOut className="size-3.5 mr-1" />
              Sign Out Anyway
            </Button>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end order-1 sm:order-2">
              <Button
                id="deadline-tasks-cancel-btn"
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                id="review-tasks-btn"
                type="button"
                size="sm"
                onClick={() => handleReviewClick(primaryTaskLink)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 text-xs font-semibold shadow-sm"
              >
                Review Tasks First
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
