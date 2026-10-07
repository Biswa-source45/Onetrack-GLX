import { DollarSign, CheckSquare, Plus, Trash2, HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FieldMemoryInput } from "@/components/ui/field-memory-input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

import { EMD_DETAIL_FIELDS, inputCls } from "../../lib/tenderSpec";

// Shared tender Section 1 building blocks. Used by Add Tender and by Add
// Lead (a Published lead captures the same tender spec), so the fields,
// EMD rules and products table live in exactly one place.

export function Field({ label, error, children, required, tooltip }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}{" "}
          {required && <span className="text-destructive font-bold">*</span>}
        </Label>
        {tooltip && (
          <div className="group relative">
            <HelpCircle className="size-3 text-muted-foreground cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-48 bg-foreground text-background text-[10px] p-2 rounded shadow-lg z-50 text-center leading-normal">
              {tooltip}
            </div>
          </div>
        )}
      </div>
      {children}
      {error && <p className="text-xs text-destructive font-medium">{error}</p>}
    </div>
  );
}

// Products/Services Asked in the RFP — freeform rows, OEM optional per row.
export function ProductsTable({ products, setProducts }) {
  const addProductRow = () =>
    setProducts((prev) => [
      ...prev,
      { id: Date.now(), product: "", description: "", qty: "", oem: "" },
    ]);
  const updateProductRow = (id, field, value) =>
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  const removeProductRow = (id) =>
    setProducts((prev) =>
      prev.length > 1 ? prev.filter((p) => p.id !== id) : prev,
    );

  return (
    <div className="space-y-4 border border-border/80 rounded-xl p-4 bg-muted/5">
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <div className="flex items-center gap-2">
          <CheckSquare className="size-4 text-primary" />
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Products/Services Asked in the RFP
          </h4>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addProductRow}
          className="h-7 text-xs gap-1"
        >
          <Plus className="size-3.5" /> Add Row
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product/Service</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-24">Quantity</TableHead>
            <TableHead>OEM (Optional)</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="min-w-[160px]">
                <FieldMemoryInput
                  fieldKey="product"
                  value={p.product}
                  onChange={(v) =>
                    updateProductRow(p.id, "product", v)
                  }
                  placeholder="e.g. Enterprise Firewall"
                  className="h-8 text-xs bg-background"
                />
              </TableCell>
              <TableCell className="min-w-[200px]">
                <Input
                  value={p.description}
                  onChange={(e) =>
                    updateProductRow(
                      p.id,
                      "description",
                      e.target.value,
                    )
                  }
                  placeholder="Brief description"
                  className="h-8 text-xs bg-background"
                />
              </TableCell>
              <TableCell className="w-24">
                <Input
                  type="number"
                  min="1"
                  value={p.qty}
                  onChange={(e) =>
                    updateProductRow(p.id, "qty", e.target.value)
                  }
                  placeholder="Qty"
                  className="h-8 text-xs bg-background"
                />
              </TableCell>
              <TableCell className="min-w-[140px]">
                <FieldMemoryInput
                  fieldKey="oem"
                  value={p.oem}
                  onChange={(v) =>
                    updateProductRow(p.id, "oem", v)
                  }
                  placeholder="OEM name"
                  className="h-8 text-xs bg-background"
                />
              </TableCell>
              <TableCell>
                <button
                  type="button"
                  onClick={() => removeProductRow(p.id)}
                  disabled={products.length === 1}
                  className="text-muted-foreground hover:text-destructive p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-[11px] text-muted-foreground italic">
        Add every product or service the RFP is asking for — each
        line becomes selectable later during Pricing.
      </p>
    </div>
  );
}

// Financials — EMD & Bank Guarantee. Form state stays with the caller (it's
// submitted with everything else); the Online/DD toggles are passed in too
// because validateEmd needs them at submit time.
export function EmdBgSection({
  form,
  set,
  setForm,
  errors,
  setErrors,
  emdOnlineOn,
  setEmdOnlineOn,
  emdDdOn,
  setEmdDdOn,
}) {
  // "No EMD" is the only switch that clears everything else.
  const toggleNoEmd = () => {
    const next = !form.emd_not_applicable;
    set("emd_not_applicable", next);
    if (next) {
      setForm((f) => ({ ...f, ...EMD_DETAIL_FIELDS }));
      setEmdOnlineOn(false);
      setEmdDdOn(false);
    }
  };

  const toggleEmdOnline = () => {
    setEmdOnlineOn((prev) => {
      const next = !prev;
      if (!next)
        setForm((f) => ({
          ...f,
          emd_bank_name: "",
          emd_account_number: "",
          emd_ifsc_code: "",
          emd_branch: "",
        }));
      return next;
    });
    setErrors((e) => ({
      ...e,
      emd_mode: undefined,
      emd_bank_name: undefined,
      emd_account_number: undefined,
      emd_ifsc_code: undefined,
    }));
  };

  const toggleEmdDd = () => {
    setEmdDdOn((prev) => {
      const next = !prev;
      if (!next)
        setForm((f) => ({ ...f, emd_beneficiary: "", emd_payable_at: "" }));
      return next;
    });
    setErrors((e) => ({
      ...e,
      emd_mode: undefined,
      emd_beneficiary: undefined,
      emd_payable_at: undefined,
    }));
  };

  const toggleExemptionType = (type) => {
    setForm((f) => {
      const has = f.emd_exemption_types.includes(type);
      const next = has
        ? f.emd_exemption_types.filter((t) => t !== type)
        : [...f.emd_exemption_types, type];
      const updated = { ...f, emd_exemption_types: next };
      if (!next.includes("OTHER")) updated.emd_exemption_reason = "";
      return updated;
    });
    setErrors((e) => ({
      ...e,
      emd_mode: undefined,
      emd_exemption_reason: undefined,
    }));
  };

  return (
    <div className="space-y-4 border border-border/80 rounded-xl p-4 bg-muted/5">
      <div className="flex items-center gap-2 border-b border-border/60 pb-2">
        <DollarSign className="size-4 text-emerald-600" />
        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
          Financials — EMD &amp; Bank Guarantee
        </h4>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex items-end gap-3 w-full">
          <div className="flex-1">
            <Field label="EMD Amount (₹)">
              <Input
                type="number"
                value={form.emd_amount}
                onChange={(e) =>
                  set("emd_amount", e.target.value)
                }
                placeholder="e.g. 100000"
                className={`${inputCls()} ${form.emd_not_applicable ? "opacity-50" : ""}`}
                disabled={form.emd_not_applicable}
              />
            </Field>
          </div>
          <div className="h-9 flex items-center shrink-0">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Switch checked={form.emd_not_applicable} onCheckedChange={toggleNoEmd} />
              <span className="text-[11px] font-medium text-muted-foreground">
                No EMD
              </span>
            </label>
          </div>
        </div>

        {/* No EMD */}
        {form.emd_not_applicable && (
          <div className="sm:col-span-2 p-3 rounded-lg bg-muted/40 border border-border">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                No EMD
              </span>{" "}
              — this tender has no Earnest Money Deposit
              requirement at all. Nothing further to configure
              here.
            </p>
          </div>
        )}

        {!form.emd_not_applicable && (
          <div className="sm:col-span-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-700 dark:text-slate-300">
              Tick whichever payment modes and exemption criteria
              the tender document actually offers — a document can
              list Online, DD, both, or neither if fully exempt.
              The Account Manager picks the one to actually go
              with during Primary Review.
            </p>
          </div>
        )}

        {errors.emd_mode && !form.emd_not_applicable && (
          <p className="sm:col-span-2 text-[11px] text-red-500">
            {errors.emd_mode}
          </p>
        )}

        {/* EMD via Online — independent checkbox, raw off the tender document */}
        {!form.emd_not_applicable && (
          <div className="sm:col-span-2 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer select-none p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <input
                type="checkbox"
                checked={emdOnlineOn}
                onChange={toggleEmdOnline}
                className="accent-primary size-3.5 shrink-0"
              />
              <span className="text-xs font-medium text-blue-800 dark:text-blue-200">
                <strong>EMD via Online Payment</strong> — tick if
                the tender document offers this route.
              </span>
            </label>
            {emdOnlineOn && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Bank Name"
                  error={errors.emd_bank_name}
                  required
                >
                  <FieldMemoryInput
                    fieldKey="emd_bank_name"
                    value={form.emd_bank_name}
                    onChange={(v) => set("emd_bank_name", v)}
                    placeholder="e.g. State Bank of India"
                    className={inputCls(errors.emd_bank_name)}
                  />
                </Field>
                <Field
                  label="Account Number"
                  error={errors.emd_account_number}
                  required
                >
                  <Input
                    value={form.emd_account_number}
                    onChange={(e) =>
                      set("emd_account_number", e.target.value)
                    }
                    placeholder="e.g. 012345678901"
                    className={inputCls(
                      errors.emd_account_number,
                    )}
                  />
                </Field>
                <Field
                  label="IFSC Code"
                  error={errors.emd_ifsc_code}
                  required
                >
                  <Input
                    value={form.emd_ifsc_code}
                    onChange={(e) =>
                      set(
                        "emd_ifsc_code",
                        e.target.value.toUpperCase(),
                      )
                    }
                    placeholder="e.g. SBIN0001234"
                    className={inputCls(errors.emd_ifsc_code)}
                  />
                </Field>
                <Field label="Branch (If Required)">
                  <Input
                    value={form.emd_branch}
                    onChange={(e) =>
                      set("emd_branch", e.target.value)
                    }
                    placeholder="e.g. New Delhi Main Branch"
                    className={inputCls()}
                  />
                </Field>
              </div>
            )}
          </div>
        )}

        {/* EMD via DD — independent checkbox, raw off the tender document */}
        {!form.emd_not_applicable && (
          <div className="sm:col-span-2 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer select-none p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <input
                type="checkbox"
                checked={emdDdOn}
                onChange={toggleEmdDd}
                className="accent-primary size-3.5 shrink-0"
              />
              <span className="text-xs font-medium text-amber-800 dark:text-amber-200">
                <strong>EMD via Demand Draft (DD)</strong> — tick
                if the tender document offers this route.
              </span>
            </label>
            {emdDdOn && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Beneficiary"
                  error={errors.emd_beneficiary}
                  required
                >
                  <FieldMemoryInput
                    fieldKey="emd_beneficiary"
                    value={form.emd_beneficiary}
                    onChange={(v) => set("emd_beneficiary", v)}
                    placeholder="e.g. The Accounts Officer, NIC Delhi"
                    className={inputCls(errors.emd_beneficiary)}
                  />
                </Field>
                <Field
                  label="Payable At"
                  error={errors.emd_payable_at}
                  required
                >
                  <FieldMemoryInput
                    fieldKey="emd_payable_at"
                    value={form.emd_payable_at}
                    onChange={(v) => set("emd_payable_at", v)}
                    placeholder="e.g. New Delhi"
                    className={inputCls(errors.emd_payable_at)}
                  />
                </Field>
              </div>
            )}
          </div>
        )}

        {/* EMD Exemption criteria — multi-select, independent of Online/DD */}
        {!form.emd_not_applicable && (
          <div className="sm:col-span-2 space-y-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
              Exemption Criteria Listed In The Tender (tick all
              that apply)
            </p>
            <div className="flex flex-wrap items-center gap-4">
              {["MSME", "STARTUP", "OTHER"].map((t) => (
                <label
                  key={t}
                  className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-foreground"
                >
                  <input
                    type="checkbox"
                    checked={form.emd_exemption_types.includes(t)}
                    onChange={() => toggleExemptionType(t)}
                    className="accent-primary"
                  />
                  {t === "OTHER"
                    ? "Other"
                    : t === "STARTUP"
                      ? "Startup"
                      : "MSME"}
                </label>
              ))}
            </div>
            {form.emd_exemption_types.includes("OTHER") && (
              <Input
                value={form.emd_exemption_reason}
                onChange={(e) =>
                  set("emd_exemption_reason", e.target.value)
                }
                placeholder="Specify the Other exemption criterion"
                className={inputCls(errors.emd_exemption_reason)}
              />
            )}
            {errors.emd_exemption_reason && (
              <p className="text-[11px] text-red-500">
                {errors.emd_exemption_reason}
              </p>
            )}
          </div>
        )}

        {/* BG Required Toggle & Rate */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Bank Guarantee (BG)
          </Label>
          <div className="flex items-center gap-4 h-9">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Switch checked={form.bg_required} onCheckedChange={() => set("bg_required", !form.bg_required)} />
              <span className="text-[11px] font-medium text-muted-foreground">
                BG Required
              </span>
            </label>

            {form.bg_required && (
              <div className="flex-1">
                <Input
                  type="number"
                  step="any"
                  value={form.bg_rate}
                  onChange={(e) => set("bg_rate", e.target.value)}
                  placeholder="BG Rate (%) e.g. 2.5"
                  className={inputCls()}
                />
              </div>
            )}
            {form.bg_required && (
              <div className="flex-1">
                <Input
                  type="number"
                  min="1"
                  value={form.bg_duration_months}
                  onChange={(e) =>
                    set("bg_duration_months", e.target.value)
                  }
                  placeholder="BG Duration (months) e.g. 12"
                  className={inputCls()}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
