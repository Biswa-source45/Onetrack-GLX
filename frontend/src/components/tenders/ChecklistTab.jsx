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
  updateChecklist
} from '../../services/bids'

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

  const historyKey = `onetrack_checklist_history_${bidId}`

  // 1. Log checklist events to local stage history with username fallback
  function logChecklistHistory(actionText) {
    try {
      const currentHist = JSON.parse(localStorage.getItem(historyKey) || '[]')
      const newEvent = {
        id: `checklist_event_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        bid_id: bidId,
        from_stage: null,
        to_stage: 'CHECKLIST_UPDATE',
        transition_reason: actionText,
        transitioned_by: {
          id: currentUser?.id,
          username: currentUser?.username || 'unknown',
          full_name: currentUser?.full_name || currentUser?.username || 'Anonymous'
        },
        created_at: new Date().toISOString()
      }
      localStorage.setItem(historyKey, JSON.stringify([newEvent, ...currentHist]))
      // Refresh the outer bid detail page state so history tab updates automatically
      if (onRefresh) onRefresh()
    } catch (err) {
      console.error('Failed to write checklist history', err)
    }
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

  // 3. Handle toggling (mark done)
  const handleToggle = async (item) => {
    if (isLocked) return
    if (item.is_done) return // Cannot uncheck

    try {
      const res = await toggleChecklist(bidId, item.id, true)
      if (!res.ok) {
        toast.error(res.error?.message ?? 'Failed to update checklist item')
        return
      }

      const cleanTitle = item.title.replace(/^\[(Bidder|OEM)\]\s*/i, '')
      toast.success(`Completed checklist item: "${cleanTitle}"`)
      logChecklistHistory(`Completed checklist item: "${cleanTitle}"`)
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
  const bidderItems = items.filter(item => !item.title.startsWith('[OEM]'))
  const oemItems = items.filter(item => item.title.startsWith('[OEM]'))

  const renderItem = (item) => {
    const isItemDragged = item.id === draggedId
    const cleanTitle = item.title.replace(/^\[(Bidder|OEM)\]\s*/i, '')

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
              disabled={item.is_done || isLocked}
              onClick={() => handleToggle(item)}
              className={`size-4.5 rounded border flex items-center justify-center transition-all
                ${item.is_done
                  ? 'bg-emerald-500 border-emerald-500 text-white cursor-not-allowed scale-100'
                  : isLocked
                    ? 'bg-muted border-border cursor-not-allowed'
                    : 'border-muted-foreground/30 hover:border-primary/60 bg-background text-transparent hover:text-primary/40'}`}
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
              </>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {!isLocked && (
          <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {!item.is_done && editingId !== item.id && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(item.id)
                  setEditTitle(cleanTitle)
                }}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Edit requirement"
              >
                <Edit2 className="size-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmDeleteId(item.id)}
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Delete requirement"
            >
              <Trash2 className="size-3" />
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
              {doneCount} of {totalCount} items completed. Completed items cannot be undone.
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
          {/* Left: Bidder Tasks */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <div className="flex items-center gap-2">
                <Award className="size-4 text-primary" />
                <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Bidder Tasks</h4>
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
                  placeholder="Add custom Bidder task..."
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
                  <p className="text-xs text-muted-foreground">No Bidder tasks defined.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: OEM Tasks */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-violet-500" />
                <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">OEM Tasks</h4>
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
                  placeholder="Add custom OEM task..."
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
                  <p className="text-xs text-muted-foreground">No OEM tasks defined.</p>
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
    </div>
  )
}

