import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Lock, LockOpen, Loader2, ShieldAlert, Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

import { getStageRestrictions, setStageRestrictions } from '../../services/users'
import { WORKFLOW_STAGES_ORDERED } from '../tenders/StageWorkspaces'

/**
 * StageAccessDialog — Stage-Level Access Control's toggle UI, reached from
 * the 3-dot menu on a Bid Executive row (see UserTable.jsx RowActions).
 *
 * Every stage starts open (unchecked stages array = full access, the
 * default for every user until an Admin/Manager explicitly locks one).
 * Unchecking a stage here locks it: the executive sees a "Restricted"
 * panel in that tender's workspace instead of the stage's form, and the
 * backend rejects any attempt to edit/transition into it directly.
 */
export function StageAccessDialog({ open, onOpenChange, user }) {
  const [restricted, setRestricted] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const userId = user?.id

  useEffect(() => {
    if (!open || !userId) return
    let cancelled = false
    setLoading(true)
    getStageRestrictions(userId).then((res) => {
      if (cancelled) return
      if (res.ok && res.data) {
        setRestricted(new Set(res.data.restricted_stages || []))
      } else {
        toast.error(res.error?.message || 'Failed to load stage access')
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [open, userId])

  function toggleStage(stage) {
    setRestricted((prev) => {
      const next = new Set(prev)
      if (next.has(stage)) next.delete(stage)
      else next.add(stage)
      return next
    })
  }

  function handleClose(val) {
    if (!saving) onOpenChange(val)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const result = await setStageRestrictions(userId, Array.from(restricted))
      if (result.ok && result.success) {
        toast.success(`Stage access updated for ${user.full_name || user.username}`)
        handleClose(false)
      } else {
        toast.error(result.error?.message || 'Failed to update stage access')
      }
    } catch {
      toast.error('Network error occurred while saving stage access.')
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null
  const displayName = user.full_name || user.username

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-primary" />
            Stage Access
          </DialogTitle>
          <DialogDescription>
            Control which lifecycle stages <span className="font-medium text-foreground">{displayName}</span> can view and act on. Unrestricted by default.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto divide-y divide-border">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <Loader2 className="size-5 animate-spin text-primary" />
              Loading stage access…
            </div>
          ) : (
            WORKFLOW_STAGES_ORDERED.map((stage, idx) => {
              const isRestricted = restricted.has(stage)
              return (
                <label
                  key={stage}
                  className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={!isRestricted}
                    onChange={() => toggleStage(stage)}
                    className="rounded"
                  />
                  <span className="text-[10px] font-mono text-muted-foreground w-4 shrink-0">{idx + 1}</span>
                  <span className={`flex-1 text-xs font-medium ${isRestricted ? 'text-muted-foreground' : 'text-foreground'}`}>
                    {stage.replace(/_/g, ' ')}
                  </span>
                  {isRestricted ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                      <Lock className="size-3" /> Locked
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full text-muted-foreground/70">
                      <LockOpen className="size-3" /> Open
                    </span>
                  )}
                </label>
              )
            })
          )}
        </div>

        <DialogFooter className="p-4 border-t border-border flex flex-row items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            {restricted.size === 0 ? 'Full access — no stages locked' : `${restricted.size} stage${restricted.size !== 1 ? 's' : ''} locked`}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => handleClose(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={loading || saving} className="gap-1.5">
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
