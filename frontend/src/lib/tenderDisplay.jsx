import React from 'react'
import { CheckCircle2, XCircle, Clock, Archive } from 'lucide-react'
import { STAGE_LABELS, STAGE_COLORS, STATUS_COLORS } from '../services/bids'

// Small shared badge/pill components for tender-list views. Pure formatting
// helpers live in ./tenderFormat.js - kept separate so this file exports only
// components (Fast Refresh requirement).

export function StageBadge({ stage }) {
  const color = STAGE_COLORS[stage] ?? 'bg-gray-100 text-gray-600 border-gray-200'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${color}`}>
      {STAGE_LABELS[stage] ?? stage}
    </span>
  )
}

const STATUS_DISPLAY_LABELS = {
  WON: 'Won',
  LOST: 'Lost',
  CANCELLED: 'Cancelled',
  SUBMITTED: 'Submitted',
  TECHNICAL_EVALUATION: 'Under Tech Eval',
  ACTIVE: 'Active',
  ARCHIVED: 'Archived',
  CLOSED: 'Closed',
}

export function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'
  const icons = {
    WON: <CheckCircle2 className="size-3 mr-1 text-emerald-600" />,
    LOST: <XCircle className="size-3 mr-1 text-orange-600" />,
    CANCELLED: <XCircle className="size-3 mr-1 text-red-600" />,
    SUBMITTED: <CheckCircle2 className="size-3 mr-1 text-lime-600" />,
    TECHNICAL_EVALUATION: <Clock className="size-3 mr-1 text-teal-600" />,
    ACTIVE: <span className="size-1.5 rounded-full bg-emerald-500 mr-1.5" />,
    ARCHIVED: <Archive className="size-3 mr-1" />,
    CLOSED: <Archive className="size-3 mr-1 text-zinc-500" />,
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${color}`}>
      {icons[status]}
      {STATUS_DISPLAY_LABELS[status] ?? status}
    </span>
  )
}

export function StatusTag({ text, variant = 'neutral' }) {
  if (!text || text === '—') return <span className="text-muted-foreground">—</span>
  const styles = {
    green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    red: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    neutral: 'bg-muted text-muted-foreground border-border',
  }
  let v = variant
  const lower = text.toLowerCase()
  if (lower.includes('submi') || lower.includes('won') || lower.includes('qualified') || lower.includes('recv') || lower.includes('received') || lower.includes('yes') || lower.includes('ready')) {
    v = 'green'
  } else if (lower.includes('eval') || lower.includes('progress') || lower.includes('under')) {
    v = 'blue'
  } else if (lower.includes('pend') || lower.includes('await')) {
    v = 'amber'
  } else if (lower.includes('lost') || lower.includes('non') || lower.includes('cancel')) {
    v = 'red'
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${styles[v]}`}>
      {text}
    </span>
  )
}
