import { useState } from "react";
import { FileText, FolderOpen, Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { emptyDocs, toUploadItems, uploadAll, validateDocs } from "../../lib/leadDocs";
import { PUBLISHED_BLANK, blankProducts, buildPublishPayload, validatePublished } from "../../lib/leadPublish";
import { publishLead } from "../../services/leads";
import { LeadDocumentPicker } from "./LeadDocumentPicker";
import { TenderDetailsFields } from "./TenderDetailsFields";

function Section({ icon: Icon, title, children }) {
  return (
    <section className="space-y-4">
      <h3 className="flex items-center gap-2 border-b border-border/60 pb-2 text-sm font-semibold text-foreground">
        <Icon className="size-4 text-primary" aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  );
}

// The form lives in its own component so it starts blank every time the dialog opens.
function PublishForm({ lead, onClose, onPublished }) {
  const [form, setForm] = useState({ ...PUBLISHED_BLANK });
  const [products, setProducts] = useState(blankProducts());
  const [emdOnlineOn, setEmdOnlineOn] = useState(false);
  const [emdDdOn, setEmdDdOn] = useState(false);
  const [docs, setDocs] = useState(emptyDocs);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState("");

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function submit(ev) {
    ev.preventDefault();
    if (saving) return;
    const e = validatePublished(form, emdOnlineOn, emdDdOn);
    const docError = validateDocs(docs);
    if (docError) e.docs = docError;
    if (Object.keys(e).length) {
      setErrors(e);
      toast.error("Please fix the highlighted fields");
      requestAnimationFrame(() => document.querySelector("[role=dialog] p.text-destructive, [role=dialog] p.text-red-500")?.scrollIntoView({ block: "center" }));
      return;
    }

    setSaving("Publishing…");
    try {
      const res = await publishLead(lead.id, buildPublishPayload(form, products, emdOnlineOn, emdDdOn));
      if (!res.ok) {
        toast.error(res.error?.message ?? "Could not publish the lead");
        // Someone else may have published or changed it: show where it stands now.
        if (res.status === 400 || res.status === 403) onPublished();
        return;
      }
      // The lead is published now; the documents are a separate, retryable step.
      const items = toUploadItems(docs);
      let failed = [];
      if (items.length) failed = await uploadAll(lead.id, items, (i, n) => setSaving(`Uploading ${i} of ${n}…`));
      if (failed.length) {
        toast.warning(`Lead published, but ${failed.length} file${failed.length > 1 ? "s" : ""} failed: ${failed.map((f) => `${f.file.name} (${f.reason})`).join(", ")}. Re-upload from the Documents section.`, { duration: 10000 });
      } else {
        toast.success(items.length ? `Lead published with ${items.length} document${items.length > 1 ? "s" : ""}` : "Lead published");
      }
      onPublished();
      onClose();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving("");
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <DialogHeader>
        <DialogTitle>Publish Lead</DialogTitle>
        <DialogDescription>
          The RFP is out. Add its tender details and documents. {lead.title || lead.account_name} then becomes a Published lead, which cannot be undone, and Prebid queries open for it.
        </DialogDescription>
      </DialogHeader>

      <Section icon={FileText} title="Tender Details">
        <TenderDetailsFields
          form={form}
          set={set}
          setForm={setForm}
          errors={errors}
          setErrors={setErrors}
          products={products}
          setProducts={setProducts}
          emdOnlineOn={emdOnlineOn}
          setEmdOnlineOn={setEmdOnlineOn}
          emdDdOn={emdDdOn}
          setEmdDdOn={setEmdDdOn}
        />
      </Section>

      <Section icon={FolderOpen} title="Documents">
        <p className="-mt-1 text-xs text-muted-foreground">Attach the RFP and anything that came with it. You can also add them later from the lead page.</p>
        <LeadDocumentPicker value={docs} onChange={(d) => { setDocs(d); setErrors((e) => ({ ...e, docs: undefined })); }} error={errors.docs} />
      </Section>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={!!saving}>Cancel</Button>
        <Button type="submit" disabled={!!saving} className="min-w-36 gap-1.5">
          {saving ? <><Loader2 className="size-4 animate-spin" />{saving}</> : <><Megaphone className="size-4" />Publish Lead</>}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function PublishLeadDialog({ lead, open, onOpenChange, onPublished }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl" onInteractOutside={(e) => e.preventDefault()}>
        <PublishForm lead={lead} onClose={() => onOpenChange(false)} onPublished={onPublished} />
      </DialogContent>
    </Dialog>
  );
}
