import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Globe, Loader2, Mail, MailCheck, MailWarning, RefreshCw, Send, TriangleAlert, Wifi } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'

import { previewCredentialAlerts, sendCredentialAlerts, getCredentialBatch, sendAccessAlert } from '../../services/credentials'
import {
  KIND_LABEL, batchPercent, buildSend, defaultSelection, isAlerted, isFinished, missingPasswords, pruneSelection, toggleId,
} from '../../lib/credentialAlert'

const POLL_MS = 2000
const MAX_POLL_ERRORS = 5

const fmt = (iso) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const roleText = (roles) => (roles || []).map((r) => r.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())).join(', ') || '—'

function UserList({ title, hint, rows, selected, includeAlerted, onToggle, onAll, onNone, testId, headerExtra, rowExtra }) {
  return (
    <section className="rounded-lg border border-border" data-testid={testId}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {title} <span className="text-muted-foreground font-normal">({rows.length})</span>
          </h3>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        {rows.length > 0 && (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">{selected.size} selected</span>
            <button type="button" className="text-primary hover:underline" onClick={onAll}>Select all</button>
            <button type="button" className="text-primary hover:underline" onClick={onNone}>None</button>
          </div>
        )}
      </header>
      {headerExtra && rows.length > 0 && <div className="border-b border-border px-4 py-2.5">{headerExtra}</div>}
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">Nobody in this group.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => {
            const alerted = isAlerted(r)
            const locked = alerted && !includeAlerted
            return (
              <li key={r.id} className={`flex items-center gap-3 px-4 py-2.5 ${locked ? 'opacity-55' : ''}`}>
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  aria-label={`Select ${r.full_name || r.username}`}
                  checked={selected.has(r.id)}
                  disabled={locked}
                  onChange={() => onToggle(r.id)}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{r.full_name || r.username}</p>
                  <p className="truncate text-xs text-muted-foreground">@{r.username} · {r.email}</p>
                </div>
                {rowExtra?.(r, locked)}
                <span className="hidden text-xs text-muted-foreground sm:block max-w-[180px] truncate">{roleText(r.roles)}</span>
                {alerted && (
                  <Badge variant="outline" className="text-[10px] shrink-0">Alerted {fmt(r.last_alerted_at)}</Badge>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// ── Access Alert Dialog ──────────────────────────────────────────────────────
const DEFAULT_URL = 'http://192.168.1.50/'

function AccessAlertDialog({ open, onClose }) {
  const [url, setUrl] = useState(DEFAULT_URL)
  const [sending, setSending] = useState(false)

  // Reset URL to default each time the dialog opens
  useEffect(() => { if (open) setUrl(DEFAULT_URL) }, [open])

  async function handleSend() {
    const trimmed = url.trim()
    if (!trimmed) { toast.error('Please enter the current office URL.'); return }
    setSending(true)
    try {
      const res = await sendAccessAlert(trimmed)
      if (res.ok && res.success) {
        toast.success(`Access details sent to ${res.data?.total ?? 'all'} user(s).`)
        onClose()
      } else if (res.error?.code === 'EMAIL_NOT_CONFIGURED') {
        toast.error('Email is not configured on this server. Check EMAIL_PASSWORD in .env.')
      } else {
        toast.error(res.error?.message || 'Could not send the access alert.')
      }
    } catch {
      toast.error('Network error. Could not reach the server.')
    } finally {
      setSending(false)
    }
  }

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (!sending && e.target === e.currentTarget) onClose() }}
      data-testid="access-alert-dialog"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Wifi className="size-5 text-primary" />
          </div>
          <div>
            <h3 className="font-heading text-base font-semibold text-foreground">Alert Access Details</h3>
            <p className="text-xs text-muted-foreground">Send system access information to all active users</p>
          </div>
        </div>

        {/* Info callout */}
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          <TriangleAlert className="size-4 mt-0.5 shrink-0" />
          <span>
            This email contains <strong>no credentials</strong>. It only tells users the current URL
            and that they must be in the office on <strong>Airtel Wi-Fi</strong> to access the system.
          </span>
        </div>

        {/* URL input */}
        <div className="space-y-1.5">
          <label htmlFor="access-alert-url" className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <Globe className="size-3.5 text-muted-foreground" />
            Current office URL
          </label>
          <input
            id="access-alert-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={sending}
            placeholder="http://192.168.1.50/"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">Paste the current IP/URL (e.g. http://192.168.1.50/). This is what users will see in the email.</p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="h-9 rounded-md px-4 text-sm font-medium text-muted-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            id="access-alert-send-btn"
            onClick={handleSend}
            disabled={sending || !url.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {sending ? 'Sending…' : 'Send to all users'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function AlertUsersPanel() {
  const [preview, setPreview] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [includeAlerted, setIncludeAlerted] = useState(false)
  const [initialSel, setInitialSel] = useState(new Set())
  const [resetSel, setResetSel] = useState(new Set())
  // Users an admin force-reset: the admin types the password they set, so it can be mailed (and is checked by the server).
  const [tempSel, setTempSel] = useState(new Set())
  const [passwords, setPasswords] = useState({})
  const [sharedPw, setSharedPw] = useState('')
  const [badPw, setBadPw] = useState(new Set()) // usernames the server said do not match

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sendInitial, setSendInitial] = useState(true)
  const [sendReset, setSendReset] = useState(false)
  const [sendTemp, setSendTemp] = useState(true)
  const [starting, setStarting] = useState(false)

  const [accessAlertOpen, setAccessAlertOpen] = useState(false)

  const [batch, setBatch] = useState(null)
  const [pollError, setPollError] = useState('')
  const timer = useRef(null)
  const mounted = useRef(true)
  const loadSeq = useRef(0) // only the newest load may touch the screen: an older, slower answer must not reset the ticks

  const load = useCallback(async () => {
    const mine = ++loadSeq.current
    setLoading(true)
    setLoadError('')
    try {
      const res = await previewCredentialAlerts()
      if (!mounted.current || mine !== loadSeq.current) return null
      if (!res.ok || !res.success) {
        setLoadError(res.error?.message || 'Could not load the users')
        return null
      }
      setPreview(res.data)
      setInitialSel(defaultSelection(res.data.initial, false))
      setResetSel(defaultSelection(res.data.reset, false))
      setTempSel(new Set()) // ticked once a password is typed
      setPasswords({})
      setSharedPw('')
      setBadPw(new Set())
      setIncludeAlerted(false)
      return res.data
    } catch {
      if (mounted.current && mine === loadSeq.current) setLoadError('Network error. Could not reach the server.')
      return null
    } finally {
      if (mounted.current && mine === loadSeq.current) setLoading(false)
    }
  }, [])

  const stopPolling = useCallback(() => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
  }, [])

  const poll = useCallback((batchId) => {
    stopPolling()
    let errors = 0
    let busy = false
    const tick = async () => {
      if (busy) return // never stack requests when the server is slow
      busy = true
      try {
        const res = await getCredentialBatch(batchId)
        if (!mounted.current) return
        if (!res.ok || !res.success) throw new Error('bad answer')
        errors = 0
        setPollError('')
        setBatch(res.data)
        if (isFinished(res.data)) {
          stopPolling()
          load()
        }
      } catch {
        errors += 1
        if (mounted.current && errors >= MAX_POLL_ERRORS) {
          stopPolling()
          setPollError('Lost contact with the server. The mails may still be sending: refresh in a minute.')
        }
      } finally {
        busy = false
      }
    }
    tick()
    timer.current = setInterval(tick, POLL_MS)
  }, [load, stopPolling])

  useEffect(() => {
    mounted.current = true
    load().then((data) => {
      if (data?.running_batch_id && mounted.current) poll(data.running_batch_id)
    })
    return () => {
      mounted.current = false
      stopPolling()
    }
  }, [load, poll, stopPolling])

  const running = !!batch && !isFinished(batch)

  function changeInclude(on) {
    setIncludeAlerted(on)
    setInitialSel((s) => pruneSelection(s, preview.initial, on))
    setResetSel((s) => pruneSelection(s, preview.reset, on))
    setTempSel((s) => pruneSelection(s, preview.temp, on))
  }

  // Typing a password ticks the row (and clears an old "does not match"); emptying it unticks it.
  function setPassword(row, value) {
    setPasswords((p) => ({ ...p, [row.id]: value }))
    setTempSel((s) => {
      const next = new Set(s)
      if (value.trim()) next.add(row.id)
      else next.delete(row.id)
      return next
    })
    setBadPw((b) => {
      if (!b.has(row.username)) return b
      const next = new Set(b)
      next.delete(row.username)
      return next
    })
  }

  function applySharedPassword() {
    if (!sharedPw.trim()) return
    for (const r of preview.temp) if (includeAlerted || !isAlerted(r)) setPassword(r, sharedPw)
  }

  const sendable = (rows, sel) => rows.filter((r) => sel.has(r.id) && (includeAlerted || !isAlerted(r)))
  const initialPick = preview ? sendable(preview.initial, initialSel) : []
  const resetPick = preview ? sendable(preview.reset, resetSel) : []
  const tempPick = preview ? sendable(preview.temp, tempSel) : []
  const plan = buildSend({
    initialIds: new Set(initialPick.map((r) => r.id)),
    resetIds: new Set(resetPick.map((r) => r.id)),
    tempIds: new Set(tempPick.map((r) => r.id)),
    passwords,
    sendInitial, sendReset, sendTemp, includeAlerted,
  })
  const noPassword = missingPasswords(new Set(tempPick.map((r) => r.id)), passwords)

  async function confirmSend() {
    if (starting || totalToSend === 0 || (sendTemp && noPassword.length > 0)) return
    setStarting(true)
    try {
      const res = await sendCredentialAlerts(plan.payload)
      if (res.ok && res.success) {
        setConfirmOpen(false)
        setBatch({ id: res.data.batch_id, status: 'RUNNING', total: res.data.total, sent: 0, failed: 0, failures: [] })
        poll(res.data.batch_id)
        toast.success(`Sending ${res.data.total} mail${res.data.total === 1 ? '' : 's'}…`)
      } else if (res.error?.code === 'PASSWORD_MISMATCH') {
        setConfirmOpen(false)
        setBadPw(new Set(res.error.details?.usernames || []))
        toast.error('A password you typed does not match the saved one. Nothing was sent.')
      } else {
        toast.error(res.error?.message || 'Could not start sending')
        if (res.status === 409) load()
      }
    } catch {
      toast.error('Network error.')
    } finally {
      setStarting(false)
    }
  }

  const retryFailed = batch?.failures?.length > 0

  if (loading && !preview) {
    return <div className="flex items-center gap-2 py-16 justify-center text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Checking who needs their login details…</div>
  }
  if (loadError && !preview) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center justify-between">
        <span>{loadError}</span>
        <Button size="sm" variant="outline" onClick={load}>Retry</Button>
      </div>
    )
  }

  const skipped = preview.skipped
  const totalToSend = plan.initialCount + plan.resetCount + plan.tempCount

  return (
    <div className="space-y-5" data-testid="alert-users-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-semibold flex items-center gap-2"><Mail className="size-4 text-primary" /> Alert users their credentials</h3>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
            Users who have not changed the initial password get their login details. Users whose password you reset yourself can be sent the new one. Users who already chose their own password can get a short confirmation. Nothing is sent when you add a user.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            id="access-alert-btn"
            variant="outline"
            size="sm"
            className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
            onClick={() => setAccessAlertOpen(true)}
            disabled={running}
          >
            <Wifi className="size-3.5" /> Alert Access Details
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={load} disabled={loading || running}>
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {!preview.smtp_configured && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="smtp-warning">
          <TriangleAlert className="size-4 mt-0.5 shrink-0" />
          Email is not set up on this server (EMAIL_PASSWORD is empty), so mails cannot be sent from here.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border p-4"><p className="text-2xl font-semibold" data-testid="count-initial">{preview.initial.length}</p><p className="text-xs text-muted-foreground">Have not reset their password</p></div>
        <div className="rounded-lg border border-border p-4"><p className="text-2xl font-semibold" data-testid="count-temp">{preview.temp.length}</p><p className="text-xs text-muted-foreground">Password set by an admin</p></div>
        <div className="rounded-lg border border-border p-4"><p className="text-2xl font-semibold" data-testid="count-reset">{preview.reset.length}</p><p className="text-xs text-muted-foreground">Have reset their password</p></div>
        <div className="rounded-lg border border-border p-4" data-testid="count-skipped">
          <p className="text-2xl font-semibold">{skipped.no_email + skipped.inactive}</p>
          <p className="text-xs text-muted-foreground">
            Skipped: {skipped.no_email} no valid email · {skipped.inactive} inactive
          </p>
        </div>
      </div>

      <label className="flex items-center gap-3 text-sm">
        <Switch checked={includeAlerted} onCheckedChange={changeInclude} disabled={running} aria-label="Include users I already alerted" />
        <span>Also include users I have already alerted</span>
      </label>

      {batch && (
        <div className="rounded-lg border border-border p-4 space-y-3" data-testid="batch-status">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-medium">
              {running ? <Loader2 className="size-4 animate-spin text-primary" /> : batch.failed ? <MailWarning className="size-4 text-amber-600" /> : <MailCheck className="size-4 text-emerald-600" />}
              {running ? 'Sending…' : batch.status === 'FAILED' ? 'Stopped early' : 'Finished'}
            </span>
            <span className="text-xs text-muted-foreground" data-testid="batch-counts">{batch.sent} sent · {batch.failed} failed · {batch.total} total</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${batchPercent(batch)}%` }} /></div>
          {pollError && <p className="text-xs text-destructive">{pollError}</p>}
          {retryFailed && !running && (
            <div className="space-y-1" data-testid="batch-failures">
              <p className="text-xs font-medium text-destructive">These mails were not delivered (they are back in the lists above, so you can send them again):</p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {batch.failures.map((f, i) => <li key={i}>@{f.username} ({f.email}) · {KIND_LABEL[f.kind] || f.kind}: {f.error}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <UserList
        testId="list-initial" title="Have not reset their password" hint="They will get their username, email, role and the initial password."
        rows={preview.initial} selected={initialSel} includeAlerted={includeAlerted}
        onToggle={(id) => setInitialSel((s) => toggleId(s, id))}
        onAll={() => setInitialSel(defaultSelection(preview.initial, includeAlerted))} onNone={() => setInitialSel(new Set())}
      />
      <UserList
        testId="list-temp" title="Password set by an admin"
        hint="You reset these users' passwords. Type the password you gave each one; it is checked against the saved password (it is never stored) and mailed to them."
        rows={preview.temp} selected={tempSel} includeAlerted={includeAlerted}
        onToggle={(id) => setTempSel((s) => toggleId(s, id))}
        onAll={() => setTempSel(new Set(preview.temp.filter((r) => String(passwords[r.id] ?? '').trim() && (includeAlerted || !isAlerted(r))).map((r) => r.id)))}
        onNone={() => setTempSel(new Set())}
        headerExtra={
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label htmlFor="temp-shared-pw" className="text-muted-foreground">Same password for everyone below:</label>
            <input
              id="temp-shared-pw" type="password" autoComplete="new-password" value={sharedPw}
              onChange={(e) => setSharedPw(e.target.value)} placeholder="Password you set"
              className="h-8 w-48 rounded-md border border-input bg-background px-2 text-xs"
            />
            <Button type="button" size="sm" variant="outline" className="h-8" disabled={!sharedPw.trim()} onClick={applySharedPassword}>Apply to all</Button>
          </div>
        }
        rowExtra={(r, locked) => (
          <div className="flex flex-col items-end gap-0.5">
            <input
              type="password" autoComplete="new-password" disabled={locked}
              aria-label={`Password set for ${r.full_name || r.username}`}
              value={passwords[r.id] ?? ''} onChange={(e) => setPassword(r, e.target.value)} placeholder="Password you set"
              className={`h-8 w-40 rounded-md border bg-background px-2 text-xs ${badPw.has(r.username) ? 'border-destructive' : 'border-input'}`}
            />
            {badPw.has(r.username) && <span className="text-[10px] text-destructive">Does not match the saved password</span>}
          </div>
        )}
      />
      <UserList
        testId="list-reset" title="Have reset their password" hint="They will get a confirmation (no password in it)."
        rows={preview.reset} selected={resetSel} includeAlerted={includeAlerted}
        onToggle={(id) => setResetSel((s) => toggleId(s, id))}
        onAll={() => setResetSel(defaultSelection(preview.reset, includeAlerted))} onNone={() => setResetSel(new Set())}
      />

      <div className="flex justify-end">
        <Button
          className="gap-1.5" data-testid="open-confirm"
          disabled={running || !preview.smtp_configured || (initialPick.length + resetPick.length + tempPick.length === 0)}
          onClick={() => { setSendInitial(true); setSendTemp(true); setSendReset(false); setConfirmOpen(true) }}
        >
          <Send className="size-4" /> Alert users…
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(v) => !starting && setConfirmOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send credential mails?</AlertDialogTitle>
            <AlertDialogDescription>Choose which groups to mail. Only the users ticked in the lists are included.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm">
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={sendInitial}
                onChange={(e) => setSendInitial(e.target.checked)} data-testid="confirm-initial" />
              <span>Send login details to <strong>{initialPick.length}</strong> user(s) who have not reset their password</span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={sendTemp}
                onChange={(e) => setSendTemp(e.target.checked)} data-testid="confirm-temp" />
              <span>Send the new password to <strong>{tempPick.length}</strong> user(s) whose password an admin set</span>
            </label>
            {sendTemp && noPassword.length > 0 && (
              <p className="text-xs text-destructive" data-testid="confirm-missing-pw">Type the password for every ticked user in that list first.</p>
            )}
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={sendReset} onChange={(e) => setSendReset(e.target.checked)} data-testid="confirm-reset" />
              <span>Also send a confirmation to <strong>{resetPick.length}</strong> user(s) who have already reset their password</span>
            </label>
            <p className="text-xs text-muted-foreground" data-testid="confirm-total">{totalToSend} mail(s) will be sent, one at a time.</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={starting}>Cancel</AlertDialogCancel>
            <Button onClick={confirmSend} disabled={starting || totalToSend === 0 || (sendTemp && noPassword.length > 0)} className="gap-1.5" data-testid="confirm-send">
              {starting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send {totalToSend}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AccessAlertDialog open={accessAlertOpen} onClose={() => setAccessAlertOpen(false)} />
    </div>
  )
}
