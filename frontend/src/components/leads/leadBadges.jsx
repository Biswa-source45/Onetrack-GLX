export function LeadStatusBadge({ status }) {
  const published = status === "PUBLISHED";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium
        ${published
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "border-border bg-muted text-muted-foreground"}`}
    >
      {published ? "Published" : "Unpublished"}
    </span>
  );
}

export function LeadTypeBadge({ type }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground">
      {type === "GOV" ? "Government" : "Private"}
    </span>
  );
}

const STAGES = {
  RM_REVIEW: ["RM Review", "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"],
  PENDING_APPROVAL: ["Pending Approval", "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"],
  APPROVED: ["Approved", "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300"],
  GO: ["Go", "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"],
  NO_GO: ["No-Go", "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"],
};

// Where the prebid query sheet is. Nothing is shown before it starts.
const PREBID = {
  WITH_PM: "With Pre-Sales", WITH_DM: "With Delivery", WITH_BM: "With Bid Manager",
  WITH_AM: "With Account Mgr", SENT: "Sent to Customer", CLOSED: "Closed",
};

export function PrebidBadge({ stage }) {
  if (!PREBID[stage]) return null;
  const done = stage === "CLOSED";
  return (
    <span
      title="Prebid queries"
      className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium
        ${done
          ? "border-border bg-muted text-muted-foreground"
          : "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"}`}
    >
      Prebid: {PREBID[stage]}
    </span>
  );
}

export function LeadStageBadge({ stage }) {
  const [label, cls] = STAGES[stage] ?? [stage, "border-border bg-muted text-muted-foreground"];
  return <span className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>;
}
