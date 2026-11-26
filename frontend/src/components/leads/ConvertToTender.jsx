// The last step of a Go lead: turn it into a tender, then link to it.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, FileOutput, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePermissions } from "../../hooks/usePermissions";
import { convertLead } from "../../services/leads";

export function ConvertToTender({ lead, onChanged }) {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null); // { tender, skipped } once converted

  const tender = lead.converted_tender;
  if (!tender && lead.stage !== "GO") return null;

  const canCreate = hasPermission("bid.create");
  const openTender = (id) => navigate(`/dashboard/tenders/${id}`);
  const docCount = lead.documents?.length ?? 0;

  function start() {
    setError("");
    setDone(null);
    setOpen(true);
  }

  async function convert() {
    setBusy(true);
    setError("");
    const res = await convertLead(lead.id).catch(() => ({ ok: false }));
    setBusy(false);
    if (!res.ok) {
      setError(res.error?.message ?? "Could not convert the lead");
      onChanged(); // someone else may have moved it on
      return;
    }
    setDone({ tender: res.data.lead.converted_tender, skipped: res.data.skipped_documents ?? [] });
    onChanged(res.data.lead);
  }

  return (
    <>
      {tender ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-4 dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Converted to tender <span className="font-mono">{tender.ref}</span>
              </p>
              <p className="text-xs text-muted-foreground">This lead is now read-only. Carry on with the tender.</p>
            </div>
          </div>
          {hasPermission("bid.view") && (
            <Button size="sm" className="gap-1.5" onClick={() => openTender(tender.id)}>
              Open Tender
              <ArrowRight className="size-3.5" />
            </Button>
          )}
        </section>
      ) : (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/5 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-foreground">This lead is a Go. Next step: convert it to a tender</p>
            <p className="text-xs text-muted-foreground">
              {lead.convert_blocker || (canCreate ? "The details, documents and ownership move across for you." : "You need permission to create tenders to convert it.")}
            </p>
          </div>
          {lead.can_convert && canCreate && (
            <Button size="sm" className="gap-1.5" onClick={start}>
              <FileOutput className="size-3.5" />
              Convert to Tender
            </Button>
          )}
        </section>
      )}

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="sm:max-w-md" showCloseButton={!busy}>
          {busy ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center" role="status">
              <Loader2 className="size-9 animate-spin text-primary" aria-hidden />
              <DialogTitle className="text-base">Creating the tender…</DialogTitle>
              <DialogDescription>Copying the lead's details, ownership and documents.</DialogDescription>
            </div>
          ) : done ? (
            <>
              <div className="flex flex-col items-center gap-3 pt-4 text-center">
                <CheckCircle2 className="size-11 text-emerald-600" aria-hidden />
                <DialogTitle className="text-base">
                  Converted to tender <span className="font-mono">{done.tender.ref}</span>
                </DialogTitle>
                <DialogDescription>The tender is ready, with this lead's owner as Bid Owner.</DialogDescription>
              </div>
              {done.skipped.length > 0 && (
                <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  Not copied (tenders take PDF, DOCX or TXT only): {done.skipped.join(", ")}. They are still on this lead.
                </p>
              )}
              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Stay on Lead</Button>
                {hasPermission("bid.view") && (
                  <Button size="sm" className="gap-1.5" onClick={() => openTender(done.tender.id)}>
                    Open Tender
                    <ArrowRight className="size-3.5" />
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Convert this lead to a tender?</DialogTitle>
                <DialogDescription>A new tender is created and this lead becomes read-only. This cannot be undone.</DialogDescription>
              </DialogHeader>
              <dl className="divide-y divide-border rounded-lg border border-border text-sm">
                {[
                  ["Bid Owner", lead.lead_owner.full_name],
                  ["Reporting Manager", lead.reporting_manager?.full_name || "None"],
                  ["Account Manager, Pre-Sales", "Assigned later on the tender"],
                  ["Documents", docCount ? `${docCount} to copy` : "None on this lead"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 px-3 py-2">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
              {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={convert}>Convert</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
