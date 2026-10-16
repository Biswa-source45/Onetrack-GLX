import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, Eye, EyeOff, Loader2, Save, UserRound, KeyRound } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { authService, tokenStorage } from '../../services/auth'
import { getMyProfile, updateUserProfile } from '../../services/users'
import { RoleBadge } from './RoleBadge'
import { UserAvatar } from './UserAvatar'

const fieldsOf = (u) => ({
  full_name: u?.full_name ?? '', email: u?.email ?? '', phone: u?.phone ?? '', department: u?.department ?? '',
})

function Field({ id, label, children }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  )
}

function Fact({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{children || <span className="font-normal text-muted-foreground">Not set</span>}</dd>
    </div>
  )
}

// Settings > My Account: the same profile and password changes as the account menu at the top right.
export function AccountSettings() {
  const [user, setUser] = useState(() => tokenStorage.getUser())
  const [form, setForm] = useState(() => fieldsOf(tokenStorage.getUser()))
  const [saving, setSaving] = useState(false)

  // Fresh copy from the server, so what is shown is what is stored.
  useEffect(() => {
    let live = true
    getMyProfile().then((res) => {
      if (!live || !res.ok || !res.data) return
      const merged = { ...tokenStorage.getUser(), ...res.data }
      setUser(merged)
      setForm(fieldsOf(merged))
    }).catch(() => {})
    return () => { live = false }
  }, [])

  const dirty = JSON.stringify(Object.values(form).map((v) => v.trim())) !== JSON.stringify(Object.values(fieldsOf(user)).map((v) => v.trim()))
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function saveProfile(e) {
    e.preventDefault()
    if (!form.full_name.trim()) return toast.error('Full Name is required')
    setSaving(true)
    try {
      const res = await updateUserProfile(user.id, Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])))
      if (res.ok && res.success) {
        const updated = { ...user, ...res.data }
        setUser(updated)
        setForm(fieldsOf(updated))
        // Keep the stored copy in step so the header and role checks see the change.
        tokenStorage.setTokens(tokenStorage.getAccessToken(), tokenStorage.getRefreshToken(), { ...tokenStorage.getUser(), ...res.data })
        window.dispatchEvent(new Event('onetrack_user_updated'))
        toast.success('Profile updated')
      } else {
        toast.error(res.error?.message || 'Failed to update profile')
      }
    } catch {
      toast.error('Network error updating profile')
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="border-b border-border/60 bg-muted/10 p-5 pb-4">
          <div className="flex items-center gap-3">
            <UserAvatar fullName={user.full_name} username={user.username} size="lg" />
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <UserRound className="size-4 text-primary" aria-hidden="true" /> Profile
              </CardTitle>
              <CardDescription className="text-xs">Your name and contact details. Username and roles are set by an administrator.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
            <Fact label="Username">{user.username && `@${user.username}`}</Fact>
            <Fact label="Employee Code"><span className="font-mono">{user.employee_code}</span></Fact>
            <div>
              <dt className="text-xs text-muted-foreground">Roles</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {(user.roles ?? []).map((r) => <RoleBadge key={r} role={r} />)}
                {!user.roles?.length && <span className="text-sm text-muted-foreground">None</span>}
              </dd>
            </div>
          </dl>

          <form onSubmit={saveProfile} className="grid gap-4 border-t border-border/60 pt-5 sm:grid-cols-2" noValidate>
            <Field id="acct-name" label="Full Name *">
              <Input id="acct-name" value={form.full_name} onChange={set('full_name')} disabled={saving} maxLength={150} />
            </Field>
            <Field id="acct-email" label="Email Address">
              <Input id="acct-email" type="email" value={form.email} onChange={set('email')} disabled={saving} placeholder="name@company.com" />
            </Field>
            <Field id="acct-phone" label="Phone Number">
              <Input id="acct-phone" value={form.phone} onChange={set('phone')} disabled={saving} placeholder="9876543210" />
            </Field>
            <Field id="acct-dept" label="Department">
              <Input id="acct-dept" value={form.department} onChange={set('department')} disabled={saving} placeholder="e.g. Sales" />
            </Field>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="outline" disabled={saving || !dirty} onClick={() => setForm(fieldsOf(user))}>Reset</Button>
              <Button type="submit" disabled={saving || !dirty} className="gap-1.5">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <PasswordCard />
    </div>
  )
}

function PasswordInput({ id, label, value, onChange, disabled, placeholder }) {
  const [shown, setShown] = useState(false)
  return (
    <Field id={id} label={label}>
      <div className="relative">
        <Input id={id} type={shown ? 'text' : 'password'} value={value} onChange={onChange} disabled={disabled} placeholder={placeholder}
          autoComplete={id === 'pw-current' ? 'current-password' : 'new-password'} className="pr-9" />
        <button type="button" onClick={() => setShown((v) => !v)} aria-label={shown ? 'Hide password' : 'Show password'}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </Field>
  )
}

function PasswordCard() {
  const navigate = useNavigate()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!current) return toast.error('Enter your current password')
    if (next.length < 8) return toast.error('New password must be at least 8 characters')
    if (next !== confirm) return toast.error('Passwords do not match')
    setBusy(true)
    try {
      const res = await authService.changePassword(current, next)
      if (res.ok && res.success) {
        setCurrent(''); setNext(''); setConfirm('')
        setDone(true)
      } else {
        toast.error(res.error?.message || 'Failed to change password')
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-border bg-card shadow-xs">
      <CardHeader className="border-b border-border/60 bg-muted/10 p-5 pb-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="size-4 text-primary" aria-hidden="true" /> Change Password
        </CardTitle>
        <CardDescription className="text-xs">Enter your current password to set a new one. You will be signed out afterwards.</CardDescription>
      </CardHeader>
      <CardContent className="p-5">
        <form onSubmit={submit} className="grid max-w-md gap-4" noValidate>
          <PasswordInput id="pw-current" label="Current Password" value={current} onChange={(e) => setCurrent(e.target.value)} disabled={busy} placeholder="••••••••" />
          <PasswordInput id="pw-new" label="New Password" value={next} onChange={(e) => setNext(e.target.value)} disabled={busy} placeholder="Minimum 8 characters" />
          <PasswordInput id="pw-confirm" label="Confirm New Password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={busy} placeholder="Repeat new password" />
          <div>
            <Button type="submit" disabled={busy || !current || !next || !confirm} className="gap-1.5">
              {busy && <Loader2 className="size-4 animate-spin" />}
              Update Password
            </Button>
          </div>
        </form>
      </CardContent>

      {/* The server ends the session, so the only way on is to sign in again. */}
      <Dialog open={done}>
        <DialogContent className="sm:max-w-sm [&>button]:hidden" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader className="items-center text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50">
              <CheckCircle className="size-6 text-emerald-600" />
            </div>
            <DialogTitle>Password Updated</DialogTitle>
            <DialogDescription>Your session will be cleared. Sign in again with your new password.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button className="w-full" onClick={() => { authService.logout(); navigate('/login') }}>Sign In Again</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
