import ExcelJS from 'exceljs'
import { isOemDocItem, readOemDoc } from './checklistOem'

// Mirrors the app's own status colors (emerald = done, amber = pending) and
// OEM_PILL_COLORS' blue/violet/amber/rose/cyan/lime rotation from
// ChecklistTab.jsx, so the export reads as the same visual language as the
// live UI instead of a generic spreadsheet dump.
const PRIMARY = 'FF4F46E5'
const VIOLET = 'FF7C3AED'
const HEADER_BG = 'FFF1F5F9'
const DONE_BG = 'FFD1FAE5'
const DONE_FG = 'FF047857'
const PENDING_BG = 'FFFEF3C7'
const PENDING_FG = 'FFB45309'
const GRAY_BG = 'FFF1F5F9'
const GRAY_FG = 'FF64748B'
const WHITE = 'FFFFFFFF'
const OEM_HEADER_BG = ['FFDBEAFE', 'FFEDE9FE', 'FFFEF3C7', 'FFFFE4E6', 'FFCFFAFE', 'FFECFCCB']
const OEM_HEADER_FG = ['FF1D4ED8', 'FF6D28D9', 'FFB45309', 'FFBE123C', 'FF0E7490', 'FF4D7C0F']

const THIN = { style: 'thin', color: { argb: 'FFE2E8F0' } }
const cellBorder = { top: THIN, bottom: THIN, left: THIN, right: THIN }

const cleanTitle = (item) => item.title.replace(/^\[(Bidder|OEM)\]\s*/i, '')

// One BIDDER DOCS or OEM DOCS block: colored banner, header row, then one row
// per item. `extraOems` adds a per-OEM receipt column after Requirement —
// empty for the Bidder section. Completion reads as a colored # + Requirement
// row (emerald = done, amber = pending) rather than a separate Status column.
function addSection(ws, startRow, { title, color, items, extraOems }) {
  let r = startRow

  const banner = ws.getCell(r, 1)
  ws.mergeCells(r, 1, r, ws.columnCount)
  banner.value = title
  banner.font = { bold: true, size: 12, color: { argb: WHITE } }
  banner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }
  banner.alignment = { vertical: 'middle' }
  ws.getRow(r).height = 20
  r++

  const headers = ['#', 'Requirement', ...extraOems.map((o) => o.name)]
  const headerRow = ws.getRow(r)
  headers.forEach((h, i) => {
    const col = i + 1
    const isOemCol = i >= 2
    const cell = headerRow.getCell(col)
    cell.value = h
    cell.font = { bold: true, size: 10, color: isOemCol ? { argb: OEM_HEADER_FG[(i - 2) % OEM_HEADER_FG.length] } : undefined }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isOemCol ? OEM_HEADER_BG[(i - 2) % OEM_HEADER_BG.length] : HEADER_BG } }
    cell.border = cellBorder
    cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'center' : 'left', wrapText: true }
  })
  r++

  if (items.length === 0) {
    const cell = ws.getCell(r, 1)
    ws.mergeCells(r, 1, r, headers.length)
    cell.value = 'No items defined.'
    cell.font = { italic: true, size: 10, color: { argb: GRAY_FG } }
    return r + 1
  }

  items.forEach((item, idx) => {
    const row = ws.getRow(r)
    const doneFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: item.is_done ? DONE_BG : PENDING_BG } }
    const doneFont = { color: { argb: item.is_done ? DONE_FG : PENDING_FG } }

    const numCell = row.getCell(1)
    numCell.value = idx + 1
    numCell.fill = doneFill
    numCell.font = { ...doneFont, bold: true }
    numCell.alignment = { horizontal: 'center' }

    const reqCell = row.getCell(2)
    reqCell.value = cleanTitle(item)
    reqCell.fill = doneFill
    reqCell.font = doneFont
    reqCell.alignment = { wrapText: true, vertical: 'top' }

    extraOems.forEach((o, i) => {
      const cell = row.getCell(3 + i)
      if (o.initiated !== 'YES') {
        cell.value = 'NOT INITIATED'
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_BG } }
        cell.font = { italic: true, color: { argb: GRAY_FG } }
      } else {
        const received = readOemDoc(o, item)
        cell.value = received ? 'RECEIVED' : 'NOT RECEIVED'
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: received ? DONE_BG : PENDING_BG } }
        cell.font = { bold: true, color: { argb: received ? DONE_FG : PENDING_FG } }
      }
      cell.alignment = { horizontal: 'center' }
    })

    for (let c = 1; c <= headers.length; c++) {
      row.getCell(c).border = cellBorder
    }
    r++
  })

  return r + 1
}

export async function exportChecklistToExcel({ bid, items, oemList }) {
  const bidderItems = items.filter((i) => !isOemDocItem(i))
  const oemItems = items.filter((i) => isOemDocItem(i))
  const oems = Array.isArray(oemList) ? oemList : []

  const bidderCols = 2
  const oemCols = 2 + oems.length
  const totalCols = Math.max(bidderCols, oemCols)

  const wb = new ExcelJS.Workbook()
  wb.creator = 'OneTrack GlobX'
  wb.created = new Date()
  const ws = wb.addWorksheet('Checklist')
  ws.columns = Array.from({ length: totalCols }, (_, i) => ({ width: i === 0 ? 5 : i === 1 ? 48 : 18 }))

  let r = 1
  const titleCell = ws.getCell(r, 1)
  ws.mergeCells(r, 1, r, totalCols)
  titleCell.value = `Checklist — ${bid.title || 'Untitled Tender'}`
  titleCell.font = { bold: true, size: 14, color: { argb: WHITE } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY } }
  titleCell.alignment = { vertical: 'middle' }
  ws.getRow(r).height = 26
  r++

  const idCell = ws.getCell(r, 1)
  ws.mergeCells(r, 1, r, totalCols)
  idCell.value = `GeM Bid No: ${bid.gem_bid_no || 'N/A'}`
  idCell.font = { size: 10, italic: true, color: { argb: 'FF475569' } }
  r += 2

  r = addSection(ws, r, { title: 'BIDDER DOCS', color: PRIMARY, items: bidderItems, extraOems: [] })
  r++
  addSection(ws, r, { title: 'OEM DOCS', color: VIOLET, items: oemItems, extraOems: oems })

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const namePart = (bid.gem_bid_no || bid.title || 'checklist').replace(/[^a-z0-9]+/gi, '_').toLowerCase()
  const stamp = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `Checklist_${namePart}_${stamp}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
