// The "extraction finished" message, spoken by Aria, OneTrack's document assistant.
// Used by Add Lead and Add Tender. The face is inline SVG (no image files to host or license);
// its blink and float animations live in App.css.
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "../lib/tenderFormat";

const AGENT_NAME = "Aria";

function AgentFace() {
  return (
    <div className="relative">
      <svg viewBox="0 0 96 96" className="agent-face size-20 drop-shadow-md" aria-hidden>
        <defs>
          <linearGradient id="agent-skin" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6366f1" />
            <stop offset="1" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <circle cx="48" cy="48" r="46" fill="url(#agent-skin)" />
        {/* visor */}
        <rect x="18" y="26" width="60" height="42" rx="20" fill="#fff" />
        <ellipse className="agent-eye" cx="36" cy="44" rx="5.5" ry="7.5" fill="#1e1b4b" />
        <ellipse className="agent-eye" cx="60" cy="44" rx="5.5" ry="7.5" fill="#1e1b4b" />
        <path d="M38 56q10 8 20 0" fill="none" stroke="#1e1b4b" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="27" cy="55" r="3.5" fill="#f9a8d4" />
        <circle cx="69" cy="55" r="3.5" fill="#f9a8d4" />
      </svg>
      <span className="absolute bottom-1 right-1 size-4 rounded-full border-2 border-background bg-emerald-500" aria-hidden />
    </div>
  );
}

// The values worth reading back, from either a lead or a tender extraction. Empty ones are left out.
function factsFrom(data = {}) {
  const money = (v) => (Number(v) > 0 ? formatCurrency(Number(v)) : null);
  const products = data.products?.length;
  return [
    ["Account", data.account_name || data.organization_name],
    ["Title", data.title],
    ["Bid / RFP No.", data.gem_bid_no],
    ["Closing date", data.end_date && formatDate(data.end_date)],
    ["Estimated value", money(data.estimated_value)],
    ["EMD", data.emd_not_applicable ? "Not required" : money(data.emd_amount)],
    ["Products", products ? `${products} item${products === 1 ? "" : "s"}` : null],
  ].filter(([, v]) => v);
}

/** notes: things the form filled in that the document did not actually say. */
export function AiAgentDialog({ open, onOpenChange, data, fileName, subject, notes = [], confirmId }) {
  const facts = factsFrom(data);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="flex flex-col items-center gap-2 bg-gradient-to-b from-indigo-500/10 to-transparent px-6 pt-6">
          <AgentFace />
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">{AGENT_NAME}</p>
            <p className="text-xs text-muted-foreground">OneTrack Document Assistant</p>
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-4">
          <div className="rounded-2xl border border-border bg-muted/50 px-4 py-3">
            <DialogTitle className="text-sm font-semibold text-foreground">I've filled in your {subject} form</DialogTitle>
            <DialogDescription className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">
              I read {fileName ? <span className="font-medium text-foreground">{fileName}</span> : "your document"}.{" "}
              {facts.length ? "Here is what I found." : "I could not pick out the key details, so please fill them in."} Please check every field before you save.
            </DialogDescription>
          </div>

          {facts.length > 0 && (
            <dl className="divide-y divide-border rounded-lg border border-border text-sm">
              {facts.map(([label, value]) => (
                <div key={label} className="flex gap-3 px-3 py-2">
                  <dt className="w-28 shrink-0 text-xs leading-5 text-muted-foreground">{label}</dt>
                  <dd className="line-clamp-2 min-w-0 flex-1 break-words font-medium text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {notes.length > 0 && (
            <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">I guessed these, the document didn't say:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {notes.map((n) => <li key={n}>{n}</li>)}
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border/60 px-6 py-3">
          <Button id={confirmId} type="button" className="w-full" onClick={() => onOpenChange(false)}>
            Review the form
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
