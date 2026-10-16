import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldMemoryInput } from "@/components/ui/field-memory-input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { EmdBgSection, Field, ProductsTable } from "../tenders/tenderFormParts";
import { BID_TYPES, STANDARD_PORTAL_SOURCES, inputCls } from "../../lib/tenderSpec";

// The tender details of a published lead: title, bid number, portal, dates, products, EMD and BG.
// One component for the Add / Edit Lead form and the Publish Lead dialog; the state lives in the
// caller (the fields are named in lib/leadPublish.js).
export function TenderDetailsFields({ form, set, setForm, errors, setErrors, products, setProducts, emdOnlineOn, setEmdOnlineOn, emdDdOn, setEmdDdOn }) {
  return (
    <>
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
    </>
  );
}
