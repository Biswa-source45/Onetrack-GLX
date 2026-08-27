import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart2, TrendingUp, Users, Search,
  Filter, RefreshCw, Award, XCircle, Clock, FileText,
  ShieldCheck, ArrowUpRight, ArrowDownRight, Eye, Sparkles, Activity,
  IndianRupee, AlertCircle, Building2, Calendar, PieChart as PieIcon,
  TrendingDown, Info, HelpCircle, Layers, UserCheck, Plus
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
  Legend, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, Sector,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Line, ComposedChart,
  LineChart, ReferenceDot
} from 'recharts'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent
} from '@/components/ui/card'
import { listBids, getTenderPerformanceMatrix } from '../../services/bids'
import { tokenStorage } from '../../services/auth'
import { usePermissions } from '../../hooks/usePermissions'

// Currency Formatter Helper
function formatCurrency(val) {
  if (val === null || val === undefined || isNaN(val)) return '₹0'
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`
  return `₹${val.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

// Matches the real 10-stage pipeline (WORKFLOW_STAGES_ORDERED in services/bids.js)
// exactly — this used to only have 'PREPARATION'/'APPROVAL' placeholder keys
// that never matched any real bid.workflow_stage value, so several stages
// (OEM Authorization, Pricing Request, Document Checklist, EMD Processing,
// Internal Approval) silently fell back to gray/de-slugified rendering
// instead of their real color/label, and the milestone plot diagram below
// skipped them and showed two permanently-zero data points instead.
const STAGE_COLORS = {
  DISCOVERED: '#3b82f6',                     // Blue
  OEM_AUTHORIZATION_REQUEST: '#6366f1',       // Indigo
  PRICING_REQUEST: '#8b5cf6',                 // Violet
  DOCUMENT_CHECKLIST_PREPARATION: '#a855f7',  // Purple
  EMD_PROCESSING: '#f59e0b',                  // Amber
  INTERNAL_APPROVAL: '#eab308',               // Yellow
  GEM_SUBMISSION: '#84cc16',                  // Lime
  TECHNICAL_EVALUATION: '#14b8a6',            // Teal
  FINANCIAL_EVALUATION: '#ec4899',            // Pink
  AWARD_HANDOVER: '#06b6d4',                  // Cyan
  WON: '#10b981',                             // Emerald Green
  LOST: '#ef4444',                            // Rose Red
  CANCELLED: '#6b7280'                        // Slate Gray
}

const STAGE_LABELS = {
  DISCOVERED: 'Discovered',
  OEM_AUTHORIZATION_REQUEST: 'OEM Authorization',
  PRICING_REQUEST: 'Pricing Request',
  DOCUMENT_CHECKLIST_PREPARATION: 'Document Checklist',
  EMD_PROCESSING: 'EMD Processing',
  INTERNAL_APPROVAL: 'Internal Approval',
  GEM_SUBMISSION: 'GeM Portal Submission',
  TECHNICAL_EVALUATION: 'Technical Evaluation',
  FINANCIAL_EVALUATION: 'Financial Evaluation',
  AWARD_HANDOVER: 'Award & Handover',
  WON: 'Won / Awarded Contracts',
  LOST: 'Lost Bids',
  CANCELLED: 'Cancelled Tenders'
}

const ROLE_BADGES = {
  SUPER_ADMIN: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  ADMIN: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  MANAGER: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  BID_EXECUTIVE: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  USER: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
}

// Resolves a bid's "effective" stage bucket for charting — mirrors the
// precedence the backend itself uses (postgres.go's derived_status CASE and
// the performance-matrix won/lost/cancelled FILTERs): bid_status/bid_outcome
// win over the raw workflow_stage. This matters because RecordOutcome no
// longer mutates workflow_stage (fixed in an earlier round to stop it
// corrupting the stage pointer) — so a WON bid's workflow_stage is normally
// still 'AWARD_HANDOVER' (or earlier), not the literal string 'WON'. Bucketing
// straight off workflow_stage (as this used to) silently dropped won/lost
// bids into their pipeline-stage bucket instead of "Won"/"Lost", which is
// what made the stage charts and the milestone plot look inaccurate.
function getEffectiveStage(b) {
  if (b.bid_status === 'WON' || b.workflow_stage === 'WON' || b.bid_outcome === 'WON') return 'WON'
  if (b.bid_status === 'LOST' || b.workflow_stage === 'LOST' || b.bid_outcome === 'LOST' || b.technical_result === 'DISQUALIFIED') return 'LOST'
  if (b.bid_status === 'CANCELLED' || b.workflow_stage === 'CANCELLED' || b.bid_outcome === 'CANCELLED') return 'CANCELLED'
  return b.workflow_stage || 'DISCOVERED'
}

// Custom 3D Pop-Out Active Shape Renderer for Pie Chart
const render3DPieActiveShape = (props) => {
  const {
    cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle,
    fill, payload, percent, value
  } = props

  const RADIAN = Math.PI / 180
  const sin = Math.sin(-RADIAN * midAngle)
  const cos = Math.cos(-RADIAN * midAngle)

  const sx = cx + (outerRadius + 6) * cos
  const sy = cy + (outerRadius + 6) * sin
  const mx = cx + (outerRadius + 18) * cos
  const my = cy + (outerRadius + 18) * sin
  const ex = mx + (cos >= 0 ? 1 : -1) * 16
  const ey = my
  const textAnchor = cos >= 0 ? 'start' : 'end'

  return (
    <g>
      {/* Center Label */}
      <text x={cx} y={cy - 6} textAnchor="middle" fill="#f8fafc" className="font-semibold text-xs font-heading">
        {payload.name}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#94a3b8" className="text-[10px] font-mono">
        {`₹${value.toLocaleString()} Lakhs`}
      </text>

      {/* Main Slice Pop-out */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />

      {/* Outer 3D Glow Ring */}
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 11}
        outerRadius={outerRadius + 15}
        fill={fill}
        opacity={0.7}
      />

      {/* Callout Indicator Lines */}
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" strokeWidth={2} />
      <circle cx={ex} cy={ey} r={3} fill={fill} stroke="#fff" strokeWidth={1} />

      {/* Value Tag Callout */}
      <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey} textAnchor={textAnchor} fill="#f1f5f9" fontSize={11} fontWeight={600}>
        {`₹${value} Lakhs`}
      </text>
      <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey} dy={14} textAnchor={textAnchor} fill="#94a3b8" fontSize={10}>
        {`(${(percent * 100).toFixed(1)}% Share)`}
      </text>
    </g>
  )
}

export function AnalyticsPage({ defaultTab = 'tender-analytics' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdmin, hasRole } = usePermissions()
  // Org-wide analytics (all tenders / all owners) is management-only — Bid
  // Executive, Pre-Sales, and Finance only ever see their own scope, on both
  // the Tender Analytics view and the Owner Performance Matrix.
  const isManagementRole = isAdmin || hasRole('MANAGER')

  // Sync active view strictly with URL route (sidebar driven)
  const activeTab = useMemo(() => {
    if (location.pathname.includes('/performance-matrix')) return 'owner-matrix'
    if (location.pathname.includes('/tenders')) return 'tender-analytics'
    return defaultTab
  }, [location.pathname, defaultTab])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  // Global Data
  const [bids, setBids] = useState([])
  const [matrixStats, setMatrixStats] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(null)

  // Hover state for 3D Pop-out Pie Chart
  const [activePieIndex, setActivePieIndex] = useState(0)

  // Sub-tab Scope for Tender Analytics: 'all' (Total Tender Analytics) vs 'owned' (Owned Tender Analytics)
  // Non-management roles are locked to 'owned' — they never get the 'all' view.
  const [tenderAnalyticsScope, setTenderAnalyticsScope] = useState(isManagementRole ? 'all' : 'owned')
  const currentUser = useMemo(() => tokenStorage.getUser(), [])

  // Ownership Matcher Helper
  const isBidOwnedByUser = useCallback((bid, user) => {
    if (!user || !bid) return false
    const ownerId = bid.bid_owner_id || bid.bid_owner?.id
    const creatorId = bid.created_by
    const userEmail = user.email?.toLowerCase()
    const ownerEmail = bid.bid_owner?.email?.toLowerCase()
    const username = user.username?.toLowerCase()
    const ownerUsername = bid.bid_owner?.username?.toLowerCase()

    return (
      (ownerId && String(ownerId) === String(user.id)) ||
      (creatorId && String(creatorId) === String(user.id)) ||
      (ownerEmail && userEmail && ownerEmail === userEmail) ||
      (ownerUsername && username && ownerUsername === username)
    )
  }, [])

  // Individual User Owned Tenders State
  const [userOwnedBids, setUserOwnedBids] = useState([])
  const [loadingUserBids, setLoadingUserBids] = useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [stageFilter, setStageFilter] = useState('ALL')

  // Fetch Core Data
  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)

    try {
      // Non-management roles get their bid list scoped server-side to their
      // own tenders (bid_owner_id) — not just filtered client-side after an
      // org-wide fetch — and the performance matrix is scoped server-side too
      // (the backend returns only their own row for these roles regardless).
      const bidsParams = isManagementRole
        ? { page: 1, limit: 1000 }
        : { page: 1, limit: 1000, bid_owner_id: currentUser?.id }
      const [bidsRes, matrixRes] = await Promise.all([
        listBids(bidsParams),
        getTenderPerformanceMatrix()
      ])

      const bidsList = bidsRes?.data && Array.isArray(bidsRes.data)
        ? bidsRes.data
        : (bidsRes?.bids && Array.isArray(bidsRes.bids) ? bidsRes.bids : [])

      const matrixList = matrixRes?.data && Array.isArray(matrixRes.data)
        ? matrixRes.data
        : (matrixRes?.stats && Array.isArray(matrixRes.stats) ? matrixRes.stats : [])

      setBids(bidsList)
      setMatrixStats(matrixList)

      setSelectedUserId(prev => {
        if (prev && matrixList.some(u => u.user_id === prev)) return prev
        return matrixList.length > 0 ? matrixList[0].user_id : null
      })

      setLastUpdated(new Date())
    } catch (err) {
      console.error('Analytics fetch error:', err)
      toast.error('Failed to load analytics metrics')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [isManagementRole, currentUser?.id])

  useEffect(() => {
    fetchData(false)
    const interval = setInterval(() => fetchData(true), 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Fetch selected user owned tenders for Owner Performance Matrix
  useEffect(() => {
    if (!selectedUserId) {
      setUserOwnedBids([])
      return
    }

    let isMounted = true
    setLoadingUserBids(true)

    listBids({ bid_owner_id: selectedUserId, limit: 200 })
      .then(res => {
        if (!isMounted) return
        const fetchedBids = res?.data && Array.isArray(res.data)
          ? res.data
          : (res?.bids && Array.isArray(res.bids) ? res.bids : [])

        const clientMatches = bids.filter(b => b.bid_owner_id === selectedUserId || b.created_by === selectedUserId)
        const combined = [...fetchedBids]
        clientMatches.forEach(b => {
          if (!combined.some(x => x.id === b.id)) {
            combined.push(b)
          }
        })

        setUserOwnedBids(combined)
      })
      .catch(err => {
        console.error('Failed to fetch user specific tenders:', err)
        const clientMatches = bids.filter(b => b.bid_owner_id === selectedUserId || b.created_by === selectedUserId)
        if (isMounted) setUserOwnedBids(clientMatches)
      })
      .finally(() => {
        if (isMounted) setLoadingUserBids(false)
      })

    return () => { isMounted = false }
  }, [selectedUserId, bids])

  // Selected user object from matrix stats
  const selectedUser = useMemo(() => {
    if (!selectedUserId) return matrixStats[0] || null
    return matrixStats.find(u => u.user_id === selectedUserId) || matrixStats[0] || null
  }, [matrixStats, selectedUserId])

  // Count of tenders owned by logged-in user
  const ownedCount = useMemo(() => {
    if (!currentUser) return 0
    return bids.filter(b => isBidOwnedByUser(b, currentUser)).length
  }, [bids, currentUser, isBidOwnedByUser])

  // Active Scoped Tenders (Total vs Owned)
  const scopedBids = useMemo(() => {
    if (tenderAnalyticsScope === 'owned' && currentUser) {
      return bids.filter(b => isBidOwnedByUser(b, currentUser))
    }
    return bids
  }, [bids, tenderAnalyticsScope, currentUser, isBidOwnedByUser])

  // Filtered Bids
  const filteredBids = useMemo(() => {
    return scopedBids.filter(b => {
      const matchSearch = !searchQuery ||
        b.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.bid_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.organization_name?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchCategory = categoryFilter === 'ALL' || b.category === categoryFilter
      const matchStage = stageFilter === 'ALL' || b.workflow_stage === stageFilter
      return matchSearch && matchCategory && matchStage
    })
  }, [scopedBids, searchQuery, categoryFilter, stageFilter])

  // Comprehensive Analytics & Visualizations Calculations
  const analyticsSummary = useMemo(() => {
    let totalVal = 0
    let wonVal = 0
    let lostVal = 0
    const stageCounts = {}
    const stageValues = {}
    const monthDataMap = {}
    const orgValueMap = {}

    filteredBids.forEach((b) => {
      // Prefer the actual final/submitted price over the original ballpark
      // estimate when it's known — estimated_value can be set at discovery
      // and never updated, while final_bid_value/quoted_price reflect what
      // was actually submitted or awarded, so leading with the estimate
      // (as this previously did) skewed every valuation total.
      const val = Number(b.final_bid_value || b.quoted_price || b.estimated_value || 0)
      totalVal += val
      if (b.workflow_stage === 'WON' || b.bid_status === 'WON' || b.bid_outcome === 'WON') wonVal += val
      if (b.workflow_stage === 'LOST' || b.bid_status === 'LOST' || b.bid_outcome === 'LOST') lostVal += val

      const stage = getEffectiveStage(b)
      stageCounts[stage] = (stageCounts[stage] || 0) + 1
      stageValues[stage] = (stageValues[stage] || 0) + val

      // Monthly aggregation for timeline graph
      if (b.created_at) {
        const d = new Date(b.created_at)
        const monthKey = d.toLocaleString('en-US', { month: 'short', year: '2-digit' })
        if (!monthDataMap[monthKey]) {
          monthDataMap[monthKey] = { month: monthKey, count: 0, totalVal: 0, timestamp: d.getTime() }
        }
        monthDataMap[monthKey].count += 1
        monthDataMap[monthKey].totalVal += val / 100000 // In Lakhs
      }

      // Top Organizations
      const org = b.organization_name || 'Unspecified Org'
      orgValueMap[org] = (orgValueMap[org] || 0) + val
    })

    // Stage Valuation Pie Data (with percentage & labels)
    const stagePieData = Object.keys(stageValues).map(stg => {
      const valLakhs = Math.round(((stageValues[stg] || 0) / 100000) * 100) / 100
      const totalValLakhs = Math.round((totalVal / 100000) * 100) / 100
      const percentShare = totalValLakhs > 0 ? ((valLakhs / totalValLakhs) * 100).toFixed(1) : '0'

      return {
        name: STAGE_LABELS[stg] || stg.replace(/_/g, ' '),
        rawStageKey: stg,
        count: stageCounts[stg] || 0,
        value: valLakhs, // In Lakhs
        valueInCr: Math.round((stageValues[stg] / 10000000) * 100) / 100,
        percentShare,
        fill: STAGE_COLORS[stg] || '#64748b'
      }
    }).filter(item => item.value > 0)

    const stageCountData = Object.keys(stageCounts).map(stg => ({
      name: STAGE_LABELS[stg] || stg.replace(/_/g, ' '),
      count: stageCounts[stg],
      valueInLakhs: Math.round(((stageValues[stg] || 0) / 100000) * 100) / 100,
      fill: STAGE_COLORS[stg] || '#64748b'
    }))

    // ── Milestone Plot Diagram Data (Sequential Lifecycle Arc as in story plot diagram) ──
    // Matches the real 10-stage pipeline exactly, plus a terminal "Won" point —
    // this used to hardcode 'PREPARATION'/'APPROVAL' keys that never matched any
    // real workflow_stage value (always plotting as zero) and skipped 6 of the
    // 10 real stages (OEM Auth, Pricing, Document Checklist, EMD, Internal
    // Approval, Award & Handover) entirely.
    const orderedStages = [
      { key: 'DISCOVERED', label: '1. Discovered', milestone: 'Discovery Peak' },
      { key: 'OEM_AUTHORIZATION_REQUEST', label: '2. OEM Auth', milestone: 'OEM Authorization' },
      { key: 'PRICING_REQUEST', label: '3. Pricing', milestone: 'Pricing Calculated' },
      { key: 'DOCUMENT_CHECKLIST_PREPARATION', label: '4. Checklist', milestone: 'Documents Compiled' },
      { key: 'EMD_PROCESSING', label: '5. EMD', milestone: 'EMD Processed' },
      { key: 'INTERNAL_APPROVAL', label: '6. Approval', milestone: 'Internal Sign-off' },
      { key: 'GEM_SUBMISSION', label: '7. GeM Submission', milestone: 'GeM Portal Deadline' },
      { key: 'TECHNICAL_EVALUATION', label: '8. Tech Eval', milestone: 'Tech Clearance' },
      { key: 'FINANCIAL_EVALUATION', label: '9. Fin Eval', milestone: 'Price Opening' },
      { key: 'AWARD_HANDOVER', label: '10. Award & Handover', milestone: 'PO & BG Handover' },
      { key: 'WON', label: '11. Contract Won', milestone: 'Final Award Handover' }
    ]

    const milestonePlotData = orderedStages.map((stg) => {
      const valLakhs = Math.round(((stageValues[stg.key] || 0) / 100000) * 100) / 100
      const count = stageCounts[stg.key] || 0
      return {
        stageLabel: stg.label,
        milestone: stg.milestone,
        stageKey: stg.key,
        count: count,
        valueLakhs: valLakhs,
        // Synthetic intensity arc curve for high visual fidelity matching the story plot diagram
        intensityArc: valLakhs > 0 ? valLakhs : Math.max(10, count * 15)
      }
    })

    // Monthly Trend Data
    const monthlyTrendData = Object.values(monthDataMap)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(item => ({
        month: item.month,
        Tenders: item.count,
        ValueLakhs: Math.round(item.totalVal * 100) / 100
      }))

    // Top 5 Client Organizations
    const topOrgsData = Object.entries(orgValueMap)
      .map(([org, value]) => ({
        name: org.length > 18 ? org.substring(0, 16) + '...' : org,
        fullName: org,
        valueInCr: Math.round((value / 10000000) * 100) / 100,
        valueInLakhs: Math.round((value / 100000) * 100) / 100
      }))
      .sort((a, b) => b.valueInCr - a.valueInCr)
      .slice(0, 6)

    const totalCount = filteredBids.length
    const wonCount = filteredBids.filter(b => b.workflow_stage === 'WON' || b.bid_status === 'WON' || b.bid_outcome === 'WON').length
    const winRate = totalCount > 0 ? ((wonCount / totalCount) * 100).toFixed(1) : '0'

    return {
      totalVal,
      wonVal,
      lostVal,
      totalCount,
      wonCount,
      winRate,
      stageCountData,
      stagePieData,
      milestonePlotData,
      monthlyTrendData,
      topOrgsData
    }
  }, [filteredBids])

  // Single User Analytics Derived Details
  const userDetailedStats = useMemo(() => {
    if (!selectedUser) return null
    const bidValue = (b) => Number(b.final_bid_value || b.quoted_price || b.estimated_value || 0)
    const userTotalVal = userOwnedBids.reduce((acc, b) => acc + bidValue(b), 0)
    const userWonVal = userOwnedBids
      .filter(b => b.workflow_stage === 'WON' || b.bid_status === 'WON' || b.bid_outcome === 'WON')
      .reduce((acc, b) => acc + bidValue(b), 0)

    const radarData = [
      { subject: 'Total', A: selectedUser.total || 0 },
      { subject: 'Active', A: selectedUser.active || 0 },
      { subject: 'Submitted', A: selectedUser.submitted || 0 },
      { subject: 'Tech Eval', A: selectedUser.tech_eval || 0 },
      { subject: 'Fin Eval', A: selectedUser.fin_eval || 0 },
      { subject: 'Won', A: selectedUser.won || 0 },
    ]

    return {
      userTotalVal,
      userWonVal,
      radarData
    }
  }, [selectedUser, userOwnedBids])

  const categories = useMemo(() => {
    const set = new Set(bids.map(b => b.category).filter(Boolean))
    return ['ALL', ...Array.from(set)]
  }, [bids])

  if (loading && !bids.length && !matrixStats.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <RefreshCw className="size-8 text-primary animate-spin" />
        <p className="text-sm font-medium text-muted-foreground">Loading Analytics & Metrics...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary">
              <BarChart2 className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground font-heading">
                {activeTab === 'owner-matrix' ? 'Tender Owner Performance Matrix' : 'Total Tender Analytics'}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeTab === 'owner-matrix'
                  ? 'Real-time tender owner breakdown, stage matrix, & individual user portfolio inspection'
                  : 'Real-time tender lifecycle analytics, 3D financial pie distribution, & tender plot diagram'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
              <Clock className="size-3" />
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="gap-1.5 text-xs h-8"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Content View 1: Tender Analytics (Nested: Total vs Owned) ─── */}
      {activeTab === 'tender-analytics' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          {/* Sub-Tab Navigation Bar: Total Tender Analytics vs Owned Tender Analytics —
              the 'all' (org-wide) option only exists for management roles; everyone
              else is locked to their own scope with no way to switch out of it. */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border p-2.5 rounded-xl shadow-xs">
            {isManagementRole ? (
              <div className="flex items-center bg-muted/60 border border-border p-1 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setTenderAnalyticsScope('all')}
                  className={`px-3.5 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    tenderAnalyticsScope === 'all'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Layers className="size-3.5" />
                  Total Tender Analytics
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-bold ml-1">
                    {bids.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTenderAnalyticsScope('owned')}
                  className={`px-3.5 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    tenderAnalyticsScope === 'owned'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <UserCheck className="size-3.5" />
                  Owned Tender Analytics
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1 ${
                    tenderAnalyticsScope === 'owned'
                      ? 'bg-primary-foreground/20 text-white'
                      : 'bg-primary/10 text-primary'
                  }`}>
                    {ownedCount}
                  </span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary px-1">
                <UserCheck className="size-3.5" />
                Your Tender Analytics
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-bold ml-1">
                  {ownedCount}
                </span>
              </div>
            )}

            <div className="text-xs text-muted-foreground flex items-center gap-2">
              {tenderAnalyticsScope === 'owned' ? (
                <span className="flex items-center gap-1 text-primary font-medium">
                  <UserCheck className="size-3.5" />
                  Showing personal metrics for <strong>{currentUser?.full_name || currentUser?.username || 'Your Account'}</strong> ({ownedCount} tenders owned)
                </span>
              ) : (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Layers className="size-3.5" />
                  Showing organizational metrics across all company tenders ({bids.length} total)
                </span>
              )}
            </div>
          </div>

          {/* If in Owned mode and no tenders are owned, show an informative card */}
          {tenderAnalyticsScope === 'owned' && ownedCount === 0 ? (
            <Card className="p-12 text-center flex flex-col items-center justify-center gap-3">
              <div className="p-3.5 rounded-full bg-primary/10 text-primary">
                <UserCheck className="size-8" />
              </div>
              <div className="max-w-md">
                <h3 className="font-bold text-base text-foreground">No Owned Tenders Found</h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  You are not currently designated as the Bid Owner on any tender records.
                  {isManagementRole ? ' You can view organization-wide statistics or create a new tender workspace to start building your portfolio.' : ' Create a new tender workspace to start building your portfolio.'}
                </p>
              </div>
              <div className="flex items-center gap-2.5 mt-2">
                {isManagementRole && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTenderAnalyticsScope('all')}
                    className="gap-1.5 text-xs"
                  >
                    <Layers className="size-3.5" />
                    View Total Tender Analytics
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => navigate('/dashboard/tenders')}
                  className="gap-1.5 text-xs"
                >
                  <Plus className="size-3.5" />
                  Go to Tenders
                </Button>
              </div>
            </Card>
          ) : (
            <>
              {/* Filter Bar */}
              <Card size="sm" className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <Search className="size-4 text-muted-foreground shrink-0" />
                <Input
                  placeholder="Filter tenders by title, bid no, client..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-8 text-xs bg-background"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Filter className="size-3.5" />
                  <span>Category:</span>
                </div>
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
                  <span>Stage:</span>
                </div>
                <select
                  value={stageFilter}
                  onChange={e => setStageFilter(e.target.value)}
                  className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="ALL">All Stages</option>
                  <option value="DISCOVERED">Discovered</option>
                  <option value="PREPARATION">Preparation</option>
                  <option value="GEM_SUBMISSION">GeM Submission</option>
                  <option value="TECHNICAL_EVALUATION">Technical Eval</option>
                  <option value="FINANCIAL_EVALUATION">Financial Eval</option>
                  <option value="WON">Won</option>
                  <option value="LOST">Lost</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card size="sm" className="p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Total Tenders</span>
                <FileText className="size-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-foreground font-heading">
                {analyticsSummary.totalCount}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Valuation: <span className="font-semibold text-foreground">{formatCurrency(analyticsSummary.totalVal)}</span>
              </p>
            </Card>

            <Card size="sm" className="p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Win Rate</span>
                <Award className="size-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-emerald-600 font-heading">
                {analyticsSummary.winRate}%
              </div>
              <p className="text-[11px] text-muted-foreground">
                {analyticsSummary.wonCount} won out of {analyticsSummary.totalCount} total
              </p>
            </Card>

            <Card size="sm" className="p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Won Value</span>
                <IndianRupee className="size-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-foreground font-heading">
                {formatCurrency(analyticsSummary.wonVal)}
              </div>
              <p className="text-[11px] text-emerald-500 flex items-center gap-1">
                <ArrowUpRight className="size-3" /> Successfully Secured
              </p>
            </Card>

            <Card size="sm" className="p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Lost Value</span>
                <XCircle className="size-4 text-rose-500" />
              </div>
              <div className="text-2xl font-bold text-foreground font-heading">
                {formatCurrency(analyticsSummary.lostVal)}
              </div>
              <p className="text-[11px] text-rose-500 flex items-center gap-1">
                <ArrowDownRight className="size-3" /> Unsuccessful Bids
              </p>
            </Card>
          </div>

          {/* Visualizations Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Chart 1: Stage Volume Distribution */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart2 className="size-4 text-primary" />
                    Stage-wise Tender Volume
                  </CardTitle>
                  <CardDescription className="text-xs">Count of active tenders across workflow stages</CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px]">Tender Count</Badge>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-[300px] w-full min-h-[300px]">
                  {analyticsSummary.stageCountData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-xs text-muted-foreground">
                      <AlertCircle className="size-6 mb-1 text-muted-foreground/60" />
                      No data available for current filters
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsSummary.stageCountData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {analyticsSummary.stageCountData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Chart 2: Stage Financial Exposure — 3D Pie + Elaborate Stage Legend Breakdown */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <PieIcon className="size-4 text-emerald-500" />
                    Stage Financial Exposure Distribution (₹ Lakhs)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Hover over pie slices or check the right legend breakdown for stage details
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-500">Interactive 3D Pie</Badge>
              </CardHeader>

              <CardContent className="pt-2">
                {analyticsSummary.stagePieData.length === 0 ? (
                  <div className="h-[300px] flex flex-col items-center justify-center text-xs text-muted-foreground">
                    <AlertCircle className="size-6 mb-1 text-muted-foreground/60" />
                    No stage valuation data available
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    {/* Left: 3D Pie Chart */}
                    <div className="h-[280px] w-full min-h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <RechartsTooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                            formatter={(val, name) => [`₹${val} Lakhs`, name]}
                          />
                          <Pie
                            activeIndex={activePieIndex}
                            activeShape={render3DPieActiveShape}
                            data={analyticsSummary.stagePieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                            onMouseEnter={(_, index) => setActivePieIndex(index)}
                          >
                            {analyticsSummary.stagePieData.map((entry, index) => (
                              <Cell
                                key={`cell-pie-${index}`}
                                fill={entry.fill}
                                stroke="#0f172a"
                                strokeWidth={2}
                              />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Right: Elaborate Color & Stage Legend Breakdown Card */}
                    <div className="space-y-2 bg-muted/20 p-3.5 rounded-xl border border-border">
                      <div className="flex items-center justify-between text-xs font-bold text-foreground border-b border-border pb-2">
                        <span>Workflow Stage</span>
                        <span>Valuation (Share)</span>
                      </div>

                      <div className="space-y-2 max-h-[210px] overflow-y-auto pr-1">
                        {analyticsSummary.stagePieData.map((item, idx) => (
                          <div
                            key={item.rawStageKey}
                            onMouseEnter={() => setActivePieIndex(idx)}
                            className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${
                              activePieIndex === idx
                                ? 'bg-primary/10 border-primary/30 shadow-xs'
                                : 'border-border/60 bg-background hover:bg-muted/40'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="size-3 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: item.fill }} />
                              <div>
                                <p className="font-semibold text-foreground leading-tight text-[11px]">{item.name}</p>
                                <p className="text-[10px] text-muted-foreground">{item.count} Tenders</p>
                              </div>
                            </div>

                            <div className="text-right">
                              <p className="font-bold text-foreground text-[11px]">
                                {item.valueInCr > 0 ? `₹${item.valueInCr} Cr` : `₹${item.value} L`}
                              </p>
                              <Badge variant="outline" className="text-[9px] px-1 py-0 border-border text-muted-foreground">
                                {item.percentShare}% Share
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Chart 3: Tender Lifecycle Milestone Arc Plot Diagram (Story Plot Diagram Style) */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="size-4 text-rose-500" />
                    Tender Lifecycle Milestone Arc & Pipeline Intensity Plot Diagram
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Curved milestone plot tracking tender valuation intensity across sequential workflow stages
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px] border-rose-500/30 text-rose-500">Milestone Plot Diagram</Badge>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-[320px] w-full min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analyticsSummary.milestonePlotData} margin={{ top: 25, right: 30, left: 10, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="stageLabel" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" />
                      <YAxis tick={{ fontSize: 10 }} label={{ value: 'Pipeline Intensity (₹ Lakhs)', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                        formatter={(val, name, props) => [
                          `₹${props.payload.valueLakhs} Lakhs (${props.payload.count} Tenders)`,
                          `Milestone: ${props.payload.milestone}`
                        ]}
                      />

                      {/* Smooth Arc Plot Line */}
                      <Line
                        type="monotone"
                        dataKey="intensityArc"
                        name="Valuation Intensity"
                        stroke="#f43f5e"
                        strokeWidth={3}
                        dot={{ r: 6, fill: '#f43f5e', stroke: '#ffffff', strokeWidth: 2 }}
                        activeDot={{ r: 9, fill: '#f43f5e', stroke: '#ffffff', strokeWidth: 3 }}
                      />

                      {/* Milestone Peak Annotations */}
                      {analyticsSummary.milestonePlotData.map((d, index) => {
                        if (d.valueLakhs > 0 || index === 0 || index === analyticsSummary.milestonePlotData.length - 1) {
                          return (
                            <ReferenceDot
                              key={`dot-${index}`}
                              x={d.stageLabel}
                              y={d.intensityArc}
                              r={8}
                              fill="#10b981"
                              stroke="#ffffff"
                              strokeWidth={2}
                            />
                          )
                        }
                        return null
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Milestone Arc Key Callouts */}
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-border">
                  <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs">
                    <p className="font-bold text-blue-500 text-[10px] uppercase">1. Discovered Milestone</p>
                    <p className="text-[11px] text-foreground font-semibold">Discovery Peak</p>
                  </div>
                  <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-xs">
                    <p className="font-bold text-cyan-500 text-[10px] uppercase">7. GeM Portal</p>
                    <p className="text-[11px] text-foreground font-semibold">Submission Checkpoint</p>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
                    <p className="font-bold text-amber-500 text-[10px] uppercase">8 & 9. Technical / Fin Eval</p>
                    <p className="text-[11px] text-foreground font-semibold">Price Opening Peak</p>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                    <p className="font-bold text-emerald-500 text-[10px] uppercase">11. Contract Won</p>
                    <p className="text-[11px] text-foreground font-semibold">Final Award Milestone</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Chart 4: Monthly Creation & Pipeline Trend */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="size-4 text-blue-500" />
                    Monthly Creation Volume & Valuation Trend
                  </CardTitle>
                  <CardDescription className="text-xs">Historical volume of tenders created vs monthly valuation (₹ Lakhs)</CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px]">Monthly Activity</Badge>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-[280px] w-full min-h-[250px]">
                  {analyticsSummary.monthlyTrendData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-xs text-muted-foreground">
                      <AlertCircle className="size-6 mb-1 text-muted-foreground/60" />
                      No monthly trend data recorded
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={analyticsSummary.monthlyTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} label={{ value: 'Tenders', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="L" />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                        />
                        <Bar yAxisId="left" dataKey="Tenders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="ValueLakhs" name="Valuation (₹ Lakhs)" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Chart 5: Top Client Organizations */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Building2 className="size-4 text-purple-500" />
                    Top Client Organizations by Portfolio Value
                  </CardTitle>
                  <CardDescription className="text-xs">Highest value procurement entities in pipeline</CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px]">Client Portfolio</Badge>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-[280px] w-full min-h-[250px]">
                  {analyticsSummary.topOrgsData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-xs text-muted-foreground">
                      <AlertCircle className="size-6 mb-1 text-muted-foreground/60" />
                      No client organization data available
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={analyticsSummary.topOrgsData} margin={{ top: 10, right: 30, left: 40, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis type="number" tick={{ fontSize: 10 }} unit=" Cr" />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                          formatter={(val) => [`₹${val} Cr`, 'Valuation']}
                        />
                        <Bar dataKey="valueInCr" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </motion.div>
  )}

      {/* ── Content View 2: Tender Owner Performance Matrix ─────────────── */}
      {activeTab === 'owner-matrix' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          {/* Main Matrix Table */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />
                  Tender Ownership & Stage Matrix
                </CardTitle>
                <CardDescription className="text-xs">
                  {isManagementRole
                    ? 'Real-time breakdown of tender counts per stage for all registered user accounts'
                    : 'Real-time breakdown of your own tender counts per stage'}
                </CardDescription>
              </div>

              <Badge variant="outline" className="w-fit text-xs font-mono">
                {isManagementRole ? `${matrixStats.length} Owners Tracked` : 'Your Performance Only'}
              </Badge>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
                    <tr>
                      <th className="p-3">Tender Owner</th>
                      <th className="p-3 text-center">Role</th>
                      <th className="p-3 text-right">Total</th>
                      <th className="p-3 text-right">Active</th>
                      <th className="p-3 text-right">Submitted</th>
                      <th className="p-3 text-right">Tech Eval</th>
                      <th className="p-3 text-right">Fin Eval</th>
                      <th className="p-3 text-right">Won</th>
                      <th className="p-3 text-right">Lost</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {matrixStats.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="p-6 text-center text-muted-foreground">
                          No tender owners found.
                        </td>
                      </tr>
                    ) : (
                      matrixStats.map(stat => {
                        const isSelected = selectedUserId === stat.user_id
                        const roleBadgeClass = ROLE_BADGES[stat.role] || ROLE_BADGES['USER']

                        return (
                          <tr
                            key={stat.user_id}
                            onClick={() => setSelectedUserId(stat.user_id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-primary/10 font-medium' : 'hover:bg-muted/40'
                            }`}
                          >
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="size-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                                  {(stat.full_name || stat.username || 'U')[0].toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-foreground leading-none">
                                    {stat.full_name || stat.username}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    @{stat.username}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleBadgeClass}`}>
                                {stat.role}
                              </span>
                            </td>
                            <td className="p-3 text-right font-bold text-foreground">{stat.total}</td>
                            <td className="p-3 text-right text-blue-500 font-semibold">{stat.active}</td>
                            <td className="p-3 text-right text-cyan-500 font-semibold">{stat.submitted}</td>
                            <td className="p-3 text-right text-amber-500 font-semibold">{stat.tech_eval}</td>
                            <td className="p-3 text-right text-pink-500 font-semibold">{stat.fin_eval}</td>
                            <td className="p-3 text-right text-emerald-500 font-bold">{stat.won}</td>
                            <td className="p-3 text-right text-rose-500 font-semibold">{stat.lost}</td>
                            <td className="p-3 text-center">
                              <Button
                                size="xs"
                                variant={isSelected ? 'default' : 'outline'}
                                onClick={e => { e.stopPropagation(); setSelectedUserId(stat.user_id); }}
                                className="h-6 text-[10px] gap-1 px-2"
                              >
                                <Eye className="size-3" />
                                Inspect
                              </Button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* User Specific Drill-down Analytics */}
          <AnimatePresence mode="wait">
            {selectedUser && userDetailedStats && (
              <motion.div
                key={selectedUser.user_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="border-primary/20 shadow-sm space-y-6 p-6">
                  {/* User Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                    <div className="flex items-center gap-3">
                      <div className="size-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold shadow-sm">
                        {(selectedUser.full_name || selectedUser.username)[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold text-foreground font-heading">
                            {selectedUser.full_name || selectedUser.username}
                          </h2>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ROLE_BADGES[selectedUser.role] || ROLE_BADGES['USER']}`}>
                            {selectedUser.role}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Individual Performance Profile & Owned Tender Deep-Dive
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[10px] uppercase text-muted-foreground tracking-wider font-semibold">User Portfolio Value</p>
                        <p className="text-base font-bold text-foreground font-heading">
                          {formatCurrency(userDetailedStats.userTotalVal)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* User Specific Radar & Summary Stats */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Radar Capability Map */}
                    <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-amber-500" />
                        Stage Efficiency Radar
                      </h4>
                      <div className="h-[240px] w-full min-h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={userDetailedStats.radarData}>
                            <PolarGrid stroke="#334155" />
                            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 9 }} />
                            <Radar name={selectedUser.username} dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.4} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Summary Metric Cards */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 rounded-xl border border-border bg-card space-y-1">
                        <p className="text-[11px] text-muted-foreground">Tenders Managed</p>
                        <p className="text-xl font-bold text-foreground font-heading">{selectedUser.total}</p>
                      </div>
                      <div className="p-4 rounded-xl border border-border bg-card space-y-1">
                        <p className="text-[11px] text-muted-foreground">Tenders Won</p>
                        <p className="text-xl font-bold text-emerald-500 font-heading">{selectedUser.won}</p>
                      </div>
                      <div className="p-4 rounded-xl border border-border bg-card space-y-1">
                        <p className="text-[11px] text-muted-foreground">Conversion Rate</p>
                        <p className="text-xl font-bold text-blue-500 font-heading">
                          {selectedUser.total > 0 ? ((selectedUser.won / selectedUser.total) * 100).toFixed(1) : 0}%
                        </p>
                      </div>
                      <div className="p-4 rounded-xl border border-border bg-card space-y-1">
                        <p className="text-[11px] text-muted-foreground">Secured Revenue</p>
                        <p className="text-xl font-bold text-foreground font-heading">
                          {formatCurrency(userDetailedStats.userWonVal)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Owned Tenders Table */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                        <FileText className="size-4 text-primary" />
                        Owned Tenders ({userOwnedBids.length})
                      </h4>
                      {loadingUserBids && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <RefreshCw className="size-3 animate-spin text-primary" /> Fetching owned tenders...
                        </span>
                      )}
                    </div>

                    <div className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border bg-background">
                      {loadingUserBids && userOwnedBids.length === 0 ? (
                        <div className="p-6 text-center text-xs text-muted-foreground space-y-2">
                          <RefreshCw className="size-5 animate-spin mx-auto text-primary" />
                          <p>Loading user portfolio...</p>
                        </div>
                      ) : userOwnedBids.length === 0 ? (
                        <div className="p-6 text-center text-xs text-muted-foreground">
                          No tenders found specifically owned or created by {selectedUser.full_name || selectedUser.username}.
                        </div>
                      ) : (
                        userOwnedBids.map(b => (
                          <div key={b.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-muted/30 text-xs transition-colors">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-foreground">{b.title || b.bid_no}</p>
                                {b.bid_no && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                                    {b.bid_no}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                                <span>{b.organization_name || 'General Org'}</span>
                                {b.category && <span>• {b.category}</span>}
                              </p>
                            </div>

                            <div className="flex items-center gap-3 justify-between sm:justify-end">
                              <Badge className="text-[9px] px-2 py-0.5" style={{ backgroundColor: STAGE_COLORS[b.workflow_stage] || '#64748b' }}>
                                {b.workflow_stage?.replace(/_/g, ' ') || 'DISCOVERED'}
                              </Badge>
                              <div className="text-right">
                                <p className="text-xs font-bold text-foreground">
                                  {formatCurrency(b.estimated_value || b.final_bid_value)}
                                </p>
                                {b.closing_date && (
                                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                                    <Calendar className="size-2.5" />
                                    {new Date(b.closing_date).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
