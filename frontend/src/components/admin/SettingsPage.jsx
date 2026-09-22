import React, { useState, useEffect } from 'react'
import {
  Settings,
  Sliders,
  Workflow,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Users,
  Check,
  Loader2,
  Sparkles,
  Info,
  ArrowRight,
  Calculator,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { getSystemConfigs, updateSystemConfig } from '../../services/systemConfig'
import { useBidStore } from '../../store/useBidStore'

export function SettingsPage() {
  const { systemConfigs, loadSystemConfigs, setSystemConfigLocal } = useBidStore()
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState(null)

  useEffect(() => {
    let mounted = true
    loadSystemConfigs(true).finally(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [loadSystemConfigs])

  const requireAmPresales = systemConfigs?.stage2_require_am_presales !== false

  const suggestionWindow = systemConfigs?.pricing_suggestion_window ?? 5
  // null = not being edited right now — show the store's value directly,
  // no effect needed to keep a mirrored copy in sync with it.
  const [windowDraft, setWindowDraft] = useState(null)
  const windowInput = windowDraft ?? String(suggestionWindow)

  const handleSaveSuggestionWindow = async () => {
    const n = Math.min(20, Math.max(1, Math.round(Number(windowInput)) || 5))
    setSavingKey('pricing_suggestion_window')
    try {
      const res = await updateSystemConfig('pricing_suggestion_window', n)
      if (res.ok) {
        setSystemConfigLocal('pricing_suggestion_window', n)
        setWindowDraft(null)
        toast.success(`Pricing suggestions now average the last ${n} approved deal${n === 1 ? '' : 's'}`)
      } else {
        toast.error(res.error?.message || 'Failed to update setting')
      }
    } catch {
      toast.error('Network error updating setting')
    } finally {
      setSavingKey(null)
    }
  }

  const handleToggleStage2 = async () => {
    const nextVal = !requireAmPresales
    setSavingKey('stage2_require_am_presales')
    try {
      const res = await updateSystemConfig('stage2_require_am_presales', nextVal)
      if (res.ok) {
        setSystemConfigLocal('stage2_require_am_presales', nextVal)
        toast.success(
          nextVal
            ? 'Strict Account Manager & Pre-Sales workflow enabled'
            : 'Self-Managed Stage 2 enabled: Bid Owners & Reporting Managers can now complete Primary Review'
        )
      } else {
        toast.error(res.error?.message || 'Failed to update setting')
      }
    } catch {
      toast.error('Network error updating setting')
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* ── Top Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gradient-to-r from-card via-card to-muted/20 p-5 rounded-2xl border border-border shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Settings className="size-5" />
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
                Platform Configuration &amp; Settings
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Global operational policies, tender stage automation, and workflow gating controls.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono border-primary/30 text-primary bg-primary/5 px-2.5 py-1">
            Super Admin Restricted
          </Badge>
        </div>
      </div>

      {/* ── Section: Tender Lifecycle & Stage Automation ─────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border/60 pb-2">
          <Workflow className="size-4 text-primary" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Tender Lifecycle &amp; Stage Governance
          </h2>
        </div>

        {/* Setting Card: Stage 2 Primary Review AM & Pre-Sales Toggle */}
        <Card className="border-border bg-card shadow-xs overflow-hidden transition-all">
          <CardHeader className="p-5 pb-4 bg-muted/10 border-b border-border/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
                    <Sliders className="size-3.5" />
                  </div>
                  <CardTitle className="text-sm font-semibold text-foreground">
                    Stage 2: Primary Review — Pre-Sales &amp; Account Manager Involvement
                  </CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Controls whether Stage 2 strictly requires designated Account Manager and Pre-Sales personnel, or allows self-managed execution by Bid Owners &amp; Reporting Managers.
                </CardDescription>
              </div>

              {/* Status Badge */}
              <div className="shrink-0">
                {requireAmPresales ? (
                  <Badge variant="outline" className="text-xs font-medium border-indigo-500/30 text-indigo-700 dark:text-indigo-400 bg-indigo-500/5">
                    Strict AM / Pre-Sales Enforced
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs font-medium border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5">
                    Self-Managed (Bid Owner / Manager)
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-5">
            {/* Toggle Control Banner */}
            <div className="p-4 rounded-xl border border-border/80 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">
                    {requireAmPresales ? 'Require Account Manager & Pre-Sales Roles' : 'Allow Bid Owner & Reporting Manager Execution'}
                  </span>
                  {requireAmPresales ? (
                    <span className="text-[10px] text-muted-foreground font-mono">(Default Strict Flow)</span>
                  ) : (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">(Pipeline Unblocked)</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {requireAmPresales
                    ? 'Only the assigned Account Manager can finalize OEMs, set EMD decision, and mark Go/No-Go. Only assigned Pre-Sales can map candidate OEMs.'
                    : 'Bid Owners and Reporting Managers can directly map product OEMs, finalize selections, set EMD details, and mark Primary Review complete.'}
                </p>
              </div>

              {/* Toggle Switch Button */}
              <button
                type="button"
                role="switch"
                aria-checked={requireAmPresales}
                disabled={loading || savingKey === 'stage2_require_am_presales'}
                onClick={handleToggleStage2}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
                  requireAmPresales ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
              >
                <span className="sr-only">Toggle Account Manager and Pre-Sales Requirement</span>
                <span
                  className={`pointer-events-none inline-block size-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                    requireAmPresales ? 'translate-x-5' : 'translate-x-0'
                  }`}
                >
                  {savingKey === 'stage2_require_am_presales' ? (
                    <Loader2 className="size-3 animate-spin text-primary" />
                  ) : requireAmPresales ? (
                    <Check className="size-3 text-indigo-600 stroke-[3]" />
                  ) : null}
                </span>
              </button>
            </div>

            {/* Comparison / Flow Explanation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className={`p-3.5 rounded-xl border transition-all space-y-2 ${
                requireAmPresales ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-border/60 bg-muted/10 opacity-70'
              }`}>
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-indigo-500" />
                  <span className="text-xs font-bold text-foreground">When Enabled (Strict Flow)</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                  <li>Tender creation strictly mandates an assigned Account Manager.</li>
                  <li>Stage 2 buttons are locked for non-Account Managers.</li>
                  <li>Pre-Sales maps OEM candidates; Account Manager finalizes selections.</li>
                  <li>Suitable when designated Account Manager &amp; Pre-Sales teams are onboarded.</li>
                </ul>
              </div>

              <div className={`p-3.5 rounded-xl border transition-all space-y-2 ${
                !requireAmPresales ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border/60 bg-muted/10 opacity-70'
              }`}>
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-foreground">When Disabled (Self-Managed Flow)</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                  <li>Account Manager assignment is optional during tender creation.</li>
                  <li>Bid Owners &amp; Reporting Managers can map and finalize product OEMs.</li>
                  <li>EMD decision and Primary Review completion are immediately actionable.</li>
                  <li>In-progress tenders are never paused waiting for Account Manager onboarding.</li>
                </ul>
              </div>
            </div>

            {/* Safety & Audit Callout */}
            <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
                Zero-Risk Transition &amp; Audit Guarantee
              </div>
              <p className="leading-relaxed">
                Toggling this configuration has <strong>zero adverse effect</strong> on tenders that have already completed Stage 2. Completed milestones remain permanently recorded. Every configuration change is captured in the <strong>System Logs</strong> audit ledger with actor timestamp.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Section: Pricing Request ─────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border/60 pb-2">
          <Calculator className="size-4 text-primary" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Pricing Request — Suggested Price &amp; Margin
          </h2>
        </div>

        <Card className="border-border bg-card shadow-xs overflow-hidden transition-all">
          <CardHeader className="p-5 pb-4 bg-muted/10 border-b border-border/60">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Calculator className="size-3.5" />
                </div>
                <CardTitle className="text-sm font-semibold text-foreground">
                  Sliding Window Size
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                While pricing a product, the Pricing Request stage shows a suggested unit price (excl. GST) and margin % — the average of that exact product's last N approved deals across every tender. This sets N.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <div className="p-4 rounded-xl border border-border/80 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-foreground">Average the last N approved deals</span>
                <p className="text-xs text-muted-foreground">
                  A product with fewer than N past deals is averaged over however many exist; a never-priced product shows N/A.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Input
                  type="number" min={1} max={20}
                  value={windowInput}
                  onChange={(e) => setWindowDraft(e.target.value)}
                  className="h-9 w-20 text-sm text-center"
                  disabled={loading || savingKey === 'pricing_suggestion_window'}
                />
                <Button
                  size="sm"
                  onClick={handleSaveSuggestionWindow}
                  disabled={loading || savingKey === 'pricing_suggestion_window' || String(suggestionWindow) === windowInput}
                >
                  {savingKey === 'pricing_suggestion_window' ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
                  Save
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
