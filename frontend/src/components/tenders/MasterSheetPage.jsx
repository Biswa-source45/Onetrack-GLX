import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Loader2, RefreshCw, LayoutList } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { listBids, listAllBids } from '../../services/bids'
import { ImportedPill } from './ImportedPill'
import { usePermissions } from '../../hooks/usePermissions'
import {
  formatCurrency, formatEmdExemption, formatDate,
  formatDateTime, getTargetMonthDisplay, getSubmissionStatusVal,
  getFinEvalStatusVal, getPoRecvStatusVal, getBidResultVal, escapeCSV,
} from '../../lib/tenderFormat'
import { StageBadge } from '../../lib/tenderDisplay'
import { statusStyle } from '../../services/bids'

const PAGE_SIZE = 100

// One filter pill per bid_status the backend derives (see derivedStatusExpr on
// the server) — Total is a pass-through with no filter. Keys must match
// meta.<key>_count from the list endpoint exactly.
const PILLS = [
  { key: '', label: 'Total', metaKey: 'total' },
  { key: 'ACTIVE', label: 'Active', metaKey: 'active_count' },
  { key: 'TECHNICAL_EVALUATION', label: 'Under Tech Eval', metaKey: 'tech_eval_count' },
  { key: 'WON', label: 'Won', metaKey: 'won_count' },
  { key: 'LOST', label: 'Lost', metaKey: 'lost_count' },
  { key: 'CANCELLED', label: 'Cancelled', metaKey: 'cancelled_count' },
  { key: 'CLOSED', label: 'Closed', metaKey: 'closed_count' },
]

// Column definitions for the read-only master view, in display order. Mirrors
// the editable "All Tenders" sheet column-for-column so the two views never
// show different data for the same tender - render() is the only thing that
// differs (plain text here, an input there).
const COLUMNS = [
  { key: 'title', label: 'Tender Title', minWidth: 240, sticky: true,
    render: (b) => b.title },
  { key: 'status', label: 'Status', minWidth: 110,
    render: (b) => <StatusPill status={b.bid_status} /> },
  { key: 'stage', label: 'Workflow Stage', minWidth: 170,
    render: (b) => <StageBadge stage={b.workflow_stage} /> },
  { key: 'category', label: 'Category', minWidth: 110,
    render: (b) => b.category ?? '—' },
  { key: 'bid_id', label: 'Bid ID', minWidth: 140, mono: true,
    render: (b) => b.gem_bid_no ?? b.bid_no ?? '—' },
  { key: 'platform', label: 'Platform', minWidth: 90,
    render: (b) => b.portal_source ?? '—' },
  { key: 'department', label: 'Department', minWidth: 170,
    render: (b) => b.organization_name ?? b.department_name ?? '—' },
  { key: 'scope', label: 'High Level Scope', minWidth: 220,
    render: (b) => b.high_level_scope ?? '—' },
  { key: 'quantity', label: 'Quantity', minWidth: 80,
    render: (b) => b.quantity ?? '—' },
  { key: 'scope_type', label: 'Scope Type', minWidth: 120,
    render: (b) => b.scope_type ?? '—' },
  { key: 'emd', label: 'EMD', minWidth: 100,
    render: (b) => formatCurrency(b.emd_amount) },
  { key: 'no_emd', label: 'No EMD', minWidth: 80,
    render: (b) => (b.emd_not_applicable ? 'Yes' : 'No') },
  { key: 'emd_exemption', label: 'EMD Exemption', minWidth: 120,
    render: (b) => formatEmdExemption(b) },
  { key: 'bg_rate', label: 'BG Rate (%)', minWidth: 100,
    render: (b) => (b.bg_rate != null ? `${b.bg_rate}%` : '—') },
  { key: 'target_month', label: 'Target Month', minWidth: 130,
    render: (b) => getTargetMonthDisplay(b) },
  { key: 'start_date', label: 'Start Date', minWidth: 120,
    render: (b) => formatDate(b.opening_date || b.start_date) },
  { key: 'end_date', label: 'End Date', minWidth: 170,
    render: (b) => formatDateTime(b.closing_date || b.end_date) },
  { key: 'estimated_value', label: 'Estimated Value', minWidth: 130,
    render: (b) => formatCurrency(b.estimated_value) },
  { key: 'globx_total', label: 'GlobX Total', minWidth: 130,
    render: (b) => formatCurrency(b.quoted_price) },
  { key: 'tech_eval', label: 'Tech Eval', minWidth: 110,
    render: (b) => (b.technical_result === 'QUALIFIED' ? 'Qualified' : b.technical_result === 'DISQUALIFIED' ? 'Disqualified' : 'Pending') },
  { key: 'submission_status', label: 'Submission Status', minWidth: 130,
    render: (b) => getSubmissionStatusVal(b) },
  { key: 'fin_eval', label: 'Fin Eval Status', minWidth: 140,
    render: (b) => getFinEvalStatusVal(b) },
  { key: 'po_received', label: 'PO Received', minWidth: 130,
    render: (b) => getPoRecvStatusVal(b) },
  { key: 'po_date', label: 'PO Received Date', minWidth: 130,
    render: (b) => formatDate(b.po_received_date) },
  { key: 'emd_ready_date', label: 'EMD Ready Date', minWidth: 130,
    render: (b) => formatDate(b.emd_ready_date) },
  { key: 'bg_issued_date', label: 'BG Issued Date', minWidth: 130,
    render: (b) => formatDate(b.bg_discharged_date) },
  { key: 'delivery_date', label: 'Delivery/Work Complete Date', minWidth: 150,
    render: (b) => formatDate(b.delivery_complete_date) },
  { key: 'our_rank', label: 'Our Rank', minWidth: 90, mono: true,
    render: (b) => b.our_rank ?? '—' },
  { key: 'result', label: 'Result', minWidth: 130,
    render: (b) => getBidResultVal(b) },
  { key: 'owner', label: 'Owner', minWidth: 120,
    render: (b) => b.bid_owner?.full_name ?? '—' },
  { key: 'remarks', label: 'Remarks', minWidth: 220,
    render: (b) => b.remarks ?? '—' },
]

function StatusPill({ status }) {
  const s = statusStyle(status)
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${s.pill}`}>
      {status}
    </span>
  )
}

/**
 * Master Sheet — every tender in the system, in one continuously-scrolling
 * table. No page-number pagination: the next batch of rows loads
 * automatically as the operator scrolls near the bottom (an intersection
 * observer on a sentinel row), on top of the same paginated /bids endpoint
 * the rest of the app already uses. A row of filter pills narrows the whole
 * scroll to one status at a time, matching the counts shown elsewhere in the
 * app exactly (same meta.*_count fields).
 */
export function MasterSheetPage() {
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()

  const [bids, setBids] = useState([])
  const [meta, setMeta] = useState({})
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [pillFilter, setPillFilter] = useState('')
  const [loadingFirst, setLoadingFirst] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)

  const sentinelRef = useRef(null)
  const requestSeq = useRef(0)

  const loadPage = useCallback(async (targetPage, filter, replace) => {
    const seq = ++requestSeq.current
    const res = await listBids({
      page: targetPage,
      limit: PAGE_SIZE,
      bid_status: filter || undefined,
    })
    // A newer request (filter changed while this one was in flight) wins -
    // drop this response rather than let it clobber fresher state.
    if (seq !== requestSeq.current) return
    if (!res.ok) {
      setError(res.error?.message || 'Failed to load tenders')
      return
    }
    const rows = Array.isArray(res.data) ? res.data : res.data?.bids || []
    setMeta(res.meta || {})
    setTotalPages(res.meta?.total_pages || 1)
    setPage(targetPage)
    setBids((prev) => (replace ? rows : [...prev, ...rows]))
    setError(null)
  }, [])

  // Initial load, and reload from scratch whenever the pill filter changes.
  useEffect(() => {
    let cancelled = false
    setLoadingFirst(true)
    setBids([])
    setPage(1)
    setTotalPages(1);
    (async () => {
      await loadPage(1, pillFilter, true)
      if (!cancelled) setLoadingFirst(false)
    })()
    return () => { cancelled = true }
  }, [pillFilter, loadPage])

  // Infinite scroll: observe a sentinel just past the last row: fetch the next
  // page as soon as it enters the viewport, so the table just keeps flowing.
  useEffect(() => {
    if (!sentinelRef.current) return
    const el = sentinelRef.current
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return
        if (loadingFirst || loadingMore) return
        if (page >= totalPages) return
        setLoadingMore(true)
        loadPage(page + 1, pillFilter, false).finally(() => setLoadingMore(false))
      },
      { rootMargin: '400px' } // start fetching well before the sentinel is actually visible
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [page, totalPages, loadingFirst, loadingMore, pillFilter, loadPage])

  const allLoaded = page >= totalPages && !loadingFirst

  async function handleExport() {
    setExporting(true)
    const toastId = toast.loading(pillFilter ? `Exporting ${PILLS.find(p => p.key === pillFilter)?.label} tenders…` : 'Exporting all tenders…')
    try {
      const res = await listAllBids(pillFilter ? { bid_status: pillFilter } : {})
      if (!res.ok) throw new Error(res.error?.message || 'Export failed')
      const rows = Array.isArray(res.data) ? res.data : res.data?.bids || []
      if (rows.length === 0) {
        toast.info('Nothing to export for this filter', { id: toastId })
        return
      }
      const headers = COLUMNS.map((c) => c.label)
      const csvRows = [headers.map(escapeCSV).join(',')]
      for (const b of rows) {
        csvRows.push(COLUMNS.map((c) => escapeCSV(plainText(c.render(b)))).join(','))
      }
      const blob = new Blob(['﻿' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `master_sheet_${pillFilter || 'all'}_${stamp}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Exported ${rows.length} tenders`, { id: toastId })
    } catch (err) {
      toast.error(err.message || 'Export failed', { id: toastId })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold text-foreground flex items-center gap-2">
            <LayoutList className="size-5 text-primary" />
            Master Sheet
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Every tender, one continuous sheet — scroll for more, no pages.
            {meta.total != null && ` ${bids.length} of ${meta.total} loaded.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="gap-1.5">
            {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            Export as Excel
          </Button>
        </div>
      </div>

      {/* ── Filter pills ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {PILLS.map((p) => (
          <button
            key={p.key || 'total'}
            onClick={() => setPillFilter(p.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              pillFilter === p.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-foreground border-border hover:border-primary/40'
            }`}
          >
            {p.label}
            <span className={`ml-1.5 ${pillFilter === p.key ? 'opacity-80' : 'text-muted-foreground'}`}>
              {meta[p.metaKey] ?? '—'}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-center justify-between">
          {error}
          <Button size="sm" variant="outline" onClick={() => loadPage(1, pillFilter, true)} className="gap-1.5">
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        </div>
      )}

      {/* ── The sheet ────────────────────────────────────────────────────── */}
      <div className="border border-border rounded-lg overflow-auto max-h-[75vh]">
        <table className="min-w-full w-max text-left border-collapse text-xs">
          <thead className="sticky top-0 z-20">
            <tr className="bg-muted/90 backdrop-blur border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  style={{ minWidth: c.minWidth }}
                  className={`p-3 border-r border-border ${c.sticky ? 'sticky left-0 z-30 bg-[color-mix(in_srgb,var(--muted)_90%,var(--card))]' : ''}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {bids.map((bid) => (
              <tr
                key={bid.id}
                onClick={() => hasPermission('bid.view') && navigate(`/dashboard/tenders/${bid.id}`)}
                className={`hover:bg-muted/30 transition-colors whitespace-nowrap align-middle cursor-pointer ${
                  ['CANCELLED', 'ARCHIVED', 'LOST', 'CLOSED'].includes(bid.bid_status) ? 'text-muted-foreground/85' : ''
                }`}
              >
                {COLUMNS.map((c) => (
                  <td
                    key={c.key}
                    className={`p-3 border-r border-border truncate max-w-xs ${c.mono ? 'font-mono text-primary' : ''} ${
                      c.sticky ? 'sticky left-0 z-10 bg-card font-semibold text-foreground' : ''
                    }`}
                  >
                    {c.key === 'title' ? (
                      <div className="flex items-center gap-1.5">
                        {bid.is_imported && <ImportedPill compact />}
                        <span className="truncate hover:underline">{c.render(bid)}</span>
                      </div>
                    ) : (
                      c.render(bid)
                    )}
                  </td>
                ))}
              </tr>
            ))}

            {(loadingFirst || loadingMore) && (
              <tr>
                <td colSpan={COLUMNS.length} className="p-4 text-center text-muted-foreground">
                  <Loader2 className="size-4 animate-spin inline mr-2" />
                  {loadingFirst ? 'Loading tenders…' : 'Loading more…'}
                </td>
              </tr>
            )}

            {!loadingFirst && bids.length === 0 && !error && (
              <tr>
                <td colSpan={COLUMNS.length} className="p-8 text-center text-muted-foreground">
                  No tenders match this filter.
                </td>
              </tr>
            )}

            {/* Scroll sentinel: triggers the next page fetch when it scrolls into view. */}
            <tr>
              <td colSpan={COLUMNS.length} className="p-0">
                <div ref={sentinelRef} className="h-px" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {allLoaded && bids.length > 0 && (
        <p className="text-center text-xs text-muted-foreground py-2">
          — end of list — {bids.length} tender{bids.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}

// Strips a React element down to its visible text, so cells rendered as JSX
// (StatusPill, StageBadge) still produce a sane plain-text CSV value.
function plainText(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return node
  if (Array.isArray(node)) return node.map(plainText).join('')
  if (node.props?.children != null) return plainText(node.props.children)
  return ''
}
