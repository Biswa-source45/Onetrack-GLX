import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronLeft,
  Building2,
  FileText,
  FolderOpen,
  Users,
  Loader2,
  Megaphone,
  EyeOff,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldMemoryInput } from "@/components/ui/field-memory-input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { EmdBgSection, Field, ProductsTable } from "../tenders/tenderFormParts";
import {
  BID_TYPES,
  SCOPE_TYPES,
  STANDARD_CATEGORY_OPTIONS,
  STANDARD_PORTAL_SOURCES,
  inputCls,
  validateEmd,
} from "../../lib/tenderSpec";
import { emptyDocs, toUploadItems, uploadAll, validateDocs } from "../../lib/leadDocs";
import { LeadDocumentPicker } from "./LeadDocumentPicker";
import { UserSelect } from "./UserSelect";
import { createLead, getLead, updateLead } from "../../services/leads";
import { tokenStorage } from "../../services/auth";
import { useBidStore } from "../../store/useBidStore";

const STATUS_OPTIONS = [
  {
    value: "UNPUBLISHED",
    label: "Unpublished",
    hint: "Early opportunity. No RFP or tender is out yet.",
    icon: EyeOff,
  },
  {
    value: "PUBLISHED",
    label: "Published",
    hint: "The RFP is out. Capture its tender details and documents.",
    icon: Megaphone,
  },
];

function Panel({ icon: Icon, title, children, aside }) {
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="size-4 text-primary" aria-hidden />
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Segmented({ value, onChange, options, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex w-full rounded-lg border border-border bg-muted/60 p-1 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-7 flex-1 rounded-md px-3 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
            ${value === o.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// A saved lead -> the form's shape (the inverse of buildPayload). The
// published tender fields live flat on the form but under published_details
// on the lead; null/absent values become the form's empty values.
function leadToForm(lead, blank) {
  const d = lead.published_details || {};
  const form = { ...blank };
  for (const key of Object.keys(blank)) {
    const v = key in lead ? lead[key] : d[key];
    if (v !== null && v !== undefined) form[key] = typeof blank[key] === "string" ? String(v) : v;
  }
  form.lead_owner_id = lead.lead_owner?.id ?? "";
  form.reporting_manager_id = lead.reporting_manager?.id ?? "";
  if (d.start_date) form.start_date = d.start_date.slice(0, 10);
  if (d.end_date) {
    // ISO (UTC) -> the local "YYYY-MM-DDTHH:mm" a datetime-local input needs.
    const t = new Date(d.end_date);
    form.end_date = new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  return form;
}

// Also the Edit Lead page: /leads/:leadId/edit renders this with the lead
// loaded into the form. Documents are managed on the lead's own page, so
// the picker only appears when creating.
export function AddLeadPage() {
  const navigate = useNavigate();
  const { leadId } = useParams();
  const editing = !!leadId;
  const backTo = editing ? `/dashboard/leads/${leadId}` : "/dashboard/leads";
  const reduceMotion = useReducedMotion();
  const currentUser = tokenStorage.getUser();
  const { users, usersLoading, loadUsers } = useBidStore();
  const orgUsers = users.filter((u) => u.is_active !== false);

  const [form, setForm] = useState({
    publish_status: "",
    lead_type: "GOV",
    account_name: "",
    department_name: "",
    location: "",
    high_level_scope: "",
    expected_date: "",
    scope_type: "",
    category: "",
    estimated_value: "",
    // Published only: tender Section 1 fields not already captured above.
    title: "",
    gem_bid_no: "",
    start_date: "",
    end_date: "",
    portal_source: "GeM",
    bid_type: "BID",
    quantity: "",
    emd_amount: "",
    emd_not_applicable: false,
    emd_exemption_types: [],
    emd_exemption_reason: "",
    emd_bank_name: "",
    emd_account_number: "",
    emd_ifsc_code: "",
    emd_branch: "",
    emd_beneficiary: "",
    emd_payable_at: "",
    bg_required: false,
    bg_rate: "",
    bg_duration_months: "",
    lead_owner_id: currentUser?.id ?? "",
    reporting_manager_id: "",
  });
  const [products, setProducts] = useState([{ id: 1, product: "", description: "", qty: "", oem: "" }]);
  const [emdOnlineOn, setEmdOnlineOn] = useState(false);
  const [emdDdOn, setEmdDdOn] = useState(false);
  const [docs, setDocs] = useState(emptyDocs);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState("");
  const [loadState, setLoadState] = useState(editing ? "loading" : "ready"); // loading | ready | error

  useEffect(() => {
    if (!editing) return;
    let live = true;
    getLead(leadId)
      .then((res) => {
        if (!live) return;
        if (!res.ok || !res.data.can_edit) return setLoadState("error");
        const d = res.data.published_details || {};
        setForm((blank) => leadToForm(res.data, blank));
        if (d.requested_products?.length) setProducts(d.requested_products.map((p, i) => ({ id: i + 1, product: "", description: "", qty: "", oem: "", ...p })));
        setEmdOnlineOn(!!d.emd_online);
        setEmdDdOn(!!d.emd_dd);
        setLoadState("ready");
      })
      .catch(() => live && setLoadState("error"));
    return () => { live = false; };
  }, [editing, leadId]);

  const isPublished = form.publish_status === "PUBLISHED";

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate() {
    const e = {};
    if (!form.publish_status) e.publish_status = "Choose whether this lead is published";
    if (!form.account_name.trim()) e.account_name = "Account name is required";
    if (form.estimated_value && Number(form.estimated_value) < 0) e.estimated_value = "Cannot be negative";
    if (!form.lead_owner_id) e.lead_owner_id = "Lead owner is required";
    if (isPublished) {
      if (!form.title.trim()) e.title = "Tender title is required";
      Object.assign(e, validateEmd(form, emdOnlineOn, emdDdOn));
      const docError = editing ? "" : validateDocs(docs);
      if (docError) e.docs = docError;
    }
    return e;
  }

  function buildPayload() {
    const text = (v) => (v && v.trim() ? v.trim() : undefined);
    const num = (v) => (v === "" || v === null ? undefined : Number(v));
    const payload = {
      publish_status: form.publish_status,
      lead_type: form.lead_type,
      account_name: form.account_name.trim(),
      department_name: text(form.department_name),
      location: text(form.location),
      high_level_scope: text(form.high_level_scope),
      expected_date: form.expected_date || undefined,
      scope_type: text(form.scope_type),
      category: text(form.category),
      estimated_value: num(form.estimated_value),
      lead_owner_id: form.lead_owner_id,
      reporting_manager_id: form.reporting_manager_id || undefined,
    };
    if (isPublished) {
      payload.title = form.title.trim();
      // Same keys as the tender create payload, so a later Lead -> Bid
      // conversion can pass these straight through.
      payload.published_details = {
        gem_bid_no: text(form.gem_bid_no),
        start_date: form.start_date || undefined,
        end_date: form.end_date ? new Date(form.end_date).toISOString() : undefined,
        portal_source: text(form.portal_source),
        bid_type: form.bid_type,
        quantity: num(form.quantity),
        requested_products: products
          .filter((p) => p.product.trim() || p.description.trim())
          .map(({ product, description, qty, oem }) => ({ product, description, qty, oem })),
        emd_not_applicable: form.emd_not_applicable,
        emd_amount: num(form.emd_amount),
        emd_online: emdOnlineOn,
        emd_bank_name: text(form.emd_bank_name),
        emd_account_number: text(form.emd_account_number),
        emd_ifsc_code: text(form.emd_ifsc_code),
        emd_branch: text(form.emd_branch),
        emd_dd: emdDdOn,
        emd_beneficiary: text(form.emd_beneficiary),
        emd_payable_at: text(form.emd_payable_at),
        emd_exemption_types: form.emd_exemption_types,
        emd_exemption_reason: text(form.emd_exemption_reason),
        bg_required: form.bg_required,
        bg_rate: form.bg_required ? num(form.bg_rate) : undefined,
        bg_duration_months: form.bg_required ? num(form.bg_duration_months) : undefined,
      };
    }
    return payload;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (saving) return;
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      toast.error("Please fix the highlighted fields");
      // Errors can sit far up a long form (e.g. EMD); bring the first into view.
      requestAnimationFrame(() =>
        document
          .querySelector("form p.text-destructive, form p.text-red-500")
          ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" }),
      );
      return;
    }

    setSaving("Saving lead…");
    try {
      if (editing) {
        const res = await updateLead(leadId, buildPayload());
        if (!res.ok) {
          toast.error(res.error?.message ?? "Could not save the lead");
          return;
        }
        toast.success("Lead updated");
        navigate(backTo);
        return;
      }
      const res = await createLead(buildPayload());
      if (!res.ok) {
        toast.error(res.error?.message ?? "Could not create the lead");
        return;
      }
      const lead = res.data;
      const items = isPublished ? toUploadItems(docs) : [];
      if (items.length) {
        const failed = await uploadAll(lead.id, items, (i, n) => setSaving(`Uploading ${i} of ${n}…`));
        if (failed.length) {
          // The lead itself is saved; send the user to it so they can retry.
          toast.warning(
            `Lead saved, but ${failed.length} file${failed.length > 1 ? "s" : ""} failed: ${failed
              .map((f) => `${f.file.name} (${f.reason})`)
              .join(", ")}. Re-upload from the lead page.`,
            { duration: 10000 },
          );
          navigate(`/dashboard/leads/${lead.id}`);
          return;
        }
      }
      toast.success(items.length ? `Lead created with ${items.length} document${items.length > 1 ? "s" : ""}` : "Lead created");
      navigate(`/dashboard/leads/${lead.id}`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving("");
    }
  }

  const reveal = reduceMotion
    ? {}
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } };

  if (loadState !== "ready") {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Button type="button" variant="ghost" size="sm" onClick={() => navigate(backTo)} className="gap-1.5 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" />
          Back
        </Button>
        {loadState === "loading" ? (
          <div className="h-40 animate-pulse rounded-xl bg-muted/60" />
        ) : (
          <p className="rounded-xl border border-border bg-card px-6 py-14 text-center text-sm text-foreground">
            This lead cannot be edited by you at its current stage.
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto max-w-4xl space-y-6 pb-12">
      <Button type="button" variant="ghost" size="sm" onClick={() => navigate(backTo)} className="gap-1.5 text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" />
        {editing ? "Back to Lead" : "Back to Leads"}
      </Button>

      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">{editing ? "Edit Lead" : "Add Lead"}</h1>
        <p className="text-sm text-muted-foreground">
          {editing ? "Update this lead's details. The change is recorded on the lead's history." : "Capture a new opportunity. Published leads also take the tender details and RFP documents."}
        </p>
      </div>

      {/* Lead status: drives which sections appear below. */}
      <section aria-labelledby="lead-status-label" className="space-y-2">
        <p id="lead-status-label" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Lead Status <span className="font-bold text-destructive">*</span>
        </p>
        <div role="radiogroup" aria-labelledby="lead-status-label" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {STATUS_OPTIONS.map((o) => {
            const active = form.publish_status === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set("publish_status", o.value)}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]
                  ${active ? "border-primary bg-primary/5 ring-1 ring-primary" : errors.publish_status ? "border-destructive bg-card" : "border-border bg-card hover:border-primary/40"}`}
              >
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  <o.icon className="size-4" aria-hidden />
                </span>
                <span className="space-y-0.5">
                  <span className="block text-sm font-semibold text-foreground">{o.label}</span>
                  <span className="block text-xs text-muted-foreground">{o.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
        {errors.publish_status && <p className="text-xs font-medium text-destructive">{errors.publish_status}</p>}
      </section>

      <Panel icon={Building2} title="Lead Details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Account Name" required error={errors.account_name} tooltip="The client organisation this lead is for.">
            <FieldMemoryInput fieldKey="organization_name" value={form.account_name} onChange={(v) => set("account_name", v)} placeholder="e.g. NIC Delhi" className={inputCls(errors.account_name)} aria-label="Account name" />
          </Field>
          <Field label="Department / Ministry">
            <FieldMemoryInput fieldKey="department_name" value={form.department_name} onChange={(v) => set("department_name", v)} placeholder="e.g. Ministry of Electronics & IT" className={inputCls()} aria-label="Department or ministry" />
          </Field>
          <Field label="Location">
            <FieldMemoryInput fieldKey="location" value={form.location} onChange={(v) => set("location", v)} placeholder="e.g. New Delhi" className={inputCls()} aria-label="Location" />
          </Field>
          <Field label="Expected Date" tooltip="When this opportunity is expected to materialise.">
            <Input type="date" value={form.expected_date} onChange={(e) => set("expected_date", e.target.value)} className={inputCls()} aria-label="Expected date" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="High Level Scope">
              <Textarea value={form.high_level_scope} onChange={(e) => set("high_level_scope", e.target.value)} placeholder="Overall technical and operational scope…" className="min-h-[70px] bg-background text-sm" aria-label="High level scope" />
            </Field>
          </div>
          <Field label="Scope Type">
            <FieldMemoryInput fieldKey="scope_type" presetOptions={SCOPE_TYPES} maxSuggestions={10} value={form.scope_type} onChange={(v) => set("scope_type", v)} placeholder="Supply, Implementation, Support, or type your own" className={inputCls()} aria-label="Scope type" />
          </Field>
          <Field label="Category / Scope Group">
            <FieldMemoryInput fieldKey="category" presetOptions={STANDARD_CATEGORY_OPTIONS} maxSuggestions={14} value={form.category} onChange={(v) => set("category", v)} placeholder="Select a category, or type your own" className={inputCls()} aria-label="Category" />
          </Field>
          <Field label="Estimated Project Value (₹)" error={errors.estimated_value}>
            <Input type="number" min="0" inputMode="decimal" value={form.estimated_value} onChange={(e) => set("estimated_value", e.target.value)} placeholder="e.g. 5000000" className={inputCls(errors.estimated_value)} aria-label="Estimated project value" />
          </Field>
          <Field label="Lead Type" required>
            <Segmented label="Lead type" value={form.lead_type} onChange={(v) => set("lead_type", v)} options={[{ value: "GOV", label: "Government" }, { value: "PVT", label: "Private" }]} />
          </Field>
        </div>
      </Panel>

      <AnimatePresence initial={false}>
        {isPublished && (
          <motion.div key="published" {...reveal} className="space-y-6">
            <Panel icon={FileText} title="Tender Details">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Tender Title" required error={errors.title}>
                    <FieldMemoryInput fieldKey="title" value={form.title} onChange={(v) => set("title", v)} placeholder="e.g. Supply and Implementation of Enterprise Firewall" className={inputCls(errors.title)} aria-label="Tender title" />
                  </Field>
                </div>
                <Field label="BID Number / RFP Number">
                  <Input value={form.gem_bid_no} onChange={(e) => set("gem_bid_no", e.target.value)} placeholder="e.g. GEM/2026/B/87654" className={inputCls()} aria-label="Bid or RFP number" />
                </Field>
                <Field label="Portal Source">
                  <FieldMemoryInput fieldKey="portal_source" presetOptions={STANDARD_PORTAL_SOURCES} maxSuggestions={10} value={form.portal_source} onChange={(v) => set("portal_source", v)} placeholder="GeM, Private, RTC, CPPP, eProcure" className={inputCls()} aria-label="Portal source" />
                </Field>
                <Field label="Start Date">
                  <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} className={inputCls()} aria-label="Start date" />
                </Field>
                <Field label="End Date">
                  <Input type="datetime-local" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} className={inputCls()} aria-label="End date" />
                </Field>
                <Field label="Bid Type">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="h-9 w-full justify-between border-input bg-background text-sm font-normal text-foreground hover:bg-muted/50" aria-label="Bid type">
                        {form.bid_type === "BID_TO_RA" ? "BID to RA" : "BID"}
                        <ChevronDown className="ml-auto size-3.5 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[220px]">
                      {BID_TYPES.map((t) => (
                        <DropdownMenuItem key={t} onSelect={() => set("bid_type", t)}>
                          {t === "BID_TO_RA" ? "BID to RA" : "BID"}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Field>
                <Field label="Quantity">
                  <Input type="number" min="1" inputMode="numeric" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} placeholder="e.g. 100" className={inputCls()} aria-label="Quantity" />
                </Field>
              </div>

              <ProductsTable products={products} setProducts={setProducts} />
              <EmdBgSection
                form={form}
                set={set}
                setForm={setForm}
                errors={errors}
                setErrors={setErrors}
                emdOnlineOn={emdOnlineOn}
                setEmdOnlineOn={setEmdOnlineOn}
                emdDdOn={emdDdOn}
                setEmdDdOn={setEmdDdOn}
              />
            </Panel>

            {!editing && <Panel icon={FolderOpen} title="Documents">
              <p className="-mt-1 text-xs text-muted-foreground">
                Attach the RFP and anything that came with it. Files are saved to this lead's own folder.
              </p>
              <LeadDocumentPicker value={docs} onChange={(d) => { setDocs(d); setErrors((e) => ({ ...e, docs: undefined })); }} error={errors.docs} />
            </Panel>}
          </motion.div>
        )}
      </AnimatePresence>

      <Panel icon={Users} title="Ownership">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Lead Owner" required error={errors.lead_owner_id} tooltip="Defaults to you. Anyone in the organisation can own a lead.">
            <UserSelect id="lead-owner" users={orgUsers} loading={usersLoading} value={form.lead_owner_id} onChange={(v) => set("lead_owner_id", v)} placeholder="Select lead owner" invalid={!!errors.lead_owner_id} />
          </Field>
          <Field label="Reporting Manager">
            <UserSelect id="lead-manager" users={orgUsers} loading={usersLoading} value={form.reporting_manager_id} onChange={(v) => set("reporting_manager_id", v)} placeholder="Select reporting manager" allowNone />
          </Field>
        </div>
      </Panel>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => navigate(backTo)} disabled={!!saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={!!saving} className="min-w-36 gap-1.5">
          {saving ? <><Loader2 className="size-4 animate-spin" />{saving}</> : editing ? "Save Changes" : "Save Lead"}
        </Button>
      </div>
    </form>
  );
}
