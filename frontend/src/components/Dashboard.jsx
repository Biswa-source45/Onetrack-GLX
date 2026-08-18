import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation, useOutletContext, Outlet } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layers, LogOut, Key, CheckCircle, Eye, EyeOff, Loader2,
  Users, LayoutDashboard, Menu, X, ChevronRight,
  FileText, TrendingUp, Activity, BarChart2, ShieldCheck, Bell,
  Award, XCircle, Clock, Calendar, Filter, IndianRupee, Search, UserCheck, RefreshCw, Trash2, Pencil
} from 'lucide-react'
import { toast } from 'sonner'

import { Button }    from '@/components/ui/button'
import { Input }     from '@/components/ui/input'
import { Label }     from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge }     from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

import { authService, tokenStorage } from '../services/auth'
import { getMyProfile, updateUserProfile } from '../services/users'
import { getAlerts } from '../services/alerts'
import { usePermissions } from '../hooks/usePermissions'
import { UserManagement } from './admin/UserManagement'
import { UserAvatar }     from './admin/UserAvatar'
import { RoleBadge }      from './admin/RoleBadge'
import { TendersPage }    from './tenders/TendersPage'
import { listBids }       from '../services/bids'
import { getTenderPerformanceMatrix } from '../services/bids'

// ── Navigation items (each gated by a permission check) ──────────────────────
const NAV_ITEMS = [
  { id: 'overview',   label: 'Overview',        icon: LayoutDashboard, permission: null },
  { 
    id: 'tenders',    
    label: 'Tenders',          
    icon: FileText,        
    permission: 'bid.view',
    children: [
      { id: 'tenders-all', label: 'All Tenders', icon: Layers, path: '/dashboard/tenders' },
      { id: 'tenders-owned', label: 'Owned Tenders', icon: UserCheck, path: '/dashboard/tenders/owned' }
    ]
  },
  { 
    id: 'analytics',  
    label: 'Analytics',        
    icon: BarChart2,       
    permission: 'bid.view',
    children: [
      { id: 'analytics-tenders', label: 'Tender Analytics', icon: Activity, path: '/dashboard/analytics/tenders' },
      { id: 'analytics-matrix', label: 'Owner Matrix', icon: Users, path: '/dashboard/analytics/performance-matrix' }
    ]
  },
  { id: 'alerts',     label: 'Alerts',           icon: Bell,            permission: 'bid.view' },
  { id: 'users',      label: 'User Management',  icon: Users,           permission: 'user.view' },
]

function isChildActive(child, pathname) {
  if (child.id === 'tenders-all') {
    return pathname === '/dashboard/tenders' || pathname === '/dashboard/tenders/'
  }
  if (child.id === 'tenders-owned') {
    return pathname.startsWith('/dashboard/tenders/owned')
  }
  if (child.id === 'analytics-tenders') {
    return pathname === '/dashboard/analytics' || pathname.startsWith('/dashboard/analytics/tenders')
  }
  if (child.id === 'analytics-matrix') {
    return pathname.startsWith('/dashboard/analytics/performance-matrix')
  }
  return pathname === child.path
}

// Currency Helper
function formatCurrency(val) {
  if (val === null || val === undefined || isNaN(val)) return '₹0'
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`
  return `₹${val.toLocaleString('en-IN')}`
}

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
        toast.success('Password updated successfully! Redirecting to login...')
        tokenStorage.clear()
        setTimeout(() => {
          window.location.href = '/login'
        }, 1000)
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
            {loading && <Loader2 className="size-4 animate-spin mr-2" />}
            Update Password & Sign In
          </Button>
        </form>
      </div>
    </div>
  )
}

// ── Overview Panel ────────────────────────────────────────────────────────────
export function OverviewPanel() {
  const { user, onOpenProfile } = useOutletContext()
  const navigate = useNavigate()
  const [bids, setBids] = useState([])
  const [binCount, setBinCount] = useState(0)
  const [loading, setLoading] = useState(true)

  // Tender Performance Matrix (real-time, dedicated endpoint)
  const [perfMatrix, setPerfMatrix]         = useState([])
  const [matrixLoading, setMatrixLoading]   = useState(true)
  const [matrixError, setMatrixError]       = useState(null)
  const [lastMatrixRefresh, setLastMatrixRefresh] = useState(null)

  // Custom Analytics Filters
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')
  const [executiveFilter, setExecutiveFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchBids = async () => {
    setLoading(true)
    try {
      const [r, binRes] = await Promise.all([
        listBids({ limit: 200 }),
        listBids({ in_bin: true, limit: 200 })
      ])
      if (r.ok && r.data) {
        const rawList = Array.isArray(r.data) ? r.data : (r.data?.bids || [])
        setBids(rawList)
      }
      if (binRes.ok && binRes.data) {
        const binList = Array.isArray(binRes.data) ? binRes.data : (binRes.data?.bids || [])
        setBinCount(binList.length)
      }
    } catch {
      toast.error('Failed to load tenders analytics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBids()
  }, [])

  // Fetch performance matrix on mount and auto-refresh every 60s
  const fetchMatrix = useCallback(async () => {
    setMatrixLoading(true)
    setMatrixError(null)
    try {
      const r = await getTenderPerformanceMatrix()
      if (r.ok && r.data) {
        setPerfMatrix(Array.isArray(r.data) ? r.data : [])
        setLastMatrixRefresh(new Date())
      } else {
        setMatrixError('Failed to load performance matrix')
      }
    } catch {
      setMatrixError('Network error loading performance matrix')
    } finally {
      setMatrixLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMatrix()
    const interval = setInterval(fetchMatrix, 60000) // refresh every 60s
    return () => clearInterval(interval)
  }, [fetchMatrix])

  // Management Role Gating: Only Super Admin, Admin, and Manager get full BI Analytics
  const isManagement = user?.roles?.some(r => ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(r))

  // Filter logic
  const filteredBids = bids.filter(b => {
    if (startDateFilter && b.created_at && new Date(b.created_at) < new Date(startDateFilter)) return false
    if (endDateFilter && b.created_at && new Date(b.created_at) > new Date(endDateFilter + 'T23:59:59')) return false

    if (executiveFilter) {
      const ownerName = b.bid_owner?.full_name || b.bid_owner?.username || ''
      if (!ownerName.toLowerCase().includes(executiveFilter.toLowerCase())) return false
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const title = (b.title || '').toLowerCase()
      const bidNo = (b.bid_no || b.gem_bid_no || '').toLowerCase()
      const org = (b.organization_name || '').toLowerCase()
      if (!title.includes(q) && !bidNo.includes(q) && !org.includes(q)) return false
    }

    return true
  })

  // BI Metrics Calculation
  const totalBids = filteredBids.length
  
  const submittedBids = filteredBids.filter(b => 
    b.submission_done || 
    ['GEM_SUBMISSION', 'GE_M_SUBMISSION', 'TECHNICAL_EVALUATION', 'FINANCIAL_EVALUATION', 'AWARD_HANDOVER'].includes(b.workflow_stage) ||
    b.submission_status === 'SUBMITTED' ||
    b.bid_status === 'SUBMITTED'
  ).length

  const notSubmittedBids = Math.max(0, totalBids - submittedBids)

  const techEvalBids = filteredBids.filter(b => 
    b.workflow_stage === 'TECHNICAL_EVALUATION' || b.bid_status === 'TECHNICAL_EVALUATION' || b.has_tech_eval
  ).length

  const finEvalBids = filteredBids.filter(b => 
    b.workflow_stage === 'FINANCIAL_EVALUATION'
  ).length

  const wonBids = filteredBids.filter(b => 
    b.bid_status === 'WON' || b.bid_outcome === 'WON' || b.workflow_stage === 'WON'
  ).length

  const lostBids = filteredBids.filter(b => 
    b.bid_status === 'LOST' || b.bid_outcome === 'LOST' || b.workflow_stage === 'LOST' || b.technical_result === 'DISQUALIFIED'
  ).length

  const cancelledBids = filteredBids.filter(b =>
    b.bid_status === 'CANCELLED' || b.bid_outcome === 'CANCELLED' || b.workflow_stage === 'CANCELLED'
  ).length

  // Financial BI metrics
  const totalWonValue = filteredBids
    .filter(b => b.bid_status === 'WON' || b.bid_outcome === 'WON' || b.workflow_stage === 'WON')
    .reduce((sum, b) => sum + (b.final_bid_value || b.estimated_value || 0), 0)

  // EMD is counted as deposited ONLY if not exempted, amount > 0, and bid reached/passed EMD_PROCESSING stage (or emd_ready/emd_returned is true)
  const emdDepositedBids = filteredBids.filter(b => {
    if (b.emd_exempted || !b.emd_amount || Number(b.emd_amount) <= 0) return false
    if (b.emd_ready || b.emd_returned) return true
    const postEmdStages = [
      'EMD_PROCESSING', 'INTERNAL_APPROVAL',
      'GEM_SUBMISSION', 'TECHNICAL_EVALUATION', 'FINANCIAL_EVALUATION',
      'AWARD_HANDOVER', 'WON', 'LOST'
    ]
    return postEmdStages.includes(b.workflow_stage)
  })

  const totalEMDDeposited = emdDepositedBids.reduce((sum, b) => sum + Number(b.emd_amount || 0), 0)

  const totalEMDReturned = emdDepositedBids
    .filter(b => b.emd_returned)
    .reduce((sum, b) => sum + Number(b.emd_amount || 0), 0)

  const pendingEMDReturn = Math.max(0, totalEMDDeposited - totalEMDReturned)

  // Stage Funnel Analytics Data
  const stageGroups = [
    { label: 'Stages 1-4: Discovery & Pre-Qual', stages: ['DISCOVERED', 'ELIGIBILITY_ASSESSMENT', 'OEM_AUTHORIZATION_REQUEST', 'PRICING_REQUEST'], color: 'bg-violet-500', barGradient: 'from-violet-500 to-indigo-500' },
    { label: 'Stages 5-7: Costing & Docs', stages: ['DOCUMENT_CHECKLIST_PREPARATION', 'EMD_PROCESSING', 'INTERNAL_APPROVAL'], color: 'bg-blue-500', barGradient: 'from-blue-500 to-sky-500' },
    { label: 'Stage 8: Portal Submission', stages: ['GEM_SUBMISSION'], color: 'bg-emerald-500', barGradient: 'from-emerald-500 to-teal-500' },
    { label: 'Stage 9: Technical Eval', stages: ['TECHNICAL_EVALUATION'], color: 'bg-amber-500', barGradient: 'from-amber-500 to-yellow-500' },
    { label: 'Stage 10: Financial Eval', stages: ['FINANCIAL_EVALUATION'], color: 'bg-indigo-500', barGradient: 'from-indigo-500 to-purple-500' },
    { label: 'Stage 11: Award & Handover', stages: ['AWARD_HANDOVER'], color: 'bg-teal-500', barGradient: 'from-teal-500 to-emerald-600' },
  ]

  const stageFunnelData = stageGroups.map(grp => {
    const groupBids = filteredBids.filter(b => grp.stages.includes(b.workflow_stage))
    const count = groupBids.length
    const val = groupBids.reduce((s, b) => s + (b.estimated_value || 0), 0)
    const pct = totalBids > 0 ? ((count / totalBids) * 100).toFixed(1) : 0
    return { ...grp, count, val, pct }
  })

  // Executive dropdown options (for analytics filter toolbar)
  const uniqueExecs = Array.from(new Set(bids.map(b => b.bid_owner?.full_name || b.bid_owner?.username).filter(Boolean)))

  const headerStats = [
    { label:'Total Tenders',     value: totalBids,         icon: Layers,       color:'text-violet-600', bg:'bg-violet-50',  border:'border-violet-200', onClick: () => navigate('/dashboard/tenders') },
    { label:'Submitted',         value: submittedBids,     icon: CheckCircle,  color:'text-emerald-600',bg:'bg-emerald-50', border:'border-emerald-200', onClick: () => navigate('/dashboard/tenders?status=SUBMITTED') },
    { label:'Tech Eval',         value: techEvalBids,      icon: FileText,     color:'text-blue-600',   bg:'bg-blue-50',    border:'border-blue-200', onClick: () => navigate('/dashboard/tenders?status=TECHNICAL_EVALUATION') },
    { label:'Financial Eval',    value: finEvalBids,       icon: IndianRupee,  color:'text-indigo-600', bg:'bg-indigo-50',  border:'border-indigo-200', onClick: () => navigate('/dashboard/tenders?stage=FINANCIAL_EVALUATION') },
    { label:'Won Bids',          value: wonBids,           icon: Award,        color:'text-teal-600',   bg:'bg-teal-50',    border:'border-teal-200', onClick: () => navigate('/dashboard/tenders?status=WON') },
    { label:'Lost Bids',         value: lostBids,          icon: XCircle,      color:'text-rose-600',   bg:'bg-rose-50',    border:'border-rose-200', onClick: () => navigate('/dashboard/tenders?status=LOST') },
    { label:'Cancelled',         value: cancelledBids,     icon: XCircle,      color:'text-slate-600',  bg:'bg-slate-100',  border:'border-slate-300', onClick: () => navigate('/dashboard/tenders?status=CANCELLED') },
    { label:'Tender Bin',        value: binCount,          icon: Trash2,       color:'text-rose-700',   bg:'bg-rose-100/60', border:'border-rose-300', onClick: () => navigate('/dashboard/tenders?bin=true') },
  ]

  const overallWinRate = totalBids > 0 ? ((wonBids / totalBids) * 100).toFixed(1) : '0.0'

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex items-start justify-between flex-wrap gap-4 bg-gradient-to-r from-card via-card to-muted/30 p-5 rounded-2xl border border-border/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold text-foreground tracking-tight">
              Welcome back{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
            </h1>
            <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20 font-mono">
              {isManagement ? 'Management BI Analytics' : 'Executive Operational Overview'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {isManagement 
              ? 'Real-time enterprise tender analytics, stage distribution & performance matrix.'
              : 'Operational tender workspace overview & quick activity panel.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchBids} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
          <RoleBadge role={user?.roles?.[0] ?? 'USER'} />
        </div>
      </div>

      {/* ── MANAGEMENT ONLY BI ANALYTICS SUITE ──────────────────────────────── */}
      {isManagement ? (
        <>
          {/* 8-Card Enterprise Analytics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {headerStats.map((s, i) => (
              <motion.div key={s.label}
                onClick={s.onClick}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className={`rounded-xl border ${s.border} p-3.5 bg-card hover:shadow-md transition-all cursor-pointer group`}>
                <div className="flex items-center justify-between mb-2">
                  <div className={`size-8 rounded-lg ${s.bg} flex items-center justify-center group-hover:scale-105 transition-transform`}>
                    <s.icon className={`size-4 ${s.color}`}/>
                  </div>
                </div>
                <p className={`text-2xl font-extrabold font-heading tracking-tight ${s.color}`}>{s.value}</p>
                <p className="text-[11px] font-medium text-muted-foreground mt-0.5 truncate group-hover:text-foreground">{s.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Analytics & Filtration Toolbar */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Filter className="size-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground">BI Analytics Filtration</span>
              </div>
              {(startDateFilter || endDateFilter || executiveFilter || searchQuery) && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => { setStartDateFilter(''); setEndDateFilter(''); setExecutiveFilter(''); setSearchQuery(''); }}
                  className="text-xs text-muted-foreground hover:text-foreground h-7"
                >
                  Clear Filters
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">Start Date</Label>
                <Input
                  type="date"
                  value={startDateFilter}
                  onChange={e => setStartDateFilter(e.target.value)}
                  className="h-8 text-xs pr-2"
                />
              </div>

              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">End Date</Label>
                <Input
                  type="date"
                  value={endDateFilter}
                  onChange={e => setEndDateFilter(e.target.value)}
                  className="h-8 text-xs pr-2"
                />
              </div>

              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">Bid Executive (Owner)</Label>
                <select
                  value={executiveFilter}
                  onChange={e => setExecutiveFilter(e.target.value)}
                  className="w-full h-8 text-xs rounded-md border border-input bg-background px-2.5 py-1 text-foreground shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">All Executives</option>
                  {uniqueExecs.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">Search Tender / Bid No</Label>
                <div className="relative">
                  <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search title, organisation..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="h-8 text-xs pl-8"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* VISUAL ANALYTICS GRAPHS GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Stage Pipeline Funnel Bar Chart */}
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-semibold text-base text-foreground flex items-center gap-2">
                    <BarChart2 className="size-4 text-primary" /> Tender Stage Funnel Distribution
                  </h3>
                  <p className="text-xs text-muted-foreground">Volume and estimated value of tenders progressing across workflow stages</p>
                </div>
                <Badge variant="outline" className="text-xs font-mono">{totalBids} Total Tenders</Badge>
              </div>

              <div className="space-y-3 pt-1">
                {stageFunnelData.map((stg) => (
                  <div key={stg.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-foreground truncate max-w-[280px]">{stg.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-foreground font-mono">{stg.count} bids ({stg.pct}%)</span>
                        <span className="text-muted-foreground text-[11px] font-mono">{formatCurrency(stg.val)}</span>
                      </div>
                    </div>
                    <div className="h-3 w-full bg-muted/40 rounded-full overflow-hidden p-0.5 border border-border/40">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${stg.pct}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className={`h-full rounded-full bg-gradient-to-r ${stg.barGradient}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Win/Loss Conversion Ring Chart */}
            <div className="bg-card border border-border rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-xs">
              <div>
                <h3 className="font-heading font-semibold text-base text-foreground flex items-center gap-2">
                  <TrendingUp className="size-4 text-emerald-500" /> Win / Loss Conversion
                </h3>
                <p className="text-xs text-muted-foreground">Overall conversion rate across active portfolio</p>
              </div>

              {/* Visual Ring Gauge */}
              <div className="flex flex-col items-center justify-center my-2 space-y-2">
                <div className="relative size-36 flex items-center justify-center">
                  <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-muted/30"
                      strokeWidth="3.8"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <motion.path
                      initial={{ strokeDasharray: '0, 100' }}
                      animate={{ strokeDasharray: `${overallWinRate}, 100` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="text-teal-500"
                      strokeWidth="3.8"
                      strokeDasharray="0, 100"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-extrabold font-heading text-teal-600">{overallWinRate}%</span>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Win Rate</span>
                  </div>
                </div>
              </div>

              {/* Breakdown Legend */}
              <div className="space-y-2 text-xs border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-2.5 rounded-full bg-teal-500" />
                    <span className="text-muted-foreground">Won Bids</span>
                  </div>
                  <span className="font-bold text-teal-600 font-mono">{wonBids} ({totalBids > 0 ? ((wonBids/totalBids)*100).toFixed(0) : 0}%)</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-2.5 rounded-full bg-rose-500" />
                    <span className="text-muted-foreground">Lost Bids</span>
                  </div>
                  <span className="font-bold text-rose-600 font-mono">{lostBids} ({totalBids > 0 ? ((lostBids/totalBids)*100).toFixed(0) : 0}%)</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-2.5 rounded-full bg-violet-500" />
                    <span className="text-muted-foreground">Active / Pending</span>
                  </div>
                  <span className="font-bold text-violet-600 font-mono">{Math.max(0, totalBids - wonBids - lostBids)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Financial BI Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Won Order Value</span>
                <div className="size-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <IndianRupee className="size-4 text-emerald-600" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold font-heading text-emerald-600">{formatCurrency(totalWonValue)}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Sum of won bid contract values</p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">EMD Deposited</span>
                <div className="size-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                  <IndianRupee className="size-4 text-blue-600" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold font-heading text-blue-600">{formatCurrency(totalEMDDeposited)}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Total EMD amount submitted across tenders</p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">EMD Returned</span>
                <div className="size-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center">
                  <CheckCircle className="size-4 text-teal-600" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold font-heading text-teal-600">{formatCurrency(totalEMDReturned)}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">EMD successfully refunded back</p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">EMD Pending Refund</span>
                <div className="size-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
                  <Clock className="size-4 text-amber-600" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold font-heading text-amber-600">{formatCurrency(pendingEMDReturn)}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Outstanding EMD awaiting refund</p>
              </div>
            </div>
          </div>

          {/* Tender Owner Performance Matrix (Management BI) — Real-time from backend */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-heading font-semibold text-base text-foreground flex items-center gap-2">
                  <UserCheck className="size-4 text-primary" />
                  Tender Owner Performance Matrix
                </h3>
                <p className="text-xs text-muted-foreground">
                  Real-time tender lifecycle metrics per owner — all roles (Admin, Super Admin, Manager, Bid Executive)
                </p>
              </div>
              <div className="flex items-center gap-2">
                {lastMatrixRefresh && (
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Updated {lastMatrixRefresh.toLocaleTimeString()}
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchMatrix}
                  disabled={matrixLoading}
                  className="gap-1.5 text-xs h-7"
                >
                  <RefreshCw className={`size-3 ${matrixLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Badge variant="secondary" className="text-xs font-mono">
                  {perfMatrix.length} Owner{perfMatrix.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </div>

            {matrixError ? (
              <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">
                <XCircle className="size-4 shrink-0" />
                {matrixError}
              </div>
            ) : matrixLoading && perfMatrix.length === 0 ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-xs">
                <Loader2 className="size-4 animate-spin text-primary" /> Loading performance matrix...
              </div>
            ) : perfMatrix.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No tender owners found yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider">
                      <th className="py-2.5 px-3">Tender Owner</th>
                      <th className="py-2.5 px-2 text-center">Role</th>
                      <th className="py-2.5 px-3 text-center font-bold text-foreground">Total</th>
                      <th className="py-2.5 px-3 text-center">Active</th>
                      <th className="py-2.5 px-3 text-center">Submitted</th>
                      <th className="py-2.5 px-3 text-center">Tech Eval</th>
                      <th className="py-2.5 px-3 text-center">Fin Eval</th>
                      <th className="py-2.5 px-3 text-center">Award</th>
                      <th className="py-2.5 px-3 text-center">Won</th>
                      <th className="py-2.5 px-3 text-center">Lost</th>
                      <th className="py-2.5 px-3 text-center">Cancelled</th>
                      <th className="py-2.5 px-3 text-right">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {perfMatrix.map((st) => {
                      const winRate = st.total > 0 ? ((st.won / st.total) * 100).toFixed(1) : '0.0'
                      const roleColor = {
                        SUPER_ADMIN: 'bg-violet-50 text-violet-700 border-violet-200',
                        ADMIN:       'bg-blue-50 text-blue-700 border-blue-200',
                        MANAGER:     'bg-indigo-50 text-indigo-700 border-indigo-200',
                        BID_EXECUTIVE: 'bg-teal-50 text-teal-700 border-teal-200',
                        FINANCE:     'bg-amber-50 text-amber-700 border-amber-200',
                        PRE_SALES:   'bg-emerald-50 text-emerald-700 border-emerald-200',
                      }[st.role] || 'bg-slate-50 text-slate-600 border-slate-200'
                      const roleLabel = {
                        SUPER_ADMIN: 'Super Admin',
                        ADMIN: 'Admin',
                        MANAGER: 'Manager',
                        BID_EXECUTIVE: 'Bid Exec',
                        FINANCE: 'Finance',
                        PRE_SALES: 'Pre-Sales',
                      }[st.role] || (st.role || 'User')
                      return (
                        <motion.tr
                          key={st.user_id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="hover:bg-muted/20 transition-colors"
                        >
                          <td className="py-3 px-3 font-semibold text-foreground">
                            <div className="flex items-center gap-2">
                              <UserAvatar fullName={st.full_name} username={st.username} size="xs" />
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground text-xs truncate max-w-[140px]">{st.full_name || st.username}</p>
                                <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[140px]">@{st.username}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${roleColor}`}>
                              {roleLabel}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-foreground text-sm">{st.total}</td>
                          <td className="py-3 px-3 text-center text-blue-600 font-medium">{st.active}</td>
                          <td className="py-3 px-3 text-center text-lime-600 font-medium">{st.submitted}</td>
                          <td className="py-3 px-3 text-center text-teal-600 font-medium">{st.tech_eval}</td>
                          <td className="py-3 px-3 text-center text-cyan-600 font-medium">{st.fin_eval}</td>
                          <td className="py-3 px-3 text-center text-emerald-600 font-medium">{st.award}</td>
                          <td className="py-3 px-3 text-center text-teal-700 font-bold">{st.won}</td>
                          <td className="py-3 px-3 text-center text-rose-600 font-medium">{st.lost}</td>
                          <td className="py-3 px-3 text-center text-slate-500 font-medium">{st.cancelled}</td>
                          <td className="py-3 px-3 text-right">
                            <Badge
                              variant="outline"
                              className={`font-mono text-[11px] ${
                                Number(winRate) >= 50
                                  ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                                  : Number(winRate) > 0
                                  ? 'border-amber-300 text-amber-700 bg-amber-50'
                                  : 'border-slate-300 text-slate-600 bg-slate-50'
                              }`}
                            >
                              {winRate}%
                            </Badge>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* ── NON-MANAGEMENT OPERATIONAL OVERVIEW (Finance, Bid Exec, Pre-Sales, etc) ──── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Tenders</span>
            <p className="text-2xl font-bold font-heading text-primary">{totalBids}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Submissions Done</span>
            <p className="text-2xl font-bold font-heading text-emerald-600">{submittedBids}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Under Evaluation</span>
            <p className="text-2xl font-bold font-heading text-blue-600">{techEvalBids + finEvalBids}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Won Tenders</span>
            <p className="text-2xl font-bold font-heading text-teal-600">{wonBids}</p>
          </div>
        </div>
      )}

      {/* Quick Actions & Recent Tenders Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Tenders View */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-semibold text-sm text-foreground">Recent Active Tenders</h3>
            <Button variant="ghost" size="xs" onClick={() => navigate('/dashboard/tenders')} className="text-xs text-primary h-7">
              View All Tenders <ChevronRight className="size-3.5 ml-1" />
            </Button>
          </div>

          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-xs gap-2">
                <Loader2 className="size-4 animate-spin text-primary" /> Loading tenders...
              </div>
            ) : filteredBids.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No tenders matching selected criteria</p>
            ) : (
              filteredBids.slice(0, 5).map(b => (
                <div key={b.id} onClick={() => navigate('/dashboard/tenders')} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors cursor-pointer group">
                  <div className="space-y-0.5 min-w-0 pr-3">
                    <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {b.title}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-mono text-primary/80">{b.bid_no || b.gem_bid_no || 'No ID'}</span>
                      <span>•</span>
                      <span>{b.organization_name || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant="outline" className="text-[10px] font-mono capitalize">
                      {(b.workflow_stage || 'DISCOVERED').replace(/_/g, ' ')}
                    </Badge>
                    <span className="text-xs font-bold font-heading text-foreground">
                      {formatCurrency(b.estimated_value)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Actions</p>
          <div className="space-y-2">
            {[
              { label:'View All Tenders', icon:FileText, action: () => navigate('/dashboard/tenders'), perm:'bid.view' },
              { label:'Manage Users',     icon:Users,    action: () => navigate('/dashboard/users'),   perm:'user.view' },
              { label:'My Profile & Security', icon:Key, action: () => onOpenProfile?.(), perm: null },
            ].filter(a => a.perm === null || user?.permissions?.includes(a.perm)).map(a => (
              <button key={a.label}
                onClick={a.action}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/55 hover:border-primary/30 transition-all text-left group">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center">
                    <a.icon className="size-4 text-primary"/>
                  </div>
                  <span className="text-xs font-semibold text-foreground">{a.label}</span>
                </div>
                <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors"/>
              </button>
            ))}
          </div>

          <Separator className="my-2" />

          {/* System Profile Summary */}
          <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">User Account</span>
            <div className="flex items-center gap-2.5">
              <UserAvatar fullName={user?.full_name} username={user?.username} size="sm" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{user?.full_name || user?.username}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user?.email || `@${user?.username}`}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
// ── User Profile Modal ────────────────────────────────────────────────────────
function UserProfileModal({ user, open, onClose, onOpenPasswordChange, onUpdateUser }) {
  const [isEditing, setIsEditing] = useState(false)
  const [fullName, setFullName]     = useState('')
  const [email, setEmail]         = useState('')
  const [phone, setPhone]         = useState('')
  const [department, setDepartment] = useState('')
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '')
      setEmail(user.email || '')
      setPhone(user.phone || '')
      setDepartment(user.department || '')
      setIsEditing(false)
    }
  }, [user, open])

  if (!open || !user) return null

  async function handleSaveProfile(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        full_name:  fullName.trim(),
        email:      email.trim(),
        phone:      phone.trim(),
        department: department.trim(),
      }
      const res = await updateUserProfile(user.id, payload)
      if (res.ok && res.success) {
        toast.success('Profile updated successfully')
        const updatedUser = { ...user, ...res.data }
        onUpdateUser?.(updatedUser)

        const currentLocalUser = tokenStorage.getUser()
        if (currentLocalUser) {
          tokenStorage.setTokens(
            tokenStorage.getAccessToken(),
            tokenStorage.getRefreshToken(),
            { ...currentLocalUser, ...res.data }
          )
        }
        setIsEditing(false)
      } else {
        toast.error(res.error?.message || 'Failed to update profile')
      }
    } catch {
      toast.error('Network error updating profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-foreground/20 backdrop-blur-xs"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="relative z-10 w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 border-b border-border bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserAvatar fullName={isEditing ? fullName : user.full_name} username={user.username} size="lg" />
              <div>
                <h3 className="font-heading font-semibold text-base text-foreground leading-snug">
                  {(isEditing ? fullName : user.full_name) || user.username}
                </h3>
                <p className="text-xs text-muted-foreground font-medium">@{user.username}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={isEditing ? "ghost" : "outline"}
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                className="h-8 gap-1.5 text-xs"
                disabled={saving}
              >
                <Pencil className="size-3.5 text-primary" />
                {isEditing ? 'Cancel' : 'Edit Profile'}
              </Button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <ScrollArea className="p-6 space-y-6 flex-1">
            {/* Account Details / Edit Form */}
            {isEditing ? (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Edit Profile Information</h4>
                
                <div className="space-y-1.5">
                  <Label htmlFor="upm-fullname">Full Name</Label>
                  <Input
                    id="upm-fullname"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter full name"
                    disabled={saving}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="upm-email">Email Address</Label>
                  <Input
                    id="upm-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    disabled={saving}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="upm-phone">Phone Number</Label>
                    <Input
                      id="upm-phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="9876543210"
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="upm-dept">Department</Label>
                    <Input
                      id="upm-dept"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Sales"
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={saving}>
                    {saving && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                    Save Changes
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account Overview</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1">
                    <span className="text-muted-foreground">Employee Code</span>
                    <p className="font-mono font-medium text-foreground">{user.employee_code || 'N/A'}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1">
                    <span className="text-muted-foreground">Department</span>
                    <p className="font-medium text-foreground">{user.department || 'General'}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1">
                    <span className="text-muted-foreground">Email Address</span>
                    <p className="font-medium text-foreground truncate">{user.email || 'No email associated'}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1">
                    <span className="text-muted-foreground">Phone Number</span>
                    <p className="font-medium text-foreground">{user.phone || 'N/A'}</p>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* Roles & Permissions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assigned Roles</h4>
                <span className="text-[11px] text-muted-foreground font-medium">
                  {user.roles?.length || 1} Active Role{(user.roles?.length || 1) > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(user.roles || ['USER']).map((r, idx) => (
                  <RoleBadge
                    key={r}
                    role={r}
                    isPrimary={idx === 0}
                    isSecondary={idx === 1}
                  />
                ))}
              </div>
            </div>

            <Separator />

            {/* Security */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Security & Credentials</h4>
              <div className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-card">
                <div>
                  <p className="text-xs font-medium text-foreground">Account Password</p>
                  <p className="text-[11px] text-muted-foreground">Update your login password securely</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { onClose(); onOpenPasswordChange(); }}
                  className="gap-1.5 text-xs font-medium"
                >
                  <Key className="size-3.5 text-primary" />
                  Change Password
                </Button>
              </div>
            </div>
          </ScrollArea>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Profile modal & Change password modal state
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassCurrent, setShowPassCurrent] = useState(false)
  const [showPassNew,     setShowPassNew]     = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0)

  const { hasPermission } = usePermissions()

  const fetchAlertsCount = useCallback(async () => {
    try {
      const res = await getAlerts()
      if (res.ok && Array.isArray(res.data)) {
        const count = res.data.filter((a) => !a.is_read).length
        setUnreadAlertsCount(count)
      }
    } catch {
      // Silently catch background errors
    }
  }, [])

  useEffect(() => {
    fetchAlertsCount()
    const interval = setInterval(fetchAlertsCount, 30000)
    return () => clearInterval(interval)
  }, [fetchAlertsCount])

  // Load user on mount
  useEffect(() => {
    const currentUser = tokenStorage.getUser()
    if (!currentUser) {
      toast.error('Session expired. Please sign in again.')
      navigate('/login')
      return
    }
    setUser(currentUser)

    getMyProfile().then((res) => {
      if (res.ok && res.data) {
        const fullProfile = {
          ...currentUser,
          ...res.data,
        }
        setUser(fullProfile)
        localStorage.setItem('onetrack_user', JSON.stringify(fullProfile))
      }
    }).catch(() => {})
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

  const activeSection = location.pathname.includes('/analytics')
    ? 'analytics'
    : location.pathname.includes('/tenders')
    ? 'tenders'
    : location.pathname.includes('/alerts')
    ? 'alerts'
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
              <span className="font-heading text-sm font-semibold text-foreground">OneTrack</span>
            </div>
          </div>

          {/* Right side: user info + actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowProfileModal(true)}
              className="hidden sm:flex items-center gap-2 mr-1 p-1 rounded-lg hover:bg-muted/60 transition-colors text-left group"
              title="Click to view My Profile & Settings"
            >
              <UserAvatar fullName={user.full_name} username={user.username} size="sm" />
              <div className="hidden md:block">
                <p className="text-xs font-semibold text-foreground leading-none group-hover:text-primary transition-colors">{user.full_name || user.username}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 font-medium flex items-center gap-1">
                  <span>{user.roles?.[0] ?? 'USER'}</span>
                  {user.roles?.[1] && (
                    <span className="text-[10px] text-primary/80 font-normal">
                      · {user.roles[1]}
                    </span>
                  )}
                </p>
              </div>
            </button>

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
        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        {/* Desktop sidebar */}
        <aside className="hidden md:flex flex-col w-52 border-r border-border bg-card shrink-0">
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {visibleNavItems.map((item) => {
              const active = activeSection === item.id
              const Icon = item.icon
              const isAlerts = item.id === 'alerts'
              const hasChildren = item.children && item.children.length > 0

              return (
                <div key={item.id} className="space-y-1">
                  <button
                    onClick={() => {
                      if (item.id === 'overview') navigate('/dashboard')
                      else if (hasChildren) navigate(item.children[0].path)
                      else navigate(`/dashboard/${item.id}`)
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors text-left
                      ${active
                        ? 'bg-primary/8 text-primary border border-primary/15 font-semibold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {isAlerts && unreadAlertsCount > 0 && (
                      <span className="flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold shrink-0 ml-1 shadow-xs animate-pulse">
                        {unreadAlertsCount > 99 ? '99+' : unreadAlertsCount}
                      </span>
                    )}
                    {hasChildren && (
                      <ChevronRight className={`size-3.5 shrink-0 transition-transform duration-200 ${active ? 'rotate-90 text-primary' : 'text-muted-foreground'}`} />
                    )}
                  </button>

                  {/* Render nested children with hardware-accelerated CSS grid transition (100% smooth, zero-lag, zero-flicker) */}
                  <div
                    className="grid pl-6 border-l-2 border-primary/20 ml-3.5 transition-all duration-300 ease-in-out"
                    style={{
                      gridTemplateRows: hasChildren && active ? '1fr' : '0fr',
                      opacity: hasChildren && active ? 1 : 0,
                      marginTop: hasChildren && active ? '4px' : '0px'
                    }}
                  >
                    <div className="overflow-hidden space-y-1">
                      {item.children?.map((child) => {
                        const ChildIcon = child.icon
                        const childActive = isChildActive(child, location.pathname)
                        return (
                          <button
                            key={child.id}
                            onClick={() => navigate(child.path)}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors text-left
                              ${childActive
                                ? 'bg-primary/15 text-primary font-semibold'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                              }`}
                          >
                            <ChildIcon className="size-3.5 shrink-0" />
                            <span className="truncate">{child.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
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
                    const isAlerts = item.id === 'alerts'
                    const hasChildren = item.children && item.children.length > 0

                    return (
                      <div key={item.id} className="space-y-1">
                        <button
                          onClick={() => {
                            if (item.id === 'overview') navigate('/dashboard')
                            else if (hasChildren) navigate(item.children[0].path)
                            else navigate(`/dashboard/${item.id}`)
                            if (!hasChildren) setSidebarOpen(false)
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors text-left
                            ${active
                              ? 'bg-primary/8 text-primary border border-primary/15 font-semibold'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                            }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon className="size-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </div>
                          {isAlerts && unreadAlertsCount > 0 && (
                            <span className="flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold shrink-0 ml-1 shadow-xs animate-pulse">
                              {unreadAlertsCount > 99 ? '99+' : unreadAlertsCount}
                            </span>
                          )}
                          {hasChildren && (
                            <ChevronRight className={`size-3.5 shrink-0 transition-transform duration-200 ${active ? 'rotate-90 text-primary' : 'text-muted-foreground'}`} />
                          )}
                        </button>

                        {/* Render nested children with hardware-accelerated CSS grid transition for mobile (100% smooth, zero-lag) */}
                        <div
                          className="grid pl-6 border-l-2 border-primary/20 ml-3.5 transition-all duration-300 ease-in-out"
                          style={{
                            gridTemplateRows: hasChildren && active ? '1fr' : '0fr',
                            opacity: hasChildren && active ? 1 : 0,
                            marginTop: hasChildren && active ? '4px' : '0px'
                          }}
                        >
                          <div className="overflow-hidden space-y-1">
                            {item.children?.map((child) => {
                              const ChildIcon = child.icon
                              const childActive = isChildActive(child, location.pathname)
                              return (
                                <button
                                  key={child.id}
                                  onClick={() => {
                                    navigate(child.path)
                                    setSidebarOpen(false)
                                  }}
                                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors text-left
                                    ${childActive
                                      ? 'bg-primary/15 text-primary font-semibold'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                                    }`}
                                >
                                  <ChildIcon className="size-3.5 shrink-0" />
                                  <span className="truncate">{child.label}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
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
            <Outlet context={{ user, onOpenProfile: () => setShowProfileModal(true), unreadAlertsCount, refreshAlertsCount: fetchAlertsCount }} />
          </main>
        </div>
      </div>

      {/* ── User Profile Modal ───────────────────────────────────────────── */}
      <UserProfileModal
        user={user}
        open={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onOpenPasswordChange={() => setShowPasswordModal(true)}
        onUpdateUser={(updated) => setUser(updated)}
      />

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
