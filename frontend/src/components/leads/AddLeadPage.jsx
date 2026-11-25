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
  Sparkles,
  CheckCircle2,
  FileUp,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FieldMemoryInput } from "@/components/ui/field-memory-input";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Field } from "../tenders/tenderFormParts";
import { TenderDetailsFields } from "./TenderDetailsFields";
import {
  SCOPE_TYPES,
  STANDARD_CATEGORY_OPTIONS,
  inputCls,
} from "../../lib/tenderSpec";
import { emptyDocs, toUploadItems, uploadAll, validateDocs, formatBytes } from "../../lib/leadDocs";
import { PUBLISHED_BLANK, blankProducts, buildPublishedDetails, validatePublished } from "../../lib/leadPublish";
import { LeadDocumentPicker } from "./LeadDocumentPicker";
import { UserSelect } from "./UserSelect";
import { createLead, getLead, updateLead, extractLeadDocument } from "../../services/leads";
import { tokenStorage } from "../../services/auth";
import { useBidStore } from "../../store/useBidStore";
import { UnsavedChangesDialog } from "../tenders/UnsavedChangesDialog";
import { actsAs } from "../../lib/roles";

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
    const t = new Date(d.end_date);
    form.end_date = new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  return form;
}

export function AddLeadPage() {
  const navigate = useNavigate();
  const { leadId } = useParams();
  const editing = !!leadId;
  const backTo = editing ? `/dashboard/leads/${leadId}` : "/dashboard/leads";
  const reduceMotion = useReducedMotion();
  const currentUser = tokenStorage.getUser();
  const { users, usersLoading, loadUsers, setUnsavedFormDirty } = useBidStore();
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
    ...PUBLISHED_BLANK,
    lead_owner_id: currentUser?.id ?? "",
    reporting_manager_id: "",
  });
  const [products, setProducts] = useState(blankProducts());
  const [emdOnlineOn, setEmdOnlineOn] = useState(false);
  const [emdDdOn, setEmdDdOn] = useState(false);
  const [docs, setDocs] = useState(emptyDocs);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState("");
  const [loadState, setLoadState] = useState(editing ? "loading" : "ready");
  const [initialSnapshot, setInitialSnapshot] = useState(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [pendingDiscardTarget, setPendingDiscardTarget] = useState(null);
  const [showExtractionSuccessDialog, setShowExtractionSuccessDialog] = useState(false);

  // AI extraction loading state
  const [extractingLead, setExtractingLead] = useState(false);

  const handleExtractLeadDocument = async () => {
    // Find candidate procurement file from docs.rows (e.g. RFP row) or docs.bulk
    const rfpRow =
      docs.rows.find((r) => /rfp|tender/i.test(r.category) && r.files.length > 0) ||
      docs.rows.find((r) => r.files.length > 0);
    const targetFile = rfpRow?.files?.[0] || docs.bulk?.[0];

    if (!targetFile) {
      toast.error("Please upload an RFP or procurement document first.");
      return;
    }
    setExtractingLead(true);
    try {
      const res = await extractLeadDocument(targetFile);
      if (!res.ok || !res.data) {
        toast.error(res.message || "Failed to extract lead data from document.");
        return;
      }
      const data = res.data;

      // Populate Lead Details & Published Tender Details from extraction
      setForm((prev) => {
        const next = { ...prev };

        // Lead Details fields
        if (data.account_name) next.account_name = data.account_name;
        if (data.department_name) next.department_name = data.department_name;
        if (data.location) next.location = data.location;
        if (data.high_level_scope) next.high_level_scope = data.high_level_scope;
        if (data.scope_type) next.scope_type = data.scope_type;
        if (data.category) next.category = data.category;
        if (data.lead_type) next.lead_type = data.lead_type;
        if (data.expected_date) {
          next.expected_date = String(data.expected_date).trim().split("T")[0];
        } else if (data.end_date) {
          next.expected_date = String(data.end_date).trim().split("T")[0];
        } else if (data.start_date) {
          next.expected_date = String(data.start_date).trim().split("T")[0];
        }

        if (data.estimated_value !== null && data.estimated_value !== undefined && String(data.estimated_value).trim() !== "" && Number(data.estimated_value) > 0) {
          next.estimated_value = String(Math.round(Number(data.estimated_value)));
        } else if (data.emd_amount && Number(data.emd_amount) > 0) {
          next.estimated_value = String(Math.round(Number(data.emd_amount) * 50));
        }

        // Published section fields (Tender Details)
        if (data.title) next.title = data.title;
        if (data.gem_bid_no) next.gem_bid_no = data.gem_bid_no;
        if (data.portal_source && data.portal_source !== "Other") next.portal_source = data.portal_source;
        if (data.tender_link) next.tender_link = data.tender_link;
        if (data.bid_type) next.bid_type = data.bid_type === "GEM" ? "BID" : data.bid_type;

        // Format start_date for HTML5 date input (YYYY-MM-DD)
        if (data.start_date) {
          next.start_date = String(data.start_date).trim().split("T")[0];
        } else if (data.end_date) {
          try {
            const endPart = String(data.end_date).trim().split("T")[0];
            const endD = new Date(endPart);
            if (!isNaN(endD.getTime())) {
              endD.setDate(endD.getDate() - 14);
              next.start_date = endD.toISOString().slice(0, 10);
            }
          } catch {
            // fallback
          }
        }

        // Format end_date for HTML5 datetime-local input (YYYY-MM-DDTHH:mm)
        if (data.end_date) {
          const strEnd = String(data.end_date).trim();
          let formattedEnd = strEnd;
          if (strEnd.includes("T")) {
            const parts = strEnd.split("T");
            const timePart = parts[1] ? parts[1].slice(0, 5) : "16:00";
            formattedEnd = `${parts[0]}T${timePart}`;
          } else if (/^\d{4}-\d{2}-\d{2}$/.test(strEnd)) {
            formattedEnd = `${strEnd}T16:00`;
          }
          next.end_date = formattedEnd;
        }

        // Quantity
        if (data.quantity !== undefined && data.quantity !== null && String(data.quantity).trim() !== "") {
          next.quantity = String(data.quantity);
        } else if (data.products && Array.isArray(data.products) && data.products.length > 0) {
          const firstQty = Number(data.products[0].qty || data.products[0].quantity);
          if (!isNaN(firstQty) && firstQty > 0) {
            next.quantity = String(firstQty);
          }
        }

        // EMD
        if (data.emd_not_applicable) {
          next.emd_not_applicable = true;
          next.emd_amount = "";
        } else if (data.emd_amount !== undefined && data.emd_amount !== null && String(data.emd_amount).trim() !== "") {
          next.emd_not_applicable = false;
          next.emd_amount = String(data.emd_amount);
        }

        if (data.emd_bank_name) next.emd_bank_name = data.emd_bank_name;
        if (data.emd_beneficiary) next.emd_beneficiary = data.emd_beneficiary;
        if (data.emd_payable_at) next.emd_payable_at = data.emd_payable_at;
        if (data.emd_account_number) next.emd_account_number = data.emd_account_number;
        if (data.emd_ifsc_code) next.emd_ifsc_code = data.emd_ifsc_code;
        if (data.emd_branch) next.emd_branch = data.emd_branch;

        if (data.emd_bank_name || data.emd_beneficiary || data.emd_payable_at || data.emd_account_number) {
          setEmdDdOn(true);
        }
        if (data.emd_online) setEmdOnlineOn(true);

        // Performance Security (BG)
        const hasBgRate = data.bg_rate !== undefined && data.bg_rate !== null && String(data.bg_rate).trim() !== "";
        const hasBgDur = data.bg_duration_months !== undefined && data.bg_duration_months !== null && String(data.bg_duration_months).trim() !== "";

        if (data.bg_required !== undefined) {
          next.bg_required = Boolean(data.bg_required);
        } else if (hasBgRate || hasBgDur) {
          next.bg_required = true;
        }

        if (next.bg_required) {
          if (hasBgRate) {
            const cleanRate = String(data.bg_rate).replace(/[^\d.]/g, "").trim();
            next.bg_rate = cleanRate || "10";
          } else {
            next.bg_rate = "10"; // standard default when BG is required
          }

          if (hasBgDur) {
            const cleanDur = String(data.bg_duration_months).replace(/[^\d]/g, "").trim();
            next.bg_duration_months = cleanDur || "12";
          } else {
            next.bg_duration_months = "12"; // standard default when BG is required
          }
        } else {
          next.bg_rate = "";
          next.bg_duration_months = "";
        }

        // Ownership auto-assignment if empty
        if (!next.lead_owner_id && currentUser?.id) {
          next.lead_owner_id = currentUser.id;
        } else if (!next.lead_owner_id && orgUsers.length > 0) {
          next.lead_owner_id = orgUsers[0].id;
        }
        if (!next.reporting_manager_id) {
          const candidateManager =
            orgUsers.find((u) => u.id === currentUser?.reporting_manager_id) ||
            orgUsers.find(
              (u) =>
                u.id !== (next.lead_owner_id || currentUser?.id) &&
                (actsAs(u, "MANAGER") || actsAs(u, "ADMIN") || actsAs(u, "SUPER_ADMIN"))
            ) ||
            orgUsers.find(
              (u) =>
                actsAs(u, "MANAGER") || actsAs(u, "ADMIN") || actsAs(u, "SUPER_ADMIN")
            );
          if (candidateManager) next.reporting_manager_id = candidateManager.id;
        }

        return next;
      });

      // Populate products in Published section
      if (data.products && Array.isArray(data.products) && data.products.length > 0) {
        setProducts(
          data.products.map((p, idx) => ({
            id: Date.now() + idx,
            product: p.product || p.name || "",
            description: p.description || p.specifications || "",
            qty: String(p.qty || p.quantity || "1"),
            oem: p.oem || p.oem_name || "",
          }))
        );
      }

      setShowExtractionSuccessDialog(true);
    } catch (err) {
      console.error("Extraction error:", err);
      toast.error("Failed to extract document. Please check microservice connectivity.");
    } finally {
      setExtractingLead(false);
    }
  };

  useEffect(() => {
    if (!editing) return;
    let live = true;
    getLead(leadId)
      .then((res) => {
        if (!live) return;
        if (!res.ok || !res.data.can_edit) return setLoadState("error");
        const d = res.data.published_details || {};
        const loadedForm = leadToForm(res.data, {
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
          ...PUBLISHED_BLANK,
          lead_owner_id: "",
          reporting_manager_id: "",
        });
        setForm(loadedForm);
        const loadedProducts = d.requested_products?.length
          ? d.requested_products.map((p, i) => ({ id: i + 1, product: "", description: "", qty: "", oem: "", ...p }))
          : blankProducts();
        setProducts(loadedProducts);
        const loadedOnline = !!d.emd_online;
        const loadedDd = !!d.emd_dd;
        setEmdOnlineOn(loadedOnline);
        setEmdDdOn(loadedDd);
        setInitialSnapshot(JSON.stringify({
          form: loadedForm,
          products: loadedProducts,
          emdOnlineOn: loadedOnline,
          emdDdOn: loadedDd,
        }));
        setLoadState("ready");
      })
      .catch(() => live && setLoadState("error"));
    return () => { live = false; };
  }, [editing, leadId]);

  const isPublished = form.publish_status === "PUBLISHED";

  const isDirty = editing
    ? Boolean(
      initialSnapshot &&
      JSON.stringify({ form, products, emdOnlineOn, emdDdOn }) !== initialSnapshot
    )
    : Boolean(
      form.publish_status ||
      form.account_name?.trim() ||
      form.department_name?.trim() ||
      form.location?.trim() ||
      form.high_level_scope?.trim() ||
      form.expected_date ||
      form.scope_type?.trim() ||
      form.category?.trim() ||
      form.estimated_value ||
      form.lead_type !== "GOV" ||
      form.reporting_manager_id ||
      form.title?.trim() ||
      form.gem_bid_no?.trim() ||
      form.tender_link?.trim() ||
      form.start_date ||
      form.end_date ||
      form.quantity ||
      form.emd_amount ||
      form.emd_bank_name?.trim() ||
      form.emd_beneficiary?.trim() ||
      form.emd_payable_at?.trim() ||
      form.bg_required ||
      form.bg_rate ||
      emdOnlineOn ||
      emdDdOn ||
      products.length > 1 ||
      Boolean(products[0]?.product?.trim() || products[0]?.description?.trim() || products[0]?.qty || products[0]?.oem?.trim()) ||
      docs.bulk?.length > 0 ||
      docs.rows?.some((r) => r.files?.length > 0)
    );

  useEffect(() => {
    setUnsavedFormDirty(isDirty, {
      formName: editing ? "Edit Lead" : "Add Lead",
      title: editing ? "Discard Unsaved Lead Changes?" : "Discard Incomplete Lead Form?",
      description: editing
        ? "You have modified lead details that have not been saved yet. Leaving this section will discard your modifications."
        : "You have entered lead information and specifications that have not been saved yet. Leaving this section will discard all your entered progress.",
      confirmLabel: "Leave Section",
      cancelLabel: "Keep Editing",
    });
    return () => setUnsavedFormDirty(false, null);
  }, [isDirty, editing, setUnsavedFormDirty]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    const handlePopState = (e) => {
      if (isDirty) {
        window.history.pushState(null, "", window.location.href);
        setPendingDiscardTarget(backTo);
        setShowDiscardDialog(true);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isDirty, backTo]);

  const handleSafeBack = (targetUrl) => {
    if (isDirty) {
      setPendingDiscardTarget(targetUrl);
      setShowDiscardDialog(true);
    } else {
      navigate(targetUrl);
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardDialog(false);
    setUnsavedFormDirty(false, null);
    navigate(pendingDiscardTarget || backTo);
  };

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
      Object.assign(e, validatePublished(form, emdOnlineOn, emdDdOn));
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
      payload.published_details = buildPublishedDetails(form, products, emdOnlineOn, emdDdOn);
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
        setUnsavedFormDirty(false, null);
        toast.success("Lead updated");
        navigate(`/dashboard/leads/${leadId}`);
        return;
      }

      const res = await createLead(buildPayload());
      if (!res.ok) {
        toast.error(res.error?.message ?? "Could not create the lead");
        return;
      }
      const created = res.data;
      const items = isPublished ? toUploadItems(docs) : [];
      if (items.length) {
        setSaving(`Uploading 0 of ${items.length} documents…`);
        const failed = await uploadAll(created.id, items, (done, total) =>
          setSaving(`Uploading ${done} of ${total} documents…`),
        );
        setUnsavedFormDirty(false, null);
        if (failed.length) {
          toast.warning(`Lead created, but ${failed.length} document(s) could not be uploaded`);
        } else {
          toast.success(`Lead created with ${items.length} document${items.length === 1 ? "" : "s"}`);
        }
      } else {
        setUnsavedFormDirty(false, null);
        toast.success("Lead created");
      }
      navigate(`/dashboard/leads/${created.id}`);
    } catch {
      toast.error("Network error while saving the lead");
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
        <Button type="button" variant="ghost" size="sm" onClick={() => handleSafeBack(backTo)} className="gap-1.5 text-muted-foreground hover:text-foreground">
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
      <Button id="back-to-leads-btn" type="button" variant="ghost" size="sm" onClick={() => handleSafeBack(backTo)} className="gap-1.5 text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" />
        {editing ? "Back to Lead" : "Back to Leads"}
      </Button>

      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">{editing ? "Edit Lead" : "Add Lead"}</h1>
        <p className="text-sm text-muted-foreground">
          {editing ? "Update this lead's details. The change is recorded on the lead's history." : "Capture a new opportunity. Published leads also take the tender details and RFP documents."}
        </p>
      </div>

      {editing ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Status: <span className="font-semibold text-foreground">{isPublished ? "Published" : "Unpublished"}</span>.{" "}
          {isPublished ? "A published lead cannot go back to unpublished." : "When the RFP comes out, use Publish Lead on the lead page to add its tender details."}
        </p>
      ) : (
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
      )}

      {/* When the lead is published, bring the Documents section to the top with Extract Document */}
      {!editing && isPublished && (
        <Panel icon={FolderOpen} title="Documents">
          <p className="-mt-1 text-xs text-muted-foreground">
            Attach the RFP and anything that came with it. Upload your document and click <strong className="text-foreground font-medium">Extract Document</strong> to auto-fill fields. Files are saved to this lead's own folder.
          </p>
          <LeadDocumentPicker
            value={docs}
            onChange={(d) => {
              setDocs(d);
              setErrors((e) => ({ ...e, docs: undefined }));
            }}
            error={errors.docs}
            action={
              <Button
                id="extract-lead-doc-btn"
                type="button"
                disabled={extractingLead}
                onClick={handleExtractLeadDocument}
                className="shrink-0 gap-2 font-medium px-4 h-9 shadow-xs transition-all active:scale-95 text-xs sm:text-sm"
              >
                {extractingLead ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Extracting...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5" />
                    <span>Extract Document</span>
                  </>
                )}
              </Button>
            }
          />
        </Panel>
      )}

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
            </Panel>
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
        <Button id="cancel-lead-btn" type="button" variant="outline" onClick={() => handleSafeBack(backTo)} disabled={!!saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={!!saving} className="min-w-36 gap-1.5">
          {saving ? <><Loader2 className="size-4 animate-spin" />{saving}</> : editing ? "Save Changes" : "Save Lead"}
        </Button>
      </div>

      <UnsavedChangesDialog
        open={showDiscardDialog}
        title={editing ? "Discard Unsaved Lead Changes?" : "Discard Incomplete Lead Form?"}
        description={
          editing
            ? "You have modified lead details that have not been saved yet. Leaving this page will discard your modifications."
            : "You have entered lead information and specifications that have not been saved yet. Leaving this page will discard all your entered progress."
        }
        confirmLabel="Leave Page"
        cancelLabel="Keep Editing"
        onConfirm={handleConfirmDiscard}
        onCancel={() => setShowDiscardDialog(false)}
      />

      {/* Document Extraction Success Dialog */}
      <Dialog open={showExtractionSuccessDialog} onOpenChange={setShowExtractionSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="size-5" />
              </div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Document Extracted Successfully
              </DialogTitle>
            </div>
            <DialogDescription className="pt-2 text-sm text-foreground/85 leading-relaxed">
              Document processing completed successfully! Lead information has been automatically populated. You can now review and make any necessary changes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button
                id="confirm-extraction-success-btn"
                type="button"
                onClick={() => setShowExtractionSuccessDialog(false)}
                className="w-full sm:w-auto min-w-24"
              >
                OK
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
