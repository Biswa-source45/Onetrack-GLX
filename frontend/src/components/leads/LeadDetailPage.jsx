import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ChevronLeft,
  Building2,
  FileText,
  FolderOpen,
  Users,
  Download,
  Trash2,
  Loader2,
  AlertTriangle,
  Pencil,
  Image as ImageIcon,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getLead, deleteLead, deleteLeadDocument, downloadLeadDocument } from "../../services/leads";
import { usePermissions } from "../../hooks/usePermissions";
import { formatCurrency, formatDate, formatDateTime } from "../../lib/tenderFormat";
import { emptyDocs, formatBytes, toUploadItems, uploadAll, validateDocs } from "../../lib/leadDocs";
import { LeadDocumentPicker } from "./LeadDocumentPicker";
import { LeadStageBadge, LeadStatusBadge, LeadTypeBadge } from "./leadBadges";
import { LeadWorkflow } from "./LeadWorkflow";

function Panel({ icon: Icon, title, children }) {
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 border-b border-border/60 pb-3 text-sm font-semibold text-foreground">
        <Icon className="size-4 text-primary" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}

// Renders label/value pairs, skipping empty values so a sparse lead
// doesn't turn into a wall of "Not set".
function Facts({ items }) {
  const filled = items.filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (!filled.length) return <p className="text-sm text-muted-foreground">Nothing captured yet.</p>;
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {filled.map(([label, value, wide]) => (
        <div key={label} className={wide ? "sm:col-span-2 lg:col-span-3" : ""}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 whitespace-pre-line break-words text-sm text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function emdSummary(d) {
  if (d.emd_not_applicable) return "No EMD";
  const routes = [
    d.emd_online && `Online (${[d.emd_bank_name, d.emd_account_number, d.emd_ifsc_code, d.emd_branch].filter(Boolean).join(", ")})`,
    d.emd_dd && `DD (${[d.emd_beneficiary, d.emd_payable_at].filter(Boolean).join(", payable at ")})`,
    d.emd_exemption_types?.length &&
      `Exemption: ${d.emd_exemption_types.map((t) => (t === "OTHER" ? `Other: ${d.emd_exemption_reason || ""}` : t === "STARTUP" ? "Startup" : t)).join(", ")}`,
  ].filter(Boolean);
  return routes.join("\n") || undefined;
}

export function LeadDetailPage() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission("lead.create");

  const [lead, setLead] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | missing | error
  const [docs, setDocs] = useState(emptyDocs);
  const [docError, setDocError] = useState("");
  const [uploading, setUploading] = useState("");
  const [busyDoc, setBusyDoc] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmDeleteLead, setConfirmDeleteLead] = useState(false);
  const [deletingLead, setDeletingLead] = useState(false);

  const fetchLead = useCallback(
    () =>
      getLead(leadId)
        .then((res) => (res.ok ? { lead: res.data, state: "ready" } : { state: res.status === 404 ? "missing" : "error" }))
        .catch(() => ({ state: "error" })),
    [leadId],
  );
  const apply = (r) => {
    if (r.lead) setLead(r.lead);
    setState(r.state);
  };

  useEffect(() => {
    let live = true; // ignore a stale response after navigating to another lead
    fetchLead().then((r) => live && apply(r));
    return () => { live = false; };
  }, [fetchLead]);

  const load = () => fetchLead().then(apply);

  async function handleUpload() {
    const err = validateDocs(docs);
    if (err) return setDocError(err);
    const items = toUploadItems(docs);
    if (!items.length) return setDocError("Choose at least one file");
    setUploading("Uploading…");
    const failed = await uploadAll(lead.id, items, (i, n) => setUploading(`Uploading ${i} of ${n}…`));
    setUploading("");
    if (failed.length) {
      toast.error(`${failed.length} file${failed.length > 1 ? "s" : ""} failed: ${failed.map((f) => `${f.file.name} (${f.reason})`).join(", ")}`, { duration: 10000 });
      // Keep only the failed files staged so a retry doesn't duplicate the rest.
      const failedSet = new Set(failed.map((f) => f.file));
      setDocs((d) => ({
        bulk: d.bulk.filter((f) => failedSet.has(f)),
        rows: d.rows.map((r) => ({ ...r, files: r.files.filter((f) => failedSet.has(f)) })),
      }));
    } else {
      toast.success(`${items.length} document${items.length > 1 ? "s" : ""} uploaded`);
      setDocs(emptyDocs());
    }
    load();
  }

  async function handleDownload(doc) {
    setBusyDoc(doc.id);
    const ok = await downloadLeadDocument(lead.id, doc).catch(() => false);
    setBusyDoc(null);
    if (!ok) toast.error(`Could not download ${doc.original_name}`);
  }

  async function handleDelete() {
    const doc = confirmDelete;
    setConfirmDelete(null);
    setBusyDoc(doc.id);
    const res = await deleteLeadDocument(lead.id, doc.id).catch(() => ({ ok: false }));
    setBusyDoc(null);
    if (res.ok) {
      toast.success(`${doc.original_name} deleted`);
      load();
    } else {
      toast.error(res.error?.message ?? "Could not delete the document");
    }
  }

  async function handleDeleteLead() {
    setDeletingLead(true);
    const res = await deleteLead(lead.id).catch(() => ({ ok: false }));
    setDeletingLead(false);
    setConfirmDeleteLead(false);
    if (res.ok) {
      toast.success("Lead deleted");
      navigate("/dashboard/leads");
    } else {
      toast.error(res.error?.message ?? "Could not delete the lead");
    }
  }

  const back = (
    <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/leads")} className="gap-1.5 text-muted-foreground hover:text-foreground">
      <ChevronLeft className="size-4" />
      Back to Leads
    </Button>
  );

  if (state === "loading") {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        {back}
        <div className="h-8 w-72 animate-pulse rounded bg-muted" />
        {[0, 1].map((i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-muted/60" />)}
      </div>
    );
  }
  if (state !== "ready") {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        {back}
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-14 text-center">
          <AlertTriangle className="size-6 text-destructive" aria-hidden />
          <p className="text-sm text-foreground">{state === "missing" ? "This lead does not exist or was removed." : "The lead could not be loaded."}</p>
          {state === "error" && <Button variant="outline" size="sm" onClick={() => { setState("loading"); load(); }}>Try again</Button>}
        </div>
      </div>
    );
  }

  const d = lead.published_details || {};
  const isPublished = lead.publish_status === "PUBLISHED";
  const documents = lead.documents ?? [];
  const groups = documents.reduce((acc, doc) => {
    const key = doc.category || "General";
    (acc[key] ||= []).push(doc);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {back}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <LeadStageBadge stage={lead.stage} />
            <LeadStatusBadge status={lead.publish_status} />
            <LeadTypeBadge type={lead.lead_type} />
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">{lead.title || lead.account_name}</h1>
          <p className="text-sm text-muted-foreground">
            Added by {lead.created_by.full_name} on {formatDate(lead.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {lead.can_edit && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate(`/dashboard/leads/${lead.id}/edit`)}>
              <Pencil className="size-3.5" />
              Edit Lead
            </Button>
          )}
          {lead.can_delete && (
            <Button variant="outline" size="sm" className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive" onClick={() => setConfirmDeleteLead(true)}>
              <Trash2 className="size-3.5" />
              Delete Lead
            </Button>
          )}
        </div>
      </div>

      {/* A step returns the updated lead; a refused one (someone else got
          there first) passes nothing, so reload to show where it stands. */}
      <LeadWorkflow lead={lead} onChanged={(updated) => (updated ? setLead(updated) : load())} />

      <Panel icon={Building2} title="Lead Details">
        <Facts
          items={[
            ["Account Name", lead.account_name],
            ["Department / Ministry", lead.department_name],
            ["Location", lead.location],
            ["Expected Date", lead.expected_date && formatDate(lead.expected_date)],
            ["Scope Type", lead.scope_type],
            ["Category / Scope Group", lead.category],
            ["Estimated Project Value", lead.estimated_value != null ? formatCurrency(lead.estimated_value) : null],
            ["High Level Scope", lead.high_level_scope, true],
          ]}
        />
      </Panel>

      {isPublished && (
        <Panel icon={FileText} title="Tender Details">
          <Facts
            items={[
              ["Tender Title", lead.title, true],
              ["BID / RFP Number", d.gem_bid_no],
              ["Portal Source", d.portal_source],
              ["Bid Type", d.bid_type === "BID_TO_RA" ? "BID to RA" : d.bid_type],
              ["Start Date", d.start_date && formatDate(d.start_date)],
              ["End Date", d.end_date && formatDateTime(d.end_date)],
              ["Quantity", d.quantity],
              ["EMD Amount", d.emd_amount != null ? formatCurrency(d.emd_amount) : null],
              ["EMD", emdSummary(d)],
              ["Bank Guarantee", d.bg_required ? [d.bg_rate != null && `${d.bg_rate}%`, d.bg_duration_months && `${d.bg_duration_months} months`].filter(Boolean).join(", ") || "Required" : null],
            ]}
          />
          {d.requested_products?.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Product / Service</th>
                    <th scope="col" className="px-3 py-2 font-medium">Description</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Qty</th>
                    <th scope="col" className="px-3 py-2 font-medium">OEM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {d.requested_products.map((p, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-foreground">{p.product}</td>
                      <td className="px-3 py-2 text-muted-foreground">{p.description}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.qty}</td>
                      <td className="px-3 py-2 text-muted-foreground">{p.oem}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {isPublished && (
        <Panel icon={FolderOpen} title={`Documents (${documents.length})`}>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents yet.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(groups).map(([group, list]) => (
                <div key={group} className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground">{group}</h3>
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {list.map((doc) => {
                      const Icon = doc.content_type.startsWith("image/") ? ImageIcon : FileText;
                      return (
                        <li key={doc.id} className="flex items-center gap-3 px-3 py-2.5">
                          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-foreground" title={doc.original_name}>{doc.original_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatBytes(doc.size_bytes)}, {doc.uploaded_by_name || "Unknown"}, {formatDate(doc.created_at)}
                            </p>
                          </div>
                          {busyDoc === doc.id ? (
                            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Working" />
                          ) : (
                            <>
                              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleDownload(doc)} aria-label={`Download ${doc.original_name}`}>
                                <Download className="size-3.5" />
                                <span className="hidden sm:inline">Download</span>
                              </Button>
                              {canEdit && (
                                <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(doc)} aria-label={`Delete ${doc.original_name}`}>
                                  <Trash2 className="size-3.5" />
                                </Button>
                              )}
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {canEdit && (
            <div className="space-y-3 border-t border-border/60 pt-4">
              <h3 className="text-sm font-medium text-foreground">Add documents</h3>
              <LeadDocumentPicker value={docs} onChange={(v) => { setDocs(v); setDocError(""); }} error={docError} />
              <div className="flex justify-end">
                <Button onClick={handleUpload} disabled={!!uploading || toUploadItems(docs).length === 0} className="gap-1.5">
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  {uploading || "Upload"}
                </Button>
              </div>
            </div>
          )}
        </Panel>
      )}

      <Panel icon={Users} title="Ownership">
        <Facts
          items={[
            ["Lead Owner", lead.lead_owner.full_name],
            ["Reporting Manager", lead.reporting_manager?.full_name || "None"],
            ["Approver", lead.approver?.full_name],
            ["Created By", lead.created_by.full_name],
            ["Storage Folder", `leads-assets/${lead.folder_name}/docs`],
          ]}
        />
      </Panel>

      <AlertDialog open={confirmDeleteLead} onOpenChange={(open) => !open && !deletingLead && setConfirmDeleteLead(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              {lead.title || lead.account_name} will be removed for good, together with its {documents.length} document{documents.length === 1 ? "" : "s"}, its approval history and its alerts. This cannot be undone. To stop pursuing a lead but keep its record, use No-Go instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingLead}>Keep Lead</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDeleteLead(); }} disabled={deletingLead} className="bg-destructive text-white hover:bg-destructive/90">
              {deletingLead ? "Deleting…" : "Delete Lead"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.original_name} will be removed from the lead and its folder. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
