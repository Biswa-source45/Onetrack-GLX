import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Eye, FileText, FileUp, Loader2, Pencil, Plus, Replace, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { FieldMemoryInput } from '@/components/ui/field-memory-input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { usePermissions } from '../../hooks/usePermissions'
import { deleteTenderDoc, fetchTenderDocBlob, listTenderDocs, updateTenderDoc, uploadTenderDoc } from '../../services/bids'
import { ACCEPTED_TENDER_DOCS, DOC_NAME_PRESETS, MAX_DOC_NAME, checkTenderDoc, docKind, formatBytes } from '../../lib/tenderDocs'

const fmtDate = (v) => (v ? new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')

// Saves a blob under its original file name.
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// A file picker that validates on choice and shows the chosen file.
function FilePick({ file, onFile, label }) {
  return (
    <label className="relative flex h-9 cursor-pointer items-center gap-2 rounded-md border border-dashed border-input bg-background px-3 text-xs hover:border-primary/50 focus-within:ring-2 focus-within:ring-ring">
      <FileUp className="size-3.5 shrink-0 text-primary" aria-hidden />
      <span className="truncate" title={file?.name}>{file ? `${file.name} (${formatBytes(file.size)})` : 'Choose file (PDF, DOCX or TXT)'}</span>
      <input
        type="file"
        accept={ACCEPTED_TENDER_DOCS}
        aria-label={label}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          const bad = checkTenderDoc(f)
          if (bad) toast.error(bad)
          else onFile(f)
        }}
      />
    </label>
  )
}

// Add a document, rename one, or replace one's file — one dialog, three modes.
// mode: 'add' | 'rename' | 'replace'. onSave gets { name, file } and resolves true on success.
function DocFormDialog({ mode, doc, busy, onSave, onClose }) {
  const [name, setName] = useState(mode === 'add' ? '' : doc.name)
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const needsName = mode !== 'replace'
  const needsFile = mode !== 'rename'
  const title = { add: 'Add document', rename: 'Rename document', replace: 'Replace file' }[mode]

  const submit = () => {
    if (needsName && !name.trim()) return setError('Name the document (e.g. RFP)')
    if (needsFile && !file) return setError('Choose a PDF, DOCX or TXT file')
    if (mode === 'rename' && name.trim() === doc.name) return setError('Enter a different name')
    setError('')
    onSave({ name: name.trim(), file })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">{title}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {mode === 'replace'
              ? `Upload a new file for "${doc.name}". The previous file is removed.`
              : mode === 'rename'
                ? 'The file is moved into a folder with the new name.'
                : 'PDF, DOCX or TXT, up to 25 MB.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2" onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'file') submit() }}>
          {needsName && (
            <div className="space-y-1.5">
              <Label htmlFor="doc-name" className="text-xs font-medium">Document name *</Label>
              <FieldMemoryInput
                id="doc-name"
                fieldKey="tender_doc_name"
                presetOptions={DOC_NAME_PRESETS}
                value={name}
                onChange={(v) => { setName(v.slice(0, MAX_DOC_NAME)); setError('') }}
                placeholder="RFP, ATC, Corrigendum… or type your own"
                className="h-9 text-xs"
                autoFocus
              />
            </div>
          )}
          {needsFile && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">File *</Label>
              <FilePick file={file} onFile={(f) => { setFile(f); setError('') }} label="Document file" />
            </div>
          )}
          {error && <p role="alert" className="text-xs font-medium text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose} className="text-xs">Cancel</Button>
          <Button type="button" size="sm" disabled={busy} onClick={submit} className="text-xs gap-1.5">
            {busy && <Loader2 className="size-3.5 animate-spin" />}{mode === 'add' ? 'Upload' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Full preview: PDF in the browser's viewer, TXT as text, DOCX rendered in place.
function PreviewDialog({ bidId, doc, onClose, onDownload }) {
  const [view, setView] = useState({ status: 'loading' })
  const docxHost = useRef(null)

  useEffect(() => {
    let cancelled = false
    let url = ''
    ;(async () => {
      try {
        const blob = await fetchTenderDocBlob(bidId, doc.id, true)
        if (cancelled) return
        const kind = docKind(doc)
        if (kind === 'pdf') {
          url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
          setView({ status: 'pdf', url })
        } else if (kind === 'txt') {
          setView({ status: 'txt', text: await blob.text() })
        } else if (kind === 'docx') {
          setView({ status: 'docx', blob })
        } else {
          setView({ status: 'error', message: 'This file type cannot be previewed. Download it instead.' })
        }
      } catch (err) {
        if (!cancelled) setView({ status: 'error', message: err.message || 'Could not load the document' })
      }
    })()
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url) }
  }, [bidId, doc])

  // DOCX is drawn into the host div once the blob is here; the renderer is
  // loaded on demand so it never weighs on the main bundle.
  useEffect(() => {
    if (view.status !== 'docx') return undefined
    let cancelled = false
    ;(async () => {
      try {
        const { renderAsync } = await import('docx-preview')
        if (cancelled || !docxHost.current) return
        docxHost.current.innerHTML = ''
        await renderAsync(view.blob, docxHost.current, undefined, { inWrapper: true, ignoreWidth: false, breakPages: true })
      } catch {
        if (!cancelled) setView({ status: 'error', message: 'This Word file could not be displayed. Download it instead.' })
      }
    })()
    return () => { cancelled = true }
  }, [view])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-5xl w-[95vw] h-[90vh] flex flex-col gap-3">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-sm font-bold truncate pr-8">{doc.name} <span className="font-normal text-muted-foreground">· {doc.original_name}</span></DialogTitle>
          <DialogDescription className="sr-only">Preview of {doc.original_name}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-auto rounded-md border border-border bg-muted/20">
          {view.status === 'loading' && (
            <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading document…</div>
          )}
          {view.status === 'pdf' && <iframe title={doc.original_name} src={view.url} className="h-full w-full border-0 bg-white" />}
          {view.status === 'txt' && <pre className="whitespace-pre-wrap break-words p-4 text-xs leading-relaxed">{view.text}</pre>}
          {view.status === 'docx' && <div ref={docxHost} className="docx-host p-2" />}
          {view.status === 'error' && <p role="alert" className="p-6 text-center text-xs text-destructive">{view.message}</p>}
        </div>
        <DialogFooter className="shrink-0 gap-2 sm:gap-0">
          <Button type="button" variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => onDownload(doc)}><Download className="size-3.5" /> Download</Button>
          <Button type="button" size="sm" className="text-xs" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DocsTab({ bid, onChanged }) {
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission('bid.edit')
  const [docs, setDocs] = useState(null) // null = loading
  const [loadError, setLoadError] = useState('')
  const [dialog, setDialog] = useState(null) // { mode: 'add'|'rename'|'replace'|'delete'|'preview', doc }
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await listTenderDocs(bid.id)
      if (res.ok) { setDocs(res.data || []); setLoadError('') }
      else setLoadError(res.message || 'Could not load documents')
    } catch {
      setLoadError('Network error while loading documents')
    }
  }, [bid.id])

  // Initial load; setState only runs in the promise callbacks.
  useEffect(() => {
    let cancelled = false
    listTenderDocs(bid.id)
      .then((res) => { if (!cancelled && res.ok) setDocs(res.data || []); else if (!cancelled) setLoadError(res.message || 'Could not load documents') })
      .catch(() => { if (!cancelled) setLoadError('Network error while loading documents') })
    return () => { cancelled = true }
  }, [bid.id])

  const run = async (fn, okMsg) => {
    setBusy(true)
    try {
      const res = await fn()
      if (res.ok) {
        toast.success(okMsg)
        setDialog(null)
        await load()
        onChanged?.()
      } else {
        toast.error(res.message || 'The change could not be saved')
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const download = async (doc) => {
    try {
      saveBlob(await fetchTenderDocBlob(bid.id, doc.id), doc.original_name)
    } catch (err) {
      toast.error(err.message || 'Could not download the document')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold">Documents</h2>
          <p className="text-xs text-muted-foreground">Every document received for this tender. PDF, DOCX or TXT.</p>
        </div>
        {canEdit && (
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setDialog({ mode: 'add' })}>
            <Plus className="size-3.5" /> Add document
          </Button>
        )}
      </div>

      {loadError && (
        <div role="alert" className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {loadError}
          <Button variant="outline" size="sm" className="text-xs" onClick={load}>Retry</Button>
        </div>
      )}

      {docs === null && !loadError && (
        <div className="flex items-center gap-2 py-8 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading documents…</div>
      )}

      {docs?.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <FileText className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="mt-2 text-sm font-medium">No documents yet</p>
          <p className="text-xs text-muted-foreground">{canEdit ? 'Add the RFP or main tender document.' : 'Documents added to this tender will appear here.'}</p>
        </div>
      )}

      {docs?.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 p-3">
              <FileText className="size-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{d.name}</p>
                <p className="truncate text-xs text-muted-foreground" title={d.original_name}>
                  {d.original_name} · {formatBytes(d.size_bytes)}
                  {d.uploaded_by_name ? ` · ${d.uploaded_by_name}` : ''} · {fmtDate(d.updated_at || d.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => setDialog({ mode: 'preview', doc: d })} aria-label={`Preview ${d.name}`}>
                  <Eye className="size-3.5" /> <span className="hidden sm:inline">Preview</span>
                </Button>
                <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => download(d)} aria-label={`Download ${d.name}`}>
                  <Download className="size-3.5" /> <span className="hidden sm:inline">Download</span>
                </Button>
                {canEdit && (
                  <>
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => setDialog({ mode: 'rename', doc: d })} aria-label={`Rename ${d.name}`} title="Rename">
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => setDialog({ mode: 'replace', doc: d })} aria-label={`Replace file of ${d.name}`} title="Replace file">
                      <Replace className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => setDialog({ mode: 'delete', doc: d })} aria-label={`Delete ${d.name}`} title="Delete">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {dialog?.mode === 'add' && (
        <DocFormDialog mode="add" busy={busy} onClose={() => setDialog(null)}
          onSave={({ name, file }) => run(() => uploadTenderDoc(bid.id, name, file), 'Document uploaded')} />
      )}
      {dialog?.mode === 'rename' && (
        <DocFormDialog mode="rename" doc={dialog.doc} busy={busy} onClose={() => setDialog(null)}
          onSave={({ name }) => run(() => updateTenderDoc(bid.id, dialog.doc.id, { name }), 'Document renamed')} />
      )}
      {dialog?.mode === 'replace' && (
        <DocFormDialog mode="replace" doc={dialog.doc} busy={busy} onClose={() => setDialog(null)}
          onSave={({ file }) => run(() => updateTenderDoc(bid.id, dialog.doc.id, { file }), 'File replaced')} />
      )}
      {dialog?.mode === 'preview' && (
        <PreviewDialog bidId={bid.id} doc={dialog.doc} onClose={() => setDialog(null)} onDownload={download} />
      )}
      {dialog?.mode === 'delete' && (
        <Dialog open onOpenChange={(open) => !open && !busy && setDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold">Delete document</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                "{dialog.doc.name}" ({dialog.doc.original_name}) will be removed from this tender. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setDialog(null)} className="text-xs">Cancel</Button>
              <Button type="button" variant="destructive" size="sm" disabled={busy} className="text-xs gap-1.5"
                onClick={() => run(() => deleteTenderDoc(bid.id, dialog.doc.id), 'Document deleted')}>
                {busy && <Loader2 className="size-3.5 animate-spin" />} Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
