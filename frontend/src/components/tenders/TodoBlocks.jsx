import { useEffect, useState } from 'react'
import { AlarmClock, CalendarClock, CalendarDays, Hourglass, Siren } from 'lucide-react'
import { listBids } from '../../services/bids'
import { getDefaultCalendar } from '../../services/calendar'
import { computeEndDateRange, useBidStore } from '../../store/useBidStore'

const day = (d) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
const time = (d) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })

// What each block covers, spelled out so two blocks are never "the same thing":
// today = what is left of today, tomorrow = tomorrow only, 72h = the next 72 hours
// (cumulative, includes today and tomorrow), week = until Sunday.
function buildBlocks(alertWindow) {
  const now = new Date()
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
  const in72 = new Date(now.getTime() + 72 * 3600000)
  const sunday = new Date(now); sunday.setDate(now.getDate() + ((7 - now.getDay()) % 7))
  return [
    { key: 'today', label: 'Ending today', sub: `${day(now)} · till midnight`, Icon: AlarmClock, cls: 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300' },
    { key: 'tomorrow', label: 'Ending tomorrow', sub: day(tomorrow), Icon: CalendarClock, cls: 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-300' },
    { key: '72h', label: 'Ending in 72 hours', sub: `Next 3 days · till ${day(in72)}, ${time(in72)}`, Icon: Hourglass, cls: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300' },
    { key: 'week', label: 'Ending this week', sub: `Till Sunday, ${day(sunday)}`, Icon: CalendarDays, cls: 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300' },
    { key: 'alert', label: 'High alert', sub: alertWindow ? `Inside ${alertWindow} of closing` : 'In the deadline alert window', Icon: Siren, cls: 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/30 dark:text-purple-300' },
  ]
}

const UNIT = { HOURS: 'working hrs', DAYS: 'working days', MINUTES: 'min', SECONDS: 'sec' }

// Counts come from the very same list endpoint (limit 1 -> meta.total) with the
// same params the list uses, so a block's number always equals the list behind it.
async function countFor(key) {
  const range = key === 'alert' ? { high_alert: true } : computeEndDateRange(key)
  const res = await listBids({ due_soon: true, ...range, page: 1, limit: 1 })
  return res.ok ? (res.meta?.total ?? 0) : null
}

export function TodoBlocks() {
  const { todoFilter, setTodoFilter } = useBidStore()
  const [counts, setCounts] = useState({})
  const [alertWindow, setAlertWindow] = useState('')

  useEffect(() => {
    let cancelled = false
    // Names the admin-configured alert window (Working Calendar) on the High alert block.
    getDefaultCalendar().then((res) => {
      const d = res?.data
      if (!cancelled && d?.deadline_trigger_value && UNIT[d.deadline_trigger_unit]) {
        setAlertWindow(`${d.deadline_trigger_value} ${UNIT[d.deadline_trigger_unit]}`)
      }
    }).catch(() => {})
    const load = () =>
      Promise.all(['today', 'tomorrow', '72h', 'week', 'alert'].map((k) => countFor(k).catch(() => null))).then((vals) => {
        if (!cancelled) setCounts(Object.fromEntries(['today', 'tomorrow', '72h', 'week', 'alert'].map((k, i) => [k, vals[i]])))
      })
    load()
    const timer = setInterval(load, 60000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      {buildBlocks(alertWindow).map(({ key, label, sub, Icon, cls }) => {
        const active = todoFilter === key
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => setTodoFilter(active ? '' : key)}
            className={`rounded-xl border p-3 text-left transition-all ${cls} ${active ? 'ring-2 ring-offset-1 ring-current shadow-sm' : 'opacity-90 hover:opacity-100 hover:shadow-xs'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <Icon className="size-4 shrink-0" />
              <span className="font-heading text-2xl font-bold leading-none">{counts[key] ?? '–'}</span>
            </div>
            <p className="mt-2 text-xs font-semibold">{label}</p>
            <p className="text-[11px] opacity-80 leading-snug">{sub}</p>
          </button>
        )
      })}
    </div>
  )
}
