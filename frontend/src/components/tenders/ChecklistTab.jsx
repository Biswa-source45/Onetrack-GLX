import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GripVertical, Trash2, Plus, Calendar, User,
  AlertTriangle, Loader2, CheckSquare, ListTodo, Check,
  Edit2, X, Award, Building2
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { tokenStorage } from '../../services/auth'
import {
  getChecklists,
  toggleChecklist,
  addChecklist,
  deleteChecklist,
  reorderChecklists,
  updateChecklist,
  updateBid
} from '../../services/bids'
import { logStageMicroEvent } from '../../services/auditLogger'

// Cycled by OEM index so each OEM reads as a consistent color across every
// checklist row it appears on, without needing to store a color per OEM.
const OEM_PILL_COLORS = [
  'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
  'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800',
  'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
  'bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800',
  'bg-lime-100 text-lime-700 border-lime-300 dark:bg-lime-950/60 dark:text-lime-300 dark:border-lime-800',
]

export function ChecklistTab({ bid, onRefresh }) {
  const bidId = bid.id
  const currentUser = tokenStorage.getUser()
  const isLocked = ['ARCHIVED', 'CANCELLED', 'WON', 'LOST'].includes(bid.bid_status)

  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [newBidderTitle, setNewBidderTitle] = useState('')
  const [newOemTitle, setNewOemTitle] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [draggedId, setDraggedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [oemPickerItem, setOemPickerItem] = useState(null)
  const [oemPickerSelected, setOemPickerSelected] = useState({})

  const oemList = Array.isArray(bid.oem_workspace) ? bid.oem_workspace
    : (bid.oem_workspace && Array.isArray(bid.oem_workspace.oems) ? bid.oem_workspace.oems : [])

  // An OEM document checklist item — MAF included. MAF's per-OEM receipt
  // status lives in the matrix row's legacy top-level `maf` field rather
  // than `docStatus` (which only exists for documents added after multi-OEM
  // tracking did), so it needs its own read/write instead of going through
  // `docStatus` like every other OEM document.
  const isOemDocItem = (item) => item.checklist_group === 'OEM' || item.title.startsWith('[OEM]')
  const isMafItem = (item) => /\bmaf\b/i.test(item.title)
  const readOemDoc = (o, item) => isMafItem(item) ? o.maf === 'RECEIVED' : (o.docStatus || {})[item.id] === 'RECEIVED'
  const writeOemDoc = (o, item, received) => isMafItem(item)
    ? { ...o, maf: received ? 'RECEIVED' : 'NOT RECEIVED' }
    : { ...o, docStatus: { ...(o.docStatus || {}), [item.id]: received ? 'RECEIVED' : 'NOT RECEIVED' } }

  // 1. Log checklist events to local stage history with username fallback
  function logChecklistHistory(actionText) {
    logStageMicroEvent(bidId, {
      fromStage: 'DOCUMENT_CHECKLIST_PREPARATION',
      toStage: 'CHECKLIST_UPDATE',
      eventType: 'CHECKLIST',
      transitionReason: actionText
    })
    if (onRefresh) onRefresh()
  }

  // 2. Fetch backend checklist items
  const loadChecklist = async () => {
    setLoading(true)
    try {
      const res = await getChecklists(bidId)
      if (res.ok && Array.isArray(res.data)) {
        setItems(res.data)
      } else {
        setItems([])
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to load checklist items')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadChecklist()
  }, [bidId])

  // 3. Handle toggling (mark done / re-open)
  const handleToggle = async (item) => {
    if (isLocked) return

    // Bidirectional sync with the OEM Authorization Matrix: this item's
    // per-OEM status (MAF included — it reads/writes through the matrix's
    // legacy `maf` field via readOemDoc/writeOemDoc above) reflects
    // RECEIVED/NOT RECEIVED per OEM row. With 2+ OEMs tracked, a single
    // checkbox can't honestly represent "received" for all of them at once
    // — a document arriving from one OEM doesn't mean it arrived from the
    // others — so that case opens a picker instead of applying a blanket
    // update. The reverse direction (matrix -> checklist) lives in
    // Stage3Workspace's Save Matrix, and uses the same "all OEMs RECEIVED" rule.
    const isOemItem = isOemDocItem(item)
    if (isOemItem && oemList.length > 1) {
      const seed = {}
      oemList.forEach(o => { seed[o.id] = readOemDoc(o, item) })
      setOemPickerSelected(seed)
      setOemPickerItem(item)
      return
    }
    // A document can't have arrived from an OEM whose authorization process
    // was never started — block the single-OEM fast path the same way the
    // picker blocks individual non-initiated rows below.
    if (isOemItem && oemList.length === 1 && oemList[0].initiated !== 'YES') {
      toast.error(`"${oemList[0].name}" has not been initiated yet — initiate it in the OEM Authorization stage first.`)
      return
    }

    const targetState = !item.is_done
    try {
      const res = await toggleChecklist(bidId, item.id, targetState)
      if (!res.ok) {
        toast.error(res.error?.message ?? 'Failed to update checklist item')
        return
      }

      const cleanTitle = item.title.replace(/^\[(Bidder|OEM)\]\s*/i, '')
      if (targetState) {
        toast.success(`Completed checklist item: "${cleanTitle}"`)
        logChecklistHistory(`Verified & completed checklist item: "${cleanTitle}"`)
      } else {
        toast.info(`Re-opened checklist item: "${cleanTitle}"`)
        logChecklistHistory(`Re-opened checklist item for review: "${cleanTitle}"`)
      }

      if (isOemItem && oemList.length === 1) {
        const nextOems = oemList.map(o => writeOemDoc(o, item, targetState))
        updateBid(bidId, { oem_workspace: JSON.stringify(nextOems) }).catch(() => {})
      }

      loadChecklist()
    } catch {
      toast.error('Network error during checklist update')
    }
  }

  // Confirm the per-OEM picker: apply the chosen RECEIVED/NOT RECEIVED state
  // to only the OEMs it actually applies to, then derive the checklist
  // item's own done state from whether every tracked OEM is now RECEIVED —
  // matching the same rule Stage3Workspace's Save Matrix uses.
  const handleOemPickerConfirm = async () => {
    const item = oemPickerItem
    if (!item) return
    // Defensive re-check: a non-initiated OEM's checkbox is disabled in the
    // picker UI, but never trust the client state alone for what gets
    // persisted as RECEIVED.
    const nextOems = oemList.map(o => writeOemDoc(o, item, o.initiated === 'YES' && !!oemPickerSelected[o.id]))
    const shouldBeDone = nextOems.length > 0 && nextOems.every(o => readOemDoc(o, item))

    try {
      await updateBid(bidId, { oem_workspace: JSON.stringify(nextOems) })
      const res = await toggleChecklist(bidId, item.id, shouldBeDone)
      if (!res.ok) {
        toast.error(res.error?.message ?? 'Failed to update checklist item')
        return
      }
      const cleanTitle = item.title.replace(/^\[(Bidder|OEM)\]\s*/i, '')
      const receivedNames = nextOems.filter(o => readOemDoc(o, item)).map(o => o.name)
      logChecklistHistory(
        shouldBeDone
          ? `Verified & completed checklist item: "${cleanTitle}" (received from: ${receivedNames.join(', ') || 'none'})`
          : `Updated OEM receipt status for checklist item: "${cleanTitle}" (received from: ${receivedNames.join(', ') || 'none'})`
      )
      toast.success(shouldBeDone ? `Completed checklist item: "${cleanTitle}"` : 'OEM receipt status updated')
      setOemPickerItem(null)
      loadChecklist()
    } catch {
      toast.error('Network error during checklist update')
    }
  }

  // 4. Handle adding custom checklist items using backend POST
  const handleAddItem = async (e, type) => {
    if (e) e.preventDefault()
    if (isLocked) return

    const titleVal = type === 'OEM' ? newOemTitle : newBidderTitle
    if (!titleVal.trim()) return

    const prefix = type === 'OEM' ? '[OEM] ' : '[Bidder] '
    const fullTitle = prefix + titleVal.trim().replace(/^\[(Bidder|OEM)\]\s*/i, '')

    try {
      const res = await addChecklist(bidId, fullTitle, items.length)
      if (!res.ok) {
        toast.error(res.error?.message ?? 'Failed to create checklist item')
        return
      }

      toast.success(`${type} checklist item added`)
      logChecklistHistory(`Created ${type.toLowerCase()} checklist item: "${titleVal.trim()}"`)
      if (type === 'OEM') {
        setNewOemTitle('')
      } else {
        setNewBidderTitle('')
      }
      loadChecklist()
    } catch (err) {
      toast.error('Failed to create checklist item')
    }
  }

  // 5. Handle deletion of checklist items using backend DELETE
  const handleDeleteItem = async () => {
    if (isLocked) return
    const targetItem = items.find(i => i.id === confirmDeleteId)
    if (!targetItem) return

    const cleanTitle = targetItem.title.replace(/^\[(Bidder|OEM)\]\s*/i, '')

    try {
      const res = await deleteChecklist(bidId, confirmDeleteId)
      if (!res.ok) {
        toast.error(res.error?.message ?? 'Failed to delete checklist item')
        return
      }

      toast.success(`Deleted checklist item: "${cleanTitle}"`)
      logChecklistHistory(`Deleted checklist item: "${cleanTitle}"`)
      setConfirmDeleteId(null)
      loadChecklist()
    } catch (err) {
      toast.error('Failed to delete checklist item')
    }
  }

  // 5.5 Handle inline editing/rename of checklist items using backend PUT
  const handleSaveEdit = async (item) => {
    if (isLocked) return
    if (!editTitle.trim()) return

    const isOem = item.title.startsWith('[OEM]')
    const prefix = isOem ? '[OEM] ' : '[Bidder] '
    const fullNewTitle = prefix + editTitle.trim().replace(/^\[(Bidder|OEM)\]\s*/i, '')

    if (fullNewTitle === item.title) {
      setEditingId(null)
      return
    }

    try {
      const res = await updateChecklist(bidId, item.id, { title: fullNewTitle })
      if (!res.ok) {
        toast.error(res.error?.message ?? 'Failed to update checklist item')
        return
      }

      const cleanOld = item.title.replace(/^\[(Bidder|OEM)\]\s*/i, '')
      toast.success('Checklist item updated')
      logChecklistHistory(`Renamed checklist item "${cleanOld}" to "${editTitle.trim()}"`)
      setEditingId(null)
      loadChecklist()
    } catch (err) {
      toast.error('Failed to update checklist item')
    }
  }

  // 6. Drag and drop reordering handlers
  const handleDragStart = (e, id) => {
    if (isLocked) {
      e.preventDefault()
      return
    }
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragEnter = (targetId) => {
    if (!draggedId || draggedId === targetId) return

    const draggedItem = items.find(item => item.id === draggedId)
    const targetItem = items.find(item => item.id === targetId)
    if (!draggedItem || !targetItem) return

    const isDraggedOem = draggedItem.title.startsWith('[OEM]')
    const isTargetOem = targetItem.title.startsWith('[OEM]')
    if (isDraggedOem !== isTargetOem) return

    const bidderItems = items.filter(item => !item.title.startsWith('[OEM]'))
    const oemItems = items.filter(item => item.title.startsWith('[OEM]'))

    const targetList = isDraggedOem ? oemItems : bidderItems
    const draggedIndex = targetList.findIndex(item => item.id === draggedId)
    const targetIndex = targetList.findIndex(item => item.id === targetId)
    if (draggedIndex === -1 || targetIndex === -1) return

    const updatedList = [...targetList]
    const [itemToMove] = updatedList.splice(draggedIndex, 1)
    updatedList.splice(targetIndex, 0, itemToMove)

    const otherList = isDraggedOem ? bidderItems : oemItems
    const merged = isDraggedOem ? [...otherList, ...updatedList] : [...updatedList, ...otherList]
    
    setItems(merged)
  }

  const handleDragEnd = async () => {
    setDraggedId(null)
    const payloadItems = items.map((item, idx) => ({
      id: item.id,
      sort_order: idx
    }))
    try {
      const res = await reorderChecklists(bidId, payloadItems)
      if (!res.ok) {
        toast.error('Failed to save checklist reorder')
      }
    } catch {
      toast.error('Failed to reorder checklist items')
    }
  }

  // Calculate statistics
  const totalCount = items.length
  const doneCount = items.filter(i => i.is_done).length
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  // Filter items
  const bidderItems = items.filter(item => !item.title.startsWith('[OEM]') && item.checklist_group !== 'OEM')
  const oemItems = items.filter(item => item.title.startsWith('[OEM]') || item.checklist_group === 'OEM')

  const renderItem = (item) => {
    const isItemDragged = item.id === draggedId
    const cleanTitle = item.title.replace(/^\[(Bidder|OEM)\]\s*/i, '')
    const isOemItem = isOemDocItem(item)
    const showOemPills = isOemItem && oemList.length > 1

    return (
      <motion.div
        key={item.id}
        layout
        transition={{ type: 'spring', stiffness: 520, damping: 32 }}
        draggable={!isLocked}
        onDragStart={(e) => handleDragStart(e, item.id)}
        onDragEnter={() => handleDragEnter(item.id)}
        onDragOver={(e) => e.preventDefault()}
        onDragEnd={handleDragEnd}
        className={`flex items-start justify-between p-3 border rounded-xl transition-all relative group
          ${isItemDragged ? 'opacity-40 border-primary/40 bg-primary/5 shadow-inner' : 'bg-card border-border hover:border-primary/20 shadow-sm'}
          ${item.is_done ? 'bg-emerald-500/5 border-emerald-500/20' : ''}`}
      >
        <div className="flex items-start gap-2.5 flex-1 min-w-0 pr-2">
          {/* Drag handle */}
          {!isLocked && (
            <div className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors pt-0.5 shrink-0">
              <GripVertical className="size-3.5" />
            </div>
          )}

          {/* Custom checkbox */}
          <div className="pt-0.5 shrink-0">
            <button
              type="button"
              disabled={isLocked}
              onClick={() => handleToggle(item)}
              className={`size-4.5 rounded border flex items-center justify-center transition-all cursor-pointer
                ${item.is_done
                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs scale-100'
                  : isLocked
                    ? 'bg-muted border-border cursor-not-allowed'
                    : 'border-muted-foreground/40 hover:border-primary bg-background text-transparent hover:text-primary/40'}`}
              title={item.is_done ? "Click to re-open for review" : "Click to mark complete"}
            >
              {item.is_done && <Check className="size-3 stroke-[3]" />}
            </button>
          </div>

          {/* Content */}
          <div className="space-y-1 flex-1 min-w-0">
            {editingId === item.id ? (
              <div className="flex items-center gap-1.5 w-full">
                <Input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="flex-1 h-8 text-xs bg-background"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit(item)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 text-emerald-600 hover:bg-emerald-50 shrink-0"
                  onClick={() => handleSaveEdit(item)}
                >
                  <Check className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 text-muted-foreground hover:bg-muted shrink-0"
                  onClick={() => setEditingId(null)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <>
                <span className={`text-xs font-semibold block leading-tight break-words text-foreground
                  ${item.is_done ? 'line-through text-muted-foreground/75 font-normal' : ''}`}>
                  {cleanTitle}
                </span>

                {/* Creation & Completion Info */}
                <div className="flex items-center gap-2 text-[9px] text-muted-foreground mt-1 flex-wrap">
                  <span className="flex items-center gap-1 font-medium bg-muted/40 px-1 py-0.5 rounded">
                    <Calendar className="size-2" />
                    {new Date(item.created_at || Date.now()).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                  
                  {item.is_done && (
                    <span className="flex items-center gap-1 text-emerald-600 font-medium bg-emerald-50 px-1 py-0.5 rounded">
                      <User className="size-2" />
                      {item.done_by?.full_name || item.done_by?.username || 'System'}
                      {item.done_at && ` at ${new Date(item.done_at).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}`}
                    </span>
                  )}
                </div>

                {/* Per-OEM receipt status — visible even while the item is
                    still incomplete, so it's clear which OEM(s) are already
                    in and which are still pending. */}
                {showOemPills && (
                  <div className="flex items-center gap-1 flex-wrap mt-1.5">
                    {oemList.map((o, i) => {
                      const received = readOemDoc(o, item)
                      const color = OEM_PILL_COLORS[i % OEM_PILL_COLORS.length]
                      return (
                        <span
                          key={o.id}
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${received ? color : 'bg-muted/50 text-muted-foreground border-border/60'}`}
                          title={received ? `Received from ${o.name}` : `Not yet received from ${o.name}`}
                        >
                          {o.name}{received ? ' ✓' : ''}
                        </span>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Action buttons - always visible */}
        {!isLocked && (
          <div className="shrink-0 flex items-center gap-1 text-muted-foreground">
            {editingId !== item.id && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(item.id)
                  setEditTitle(cleanTitle)
                }}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Edit requirement title"
              >
                <Edit2 className="size-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmDeleteId(item.id)}
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Delete requirement"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </motion.div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Stat Banner */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3 relative overflow-hidden">
        <div className="absolute right-0 top-0 size-24 bg-primary/5 rounded-full blur-2xl -mr-6 -mt-6" />
        <div className="flex items-center justify-between gap-4 flex-wrap relative z-10">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ListTodo className="size-4 text-primary" /> Checklist Lifecycle Progress
            </h3>
            <p className="text-xs text-muted-foreground">
              {doneCount} of {totalCount} items completed. Items can be added, edited, re-opened, or deleted anytime.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <span className="text-2xl font-bold text-primary">{pct}%</span>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Completed</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-primary to-teal-500 rounded-full"
          />
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Loader2 className="size-6 animate-spin text-primary" />
          <span className="text-xs">Fetching latest checklist items...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Bidder Docs */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <div className="flex items-center gap-2">
                <Award className="size-4 text-primary" />
                <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Bidder Docs</h4>
              </div>
              <span className="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-bold">
                {bidderItems.filter(i => i.is_done).length} / {bidderItems.length}
              </span>
            </div>

            {/* Add Bidder Item */}
            {!isLocked && (
              <form onSubmit={(e) => handleAddItem(e, 'Bidder')} className="flex gap-2">
                <Input
                  value={newBidderTitle}
                  onChange={e => setNewBidderTitle(e.target.value)}
                  placeholder="Add custom Bidder doc..."
                  className="flex-1 h-9 text-xs bg-background"
                />
                <Button type="submit" size="sm" className="h-9 px-3">
                  <Plus className="size-4" />
                </Button>
              </form>
            )}

            {/* Bidder Items List */}
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {bidderItems.map(item => renderItem(item))}
              </AnimatePresence>
              {bidderItems.length === 0 && (
                <div className="text-center py-10 border border-dashed border-border rounded-xl bg-muted/5">
                  <p className="text-xs text-muted-foreground">No Bidder docs defined.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: OEM Docs */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-violet-500" />
                <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">OEM Docs</h4>
              </div>
              <span className="text-xs bg-violet-100 text-violet-700 px-2.5 py-0.5 rounded-full font-bold">
                {oemItems.filter(i => i.is_done).length} / {oemItems.length}
              </span>
            </div>

            {/* Add OEM Item */}
            {!isLocked && (
              <form onSubmit={(e) => handleAddItem(e, 'OEM')} className="flex gap-2">
                <Input
                  value={newOemTitle}
                  onChange={e => setNewOemTitle(e.target.value)}
                  placeholder="Add custom OEM doc..."
                  className="flex-1 h-9 text-xs bg-background"
                />
                <Button type="submit" size="sm" className="h-9 px-3">
                  <Plus className="size-4" />
                </Button>
              </form>
            )}

            {/* OEM Items List */}
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {oemItems.map(item => renderItem(item))}
              </AnimatePresence>
              {oemItems.length === 0 && (
                <div className="text-center py-10 border border-dashed border-border rounded-xl bg-muted/5">
                  <p className="text-xs text-muted-foreground">No OEM docs defined.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog Modal */}
      <AnimatePresence>
        {confirmDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-foreground/25 backdrop-blur-xs"
              onClick={() => setConfirmDeleteId(null)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 w-full max-w-sm bg-card border border-border rounded-xl shadow-xl p-5 space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="size-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                  <AlertTriangle className="size-4" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-foreground">Confirm Requirement Deletion</h4>
                  <p className="text-xs text-muted-foreground leading-normal">
                    Are you sure you want to delete this item? This action will remove the checklist item and log it to the stage history.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)}>
                  Cancel
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDeleteItem}>
                  Confirm Delete
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OEM Receipt Picker — shown instead of a blanket toggle whenever 2+
          OEMs are tracked, so one OEM's document arriving doesn't silently
          mark it received for every OEM. */}
      <AnimatePresence>
        {oemPickerItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-foreground/25 backdrop-blur-xs"
              onClick={() => setOemPickerItem(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 w-full max-w-sm bg-card border border-border rounded-xl shadow-xl p-5 space-y-4"
            >
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Building2 className="size-4 text-violet-500" /> Which OEM(s)?
                </h4>
                <p className="text-xs text-muted-foreground leading-normal">
                  "{oemPickerItem.title.replace(/^\[(Bidder|OEM)\]\s*/i, '')}" is tracked per OEM — select which OEM(s)
                  it has actually been received from. The checklist item completes only once every OEM is checked.
                </p>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {oemList.map((o) => {
                  const initiated = o.initiated === 'YES'
                  return (
                    <label key={o.id} className={`flex items-center gap-2 text-xs p-2 rounded-md border ${initiated ? 'cursor-pointer border-border/60 hover:bg-muted/40' : 'cursor-not-allowed border-border/40 bg-muted/20'}`}>
                      <input
                        type="checkbox"
                        checked={initiated && !!oemPickerSelected[o.id]}
                        disabled={!initiated}
                        onChange={(e) => setOemPickerSelected(prev => ({ ...prev, [o.id]: e.target.checked }))}
                        className="accent-primary disabled:opacity-40"
                      />
                      <span className={`font-medium ${initiated ? 'text-foreground' : 'text-muted-foreground'}`}>{o.name}</span>
                      {!initiated && (
                        <span className="ml-auto text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                          Not initiated
                        </span>
                      )}
                    </label>
                  )
                })}
                {oemList.every(o => o.initiated !== 'YES') && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1 pt-1">
                    <AlertTriangle className="size-3" /> No OEM has been initiated yet — initiate one in the OEM Authorization stage first.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setOemPickerItem(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleOemPickerConfirm}>
                  Save
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

