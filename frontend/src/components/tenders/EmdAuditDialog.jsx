import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { History, X, Clock, User, CheckCircle2, XCircle, FileText, ArrowRight, Loader2, ShieldCheck, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getEmdAuditLogs } from '../../services/emd'

const SLATE = 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300 border-slate-200'
const ROSE = 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200'

// action -> [icon, badge colour]
const ACTION_STYLE = {
  'UPDATED': [FileText, SLATE],
  'CLOSED': [FileText, SLATE],
  'SUBMITTED_MD_APPROVAL': [Clock, 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200'],
  'MD_APPROVED': [CheckCircle2, 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200'],
  'MD_REJECTED': [XCircle, ROSE],
  'PAYMENT_RECORDED': [DollarSign, 'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border-teal-200'],
  'VERIFIED': [ShieldCheck, 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200'],
  'VERIFICATION_REJECTED': [XCircle, ROSE],
  'REFUND_UPDATED': [ArrowRight, 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200'],
}

function fmtDate(dt) {
  if (!dt) return '—'
  const d = new Date(dt)
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export function EmdAuditDialog({ open, onClose, bidId, bidTitle }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open || !bidId) return
    let active = true
    setLoading(true)
    getEmdAuditLogs(bidId).then((res) => {
      if (!active) return
      if (res.ok) {
        setLogs(res.data || [])
      } else {
        toast.error(res.message || 'Could not load the audit history')
      }
      setLoading(false)
    }).catch(() => {
      if (active) {
        toast.error('Network error while loading the audit history')
        setLoading(false)
      }
    })
    return () => { active = false }
  }, [open, bidId])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <History className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">EMD Lifecycle Audit Trail</h3>
              <p className="text-xs text-muted-foreground line-clamp-1">{bidTitle || 'Tender EMD History'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-xs">Loading audit events...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <History className="size-8 mx-auto mb-2 opacity-40" />
              No audit records logged yet for this EMD.
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
              {logs.map((log) => {
                const [Icon, badgeColor] = ACTION_STYLE[log.action] || [History, 'bg-muted text-muted-foreground']

                return (
                  <div key={log.id} className="relative group">
                    {/* Timeline bullet */}
                    <div className="absolute -left-6 top-1 size-4 rounded-full border-2 border-background bg-primary ring-2 ring-primary/20 flex items-center justify-center" />

                    <div className="p-3.5 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${badgeColor}`}>
                            <Icon className="size-3" />
                            {log.action.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                            <User className="size-3 text-muted-foreground" />
                            {log.actor_name || 'System User'}
                            {log.actor_role && (
                              <span className="text-[10px] text-muted-foreground font-normal">
                                ({log.actor_role})
                              </span>
                            )}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3" />
                          {fmtDate(log.created_at)}
                        </span>
                      </div>

                      {log.remarks && (
                        <p className="text-xs text-foreground/90 bg-muted/40 p-2 rounded-lg border border-border/40 italic">
                          "{log.remarks}"
                        </p>
                      )}

                      {log.details && Object.keys(log.details).length > 0 && (
                        <div className="text-[11px] font-mono text-muted-foreground bg-muted/20 p-2 rounded border border-border/30 overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-muted/20 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
