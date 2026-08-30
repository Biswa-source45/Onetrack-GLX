import React, { useState, useRef, useMemo } from 'react'
import {
  Upload, FileSpreadsheet, AlertTriangle, CheckCircle2,
  Loader2, X, ShieldAlert, SkipForward, Sparkles, LayoutGrid, ArrowLeft,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

import { usePermissions } from '../../hooks/usePermissions'
import { bulkImportTenders } from '../../services/bids'
import { ImportConsole } from './ImportConsole'
import { previewLines, commitLines, errorLines } from './importConsoleLines'

// Display order and labels for the derived lifecycle stages.
const STAGE_LABELS = {
  DISCOVERED: 'Discovered',
  OEM_AUTHORIZATION_REQUEST: 'OEM Authorization',
  PRICING_REQUEST: 'Pricing Request',
  DOCUMENT_CHECKLIST_PREPARATION: 'Document Checklist',
  EMD_PROCESSING: 'EMD Processing',
  INTERNAL_APPROVAL: 'Internal Approval',
  GEM_SUBMISSION: 'GeM Submission',
  TECHNICAL_EVALUATION: 'Technical Evaluation',
  FINANCIAL_EVALUATION: 'Financial Evaluation',
  AWARD_HANDOVER: 'Award & Handover',
  WON: 'Won',
  LOST: 'Lost',
  CANCELLED: 'Cancelled',
}
const STAGE_ORDER = Object.keys(STAGE_LABELS)

// Two source spreadsheets are in active use, with genuinely different column
// layouts and status models, so the operator names the format up front rather
// than the importer guessing from headers.
const FORMATS = [
  {
    id: 'gbx',
    name: 'GBX Tracker Format',
    description: 'The 25-column sheet: Category, Team, Bid Status, Final Result, Price Ranking…',
    hint: 'Expects the 25-column GBX Tracker layout',
    icon: LayoutGrid,
  },
  {
    id: 'dashboard',
    name: 'Tender Dashboard Format',
    description: 'The "TENDERS" sheet: Bid No, Bid Owner, L1–L4 Bidder & Price, Final Price After RA…',
    hint: 'Expects the Tender Dashboard "TENDERS" sheet (28 columns). A second "SUPPORTING BID" sheet, if present, is left untouched.',
    icon: Sparkles,
  },
]

export function BulkImportPage() {
  const { hasRole } = usePermissions()
  const isSuperAdmin = hasRole('SUPER_ADMIN')

  const [format, setFormat] = useState(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [done, setDone] = useState(null)
  const [lines, setLines] = useState([])
  const [runId, setRunId] = useState(0)
  const inputRef = useRef(null)

  const warningRows = useMemo(
    () => (preview?.rows || []).filter((r) => r.warnings?.length),
    [preview]
  )

  function reset() {
    setFormat(null)
    setFile(null)
    setPreview(null)
    setDone(null)
    setLines([])
    setRunId((n) => n + 1)
    if (inputRef.current) inputRef.current.value = ''
  }

  function backToFormat() {
    setFile(null)
    setPreview(null)
    setDone(null)
    setLines([])
    setRunId((n) => n + 1)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleFile(selected) {
    if (!selected) return
    if (!selected.name.toLowerCase().endsWith('.xlsx')) {
      toast.error('Please choose a .xlsx workbook')
      return
    }
    setFile(selected)
    setPreview(null)
    setDone(null)
    setLoading(true)
    setRunId((n) => n + 1)
    setLines([
      { tone: 'dim', text: `$ onetrack import --file "${selected.name}" --format ${format} --dry-run` },
      { tone: 'info', text: 'uploading workbook…' },
      { tone: 'info', text: 'parsing rows and checking for duplicates…' },
    ])
    try {
      const res = await bulkImportTenders(selected, { dryRun: true, format })
      if (!res.ok) {
        const msg = res.error?.message || 'Could not read that workbook'
        setLines(errorLines(selected.name, msg))
        toast.error(msg)
        setFile(null)
        return
      }
      setPreview(res.data)
      setLines(previewLines(selected.name, res.data))
      toast.success(`Parsed ${res.data.row_count} rows — nothing written yet`)
    } catch (err) {
      const msg = err.message || 'Preview failed'
      setLines(errorLines(selected.name, msg))
      toast.error(msg)
      setFile(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleCommit() {
    if (!file || !preview) return
    setCommitting(true)
    setRunId((n) => n + 1)
    setLines([
      { tone: 'dim', text: `$ onetrack import --file "${file.name}" --format ${format} --commit` },
      { tone: 'info', text: 'uploading workbook…' },
      { tone: 'info', text: 'opening transaction…' },
    ])
    try {
      const res = await bulkImportTenders(file, { dryRun: false, format })
      if (!res.ok) {
        const msg = res.error?.message || 'Import failed — nothing was saved'
        setLines(errorLines(file.name, msg))
        toast.error(msg)
        return
      }
      setDone(res.data)
      setLines(commitLines(file.name, res.data))
      setPreview(null)
      toast.success(`Imported ${res.data.created_ids?.length ?? 0} tenders`)
    } catch (err) {
      const msg = err.message || 'Import failed'
      setLines(errorLines(file.name, msg))
      toast.error(msg)
    } finally {
      setCommitting(false)
    }
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <ShieldAlert className="size-10 text-muted-foreground" />
        <h2 className="font-heading text-lg font-semibold">Restricted</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Bulk import is available to Super Admins only.
        </p>
      </div>
    )
  }

  const busy = loading || committing
  const activeFormat = FORMATS.find((f) => f.id === format)

  return (
    <div className="space-y-6">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold text-foreground flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" />
            Bulk Import Tenders
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeFormat
              ? activeFormat.hint
              : 'Choose the sheet format, then upload. Every row is previewed before anything is saved, and tenders already in OneTrack are skipped or enriched, never duplicated.'}
          </p>
        </div>
        {format && !busy && (
          <Button
            variant="outline"
            onClick={preview || done ? reset : backToFormat}
            className="self-start sm:self-auto gap-1.5"
          >
            {preview || done ? <X className="size-4" /> : <ArrowLeft className="size-4" />}
            {preview || done ? 'Start over' : 'Change format'}
          </Button>
        )}
      </div>

      <Separator />

      {/* ── Step 0: choose which sheet format this file is ─────────────────── */}
      {!format && (
        <div className="grid gap-3 sm:grid-cols-2">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className="text-left rounded-lg border border-border p-5 hover:border-primary/50 hover:bg-muted/30 transition-colors group"
            >
              <div className="flex items-center gap-2 mb-2">
                <f.icon className="size-5 text-primary" />
                <span className="font-semibold text-sm">{f.name}</span>
              </div>
              <p className="text-xs text-muted-foreground">{f.description}</p>
            </button>
          ))}
        </div>
      )}

      {/* ── Step 1: choose a file ────────────────────────────────────────── */}
      {format && !preview && !done && !busy && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            handleFile(e.dataTransfer.files?.[0])
          }}
          className="border-2 border-dashed border-border rounded-lg p-10 flex flex-col items-center gap-3 text-center"
        >
          <Upload className="size-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Drop the .xlsx here, or choose a file</p>
            <p className="text-xs text-muted-foreground mt-1">{activeFormat?.hint}</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <Button onClick={() => inputRef.current?.click()} className="gap-1.5">
            <FileSpreadsheet className="size-4" />
            Choose file
          </Button>
        </div>
      )}

      {/* ── Live console ─────────────────────────────────────────────────── */}
      {lines.length > 0 && (
        <ImportConsole
          key={runId}
          lines={lines}
          running={busy}
          doneLabel={done ? 'done' : preview ? 'awaiting confirmation' : null}
        />
      )}

      {/* ── Step 2: preview summary + confirm ────────────────────────────── */}
      {preview && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <Badge variant="secondary">{file?.name}</Badge>
            <Badge variant="outline">{activeFormat?.name}</Badge>
            <span className="text-muted-foreground">
              {preview.row_count} rows read — <strong className="text-foreground">{preview.import_count} will be imported</strong>
              {preview.skipped?.length > 0 && `, ${preview.skipped.length} skipped`}
            </span>
          </div>

          {/* A second sheet exists but was not touched (Tender Dashboard's "SUPPORTING BID") */}
          {preview.skipped_sheets?.length > 0 && (
            <div className="rounded-md border border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-300">
              {preview.skipped_sheets.map((s) => (
                <div key={s.name}>
                  This workbook also has a <strong>“{s.name}”</strong> sheet ({s.rows} rows) — not imported this round.
                </div>
              ))}
            </div>
          )}

          {/* Skipped as already present */}
          {preview.skipped?.length > 0 && (
            <div className="rounded-md border border-border p-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                <SkipForward className="size-4 text-sky-500" />
                Skipped — already present ({preview.skipped.length})
              </h3>
              <p className="text-xs text-muted-foreground mb-2">
                These tender IDs already exist, so a new copy will not be added.
                {format === 'dashboard' && ' Any field the existing tender is missing will be filled in from this row instead.'}
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {preview.skipped.map((s) => (
                  <div key={s.row} className="text-xs">
                    <span className="font-mono text-muted-foreground">row {s.row}</span>{' '}
                    <span className="font-mono text-sky-600 dark:text-sky-400">{s.bid_id || '(no id)'}</span>{' '}
                    <span className="text-foreground">— {s.reason}</span>
                    {s.enriched?.length > 0 && (
                      <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                        (will add: {s.enriched.join(', ')})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Derived stage breakdown */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Where these tenders will land</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {STAGE_ORDER.filter((s) => preview.stage_counts?.[s]).map((s) => (
                <div
                  key={s}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                >
                  <span className="text-sm">{STAGE_LABELS[s]}</span>
                  <Badge variant="outline">{preview.stage_counts[s]}</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Rows the importer had to interpret */}
          {warningRows.length > 0 && (
            <div className="rounded-md border border-border p-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                <AlertTriangle className="size-4 text-amber-500" />
                Rows to review ({warningRows.length})
              </h3>
              <p className="text-xs text-muted-foreground mb-2">
                These import fine — the importer repaired or interpreted a value and is telling you so.
              </p>
              <div className="max-h-64 overflow-y-auto space-y-1.5">
                {warningRows.map((r) => (
                  <div key={r.row} className="text-xs">
                    <span className="font-mono text-muted-foreground">row {r.row}</span>{' '}
                    <span className="text-foreground">{r.warnings.join('; ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              onClick={handleCommit}
              disabled={committing || preview.import_count === 0}
              className="gap-1.5"
            >
              {committing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {committing
                ? 'Importing…'
                : preview.import_count === 0
                  ? 'Nothing new to import'
                  : `Confirm import of ${preview.import_count} tenders`}
            </Button>
            <Button variant="ghost" onClick={reset} disabled={committing}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: result ───────────────────────────────────────────────── */}
      {done && (
        <div className="rounded-md border border-border p-6 flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="size-8 text-emerald-500" />
          <h3 className="font-heading text-lg font-semibold">
            Imported {done.created_ids?.length ?? 0} tenders
          </h3>
          <p className="text-sm text-muted-foreground">
            {done.skipped?.length > 0
              ? `${done.skipped.length} row(s) were skipped because they already existed${
                  done.skipped.some((s) => s.enriched?.length) ? ' — some were enriched with new data from this file' : ''
                }. `
              : ''}
            They are owned by you and can be reassigned from each tender.
          </p>
        </div>
      )}
    </div>
  )
}
