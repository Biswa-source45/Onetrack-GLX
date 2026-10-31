/**
 * Column sorting utilities for Tender Sheet views (TendersPage, MasterSheetPage, Quick To-Dos).
 * Supports text (A-Z / Z-A), dates (closest/earliest vs farthest/latest), and numbers (low-high vs high-low).
 */

const DATE_KEYS = new Set([
  'end_date',
  'start_date',
  'created_at',
  'po_date',
  'emd_ready_date',
  'bg_issued_date',
  'delivery_date',
])

const NUMERIC_KEYS = new Set([
  'estimated_value',
  'globx_total',
  'emd',
  'bg_rate',
  'quantity',
])

export function isDateColumn(key) {
  return DATE_KEYS.has(key)
}

export function isNumericColumn(key) {
  return NUMERIC_KEYS.has(key)
}

export function getSortDirections(key) {
  if (isDateColumn(key)) {
    return {
      asc: 'Earliest / Closest first',
      desc: 'Latest / Farthest first',
      ascShort: 'Earliest',
      descShort: 'Latest',
    }
  }
  if (isNumericColumn(key)) {
    return {
      asc: 'Lowest to Highest',
      desc: 'Highest to Lowest',
      ascShort: 'Low → High',
      descShort: 'High → Low',
    }
  }
  return {
    asc: 'A → Z (Alphabetical)',
    desc: 'Z → A (Reverse)',
    ascShort: 'A → Z',
    descShort: 'Z → A',
  }
}

/**
 * Extracts a normalized comparable value from a tender/bid object for sorting.
 * Returns null for missing/empty values so they consistently sort to the bottom.
 */
export function getSortValue(bid, key) {
  if (!bid) return null

  switch (key) {
    case 'account_name':
      return bid.organization_name ? bid.organization_name.trim().toLowerCase() : null

    case 'title':
      return bid.title ? bid.title.trim().toLowerCase() : null

    case 'bid_id': {
      const id = bid.gem_bid_no || bid.bid_no
      return id ? id.trim().toLowerCase() : null
    }

    case 'department': {
      const dept = bid.department_name || bid.department || bid.ministry_name
      return dept ? dept.trim().toLowerCase() : null
    }

    case 'location':
      return bid.location ? bid.location.trim().toLowerCase() : null

    case 'scope': {
      const sc = bid.high_level_scope || bid.scope_of_work
      return sc ? sc.trim().toLowerCase() : null
    }

    case 'estimated_value':
      return bid.estimated_value != null && !isNaN(bid.estimated_value)
        ? Number(bid.estimated_value)
        : null

    case 'emd':
      return bid.emd_amount != null && !isNaN(bid.emd_amount)
        ? Number(bid.emd_amount)
        : null

    case 'status':
      return bid.bid_status ? bid.bid_status.trim().toLowerCase() : null

    case 'category':
      return bid.category ? bid.category.trim().toLowerCase() : null

    case 'platform':
      return bid.portal_source ? bid.portal_source.trim().toLowerCase() : null

    case 'quantity':
      return bid.quantity != null && !isNaN(bid.quantity) ? Number(bid.quantity) : null

    case 'scope_type':
      return bid.scope_type ? bid.scope_type.trim().toLowerCase() : null

    case 'support_type':
      return bid.support_type ? (bid.support_type + (bid.support_partner_name ? ` ${bid.support_partner_name}` : '')).toLowerCase() : 'globx'

    case 'no_emd':
      return bid.emd_not_applicable != null ? (bid.emd_not_applicable ? 1 : 0) : null

    case 'emd_exemption':
      return bid.emd_exempted != null ? (bid.emd_exempted ? 1 : 0) : null

    case 'bg_rate':
      return bid.bg_rate != null && !isNaN(bid.bg_rate) ? Number(bid.bg_rate) : null

    case 'target_month':
      return bid.target_month ? bid.target_month.trim().toLowerCase() : null

    case 'start_date': {
      const d = bid.opening_date || bid.start_date
      if (!d) return null
      const t = new Date(d).getTime()
      return isNaN(t) ? null : t
    }

    case 'end_date': {
      const d = bid.closing_date || bid.end_date
      if (!d) return null
      const t = new Date(d).getTime()
      return isNaN(t) ? null : t
    }

    case 'created_at': {
      if (!bid.created_at) return null
      const t = new Date(bid.created_at).getTime()
      return isNaN(t) ? null : t
    }

    case 'globx_total':
      return bid.quoted_price != null && !isNaN(bid.quoted_price)
        ? Number(bid.quoted_price)
        : null

    case 'tech_eval': {
      const te = bid.technical_result || bid.tech_eval_status
      return te ? te.trim().toLowerCase() : null
    }

    case 'submission_status':
      return bid.submission_status ? bid.submission_status.trim().toLowerCase() : null

    case 'fin_eval':
      return bid.fin_eval_status ? bid.fin_eval_status.trim().toLowerCase() : null

    case 'po_received':
      return bid.po_received ? bid.po_received.trim().toLowerCase() : null

    case 'po_date': {
      if (!bid.po_received_date) return null
      const t = new Date(bid.po_received_date).getTime()
      return isNaN(t) ? null : t
    }

    case 'emd_ready_date': {
      if (!bid.emd_ready_date) return null
      const t = new Date(bid.emd_ready_date).getTime()
      return isNaN(t) ? null : t
    }

    case 'bg_issued_date': {
      const d = bid.bg_discharged_date || bid.bg_issued_date
      if (!d) return null
      const t = new Date(d).getTime()
      return isNaN(t) ? null : t
    }

    case 'delivery_date': {
      if (!bid.delivery_complete_date) return null
      const t = new Date(bid.delivery_complete_date).getTime()
      return isNaN(t) ? null : t
    }

    case 'our_rank':
      return bid.our_rank ? bid.our_rank.trim().toLowerCase() : null

    case 'result': {
      const res = bid.bid_result || bid.result
      return res ? res.trim().toLowerCase() : null
    }

    case 'owner':
      return bid.bid_owner?.full_name ? bid.bid_owner.full_name.trim().toLowerCase() : null

    case 'account_manager':
      return bid.account_manager?.full_name ? bid.account_manager.full_name.trim().toLowerCase() : null

    case 'remarks':
      return bid.remarks ? bid.remarks.trim().toLowerCase() : null

    default:
      return null
  }
}

export const SORTABLE_KEYS = new Set([
  'account_name',
  'title',
  'bid_id',
  'department',
  'location',
  'scope',
  'estimated_value',
  'emd',
  'status',
  'category',
  'platform',
  'quantity',
  'scope_type',
  'support_type',
  'no_emd',
  'emd_exemption',
  'bg_rate',
  'target_month',
  'start_date',
  'end_date',
  'created_at',
  'globx_total',
  'tech_eval',
  'submission_status',
  'fin_eval',
  'po_received',
  'po_date',
  'emd_ready_date',
  'bg_issued_date',
  'delivery_date',
  'our_rank',
  'result',
  'owner',
  'account_manager',
  'remarks',
])

/**
 * Sorts an array of bids by key and direction ('asc' | 'desc').
 * Missing values (null) are always sorted to the end in both directions.
 */
export function sortBids(bids, sortKey, sortDir) {
  if (!Array.isArray(bids) || !sortKey || !sortDir) return bids

  return [...bids].sort((a, b) => {
    const va = getSortValue(a, sortKey)
    const vb = getSortValue(b, sortKey)

    if (va === null && vb === null) return 0
    if (va === null) return 1
    if (vb === null) return -1

    let cmp = 0
    if (typeof va === 'string' && typeof vb === 'string') {
      cmp = va.localeCompare(vb)
    } else {
      cmp = va < vb ? -1 : va > vb ? 1 : 0
    }

    return sortDir === 'asc' ? cmp : -cmp
  })
}
