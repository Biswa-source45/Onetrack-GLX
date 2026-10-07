import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, RefreshCw, Search, Target, Paperclip, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listLeads } from "../../services/leads";
import { usePermissions } from "../../hooks/usePermissions";
import { formatCurrency, formatDate } from "../../lib/tenderFormat";
import { LeadStageBadge, LeadStatusBadge, LeadTypeBadge } from "./leadBadges";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "PUBLISHED", label: "Published" },
  { value: "UNPUBLISHED", label: "Unpublished" },
];
const TYPE_FILTERS = [
  { value: "", label: "All types" },
  { value: "GOV", label: "Government" },
  { value: "PVT", label: "Private" },
];

function FilterGroup({ label, options, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1 rounded-lg border border-border bg-muted/60 p-1 text-xs">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
            ${value === o.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function LeadsPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("lead.create");

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");

  // Applies a fetch result; state is only ever set from the promise
  // callback, never synchronously inside the effect.
  const fetchLeads = useCallback(
    () =>
      listLeads()
        .then((res) => (res.ok ? { leads: Array.isArray(res.data) ? res.data : [] } : { failed: true }))
        .catch(() => ({ failed: true })),
    [],
  );
  const apply = (r) => {
    setFailed(!!r.failed);
    if (r.leads) setLeads(r.leads);
    setLoading(false);
  };

  useEffect(() => {
    let live = true;
    fetchLeads().then((r) => live && apply(r));
    return () => { live = false; };
  }, [fetchLeads]);

  const load = () => {
    setLoading(true);
    fetchLeads().then(apply);
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter(
      (l) =>
        (!status || l.publish_status === status) &&
        (!type || l.lead_type === type) &&
        (!q ||
          [l.title, l.account_name, l.department_name, l.location, l.category, l.lead_owner?.full_name]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q)),
    );
  }, [leads, query, status, type]);

  const stats = useMemo(() => {
    const published = leads.filter((l) => l.publish_status === "PUBLISHED").length;
    return [
      { label: "Total leads", value: leads.length },
      { label: "Published", value: published },
      { label: "Unpublished", value: leads.length - published },
      { label: "Government", value: leads.filter((l) => l.lead_type === "GOV").length },
      { label: "Pipeline value", value: formatCurrency(leads.reduce((s, l) => s + (l.estimated_value || 0), 0)) },
    ];
  }, [leads]);

  const filtering = query || status || type;

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">Opportunities before they become tenders.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} aria-label="Refresh leads">
            <RefreshCw className={`size-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
          </Button>
          {canCreate && (
            <Button id="add-lead-btn" size="sm" className="gap-1.5 shadow-sm active:scale-[0.98]" onClick={() => navigate("/dashboard/leads/new")}>
              <Plus className="size-3.5" />
              Add Lead
            </Button>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">
              {loading ? <span className="inline-block h-6 w-12 animate-pulse rounded bg-muted" /> : s.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative lg:w-80">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search account, title, owner…" aria-label="Search leads" className="h-9 bg-background pl-8 text-sm" />
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterGroup label="Lead status" options={STATUS_FILTERS} value={status} onChange={setStatus} />
          <FilterGroup label="Lead type" options={TYPE_FILTERS} value={type} onChange={setType} />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {failed ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <AlertTriangle className="size-6 text-destructive" aria-hidden />
            <p className="text-sm text-foreground">Leads could not be loaded.</p>
            <Button variant="outline" size="sm" onClick={load}>Try again</Button>
          </div>
        ) : !loading && shown.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-primary/10">
              <Target className="size-5 text-primary" aria-hidden />
            </span>
            <p className="text-sm font-medium text-foreground">{filtering ? "No leads match these filters" : "No leads yet"}</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {filtering ? "Clear the search or filters to see every lead." : "Add your first lead to start tracking opportunities before they turn into tenders."}
            </p>
            {filtering ? (
              <Button variant="outline" size="sm" onClick={() => { setQuery(""); setStatus(""); setType(""); }}>Clear filters</Button>
            ) : (
              canCreate && <Button size="sm" className="gap-1.5" onClick={() => navigate("/dashboard/leads/new")}><Plus className="size-3.5" />Add Lead</Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Lead</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Type</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Category</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Est. Value</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Expected</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Owner</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Docs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading
                  ? Array.from({ length: 5 }, (_, i) => (
                      <tr key={i}>
                        <td colSpan={8} className="px-4 py-3">
                          <div className="h-5 animate-pulse rounded bg-muted/70" />
                        </td>
                      </tr>
                    ))
                  : shown.map((l) => (
                      <tr
                        key={l.id}
                        tabIndex={0}
                        onClick={() => navigate(`/dashboard/leads/${l.id}`)}
                        onKeyDown={(e) => e.key === "Enter" && navigate(`/dashboard/leads/${l.id}`)}
                        className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                      >
                        <td className="max-w-[320px] px-4 py-3">
                          <p className="truncate font-medium text-foreground">{l.title || l.account_name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[l.title ? l.account_name : null, l.department_name, l.location].filter(Boolean).join(", ") || "No department or location"}
                          </p>
                        </td>
                        <td className="px-4 py-3"><span className="flex flex-wrap gap-1.5"><LeadStageBadge stage={l.stage} /><LeadStatusBadge status={l.publish_status} /></span></td>
                        <td className="px-4 py-3"><LeadTypeBadge type={l.lead_type} /></td>
                        <td className="px-4 py-3 text-muted-foreground">{l.category || "Not set"}</td>
                        <td className={`px-4 py-3 text-right tabular-nums ${l.estimated_value != null ? "text-foreground" : "text-muted-foreground"}`}>{l.estimated_value != null ? formatCurrency(l.estimated_value) : "Not set"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(l.expected_date, "Not set")}</td>
                        <td className="px-4 py-3 text-foreground">{l.lead_owner?.full_name}</td>
                        <td className="px-4 py-3 text-right">
                          {l.document_count > 0 ? (
                            <span className="inline-flex items-center gap-1 tabular-nums text-foreground"><Paperclip className="size-3 text-muted-foreground" aria-hidden />{l.document_count}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
