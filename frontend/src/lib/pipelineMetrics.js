// Single source of truth for "what does a tender's pipeline status mean" and
// the money/count rollups built on top of it. Dashboard.jsx and
// AnalyticsPage.jsx both import this instead of keeping their own copies —
// two independent copies is exactly how those two pages drifted apart before
// (Dashboard's Total Participated Value silently excluded submitted-then-
// closed tenders that Analytics already counted). One function, one answer.

// Resolves a bid's "effective" stage bucket — mirrors the precedence the
// backend itself uses (postgres.go's derived_status CASE and the
// performance-matrix won/lost/cancelled FILTERs): bid_status/bid_outcome win
// over the raw workflow_stage, because RecordOutcome doesn't mutate
// workflow_stage (a WON bid's workflow_stage is normally still
// 'AWARD_HANDOVER' or earlier, not the literal string 'WON').
export function getEffectiveStage(b) {
  if (b.bid_status === 'WON' || b.workflow_stage === 'WON' || b.bid_outcome === 'WON') return 'WON'
  if (b.bid_status === 'LOST' || b.workflow_stage === 'LOST' || b.bid_outcome === 'LOST' || b.technical_result === 'DISQUALIFIED') return 'LOST'
  if (b.bid_status === 'CANCELLED' || b.workflow_stage === 'CANCELLED' || b.bid_outcome === 'CANCELLED') return 'CANCELLED'
  // Closed without ever being bid. Its workflow_stage is still DISCOVERED, so
  // without this it would be charted as live pipeline.
  if (b.bid_status === 'CLOSED') return 'CLOSED'
  return b.workflow_stage || 'DISCOVERED'
}

export function isSubmitted(b) {
  return b.submission_done ||
    ['GEM_SUBMISSION', 'GE_M_SUBMISSION', 'TECHNICAL_EVALUATION', 'FINANCIAL_EVALUATION', 'AWARD_HANDOVER'].includes(b.workflow_stage) ||
    b.submission_status === 'SUBMITTED' || b.bid_status === 'SUBMITTED'
}

// A tender "participated" if we ever bid on it. CANCELLED never counts.
// CLOSED (no WON/LOST ever recorded) only counts if we actually submitted
// before it closed — a chunk of bulk-imported tenders were left CLOSED with
// no outcome rather than have the import fabricate a result (see commit
// 3053e7e). The other CLOSED tenders were genuinely never bid on.
export function isParticipated(b) {
  const stage = getEffectiveStage(b)
  if (stage === 'CANCELLED') return false
  if (stage === 'CLOSED') return isSubmitted(b)
  return true
}

// The live, unresolved slice of the pipeline — not yet WON/LOST/CANCELLED/CLOSED.
export function isActiveStage(b) {
  return !['WON', 'LOST', 'CANCELLED', 'CLOSED'].includes(getEffectiveStage(b))
}

// Prefers the actual final/submitted price over the original ballpark
// estimate when it's known — estimated_value can be set at discovery and
// never updated, while final_bid_value/quoted_price reflect what was
// actually submitted or awarded.
export function tenderValue(b) {
  return Number(b.final_bid_value || b.quoted_price || b.estimated_value || 0)
}

const AGING_BUCKET_DEFS = [
  { key: '0-7', label: '0–7 Days', max: 7, fill: '#10b981' },
  { key: '8-15', label: '8–15 Days', max: 15, fill: '#3b82f6' },
  { key: '16-30', label: '16–30 Days', max: 30, fill: '#f59e0b' },
  { key: '30-60', label: '30–60 Days', max: 60, fill: '#f97316' },
  { key: '60+', label: '60+ Days', max: Infinity, fill: '#ef4444' }
]

// One pass over a bid list, computing every pipeline number both pages need.
// `asOfMs` is supplied by the caller (e.g. lastUpdated.getTime()) rather than
// read internally via Date.now() — keeps this a pure function of its inputs,
// which React's exhaustive-deps/purity rules expect from anything called
// during render (see AnalyticsPage.jsx's aging-bucket fix for the bug this avoids).
export function computePipelineSummary(bids, asOfMs) {
  let totalPipelineValue = 0
  let activePipelineValue = 0
  let submittedPipelineValue = 0
  let wonVal = 0
  const totalPipelineBids = []
  const activeBids = []
  const submittedBidsList = []
  const wonBids = []
  const categoryMap = new Map()
  const monthMap = new Map()

  const agingBuckets = AGING_BUCKET_DEFS.map(def => ({ ...def, count: 0, value: 0, bids: [] }))

  bids.forEach(b => {
    const val = tenderValue(b)
    const stage = getEffectiveStage(b)
    const participated = isParticipated(b)
    const active = isActiveStage(b)
    const submitted = isSubmitted(b)

    if (participated) {
      totalPipelineValue += val
      totalPipelineBids.push(b)

      const cat = b.category || 'Uncategorized'
      const entry = categoryMap.get(cat) || { name: cat, value: 0, bids: [] }
      entry.value += val
      entry.bids.push(b)
      categoryMap.set(cat, entry)
    }
    if (active) {
      activePipelineValue += val
      activeBids.push(b)

      if (b.created_at && asOfMs != null) {
        const days = Math.floor((asOfMs - new Date(b.created_at).getTime()) / 86400000)
        const bucket = agingBuckets.find(bk => days <= bk.max) || agingBuckets[agingBuckets.length - 1]
        bucket.count += 1
        bucket.value += val
        bucket.bids.push(b)
      }
    }
    if (submitted) {
      submittedPipelineValue += val
      submittedBidsList.push(b)
    }
    if (stage === 'WON') {
      wonVal += val
      wonBids.push(b)
    }

    if (b.created_at) {
      const d = new Date(b.created_at)
      const monthKey = d.toLocaleString('en-US', { month: 'short', year: '2-digit' })
      const entry = monthMap.get(monthKey) || { month: monthKey, count: 0, valueLakhs: 0, timestamp: d.getTime() }
      entry.count += 1
      entry.valueLakhs += val / 100000
      monthMap.set(monthKey, entry)
    }
  })

  const categoryBreakdown = Array.from(categoryMap.values())
    .map(entry => ({ ...entry, valueLakhs: Math.round((entry.value / 100000) * 100) / 100 }))
    .sort((a, b) => b.value - a.value)

  const monthlyTrend = Array.from(monthMap.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(({ month, count, valueLakhs }) => ({ month, count, valueLakhs: Math.round(valueLakhs * 100) / 100 }))

  return {
    totalPipelineValue, totalPipelineBids,
    activePipelineValue, activeBids,
    submittedPipelineValue, submittedBidsList,
    wonVal, wonBids, wonCount: wonBids.length,
    agingBuckets, categoryBreakdown, monthlyTrend
  }
}
