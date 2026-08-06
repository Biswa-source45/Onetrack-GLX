import { create } from 'zustand'
import { listBids } from '../services/bids'
import { listUsers } from '../services/users'

export const useBidStore = create((set, get) => ({
  bids: [],
  meta: {},
  loading: false,
  error: null,
  page: 1,
  stageFilter: '',
  statusFilter: '',
  inBin: false,
  searchInput: '',
  debouncedSearch: '',
  viewMode: 'cards',

  // Cache users in store to prevent multiple separate API requests
  users: [],
  usersLoading: false,

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

  setSearchInput: (searchInput) => set({ searchInput }),

  setDebouncedSearch: (debouncedSearch) => {
    set({ debouncedSearch, page: 1 })
    get().loadBids()
  },

  setViewMode: (viewMode) => set({ viewMode }),

  loadBids: async () => {
    const { page, debouncedSearch, stageFilter, statusFilter, inBin } = get()
    set({ loading: true, error: null })
    try {
      const res = await listBids({
        page,
        limit: 20,
        search: debouncedSearch,
        workflow_stage: stageFilter,
        bid_status: statusFilter,
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
