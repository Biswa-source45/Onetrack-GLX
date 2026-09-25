import ExcelJS from 'exceljs'

const HEADER_BG = 'FF1D4ED8'
const WHITE = 'FFFFFFFF'
const THIN = { style: 'thin', color: { argb: 'FFCBD5E1' } }
const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN }

// Triggers a browser download of an ExcelJS workbook.
export async function saveWorkbook(wb, filename) {
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// One-sheet table export: bold white-on-blue header row that stays frozen and
// carries Excel's filter dropdowns, columns sized to their content. Numbers
// are written as numbers so they can be summed/sorted in Excel.
export async function downloadExcel({ sheetName, headers, rows, filename }) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'OneTrack GlobX'
  wb.created = new Date()
  const ws = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1 }] })

  ws.columns = headers.map((h, i) => {
    const longest = rows.reduce((max, r) => Math.max(max, String(r[i] ?? '').length), String(h).length)
    return { width: Math.min(Math.max(longest + 2, 10), 50) }
  })

  ws.addRow(headers)
  rows.forEach((r) => ws.addRow(r.map((v) => v ?? '')))

  const header = ws.getRow(1)
  header.height = 24
  for (let c = 1; c <= headers.length; c++) {
    const cell = header.getCell(c)
    cell.font = { bold: true, color: { argb: WHITE } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = BORDER
  }
  for (let r = 2; r <= rows.length + 1; r++) {
    const row = ws.getRow(r)
    for (let c = 1; c <= headers.length; c++) {
      const cell = row.getCell(c)
      cell.border = BORDER
      cell.alignment = { vertical: 'top', wrapText: true }
    }
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } }

  await saveWorkbook(wb, filename)
}
