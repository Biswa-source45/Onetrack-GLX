// Shared per-OEM checklist-item helpers — used by both ChecklistTab (the live
// UI) and checklistExport (the Excel export) so the two never disagree about
// what "received" means for a given item/OEM pair.
//
// MAF's per-OEM receipt status lives in the matrix row's legacy top-level
// `maf` field rather than `docStatus` (which only exists for documents added
// after multi-OEM tracking did), so it needs its own read/write instead of
// going through `docStatus` like every other OEM document. Mirrors
// StageWorkspaces.jsx's `getDocStatus`/`setDocStatus` for its `legacy: true`
// MAF column.
export const isOemDocItem = (item) => item.checklist_group === 'OEM' || item.title.startsWith('[OEM]')
export const isMafItem = (item) => /\bmaf\b/i.test(item.title)
export const readOemDoc = (o, item) => isMafItem(item) ? o.maf === 'RECEIVED' : (o.docStatus || {})[item.id] === 'RECEIVED'
export const writeOemDoc = (o, item, received) => isMafItem(item)
  ? { ...o, maf: received ? 'RECEIVED' : 'NOT RECEIVED' }
  : { ...o, docStatus: { ...(o.docStatus || {}), [item.id]: received ? 'RECEIVED' : 'NOT RECEIVED' } }
