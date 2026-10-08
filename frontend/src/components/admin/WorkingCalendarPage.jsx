import React, { useState, useEffect, useMemo } from 'react'
import {
  CalendarDays,
  Clock,
  Calendar as CalendarIcon,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldCheck,
  Search,
  Filter,
  ArrowRight,
  Calculator,
  Play,
  Check,
  X,
  History,
  Sparkles,
  Zap,
  Key,
  Settings,
  ChevronLeft,
  ChevronRight,
  Lock,
  ShieldAlert,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { usePermissions } from '../../hooks/usePermissions'
import {
  getDefaultCalendar,
  updateCalendar,
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  getExceptions,
  createException,
  deleteException,
  getGoogleIntegration,
  configureGoogleIntegration,
  triggerGoogleSync,
  getSyncLogs,
  evaluateDeadlines,
} from '../../services/calendar'

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i)

const EMPTY_HOLIDAY_FORM = {
  holiday_date: '',
  holiday_name: '',
  holiday_type: 'COMPANY',
  working_status: 'NON_WORKING',
  priority: 'HIGH',
  description: '',
}

// API list payloads arrive either as { <key>: [...] } or as a bare array.
const listFrom = (data, key) => data?.[key] || (Array.isArray(data) ? data : [])

const SATURDAYS = [
  { num: 1, key: 'saturday_1_working', title: '1st Saturday', defaultWorking: true, days: 'Days 1 – 7 of month' },
  { num: 2, key: 'saturday_2_working', title: '2nd Saturday', defaultWorking: false, days: 'Days 8 – 14 of month' },
  { num: 3, key: 'saturday_3_working', title: '3rd Saturday', defaultWorking: true, days: 'Days 15 – 21 of month' },
  { num: 4, key: 'saturday_4_working', title: '4th Saturday', defaultWorking: false, days: 'Days 22 – 28 of month' },
  { num: 5, key: 'saturday_5_working', title: '5th Saturday', defaultWorking: true, days: 'Days 29 – 31 of month' },
]

const LEGEND = [
  ['bg-emerald-500 ring-2 ring-emerald-500/20', 'Working Day'],
  ['bg-amber-500 ring-2 ring-amber-500/20', '2nd/4th Saturday Off'],
  ['bg-slate-400 ring-2 ring-slate-400/20', 'Sunday Weekly Off'],
  ['bg-rose-500 ring-2 ring-rose-500/20', '🏛️ Gazetted / Gov Holiday'],
  ['bg-purple-500 ring-2 ring-purple-500/20', '🏢 Company Holiday'],
  ['bg-sky-500 ring-2 ring-sky-500/20', '🌐 Regional / Optional'],
  ['bg-emerald-600 ring-2 ring-emerald-600/30', '✨ Special Working Override'],
  ['bg-rose-400 ring-2 ring-rose-400/20', 'Weekday Off'],
]

const DEADLINE_PRESETS = [
  ['72 Hours (Default)', { deadline_trigger_value: 72, deadline_trigger_unit: 'HOURS' }],
  ['48 Hours', { deadline_trigger_value: 48, deadline_trigger_unit: 'HOURS' }],
  ['24 Hours', { deadline_trigger_value: 24, deadline_trigger_unit: 'HOURS' }],
  ['3 Days', { deadline_trigger_value: 3, deadline_trigger_unit: 'DAYS' }],
]

const INTERVAL_PRESETS = [
  ['10 Minutes (Standard)', { scheduler_interval_value: 10 }],
  ['5 Minutes', { scheduler_interval_value: 5 }],
  ['1 Minute', { scheduler_interval_value: 1 }],
]

export function WorkingCalendarPage() {
  const { user, roles, isAdmin, hasRole } = usePermissions()

  // RBAC Permission: strictly Super Admin and Admin can add, edit, or delete calendar data
  const canEditCalendar = useMemo(() => {
    const userRoles = Array.isArray(user?.roles) ? user.roles : []
    return (
      hasRole('SUPER_ADMIN') ||
      hasRole('ADMIN') ||
      userRoles.includes('SUPER_ADMIN') ||
      userRoles.includes('ADMIN') ||
      user?.role === 'SUPER_ADMIN' ||
      user?.role === 'ADMIN' ||
      user?.role_name === 'SUPER_ADMIN' ||
      user?.role_name === 'ADMIN' ||
      isAdmin
    )
  }, [user, roles, isAdmin, hasRole])

  const [activeTab, setActiveTab] = useState('calendar')

  useEffect(() => {
    if (!canEditCalendar && !['calendar', 'holidays', 'exceptions'].includes(activeTab)) {
      setActiveTab('calendar')
    }
  }, [canEditCalendar, activeTab])
  const [calendar, setCalendar] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Holidays state
  const [holidays, setHolidays] = useState([])
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR)
  const [holidaySearch, setHolidaySearch] = useState('')
  const [holidayTypeFilter, setHolidayTypeFilter] = useState('ALL')
  const [holidayModalOpen, setHolidayModalOpen] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState(null)
  const [holidayForm, setHolidayForm] = useState({ ...EMPTY_HOLIDAY_FORM })

  // Exceptions state
  const [exceptions, setExceptions] = useState([])
  const [exceptionForm, setExceptionForm] = useState({
    exception_date: '',
    exception_type: 'SPECIAL_WORKING_DAY',
    reason: '',
  })

  // Google Sync state
  const [googleConfig, setGoogleConfig] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncLogs, setSyncLogs] = useState([])
  const [lastSyncResult, setLastSyncResult] = useState(null)
  const [showGoogleConfigModal, setShowGoogleConfigModal] = useState(false)
  const [googleForm, setGoogleForm] = useState({
    google_calendar_id: 'en.indian#holiday@group.v.calendar.google.com',
    google_calendar_name: 'Indian National Holidays',
    api_key: '',
    sync_interval_hours: 24,
    sync_enabled: true,
  })
  const [savingGoogleConfig, setSavingGoogleConfig] = useState(false)

  // Fetch initial calendar data
  const loadCalendarData = async () => {
    setLoading(true)
    try {
      const calRes = await getDefaultCalendar()
      if (calRes.ok && calRes.data) {
        setCalendar(calRes.data)
        const calId = calRes.data.id

        // Load parallel child resources (fetch all holidays so Monthly Calendar has full coverage across all years)
        const [holsRes, excRes, gRes, logsRes] = await Promise.all([
          getHolidays(calId),
          getExceptions(calId),
          getGoogleIntegration(calId),
          getSyncLogs(calId, 10),
        ])

        const failed = [holsRes, excRes, gRes, logsRes].find((r) => !r.ok)
        if (failed) toast.error(failed.error?.message || 'Some working calendar data could not be loaded')
        if (holsRes.ok) setHolidays(listFrom(holsRes.data, 'holidays'))
        if (excRes.ok) setExceptions(listFrom(excRes.data, 'exceptions'))
        if (gRes.ok) {
          const cfg = gRes.data?.integration || gRes.data
          setGoogleConfig(cfg)
          setGoogleForm({
            google_calendar_id: cfg?.google_calendar_id || 'en.indian#holiday@group.v.calendar.google.com',
            google_calendar_name: cfg?.google_calendar_name || 'Indian National Holidays',
            api_key: '', // the server never returns the key; blank keeps the stored one
            sync_interval_hours: cfg?.sync_interval_hours || 24,
            sync_enabled: cfg?.sync_enabled ?? true,
          })
        }
        if (logsRes.ok) setSyncLogs(listFrom(logsRes.data, 'logs'))
      } else {
        toast.error('Could not load default working calendar')
      }
    } catch (err) {
      toast.error('Network error loading working calendar data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCalendarData()
  }, [])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const reloadHolidays = async () => {
    const refreshed = await getHolidays(calendar.id)
    if (refreshed.ok) setHolidays(listFrom(refreshed.data, 'holidays'))
  }

  // A created exception replaces any existing one on the same date.
  const upsertException = (res) => {
    const newExc = res.data?.exception || res.data
    setExceptions((prev) => [
      ...prev.filter(
        (item) => item.id !== newExc.id && toIsoDateString(item.exception_date) !== toIsoDateString(newExc.exception_date)
      ),
      newExc,
    ])
  }

  const handleUpdateCalendar = async (changes) => {
    if (!calendar?.id) return
    if (!canEditCalendar) {
      toast.error('Permission denied: Only Super Admin and Admin can update the working calendar')
      return
    }
    setSaving(true)
    try {
      // The API applies only the fields sent, so a partial change never touches the rest.
      const res = await updateCalendar(calendar.id, changes)
      if (res.ok) {
        setCalendar(res.data)
        toast.success('Working calendar updated successfully. Monthly Calendar synchronized.')
      } else {
        toast.error(res.error?.message || 'Failed to update calendar')
      }
    } catch {
      toast.error('Network error updating calendar')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveHoliday = async (e) => {
    e.preventDefault()
    if (!calendar?.id) return
    if (!canEditCalendar) {
      toast.error('Permission denied: Only Super Admin and Admin can add or edit holidays')
      return
    }
    if (!holidayForm.holiday_date || !holidayForm.holiday_name) {
      toast.error('Please fill in date and holiday name')
      return
    }

    try {
      if (editingHoliday) {
        const res = await updateHoliday(calendar.id, editingHoliday.id, {
          holiday_name: holidayForm.holiday_name,
          holiday_type: holidayForm.holiday_type,
          working_status: holidayForm.working_status,
          priority: holidayForm.priority,
          description: holidayForm.description,
          is_admin_override: true,
        })
        if (res.ok) {
          toast.success(`Holiday "${holidayForm.holiday_name}" updated. Monthly Calendar synchronized.`)
          setHolidayModalOpen(false)
          setEditingHoliday(null)
          await reloadHolidays()
        } else {
          toast.error(res.error?.message || 'Failed to update holiday')
        }
      } else {
        const res = await createHoliday(calendar.id, holidayForm)
        if (res.ok) {
          toast.success(`Holiday "${holidayForm.holiday_name}" added. Monthly Calendar synchronized.`)
          setHolidayModalOpen(false)
          setHolidayForm({ ...EMPTY_HOLIDAY_FORM })
          await reloadHolidays()
        } else {
          toast.error(res.error?.message || 'Failed to create holiday')
        }
      }
    } catch {
      toast.error('Network error saving holiday')
    }
  }

  const handleDeleteHoliday = async (holidayId, name) => {
    if (!canEditCalendar) {
      toast.error('Permission denied: Only Super Admin and Admin can delete holidays')
      return
    }
    if (!confirm(`Are you sure you want to remove "${name}"?`)) return
    try {
      const res = await deleteHoliday(calendar.id, holidayId)
      if (res.ok) {
        toast.success(`Holiday "${name}" removed. Monthly Calendar updated.`)
        setHolidays((prev) => prev.filter((h) => h.id !== holidayId))
      } else {
        toast.error(res.error?.message || 'Failed to delete holiday')
      }
    } catch {
      toast.error('Network error deleting holiday')
    }
  }

  const handleCreateException = async (e) => {
    e.preventDefault()
    if (!calendar?.id) return
    if (!canEditCalendar) {
      toast.error('Permission denied: Only Super Admin and Admin can create date exceptions')
      return
    }
    if (!exceptionForm.exception_date) {
      toast.error('Please pick a date')
      return
    }
    try {
      const res = await createException(calendar.id, exceptionForm)
      if (res.ok) {
        toast.success('Special date exception created. Monthly Calendar updated.')
        upsertException(res)
        setExceptionForm({
          exception_date: '',
          exception_type: 'SPECIAL_WORKING_DAY',
          reason: '',
        })
      } else {
        toast.error(res.error?.message || 'Failed to save exception')
      }
    } catch {
      toast.error('Network error creating exception')
    }
  }

  const handleDeleteException = async (excId) => {
    if (!calendar?.id) return
    if (!canEditCalendar) {
      toast.error('Permission denied: Only Super Admin and Admin can remove date exceptions')
      return
    }
    try {
      const res = await deleteException(calendar.id, excId)
      if (res.ok) {
        toast.success('Exception removed. Monthly Calendar restored to default.')
        setExceptions((prev) => prev.filter((e) => e.id !== excId))
      } else {
        toast.error(res.error?.message || 'Failed to remove exception')
      }
    } catch {
      toast.error('Network error removing exception')
    }
  }

  const handleTriggerGoogleSync = async () => {
    if (!calendar?.id) return
    if (!canEditCalendar) {
      toast.error('Permission denied: Only Super Admin and Admin can trigger Google sync')
      return
    }
    setSyncing(true)
    try {
      const res = await triggerGoogleSync(calendar.id)
      if (res.ok && res.data?.status === 'FAILED') {
        setLastSyncResult(res.data)
        toast.error(res.data.message || 'Google Calendar sync failed')
      } else if (res.ok) {
        setLastSyncResult(res.data)
        toast.success(res.data?.message || 'Google Calendar sync completed successfully')
        // Refresh holidays across all years and sync logs
        const [holsRes, logsRes] = await Promise.all([
          getHolidays(calendar.id),
          getSyncLogs(calendar.id, 10),
        ])
        if (holsRes.ok) setHolidays(listFrom(holsRes.data, 'holidays'))
        if (logsRes.ok) setSyncLogs(listFrom(logsRes.data, 'logs'))
      } else {
        toast.error(res.error?.message || 'Sync failed')
      }
    } catch {
      toast.error('Network error executing Google synchronization')
    } finally {
      setSyncing(false)
    }
  }

  const [evaluatingDeadlines, setEvaluatingDeadlines] = useState(false)

  const handleTriggerDeadlineEvaluation = async () => {
    setEvaluatingDeadlines(true)
    try {
      const res = await evaluateDeadlines()
      if (res.ok) {
        const s = res.data || {}
        if (s.skipped) toast.info('Another evaluation is already running')
        else if (s.baselined) toast.success(`First run: ${s.in_red_zone ?? 0} tender(s) already in the red zone were recorded as notified. No alerts were sent.`)
        else toast.success(`Evaluated ${s.evaluated ?? 0} tenders: ${s.in_red_zone ?? 0} in the red zone, ${s.notified ?? 0} alert(s) sent.`)
      } else {
        toast.error(res.error?.message || 'Failed to trigger deadline evaluation')
      }
    } catch {
      toast.error('Network error triggering deadline evaluation')
    } finally {
      setEvaluatingDeadlines(false)
    }
  }

  const handleSaveGoogleConfig = async (e) => {
    e.preventDefault()
    if (!calendar?.id) return
    if (!canEditCalendar) {
      toast.error('Permission denied: Only Super Admin and Admin can configure Google Calendar')
      return
    }
    setSavingGoogleConfig(true)
    try {
      const res = await configureGoogleIntegration(calendar.id, {
        ...googleForm,
        sync_interval_hours: parseInt(googleForm.sync_interval_hours, 10) || 24,
      })
      if (res.ok) {
        toast.success('Google Calendar settings and API Key saved')
        setGoogleConfig(res.data?.integration || res.data)
        setGoogleForm((f) => ({ ...f, api_key: '' }))
        setShowGoogleConfigModal(false)
      } else {
        toast.error(res.error?.message || 'Failed to save Google configuration')
      }
    } catch {
      toast.error('Network error saving Google configuration')
    } finally {
      setSavingGoogleConfig(false)
    }
  }

  // ── Interactive Monthly Working Calendar Engine ──────────────────────────
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [selectedDateDetail, setSelectedDateDetail] = useState(null)
  const [quickAddTab, setQuickAddTab] = useState('HOLIDAY')
  const [quickHolidayName, setQuickHolidayName] = useState('')
  const [quickHolidayType, setQuickHolidayType] = useState('COMPANY')
  const [quickHolidayStatus, setQuickHolidayStatus] = useState('NON_WORKING')
  const [quickHolidayDesc, setQuickHolidayDesc] = useState('')
  const [quickExceptionType, setQuickExceptionType] = useState('SPECIAL_WORKING_DAY')
  const [quickExceptionReason, setQuickExceptionReason] = useState('')
  const [savingQuickEvent, setSavingQuickEvent] = useState(false)

  const toIsoDateString = (val) => {
    if (!val) return ''
    if (typeof val === 'string') return val.split('T')[0]
    if (val instanceof Date) {
      const pad = (n) => String(n).padStart(2, '0')
      return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())}`
    }
    return ''
  }

  const getOrdinal = (n) => {
    if (n === 1) return 'st'
    if (n === 2) return 'nd'
    if (n === 3) return 'rd'
    return 'th'
  }

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11)
      const ny = calYear - 1
      setCalYear(ny)
      setSelectedYear(ny)
    } else {
      setCalMonth((prev) => prev - 1)
    }
  }

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0)
      const ny = calYear + 1
      setCalYear(ny)
      setSelectedYear(ny)
    } else {
      setCalMonth((prev) => prev + 1)
    }
  }

  const handleToday = () => {
    const now = new Date()
    setCalMonth(now.getMonth())
    setCalYear(now.getFullYear())
    setSelectedYear(now.getFullYear())
  }

  const computeDayInfo = (dateObj, dateStr, dayNum, isCurrentMonth, todayStr) => {
    const dayOfWeek = dateObj.getDay()
    const isToday = dateStr === todayStr

    const dayHolidays = holidays.filter((h) => toIsoDateString(h.holiday_date) === dateStr)
    const dayExceptions = exceptions.filter((e) => toIsoDateString(e.exception_date) === dateStr)

    // Saturday rule calculation
    let satIndex = 0
    let satWorking = true
    if (dayOfWeek === 6) {
      satIndex = Math.floor((dateObj.getDate() - 1) / 7) + 1
      if (satIndex === 1) satWorking = calendar?.saturday_1_working ?? true
      else if (satIndex === 2) satWorking = calendar?.saturday_2_working ?? false
      else if (satIndex === 3) satWorking = calendar?.saturday_3_working ?? true
      else if (satIndex === 4) satWorking = calendar?.saturday_4_working ?? false
      else if (satIndex === 5) satWorking = calendar?.saturday_5_working ?? true
    }

    const isSunday = dayOfWeek === 0
    const isSundayWorking = isSunday && (calendar?.sunday_working ?? false)

    // Standard weekday schedule
    let standardWorking = true
    if (dayOfWeek === 0) standardWorking = isSundayWorking
    else if (dayOfWeek === 1) standardWorking = calendar?.monday_working ?? true
    else if (dayOfWeek === 2) standardWorking = calendar?.tuesday_working ?? true
    else if (dayOfWeek === 3) standardWorking = calendar?.wednesday_working ?? true
    else if (dayOfWeek === 4) standardWorking = calendar?.thursday_working ?? true
    else if (dayOfWeek === 5) standardWorking = calendar?.friday_working ?? true
    else if (dayOfWeek === 6) standardWorking = satWorking

    const hasSpecialWorking = dayExceptions.some((e) => e.exception_type === 'SPECIAL_WORKING_DAY')
    const hasSpecialHoliday = dayExceptions.some((e) => e.exception_type !== 'SPECIAL_WORKING_DAY')
    const nonWorkingHoliday = dayHolidays.find((h) => h.working_status === 'NON_WORKING')
    const workingHoliday = dayHolidays.find((h) => h.working_status === 'WORKING')

    let isWorkingDay = false
    let badgeText = 'Working'
    let detailText = ''
    let isHoliday = false
    let isSaturdayOff = false
    let isWorkingSat = false
    let isSundayOff = false
    let isSpecialWork = false
    let ruleExplanation = ''

    if (hasSpecialWorking) {
      isWorkingDay = true
      isSpecialWork = true
      badgeText = 'Special Work'
      detailText = 'Special Working Day Override'
      ruleExplanation = 'Office is operating by Special Working Day exception override.'
    } else if (hasSpecialHoliday) {
      isWorkingDay = false
      badgeText = 'Special Off'
      detailText = 'Special Holiday Exception'
      ruleExplanation = 'Office is closed by Special Holiday exception override.'
    } else if (nonWorkingHoliday) {
      isWorkingDay = false
      isHoliday = true
      badgeText = nonWorkingHoliday.holiday_type || 'Holiday'
      detailText = nonWorkingHoliday.holiday_name
      ruleExplanation = `Declared ${nonWorkingHoliday.holiday_type} Holiday: "${nonWorkingHoliday.holiday_name}". Office closed.`
    } else if (workingHoliday) {
      isWorkingDay = true
      badgeText = 'Working Hol'
      detailText = workingHoliday.holiday_name
      ruleExplanation = `Observed Holiday: "${workingHoliday.holiday_name}". Office is operational.`
    } else if (isSunday) {
      isWorkingDay = isSundayWorking
      isSundayOff = !isSundayWorking
      badgeText = isSundayWorking ? 'Sun Work' : 'Sunday Off'
      detailText = isSundayWorking ? 'Sunday (Operational)' : 'Weekly Off (Sunday)'
      ruleExplanation = isSundayWorking ? 'Sunday is configured as an active working day.' : 'Weekly holiday by standard policy.'
    } else if (dayOfWeek === 6) {
      isWorkingDay = satWorking
      isSaturdayOff = !satWorking
      isWorkingSat = satWorking
      const ord = `${satIndex}${getOrdinal(satIndex)}`
      badgeText = satWorking ? `${ord} Sat Work` : `${ord} Sat Off`
      detailText = satWorking ? `${ord} Sat (Working)` : `${ord} Sat (Weekly Off)`
      ruleExplanation = satWorking
        ? `${ord} Saturday is an active working day by OneTrack alternate Saturday policy.`
        : `${ord} Saturday is an official non-working holiday by OneTrack policy (2nd & 4th Saturdays off).`
    } else {
      isWorkingDay = standardWorking
      badgeText = standardWorking ? 'Working' : 'Weekday Off'
      detailText = standardWorking ? 'Standard Working Day' : 'Weekly Non-Working Day'
      ruleExplanation = standardWorking
        ? `Regular operational business day (${calendar?.working_start_time || '09:00'} - ${calendar?.working_end_time || '18:00'}).`
        : 'Configured as non-working weekday in Working Schedule.'
    }

    return {
      dateStr,
      dayNum,
      isCurrentMonth,
      isToday,
      isWorkingDay,
      dayHolidays,
      dayExceptions,
      isSunday,
      ruleExplanation,
      dayStatus: {
        badgeText,
        detailText,
        isHoliday,
        isSaturdayOff,
        isWorkingSat,
        isSundayOff,
        isSpecialWork,
        isWeekdayOff: !standardWorking && !isSunday && dayOfWeek !== 6,
        isSundayWorking,
      },
    }
  }

  // Calculate day cells for the current month
  const monthCells = useMemo(() => {
    const pad = (n) => String(n).padStart(2, '0')
    const todayStr = toIsoDateString(new Date())
    const firstDay = new Date(calYear, calMonth, 1)
    const startWeekday = firstDay.getDay()
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate()

    const cells = []

    // Previous month padding days
    for (let i = startWeekday - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i
      const dObj = new Date(calYear, calMonth - 1, dayNum)
      const dStr = `${dObj.getFullYear()}-${pad(dObj.getMonth() + 1)}-${pad(dObj.getDate())}`
      cells.push(computeDayInfo(dObj, dStr, dayNum, false, todayStr))
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dObj = new Date(calYear, calMonth, d)
      const dStr = `${calYear}-${pad(calMonth + 1)}-${pad(d)}`
      cells.push(computeDayInfo(dObj, dStr, d, true, todayStr))
    }

    // Next month padding days
    const totalCurrent = cells.length
    const targetTotal = Math.ceil(totalCurrent / 7) * 7
    const remaining = targetTotal - totalCurrent
    for (let d = 1; d <= remaining; d++) {
      const dObj = new Date(calYear, calMonth + 1, d)
      const dStr = `${dObj.getFullYear()}-${pad(dObj.getMonth() + 1)}-${pad(dObj.getDate())}`
      cells.push(computeDayInfo(dObj, dStr, d, false, todayStr))
    }

    return cells
  }, [calYear, calMonth, holidays, exceptions, calendar])

  const selectedDayInfo = useMemo(() => {
    if (!selectedDateDetail) return null
    const parts = selectedDateDetail.split('-').map(Number)
    const dObj = new Date(parts[0], parts[1] - 1, parts[2])
    const todayStr = toIsoDateString(new Date())
    return computeDayInfo(dObj, selectedDateDetail, parts[2], true, todayStr)
  }, [selectedDateDetail, holidays, exceptions, calendar])

  const handleCreateHolidayQuick = async (e) => {
    e?.preventDefault()
    if (!calendar?.id || !selectedDateDetail || !quickHolidayName.trim()) {
      toast.error('Please enter a holiday name')
      return
    }
    if (!canEditCalendar) {
      toast.error('Permission denied: Only Super Admin and Admin can add holidays')
      return
    }
    setSavingQuickEvent(true)
    try {
      const res = await createHoliday(calendar.id, {
        holiday_date: selectedDateDetail,
        holiday_name: quickHolidayName.trim(),
        holiday_type: quickHolidayType,
        working_status: quickHolidayStatus,
        priority: 'HIGH',
        description: quickHolidayDesc.trim(),
      })
      if (res.ok) {
        toast.success(`Holiday "${quickHolidayName.trim()}" added. Monthly Calendar updated.`)
        setQuickHolidayName('')
        setQuickHolidayDesc('')
        await reloadHolidays()
      } else {
        toast.error(res.error?.message || 'Failed to add holiday')
      }
    } catch {
      toast.error('Network error saving holiday')
    } finally {
      setSavingQuickEvent(false)
    }
  }

  const handleCreateExceptionQuick = async (e) => {
    e?.preventDefault()
    if (!calendar?.id || !selectedDateDetail) return
    if (!canEditCalendar) {
      toast.error('Permission denied: Only Super Admin and Admin can create date exceptions')
      return
    }
    setSavingQuickEvent(true)
    try {
      const defaultReason = quickExceptionType === 'SPECIAL_WORKING_DAY'
        ? 'Special Working Day Override'
        : 'Special Holiday Override'
      const res = await createException(calendar.id, {
        exception_date: selectedDateDetail,
        exception_type: quickExceptionType,
        reason: quickExceptionReason.trim() || defaultReason,
      })
      if (res.ok) {
        toast.success('Special date override created. Monthly Calendar updated.')
        upsertException(res)
        setQuickExceptionReason('')
      } else {
        toast.error(res.error?.message || 'Failed to save override')
      }
    } catch {
      toast.error('Network error creating override')
    } finally {
      setSavingQuickEvent(false)
    }
  }

  const handleQuickConvertWeekend = async (dateStr) => {
    if (!calendar?.id || !dateStr) return
    if (!canEditCalendar) {
      toast.error('Permission denied: Only Super Admin and Admin can override working days')
      return
    }
    setSavingQuickEvent(true)
    try {
      const res = await createException(calendar.id, {
        exception_date: dateStr,
        exception_type: 'SPECIAL_WORKING_DAY',
        reason: 'Office Open / Special Weekend Working Day',
      })
      if (res.ok) {
        toast.success('Converted to Special Working Day! Monthly Calendar updated.')
        upsertException(res)
      } else {
        toast.error(res.error?.message || 'Failed to convert day')
      }
    } catch {
      toast.error('Network error converting day')
    } finally {
      setSavingQuickEvent(false)
    }
  }

  // Filtered holidays list (for Holiday Ledger tab)
  const filteredHolidays = useMemo(() => {
    return holidays.filter((h) => {
      const hDate = toIsoDateString(h.holiday_date)
      const matchesYear =
        selectedYear === 'ALL' || !selectedYear || hDate.startsWith(String(selectedYear))
      const matchesSearch =
        !holidaySearch ||
        h.holiday_name?.toLowerCase().includes(holidaySearch.toLowerCase()) ||
        hDate.includes(holidaySearch)
      const matchesType = holidayTypeFilter === 'ALL' || h.holiday_type === holidayTypeFilter
      return matchesYear && matchesSearch && matchesType
    })
  }, [holidays, selectedYear, holidaySearch, holidayTypeFilter])

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const tabs = [
    { id: 'overview', label: 'Working Schedule', Icon: Clock, adminOnly: true },
    { id: 'calendar', label: 'Monthly Calendar', Icon: CalendarIcon },
    { id: 'saturdays', label: 'Saturday Rules', Icon: CalendarDays, adminOnly: true },
    { id: 'holidays', label: `Holiday Ledger (${holidays.length})`, Icon: ShieldCheck },
    { id: 'exceptions', label: `Special Exceptions (${exceptions.length})`, Icon: AlertTriangle },
    { id: 'google-sync', label: 'Google Sync', Icon: RefreshCw, adminOnly: true },
  ].filter((t) => !t.adminOnly || canEditCalendar)

  const statCards = [
    {
      Icon: Clock,
      box: 'rounded-lg bg-blue-500/10 p-2.5 text-blue-500',
      label: 'Working Hours',
      value: `${calendar?.working_start_time || '09:00'} – ${calendar?.working_end_time || '18:00'}`,
      sub: '9.0 hrs / working day',
      subClass: 'text-xs text-muted-foreground',
    },
    {
      Icon: CalendarIcon,
      box: 'rounded-lg bg-amber-500/10 p-2.5 text-amber-500',
      label: 'Saturday Rules',
      value: '2nd & 4th Off',
      sub: '1st, 3rd, 5th Working',
      subClass: 'text-xs text-muted-foreground',
    },
    {
      Icon: ShieldCheck,
      box: 'rounded-lg bg-purple-500/10 p-2.5 text-purple-500',
      label: `Active Holidays (${selectedYear})`,
      value: `${holidays.length} Records`,
      sub: `${holidays.filter((h) => h.is_admin_override).length} Admin Overrides`,
      subClass: 'text-xs text-emerald-500 font-medium',
    },
    {
      Icon: Zap,
      box: 'rounded-lg bg-emerald-500/10 p-2.5 text-emerald-500',
      label: 'Deadline Trigger',
      value: `${calendar?.deadline_trigger_value ?? 72} ${calendar?.deadline_trigger_unit || 'HOURS'}`,
      sub: `Cadence: every ${calendar?.scheduler_interval_value ?? 10} min`,
      subClass: 'text-xs text-muted-foreground',
    },
  ]

  const renderPresets = (presets, borderClass) =>
    canEditCalendar && (
      <div className={`flex flex-wrap items-center gap-1.5 pt-1 border-t ${borderClass}`}>
        <span className="text-[11px] font-medium text-muted-foreground mr-1">Quick Presets:</span>
        {presets.map(([label, patch]) => (
          <Button
            key={label}
            type="button"
            variant="outline"
            size="sm"
            className="h-6 text-[11px] px-2"
            onClick={() => setCalendar({ ...calendar, ...patch })}
          >
            {label}
          </Button>
        ))}
      </div>
    )

  return (
    <div className="space-y-6 p-6">
      {/* Page Title & Badges */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Working Calendar
            </h1>
            {canEditCalendar && (
              <>
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-500">
                  Active Source of Truth
                </Badge>
                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                  Admin Management
                </Badge>
              </>
            )}
          </div>
          {canEditCalendar && (
            <p className="mt-1 text-sm text-muted-foreground">
              Manage corporate working intervals, dynamic Saturday rules, internal holiday database, Google holiday sync, and priority tender deadlines.
            </p>
          )}
        </div>

        {/* Global Action Bar - Only for Super Admin and Admin */}
        {canEditCalendar && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTriggerDeadlineEvaluation}
              disabled={evaluatingDeadlines}
              className="border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 font-medium"
              title="Test Working Deadline Engine: evaluate active tenders and send email alerts"
            >
              <Zap className={`mr-2 h-4 w-4 ${evaluatingDeadlines ? 'animate-spin' : ''}`} />
              {evaluatingDeadlines ? 'Evaluating...' : 'Run Deadline Engine Now'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTriggerGoogleSync}
              disabled={syncing}
              className="border-primary/30 hover:bg-primary/5"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Google Holidays'}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditingHoliday(null)
                setHolidayForm({ ...EMPTY_HOLIDAY_FORM })
                setHolidayModalOpen(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Holiday
            </Button>
          </div>
        )}
      </div>

      {/* Overview Stat Badges - Visible only for Super Admin and Admin */}
      {canEditCalendar && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map(({ Icon, box, label, value, sub, subClass }) => (
            <Card key={label} className="border-border/60 bg-card/60 backdrop-blur-sm">
              <CardContent className="flex items-center gap-4 p-4">
                <div className={box}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <p className="text-lg font-semibold tracking-tight text-foreground">{value}</p>
                  <p className={subClass}>{sub}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tab Navigation - Available across all portals with role-appropriate tabs */}
      <div className="flex border-b border-border">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === id
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview & Working Schedule ─────────────────────────────────── */}
      {canEditCalendar && activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-primary" />
                  Working Hours & Business Week
                </CardTitle>
                <CardDescription>
                  Define the daily operational interval used by the backward 72-hour calculation engine.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Working Start Time (HH:MM)</label>
                    <Input
                      type="time"
                      disabled={!canEditCalendar}
                      value={calendar?.working_start_time || '09:00'}
                      onChange={(e) => setCalendar({ ...calendar, working_start_time: e.target.value })}
                      className={!canEditCalendar ? 'bg-muted/40 cursor-not-allowed' : ''}
                    />
                    <p className="text-[11px] text-muted-foreground">Default: 09:00 AM</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Working End Time (HH:MM)</label>
                    <Input
                      type="time"
                      disabled={!canEditCalendar}
                      value={calendar?.working_end_time || '18:00'}
                      onChange={(e) => setCalendar({ ...calendar, working_end_time: e.target.value })}
                      className={!canEditCalendar ? 'bg-muted/40 cursor-not-allowed' : ''}
                    />
                    <p className="text-[11px] text-muted-foreground">Default: 06:00 PM (18:00)</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-muted-foreground">Default Weekly Schedule</label>
                    {canEditCalendar ? (
                      <span className="text-[11px] text-muted-foreground">Click any card to toggle status</span>
                    ) : (
                      <span className="text-[11px] text-amber-500 font-medium flex items-center gap-1">
                        <Lock className="h-3 w-3" /> View Only (Admin managed)
                      </span>
                    )}
                  </div>
                  {(() => {
                    const satWorkingCount = [
                      calendar?.saturday_1_working,
                      calendar?.saturday_2_working,
                      calendar?.saturday_3_working,
                      calendar?.saturday_4_working,
                      calendar?.saturday_5_working,
                    ].filter(Boolean).length

                    const isSatAllWorking = satWorkingCount === 5
                    const isSatAllHoliday = satWorkingCount === 0
                    const isSatStandardAlternate = (
                      Boolean(calendar?.saturday_1_working) &&
                      !calendar?.saturday_2_working &&
                      Boolean(calendar?.saturday_3_working) &&
                      !calendar?.saturday_4_working &&
                      Boolean(calendar?.saturday_5_working)
                    )

                    const satStatusText = isSatAllWorking
                      ? 'WORKING'
                      : isSatAllHoliday
                        ? 'HOLIDAY'
                        : isSatStandardAlternate
                          ? '2nd/4th OFF'
                          : `${satWorkingCount}/5 WORKING`

                    const handleToggleSaturdayCycle = () => {
                      if (isSatAllWorking) {
                        // Cycle to All Holiday
                        setCalendar((prev) => ({
                          ...prev,
                          saturday_1_working: false,
                          saturday_2_working: false,
                          saturday_3_working: false,
                          saturday_4_working: false,
                          saturday_5_working: false,
                        }))
                      } else if (isSatAllHoliday) {
                        // Cycle to standard alternate (2nd and 4th off)
                        setCalendar((prev) => ({
                          ...prev,
                          saturday_1_working: true,
                          saturday_2_working: false,
                          saturday_3_working: true,
                          saturday_4_working: false,
                          saturday_5_working: true,
                        }))
                      } else {
                        // Currently alternate or custom -> Cycle to All Working
                        setCalendar((prev) => ({
                          ...prev,
                          saturday_1_working: true,
                          saturday_2_working: true,
                          saturday_3_working: true,
                          saturday_4_working: true,
                          saturday_5_working: true,
                        }))
                      }
                    }

                    const daysList = [
                      { key: 'monday_working', label: 'Monday' },
                      { key: 'tuesday_working', label: 'Tuesday' },
                      { key: 'wednesday_working', label: 'Wednesday' },
                      { key: 'thursday_working', label: 'Thursday' },
                      { key: 'friday_working', label: 'Friday' },
                      { key: 'saturday', label: 'Saturday', isSaturday: true },
                      { key: 'sunday_working', label: 'Sunday' },
                    ]

                    return (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                        {daysList.map(({ key, label, isSaturday }) => {
                          if (isSaturday) {
                            const cardBg = isSatAllWorking
                              ? 'border-emerald-500/50 bg-emerald-500/10 text-foreground ring-1 ring-emerald-500/20'
                              : isSatAllHoliday
                                ? 'border-rose-500/40 bg-rose-500/5 text-muted-foreground'
                                : 'border-amber-500/50 bg-amber-500/10 text-foreground ring-1 ring-amber-500/20'

                            const badgeBg = isSatAllWorking
                              ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold'
                              : isSatAllHoliday
                                ? 'border-rose-500/50 bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold'
                                : 'border-amber-500/60 bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold'

                            return canEditCalendar ? (
                              <button
                                key={key}
                                type="button"
                                onClick={handleToggleSaturdayCycle}
                                className={`flex flex-col items-center justify-center rounded-lg border p-3 text-center transition-all cursor-pointer select-none group hover:shadow-xs hover:scale-[1.02] active:scale-[0.98] ${cardBg}`}
                                title="Click to cycle Saturday: 2nd/4th Off ➔ All Working ➔ All Holiday (or customize in Saturday Rules tab)"
                              >
                                <span className="text-xs font-semibold text-foreground">{label}</span>
                                <Badge variant="outline" className={`mt-1.5 text-[10px] transition-colors ${badgeBg}`}>
                                  {satStatusText}
                                </Badge>
                                <span className="mt-1 text-[10px] text-muted-foreground/80 group-hover:text-primary transition-colors">
                                  Click to cycle
                                </span>
                              </button>
                            ) : (
                              <div
                                key={key}
                                className={`flex flex-col items-center justify-center rounded-lg border p-3 text-center cursor-default select-none ${isSatAllHoliday ? 'border-rose-500/30 bg-rose-500/5 text-muted-foreground' : 'border-amber-500/40 bg-amber-500/5 text-foreground'
                                  }`}
                              >
                                <span className="text-xs font-semibold text-foreground">{label}</span>
                                <Badge variant="outline" className={`mt-1.5 text-[10px] ${badgeBg}`}>
                                  {satStatusText}
                                </Badge>
                                <span className="mt-1 text-[10px] text-muted-foreground/60">
                                  Fixed Policy
                                </span>
                              </div>
                            )
                          }

                          const isWorking = calendar?.[key]
                          return canEditCalendar ? (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                setCalendar((prev) => ({ ...prev, [key]: !prev?.[key] }))
                              }}
                              className={`flex flex-col items-center justify-center rounded-lg border p-3 text-center transition-all cursor-pointer select-none group hover:shadow-xs hover:scale-[1.02] active:scale-[0.98] ${isWorking
                                ? 'border-emerald-500/50 bg-emerald-500/10 text-foreground ring-1 ring-emerald-500/20'
                                : 'border-rose-500/40 bg-rose-500/5 text-muted-foreground'
                                }`}
                              title={`Click to toggle ${label} (${isWorking ? 'Working Day' : 'Holiday'})`}
                            >
                              <span className="text-xs font-semibold text-foreground">{label}</span>
                              <Badge
                                variant="outline"
                                className={`mt-1.5 text-[10px] transition-colors ${isWorking
                                  ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold'
                                  : 'border-rose-500/50 bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold'
                                  }`}
                              >
                                {isWorking ? 'WORKING' : 'HOLIDAY'}
                              </Badge>
                              <span className="mt-1 text-[10px] text-muted-foreground/80 group-hover:text-primary transition-colors">
                                Click to toggle
                              </span>
                            </button>
                          ) : (
                            <div
                              key={key}
                              className={`flex flex-col items-center justify-center rounded-lg border p-3 text-center cursor-default select-none ${isWorking
                                ? 'border-emerald-500/40 bg-emerald-500/5 text-foreground'
                                : 'border-rose-500/30 bg-rose-500/5 text-muted-foreground'
                                }`}
                            >
                              <span className="text-xs font-semibold text-foreground">{label}</span>
                              <Badge
                                variant="outline"
                                className={`mt-1.5 text-[10px] ${isWorking
                                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold'
                                  : 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold'
                                  }`}
                              >
                                {isWorking ? 'WORKING' : 'HOLIDAY'}
                              </Badge>
                              <span className="mt-1 text-[10px] text-muted-foreground/60">
                                Fixed Policy
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                  <p className="text-[11px] text-muted-foreground">
                    {canEditCalendar ? (
                      <>💡 Click any day card above to toggle between WORKING and HOLIDAY (Saturday cycles through <em>2nd/4th Off</em>, <em>All Working</em>, and <em>All Holiday</em>). Detailed 1st–5th Saturday toggles are also in the <strong>"Saturday Rules"</strong> tab. Click <strong>"Save Schedule Settings"</strong> below to persist changes and sync the Monthly Calendar.</>
                    ) : (
                      <>ℹ️ Corporate working schedule is actively applied across tender closing deadline engines. Contact an administrator to request policy adjustments.</>
                    )}
                  </p>
                </div>

                {/* User Configurable Deadline Trigger & Scheduler Cadence */}
                <div className="space-y-4 pt-2">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <Zap className="h-4 w-4 text-emerald-500" />
                          Tender Red Zone Deadline Trigger (Alert Threshold)
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Working time counted backwards from tender closing when the Red Zone warning activates and alerts are sent. Hours convert at 24 per working day (72 hours = 3 working days, 36 hours = 1.5), measured in this calendar's working hours.
                        </p>
                      </div>
                      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs self-start sm:self-auto font-mono">
                        Active: {calendar?.deadline_trigger_value ?? 72} {calendar?.deadline_trigger_unit || 'HOURS'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Threshold Value</label>
                        <Input
                          type="number"
                          min="1"
                          step="any"
                          disabled={!canEditCalendar}
                          value={calendar?.deadline_trigger_value ?? 72}
                          onChange={(e) =>
                            setCalendar({
                              ...calendar,
                              deadline_trigger_value: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="e.g. 72, 48, 10"
                          className={!canEditCalendar ? 'bg-muted/40 cursor-not-allowed' : ''}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Threshold Unit</label>
                        <select
                          disabled={!canEditCalendar}
                          value={calendar?.deadline_trigger_unit || 'HOURS'}
                          onChange={(e) =>
                            setCalendar({
                              ...calendar,
                              deadline_trigger_unit: e.target.value,
                            })
                          }
                          className={`w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                            !canEditCalendar ? 'bg-muted/40 cursor-not-allowed' : ''
                          }`}
                        >
                          <option value="HOURS">Hours (24 = 1 working day)</option>
                          <option value="DAYS">Days (Working Days)</option>
                        </select>
                      </div>
                    </div>

                    {renderPresets(DEADLINE_PRESETS, 'border-emerald-500/15')}
                  </div>

                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary" />
                          Background Evaluator Cadence (Evaluation Frequency)
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Interval at which the background daemon worker scans all active tenders, recalculates deadlines, and dispatches Red Zone email alerts.
                        </p>
                      </div>
                      <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-xs self-start sm:self-auto font-mono">
                        Every {calendar?.scheduler_interval_value ?? 10} min
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Interval (minutes)</label>
                        <Input
                          type="number"
                          min="1"
                          max="1440"
                          disabled={!canEditCalendar}
                          value={calendar?.scheduler_interval_value ?? 10}
                          onChange={(e) =>
                            setCalendar({
                              ...calendar,
                              scheduler_interval_value: parseInt(e.target.value, 10) || 1,
                            })
                          }
                          placeholder="e.g. 10, 5, 30"
                          className={!canEditCalendar ? 'bg-muted/40 cursor-not-allowed' : ''}
                        />
                      </div>
                    </div>

                    {renderPresets(INTERVAL_PRESETS, 'border-primary/15')}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">System Timezone</label>
                    <Input value={calendar?.timezone || 'Asia/Kolkata'} disabled className="bg-muted/50 cursor-not-allowed" />
                    <p className="text-[11px] text-muted-foreground">Fixed business timezone (Asia/Kolkata / IST)</p>
                  </div>
                </div>

                {canEditCalendar ? (
                  <Button
                    onClick={() => handleUpdateCalendar(calendar)}
                    disabled={saving}
                    className="w-full sm:w-auto"
                  >
                    {saving ? 'Saving...' : 'Save Schedule Settings'}
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-400">
                    <Lock className="h-4 w-4 shrink-0" />
                    <span>Working schedule settings are locked in view-only mode. Only Super Admin and Admin can update corporate operational hours.</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Info className="h-4 w-4 text-blue-500" />
                  Working Hours Logic
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs text-muted-foreground">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 leading-relaxed">
                  <p className="font-semibold text-foreground">Non-Linear Calculation:</p>
                  <p className="mt-1">
                    Deadlines are <strong>never calculated by subtracting 72 calendar hours</strong>. The engine steps backward through valid business intervals only.
                  </p>
                </div>

                <ul className="space-y-2.5">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    <span>Monday to Friday: 9 hours per day (10:00 - 06:00).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    <span>1st, 3rd, 5th Saturday: Active working days.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                    <span>2nd & 4th Saturday: Excluded as holidays.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                    <span>Sundays: Excluded as holidays.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                    <span>Government & Company Holidays: Excluded.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span>Special Working Days: Override weekly non-working days.</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Tab: Monthly Calendar ────────────────────────────────────────────── */}
      {activeTab === 'calendar' && (
        <div className="space-y-6">
          <Card className="border border-border/80 shadow-xs">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                  Monthly Working Calendar
                </CardTitle>
                <CardDescription className="text-xs">
                  Visual monthly calendar showing active working days, alternate Saturday rules, weekly offs, gazetted & company holidays, and custom date overrides. Click any date to view, add, edit, or delete events.
                </CardDescription>
              </div>

              {/* Navigation Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleToday}
                  className="h-8 text-xs font-semibold px-2.5"
                >
                  Today
                </Button>
                <div className="flex items-center rounded-lg border border-border bg-background p-0.5 shadow-2xs">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handlePrevMonth}
                    className="h-7 w-7"
                    title="Previous Month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-3 text-xs font-bold text-foreground min-w-[130px] text-center">
                    {MONTH_NAMES[calMonth]} {calYear}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleNextMonth}
                    className="h-7 w-7"
                    title="Next Month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Quick Selectors */}
                <select
                  value={calMonth}
                  onChange={(e) => setCalMonth(parseInt(e.target.value, 10))}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground cursor-pointer focus:ring-1 focus:ring-primary"
                >
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={m} value={idx}>{m}</option>
                  ))}
                </select>
                <select
                  value={calYear}
                  onChange={(e) => {
                    const y = parseInt(e.target.value, 10)
                    setCalYear(y)
                    setSelectedYear(y)
                  }}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground cursor-pointer focus:ring-1 focus:ring-primary"
                >
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>

                {canEditCalendar && (
                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => {
                      setEditingHoliday(null)
                      setHolidayForm({
                        ...EMPTY_HOLIDAY_FORM,
                        holiday_date: `${calYear}-${String(calMonth + 1).padStart(2, '0')}-01`,
                      })
                      setHolidayModalOpen(true)
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Holiday
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
              {/* Color-Coded Legend Bar */}
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground text-[11px] uppercase tracking-wider">Color Legend:</span>
                {LEGEND.map(([dot, label]) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>

              {/* Monthly Calendar Grid */}
              <div className="overflow-x-auto rounded-xl border border-border shadow-xs">
                <div className="min-w-[750px] bg-border/60">
                  {/* Day Names Header */}
                  <div className="grid grid-cols-7 gap-px bg-muted/70 text-center text-xs font-semibold">
                    {WEEKDAYS.map((day, idx) => (
                      <div
                        key={day}
                        className={`py-2 px-1 ${idx === 0
                          ? 'text-rose-600 dark:text-rose-400 bg-rose-500/5'
                          : idx === 6
                            ? 'text-amber-600 dark:text-amber-400 bg-amber-500/5'
                            : 'text-foreground'
                          }`}
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Day Cells Grid */}
                  <div className="grid grid-cols-7 gap-px bg-border/60">
                    {monthCells.map((cell, idx) => {
                      const {
                        dateStr,
                        dayNum,
                        isCurrentMonth,
                        isToday,
                        isWorkingDay,
                        dayHolidays,
                        dayExceptions,
                        dayStatus,
                      } = cell

                      return (
                        <div
                          key={`${dateStr}-${idx}`}
                          onClick={() => setSelectedDateDetail(dateStr)}
                          className={`min-h-[110px] p-2 flex flex-col justify-between transition-all cursor-pointer group relative select-none ${!isCurrentMonth
                            ? 'bg-muted/15 text-muted-foreground/30 hover:bg-muted/30'
                            : isToday
                              ? 'bg-primary/[0.04] ring-1 ring-inset ring-primary/40 hover:bg-primary/[0.08]'
                              : !isWorkingDay
                                ? 'bg-rose-500/[0.02] hover:bg-rose-500/[0.06]'
                                : 'bg-card hover:bg-muted/40'
                            }`}
                        >
                          {/* Top Row: Date Number + Mini Status Badge */}
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-xs font-semibold flex items-center justify-center ${isToday
                                ? 'w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold shadow-sm'
                                : isCurrentMonth
                                  ? 'text-foreground'
                                  : 'text-muted-foreground/40'
                                }`}
                            >
                              {dayNum}
                            </span>

                            {isCurrentMonth && (
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${dayStatus.isSpecialWork
                                  ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                                  : dayStatus.isSaturdayOff
                                    ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                                    : dayStatus.isSundayOff
                                      ? 'bg-slate-500/15 text-slate-500 border border-slate-500/20'
                                      : dayStatus.isWeekdayOff || !isWorkingDay
                                        ? 'bg-rose-500/15 text-rose-600 border border-rose-500/30'
                                        : 'bg-emerald-500/10 text-emerald-600'
                                  }`}
                              >
                                {dayStatus.badgeText}
                              </span>
                            )}
                          </div>

                          {/* Middle: Events Chips */}
                          <div className="mt-1.5 space-y-1 flex-1 overflow-hidden">
                            {dayHolidays.slice(0, 2).map((h) => {
                              const isGov = h.holiday_type === 'GOVERNMENT'
                              const isCo = h.holiday_type === 'COMPANY'
                              const isReg = h.holiday_type === 'REGIONAL'
                              const badgeColor = isGov
                                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                                : isCo
                                  ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30'
                                  : isReg
                                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                    : 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30'
                              return (
                                <div
                                  key={h.id}
                                  title={`${h.holiday_name} (${h.holiday_type})`}
                                  className={`truncate rounded px-1.5 py-0.5 text-[10px] font-medium border flex items-center gap-1 ${badgeColor}`}
                                >
                                  <span>{isGov ? '🏛️' : isCo ? '🏢' : isReg ? '🌐' : '🎈'}</span>
                                  <span className="truncate">{h.holiday_name}</span>
                                </div>
                              )
                            })}

                            {dayExceptions.map((exc) => (
                              <div
                                key={exc.id}
                                title={`Exception: ${exc.reason || exc.exception_type}`}
                                className={`truncate rounded px-1.5 py-0.5 text-[10px] font-medium border flex items-center gap-1 ${exc.exception_type === 'SPECIAL_WORKING_DAY'
                                  ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-600 border-rose-500/30'
                                  }`}
                              >
                                <span>✨</span>
                                <span className="truncate">{exc.reason || (exc.exception_type === 'SPECIAL_WORKING_DAY' ? 'Working Override' : 'Holiday Override')}</span>
                              </div>
                            ))}

                            {dayHolidays.length === 0 && dayExceptions.length === 0 && isCurrentMonth && (
                              <>
                                {dayStatus.isSaturdayOff && (
                                  <div className="truncate rounded px-1.5 py-0.5 text-[10px] text-amber-600/80 bg-amber-500/5 border border-amber-500/20 font-medium">
                                    {dayStatus.detailText}
                                  </div>
                                )}
                                {dayStatus.isSundayOff && (
                                  <div className="truncate rounded px-1.5 py-0.5 text-[10px] text-slate-500/70 bg-slate-500/5 font-medium">
                                    Sunday Off
                                  </div>
                                )}
                                {dayStatus.isWorkingSat && (
                                  <div className="truncate rounded px-1.5 py-0.5 text-[10px] text-emerald-600/80 bg-emerald-500/5 border border-emerald-500/20 font-medium">
                                    {dayStatus.detailText}
                                  </div>
                                )}
                                {dayStatus.isWeekdayOff && (
                                  <div className="truncate rounded px-1.5 py-0.5 text-[10px] text-rose-600/80 bg-rose-500/5 border border-rose-500/20 font-medium">
                                    Weekday Off
                                  </div>
                                )}
                                {dayStatus.isSundayWorking && (
                                  <div className="truncate rounded px-1.5 py-0.5 text-[10px] text-emerald-600/80 bg-emerald-500/5 border border-emerald-500/20 font-medium">
                                    Sunday (Working)
                                  </div>
                                )}
                              </>
                            )}

                            {dayHolidays.length > 2 && (
                              <span className="text-[9px] text-muted-foreground font-medium block">
                                +{dayHolidays.length - 2} more
                              </span>
                            )}
                          </div>

                          {/* Bottom Row: Hover Hint */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end text-[10px] text-primary font-medium pt-1">
                            <span className="flex items-center gap-0.5 bg-background/90 px-1 py-0.5 rounded shadow-2xs border border-border/50">
                              {canEditCalendar ? (
                                <>
                                  <Plus className="h-3 w-3" /> Click to Edit
                                </>
                              ) : (
                                <>
                                  <Info className="h-3 w-3 text-muted-foreground" /> View Details
                                </>
                              )}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab: Saturday Rules ──────────────────────────────────────────────── */}
      {canEditCalendar && activeTab === 'saturdays' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4 text-primary" />
                Monthly Saturday Dynamic Rules (Section 7, 8 & 21)
              </CardTitle>
              <CardDescription>
                By OneTrack policy, only the 2nd and 4th Saturdays of every month are holidays. The 1st, 3rd, and 5th Saturdays remain working days.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {SATURDAYS.map((s) => {
                  const sat = { ...s, isWorking: calendar?.[s.key] ?? s.defaultWorking }
                  return canEditCalendar ? (
                    <div
                      key={sat.num}
                      onClick={() =>
                        handleUpdateCalendar({ [sat.key]: !sat.isWorking })
                      }
                      className={`flex flex-col justify-between rounded-xl border p-4 shadow-sm transition-all cursor-pointer select-none group hover:shadow-xs hover:scale-[1.02] active:scale-[0.98] ${sat.isWorking
                        ? 'border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/20'
                        : 'border-rose-500/30 bg-rose-500/5'
                        }`}
                      title={`Click to toggle ${sat.title} (${sat.isWorking ? 'Working Day' : 'Holiday'})`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{sat.title}</span>
                          <span className="text-xs text-muted-foreground">Sat #{sat.num}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{sat.days}</p>
                      </div>

                      <div className="mt-6 flex items-center justify-between">
                        <Badge
                          variant="outline"
                          className={
                            sat.isWorking
                              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500 font-semibold'
                              : 'border-rose-500/50 bg-rose-500/10 text-rose-500 font-semibold'
                          }
                        >
                          {sat.isWorking ? 'WORKING DAY' : 'HOLIDAY'}
                        </Badge>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleUpdateCalendar({ [sat.key]: !sat.isWorking })
                          }}
                          className="h-7 text-xs"
                        >
                          Toggle
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={sat.num}
                      className={`flex flex-col justify-between rounded-xl border p-4 shadow-sm select-none cursor-default ${sat.isWorking
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-rose-500/20 bg-rose-500/5'
                        }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{sat.title}</span>
                          <span className="text-xs text-muted-foreground">Sat #{sat.num}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{sat.days}</p>
                      </div>

                      <div className="mt-6 flex items-center justify-between">
                        <Badge
                          variant="outline"
                          className={
                            sat.isWorking
                              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500 font-semibold'
                              : 'border-rose-500/50 bg-rose-500/10 text-rose-500 font-semibold'
                          }
                        >
                          {sat.isWorking ? 'WORKING DAY' : 'HOLIDAY'}
                        </Badge>

                        <span className="text-[10px] text-muted-foreground/60 font-medium">
                          Fixed Rule
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <p className="text-[11px] text-muted-foreground">
                {canEditCalendar ? (
                  <>⚡ Toggling any Saturday rule automatically updates all matching Saturdays across every month in the Monthly Calendar in real time.</>
                ) : (
                  <>ℹ️ Saturday rules are set by company policy. Only Super Admin and Admin can modify alternate Saturday working rules.</>
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab: Holidays & Admin Overrides ──────────────────────────────────── */}
      {activeTab === 'holidays' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-base">Internal OneTrack Holiday </CardTitle>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Year selector */}
                  <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1 text-xs">
                    {['ALL', ...YEAR_OPTIONS].map((y) => (
                      <button
                        key={y}
                        onClick={() => setSelectedYear(y)}
                        className={`rounded px-2.5 py-1 font-medium transition-colors ${selectedYear === y
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                          }`}
                      >
                        {y === 'ALL' ? 'All Years' : y}
                      </button>
                    ))}
                  </div>

                  {/* Type Filter */}
                  <select
                    value={holidayTypeFilter}
                    onChange={(e) => setHolidayTypeFilter(e.target.value)}
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                  >
                    <option value="ALL">All Types</option>
                    <option value="GOVERNMENT">Government</option>
                    <option value="COMPANY">Company</option>
                    <option value="REGIONAL">Regional</option>
                    <option value="OPTIONAL">Optional</option>
                  </select>

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search holiday..."
                      value={holidaySearch}
                      onChange={(e) => setHolidaySearch(e.target.value)}
                      className="h-8 w-44 pl-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-y border-border/80 bg-muted/40 font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Holiday Name</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Authority / Override</th>
                      {canEditCalendar && <th className="px-4 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredHolidays.length === 0 ? (
                      <tr>
                        <td colSpan={canEditCalendar ? 8 : 7} className="p-8 text-center text-muted-foreground">
                          No holidays found {selectedYear === 'ALL' ? '' : `for year ${selectedYear}`}. Use "Sync Google Holidays" or "Add Holiday" to populate.
                        </td>
                      </tr>
                    ) : (
                      filteredHolidays.map((h) => {
                        const isNonWorking = h.working_status === 'NON_WORKING'
                        return (
                          <tr key={h.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3 font-mono font-medium text-foreground">
                              {h.holiday_date}
                            </td>
                            <td className="px-4 py-3 font-semibold text-foreground">
                              {h.holiday_name}
                              {h.description && (
                                <p className="text-[11px] font-normal text-muted-foreground">{h.description}</p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="text-[10px]">
                                {h.holiday_type}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${isNonWorking
                                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-500'
                                  : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
                                  }`}
                              >
                                {h.working_status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {h.priority || 'HIGH'}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant="secondary"
                                className="text-[10px] font-normal"
                              >
                                {h.source === 'GOOGLE_CALENDAR' ? 'Google Calendar' : 'Admin'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              {h.is_admin_override ? (
                                <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/30 text-[10px]">
                                  Admin Override Protected
                                </Badge>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">Synced Default</span>
                              )}
                            </td>
                            {canEditCalendar && (
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => {
                                      setEditingHoliday(h)
                                      setHolidayForm({
                                        holiday_date: h.holiday_date,
                                        holiday_name: h.holiday_name,
                                        holiday_type: h.holiday_type,
                                        working_status: h.working_status,
                                        priority: h.priority || 'HIGH',
                                        description: h.description || '',
                                      })
                                      setHolidayModalOpen(true)
                                    }}
                                  >
                                    <Edit2 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-rose-500 hover:text-rose-600"
                                    onClick={() => handleDeleteHoliday(h.id, h.holiday_name)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab: Special Exceptions ─────────────────────────────────────────── */}
      {activeTab === 'exceptions' && (
        <div className={canEditCalendar ? 'grid grid-cols-1 gap-6 lg:grid-cols-3' : 'space-y-6'}>
          {canEditCalendar && (
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Plus className="h-4 w-4 text-primary" />
                  Declare Date Exception
                </CardTitle>
                <CardDescription>
                  Override standard weekly and Saturday rules for a specific calendar date (Section 9).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateException} className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-muted-foreground">Target Date</label>
                    <Input
                      type="date"
                      required
                      value={exceptionForm.exception_date}
                      onChange={(e) => setExceptionForm({ ...exceptionForm, exception_date: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-semibold text-muted-foreground">Exception Type</label>
                    <select
                      value={exceptionForm.exception_type}
                      onChange={(e) => setExceptionForm({ ...exceptionForm, exception_type: e.target.value })}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground"
                    >
                      <option value="SPECIAL_WORKING_DAY">SPECIAL_WORKING_DAY (Make working)</option>
                      <option value="SPECIAL_NON_WORKING_DAY">SPECIAL_NON_WORKING_DAY (Make holiday)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-semibold text-muted-foreground">Reason / Directive</label>
                    <Input
                      placeholder="e.g. Urgent tender submission drive or election day"
                      required
                      value={exceptionForm.reason}
                      onChange={(e) => setExceptionForm({ ...exceptionForm, reason: e.target.value })}
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    Create Exception
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card className={canEditCalendar ? 'lg:col-span-2' : 'w-full'}>
            <CardHeader>
              <CardTitle className="text-base">Active Date-Specific Exceptions</CardTitle>
              <CardDescription>
                Exceptions take precedence over all standard Saturday, Sunday, and weekday rules.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-y border-border/80 bg-muted/40 font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Exception Type</th>
                      <th className="px-4 py-3">Reason</th>
                      {canEditCalendar && <th className="px-4 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {exceptions.length === 0 ? (
                      <tr>
                        <td colSpan={canEditCalendar ? 4 : 3} className="p-8 text-center text-muted-foreground">
                          No special exceptions active. Standard calendar rules apply everywhere.
                        </td>
                      </tr>
                    ) : (
                      exceptions.map((exc) => (
                        <tr key={exc.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono font-medium text-foreground">
                            {exc.exception_date}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={
                                exc.exception_type === 'SPECIAL_WORKING_DAY'
                                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
                                  : 'border-rose-500/40 bg-rose-500/10 text-rose-500'
                              }
                            >
                              {exc.exception_type}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-foreground">{exc.reason}</td>
                          {canEditCalendar && (
                            <td className="px-4 py-3 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-rose-500 hover:text-rose-600"
                                onClick={() => handleDeleteException(exc.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab: Google Calendar Sync ────────────────────────────────────────── */}
      {canEditCalendar && activeTab === 'google-sync' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <RefreshCw className="h-4 w-4 text-primary" />
                    Google Calendar Integration & Synchronization
                  </CardTitle>
                  <CardDescription>
                    Google Calendar v3 API integration provides automatic national holiday data with admin override protection.
                  </CardDescription>
                </div>
                {canEditCalendar ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowGoogleConfigModal(true)}
                      className="border-border text-xs"
                    >
                      <Settings className="mr-1.5 h-3.5 w-3.5" />
                      Configure API & Feed
                    </Button>
                    <Button
                      onClick={handleTriggerGoogleSync}
                      disabled={syncing}
                      className="bg-primary hover:bg-primary/90 text-xs"
                    >
                      <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                      {syncing ? 'Synchronizing...' : 'Sync Google Holidays Now'}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 border border-border/60 px-3 py-1.5 rounded-lg">
                    <Lock className="h-3.5 w-3.5 text-amber-500" />
                    <span>View-Only (Sync managed by Admin)</span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Last Sync Result Card */}
              {lastSyncResult && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-500">
                    <CheckCircle2 className="h-4 w-4" />
                    Last Synchronization Complete
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{lastSyncResult.message}</p>
                  <div className="mt-3 flex gap-4 text-xs font-medium">
                    <span className="text-emerald-500">Imported: {lastSyncResult.imported_count || 0}</span>
                    <span className="text-blue-500">Updated: {lastSyncResult.updated_count || 0}</span>
                    <span className="text-amber-500">
                      Skipped (Admin Overrides Preserved): {lastSyncResult.skipped_count || 0}
                    </span>
                    <span className="text-rose-500">Failed: {lastSyncResult.failed_count || 0}</span>
                  </div>
                </div>
              )}

              {/* Feed configuration */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
                  <span className="text-muted-foreground">Source Feed ID</span>
                  <p className="mt-1 font-mono font-medium text-foreground truncate" title={googleConfig?.google_calendar_id || 'en.indian#holiday@group.v.calendar.google.com'}>
                    {googleConfig?.google_calendar_id || 'en.indian#holiday@group.v.calendar.google.com'}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
                  <span className="text-muted-foreground">Google Cloud API Key</span>
                  <div className="mt-1 flex items-center gap-1.5">
                    {googleConfig?.api_key_set ? (
                      <>
                        <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-500 font-mono text-[10px]">
                          <Key className="mr-1 h-2.5 w-2.5" />
                          ••••{googleConfig.api_key_hint}
                        </Badge>
                        <span className="text-[10px] text-emerald-500 font-semibold">Stored</span>
                      </>
                    ) : (
                      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-500 text-[10px]">
                        Server key (GOOGLE_CALENDAR_API_KEY) or none
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
                  <span className="text-muted-foreground">Sync Interval</span>
                  <p className="mt-1 font-medium text-foreground">
                    Every {googleConfig?.sync_interval_hours || 24} Hours (Daily)
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
                  <span className="text-muted-foreground">Last Successful Sync</span>
                  <p className="mt-1 font-medium text-foreground">
                    {googleConfig?.last_synced_at
                      ? new Date(googleConfig.last_synced_at).toLocaleString()
                      : 'Never'}
                  </p>
                </div>
              </div>

              {/* Sync History Logs */}
              <div className="space-y-3">
                <h4 className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                  Recent Synchronization Audit Logs
                </h4>
                <div className="overflow-x-auto rounded-lg border border-border/60">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 font-semibold text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5">Timestamp</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5">Imported</th>
                        <th className="px-4 py-2.5">Updated</th>
                        <th className="px-4 py-2.5">Skipped (Protected)</th>
                        <th className="px-4 py-2.5">Triggered By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {syncLogs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-muted-foreground">
                            No sync logs recorded yet.
                          </td>
                        </tr>
                      ) : (
                        syncLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-muted/20">
                            <td className="px-4 py-2.5 font-mono text-muted-foreground">
                              {new Date(log.created_at).toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge
                                variant="outline"
                                className={
                                  log.status === 'SUCCESS'
                                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
                                    : 'border-rose-500/40 bg-rose-500/10 text-rose-500'
                                }
                              >
                                {log.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-emerald-500 font-medium">+{log.imported_count}</td>
                            <td className="px-4 py-2.5 text-blue-500 font-medium">{log.updated_count}</td>
                            <td className="px-4 py-2.5 text-amber-500 font-medium">{log.skipped_count}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{log.synced_by_name || 'System / Admin'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Google Calendar API Configuration Modal */}
          {showGoogleConfigModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-border/80 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Key className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Google Calendar API Configuration</h3>
                      <p className="text-xs text-muted-foreground">Manage Google Cloud credentials & sync parameters</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowGoogleConfigModal(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <form onSubmit={handleSaveGoogleConfig} className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground flex items-center gap-1.5">
                      <Key className="h-3.5 w-3.5 text-primary" /> Google Cloud API Key
                    </label>
                    <Input
                      type="text"
                      autoComplete="off"
                      placeholder={googleConfig?.api_key_set ? `Stored key ending ${googleConfig.api_key_hint} — leave blank to keep` : 'e.g. AIzaSy...'}
                      value={googleForm.api_key}
                      onChange={(e) => setGoogleForm({ ...googleForm, api_key: e.target.value })}
                      className="font-mono text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Must have Google Calendar API enabled in Google Cloud Console. The server's GOOGLE_CALENDAR_API_KEY is used first when set.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Google Calendar Feed ID</label>
                    <Input
                      type="text"
                      placeholder="e.g. en.indian#holiday@group.v.calendar.google.com"
                      required
                      value={googleForm.google_calendar_id}
                      onChange={(e) => setGoogleForm({ ...googleForm, google_calendar_id: e.target.value })}
                      className="font-mono text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Default: Indian National Holidays (<code>en.indian#holiday@group.v.calendar.google.com</code>)
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-semibold text-foreground">Display Name</label>
                      <Input
                        type="text"
                        value={googleForm.google_calendar_name}
                        onChange={(e) => setGoogleForm({ ...googleForm, google_calendar_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-semibold text-foreground">Sync Interval (Hours)</label>
                      <Input
                        type="number"
                        min="1"
                        max="168"
                        value={googleForm.sync_interval_hours}
                        onChange={(e) => setGoogleForm({ ...googleForm, sync_interval_hours: parseInt(e.target.value, 10) || 24 })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/80">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowGoogleConfigModal(false)}
                      disabled={savingGoogleConfig}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={savingGoogleConfig}
                      className="bg-primary hover:bg-primary/90"
                    >
                      {savingGoogleConfig ? 'Saving...' : 'Save Configuration'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Add / Edit Holiday Modal ────────────────────────────────────────── */}
      {holidayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-semibold text-foreground">
                {editingHoliday ? 'Edit Holiday (Admin Override)' : 'Add New Holiday'}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setHolidayModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSaveHoliday} className="mt-4 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">Holiday Date</label>
                <Input
                  type="date"
                  required
                  disabled={!!editingHoliday}
                  value={holidayForm.holiday_date}
                  onChange={(e) => setHolidayForm({ ...holidayForm, holiday_date: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">Holiday Name</label>
                <Input
                  required
                  placeholder="e.g. Diwali, Gandhi Jayanti"
                  value={holidayForm.holiday_name}
                  onChange={(e) => setHolidayForm({ ...holidayForm, holiday_name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">Holiday Type</label>
                  <select
                    value={holidayForm.holiday_type}
                    onChange={(e) => setHolidayForm({ ...holidayForm, holiday_type: e.target.value })}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground"
                  >
                    <option value="GOVERNMENT">GOVERNMENT</option>
                    <option value="COMPANY">COMPANY</option>
                    <option value="REGIONAL">REGIONAL</option>
                    <option value="OPTIONAL">OPTIONAL</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">Working Status</label>
                  <select
                    value={holidayForm.working_status}
                    onChange={(e) => setHolidayForm({ ...holidayForm, working_status: e.target.value })}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground"
                  >
                    <option value="NON_WORKING">NON_WORKING</option>
                    <option value="WORKING">WORKING (Override)</option>
                    <option value="OPTIONAL">OPTIONAL</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">Description (Optional)</label>
                <Input
                  placeholder="Additional notes"
                  value={holidayForm.description}
                  onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
                />
              </div>

              {editingHoliday && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-500">
                  ⚠️ Saving this change marks <code className="font-mono">is_admin_override = true</code>. Future Google Calendar syncs will preserve this override and not overwrite it.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setHolidayModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingHoliday ? 'Save Override' : 'Create Holiday'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Date Event & Schedule Manager Modal (Google Calendar style) ──────── */}
      {selectedDateDetail && selectedDayInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Date Event & Schedule Manager
                </span>
                <h3 className="text-lg font-bold text-foreground mt-0.5">
                  {new Date(selectedDateDetail + 'T00:00:00').toLocaleDateString('en-IN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge
                    className={
                      selectedDayInfo.isWorkingDay
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                    }
                  >
                    {selectedDayInfo.isWorkingDay ? '✓ OPERATIONAL BUSINESS DAY' : '✗ NON-WORKING / EXCLUDED'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {selectedDayInfo.isWorkingDay
                      ? `Working hours: ${calendar?.working_start_time || '09:00'} - ${calendar?.working_end_time || '18:00'}`
                      : 'Excluded from backward deadline calculation'}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setSelectedDateDetail(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Schedule Rule Summary */}
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <span className="font-semibold text-foreground">Rule Assessment: </span>
                <span className="text-muted-foreground">{selectedDayInfo.ruleExplanation}</span>
              </div>
              {canEditCalendar && !selectedDayInfo.isWorkingDay && (selectedDayInfo.isSunday || selectedDayInfo.dayStatus.isSaturdayOff) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 shrink-0"
                  onClick={() => handleQuickConvertWeekend(selectedDateDetail)}
                  disabled={savingQuickEvent}
                >
                  <Sparkles className="h-3 w-3" />
                  Force Working Day
                </Button>
              )}
            </div>

            {/* Existing Holidays Section */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Holidays on this Date ({selectedDayInfo.dayHolidays.length})
              </h4>
              {selectedDayInfo.dayHolidays.length === 0 ? (
                <p className="text-xs text-muted-foreground italic bg-muted/20 rounded-lg p-2.5 border border-dashed border-border">
                  No holiday registered for this date.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedDayInfo.dayHolidays.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between rounded-lg border border-border/80 bg-card p-3 shadow-2xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{h.holiday_name}</span>
                          <Badge variant="outline" className="text-[10px] font-mono uppercase">
                            {h.holiday_type}
                          </Badge>
                          {h.is_admin_override && (
                            <Badge className="bg-amber-500/10 text-amber-600 text-[10px]">
                              Admin Override
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Status: <strong>{h.working_status}</strong> {h.description && `• ${h.description}`}
                        </p>
                      </div>
                      {canEditCalendar && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => {
                              setSelectedDateDetail(null)
                              setEditingHoliday(h)
                              setHolidayForm({
                                holiday_date: toIsoDateString(h.holiday_date),
                                holiday_name: h.holiday_name,
                                holiday_type: h.holiday_type || 'COMPANY',
                                working_status: h.working_status || 'NON_WORKING',
                                priority: h.priority || 'HIGH',
                                description: h.description || '',
                              })
                              setHolidayModalOpen(true)
                            }}
                          >
                            <Edit2 className="h-3 w-3" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                            onClick={() => handleDeleteHoliday(h.id, h.holiday_name)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Existing Exceptions Section */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Special Exceptions on this Date ({selectedDayInfo.dayExceptions.length})
              </h4>
              {selectedDayInfo.dayExceptions.length === 0 ? (
                <p className="text-xs text-muted-foreground italic bg-muted/20 rounded-lg p-2.5 border border-dashed border-border">
                  No special exception registered for this date.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedDayInfo.dayExceptions.map((exc) => (
                    <div
                      key={exc.id}
                      className="flex items-center justify-between rounded-lg border border-border/80 bg-card p-3 shadow-2xs"
                    >
                      <div className="space-y-1">
                        <Badge
                          className={
                            exc.exception_type === 'SPECIAL_WORKING_DAY'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                          }
                        >
                          {exc.exception_type === 'SPECIAL_WORKING_DAY' ? '✨ SPECIAL WORKING DAY' : '✗ SPECIAL HOLIDAY'}
                        </Badge>
                        <p className="text-xs text-foreground font-medium">
                          Reason: {exc.reason || 'None specified'}
                        </p>
                      </div>
                      {canEditCalendar && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                          onClick={() => handleDeleteException(exc.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Add Form Section */}
            {canEditCalendar ? (
              <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Add Event to {selectedDateDetail}
                  </span>
                  <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setQuickAddTab('HOLIDAY')}
                      className={`px-2.5 py-1 rounded font-medium transition-colors ${quickAddTab === 'HOLIDAY'
                        ? 'bg-primary text-primary-foreground shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      + Holiday
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickAddTab('EXCEPTION')}
                      className={`px-2.5 py-1 rounded font-medium transition-colors ${quickAddTab === 'EXCEPTION'
                        ? 'bg-primary text-primary-foreground shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      + Special Exception
                    </button>
                  </div>
                </div>

                {quickAddTab === 'HOLIDAY' ? (
                  <form onSubmit={handleCreateHolidayQuick} className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="font-semibold text-muted-foreground">Holiday Name</label>
                        <Input
                          required
                          placeholder="e.g. Diwali, Company Day"
                          value={quickHolidayName}
                          onChange={(e) => setQuickHolidayName(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-muted-foreground">Holiday Type</label>
                        <select
                          value={quickHolidayType}
                          onChange={(e) => setQuickHolidayType(e.target.value)}
                          className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground cursor-pointer"
                        >
                          <option value="COMPANY">COMPANY</option>
                          <option value="GOVERNMENT">GOVERNMENT</option>
                          <option value="REGIONAL">REGIONAL</option>
                          <option value="OPTIONAL">OPTIONAL</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="font-semibold text-muted-foreground">Working Status</label>
                        <select
                          value={quickHolidayStatus}
                          onChange={(e) => setQuickHolidayStatus(e.target.value)}
                          className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground cursor-pointer"
                        >
                          <option value="NON_WORKING">NON_WORKING (Office Closed)</option>
                          <option value="WORKING">WORKING (Office Open)</option>
                          <option value="OPTIONAL">OPTIONAL</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-muted-foreground">Description (Optional)</label>
                        <Input
                          placeholder="Notes or details"
                          value={quickHolidayDesc}
                          onChange={(e) => setQuickHolidayDesc(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        type="submit"
                        disabled={savingQuickEvent || !quickHolidayName.trim()}
                        className="h-8 text-xs gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {savingQuickEvent ? 'Saving...' : 'Add Holiday to this Date'}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleCreateExceptionQuick} className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="font-semibold text-muted-foreground">Exception Type</label>
                        <select
                          value={quickExceptionType}
                          onChange={(e) => setQuickExceptionType(e.target.value)}
                          className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground cursor-pointer"
                        >
                          <option value="SPECIAL_WORKING_DAY">SPECIAL_WORKING_DAY (Force Office Open)</option>
                          <option value="SPECIAL_HOLIDAY">SPECIAL_HOLIDAY (Force Office Closed)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-muted-foreground">Reason / Note</label>
                        <Input
                          required
                          placeholder="e.g. Year-end sprint, Election day"
                          value={quickExceptionReason}
                          onChange={(e) => setQuickExceptionReason(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        type="submit"
                        disabled={savingQuickEvent}
                        className="h-8 text-xs gap-1.5"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        {savingQuickEvent ? 'Saving...' : 'Save Special Exception'}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-3.5 text-xs text-muted-foreground">
                <Lock className="h-4 w-4 text-amber-500 shrink-0" />
                <span>You are viewing date details in read-only mode. Adding holidays, exceptions, or overriding calendar rules requires Super Admin or Admin role.</span>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setSelectedDateDetail(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
