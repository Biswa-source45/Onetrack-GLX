import { useEffect, useState } from "react";
import { Check, Loader2, Send, ThumbsUp, Undo2, Ban, Rocket, GitPullRequestArrow } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { transitionLead } from "../../services/leads";
import { useBidStore } from "../../store/useBidStore";
import { tokenStorage } from "../../services/auth";
import { formatDateTime } from "../../lib/tenderFormat";
import { UserSelect } from "./UserSelect";

// Mirrors domain.ApproverRoles — only to narrow the picker; the server
// re-checks the chosen approver's role.
const APPROVER_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

const STEPS = [
  { stage: "RM_REVIEW", label: "RM Review" },
  { stage: "PENDING_APPROVAL", label: "Approval" },
  { stage: "APPROVED", label: "Go / No-Go" },
  { stage: "GO", label: "Go" },
];

// One entry per server action (lead.allowed_actions): its button, and the
// dialog that confirms it. noteRequired matches TransitionRequest.Normalize.
const ACTIONS = {
  SENT_FOR_APPROVAL: {
    button: "Send for Approval", icon: Send, variant: "default",
    title: "Send this lead for approval",
    description: "Choose the Admin or Manager who should approve it. They are notified by alert and email with the lead's details.",
    noteLabel: "Remarks for the approver", confirm: "Send for Approval", done: "Sent for approval",
  },
  APPROVED: {
    button: "Approve", icon: ThumbsUp, variant: "default",
    title: "Approve this lead",
    description: "The approval goes back to the Reporting Manager, who then decides Go or No-Go.",
    noteLabel: "Comment (optional)", confirm: "Approve", done: "Lead approved",
  },
  SENT_BACK: {
    button: "Send Back", icon: Undo2, variant: "outline",
    title: "Send this lead back",
    description: "It returns to the Reporting Manager for changes. Say what needs to change.",
    noteLabel: "What needs to change", noteRequired: true, confirm: "Send Back", done: "Lead sent back",
  },
  GO: {
    button: "Go", icon: Rocket, variant: "default",
    title: "Go ahead with this lead",
    description: "Marks the lead as a Go. The lead owner and approver are notified.",
    noteLabel: "Note (optional)", confirm: "Confirm Go", done: "Lead marked as Go",
  },
  NO_GO: {
    button: "No-Go / Cancel", icon: Ban, variant: "destructive",
    title: "Cancel this lead (No-Go)",
    description: "The lead is closed and can no longer be edited. This cannot be undone.",
    noteLabel: "Reason", noteRequired: true, confirm: "Confirm No-Go", done: "Lead cancelled",
  },
};

const EVENT_LABELS = {
  SENT_FOR_APPROVAL: "sent the lead for approval",
  APPROVED: "approved the lead",
  SENT_BACK: "sent the lead back for changes",
  GO: "marked the lead as Go",
  NO_GO: "cancelled the lead (No-Go)",
  EDITED: "edited the lead details",
};

function statusLine(lead) {
  const rm = lead.reporting_manager?.full_name;
  const approver = lead.approver?.full_name || "the approver";
  switch (lead.stage) {
    case "RM_REVIEW":
      return rm ? `Waiting for ${rm} (Reporting Manager) to review and send it for approval.` : "No Reporting Manager is set — an Admin or Manager needs to review and send it for approval.";
    case "PENDING_APPROVAL":
      return `Waiting for ${approver} to approve.`;
    case "APPROVED":
      return `Approved by ${approver}. Waiting for ${rm || "an Admin or Manager"} to decide Go or No-Go.`;
    case "GO":
      return "This lead is a Go.";
    default:
      return "This lead was cancelled (No-Go).";
  }
}

export function LeadWorkflow({ lead, onChanged }) {
  const { users, usersLoading, loadUsers } = useBidStore();
  const [action, setAction] = useState(null);
  const [approverId, setApproverId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const allowed = lead.allowed_actions ?? [];
  const canSend = allowed.includes("SENT_FOR_APPROVAL");
  useEffect(() => {
    if (canSend) loadUsers();
  }, [canSend, loadUsers]);

  // You cannot approve your own request, so you are not in your own list.
  const myId = tokenStorage.getUser()?.id;
  const approvers = users.filter((u) => u.id !== myId && u.is_active !== false && u.roles?.some((r) => APPROVER_ROLES.includes(r)));
  const cfg = action && ACTIONS[action];
  const stepIndex = STEPS.findIndex((s) => s.stage === lead.stage);
  const cancelled = lead.stage === "NO_GO";
  const lastNote = [...(lead.events ?? [])].reverse().find((e) => e.note && e.event_type !== "EDITED");

  function open(a) {
    setAction(a);
    setNote("");
    setApproverId(lead.approver?.id ?? "");
  }

  async function submit(ev) {
    ev.preventDefault();
    if (action === "SENT_FOR_APPROVAL" && !approverId) return toast.error("Choose who should approve this lead");
    if (cfg.noteRequired && !note.trim()) return toast.error(`${cfg.noteLabel} is required`);
    setBusy(true);
    const res = await transitionLead(lead.id, { action, approver_id: approverId, note }).catch(() => ({ ok: false }));
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error?.message ?? "Could not update the lead");
      // Someone else may have moved it on; show where it actually is now.
      if (res.status === 400 || res.status === 403) onChanged();
      return;
    }
    toast.success(cfg.done);
    setAction(null);
    onChanged(res.data);
  }

  return (
    <section className={`space-y-4 rounded-xl border p-5 shadow-sm ${cancelled ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30" : "border-border bg-card"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <GitPullRequestArrow className="size-4 text-primary" aria-hidden />
            Approval
          </h2>
          <p className={`text-sm ${cancelled ? "font-medium text-red-900 dark:text-red-200" : "text-muted-foreground"}`}>{statusLine(lead)}</p>
        </div>
        {allowed.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {allowed.map((a) => {
              const { button, icon: Icon, variant } = ACTIONS[a];
              return (
                <Button key={a} size="sm" variant={variant} className="gap-1.5" onClick={() => open(a)}>
                  <Icon className="size-3.5" />
                  {button}
                </Button>
              );
            })}
          </div>
        )}
      </div>

      {!cancelled && (
        <ol className="flex items-center gap-2" aria-label="Approval progress">
          {STEPS.map((s, i) => {
            const done = i < stepIndex || lead.stage === "GO";
            const current = i === stepIndex && lead.stage !== "GO";
            return (
              <li key={s.stage} className="flex flex-1 items-center gap-2" aria-current={current ? "step" : undefined}>
                <span className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold
                  ${done ? "border-emerald-600 bg-emerald-600 text-white" : current ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className={`truncate text-xs ${current ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
                {i < STEPS.length - 1 && <span className={`h-px flex-1 ${done ? "bg-emerald-600" : "bg-border"}`} />}
              </li>
            );
          })}
        </ol>
      )}

      {lastNote && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <span className="font-semibold">{lastNote.actor.full_name}:</span> <span className="whitespace-pre-line break-words">{lastNote.note}</span>
        </p>
      )}

      {lead.events?.length > 0 && (
        <ul className="space-y-1.5 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          {lead.events.map((e) => (
            <li key={e.id} className="flex flex-wrap gap-x-1.5">
              <span className="font-medium text-foreground">{e.actor.full_name}</span>
              <span>{EVENT_LABELS[e.event_type] ?? e.event_type}</span>
              <span>· {formatDateTime(e.created_at)}</span>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!action} onOpenChange={(o) => !o && !busy && setAction(null)}>
        <DialogContent className="sm:max-w-md">
          {cfg && (
            <form onSubmit={submit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{cfg.title}</DialogTitle>
                <DialogDescription>{cfg.description}</DialogDescription>
              </DialogHeader>
              {action === "SENT_FOR_APPROVAL" && (
                <div className="space-y-1.5">
                  <label htmlFor="lead-approver" className="text-xs font-medium text-foreground">Approver *</label>
                  <UserSelect id="lead-approver" users={approvers} loading={usersLoading} value={approverId} onChange={setApproverId} placeholder="Select an Admin or Manager" />
                </div>
              )}
              <div className="space-y-1.5">
                <label htmlFor="lead-step-note" className="text-xs font-medium text-foreground">{cfg.noteLabel}{cfg.noteRequired && " *"}</label>
                <Textarea id="lead-step-note" value={note} onChange={(e) => setNote(e.target.value)} required={cfg.noteRequired} className="min-h-[90px] text-sm" />
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setAction(null)} disabled={busy}>Close</Button>
                <Button type="submit" size="sm" variant={cfg.variant === "destructive" ? "destructive" : "default"} disabled={busy} className="gap-1.5">
                  {busy && <Loader2 className="size-3.5 animate-spin" />}
                  {cfg.confirm}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
