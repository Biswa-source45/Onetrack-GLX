import React, { useState, useMemo } from 'react'
import {
  Calendar,
  TrendingUp,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Layers,
  FileText,
  ChevronRight,
  ExternalLink,
  HelpCircle,
  AlertCircle,
  IndianRupee,
  ShieldCheck,
  Building2,
  CalendarDays,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { formatCurrency, formatDate } from '../../lib/tenderFormat'
import { StageBadge } from '../../lib/tenderDisplay'
import { openMasterSheetDrill } from '../../lib/masterSheetDrill'

// Checks if a tender is in the active pipeline (not cancelled, closed, or lost)
function isActivePipeline(b) {
  const terminal = ['CANCELLED', 'CLOSED', 'LOST']
  if (terminal.includes(b.workflow_stage)) return false
  if (terminal.includes(b.bid_status)) return false
  if (b.bid_outcome === 'LOST') return false
  return true
}

// Checks if a tender requires an actual cash EMD deposit
function isEmdRequired(b) {
  if (b.emd_not_applicable) return false
  if (b.emd_exempted) return false
  if (Array.isArray(b.emd_exemption_types) && b.emd_exemption_types.length > 0) return false
  return true
}

// Retrieves the authoritative tender closing/submission deadline
function getTenderDeadline(b) {
  return b.closing_date || b.end_date || b.submission_deadline || null
}

export function EmdProjectionBlock({ bids = [], navigate }) {
  const [selectedFilter, setSelectedFilter] = useState('this_month')
  const [selectedCustomMonth, setSelectedCustomMonth] = useState('')

  // Calculate standard time periods
  const periods = useMemo(() => {
    const now = new Date()

    // 1. This Week (Monday 00:00:00 to Sunday 23:59:59)
    const day = now.getDay()
    const diffToMon = (day === 0 ? -6 : 1) - day
    const thisWeekStart = new Date(now)
    thisWeekStart.setDate(now.getDate() + diffToMon)
    thisWeekStart.setHours(0, 0, 0, 0)

    const thisWeekEnd = new Date(thisWeekStart)
    thisWeekEnd.setDate(thisWeekStart.getDate() + 6)
    thisWeekEnd.setHours(23, 59, 59, 999)

    // 2. Next Week
    const nextWeekStart = new Date(thisWeekStart)
    nextWeekStart.setDate(thisWeekStart.getDate() + 7)
    nextWeekStart.setHours(0, 0, 0, 0)

    const nextWeekEnd = new Date(nextWeekStart)
    nextWeekEnd.setDate(nextWeekStart.getDate() + 6)
    nextWeekEnd.setHours(23, 59, 59, 999)

    // 3. This Month
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    // 4. Next Month
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0)
    const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999)

    return {
      this_week: {
        key: 'this_week',
        label: 'This Week',
        start: thisWeekStart,
        end: thisWeekEnd,
        displayRange: `${thisWeekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${thisWeekEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
      },
      next_week: {
        key: 'next_week',
        label: 'Next Week',
        start: nextWeekStart,
        end: nextWeekEnd,
        displayRange: `${nextWeekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${nextWeekEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
      },
      this_month: {
        key: 'this_month',
        label: 'This Month',
        start: thisMonthStart,
        end: thisMonthEnd,
        displayRange: thisMonthStart.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      },
      next_month: {
        key: 'next_month',
        label: 'Next Month',
        start: nextMonthStart,
        end: nextMonthEnd,
        displayRange: nextMonthStart.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      },
    }
  }, [])

  // Current active date range
  const activePeriod = useMemo(() => {
    if (selectedFilter === 'custom_month' && selectedCustomMonth) {
      const [year, month] = selectedCustomMonth.split('-').map(Number)
      const start = new Date(year, month - 1, 1, 0, 0, 0, 0)
      const end = new Date(year, month, 0, 23, 59, 59, 999)
      const display = start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
      const now = new Date()
      const isPast = end < new Date(now.getFullYear(), now.getMonth(), 1)
      return {
        key: 'custom_month',
        label: display,
        start,
        end,
        displayRange: display,
        isPast,
      }
    }
    return periods[selectedFilter] || periods.this_month
  }, [selectedFilter, selectedCustomMonth, periods])

  // 1. Projected Bids for the active period
  const projectedBids = useMemo(() => {
    return bids.filter((b) => {
      if (!isActivePipeline(b)) return false
      if (!isEmdRequired(b)) return false
      const amount = Number(b.emd_amount)
      if (!amount || amount <= 0) return false

      const deadline = getTenderDeadline(b)
      if (!deadline) return false
      const dt = new Date(deadline)
      if (isNaN(dt.getTime())) return false

      return dt >= activePeriod.start && dt <= activePeriod.end
    }).sort((a, b) => {
      const da = new Date(getTenderDeadline(a) || 0)
      const db = new Date(getTenderDeadline(b) || 0)
      return da - db
    })
  }, [bids, activePeriod])

  const projectedTotalAmount = useMemo(() => {
    return projectedBids.reduce((sum, b) => sum + Number(b.emd_amount || 0), 0)
  }, [projectedBids])

  // Readiness breakdown within the projection
  const readyBids = useMemo(() => projectedBids.filter((b) => b.emd_ready || b.emd_returned), [projectedBids])
  const pendingPrepBids = useMemo(() => projectedBids.filter((b) => !b.emd_ready && !b.emd_returned), [projectedBids])
  const readyTotal = useMemo(() => readyBids.reduce((s, b) => s + Number(b.emd_amount || 0), 0), [readyBids])
  const pendingPrepTotal = useMemo(() => pendingPrepBids.reduce((s, b) => s + Number(b.emd_amount || 0), 0), [pendingPrepBids])

  // Calculation of This Week's numbers to display context when viewing This Month
  const thisWeekBids = useMemo(() => {
    const p = periods.this_week
    return bids.filter((b) => {
      if (!isActivePipeline(b)) return false
      if (!isEmdRequired(b)) return false
      const amount = Number(b.emd_amount)
      if (!amount || amount <= 0) return false
      const deadline = getTenderDeadline(b)
      if (!deadline) return false
      const dt = new Date(deadline)
      if (isNaN(dt.getTime())) return false
      return dt >= p.start && dt <= p.end
    })
  }, [bids, periods])

  const thisWeekTotal = useMemo(() => {
    return thisWeekBids.reduce((sum, b) => sum + Number(b.emd_amount || 0), 0)
  }, [thisWeekBids])

  // 2. Incomplete / Unspecified EMD Entries (Requirement 2.2)
  // Active pipeline tenders that require EMD but missing EMD amount or missing closing date
  const incompleteBids = useMemo(() => {
    return bids.filter((b) => {
      if (!isActivePipeline(b)) return false
      if (!isEmdRequired(b)) return false
      const amount = Number(b.emd_amount)
      const deadline = getTenderDeadline(b)
      const isMissingAmount = !amount || amount <= 0
      const isMissingDeadline = !deadline || isNaN(new Date(deadline).getTime())
      return isMissingAmount || isMissingDeadline
    })
  }, [bids])

  // 3. Total Pending Pipeline EMD across all active tenders awaiting deposit
  const allPendingPipelineBids = useMemo(() => {
    return bids.filter((b) => {
      if (!isActivePipeline(b)) return false
      if (!isEmdRequired(b)) return false
      const amount = Number(b.emd_amount)
      if (!amount || amount <= 0) return false
      return !b.emd_ready && !b.emd_returned
    })
  }, [bids])

  const allPendingPipelineTotal = useMemo(() => {
    return allPendingPipelineBids.reduce((s, b) => s + Number(b.emd_amount || 0), 0)
  }, [allPendingPipelineBids])

  // Drilldown handler that generates the unique /dashboard/tenders/master/:drillId route
  const handleDrilldown = (title, subtitle, targetBids) => {
    if (!navigate || targetBids.length === 0) return
    openMasterSheetDrill(navigate, {
      title,
      subtitle,
      bids: targetBids,
    })
  }

  // Future month dropdown options for forward projection
  // Extract past months that have active pipeline tenders requiring EMD
  const pastMonthsWithEmd = useMemo(() => {
    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const map = new Map()

    bids.forEach((b) => {
      if (!isActivePipeline(b)) return
      if (!isEmdRequired(b)) return
      const amount = Number(b.emd_amount)
      if (!amount || amount <= 0) return

      const deadline = getTenderDeadline(b)
      if (!deadline) return
      const dt = new Date(deadline)
      if (isNaN(dt.getTime())) return

      // Only past months (strictly before current month start)
      if (dt < currentMonthStart) {
        const y = dt.getFullYear()
        const m = dt.getMonth() + 1
        const key = `${y}-${String(m).padStart(2, '0')}`
        if (!map.has(key)) {
          const monthDate = new Date(y, m - 1, 1)
          map.set(key, {
            key,
            year: y,
            month: m,
            label: monthDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
            count: 0,
            totalAmount: 0,
          })
        }
        const entry = map.get(key)
        entry.count += 1
        entry.totalAmount += amount
      }
    })

    // Sort descending (most recent past first)
    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key))
  }, [bids])

  // Future month dropdown options for forward projection
  const allFutureMonths = useMemo(() => {
    const now = new Date()
    const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999)
    const map = new Map()

    // Default +2 to +5 future months
    for (let offset = 2; offset <= 5; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const key = `${y}-${String(m).padStart(2, '0')}`
      map.set(key, {
        key,
        year: y,
        month: m,
        label: d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
        count: 0,
        totalAmount: 0,
      })
    }

    // Check if bids have any future tenders beyond next month
    bids.forEach((b) => {
      if (!isActivePipeline(b)) return
      if (!isEmdRequired(b)) return
      const amount = Number(b.emd_amount)
      if (!amount || amount <= 0) return
      const deadline = getTenderDeadline(b)
      if (!deadline) return
      const dt = new Date(deadline)
      if (isNaN(dt.getTime())) return

      if (dt > nextMonthEnd) {
        const y = dt.getFullYear()
        const m = dt.getMonth() + 1
        const key = `${y}-${String(m).padStart(2, '0')}`
        if (!map.has(key)) {
          const d = new Date(y, m - 1, 1)
          map.set(key, {
            key,
            year: y,
            month: m,
            label: d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
            count: 0,
            totalAmount: 0,
          })
        }
        const entry = map.get(key)
        entry.count += 1
        entry.totalAmount += amount
      }
    })

    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key))
  }, [bids])

  return (
    <Card className="border-border bg-card shadow-xs overflow-hidden">
      {/* ── Header with Filters ─────────────────────────────────────────── */}
      <CardHeader className="pb-3 border-b border-border/60 bg-muted/10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CalendarDays className="size-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  EMD Projection & Pending Analysis
                </CardTitle>
                <CardDescription className="text-xs">
                  Projected capital required for upcoming tender deposits based on submission deadlines
                </CardDescription>
              </div>
            </div>
          </div>

          {/* Time Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {['this_week', 'next_week', 'this_month', 'next_month'].map((key) => {
              const p = periods[key]
              const isSelected = selectedFilter === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelectedFilter(key)
                    setSelectedCustomMonth('')
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-background text-muted-foreground border-border hover:text-foreground hover:border-border/80'
                  }`}
                >
                  {p.label}
                </button>
              )
            })}

            {/* Additional past/future months selector */}
            <select
              value={selectedFilter === 'custom_month' ? selectedCustomMonth : ''}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedCustomMonth(e.target.value)
                  setSelectedFilter('custom_month')
                }
              }}
              className={`h-7 text-xs rounded-full border px-2.5 bg-background text-foreground shadow-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring ${
                selectedFilter === 'custom_month'
                  ? 'border-primary text-primary font-semibold ring-1 ring-primary/30'
                  : 'border-border text-muted-foreground'
              }`}
            >
              <option value="" disabled>More Months...</option>

              {pastMonthsWithEmd.length > 0 && (
                <optgroup label="Past Months (Pending EMD)">
                  {pastMonthsWithEmd.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label} ({m.count} tender{m.count > 1 ? 's' : ''} • {formatCurrency(m.totalAmount)})
                    </option>
                  ))}
                </optgroup>
              )}

              <optgroup label="Upcoming Months">
                {allFutureMonths.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}{m.count > 0 ? ` (${m.count} tender{m.count > 1 ? 's' : ''} • ${formatCurrency(m.totalAmount)})` : ''}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        {/* ── KPI Cards Grid ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Projected / Pending EMD Required (Primary Clickable Card) */}
          <div
            onClick={() =>
              handleDrilldown(
                `${activePeriod.isPast ? 'Pending EMD' : 'Projected EMD'} (${activePeriod.label})`,
                `Tenders requiring EMD in ${activePeriod.displayRange}`,
                projectedBids
              )
            }
            className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 group ${
              projectedBids.length > 0
                ? 'cursor-pointer border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500 hover:shadow-md'
                : 'border-border bg-muted/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <IndianRupee className="size-3.5" />
                {activePeriod.isPast ? 'Pending EMD' : 'Projected EMD'} ({activePeriod.label})
              </span>
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-background">
                {activePeriod.displayRange}{activePeriod.isPast ? ' (Past)' : ''}
              </Badge>
            </div>

            <div>
              <p className="text-2xl font-extrabold font-heading text-emerald-600 dark:text-emerald-400">
                {formatCurrency(projectedTotalAmount)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
                <span>{projectedBids.length} tender(s) due for submission</span>
                {projectedBids.length > 0 && (
                  <span className="text-primary font-medium group-hover:underline inline-flex items-center gap-0.5">
                    Drill down <ArrowUpRight className="size-3" />
                  </span>
                )}
              </p>
              {selectedFilter === 'this_month' && thisWeekBids.length > 0 && (
                <div className="mt-2 pt-2 border-t border-emerald-500/15 text-[10px] text-emerald-700/90 dark:text-emerald-300/90 flex items-center justify-between font-medium">
                  <span>Includes This Week (current 7 days):</span>
                  <span className="font-mono font-bold">{formatCurrency(thisWeekTotal)} ({thisWeekBids.length})</span>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Deposit Readiness Breakdown */}
          <div className="p-4 rounded-xl border border-border bg-card flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-blue-500" />
                Deposit Readiness
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {projectedBids.length > 0
                  ? `${Math.round((readyBids.length / projectedBids.length) * 100)}% Ready`
                  : '0%'}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Ready / Prepared:</span>
                <span
                  onClick={() =>
                    readyBids.length > 0 &&
                    handleDrilldown('EMD Ready for Deposit', `Tenders in ${activePeriod.label} with EMD marked ready`, readyBids)
                  }
                  className={`font-semibold font-mono text-teal-600 dark:text-teal-400 ${
                    readyBids.length > 0 ? 'cursor-pointer hover:underline' : ''
                  }`}
                >
                  {formatCurrency(readyTotal)} ({readyBids.length})
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Needs Arrangement:</span>
                <span
                  onClick={() =>
                    pendingPrepBids.length > 0 &&
                    handleDrilldown('EMD Pending Arrangement', `Tenders in ${activePeriod.label} awaiting EMD preparation`, pendingPrepBids)
                  }
                  className={`font-semibold font-mono text-amber-600 dark:text-amber-400 ${
                    pendingPrepBids.length > 0 ? 'cursor-pointer hover:underline' : ''
                  }`}
                >
                  {formatCurrency(pendingPrepTotal)} ({pendingPrepBids.length})
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Incomplete / Unspecified EMD Entries (Requirement 2.2) */}
          <div
            onClick={() =>
              incompleteBids.length > 0 &&
              handleDrilldown(
                'Incomplete Tender Entries (EMD Pending)',
                'Active pipeline tenders requiring EMD where amount or deadline is missing',
                incompleteBids
              )
            }
            className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 group ${
              incompleteBids.length > 0
                ? 'cursor-pointer border-amber-500/30 bg-amber-500/5 hover:border-amber-500 hover:shadow-md'
                : 'border-border bg-card'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="size-3.5 text-amber-500" />
                Incomplete Entries
              </span>
              <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 dark:text-amber-400">
                Action Needed
              </Badge>
            </div>

            <div>
              <p className="text-2xl font-extrabold font-heading text-amber-600 dark:text-amber-400">
                {incompleteBids.length}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
                <span>Tenders missing EMD value/closing date</span>
                {incompleteBids.length > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 font-medium group-hover:underline inline-flex items-center gap-0.5">
                    Inspect <ArrowUpRight className="size-3" />
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Card 4: Total Active Pipeline EMD Pending Deposit */}
          <div
            onClick={() =>
              allPendingPipelineBids.length > 0 &&
              handleDrilldown(
                'All Active Pipeline EMD Pending',
                'All un-deposited EMD across active pipeline tenders (all dates and stages)',
                allPendingPipelineBids
              )
            }
            className={`p-4 rounded-xl border border-border bg-card flex flex-col justify-between space-y-3 group ${
              allPendingPipelineBids.length > 0 ? 'cursor-pointer hover:border-primary/40 hover:shadow-md' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="size-3.5 text-indigo-500" />
                All Pending Pipeline EMD
              </span>
              <Badge variant="outline" className="text-[10px] bg-muted/20">
                All Dates & Stages
              </Badge>
            </div>

            <div>
              <p className="text-2xl font-extrabold font-heading text-indigo-600 dark:text-indigo-400">
                {formatCurrency(allPendingPipelineTotal)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
                <span>{allPendingPipelineBids.length} total active tender(s)</span>
                {allPendingPipelineBids.length > 0 && (
                  <span className="text-primary font-medium group-hover:underline inline-flex items-center gap-0.5">
                    View all <ArrowUpRight className="size-3" />
                  </span>
                )}
              </p>
              {allPendingPipelineTotal > projectedTotalAmount && (
                <div className="mt-2 pt-2 border-t border-border/60 text-[10px] text-muted-foreground flex items-center justify-between">
                  <span>Outside {activePeriod.label}:</span>
                  <span className="font-mono font-medium text-foreground/80">
                    +{formatCurrency(allPendingPipelineTotal - projectedTotalAmount)} ({allPendingPipelineBids.length - projectedBids.length} other dates)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Upcoming Tenders Preview Table ───────────────────────────── */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                {activePeriod.isPast ? 'Tenders from' : 'Upcoming Deadlines in'} {activePeriod.label} ({projectedBids.length})
              </h4>
            </div>

            {projectedBids.length > 0 && (
              <Button
                variant="outline"
                size="xs"
                onClick={() =>
                  handleDrilldown(
                    `${activePeriod.isPast ? 'Pending EMD' : 'Projected EMD'} (${activePeriod.label})`,
                    `Tenders requiring EMD in ${activePeriod.displayRange}`,
                    projectedBids
                  )
                }
                className="text-xs gap-1.5 h-7 cursor-pointer hover:bg-primary/10 hover:text-primary"
              >
                <span>Open in Master Sheet</span>
                <ExternalLink className="size-3" />
              </Button>
            )}
          </div>

          {projectedBids.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 p-8 text-center bg-muted/5 space-y-2">
              <Calendar className="size-8 text-muted-foreground/40 mx-auto" />
              <p className="text-xs font-medium text-foreground">
                No active tenders requiring EMD found for {activePeriod.label} ({activePeriod.displayRange})
              </p>
              <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
                Tenders with EMD exemptions (MSME/Startup) or &apos;Not Applicable&apos; clauses are automatically excluded from cash projections.
              </p>
            </div>
          ) : (
            <div className="border border-border/80 rounded-xl overflow-hidden shadow-xs bg-background">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40 text-[11px]">
                    <TableHead className="w-[280px]">Tender Title & ID</TableHead>
                    <TableHead>Organization / Account</TableHead>
                    <TableHead>Submission Deadline</TableHead>
                    <TableHead className="text-right">EMD Amount</TableHead>
                    <TableHead className="text-center">Deposit Status</TableHead>
                    <TableHead className="text-center">Stage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectedBids.slice(0, 5).map((b) => {
                    const isReady = b.emd_ready || b.emd_returned
                    return (
                      <TableRow
                        key={b.id}
                        onClick={() => navigate(`/dashboard/tenders/${b.id}`)}
                        className="cursor-pointer hover:bg-muted/30 text-xs transition-colors"
                      >
                        <TableCell className="font-medium">
                          <div className="font-semibold text-foreground truncate max-w-[260px]" title={b.title}>
                            {b.title}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {b.gem_bid_no || b.bid_no || '—'}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground truncate max-w-[160px]">
                          {b.organization_name || b.department_name || '—'}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-foreground">
                            {formatDate(getTenderDeadline(b))}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(getTenderDeadline(b)).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-foreground">
                          {formatCurrency(b.emd_amount)}
                        </TableCell>
                        <TableCell className="text-center">
                          {isReady ? (
                            <Badge variant="outline" className="text-[10px] border-teal-500/30 text-teal-600 bg-teal-500/5">
                              Ready
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 bg-amber-500/5">
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <StageBadge stage={b.workflow_stage} />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {projectedBids.length > 5 && (
                <div className="p-2.5 bg-muted/20 border-t border-border/60 text-center">
                  <button
                    type="button"
                    onClick={() =>
                      handleDrilldown(
                        `${activePeriod.isPast ? 'Pending EMD' : 'Projected EMD'} (${activePeriod.label})`,
                        `Tenders requiring EMD in ${activePeriod.displayRange}`,
                        projectedBids
                      )
                    }
                    className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    View all {projectedBids.length} tenders in Master Sheet <ChevronRight className="size-3" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
