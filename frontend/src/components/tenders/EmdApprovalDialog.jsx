import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { approveEmd, rejectEmd, fmtMoney } from '../../services/emd'

export function EmdApprovalDialog({ open, onClose, bid, emd, mode = 'approve', onSuccess }) {
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!open || !bid || !emd) return null

  const isApprove = mode === 'approve'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isApprove && !remarks.trim()) {
      toast.error('Rejection remarks are mandatory')
      return
    }

    setSubmitting(true)
    try {
      const res = isApprove
        ? await approveEmd(bid.id, remarks.trim())
        : await rejectEmd(bid.id, remarks.trim())

      if (res.ok) {
        toast.success(isApprove ? 'EMD Approved! Finance team has been notified to proceed with payment.' : 'EMD Rejected and returned to Finance team with feedback.')
        onSuccess?.()
        onClose()
      } else {
        toast.error(res.message || 'Failed to process EMD decision')
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className={`p-4 border-b border-border flex items-center justify-between ${isApprove ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${isApprove ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
              {isApprove ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {isApprove ? 'MD Approval — EMD Sign-off' : 'Reject EMD Submission'}
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-1">{bid.title}</p>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Summary Box */}
          <div className="p-3.5 rounded-xl border border-border/80 bg-muted/30 space-y-2 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-border/60">
              <span className="text-muted-foreground">Tender:</span>
              <span className="font-semibold text-foreground text-right line-clamp-1">{bid.title}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">EMD Amount:</span>
              <span className="font-bold text-foreground font-mono text-sm">{fmtMoney(emd.emd_amount)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Reference Number:</span>
              <span className="font-medium text-foreground">{emd.reference_number || '—'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Purpose:</span>
              <span className="text-foreground">{emd.purpose || '—'}</span>
            </div>
            {emd.md_submitted_by && (
              <div className="flex justify-between items-center pt-2 border-t border-border/60">
                <span className="text-muted-foreground">Submitted By:</span>
                <span className="font-medium text-foreground">{emd.md_submitted_by.full_name} ({emd.md_submitted_by.role || 'Finance'})</span>
              </div>
            )}
          </div>

          {/* Remarks Field */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center justify-between">
              <span>{isApprove ? 'Approval Remarks (Optional)' : 'Rejection Reason *'}</span>
              {!isApprove && <span className="text-rose-500 font-normal text-[10px]">Mandatory</span>}
            </Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={isApprove ? 'Any special instructions or commercial notes for the Finance team...' : 'Specify why this EMD is rejected and what needs correction...'}
              className="text-xs min-h-[90px]"
              required={!isApprove}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className={`gap-1.5 text-xs font-semibold ${isApprove ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}`}
            >
              {submitting ? <Loader2 className="size-3.5 animate-spin" /> : isApprove ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
              {isApprove ? 'Confirm Approval' : 'Confirm Rejection'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
