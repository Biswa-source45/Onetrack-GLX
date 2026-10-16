import { useSearchParams } from 'react-router-dom'
import { Settings } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePermissions } from '../../hooks/usePermissions'
import { AccountSettings } from './AccountSettings'
import { PreferencesSettings } from './PreferencesSettings'
import { PlatformSettings } from './PlatformSettings'

// Settings, in the order people reach for them: who I am, how I like the app, and (Super Admin
// only) the rules for everyone. The open tab lives in the URL, so a link or a refresh keeps it.
export function SettingsPage() {
  const { hasRole } = usePermissions()
  const [params, setParams] = useSearchParams()
  const tabs = [
    { id: 'account', label: 'My Account' },
    { id: 'preferences', label: 'Preferences' },
    ...(hasRole('SUPER_ADMIN') ? [{ id: 'platform', label: 'Platform' }] : []),
  ]
  const requested = params.get('tab')
  const tab = tabs.some((t) => t.id === requested) ? requested : 'account'

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <Settings className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Settings</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Your account, how the app opens for you{hasRole('SUPER_ADMIN') ? ', and platform policies' : ''}.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(t) => setParams(t === 'account' ? {} : { tab: t }, { replace: true })} className="gap-5">
        <TabsList variant="line" className="h-auto w-full justify-start gap-1 border-b border-border/60 p-0">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="flex-none px-4 py-2 text-sm">{t.label}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="account"><AccountSettings /></TabsContent>
        <TabsContent value="preferences"><PreferencesSettings /></TabsContent>
        {hasRole('SUPER_ADMIN') && <TabsContent value="platform"><PlatformSettings /></TabsContent>}
      </Tabs>
    </div>
  )
}
