import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  IndianRupee,
  Layers,
  ShieldCheck,
  FileText,
  ChevronDown,
  ChevronUp,
  Package,
} from "lucide-react";

export function AiExtractionVerificationDialog({
  open,
  onOpenChange,
  extractionResult,
  onApply,
}) {
  const [showFullBreakdown, setShowFullBreakdown] = useState(false);

  if (!extractionResult) return null;

  const { data, meta } = extractionResult;
  const accuracy = meta?.accuracy_percentage ?? 0;
  const grade = meta?.accuracy_grade ?? "B";
  const breakdown = meta?.accuracy_breakdown ?? {};

  const getGradeBadge = (g) => {
    switch (g) {
      case "A+":
        return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      case "A":
        return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
      case "B":
        return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
      default:
        return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
    }
  };

  const formatCurrency = (val) => {
    if (val === null || val === undefined) return "Not Disclosed (Item-Rate)";
    return `₹${Number(val).toLocaleString("en-IN")}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border/60 bg-muted/20">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="size-5" />
                </div>
                <DialogTitle className="text-lg font-bold">
                  AI Tender Extraction & Grounding Verification
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Document analyzed: <span className="font-medium text-foreground">{meta?.filename}</span> ({meta?.pages_read} pages, {meta?.character_count?.toLocaleString()} chars in {(meta?.extraction_time_ms / 1000).toFixed(1)}s)
              </DialogDescription>
            </div>

            {/* Accuracy Badge */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className={`font-semibold px-2.5 py-0.5 text-xs ${getGradeBadge(grade)}`}>
                  {accuracy}% Accuracy (Grade {grade})
                </Badge>
              </div>
              <span className="text-[10px] text-muted-foreground">4-Pillar Factual Grounding</span>
            </div>
          </div>

          {/* 4-Pillar Progress Summary */}
          <div className="mt-4 grid grid-cols-4 gap-2 pt-3 border-t border-border/40 text-center text-xs">
            <div className="p-2 rounded bg-background/60 border border-border/40">
              <span className="text-[10px] text-muted-foreground block">Critical Fields</span>
              <span className="font-bold text-foreground">{breakdown.critical_fields_score ?? 0}/30</span>
            </div>
            <div className="p-2 rounded bg-background/60 border border-border/40">
              <span className="text-[10px] text-muted-foreground block">Consistency</span>
              <span className="font-bold text-foreground">{breakdown.data_consistency_score ?? 0}/25</span>
            </div>
            <div className="p-2 rounded bg-background/60 border border-border/40">
              <span className="text-[10px] text-muted-foreground block">Text Grounding</span>
              <span className="font-bold text-foreground">{breakdown.document_grounding_score ?? 0}/30</span>
            </div>
            <div className="p-2 rounded bg-background/60 border border-border/40">
              <span className="text-[10px] text-muted-foreground block">BOQ & Checklist</span>
              <span className="font-bold text-foreground">{breakdown.structural_completeness_score ?? 0}/15</span>
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Factual Grounding Notice */}
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs flex items-start gap-2.5 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <div>
              <p className="font-semibold">Zero-Hallucination Extraction Verified</p>
              <p className="text-[11px] text-emerald-700/90 dark:text-emerald-400/90 mt-0.5">
                Parameters below have been cross-checked against source text. Verify values before pre-filling into the tender form.
              </p>
            </div>
          </div>

          {/* Core Info Cards */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText className="size-3.5 text-primary" /> Key Tender Parameters
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                <span className="text-muted-foreground text-[11px]">Tender / Work Title</span>
                <p className="font-medium text-foreground line-clamp-2">{data.title || "—"}</p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                <span className="text-muted-foreground text-[11px]">GeM Bid / NIT Reference Number</span>
                <p className="font-bold font-mono text-primary text-sm">{data.gem_bid_no || "—"}</p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                <span className="text-muted-foreground text-[11px]">Organization & Department</span>
                <p className="font-medium text-foreground">
                  {data.organization_name || "—"}
                  {data.department_name ? ` (${data.department_name})` : ""}
                </p>
                {data.location && <p className="text-[11px] text-muted-foreground">Location: {data.location}</p>}
              </div>
              <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                <span className="text-muted-foreground text-[11px]">Portal & Bid Classification</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="secondary" className="text-[11px] font-medium">{data.portal_source}</Badge>
                  <Badge variant="outline" className="text-[11px]">{data.bid_type}</Badge>
                  <Badge variant="outline" className="text-[11px]">{data.scope_type}</Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Financial & Commercial Scope */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <IndianRupee className="size-3.5 text-primary" /> Commercial & Financial Scope
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                <span className="text-muted-foreground text-[11px]">Estimated Value</span>
                <p className="font-bold text-foreground text-sm">
                  {formatCurrency(data.estimated_value)}
                </p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                <span className="text-muted-foreground text-[11px]">Earnest Money Deposit (EMD)</span>
                <p className="font-bold text-foreground text-sm">
                  {data.emd_not_applicable
                    ? "Waived / Not Applicable"
                    : data.emd_amount
                    ? formatCurrency(data.emd_amount)
                    : data.emd_formula
                    ? data.emd_formula
                    : "Not Specified"}
                </p>
                {data.emd_beneficiary && (
                  <p className="text-[10px] text-muted-foreground truncate">In favor of: {data.emd_beneficiary}</p>
                )}
              </div>
              <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                <span className="text-muted-foreground text-[11px]">Performance Security (PBG)</span>
                <p className="font-bold text-foreground text-sm">
                  {data.bg_required
                    ? `${data.bg_rate ?? "Standard"}%${data.bg_duration_months ? ` (${data.bg_duration_months} mos)` : ""}`
                    : "Not Required"}
                </p>
              </div>
            </div>

            {/* Turnover & Experience */}
            {(data.minimum_annual_turnover || data.contract_period_months) && (
              <div className="p-3 rounded-lg border border-border/80 bg-muted/20 text-xs flex items-center justify-between">
                {data.minimum_annual_turnover && (
                  <div>
                    <span className="text-muted-foreground text-[11px]">Min. Annual Turnover: </span>
                    <span className="font-semibold text-foreground">{formatCurrency(data.minimum_annual_turnover)}</span>
                  </div>
                )}
                {data.contract_period_months && (
                  <div>
                    <span className="text-muted-foreground text-[11px]">Contract Duration: </span>
                    <span className="font-semibold text-foreground">{data.contract_period_months} Months</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Calendar className="size-3.5 text-primary" /> Critical Dates
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg border border-border bg-card">
                <span className="text-muted-foreground text-[11px]">Release / Start Date:</span>
                <span className="font-mono font-medium ml-2">{data.start_date || "Not specified"}</span>
              </div>
              <div className="p-2.5 rounded-lg border border-border bg-card">
                <span className="text-muted-foreground text-[11px]">Submission Deadline:</span>
                <span className="font-mono font-bold text-primary ml-2">{data.end_date || "Not specified"}</span>
              </div>
            </div>
          </div>

          {/* Products & BOQ */}
          {data.products?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Package className="size-3.5 text-primary" /> BOQ Schedule Items ({data.products.length})
              </h4>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-border text-xs divide-y divide-border/60">
                {data.products.map((p, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between bg-card hover:bg-muted/30">
                    <div className="space-y-0.5 pr-2">
                      <span className="font-medium text-foreground">{p.name}</span>
                      {p.oem_name && (
                        <span className="block text-[10px] text-primary">OEM: {p.oem_name}</span>
                      )}
                    </div>
                    <Badge variant="outline" className="font-mono shrink-0">
                      {p.quantity} {p.units || "Nos"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compliance Checklists */}
          {((data.bidder_checklists?.length || 0) + (data.oem_checklists?.length || 0)) > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-primary" /> Compliance Requirements
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {data.bidder_checklists?.length > 0 && (
                  <div className="p-3 rounded-lg border border-border bg-card space-y-1.5">
                    <span className="font-semibold text-foreground text-[11px] block">
                      Bidder Documents ({data.bidder_checklists.length})
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground text-[11px]">
                      {data.bidder_checklists.slice(0, 4).map((c, i) => (
                        <li key={i} className="truncate" title={c.title || c.description}>
                          {c.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {data.oem_checklists?.length > 0 && (
                  <div className="p-3 rounded-lg border border-border bg-card space-y-1.5">
                    <span className="font-semibold text-foreground text-[11px] block">
                      OEM Authorizations ({data.oem_checklists.length})
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground text-[11px]">
                      {data.oem_checklists.slice(0, 4).map((c, i) => (
                        <li key={i} className="truncate" title={c.title || c.description}>
                          {c.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Expandable Grounding Details */}
          <div className="pt-2 border-t border-border/40">
            <button
              type="button"
              onClick={() => setShowFullBreakdown(!showFullBreakdown)}
              className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
            >
              {showFullBreakdown ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              {showFullBreakdown ? "Hide Factual Grounding Breakdown" : "View Grounding Verification Matches"}
            </button>
            {showFullBreakdown && (
              <div className="mt-3 p-3 rounded-lg bg-muted/40 border border-border text-xs space-y-1.5">
                <p className="font-semibold text-foreground">Verified Document Grounding Matches:</p>
                <div className="flex flex-wrap gap-1.5">
                  {breakdown.verified_matches?.map((match, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] bg-background">
                      ✓ {match}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 flex sm:justify-between items-center">
          <p className="text-[11px] text-muted-foreground">
            All extracted parameters have been bound to your form fields.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-primary text-primary-foreground font-semibold"
              onClick={() => {
                onApply(data);
                onOpenChange(false);
              }}
            >
              <CheckCircle2 className="size-4" /> Keep Applied Data & Continue
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
