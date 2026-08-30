// Shared, pure formatting helpers for every tender-list view (the editable
// "All Tenders" sheet and the read-only Master Sheet). Kept in one place so
// the two views can never drift apart on how a value reads.

export function formatCurrency(val) {
  if (!val && val !== 0) return '—'
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`
  return `₹${val.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

// EMD exemption basis, shown wherever "EMD Exemption" is tabulated (CSV export, Sheets view).
// Distinct from "No EMD" (emd_not_applicable): exemption means an EMD is
// required but waived for MSME/Startup/Other reasons, while Not Applicable
// means the tender has no EMD clause at all.
export function formatEmdExemption(bid) {
  if (bid?.emd_not_applicable) return 'Not Applicable'
  if (!bid?.emd_exempted) return 'No'
  if (bid.emd_exemption_type === 'OTHER') return `Other: ${bid.emd_exemption_reason || 'N/A'}`
  if (bid.emd_exemption_type === 'MSME') return 'MSME'
  if (bid.emd_exemption_type === 'STARTUP') return 'Startup'
  return 'Yes'
}

export function isValidDate(dt) {
  if (!dt) return false
  const d = new Date(dt)
  if (isNaN(d.getTime())) return false
  if (d.getFullYear() <= 1970) return false
  return true
}

export function formatDate(dt, fallback = '—') {
  if (!isValidDate(dt)) return fallback
  return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function getBidStartDate(bid) {
  if (!bid) return 'Not Specified'
  if (isValidDate(bid.start_date)) return formatDate(bid.start_date)
  if (isValidDate(bid.opening_date)) return formatDate(bid.opening_date)
  return 'Not Specified'
}

export function getBidEndDate(bid) {
  if (!bid) return 'Not Specified'
  if (isValidDate(bid.end_date)) return formatDate(bid.end_date)
  if (isValidDate(bid.closing_date)) return formatDate(bid.closing_date)
  if (isValidDate(bid.submission_deadline)) return formatDate(bid.submission_deadline)
  if (isValidDate(bid.target_month_date)) return formatDate(bid.target_month_date)
  return 'Not Specified'
}

// End Date carries a real time-of-day (submission deadlines matter down to the
// hour) — unlike other sheet date columns, show it in full rather than truncating.
export function formatDateTime(dt, fallback = '—') {
  if (!isValidDate(dt)) return fallback
  return new Date(dt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function getTechEvalResultVal(bid) {
  if (bid.technical_result === 'QUALIFIED') return 'Qualified'
  if (bid.technical_result === 'DISQUALIFIED') return 'Disqualified'
  return 'Pending'
}

export function getTargetMonthDisplay(bid) {
  if (isValidDate(bid.target_month_date)) {
    return new Date(bid.target_month_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
  }
  const dateToUse = bid.end_date || bid.submission_date || bid.start_date || bid.opening_date
  if (isValidDate(dateToUse)) {
    return new Date(dateToUse).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
  }
  return '—'
}

export function getSubmissionStatusVal(bid) {
  if (bid.submission_status && bid.submission_status.trim() !== '') {
    return bid.submission_status
  }
  const stage = bid.workflow_stage || ''
  const status = bid.bid_status || ''
  if (['TECHNICAL_EVALUATION', 'FINANCIAL_EVALUATION', 'AWARD_HANDOVER'].includes(stage) || ['WON', 'LOST'].includes(status)) {
    return 'Submitted'
  }
  if (stage === 'GEM_SUBMISSION') {
    return 'Ready'
  }
  return 'Pending'
}

export function getFinEvalStatusVal(bid) {
  if (bid.financial_evaluation_status && bid.financial_evaluation_status.trim() !== '') {
    return bid.financial_evaluation_status
  }
  const stage = bid.workflow_stage || ''
  const status = bid.bid_status || ''
  if (stage === 'FINANCIAL_EVALUATION') return 'In Progress'
  if (stage === 'AWARD_HANDOVER' || status === 'WON') return 'Qualified (L1)'
  if (status === 'LOST') return 'Non-L1'
  if (stage === 'TECHNICAL_EVALUATION') return 'Awaiting Tech Clear'
  return 'Pending'
}

export function getPoRecvStatusVal(bid) {
  // Only show value from DB — never auto-set as PO Received just because bid is WON.
  // PO Received is manually toggled inside Stage 12 checklist.
  if (bid.po_received_status && bid.po_received_status.trim() !== '') {
    return bid.po_received_status
  }
  const status = bid.bid_status || ''
  if (status === 'LOST' || status === 'CANCELLED') return 'N/A'
  return 'Pending'
}

export function getBidResultVal(bid) {
  if (bid.bid_result && bid.bid_result.trim() !== '') {
    return bid.bid_result
  }
  const status = bid.bid_status || ''
  if (status === 'WON') return 'Won (L1)'
  if (status === 'LOST') return 'Lost'
  if (status === 'CANCELLED') return 'Cancelled'
  return 'Under Eval'
}

// Helper to escape CSV fields correctly according to RFC 4180
export function escapeCSV(val) {
  if (val === null || val === undefined) return ''
  let str = String(val)
  str = str.replace(/"/g, '""')
  if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
    return `"${str}"`
  }
  return str
}

export function getDerivedBidStatusAndOutcome(bid) {
  if (!bid) return { status: 'ACTIVE', outcome: null }

  const stage = bid.workflow_stage
  const rawStatus = bid.bid_status
  const rawOutcome = bid.bid_outcome

  if (stage === 'WON' || rawStatus === 'WON' || rawOutcome === 'WON') {
    return { status: 'WON', outcome: 'WON' }
  }
  if (stage === 'LOST' || rawStatus === 'LOST' || rawOutcome === 'LOST') {
    return { status: 'LOST', outcome: 'LOST' }
  }
  if (stage === 'CANCELLED' || rawStatus === 'CANCELLED' || rawOutcome === 'CANCELLED') {
    return { status: 'CANCELLED', outcome: 'CANCELLED' }
  }
  if (
    stage === 'GEM_SUBMISSION' ||
    stage === 'TECHNICAL_EVALUATION' ||
    stage === 'FINANCIAL_EVALUATION' ||
    rawStatus === 'TECHNICAL_EVALUATION' ||
    rawStatus === 'SUBMITTED' ||
    bid.submission_status === 'SUBMITTED' ||
    bid.submission_done === true
  ) {
    return { status: 'TECHNICAL_EVALUATION', outcome: null }
  }

  const result = (bid.bid_result || '').trim()
  const resultLower = result.toLowerCase()
  if (result) {
    if (resultLower.includes('l1') || resultLower.includes('won')) {
      return { status: 'WON', outcome: 'WON' }
    }
    if (
      resultLower !== 'result pending' &&
      resultLower !== 'na' &&
      resultLower !== 'bid in progress' &&
      resultLower !== 'pending'
    ) {
      return { status: 'LOST', outcome: 'LOST' }
    }
  }

  return { status: rawStatus || 'ACTIVE', outcome: rawOutcome || null }
}

