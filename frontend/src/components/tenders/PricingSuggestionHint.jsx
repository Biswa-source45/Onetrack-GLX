import { useEffect, useState } from 'react'
import { Eye } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getPricingSuggestion } from '../../services/bids'

// Module-level cache + debounce so the same product rendered in multiple
// spots (price cell, margin cell, the Add Margin dialog row) only ever
// fetches once per description, and typing doesn't fire a request per key.
const suggestionCache = new Map()

function useSuggestion(desc) {
  const key = (desc || '').trim().toLowerCase()
  // Cache hits are read straight from the module cache at render time — no
  // effect needed for those. `fetchedFor` holds this hook instance's own
  // in-flight fetch result tagged with the key it's for, so a stale result
  // from a since-changed key is never shown while a new fetch is pending
  // (no reset-via-setState in the effect needed either).
  const [fetchedFor, setFetchedFor] = useState(null)

  useEffect(() => {
    if (!key || suggestionCache.has(key)) return
    let cancelled = false
    const timer = setTimeout(async () => {
      const res = await getPricingSuggestion(desc)
      if (cancelled) return
      const data = res.ok ? res.data : { count: 0 }
      suggestionCache.set(key, data)
      setFetchedFor({ key, data })
    }, 400)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [key, desc])

  if (!key) return null
  return suggestionCache.get(key) ?? (fetchedFor?.key === key ? fetchedFor.data : null)
}

function fmtMoney(n) {
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

/**
 * Read-only suggested-price hint for a Pricing Request line item — a
 * sliding-window average of this exact product's past APPROVED deals'
 * GlobX Unit Price Excl GST. Never rendered anywhere near
 * buildPricingTableHtml/handleSendApproval (the approval email/alert), so
 * it can never leak into what the approver sees.
 *
 * No separate margin-suggestion mode — showing both a price and a margin
 * suggestion side by side read as two disagreeing numbers, so margin is
 * only shown per-deal in the hover breakdown below, not as its own hint.
 */
export function PricingSuggestionHint({ desc, className = '' }) {
  const suggestion = useSuggestion(desc)

  if (!desc || !desc.trim()) return null
  if (suggestion === null) {
    return <span className={`text-[10px] text-muted-foreground/50 ${className}`}>…</span>
  }
  if (!suggestion.count) {
    return <span className={`text-[10px] text-muted-foreground/70 italic ${className}`}>Suggested: N/A</span>
  }

  const label = `Suggested: ${fmtMoney(suggestion.avg_unit_price_excl_gst)}`

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-medium cursor-help ${className}`}
        >
          {label}
          <Eye className="size-2.5 shrink-0" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px]">
        <p className="font-semibold mb-1">
          Last {suggestion.count} approved deal{suggestion.count === 1 ? '' : 's'} for this product
        </p>
        <ul className="space-y-0.5">
          {suggestion.deals.map((d) => (
            <li key={d.bid_id} className="flex justify-between gap-3">
              <span className="truncate max-w-[120px]" title={d.bid_title}>{d.bid_title}</span>
              <span className="font-mono shrink-0">{fmtMoney(d.unit_price_excl_gst)} · {d.margin_pct.toFixed(2)}%</span>
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  )
}
