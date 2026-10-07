import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { getChecklists } from '../../services/bids'
import { tokenStorage } from '../../services/auth'
import { isOemDocItem } from '../../lib/checklistOem'
import { formatDate, formatDateTime, isValidDate } from '../../lib/tenderFormat'
import { computeL1PricingSummary } from './StageWorkspaces'

const firstValid = (...dates) => dates.find(isValidDate)

// Fixed 2 decimals so a column of amounts lines up (fmtMoneyFull drops trailing zeros).
const inr = (v) => (v || v === 0 ? `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—')

function emdValue(bid) {
  if (bid.emd_not_applicable) return 'Not Applicable'
  if (bid.emd_exempted) return 'Exempted'
  return inr(bid.emd_amount)
}

function Section({ title, aside, children }) {
  return (
    <section className="mt-5 break-inside-avoid-page">
      <div className="flex items-baseline justify-between border-b-2 border-slate-800 pb-1">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-800">{title}</h2>
        {aside}
      </div>
      <div className="pt-2">{children}</div>
    </section>
  )
}

const th = 'border border-slate-300 bg-slate-100 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600'
const td = 'border border-slate-300 px-2 py-1.5 align-top'

/**
 * One-page, print-ready summary of a tender. Mounted only while printing: it
 * loads the OEM checklist, opens the browser print dialog (print or "Save as
 * PDF"), and calls onDone when the dialog closes. The portal sits outside
 * #root so index.css can hide the whole app and print just this sheet.
 */
export function TenderPrintSheet({ bid, onDone }) {
  const [items, setItems] = useState(null)
  const rfpNumber = [bid.gem_bid_no, bid.bid_no].filter(Boolean).join(' / ') || 'Not Specified'

  useEffect(() => {
    let alive = true
    getChecklists(bid.id)
      .then((res) => alive && setItems(res.ok && Array.isArray(res.data) ? res.data : []))
      .catch(() => alive && setItems([]))
    return () => { alive = false }
  }, [bid.id])

  useEffect(() => {
    if (items === null) return
    // Browsers name the saved PDF after the page title.
    const prevTitle = document.title
    document.title = `Tender ${rfpNumber} - ${bid.title}`
    const done = () => { document.title = prevTitle; onDone() }
    window.addEventListener('afterprint', done, { once: true })
    const frame = requestAnimationFrame(() => window.print())
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('afterprint', done)
      document.title = prevTitle
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- print once per load
  }, [items])

  if (items === null) return null

  const user = tokenStorage.getUser()
  const oemDocs = items.filter(isOemDocItem)
  const receivedCount = oemDocs.filter((i) => i.is_done).length
  const pricing = bid.pricing_workspace && typeof bid.pricing_workspace === 'object' ? bid.pricing_workspace : null
  const calc = pricing ? computeL1PricingSummary(pricing).l1Calculations : null
  const approved = pricing?.approvalStatus === 'APPROVED'

  const start = firstValid(bid.start_date, bid.opening_date)
  const end = firstValid(bid.end_date, bid.closing_date, bid.submission_deadline)

  const particulars = [
    ['RFP Number', rfpNumber],
    ['Issuing Authority', [bid.organization_name, bid.department_name].filter(Boolean).join(' — ') || 'Not Specified'],
    ['RFP Start Date', start ? formatDate(start) : 'Not Specified'],
    ['RFP End Date', end ? formatDateTime(end) : 'Not Specified'],
    ['Account Manager', bid.account_manager?.full_name || 'Not assigned'],
    ['EMD Value', emdValue(bid)],
  ]

  return createPortal(
    <div className="tender-print bg-white text-[11px] leading-snug text-slate-900">
      <header className="flex items-start justify-between border-b border-slate-300 pb-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-700">OneTrack · GlobX</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Tender Summary Sheet</p>
        </div>
        <p className="text-right text-[10px] text-slate-500">
          Generated {formatDateTime(new Date().toISOString())}
          {user?.full_name ? <><br />by {user.full_name}</> : null}
        </p>
      </header>

      <h1 className="mt-3 text-[17px] font-bold leading-tight">{bid.title}</h1>
      <p className="mt-1 text-slate-600">
        {[bid.portal_source, bid.category, bid.scope_type].filter(Boolean).join(' · ')}
      </p>

      <Section title="Tender Particulars">
        <table className="w-full border-collapse">
          <tbody>
            {particulars.map(([label, value]) => (
              <tr key={label} className="break-inside-avoid">
                <th className={`${th} w-[28%] normal-case tracking-normal text-[11px] font-semibold text-slate-700`}>{label}</th>
                <td className={`${td} font-medium`}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section
        title="Pricing Details"
        aside={calc && (
          <span className={`text-[10px] font-semibold ${approved ? 'text-emerald-700' : 'text-amber-700'}`}>
            {approved ? `Approved${pricing.approverName ? ` by ${pricing.approverName}` : ''}` : 'Not yet approved'}
          </span>
        )}
      >
        {calc ? (
          <>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={`${th} w-6`}>#</th>
                  <th className={th}>Item</th>
                  <th className={th}>OEM</th>
                  <th className={`${th} text-right`}>Qty</th>
                  <th className={`${th} text-right`}>Unit Price (excl. GST)</th>
                  <th className={`${th} text-right`}>GST</th>
                  <th className={`${th} text-right`}>Total (incl. GST)</th>
                </tr>
              </thead>
              <tbody>
                {calc.items.map((row) => (
                  <tr key={row.sNo} className="break-inside-avoid">
                    <td className={td}>{row.sNo}</td>
                    <td className={td}>{row.desc || '—'}</td>
                    <td className={td}>{row.oem || '—'}</td>
                    <td className={`${td} text-right tabular-nums`}>{row.qty}</td>
                    <td className={`${td} text-right tabular-nums`}>{inr(row.unitPriceExclGst)}</td>
                    <td className={`${td} text-right tabular-nums`}>{row.itemGstRate}%</td>
                    <td className={`${td} text-right font-semibold tabular-nums`}>{inr(row.globxTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="break-inside-avoid">
                <tr>
                  <td colSpan={6} className={`${td} text-right text-slate-600`}>Total (excl. GST)</td>
                  <td className={`${td} text-right tabular-nums`}>{inr(calc.grandSellingExclGst)}</td>
                </tr>
                <tr>
                  <td colSpan={6} className={`${td} text-right text-slate-600`}>GST</td>
                  <td className={`${td} text-right tabular-nums`}>{inr(calc.grandGstAmount)}</td>
                </tr>
                {calc.buybackValue > 0 && (
                  <>
                    <tr>
                      <td colSpan={6} className={`${td} text-right text-slate-600`}>Total before buyback (incl. GST)</td>
                      <td className={`${td} text-right tabular-nums`}>{inr(calc.grandTotalBeforeBuyback)}</td>
                    </tr>
                    <tr>
                      <td colSpan={6} className={`${td} text-right text-slate-600`}>Less: Buyback{calc.buybackItem ? ` — ${calc.buybackItem}` : ''}</td>
                      <td className={`${td} text-right tabular-nums`}>− {inr(calc.buybackValue)}</td>
                    </tr>
                  </>
                )}
                <tr className="bg-slate-100">
                  <td colSpan={6} className={`${td} text-right font-bold`}>{calc.buybackValue > 0 ? 'Total Offered Value after buyback (incl. GST)' : 'Total Offered Value (incl. GST)'}</td>
                  <td className={`${td} text-right text-[12px] font-bold tabular-nums`}>{inr(calc.grandGlobxTotal)}</td>
                </tr>
              </tfoot>
            </table>
            {bid.estimated_value ? (
              <p className="mt-1.5 text-[10px] text-slate-500">Estimated tender value: {inr(bid.estimated_value)}</p>
            ) : null}
          </>
        ) : (
          <p className="italic text-slate-500">Pricing has not been prepared yet.</p>
        )}
      </Section>

      <Section
        title="OEM Documents Required"
        aside={oemDocs.length > 0 && (
          <span className="text-[10px] font-semibold text-slate-600">{receivedCount} of {oemDocs.length} received</span>
        )}
      >
        {oemDocs.length > 0 ? (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={`${th} w-6`}>#</th>
                <th className={th}>Document</th>
                <th className={`${th} w-24`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {oemDocs.map((item, idx) => (
                <tr key={item.id} className="break-inside-avoid">
                  <td className={td}>{idx + 1}</td>
                  <td className={td}>{item.title.replace(/^\[OEM\]\s*/i, '')}</td>
                  <td className={`${td} font-semibold ${item.is_done ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {item.is_done ? 'Received' : 'Pending'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="italic text-slate-500">No OEM documents defined for this tender.</p>
        )}
      </Section>

      <footer className="mt-6 border-t border-slate-300 pt-2 text-[9px] uppercase tracking-wider text-slate-400">
        Confidential — for internal discussion only
      </footer>
    </div>,
    document.body,
  )
}
