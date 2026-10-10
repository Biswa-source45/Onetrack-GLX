import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Pencil, Plus, Trash2, X, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addChecklist, deleteChecklist, getChecklists, updateChecklist } from '../../services/bids'
import { formatDateTime } from '../../lib/tenderFormat'

const strip = (title) => title.replace(/^\[(Bidder|OEM)\]\s*/i, '')
const isOem = (item) => item.checklist_group === 'OEM' || item.title.startsWith('[OEM]')

// Primary Review's document-checklist step: the Account Manager reads the
// checklist the Bid Executive built, edits it (the SAME items Stage 5 shows, so
// the confirmed list is the final list) and confirms it. Confirming is recorded
// by the parent; completing Primary Review requires it.
export function ChecklistReview({ bid, canEdit, confirmedAt, confirmedBy, onConfirm }) {
  const [items, setItems] = useState(null)
  const [drafts, setDrafts] = useState({ Bidder: '', OEM: '' })
  const [editing, setEditing] = useState(null) // { id, title }
  const [deleteId, setDeleteId] = useState(null)

  const load = useCallback(async () => {
    const res = await getChecklists(bid.id).catch(() => null)
    setItems(res?.ok && Array.isArray(res.data) ? res.data : [])
  }, [bid.id])
  useEffect(() => { load() }, [load])

  async function run(promise, failMsg) {
    const res = await promise.catch(() => null)
    if (!res?.ok) {
      toast.error(res?.error?.message || failMsg)
      return false
    }
    await load()
    return true
  }

  const add = async (group) => {
    const title = drafts[group].trim()
    if (!title) return
    if (await run(addChecklist(bid.id, `[${group}] ${strip(title)}`, items.length), 'Failed to add item')) {
      setDrafts((d) => ({ ...d, [group]: '' }))
    }
  }

  const rename = async (item) => {
    const title = editing.title.trim()
    setEditing(null)
    if (!title || title === strip(item.title)) return
    await run(updateChecklist(bid.id, item.id, { title: `[${isOem(item) ? 'OEM' : 'Bidder'}] ${strip(title)}` }), 'Failed to rename item')
  }

  const remove = async (item) => {
    setDeleteId(null)
    await run(deleteChecklist(bid.id, item.id), 'Failed to delete item')
  }

  const column = (group, list) => (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group === 'OEM' ? 'OEM documents' : 'Bidder documents'} ({list.length})</p>
      {list.length === 0 && <p className="text-xs italic text-muted-foreground">None yet.</p>}
      {list.map((item) => (
        <div key={item.id} className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs">
          {editing?.id === item.id ? (
            <>
              <Input autoFocus value={editing.title} className="h-7 text-xs"
                onChange={(e) => setEditing({ id: item.id, title: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') rename(item); if (e.key === 'Escape') setEditing(null) }} />
              <button type="button" aria-label="Save" onClick={() => rename(item)}><Check className="size-3.5 text-emerald-600" /></button>
              <button type="button" aria-label="Cancel" onClick={() => setEditing(null)}><X className="size-3.5 text-muted-foreground" /></button>
            </>
          ) : (
            <>
              <span className="flex-1 min-w-0 break-words">{strip(item.title)}</span>
              {canEdit && (deleteId === item.id ? (
                <>
                  <button type="button" className="text-[11px] font-semibold text-rose-600" onClick={() => remove(item)}>Delete?</button>
                  <button type="button" aria-label="Cancel" onClick={() => setDeleteId(null)}><X className="size-3.5 text-muted-foreground" /></button>
                </>
              ) : (
                <>
                  <button type="button" aria-label="Rename" onClick={() => setEditing({ id: item.id, title: strip(item.title) })}><Pencil className="size-3.5 text-muted-foreground hover:text-foreground" /></button>
                  <button type="button" aria-label="Delete" onClick={() => setDeleteId(item.id)}><Trash2 className="size-3.5 text-muted-foreground hover:text-rose-600" /></button>
                </>
              ))}
            </>
          )}
        </div>
      ))}
      {canEdit && (
        <div className="flex gap-2">
          <Input value={drafts[group]} placeholder={`Add ${group === 'OEM' ? 'OEM' : 'bidder'} document…`} className="h-8 text-xs"
            onChange={(e) => setDrafts((d) => ({ ...d, [group]: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') add(group) }} />
          <Button type="button" size="sm" variant="outline" className="h-8 px-2" aria-label={`Add ${group} document`} onClick={() => add(group)}><Plus className="size-3.5" /></Button>
        </div>
      )}
    </div>
  )

  return (
    <div className="p-4 rounded-xl border border-border bg-card space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Document Checklist Review</h4>
        {confirmedAt && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" /> Confirmed{confirmedBy ? ` by ${confirmedBy}` : ''} · {formatDateTime(confirmedAt)}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Review the checklist the Bid Executive prepared, add anything missing and remove what is not needed. What you confirm here is the checklist used in Document Checklist Preparation.
      </p>
      {items === null ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {column('Bidder', items.filter((i) => !isOem(i)))}
          {column('OEM', items.filter(isOem))}
        </div>
      )}
      <div className="flex justify-end">
        <span title={!canEdit ? 'Only the assigned Account Manager (or an Admin) can act here' : items?.length === 0 ? 'Add at least one document first' : undefined}>
          <Button size="sm" disabled={!canEdit || !items?.length} onClick={() => onConfirm(items.length)}
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-semibold disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none">
            {confirmedAt ? 'Re-confirm Checklist' : 'Confirm Checklist'}
          </Button>
        </span>
      </div>
    </div>
  )
}
