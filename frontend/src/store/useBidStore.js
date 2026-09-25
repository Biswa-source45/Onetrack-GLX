import { create } from 'zustand'
import { listBids, listFieldSuggestions } from '../services/bids'
import { listUsers, getStageRestrictions } from '../services/users'
import { getSystemConfigs } from '../services/systemConfig'
import { tokenStorage } from '../services/auth'

// Resolves a quick end-date filter key ('today' | 'week' | 'month') into a
// closing_after/closing_before ISO range for the bids list API. 'week' is
// Monday-Sunday of the current calendar week; 'month' is the current calendar month.
function computeEndDateRange(filterKey) {
  if (!filterKey) return { closing_after: undefined, closing_before: undefined }
  const now = new Date()
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
  const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }

  if (filterKey === 'today') {
    return { closing_after: startOfDay(now).toISOString(), closing_before: endOfDay(now).toISOString() }
  }
  if (filterKey === 'week') {
    const day = now.getDay() // 0 = Sunday .. 6 = Saturday
    const diffToMonday = day === 0 ? -6 : 1 - day
    const monday = startOfDay(now)
    monday.setDate(monday.getDate() + diffToMonday)
    const sunday = endOfDay(monday)
    sunday.setDate(monday.getDate() + 6)
    return { closing_after: monday.toISOString(), closing_before: sunday.toISOString() }
  }
  if (filterKey === 'month') {
    const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1))
    const to = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    return { closing_after: from.toISOString(), closing_before: to.toISOString() }
  }
  return { closing_after: undefined, closing_before: undefined }
}

export const useBidStore = create((set, get) => ({
  bids: [],
  meta: {},
  loading: false,
  error: null,
  page: 1,
  stageFilter: '',
  statusFilter: '',
  bidOwnerId: '',
  scope: 'all',
  inBin: false,
  searchInput: '',
  debouncedSearch: '',
  viewMode: 'cards',
  // Quick end-date filter: '' | 'today' | 'week' | 'month'
  endDateFilter: '',
  // Tender source / portal source filter: '' | 'GeM' | 'Private' | 'RTC' | 'CPPP' | 'eProcure' | 'Others'
  portalSourceFilter: '',
  // Management-only cross-filter: view another user's tenders without
  // switching the route-driven "Owned Tenders" scope (see setScope above).
  ownerFilterId: '',

  // Cache users in store to prevent multiple separate API requests
  users: [],
  usersLoading: false,

  // Field Memory — one suggestion list per field key ("organization_name",
  // "oem", ...), fetched once and cached; components filter it client-side
  // on every keystroke instead of hitting the network per character typed.
  fieldSuggestions: {},
  fieldSuggestionsLoading: {},

  // Stage-Level Access Control — the logged-in user's own restricted stage
  // keys (empty = full access), fetched once and cached so every tender's
  // DynamicStageWorkspace doesn't refetch it per stage tab click.
  restrictedStages: [],
  restrictedStagesLoaded: false,

  setScope: (scope, ownerId = '') => {
    const finalOwnerId = scope === 'owned' ? (ownerId || tokenStorage.getUser()?.id || '') : ''
    set({ scope, bidOwnerId: finalOwnerId, page: 1 })
    get().loadBids(finalOwnerId)
  },

  setBidOwnerId: (bidOwnerId) => {
    set({ bidOwnerId, page: 1 })
    get().loadBids()
  },

  setPage: (page) => {
    set({ page })
    get().loadBids()
  },

  setStageFilter: (stageFilter) => {
    set({ stageFilter, page: 1 })
    get().loadBids()
  },

  setStatusFilter: (statusFilter) => {
    set({ statusFilter, page: 1 })
    get().loadBids()
  },

  setPortalSourceFilter: (portalSourceFilter) => {
    set({ portalSourceFilter, page: 1 })
    get().loadBids()
  },

  setInBin: (inBin) => {
    set({ inBin, page: 1 })
    get().loadBids()
  },

  setEndDateFilter: (endDateFilter) => {
    set({ endDateFilter, page: 1 })
    get().loadBids()
  },

  setOwnerFilterId: (ownerFilterId) => {
    set({ ownerFilterId, page: 1 })
    get().loadBids()
  },

  setSearchInput: (searchInput) => set({ searchInput }),

  setDebouncedSearch: (debouncedSearch) => {
    set({ debouncedSearch, page: 1 })
    get().loadBids()
  },

  setViewMode: (viewMode) => set({ viewMode }),

  // Bumped on every loadBids call so an in-flight request can tell, once it
  // resolves, whether a newer filter change has already superseded it — two
  // filter clicks in quick succession (e.g. Owner, then End Date) fire two
  // requests, and without this guard whichever response lands *second*
  // overwrites the list even if it was answering the *older* query.
  _requestSeq: 0,

  // The listBids filter params for the current filter state, minus paging.
  // Shared by loadBids and the Tenders page's Excel export so an export always
  // matches exactly what the list is showing.
  getListParams: (overrideOwnerId) => {
    const { debouncedSearch, stageFilter, statusFilter, portalSourceFilter, inBin, bidOwnerId, scope, endDateFilter, ownerFilterId } = get()
    let finalOwnerId = overrideOwnerId !== undefined ? overrideOwnerId : bidOwnerId
    if (scope === 'owned' && !finalOwnerId) {
      finalOwnerId = tokenStorage.getUser()?.id || ''
    }
    // ownerFilterId (management-only "Owner" cross-filter on the All Tenders
    // view) takes precedence over the route-driven owned/all scope above.
    if (ownerFilterId) {
      finalOwnerId = ownerFilterId
    }
    const { closing_after, closing_before } = computeEndDateRange(endDateFilter)
    return {
      search: debouncedSearch,
      workflow_stage: stageFilter,
      bid_status: statusFilter,
      portal_source: portalSourceFilter || undefined,
      bid_owner_id: (scope === 'owned' || finalOwnerId) ? finalOwnerId : undefined,
      closing_after,
      closing_before,
      in_bin: inBin,
    }
  },

  loadBids: async (overrideOwnerId) => {
    const params = get().getListParams(overrideOwnerId)
    const requestId = get()._requestSeq + 1
    set({ loading: true, error: null, _requestSeq: requestId })
    try {
      const res = await listBids({ ...params, page: get().page, limit: 20 })
      if (get()._requestSeq !== requestId) return // superseded by a newer filter change
      if (res.ok) {
        const bids = Array.isArray(res.data) ? res.data : (res.data?.bids || [])
        set({
          bids,
          meta: res.meta || {},
          error: null,
        })
      } else {
        set({ error: res.error?.message ?? 'Failed to retrieve tenders' })
      }
    } catch (err) {
      if (get()._requestSeq !== requestId) return
      set({ error: 'Network error occurred while fetching tenders' })
    } finally {
      if (get()._requestSeq === requestId) set({ loading: false })
    }
  },

  // Optimistically update a single bid in the list without a refetch
  updateBidInList: (bidId, patch) => {
    const { bids } = get()
    set({ bids: bids.map(b => b.id === bidId ? { ...b, ...patch } : b) })
  },

  loadUsers: async (force = false) => {
    const { users, usersLoading } = get()
    if (usersLoading) return
    if (users.length > 0 && !force) return // already loaded

    set({ usersLoading: true })
    try {
      const res = await listUsers({ limit: 100 })
      if (res.ok) {
        const arr = Array.isArray(res.data?.users) ? res.data.users : []
        set({ users: arr })
      }
    } catch (err) {
      console.error('Failed to load users in Zustand store', err)
    } finally {
      set({ usersLoading: false })
    }
  },

  loadFieldSuggestions: async (fieldKey, force = false) => {
    if (!fieldKey) return
    const { fieldSuggestions, fieldSuggestionsLoading } = get()
    if (fieldSuggestionsLoading[fieldKey]) return
    if (fieldSuggestions[fieldKey] && !force) return // already loaded

    set({ fieldSuggestionsLoading: { ...get().fieldSuggestionsLoading, [fieldKey]: true } })
    try {
      const res = await listFieldSuggestions(fieldKey)
      const arr = res.ok && Array.isArray(res.data) ? res.data : []
      set({ fieldSuggestions: { ...get().fieldSuggestions, [fieldKey]: arr } })
    } catch (err) {
      console.error(`Failed to load field suggestions for "${fieldKey}"`, err)
    } finally {
      set({ fieldSuggestionsLoading: { ...get().fieldSuggestionsLoading, [fieldKey]: false } })
    }
  },

  // Optimistically add a freshly-typed value to a field's cached suggestion
  // list so it appears on the very next tender's form without waiting for a
  // refetch — the same value the backend is in the middle of recording.
  learnFieldValue: (fieldKey, rawValue) => {
    const value = (rawValue || '').trim()
    if (!fieldKey || value.length < 2) return
    const { fieldSuggestions } = get()
    const list = fieldSuggestions[fieldKey] || []
    const existing = list.find((s) => s.value.toLowerCase() === value.toLowerCase())
    const next = existing
      ? list.map((s) => (s === existing ? { ...s, value, usage_count: s.usage_count + 1 } : s))
      : [...list, { value, usage_count: 1 }]
    set({ fieldSuggestions: { ...fieldSuggestions, [fieldKey]: next } })
  },

  loadRestrictedStages: async (force = false) => {
    const { restrictedStagesLoaded } = get()
    if (restrictedStagesLoaded && !force) return
    const userId = tokenStorage.getUser()?.id
    if (!userId) return
    try {
      const res = await getStageRestrictions(userId)
      const stages = res.ok && res.data ? (res.data.restricted_stages || []) : []
      set({ restrictedStages: stages, restrictedStagesLoaded: true })
    } catch (err) {
      console.error('Failed to load stage restrictions', err)
    }
  },

  // Dynamic system configurations (e.g. stage2_require_am_presales)
  systemConfigs: { stage2_require_am_presales: true, pricing_suggestion_window: 5 },
  systemConfigsLoaded: false,

  loadSystemConfigs: async (force = false) => {
    const { systemConfigsLoaded } = get()
    if (systemConfigsLoaded && !force) return
    try {
      const res = await getSystemConfigs()
      if (res.ok && res.data) {
        set({ systemConfigs: { ...get().systemConfigs, ...res.data }, systemConfigsLoaded: true })
      }
    } catch (err) {
      console.error('Failed to load system configs', err)
    }
  },

  setSystemConfigLocal: (key, value) => {
    const { systemConfigs } = get()
    set({ systemConfigs: { ...systemConfigs, [key]: value } })
  },
}))

if (typeof window !== 'undefined') {
  window.addEventListener('onetrack_config_updated', (e) => {
    if (e.detail?.key !== undefined) {
      useBidStore.getState().setSystemConfigLocal(e.detail.key, e.detail.value)
    }
  })
}
