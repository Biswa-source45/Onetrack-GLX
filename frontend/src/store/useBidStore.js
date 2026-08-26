import { create } from 'zustand'
import { listBids } from '../services/bids'
import { listUsers } from '../services/users'
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
  // Management-only cross-filter: view another user's tenders without
  // switching the route-driven "Owned Tenders" scope (see setScope above).
  ownerFilterId: '',

  // Cache users in store to prevent multiple separate API requests
  users: [],
  usersLoading: false,

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

  loadBids: async (overrideOwnerId) => {
    const { page, debouncedSearch, stageFilter, statusFilter, inBin, bidOwnerId, scope, endDateFilter, ownerFilterId } = get()
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
    set({ loading: true, error: null })
    try {
      const res = await listBids({
        page,
        limit: 20,
        search: debouncedSearch,
        workflow_stage: stageFilter,
        bid_status: statusFilter,
        bid_owner_id: (scope === 'owned' || finalOwnerId) ? finalOwnerId : undefined,
        closing_after,
        closing_before,
        in_bin: inBin,
      })
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
      set({ error: 'Network error occurred while fetching tenders' })
    } finally {
      set({ loading: false })
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
  }
}))
