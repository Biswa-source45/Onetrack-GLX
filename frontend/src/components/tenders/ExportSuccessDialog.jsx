import { CheckCircle2, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'

// Confirmation shown after an Excel export downloads. `result` is
// { count, filename } from the export, or null when closed.
export function ExportSuccessDialog({ result, onClose }) {
  return (
    <Dialog open={!!result} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="items-center text-center">
          <div className="mb-1 flex size-12 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="size-6 text-emerald-600" />
          </div>
          <DialogTitle>Export successful</DialogTitle>
          <DialogDescription>
            {result?.count} {result?.count === 1 ? 'tender' : 'tenders'} exported to Excel.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
          <FileSpreadsheet className="size-4 shrink-0 text-emerald-600" />
          <span className="truncate font-medium" title={result?.filename}>{result?.filename}</span>
        </div>
        <DialogFooter>
          <Button className="w-full" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
