// Opens the Master Sheet pre-filtered to a specific set of tenders — the
// "see full data" drill-through used from Dashboard/Analytics KPI cards,
// chart segments, and dialogs. Only the tender IDs are stashed (not full
// tender objects): MasterSheetPage re-fetches fresh on arrival, so a drill
// always shows live data instead of a snapshot frozen at click time.
//
// The id is a plain timestamp+random string, not crypto.randomUUID() —
// that API only exists in a secure context (HTTPS or localhost), and this
// app is served over plain http:// on the office LAN. It's just a
// sessionStorage lookup key, not a security token, so it doesn't need
// crypto-grade randomness.
export function openMasterSheetDrill(navigate, { title, subtitle, bids }) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  sessionStorage.setItem(`msDrill:${id}`, JSON.stringify({
    title,
    subtitle,
    ids: bids.map(b => b.id)
  }))
  navigate(`/dashboard/tenders/master/${id}`)
}

export function readMasterSheetDrill(id) {
  const raw = sessionStorage.getItem(`msDrill:${id}`)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
