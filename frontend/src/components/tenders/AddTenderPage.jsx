import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  Building2,
  FileText,
  ChevronLeft,
  Zap,
  PenLine,
  ShieldCheck,
  ChevronDown,
  Check,
  Plus,
  Trash2,
  CheckSquare,
  Award,
  ArrowRight,
  ArrowLeft,
  Shuffle,
} from "lucide-react";
import { toast } from "sonner";
import {
  ALERT_NOTE_COLORS,
  ALERT_NOTE_PRESETS,
  randomAlertNoteColor,
} from "../../lib/tenderFormat";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldMemoryInput } from "@/components/ui/field-memory-input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EmdBgSection, Field, ProductsTable } from "./tenderFormParts";
import {
  BID_TYPES,
  SCOPE_TYPES,
  STANDARD_CATEGORY_OPTIONS,
  STANDARD_PORTAL_SOURCES,
  TENDER_LINK_ERROR,
  inputCls,
  isHttpUrl,
  validateEmd,
} from "../../lib/tenderSpec";
import { createBid } from "../../services/bids";
import { tokenStorage } from "../../services/auth";
import { useBidStore } from "../../store/useBidStore";

const BIDDER_SUGGESTIONS = [
  "Experience Certificate",
  "Company Information Docs",
  "Non-blacklisted Forms",
  "Bidder Turnover",
  "Technical Compliance Sheet",
];

const OEM_SUGGESTIONS = [
  "MAF Certificate",
  "MII Certificate",
  "No Malicious Certificate",
];

export function AddTenderPage() {
  const navigate = useNavigate();
  const currentUser = tokenStorage.getUser();

  const {
    users,
    usersLoading,
    loadUsers,
    learnFieldValue,
    systemConfigs,
    loadSystemConfigs,
  } = useBidStore();

  // Stepper state
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(0); // -1 for back, 1 for forward

  const [form, setForm] = useState({
    creation_mode: "MANUAL",
    title: "",
    high_level_scope: "",
    gem_bid_no: "",
    organization_name: "",
    department_name: "",
    location: "",
    portal_source: "GeM",
    tender_link: "",
    bid_type: "BID",
    category: "",
    quantity: "",
    estimated_value: "",
    emd_amount: "",
    emd_not_applicable: false,
    emd_exemption_types: [],
    emd_exemption_reason: "",
    oem_required: true,
    bg_required: false,
    bg_rate: "",
    bg_duration_months: "",
    start_date: "",
    end_date: "",
    target_month_date: "",
    bid_owner_id: currentUser?.id ?? "",
    reporting_manager_id: "",
    account_manager_id: "",
    presales_id: "",
    remarks: "",
    scope_type: "Supply",
    // EMD bank/online payment details
    emd_bank_name: "",
    emd_account_number: "",
    emd_ifsc_code: "",
    emd_branch: "",
    // EMD DD (Demand Draft) details
    emd_beneficiary: "",
    emd_payable_at: "",
  });

  // Dynamic checklists seed input list split for Bidder and OEM
  const [bidderChecklists, setBidderChecklists] = useState([]);
  const [oemChecklists, setOemChecklists] = useState([]);
  const [newBidderItem, setNewBidderItem] = useState("");
  const [newOemItem, setNewOemItem] = useState("");

  // Products/Services Asked in the RFP — freeform rows, OEM is optional per row
  const [products, setProducts] = useState([
    { id: 1, product: "", description: "", qty: "", oem: "" },
  ]);

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  // Online/DD are independent raw-capture toggles — a tender document can
  // offer either, both, or neither (if fully exempt). Kept outside `form` so
  // unticking one can clear just its own fields without touching the other.
  const [emdOnlineOn, setEmdOnlineOn] = useState(false);
  const [emdDdOn, setEmdDdOn] = useState(false);

  // Optional "Additional Info / Challenge" note — a colored label + free
  // text surfaced in the identification alert/mail so a known issue gets
  // noticed immediately rather than buried in a plain remarks field.
  const [showAlertNote, setShowAlertNote] = useState(false);
  const [alertNoteText, setAlertNoteText] = useState("");
  const [alertNoteLabel, setAlertNoteLabel] = useState("");
  const [alertNoteColor, setAlertNoteColor] = useState("amber");

  // Account Manager is required (approving authority); Pre-Sales is optional —
  // both filtered to users holding that role as primary or secondary.
  const accountManagers = users.filter(
    (u) => Array.isArray(u.roles) && u.roles.includes("ACCOUNT_MANAGER"),
  );
  const presalesUsers = users.filter(
    (u) => Array.isArray(u.roles) && u.roles.includes("PRE_SALES"),
  );

  // Load users and system configurations
  useEffect(() => {
    loadUsers();
    loadSystemConfigs();
  }, [loadUsers, loadSystemConfigs]);

  const requireAmPresales = systemConfigs?.stage2_require_am_presales !== false;

  // Pre-fill bid owner if users loaded
  useEffect(() => {
    if (currentUser?.id && !form.bid_owner_id) {
      setForm((f) => ({ ...f, bid_owner_id: currentUser.id }));
    }
  }, [currentUser, form.bid_owner_id]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validateStep(currentStep) {
    const e = {};
    if (currentStep === 1) {
      if (!form.title.trim()) e.title = "Tender title is required";
      if (!form.bid_type) e.bid_type = "Bid type is required";
      if (form.tender_link.trim() && !isHttpUrl(form.tender_link.trim()))
        e.tender_link = TENDER_LINK_ERROR;
      // The Account Manager decides which EMD route to go with, later, in
      // Primary Review.
      Object.assign(e, validateEmd(form, emdOnlineOn, emdDdOn));
    } else if (currentStep === 2) {
      if (!form.bid_owner_id && !currentUser?.id)
        e.bid_owner_id = "Bid owner is required";
      // Account Manager is optional even when Stage 2 config is enabled
    }
    return e;
  }

  function nextStep() {
    const e = validateStep(step);
    if (Object.keys(e).length > 0) {
      setErrors(e);
      toast.error("Please fill required fields before proceeding");
      return;
    }
    setDirection(1);
    setStep(2);
  }

  function prevStep() {
    setDirection(-1);
    setStep(1);
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    const e = validateStep(step);
    if (Object.keys(e).length > 0) {
      setErrors(e);
      toast.error("Please resolve validation errors");
      return;
    }

    setLoading(true);
    try {
      const activeOwnerId = form.bid_owner_id || currentUser?.id || "";
      const cleanProducts = products
        .filter((p) => p.product.trim() || p.description.trim())
        .map(({ id, ...rest }) => rest);

      const payload = {
        ...form,
        bid_owner_id: activeOwnerId,
        tender_link: form.tender_link.trim(),
        presales_id: form.presales_id || undefined,
        quantity: form.quantity ? Number(form.quantity) : undefined,
        estimated_value: form.estimated_value
          ? Number(form.estimated_value)
          : undefined,
        emd_amount: form.emd_amount ? Number(form.emd_amount) : undefined,
        bg_rate:
          form.bg_required && form.bg_rate ? Number(form.bg_rate) : undefined,
        bg_duration_months:
          form.bg_required && form.bg_duration_months
            ? Number(form.bg_duration_months)
            : undefined,
        requested_products:
          cleanProducts.length > 0 ? JSON.stringify(cleanProducts) : undefined,
        alert_note:
          showAlertNote && alertNoteText.trim()
            ? JSON.stringify({
                text: alertNoteText.trim(),
                label: alertNoteLabel.trim(),
                color: alertNoteColor,
              })
            : undefined,
        start_date: form.start_date
          ? new Date(form.start_date).toISOString()
          : undefined,
        end_date: form.end_date
          ? new Date(form.end_date).toISOString()
          : undefined,
        opening_date: form.start_date
          ? new Date(form.start_date).toISOString()
          : undefined,
        closing_date: form.end_date
          ? new Date(form.end_date).toISOString()
          : undefined,
        target_month_date: form.target_month_date
          ? new Date(form.target_month_date).toISOString()
          : undefined,
        bidder_checklists: bidderChecklists.map(
          (item) => `[Bidder] ${item.replace(/^\[(Bidder|OEM)\]\s*/i, "")}`,
        ),
        oem_checklists: oemChecklists.map(
          (item) => `[OEM] ${item.replace(/^\[(Bidder|OEM)\]\s*/i, "")}`,
        ),
      };

      // Remove empty strings
      Object.keys(payload).forEach((k) => {
        if (payload[k] === "" || payload[k] === undefined) delete payload[k];
      });

      const res = await createBid(payload);
      if (res.ok) {
        // Field Memory: make the values just typed available as suggestions
        // right away, without waiting for a refetch of each field's list.
        learnFieldValue("title", form.title);
        learnFieldValue("organization_name", form.organization_name);
        learnFieldValue("department_name", form.department_name);
        learnFieldValue("location", form.location);
        learnFieldValue("portal_source", form.portal_source);
        learnFieldValue("category", form.category);
        learnFieldValue("scope_type", form.scope_type);
        learnFieldValue("emd_bank_name", form.emd_bank_name);
        learnFieldValue("emd_beneficiary", form.emd_beneficiary);
        learnFieldValue("emd_payable_at", form.emd_payable_at);
        cleanProducts.forEach((p) => {
          learnFieldValue("oem", p.oem);
          learnFieldValue("product", p.product);
        });

        toast.success("Tender workspace created successfully!");
        navigate("/dashboard/tenders");
      } else {
        toast.error(res.error?.message ?? "Failed to create tender");
      }
    } catch {
      toast.error("Network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const stepsInfo = [
    { num: 1, label: "Core Specifications & Financial Scope", icon: FileText },
    { num: 2, label: "Team Assignment & Checklist Seeds", icon: ShieldCheck },
  ];

  // Checklist Helpers
  const addBidderSuggestion = (item) => {
    if (!bidderChecklists.includes(item))
      setBidderChecklists((prev) => [...prev, item]);
  };
  const addOemSuggestion = (item) => {
    if (!oemChecklists.includes(item))
      setOemChecklists((prev) => [...prev, item]);
  };
  const addCustomBidder = () => {
    if (
      newBidderItem.trim() &&
      !bidderChecklists.includes(newBidderItem.trim())
    ) {
      setBidderChecklists((prev) => [...prev, newBidderItem.trim()]);
      setNewBidderItem("");
    }
  };
  const addCustomOem = () => {
    if (newOemItem.trim() && !oemChecklists.includes(newOemItem.trim())) {
      setOemChecklists((prev) => [...prev, newOemItem.trim()]);
      setNewOemItem("");
    }
  };
  const removeBidderItem = (idx) =>
    setBidderChecklists((prev) => prev.filter((_, i) => i !== idx));
  const removeOemItem = (idx) =>
    setOemChecklists((prev) => prev.filter((_, i) => i !== idx));

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Breadcrumb / Back Button */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/dashboard/tenders")}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to Tenders
        </Button>
      </div>

      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold font-heading tracking-tight text-foreground">
          Add New Tender
        </h1>
        <p className="text-sm text-muted-foreground">
          Fill in specifications, financials, timelines, and document checklists
          to initialize a new GeM bid workspace.
        </p>
      </div>

      {/* Stepper Progress Bar */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          {stepsInfo.map((s, i) => {
            const isCompleted = step > s.num;
            const isActive = step === s.num;
            return (
              <React.Fragment key={s.num}>
                <div
                  className="flex items-center gap-2.5 cursor-pointer"
                  onClick={() => {
                    if (s.num < step) {
                      setDirection(-1);
                      setStep(s.num);
                    } else if (s.num > step) {
                      nextStep();
                    }
                  }}
                >
                  <div
                    className={`size-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all duration-300
                    ${
                      isCompleted
                        ? "bg-primary border-primary text-primary-foreground"
                        : isActive
                          ? "bg-primary/10 border-primary text-primary ring-4 ring-primary/10 scale-105"
                          : "bg-background border-border text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? <Check className="size-4" /> : s.num}
                  </div>
                  <div className="hidden md:block text-left">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider block leading-tight
                      ${isActive ? "text-primary" : "text-muted-foreground"}`}
                    >
                      Section {s.num}
                    </span>
                    <span
                      className={`text-xs font-medium block leading-none mt-0.5
                      ${isActive ? "text-foreground" : "text-muted-foreground/80"}`}
                    >
                      {s.label}
                    </span>
                  </div>
                </div>
                {i < stepsInfo.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-2 rounded-full transition-colors duration-300 ${step > s.num ? "bg-primary" : "bg-border"}`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Main Wizard Form Container */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-md min-h-[460px] flex flex-col">
        <div className="p-6 flex-1">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: direction > 0 ? 30 : -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction > 0 ? -30 : 30 }}
              transition={{ type: "spring", stiffness: 450, damping: 35 }}
              className="space-y-6"
            >
              {/* SECTION 1: Core Specifications, Financials & Dates */}
              {step === 1 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 border-b border-border/60 pb-2.5">
                    <FileText className="size-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">
                      Section 1: Basic Specifications & Financial Scope
                    </h3>
                  </div>

                  {/* BUBBLE: Account & Tender Identity */}
                  <div className="space-y-4 border border-border/80 rounded-xl p-4 bg-muted/5">
                    <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                      <Building2 className="size-4 text-primary" />
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Account & Tender Identity
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Account Name (the procuring authority / client organization) */}
                      <Field
                        label="Account Name"
                        tooltip="The procuring authority / client organization for this tender."
                      >
                        <FieldMemoryInput
                          fieldKey="organization_name"
                          value={form.organization_name}
                          onChange={(v) => set("organization_name", v)}
                          placeholder="e.g. NIC Delhi"
                          className={inputCls()}
                        />
                      </Field>

                      {/* Department / Ministry */}
                      <Field label="Department / Ministry">
                        <FieldMemoryInput
                          fieldKey="department_name"
                          value={form.department_name}
                          onChange={(v) => set("department_name", v)}
                          placeholder="e.g. Ministry of Electronics & IT"
                          className={inputCls()}
                        />
                      </Field>

                      {/* Location */}
                      <Field label="Location">
                        <FieldMemoryInput
                          fieldKey="location"
                          value={form.location}
                          onChange={(v) => set("location", v)}
                          placeholder="e.g. New Delhi"
                          className={inputCls()}
                        />
                      </Field>

                      {/* Tender Title */}
                      <div className="sm:col-span-2">
                        <Field
                          label="Tender Title"
                          error={errors.title}
                          required
                          tooltip="The primary title of the tender."
                        >
                          <FieldMemoryInput
                            fieldKey="title"
                            value={form.title}
                            onChange={(v) => set("title", v)}
                            placeholder="e.g. Supply and Implementation of Enterprise Firewall"
                            className={inputCls(errors.title)}
                          />
                        </Field>
                      </div>

                      {/* BID / RFP Number */}
                      <Field
                        label="BID Number/RFP Number"
                        tooltip="The BID number or RFP number as listed on the source portal."
                      >
                        <Input
                          value={form.gem_bid_no}
                          onChange={(e) => set("gem_bid_no", e.target.value)}
                          placeholder="e.g. GEM/2026/B/87654 or RFP/2026/012"
                          className={inputCls()}
                        />
                      </Field>

                      {/* High Level Scope */}
                      <div className="sm:col-span-2">
                        <Field
                          label="High Level Scope"
                          tooltip="Summary of high level work scope and deliverables."
                        >
                          <Textarea
                            value={form.high_level_scope}
                            onChange={(e) =>
                              set("high_level_scope", e.target.value)
                            }
                            placeholder="Detail overall technical and operational scope..."
                            className="text-sm min-h-[70px] bg-background"
                          />
                        </Field>
                      </div>

                      {/* Dates */}
                      <Field label="Start Date">
                        <Input
                          type="date"
                          value={form.start_date}
                          onChange={(e) => set("start_date", e.target.value)}
                          className={inputCls()}
                        />
                      </Field>

                      <Field label="End Date">
                        <Input
                          type="datetime-local"
                          value={form.end_date}
                          onChange={(e) => set("end_date", e.target.value)}
                          className={inputCls()}
                        />
                      </Field>

                      {/* Portal Source — typable dropdown: pick a preset or
                        type your own; whatever's typed is remembered and
                        suggested next time (Field Memory), same as Category
                        and Scope Type below. */}
                      <Field label="Portal Source">
                        <FieldMemoryInput
                          fieldKey="portal_source"
                          presetOptions={STANDARD_PORTAL_SOURCES}
                          maxSuggestions={10}
                          value={form.portal_source}
                          onChange={(v) => set("portal_source", v)}
                          placeholder="GeM, Private, RTC, CPPP, eProcure, or type your own"
                          className={inputCls()}
                        />
                      </Field>

                      {/* Where the tender was discovered (portal / notice URL). */}
                      <Field
                        label="Tender Link"
                        tooltip="Link to the page where this tender was found. Shown as a clickable link on the tender overview."
                        error={errors.tender_link}
                      >
                        <Input
                          type="url"
                          value={form.tender_link}
                          onChange={(e) => set("tender_link", e.target.value)}
                          placeholder="https://bidplus.gem.gov.in/..."
                          className={inputCls(errors.tender_link)}
                        />
                      </Field>

                      {/* Bid Type (BID / BID_TO_RA) */}
                      <Field label="Bid Type" error={errors.bid_type} required>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-9 text-xs font-normal justify-between bg-background border-input text-foreground hover:bg-muted/50 gap-1.5"
                            >
                              <span>
                                {form.bid_type === "BID_TO_RA"
                                  ? "BID to RA"
                                  : "BID"}
                              </span>
                              <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-[220px]">
                            {BID_TYPES.map((t) => (
                              <DropdownMenuItem
                                key={t}
                                onSelect={() => set("bid_type", t)}
                              >
                                {t === "BID_TO_RA" ? "BID to RA" : "BID"}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </Field>

                      {/* Category / Scope Group */}
                      <Field label="Category / Scope Group">
                        <FieldMemoryInput
                          fieldKey="category"
                          presetOptions={STANDARD_CATEGORY_OPTIONS}
                          maxSuggestions={14}
                          value={form.category}
                          onChange={(v) => set("category", v)}
                          placeholder="Select a category, or type your own"
                          className={inputCls()}
                        />
                      </Field>

                      {/* Scope Type */}
                      <Field label="Scope Type">
                        <FieldMemoryInput
                          fieldKey="scope_type"
                          presetOptions={SCOPE_TYPES}
                          maxSuggestions={10}
                          value={form.scope_type}
                          onChange={(v) => set("scope_type", v)}
                          placeholder="Supply, Implementation, Support, or type your own"
                          className={inputCls()}
                        />
                      </Field>

                      {/* Every tender is for some number of units or licences. */}
                      <Field label="Quantity">
                        <Input
                          type="number"
                          min="1"
                          value={form.quantity}
                          onChange={(e) => set("quantity", e.target.value)}
                          placeholder="e.g. 100"
                          className={inputCls()}
                        />
                      </Field>

                      {/* Financial Fields */}
                      <Field label="Estimated Tender Value (₹)">
                        <Input
                          type="number"
                          value={form.estimated_value}
                          onChange={(e) =>
                            set("estimated_value", e.target.value)
                          }
                          placeholder="e.g. 5000000"
                          className={inputCls()}
                        />
                      </Field>
                    </div>
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
                </div>
              )}

              {/* SECTION 2: Ownership, Reporting Manager & Checklist Seeds */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 border-b border-border/60 pb-2.5">
                    <ShieldCheck className="size-4 text-violet-500" />
                    <h3 className="text-sm font-semibold text-foreground">
                      Section 2: Team Assignment & Checklist Seeds
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Bid Owner selection */}
                    <Field
                      label="Bid Owner"
                      error={errors.bid_owner_id}
                      required
                      tooltip="Defaults to the logged in user."
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={`w-full h-9 text-xs font-normal justify-between bg-background text-foreground hover:bg-muted/50 gap-1.5 ${errors.bid_owner_id ? "border-destructive" : "border-input"}`}
                          >
                            <span>
                              {form.bid_owner_id
                                ? (users.find((u) => u.id === form.bid_owner_id)
                                    ?.full_name ??
                                  currentUser?.full_name ??
                                  "Select Owner...")
                                : (currentUser?.full_name ?? "Select Owner...")}
                            </span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="max-h-60 overflow-y-auto w-[320px]">
                          <DropdownMenuLabel>Select Owner</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {usersLoading ? (
                            <DropdownMenuItem disabled>
                              Loading users…
                            </DropdownMenuItem>
                          ) : (
                            users.map((u) => (
                              <DropdownMenuItem
                                key={u.id}
                                onSelect={() => set("bid_owner_id", u.id)}
                              >
                                {u.full_name}
                              </DropdownMenuItem>
                            ))
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Field>

                    {/* Reporting Manager selection */}
                    <Field
                      label="Reporting Manager"
                      tooltip="Notified when this tender is discovered and tracked as a tender member."
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-9 text-xs font-normal justify-between bg-background text-foreground hover:bg-muted/50 gap-1.5 border-input"
                          >
                            <span>
                              {form.reporting_manager_id
                                ? (users.find(
                                    (u) => u.id === form.reporting_manager_id,
                                  )?.full_name ?? "Select Manager...")
                                : "Select Reporting Manager..."}
                            </span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="max-h-60 overflow-y-auto w-[320px]">
                          <DropdownMenuLabel>
                            Select Reporting Manager
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {usersLoading ? (
                            <DropdownMenuItem disabled>
                              Loading users…
                            </DropdownMenuItem>
                          ) : (
                            users.map((u) => (
                              <DropdownMenuItem
                                key={u.id}
                                onSelect={() =>
                                  set("reporting_manager_id", u.id)
                                }
                              >
                                {u.full_name}
                              </DropdownMenuItem>
                            ))
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Field>

                    {/* Account Manager selection — optional */}
                    <Field
                      label="Account Manager (Optional)"
                      error={errors.account_manager_id}
                      required={false}
                      tooltip="Optional. When unassigned, Primary Review can be handled by the Bid Owner, Reporting Manager, or Manager."
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={`w-full h-9 text-xs font-normal justify-between bg-background text-foreground hover:bg-muted/50 gap-1.5 ${errors.account_manager_id ? "border-destructive" : "border-input"}`}
                          >
                            <span>
                              {form.account_manager_id
                                ? (accountManagers.find(
                                    (u) => u.id === form.account_manager_id,
                                  )?.full_name ?? "Select Account Manager...")
                                : "None (Unassigned)"}
                            </span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="max-h-60 overflow-y-auto w-[320px]">
                          <DropdownMenuLabel>
                            Select Account Manager
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => set("account_manager_id", "")}
                          >
                            <span className="text-muted-foreground italic">
                              None (Unassigned)
                            </span>
                          </DropdownMenuItem>
                          {usersLoading ? (
                            <DropdownMenuItem disabled>
                              Loading users…
                            </DropdownMenuItem>
                          ) : accountManagers.length === 0 ? (
                            <DropdownMenuItem disabled>
                              No users hold the Account Manager role yet
                            </DropdownMenuItem>
                          ) : (
                            accountManagers.map((u) => (
                              <DropdownMenuItem
                                key={u.id}
                                onSelect={() => set("account_manager_id", u.id)}
                              >
                                {u.full_name}
                              </DropdownMenuItem>
                            ))
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Field>

                    {/* Pre-Sales selection — optional, can also be assigned later during Primary Review */}
                    <Field
                      label="Pre-Sales"
                      tooltip="Optional. Reviews OEM authorization for the proposed products. Can also be assigned later during Primary Review."
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-9 text-xs font-normal justify-between bg-background text-foreground hover:bg-muted/50 gap-1.5 border-input"
                          >
                            <span>
                              {form.presales_id
                                ? (presalesUsers.find(
                                    (u) => u.id === form.presales_id,
                                  )?.full_name ?? "Select Pre-Sales...")
                                : "None selected"}
                            </span>
                            <ChevronDown className="size-3 text-muted-foreground ml-auto" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="max-h-60 overflow-y-auto w-[320px]">
                          <DropdownMenuLabel>
                            Select Pre-Sales
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => set("presales_id", "")}
                          >
                            None
                          </DropdownMenuItem>
                          {presalesUsers.length === 0 ? (
                            <DropdownMenuItem disabled>
                              No users hold the Pre-Sales role yet
                            </DropdownMenuItem>
                          ) : (
                            presalesUsers.map((u) => (
                              <DropdownMenuItem
                                key={u.id}
                                onSelect={() => set("presales_id", u.id)}
                              >
                                {u.full_name}
                              </DropdownMenuItem>
                            ))
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Field>

                    {/* Internal Remarks */}
                    <div className="sm:col-span-2">
                      <Field label="Remarks & Internal Notes">
                        <Textarea
                          value={form.remarks}
                          onChange={(e) => set("remarks", e.target.value)}
                          placeholder="Provide additional details regarding delivery terms, OEM contacts, bid security conditions, etc."
                          className="text-sm min-h-[60px] bg-background"
                        />
                      </Field>
                    </div>

                    {/* Additional Info / Challenge — optional, colored-label
                        note surfaced in the identification alert/mail. */}
                    <div className="sm:col-span-2">
                      {!showAlertNote ? (
                        <button
                          type="button"
                          onClick={() => setShowAlertNote(true)}
                          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                        >
                          <Plus className="size-3.5" /> Add Additional Info /
                          Challenge
                        </button>
                      ) : (
                        <div className="space-y-2 p-3 rounded-lg border border-border/60 bg-muted/20">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold text-foreground">
                              Additional Info / Challenge
                            </Label>
                            <button
                              type="button"
                              onClick={() => {
                                setShowAlertNote(false);
                                setAlertNoteText("");
                                setAlertNoteLabel("");
                              }}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              value={alertNoteLabel}
                              onChange={(e) =>
                                setAlertNoteLabel(e.target.value)
                              }
                              placeholder="Label, e.g. Delivery Risk"
                              className="text-xs h-8 bg-background flex-1"
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full text-white shrink-0 whitespace-nowrap flex items-center gap-1 hover:opacity-90 transition-all cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-ring"
                                  style={{
                                    background:
                                      ALERT_NOTE_COLORS[alertNoteColor]
                                        ?.solid ||
                                      ALERT_NOTE_COLORS.amber.solid,
                                  }}
                                  title="Click to select condition"
                                >
                                  <span>
                                    {alertNoteLabel.trim() || "Attention"}
                                  </span>
                                  <ChevronDown className="size-3 text-white/80" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="w-64 p-1.5 space-y-0.5"
                              >
                                <DropdownMenuLabel className="text-[11px] text-muted-foreground font-semibold px-2 py-1">
                                  Select Condition / Risk Type
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {ALERT_NOTE_PRESETS.map((preset) => {
                                  const isSelected =
                                    alertNoteColor === preset.color;
                                  return (
                                    <DropdownMenuItem
                                      key={preset.id}
                                      onClick={() => {
                                        setAlertNoteColor(preset.color);
                                        if (
                                          !alertNoteLabel.trim() ||
                                          ALERT_NOTE_PRESETS.some(
                                            (p) =>
                                              p.label.toLowerCase() ===
                                              alertNoteLabel
                                                .trim()
                                                .toLowerCase(),
                                          )
                                        ) {
                                          setAlertNoteLabel(preset.label);
                                        }
                                      }}
                                      className="flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-muted/80 gap-2"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span
                                          className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white shrink-0"
                                          style={{
                                            background:
                                              ALERT_NOTE_COLORS[preset.color]
                                                ?.solid,
                                          }}
                                        >
                                          {preset.label}
                                        </span>
                                        <span className="text-[11px] text-muted-foreground truncate">
                                          {preset.description}
                                        </span>
                                      </div>
                                      {isSelected && (
                                        <Check className="size-3.5 text-primary shrink-0 ml-auto" />
                                      )}
                                    </DropdownMenuItem>
                                  );
                                })}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <Textarea
                            value={alertNoteText}
                            onChange={(e) => setAlertNoteText(e.target.value)}
                            placeholder="Describe the challenge or issue to flag for reviewers..."
                            className="text-sm min-h-[60px] bg-background"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Checklist Seeds Grid */}
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                      <CheckSquare className="size-4 text-primary" />
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Document Checklist Seeds
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Bidder Docs */}
                      <div className="space-y-4 border border-border/80 rounded-xl p-4 bg-muted/5">
                        <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                          <Award className="size-4 text-primary" />
                          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                            Bidder Docs Checklist
                          </h4>
                        </div>

                        {/* Suggestions */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                            Recommended Suggestions
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {BIDDER_SUGGESTIONS.map((item) => {
                              const isAdded = bidderChecklists.includes(item);
                              return (
                                <button
                                  key={item}
                                  type="button"
                                  disabled={isAdded}
                                  onClick={() => addBidderSuggestion(item)}
                                  className={`text-[11px] px-2.5 py-1 rounded-md border transition-all flex items-center gap-1.5
                                    ${
                                      isAdded
                                        ? "bg-muted text-muted-foreground border-border/40 cursor-default opacity-60"
                                        : "bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 hover:border-primary/40 cursor-pointer"
                                    }`}
                                >
                                  {isAdded ? (
                                    <Check className="size-3 text-emerald-500" />
                                  ) : (
                                    <Plus className="size-3" />
                                  )}
                                  {item}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Custom Input */}
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add custom bidder doc..."
                            value={newBidderItem}
                            onChange={(e) => setNewBidderItem(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addCustomBidder();
                              }
                            }}
                            className="h-8 text-xs bg-background"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={addCustomBidder}
                            className="h-8 text-xs px-3"
                          >
                            <Plus className="size-3.5" />
                          </Button>
                        </div>

                        {/* Current List */}
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                            Added Bidder Items ({bidderChecklists.length})
                          </span>
                          {bidderChecklists.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic py-2">
                              No bidder items added yet.
                            </p>
                          ) : (
                            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                              {bidderChecklists.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-2 rounded-md bg-background border border-border/60 text-xs"
                                >
                                  <span className="truncate pr-2 font-medium">
                                    {item}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeBidderItem(idx)}
                                    className="text-muted-foreground hover:text-destructive p-0.5"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* OEM Docs */}
                      <div className="space-y-4 border border-border/80 rounded-xl p-4 bg-muted/5">
                        <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                          <Building2 className="size-4 text-violet-500" />
                          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                            OEM Docs Checklist
                          </h4>
                        </div>

                        {/* Suggestions */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                            Recommended Suggestions
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {OEM_SUGGESTIONS.map((item) => {
                              const isAdded = oemChecklists.includes(item);
                              return (
                                <button
                                  key={item}
                                  type="button"
                                  disabled={isAdded}
                                  onClick={() => addOemSuggestion(item)}
                                  className={`text-[11px] px-2.5 py-1 rounded-md border transition-all flex items-center gap-1.5
                                    ${
                                      isAdded
                                        ? "bg-muted text-muted-foreground border-border/40 cursor-default opacity-60"
                                        : "bg-violet-500/5 text-violet-600 border-violet-500/20 hover:bg-violet-500/10 hover:border-violet-500/40 cursor-pointer dark:text-violet-400"
                                    }`}
                                >
                                  {isAdded ? (
                                    <Check className="size-3 text-emerald-500" />
                                  ) : (
                                    <Plus className="size-3" />
                                  )}
                                  {item}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Custom Input */}
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add custom OEM doc..."
                            value={newOemItem}
                            onChange={(e) => setNewOemItem(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addCustomOem();
                              }
                            }}
                            className="h-8 text-xs bg-background"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={addCustomOem}
                            className="h-8 text-xs px-3"
                          >
                            <Plus className="size-3.5" />
                          </Button>
                        </div>

                        {/* Current List */}
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                            Added OEM Items ({oemChecklists.length})
                          </span>
                          {oemChecklists.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic py-2">
                              No OEM items added yet.
                            </p>
                          ) : (
                            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                              {oemChecklists.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-2 rounded-md bg-background border border-border/60 text-xs"
                                >
                                  <span className="truncate pr-2 font-medium">
                                    {item}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeOemItem(idx)}
                                    className="text-muted-foreground hover:text-destructive p-0.5"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Navigation Buttons */}
        <div className="p-4 bg-muted/20 border-t border-border/80 flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={prevStep}
            disabled={step === 1 || loading}
            className="gap-1.5"
          >
            <ArrowLeft className="size-4" />
            Previous
          </Button>

          <div className="flex items-center gap-3">
            {step < 2 ? (
              <Button
                type="button"
                size="sm"
                onClick={nextStep}
                className="gap-1.5"
              >
                Next: Section 2
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleSubmit}
                disabled={loading}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                Create Tender Workspace
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
