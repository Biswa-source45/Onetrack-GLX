import { useState } from "react";
import { ArrowRight, Building2, CheckCheck, Lock, Play, Send, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDateTime } from "../../lib/tenderFormat";
import { UserAvatar } from "../admin/UserAvatar";

const ROLE = { pm: "Pre-Sales", dm: "Delivery Manager", bm: "Bid Manager", am: "Account Manager" };

// One entry per prebid timeline event: its title, icon, colour, and (for a handoff) which
// role the sheet went to.
const TYPES = {
  PREBID_START: { icon: Play, title: "Prebid started", tone: "indigo", to: "pm" },
  PREBID_SEND_PM: { icon: Send, title: "Sheet sent to Pre-Sales", tone: "indigo", to: "pm" },
  PREBID_SEND_DM: { icon: Send, title: "Sheet sent to the Delivery Manager", tone: "indigo", to: "dm" },
  PREBID_SEND_BM: { icon: Send, title: "Sheet sent to the Bid Manager", tone: "indigo", to: "bm" },
  PREBID_RETURN: { icon: Undo2, title: "Returned to the Account Manager", tone: "emerald" },
  PREBID_MARK_SENT: { icon: CheckCheck, title: "Queries sent to the customer", tone: "amber" },
  PREBID_CLOSE: { icon: Lock, title: "Prebid closed", tone: "slate" },
};

const TONES = {
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  slate: "bg-muted text-muted-foreground",
};

const SHOWN = 3;

/**
 * The prebid steps in order, each with who it came from and who it went to.
 * Whoever returns a sheet is the person it was last sent to, so their role is
 * tracked as the events are walked.
 */
function prebidSteps(lead) {
  let holder = "pm";
  return (lead.events ?? [])
    .filter((e) => e.event_type.startsWith("PREBID_"))
    .map((e) => {
      const type = TYPES[e.event_type] ?? { icon: Send, title: e.event_type, tone: "slate" };
      let fromRole = "am";
      let to = null;
      if (type.to) {
        holder = type.to;
        to = { name: e.target?.full_name ?? "—", role: ROLE[type.to] };
      } else if (e.event_type === "PREBID_RETURN") {
        fromRole = holder;
        to = { name: lead.lead_owner.full_name, role: ROLE.am };
      } else if (e.event_type === "PREBID_MARK_SENT") {
        to = { name: "Customer", role: "", customer: true };
      }
      return { event: e, type, from: { name: e.actor.full_name, role: ROLE[fromRole] }, to };
    });
}

function Person({ name, role, customer }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 py-1 pl-1 pr-3">
      {customer ? (
        <span className="flex size-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
          <Building2 className="size-3.5" aria-hidden="true" />
        </span>
      ) : (
        <UserAvatar fullName={name} size="sm" />
      )}
      <span className="leading-tight">
        <span className="block text-xs font-medium text-foreground">{name}</span>
        {role && <span className="block text-[10px] text-muted-foreground">{role}</span>}
      </span>
    </span>
  );
}

// The conversation on this prebid round: every handoff as a card (from -> to, what happened,
// what was said), newest first.
export function PrebidActivity({ lead }) {
  const [all, setAll] = useState(false);
  const steps = prebidSteps(lead).reverse();
  if (!steps.length) return null;
  const shown = all ? steps : steps.slice(0, SHOWN);

  return (
    <section className="space-y-3" aria-label="Prebid activity">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Activity &amp; Comments <span className="font-normal text-muted-foreground">({steps.length})</span>
        </h3>
        {steps.length > SHOWN && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAll((v) => !v)}>
            {all ? "Show Latest Only" : `Show All ${steps.length}`}
          </Button>
        )}
      </div>
      <ol className="space-y-3">
        {shown.map(({ event: e, type, from, to }) => {
          const Icon = type.icon;
          return (
            <li key={e.id} className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${TONES[type.tone]}`}>
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-semibold text-foreground">{type.title}</p>
                </div>
                <time dateTime={e.created_at} className="shrink-0 text-xs text-muted-foreground">{formatDateTime(e.created_at)}</time>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">From</span>
                <Person {...from} />
                {to && (
                  <>
                    <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">To</span>
                    <Person {...to} />
                  </>
                )}
              </div>
              {e.note ? (
                <blockquote className="mt-3 whitespace-pre-line break-words rounded-lg border-l-2 border-primary/40 bg-muted/40 px-3 py-2 text-sm text-foreground">
                  {e.note}
                </blockquote>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">No comment added.</p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
