import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation, useOutletContext, Outlet } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layers, LogOut, Key, CheckCircle, Eye, EyeOff, Loader2,
  Users, LayoutDashboard, Menu, X, ChevronRight,
  FileText, TrendingUp, Activity, BarChart2, ShieldCheck, CheckSquare,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button }    from '@/components/ui/button'
import { Input }     from '@/components/ui/input'
import { Label }     from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge }     from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

import { authService, tokenStorage } from '../services/auth'
import { usePermissions } from '../hooks/usePermissions'
import { UserManagement } from './admin/UserManagement'
import { UserAvatar }     from './admin/UserAvatar'
import { RoleBadge }      from './admin/RoleBadge'
import { TendersPage }    from './tenders/TendersPage'
import { listBids }       from '../services/bids'

// ── Navigation items (each gated by a permission check) ──────────────────────
const NAV_ITEMS = [
  { id: 'overview',  label: 'Overview',        icon: LayoutDashboard, permission: null },
  { id: 'tenders',   label: 'Tenders',          icon: FileText,        permission: 'bid.view' },
  { id: 'my-tasks',  label: 'My Tasks',         icon: CheckSquare,     permission: 'task.view' },
  { id: 'users',     label: 'User Management',  icon: Users,           permission: 'user.view' },
]

// ── Force Password Change Guard ───────────────────────────────────────────────
function ForcePasswordChangeGuard({ onDone }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew,  setShowNew]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})

  async function handleSubmit(e) {
    e.preventDefault()
    const errors = {}
    if (!currentPassword) errors.current = 'Required'
    if (newPassword.length < 8) errors.new = 'Minimum 8 characters'
    if (newPassword !== confirmPassword) errors.confirm = 'Passwords do not match'
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return }

    setLoading(true)
    try {
      const result = await authService.changePassword(currentPassword, newPassword)
      if (result.ok && result.success) {
        toast.success('Password updated. Please sign in again.')
        authService.logout()
        onDone()
      } else {
        const msg = result.error?.message || 'Failed to change password'
        if (msg.toLowerCase().includes('current')) {
          setFieldErrors({ current: 'Current password is incorrect' })
        } else {
          toast.error(msg)
        }
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-lg p-6 space-y-5">
        <div className="space-y-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 border border-amber-200 mb-3">
            <Key className="size-5 text-amber-500" />
          </div>
          <h2 className="font-heading text-lg font-semibold">Set Your Password</h2>
          <p className="text-sm text-muted-foreground">
            You must set a new password before accessing the system.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="fpc-current">Current (Temporary) Password</Label>
            <Input
              id="fpc-current"
              type="password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); setFieldErrors((p) => ({ ...p, current: undefined })) }}
              aria-invalid={!!fieldErrors.current}
              disabled={loading}
            />
            {fieldErrors.current && <p className="text-xs text-destructive">{fieldErrors.current}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fpc-new">New Password</Label>
            <div className="relative">
              <Input
                id="fpc-new"
                type={showNew ? 'text' : 'password'}
                placeholder="Minimum 8 characters"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setFieldErrors((p) => ({ ...p, new: undefined })) }}
                aria-invalid={!!fieldErrors.new}
                disabled={loading}
                className="pr-9"
              />
              <button type="button" tabIndex={-1}
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {fieldErrors.new && <p className="text-xs text-destructive">{fieldErrors.new}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fpc-confirm">Confirm New Password</Label>
            <Input
              id="fpc-confirm"
              type="password"
              placeholder="Repeat new password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors((p) => ({ ...p, confirm: undefined })) }}
              aria-invalid={!!fieldErrors.confirm}
              disabled={loading}
            />
            {fieldErrors.confirm && <p className="text-xs text-destructive">{fieldErrors.confirm}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            Update Password & Sign In
          </Button>
        </form>
      </div>
    </div>
  )
}

// ── Overview Panel ────────────────────────────────────────────────────────────
export function OverviewPanel() {
  const { user } = useOutletContext()
  const navigate = useNavigate()
  const [bidStats, setBidStats] = useState({ total:0, active:0, won:0, lost:0 })

  useEffect(() => {
    listBids({ limit: 1 }).then(r => {
      if (r.ok) {
        setBidStats({
          total:  r.meta?.total ?? 0,
          active: r.meta?.active_count ?? 0,
          won:    r.meta?.won_count ?? 0,
          lost:   r.meta?.lost_count ?? 0,
        })
      }
    }).catch(()=>{})
  }, [])

  const stats = [
    { label:'Active Tenders', value: bidStats.active, icon: FileText,   color:'text-blue-600',   bg:'bg-blue-50',    border:'border-blue-100' },
    { label:'Total Tenders',  value: bidStats.total,  icon: TrendingUp, color:'text-violet-600', bg:'bg-violet-50',  border:'border-violet-100' },
    { label:'Won Bids',       value: bidStats.won,    icon: CheckCircle,color:'text-emerald-600',bg:'bg-emerald-50', border:'border-emerald-100' },
    { label:'Lost Bids',      value: bidStats.lost,   icon: Activity,   color:'text-red-600',   bg:'bg-red-50',     border:'border-red-100' },
    { label:'Permissions',    value:(user?.permissions??[]).length, icon:ShieldCheck, color:'text-amber-600',bg:'bg-amber-50',border:'border-amber-100' },
    { label:'Roles',          value:(user?.roles??[]).length,       icon:BarChart2,   color:'text-slate-600', bg:'bg-slate-50',border:'border-slate-200' },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            Welcome back{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage users, monitor platform activity, and oversee tender operations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RoleBadge role={user?.roles?.[0] ?? 'USER'} />
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20"/>
            <span className="text-xs font-medium text-emerald-700">System Healthy</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s, i) => (
          <motion.div key={s.label}
            initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}
            className={`rounded-xl border ${s.border} p-4 bg-card hover:shadow-sm transition-shadow`}>
            <div className={`size-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
              <s.icon className={`size-4 ${s.color}`}/>
            </div>
            <p className={`text-2xl font-bold font-heading ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Profile + Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Profile</p>
          <div className="flex items-center gap-3">
            <UserAvatar fullName={user?.full_name} username={user?.username} size="lg" />
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground">{user?.full_name || user?.username}</p>
              <p className="text-xs text-muted-foreground">@{user?.username}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{user?.employee_code ?? ''}</p>
            </div>
          </div>
          <Separator/>
          <div className="flex flex-wrap gap-1.5">
            {(user?.roles??[]).map(r=><RoleBadge key={r} role={r}/>)}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Actions</p>
          <div className="space-y-2">
              {[
                { label:'View All Tenders', icon:FileText, section:'tenders', perm:'bid.view' },
                { label:'Manage Users',     icon:Users,    section:'users',   perm:'user.view' },
              ].map(a => (
                <button key={a.label}
                  onClick={()=>navigate(`/dashboard/${a.section}`)}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg border border-border hover:bg-muted/55 hover:border-primary/30 transition-all text-left group">
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-md bg-primary/10 flex items-center justify-center">
                    <a.icon className="size-3.5 text-primary"/>
                  </div>
                  <span className="text-sm font-medium text-foreground">{a.label}</span>
                </div>
                <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors"/>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Change password modal
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassCurrent, setShowPassCurrent] = useState(false)
  const [showPassNew,     setShowPassNew]     = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)

  const { hasPermission } = usePermissions()

  // Load user on mount
  useEffect(() => {
    const currentUser = tokenStorage.getUser()
    if (!currentUser) {
      toast.error('Session expired. Please sign in again.')
      navigate('/login')
      return
    }
    setUser(currentUser)
  }, [])

  async function handleLogout() {
    const p = authService.logout()
    toast.promise(p, {
      loading: 'Signing out…',
      success: () => { navigate('/login'); return 'Signed out' },
      error: 'Sign out failed; session cleared locally',
    })
  }

  async function handleChangePasswordSubmit(e) {
    e.preventDefault()
    if (newPassword.length < 8) { toast.error('New password must be at least 8 characters'); return }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return }

    setIsChangingPassword(true)
    try {
      const result = await authService.changePassword(currentPassword, newPassword)
      if (result.ok && result.success) {
        setShowPasswordModal(false)
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
        setShowSuccessDialog(true)
      } else {
        toast.error(result.error?.message || 'Failed to change password')
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setIsChangingPassword(false)
    }
  }

  if (!user) return null

  // Force password change — block entire UI
  if (user.force_password_change) {
    return <ForcePasswordChangeGuard onDone={() => navigate('/login')} />
  }

  const activeSection = location.pathname.includes('/tenders')
    ? 'tenders'
    : location.pathname.includes('/my-tasks') || location.pathname.includes('/tasks/')
    ? 'my-tasks'
    : location.pathname.includes('/users')
    ? 'users'
    : 'overview'

  // Build nav items visible to this user
  const visibleNavItems = NAV_ITEMS.filter((item) =>
    item.permission === null || hasPermission(item.permission)
  )

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">

      {/* ── Top Nav ───────────────────────────────────────────────────────── */}
      <header className="border-b border-border bg-card z-30 sticky top-0">
        <div className="flex items-center justify-between h-14 px-4 md:px-6">

          {/* Logo + mobile menu toggle */}
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-1.5 rounded-md hover:bg-muted transition-colors"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Toggle navigation"
            >
              {sidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Layers className="size-3.5" />
              </div>
              <span className="font-heading text-sm font-semibold text-foreground">OneTrack GeM AI</span>
            </div>
          </div>

          {/* Right side: user info + actions */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 mr-1">
              <UserAvatar fullName={user.full_name} username={user.username} size="sm" />
              <div className="hidden md:block">
                <p className="text-xs font-medium text-foreground leading-none">{user.username}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {user.roles?.[0] ?? 'USER'}
                </p>
              </div>
            </div>

            <Button
              variant="default"
              size="sm"
              onClick={handleLogout}
              className="gap-1.5"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        {/* Desktop sidebar */}
        <aside className="hidden md:flex flex-col w-40 border-r border-border bg-card shrink-0">
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {visibleNavItems.map((item) => {
              const active = activeSection === item.id
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id === 'overview' ? '/dashboard' : `/dashboard/${item.id}`)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left
                    ${active
                      ? 'bg-primary/8 text-primary border border-primary/15'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                >
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Mobile sidebar overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-20 bg-foreground/20 md:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.aside
                initial={{ x: -224 }}
                animate={{ x: 0 }}
                exit={{ x: -224 }}
                transition={{ type: 'tween', duration: 0.2 }}
                className="fixed top-14 left-0 bottom-0 z-20 w-56 border-r border-border bg-card md:hidden flex flex-col"
              >
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                  {visibleNavItems.map((item) => {
                    const active = activeSection === item.id
                    const Icon = item.icon
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          navigate(item.id === 'overview' ? '/dashboard' : `/dashboard/${item.id}`)
                          setSidebarOpen(false)
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left
                          ${active
                            ? 'bg-primary/8 text-primary border border-primary/15'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          }`}
                      >
                        <Icon className="size-4 shrink-0" />
                        {item.label}
                      </button>
                    )
                  })}
                </nav>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* ── Main Content ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 h-full overflow-y-auto overflow-x-hidden bg-background">
          <main className="w-full min-w-0 p-6 md:p-6">
            <Outlet context={{ user }} />
          </main>
        </div>
      </div>

      {/* ── Change Password Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-foreground/20 backdrop-blur-xs"
              onClick={() => !isChangingPassword && setShowPasswordModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="relative z-10 w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-xl space-y-5"
            >
              <div>
                <h3 className="font-heading text-base font-semibold flex items-center gap-2">
                  <Key className="size-4 text-primary" />
                  Change Password
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Enter your current password to set a new one.
                </p>
              </div>

              <form onSubmit={handleChangePasswordSubmit} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="cp-current">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="cp-current"
                      type={showPassCurrent ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={isChangingPassword}
                      className="pr-9"
                    />
                    <button type="button" tabIndex={-1}
                      onClick={() => setShowPassCurrent((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cp-new">New Password</Label>
                  <div className="relative">
                    <Input
                      id="cp-new"
                      type={showPassNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      disabled={isChangingPassword}
                      className="pr-9"
                    />
                    <button type="button" tabIndex={-1}
                      onClick={() => setShowPassNew((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cp-confirm">Confirm New Password</Label>
                  <Input
                    id="cp-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    disabled={isChangingPassword}
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" className="flex-1"
                    onClick={() => setShowPasswordModal(false)} disabled={isChangingPassword}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isChangingPassword}>
                    {isChangingPassword && <Loader2 className="size-4 animate-spin" />}
                    Update Password
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Post-Password-Change Success Dialog ──────────────────────────── */}
      <AnimatePresence>
        {showSuccessDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-foreground/20 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="relative z-10 w-full max-w-sm bg-card border border-border rounded-xl p-6 shadow-xl text-center space-y-4"
            >
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100">
                <CheckCircle className="size-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-heading text-base font-semibold">Password Updated</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your session will be cleared. Sign in again with your new password.
                </p>
              </div>
              <Button className="w-full" onClick={() => { setShowSuccessDialog(false); authService.logout(); navigate('/login') }}>
                Sign In Again
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
