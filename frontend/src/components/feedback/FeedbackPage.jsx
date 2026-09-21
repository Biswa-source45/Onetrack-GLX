import { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronDown, Loader2, MessageSquarePlus, Inbox, ImagePlus, X, Camera } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { FieldMemoryInput } from '@/components/ui/field-memory-input'
import { createTicket, listMyTickets } from '../../services/tickets'
import { TICKET_CATEGORIES, categoryColor, TICKET_STATUS_LABELS, TICKET_STATUS_CLASSES } from '../../lib/ticketCategories'
import { TicketDetailDialog } from './TicketDetailDialog'
import { useFeedbackDraftStore } from '../../store/useFeedbackDraftStore'

function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function FeedbackPage() {
  const { refreshTicketsCount } = useOutletContext() || {}

  const [category, setCategory] = useState('')
  const [customCategory, setCustomCategory] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})

  // The attached image is one concept regardless of source — a manual file
  // pick or a Ctrl+I capture both just set these two. fromCapture only
  // changes the preview's label/icon, nothing about how it's submitted.
  const [imageFile, setImageFile] = useState(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null)
  const [imageFromCapture, setImageFromCapture] = useState(false)
  const fileInputRef = useRef(null)

  const [tickets, setTickets] = useState([])
  const [loadingTickets, setLoadingTickets] = useState(true)
  const [selectedTicketId, setSelectedTicketId] = useState(null)

  function loadMyTickets() {
    setLoadingTickets(true)
    listMyTickets({ limit: 30 }).then((res) => {
      if (res.ok) setTickets(res.data || [])
      setLoadingTickets(false)
    })
  }

  // Ctrl+I (Dashboard.jsx) stashes a captured screenshot here before
  // navigating in — pick it up once, then clear the draft so a later plain
  // visit to this page doesn't resurrect a stale capture.
  useEffect(() => {
    const draft = useFeedbackDraftStore.getState().consumeDraft()
    if (draft.screenshotBlob) {
      setImageFile(draft.screenshotBlob)
      setImagePreviewUrl(draft.screenshotDataUrl)
      setImageFromCapture(true)
      if (draft.suggestedCategory) setCategory(draft.suggestedCategory)
    }
  }, [])

  function validateAndSetImage(file) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setErrors((e) => ({ ...e, image: 'Only JPEG, PNG, or WebP images are allowed' }))
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setErrors((e) => ({ ...e, image: 'Image must be under 5 MB' }))
      return
    }
    setErrors((e) => ({ ...e, image: undefined }))
    setImageFile(file)
    setImagePreviewUrl(URL.createObjectURL(file))
    setImageFromCapture(false)
  }

  function removeImage() {
    setImageFile(null)
    setImagePreviewUrl(null)
    setImageFromCapture(false)
    setErrors((e) => ({ ...e, image: undefined }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  useEffect(() => { loadMyTickets() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    const nextErrors = {}
    if (!category) nextErrors.category = 'Choose a category'
    if (category === 'Other' && !customCategory.trim()) nextErrors.customCategory = 'Describe the category'
    if (!description.trim()) nextErrors.description = 'Tell us what happened'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setSubmitting(true)
    try {
      const res = await createTicket({
        category,
        custom_category: category === 'Other' ? customCategory.trim() : undefined,
        description: description.trim(),
        image: imageFile,
      })
      if (res.ok) {
        toast.success('Feedback submitted — the team has been notified')
        setCategory('')
        setCustomCategory('')
        setDescription('')
        removeImage()
        setErrors({})
        loadMyTickets()
        refreshTicketsCount?.()
      } else {
        toast.error(res.error?.message || 'Failed to submit feedback')
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-heading font-semibold text-foreground flex items-center gap-2">
          <MessageSquarePlus className="size-5 text-primary" />
          Feedback
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Hit a bug, have a question, or want something added? Tell us where and what — it goes straight to the team.
          Press <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-[11px] font-mono">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-[11px] font-mono">I</kbd> anywhere to grab a screenshot of what you're looking at and land here with it attached.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="border border-border rounded-xl bg-card p-5 space-y-4">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={`w-full sm:w-72 h-9 text-sm font-normal justify-between bg-background ${errors.category ? 'border-destructive' : ''}`}
              >
                <span className={category ? '' : 'text-muted-foreground'}>{category || 'Select a category...'}</span>
                <ChevronDown className="size-3.5 text-muted-foreground ml-auto" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[260px] max-h-[320px] overflow-y-auto">
              {TICKET_CATEGORIES.map((c) => (
                <DropdownMenuItem key={c} onSelect={() => { setCategory(c); setErrors((e) => ({ ...e, category: undefined })) }}>
                  {c}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}

          {category === 'Other' && (
            <div className="pt-1">
              <FieldMemoryInput
                fieldKey="ticket_category_other"
                value={customCategory}
                onChange={(v) => { setCustomCategory(v); setErrors((e) => ({ ...e, customCategory: undefined })) }}
                placeholder="e.g. Notification preferences"
                className={`h-9 text-sm w-full sm:w-72 bg-background ${errors.customCategory ? 'border-destructive' : ''}`}
                autoFocus
              />
              {errors.customCategory && <p className="text-xs text-destructive mt-1">{errors.customCategory}</p>}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>What happened?</Label>
          <Textarea
            value={description}
            onChange={(e) => { setDescription(e.target.value); setErrors((er) => ({ ...er, description: undefined })) }}
            placeholder="Describe the issue, question, or idea — the more specific, the faster it gets triaged."
            className={`text-sm min-h-[110px] ${errors.description ? 'border-destructive' : ''}`}
          />
          {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Screenshot (optional)</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) validateAndSetImage(file)
            }}
          />
          {imagePreviewUrl ? (
            <div className="relative inline-block">
              <img
                src={imagePreviewUrl}
                alt="Attached screenshot preview"
                className="max-h-40 rounded-lg border border-border object-cover"
              />
              <button
                type="button"
                onClick={removeImage}
                aria-label="Remove image"
                className="absolute -top-2 -right-2 size-6 rounded-full bg-foreground text-background flex items-center justify-center shadow-sm hover:bg-foreground/90 transition-colors"
              >
                <X className="size-3.5" />
              </button>
              {imageFromCapture && (
                <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-background/90 text-foreground border border-border">
                  <Camera className="size-2.5" /> Captured automatically
                </span>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 h-9 px-3 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <ImagePlus className="size-4" />
              Attach a screenshot
            </button>
          )}
          {errors.image && <p className="text-xs text-destructive">{errors.image}</p>}
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Submit Feedback
          </Button>
        </div>
      </form>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">My Tickets</h2>
        {loadingTickets ? (
          <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-primary" /></div>
        ) : tickets.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-8 text-center">
            <Inbox className="size-7 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nothing submitted yet.</p>
          </div>
        ) : (
          <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
            {tickets.map((t) => {
              const label = t.category === 'Other' ? (t.custom_category || 'Other') : t.category
              const chip = categoryColor(label)
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTicketId(t.id)}
                  className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${chip.bg} ${chip.text} ${chip.border}`}>
                        {label}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDate(t.created_at)}</span>
                    </div>
                    <p className="text-sm text-foreground truncate">{t.description}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${TICKET_STATUS_CLASSES[t.status]}`}>
                    {TICKET_STATUS_LABELS[t.status] || t.status}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <TicketDetailDialog
        open={!!selectedTicketId}
        onOpenChange={(v) => !v && setSelectedTicketId(null)}
        ticketId={selectedTicketId}
        canManage={false}
      />
    </div>
  )
}
