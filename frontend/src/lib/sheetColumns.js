// The one list that decides which columns the tender sheet views show, in which order and under which
// name: the editable "All Tenders" sheet, the read-only Master Sheet and both Excel exports all follow it,
// so they cannot drift apart. `masterOnly` columns exist only on the read-only Master Sheet.
// `hint` is a short line shown under the column name on screen (never in an export).
// The first column stays pinned while the sheet scrolls sideways.
export const SHEET_COLUMNS = [
  { key: 'account_name', label: 'Account Name', minWidth: 260 },
  { key: 'end_date', label: 'End Date', minWidth: 180 },
  { key: 'bid_id', label: 'Bid Number / RFP Number', minWidth: 190, hint: 'Click the number to open the tender page' },
  { key: 'department', label: 'Department / Ministry', minWidth: 200 },
  { key: 'location', label: 'Location', minWidth: 140 },
  { key: 'scope', label: 'High-Level Scope', minWidth: 240 },
  { key: 'estimated_value', label: 'Estimated Tender Value (₹)', minWidth: 180 },
  { key: 'emd', label: 'EMD Amount (₹)', minWidth: 140 },
  { key: 'title', label: 'Tender Title', minWidth: 240 },
  { key: 'status', label: 'Status', minWidth: 120 },
  { key: 'category', label: 'Category', minWidth: 120 },
  { key: 'platform', label: 'Platform', minWidth: 135 },
  { key: 'quantity', label: 'Quantity', minWidth: 90 },
  { key: 'scope_type', label: 'Scope Type', minWidth: 140 },
  { key: 'no_emd', label: 'No EMD', minWidth: 100 },
  { key: 'emd_exemption', label: 'EMD Exemption', minWidth: 130 },
  { key: 'bg_rate', label: 'BG Rate (%)', minWidth: 110 },
  { key: 'target_month', label: 'Target Month', minWidth: 150 },
  { key: 'start_date', label: 'Start Date', minWidth: 150 },
  { key: 'globx_total', label: 'GlobX Total (₹)', minWidth: 150 },
  { key: 'tech_eval', label: 'Tech Eval', minWidth: 120 },
  { key: 'submission_status', label: 'Submission Status', minWidth: 140 },
  { key: 'fin_eval', label: 'Fin Eval Status', minWidth: 160 },
  { key: 'po_received', label: 'PO Received', minWidth: 140 },
  { key: 'po_date', label: 'PO Received Date', minWidth: 140 },
  { key: 'emd_ready_date', label: 'EMD Ready Date', minWidth: 140 },
  { key: 'bg_issued_date', label: 'BG Issued Date', minWidth: 140 },
  { key: 'delivery_date', label: 'Delivery/Work Complete Date', minWidth: 150 },
  { key: 'our_rank', label: 'Our Rank', minWidth: 110 },
  { key: 'result', label: 'Result', minWidth: 140 },
  { key: 'owner', label: 'Owner', minWidth: 130 },
  { key: 'created_at', label: 'Created At', minWidth: 160, masterOnly: true },
  { key: 'account_manager', label: 'Account Manager', minWidth: 150, masterOnly: true },
  { key: 'remarks', label: 'Remarks', minWidth: 220 },
]

/** The columns of the editable sheet (and its export); the Master Sheet uses the whole list. */
export const EDITABLE_SHEET_COLUMNS = SHEET_COLUMNS.filter((c) => !c.masterOnly)
