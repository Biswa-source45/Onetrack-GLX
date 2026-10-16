import { useState } from 'react'
import { Check, LayoutGrid, Loader2, Table2 } from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { savePreferences } from '../../services/preferences'
import { useBidStore } from '../../store/useBidStore'

// The values are what the server stores (internal/preferences).
const TENDER_VIEWS = [
  { value: 'sheets', label: 'Sheet View', icon: Table2, blurb: 'One row per tender in a wide table, with every column and inline editing. Best for scanning and updating many tenders.' },
  { value: 'cards', label: 'Card View', icon: LayoutGrid, blurb: 'One card per tender with its status and key details at a glance. Best for a lighter, visual overview.' },
]

// Settings > Preferences: choices that only change how the app looks for you.
export function PreferencesSettings() {
  const preferences = useBidStore((s) => s.preferences)
  const applyPreferences = useBidStore((s) => s.applyPreferences)
  const [saving, setSaving] = useState('')
  const current = preferences?.tenders_view === 'cards' ? 'cards' : 'sheets'

  async function choose(value) {
    if (value === current || saving) return
    setSaving(value)
    try {
      const res = await savePreferences({ tenders_view: value })
      if (res.ok) {
        applyPreferences(res.data)
        toast.success(`Tenders will open in ${TENDER_VIEWS.find((v) => v.value === value).label}`)
      } else {
        toast.error(res.error?.message || 'Could not save your preference')
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setSaving('')
    }
  }

  return (
    <Card className="border-border bg-card shadow-xs">
      <CardHeader className="border-b border-border/60 bg-muted/10 p-5 pb-4">
        <CardTitle className="text-sm font-semibold">Default Tenders View</CardTitle>
        <CardDescription className="text-xs">
          How the Tenders page opens for you. This is your own choice and does not change anyone else's. You can still switch views on the Tenders page at any time.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5">
        <div role="radiogroup" aria-label="Default Tenders View" className="grid gap-3 sm:grid-cols-2">
          {TENDER_VIEWS.map(({ value, label, icon: Icon, blurb }) => {
            const selected = value === current
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={!!saving}
                onClick={() => choose(value)}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait
                  ${selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}
              >
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    {label}
                    {saving === value ? <Loader2 className="size-3.5 animate-spin" /> : selected && <Check className="size-4 text-primary" aria-hidden="true" />}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{blurb}</span>
                </span>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
