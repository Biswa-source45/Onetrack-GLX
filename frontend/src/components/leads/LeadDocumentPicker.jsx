import { useEffect, useState } from "react";
import { FileUp, Files, FolderTree, Plus, Trash2, X, FileText, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FieldMemoryInput } from "@/components/ui/field-memory-input";
import { ACCEPTED_DOC_TYPES, MAX_DOC_BYTES, formatBytes, newCategoryRow } from "../../lib/leadDocs";

const CATEGORY_PRESETS = ["RFP", "Corrigendum", "BOQ", "Technical Specification", "Commercial Terms", "Drawings"];

// Drops oversized files with a toast instead of letting the server reject
// them one by one after the user hits Save.
function keepValid(fileList) {
  const files = Array.from(fileList || []);
  const tooBig = files.filter((f) => f.size > MAX_DOC_BYTES);
  if (tooBig.length) {
    toast.error(`Over the 25 MB limit, skipped: ${tooBig.map((f) => f.name).join(", ")}`);
  }
  return files.filter((f) => f.size <= MAX_DOC_BYTES && f.size > 0);
}

function FileChip({ file, onRemove }) {
  const Icon = file.type?.startsWith("image/") ? ImageIcon : FileText;
  return (
    <li className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="truncate text-foreground" title={file.name}>{file.name}</span>
      <span className="shrink-0 tabular-nums text-muted-foreground">{formatBytes(file.size)}</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-auto shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Remove ${file.name}`}
      >
        <X className="size-3.5" />
      </button>
    </li>
  );
}

// A click-or-drop file target. A real <input type="file"> inside a <label>,
// so it's keyboard- and screen-reader-operable without extra wiring.
// The label is `relative` on purpose: the sr-only input is position:absolute,
// and with no positioned ancestor it anchors to the page itself. Focusing it
// (opening the picker) then scrolls the whole viewport to that spot and the
// fixed-height app shell goes blank.
function DropZone({ onFiles, compact = false, label }) {
  const [over, setOver] = useState(false);
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFiles(keepValid(e.dataTransfer.files)); }}
      className={`relative flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed text-center transition-colors focus-within:ring-2 focus-within:ring-ring
        ${over ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"}
        ${compact ? "h-9 px-3 flex-row" : "flex-col px-6 py-8"}`}
    >
      <input
        type="file"
        multiple
        accept={ACCEPTED_DOC_TYPES}
        className="sr-only"
        aria-label={label}
        onChange={(e) => { onFiles(keepValid(e.target.files)); e.target.value = ""; }}
      />
      <FileUp className={`${compact ? "size-3.5" : "size-6"} text-primary`} aria-hidden />
      {compact ? (
        <span className="text-xs font-medium text-foreground">Choose files</span>
      ) : (
        <span className="space-y-1">
          <span className="block text-sm font-medium text-foreground">Drop files here or click to browse</span>
          <span className="block text-xs text-muted-foreground">PDF, images, Word, Excel or PowerPoint. Up to 25 MB each.</span>
        </span>
      )}
    </label>
  );
}

/**
 * Two ways to attach lead documents, chosen with a toggle:
 *  - Bulk: drop many files at once, no labels.
 *  - By category: rows of "document type" + its file(s), e.g. RFP -> rfp.pdf.
 * Both lists are kept while switching, and each tab shows its own count, so
 * nothing staged in the other tab is ever hidden.
 *
 * value: { bulk: File[], rows: [{ key, category, files: File[] }] }
 */
export function LeadDocumentPicker({ value, onChange, error }) {
  // A file dropped anywhere outside a DropZone falls through to the
  // browser's default, which navigates away to open the file (the app goes
  // white and only Back + refresh recovers it). While the picker is on
  // screen, swallow those stray drops instead. DropZones call
  // preventDefault first (React handles events before they reach window),
  // so a defaultPrevented event here was already handled by a zone.
  useEffect(() => {
    const isFileDrag = (e) => Array.from(e.dataTransfer?.types || []).includes("Files");
    const onDragOver = (e) => {
      if (!isFileDrag(e) || e.defaultPrevented) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "none";
    };
    const onDrop = (e) => {
      if (!isFileDrag(e) || e.defaultPrevented) return;
      e.preventDefault();
      toast.info("Drop files onto an upload box to attach them");
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  const [mode, setMode] = useState(value.rows.some((r) => r.files.length) ? "category" : "bulk");
  const bulkCount = value.bulk.length;
  const categoryCount = value.rows.reduce((n, r) => n + r.files.length, 0);

  const setBulk = (bulk) => onChange({ ...value, bulk });
  const setRows = (rows) => onChange({ ...value, rows });
  const updateRow = (key, patch) => setRows(value.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const tabs = [
    { id: "bulk", label: "Bulk upload", icon: Files, count: bulkCount },
    { id: "category", label: "By document type", icon: FolderTree, count: categoryCount },
  ];

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Upload method" className="inline-flex rounded-lg border border-border bg-muted/60 p-1 text-xs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={mode === t.id}
            onClick={() => setMode(t.id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
              ${mode === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <t.icon className="size-3.5" aria-hidden />
            {t.label}
            {t.count > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold tabular-nums text-primary">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {mode === "bulk" ? (
        <div className="space-y-3" role="tabpanel">
          <DropZone label="Add files" onFiles={(files) => files.length && setBulk([...value.bulk, ...files])} />
          {bulkCount > 0 && (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {value.bulk.map((f, i) => (
                <FileChip key={`${f.name}-${i}`} file={f} onRemove={() => setBulk(value.bulk.filter((_, j) => j !== i))} />
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-3" role="tabpanel">
          {value.rows.map((row, idx) => (
            <div key={row.key} className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="sm:w-64">
                  <FieldMemoryInput
                    fieldKey="lead_doc_category"
                    presetOptions={CATEGORY_PRESETS}
                    value={row.category}
                    onChange={(v) => updateRow(row.key, { category: v })}
                    placeholder="Document type, e.g. RFP"
                    aria-label={`Document type ${idx + 1}`}
                    className={`h-9 text-sm bg-background ${error && row.files.length && !row.category.trim() ? "border-destructive" : ""}`}
                  />
                </div>
                <div className="flex-1">
                  <DropZone
                    compact
                    label={`Files for document type ${idx + 1}`}
                    onFiles={(files) => files.length && updateRow(row.key, { files: [...row.files, ...files] })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setRows(value.rows.length > 1 ? value.rows.filter((r) => r.key !== row.key) : [newCategoryRow()])}
                  className="self-end rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:self-auto"
                  aria-label={`Remove document type ${idx + 1}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              {row.files.length > 0 && (
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {row.files.map((f, i) => (
                    <FileChip
                      key={`${f.name}-${i}`}
                      file={f}
                      onRemove={() => updateRow(row.key, { files: row.files.filter((_, j) => j !== i) })}
                    />
                  ))}
                </ul>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setRows([...value.rows, newCategoryRow()])}>
            <Plus className="size-3.5" /> Add document type
          </Button>
        </div>
      )}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
