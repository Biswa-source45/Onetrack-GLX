// Buyback: old equipment the customer hands back against a tender. Each line is
// product x qty x unit price; the lines add up to the amount taken off the offered total.
// Sheets saved before multi-product buyback hold one `{ item, value }` pair; it is read as one line.

const num = (v) => Math.max(Number(v) || 0, 0)
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

export function newBuybackLine() {
  return { id: `bb-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, product: '', qty: '1', unitPrice: '' }
}

// Raw saved buyback -> clean lines, each with its own total. Draft lines may hold strings.
export function buybackLines(buyback) {
  if (!buyback || !buyback.enabled) return []
  const rows = Array.isArray(buyback.items) && buyback.items.length
    ? buyback.items
    : (buyback.value !== '' && buyback.value != null ? [{ product: buyback.item, qty: 1, unitPrice: buyback.value }] : [])
  return rows
    .map((r, i) => {
      const qty = num(r?.qty)
      const unitPrice = num(r?.unitPrice)
      return { id: r?.id || `bb-${i}`, product: String(r?.product ?? '').trim(), qty, unitPrice, total: round2(qty * unitPrice) }
    })
    .filter((l) => l.total > 0)
}

export const buybackTotal = (lines) => round2(lines.reduce((s, l) => s + l.total, 0))

// "Desktop x5, Server x1" for places that only have room for one line of text.
export const buybackSummary = (lines) => lines.map((l) => `${l.product || 'Item'} ×${l.qty}`).join(', ')

// Saved buyback -> editable draft rows (strings), including the lines kept while the toggle is off.
export function buybackDraft(buyback) {
  const src = Array.isArray(buyback?.items) && buyback.items.length
    ? buyback.items
    : (buyback && buyback.value !== '' && buyback.value != null ? [{ product: buyback.item, qty: 1, unitPrice: buyback.value }] : [])
  return src.map((r) => ({
    id: r.id || newBuybackLine().id,
    product: String(r.product ?? ''),
    qty: String(r.qty ?? 1),
    unitPrice: r.unitPrice === '' || r.unitPrice == null ? '' : String(r.unitPrice),
  }))
}

// Why a draft cannot be saved, or '' when it can.
export function validateBuybackDraft(items) {
  if (!items.length) return 'Add at least one buyback product'
  for (let i = 0; i < items.length; i++) {
    const n = i + 1
    const it = items[i]
    const qty = Number(it.qty)
    const price = Number(it.unitPrice)
    if (!String(it.product ?? '').trim()) return `Line ${n}: enter the product name`
    if (!Number.isInteger(qty) || qty < 1) return `Line ${n}: quantity must be a whole number, 1 or more`
    if (!Number.isFinite(price) || price <= 0) return `Line ${n}: unit price must be greater than 0`
  }
  return ''
}
