import { useEffect, useState } from "react";
import { CheckCheck, FileSpreadsheet, Loader2, Play, Plus, Send, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addPrebidItem, deletePrebidItem, prebidTransition, updatePrebidItem } from "../../services/leads";
import { useBidStore } from "../../store/useBidStore";
import { formatDate } from "../../lib/tenderFormat";
import { downloadExcel } from "../../lib/excelExport";
import { actsAs } from "../../lib/roles";
import { UserSelect } from "./UserSelect";
import { PrebidBadge } from "./leadBadges";
import { PrebidActivity } from "./PrebidActivity";
import { UserAvatar } from "../admin/UserAvatar";

// Who can be handed the sheet. Mirrors domain.PrebidAssigneeRoles — only to narrow
// the picker; the server re-checks the chosen person's role. The Delivery Manager is
// a view-only role, so DM and BM are matched on the role itself, not through actsAs.
const PICKERS = {
  pm: { label: "Pre-Sales", match: (u) => actsAs(u, "PRE_SALES") },
  dm: { label: "Delivery Manager", match: (u) => u.roles?.includes("DELIVERY_MANAGER") },
  bm: { label: "Bid Manager", match: (u) => u.roles?.includes("BID_MANAGER") },
};

// One entry per server action (lead.prebid.actions): its button and confirm dialog.
const ACTIONS = {
  PREBID_START: {
    button: "Start Prebid", icon: Play, pick: "pm", variant: "default",
    title: "Start the prebid queries",
    description: "Choose the Pre-Sales person who will list the OEMs for each product. The sheet is pre-filled with this lead's products, and they are notified by alert and email.",
    noteLabel: "Note for Pre-Sales (optional)", confirm: "Start Prebid", done: "Prebid started",
  },
  PREBID_SEND_PM: {
    button: "Send to Pre-Sales", icon: Send, pick: "pm", variant: "outline",
    title: "Send the sheet to Pre-Sales",
    description: "They update the Product / OEM list and remarks, then return it to you.",
    noteLabel: "Note (optional)", confirm: "Send to Pre-Sales", done: "Sent to Pre-Sales",
  },
  PREBID_SEND_DM: {
    button: "Send to Delivery Manager", icon: Send, pick: "dm", variant: "outline",
    title: "Send the sheet to the Delivery Manager",
    description: "They add a delivery comment on each product, then return it to you.",
    noteLabel: "Note (optional)", confirm: "Send to Delivery Manager", done: "Sent to the Delivery Manager",
  },
  PREBID_SEND_BM: {
    button: "Send to Bid Manager", icon: Send, pick: "bm", variant: "outline",
    title: "Send the sheet to the Bid Manager",
    description: "They add their comment on each product, then return it to you.",
    noteLabel: "Note (optional)", confirm: "Send to Bid Manager", done: "Sent to the Bid Manager",
  },
  PREBID_RETURN: {
    button: "Return to Account Manager", icon: Undo2, variant: "default",
    title: "Return the sheet to the Account Manager",
    description: "You will not be able to edit it after this. The Account Manager is notified.",
    noteLabel: "Note (optional)", confirm: "Return", done: "Returned to the Account Manager",
  },
  PREBID_MARK_SENT: {
    button: "Mark Sent to Customer", icon: CheckCheck, variant: "default",
    title: "Mark the queries as sent to the customer",
    description: "Use Export Excel first and email the file to the customer from your own mailbox. After this you can only record the customer's answers.",
    noteLabel: "Note (optional)", confirm: "Mark as Sent", done: "Marked as sent to the customer",
  },
  PREBID_CLOSE: {
    button: "Close Prebid", icon: CheckCheck, variant: "outline",
    title: "Close the prebid queries",
    description: "The sheet becomes read-only. This cannot be undone.",
    noteLabel: "Note (optional)", confirm: "Close Prebid", done: "Prebid closed",
  },
};

// One row of the sheet is a card; its fields sit in these rows of a responsive grid (they stack on a
// narrow screen), so the sheet never scrolls sideways however long the comments get.
const FIELD_GROUPS = [
  { cols: "sm:grid-cols-3", fields: [["product", "Product"], ["oem", "OEM"], ["clause_ref", "Clause / Page Ref"]] },
  { cols: "sm:grid-cols-3", fields: [["pm_remarks", "PM Remarks"], ["dm_comment", "DM Comment"], ["bm_comment", "BM Comment"]] },
  { cols: "sm:grid-cols-2", fields: [["query", "Query"], ["customer_response", "Customer Response"]] },
];
const ALL_FIELDS = FIELD_GROUPS.flatMap((g) => g.fields);
const LABEL = Object.fromEntries(ALL_FIELDS);

const blankItem = (id) => ({
  id, clause_ref: "", product: "", oem: "", pm_remarks: "", dm_comment: "", bm_comment: "", query: "", customer_response: "",
});

// Who has the sheet right now, in which role, and what they are meant to do with it.
function holderOf(lead) {
  const p = lead.prebid;
  const am = { user: lead.lead_owner, role: "Account Manager" };
  const who = p.assignee ?? { full_name: "the assigned person" };
  switch (p.stage) {
    case "NOT_STARTED":
      return { ...am, doing: "Not started. The Account Manager starts it by choosing a Pre-Sales person." };
    case "WITH_PM":
      return { user: who, role: "Pre-Sales", doing: "Listing the OEMs and remarks for each product." };
    case "WITH_DM":
      return { user: who, role: "Delivery Manager", doing: "Adding a delivery comment on each product." };
    case "WITH_BM":
      return { user: who, role: "Bid Manager", doing: "Adding a comment on each product." };
    case "WITH_AM":
      return { ...am, doing: "Compile the queries, then send them to the customer." };
    case "SENT":
      return { ...am, doing: `Queries sent to the customer${p.sent_at ? ` on ${formatDate(p.sent_at)}` : ""}. Recording the customer's answers.` };
    default:
      return null; // closed
  }
}

// One field of a row. Editable ones save on blur, one PATCH per field, so two people working
// on different fields never overwrite each other.
function Cell({ leadId, item, field, editable, onSaved, onRefused }) {
  const value = item[field];
  const [draft, setDraft] = useState(value); // the parent keys this cell on its saved value, so a save resets the draft
  const label = LABEL[field];

  async function save() {
    if (draft.trim() === value) return;
    const res = await updatePrebidItem(leadId, item.id, { [field]: draft }).catch(() => ({ ok: false }));
    if (!res.ok) {
      toast.error(res.error?.message ?? "Could not save");
      setDraft(value);
      if (res.status === 400 || res.status === 403) onRefused(); // the sheet moved on: show where it is now
      return;
    }
    onSaved(res.data);
  }

  return (
    <div className="min-w-0 space-y-1">
      <p className={`text-[11px] font-medium ${editable ? "text-primary" : "text-muted-foreground"}`}>{label}</p>
      {editable ? (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          rows={2}
          maxLength={4000}
          aria-label={`${label}, row ${item.id.slice(0, 4)}`}
          className="min-h-16 resize-y bg-primary/[0.03] text-sm"
        />
      ) : (
        <p className="min-h-9 whitespace-pre-line break-words rounded-md bg-muted/30 px-3 py-2 text-sm text-foreground">
          {value || <span className="text-muted-foreground/50">—</span>}
        </p>
      )}
    </div>
  );
}

export function PrebidPanel({ lead, setLead, reload }) {
  const { users, usersLoading, loadUsers } = useBidStore();
  const p = lead.prebid;
  const items = p.items ?? [];
  const actions = p.actions ?? [];
  const editable = p.editable ?? [];
  const canRows = editable.includes("product");

  const [action, setAction] = useState(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRow, setConfirmRow] = useState(null);
  const [rowBusy, setRowBusy] = useState(false);

  const needsPeople = actions.some((a) => ACTIONS[a]?.pick);
  useEffect(() => {
    if (needsPeople) loadUsers();
  }, [needsPeople, loadUsers]);

  const cfg = action && ACTIONS[action];
  const picker = cfg?.pick && PICKERS[cfg.pick];
  const people = picker ? users.filter((u) => u.is_active !== false && picker.match(u)) : [];

  const queries = items.filter((i) => i.query.trim());
  const answered = queries.filter((i) => i.customer_response.trim()).length;
  const started = p.stage !== "NOT_STARTED";
  const holder = holderOf(lead);

  function open(a) {
    setAction(a);
    setNote("");
    // Handing it back to the same person is the common case; otherwise they choose.
    const again = ACTIONS[a].pick && p.assignee && users.some((u) => u.id === p.assignee.id && PICKERS[ACTIONS[a].pick].match(u));
    setAssigneeId(again ? p.assignee.id : "");
  }

  async function submit(ev) {
    ev.preventDefault();
    if (picker && !assigneeId) return toast.error(`Choose a ${picker.label} person`);
    setBusy(true);
    const res = await prebidTransition(lead.id, { action, assignee_id: assigneeId, note }).catch(() => ({ ok: false }));
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error?.message ?? "Could not update the prebid sheet");
      if (res.status === 400 || res.status === 403) reload(); // someone else may have moved it on
      return;
    }
    toast.success(cfg.done);
    setAction(null);
    setLead(res.data);
  }

  // Functional updates: two saves landing close together must not overwrite each other.
  const patchItems = (fn) => setLead((prev) => ({ ...prev, prebid: { ...prev.prebid, items: fn(prev.prebid.items ?? []) } }));

  async function addRow() {
    setRowBusy(true);
    const res = await addPrebidItem(lead.id).catch(() => ({ ok: false }));
    setRowBusy(false);
    if (!res.ok) {
      toast.error(res.error?.message ?? "Could not add a row");
      if (res.status === 400 || res.status === 403) reload();
      return;
    }
    patchItems((list) => [...list, blankItem(res.data.id)]);
  }

  async function removeRow() {
    const row = confirmRow;
    setRowBusy(true);
    const res = await deletePrebidItem(lead.id, row.id).catch(() => ({ ok: false }));
    setRowBusy(false);
    setConfirmRow(null);
    if (!res.ok) {
      toast.error(res.error?.message ?? "Could not delete the row");
      if (res.status === 400 || res.status === 403) reload();
      return;
    }
    patchItems((list) => list.filter((i) => i.id !== row.id));
  }

  // What the customer gets: the clause, the product and the query — never the
  // internal PM / DM / BM comments.
  async function exportExcel() {
    if (!queries.length) return toast.error("Write at least one query first");
    const name = (lead.title || lead.account_name).replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
    await downloadExcel({
      sheetName: "Prebid Queries",
      headers: ["S.No", "Clause / Page Ref", "Product", "Query"],
      rows: queries.map((r, i) => [i + 1, r.clause_ref, r.product, r.query]),
      filename: `Prebid-Queries-${name || "lead"}.xlsx`,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-muted/20 p-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {started ? <PrebidBadge stage={p.stage} /> : <span className="text-xs font-medium text-muted-foreground">Not started</span>}
            {(p.stage === "SENT" || p.stage === "CLOSED") && queries.length > 0 && (
              <span className="text-xs text-muted-foreground">{answered} of {queries.length} answered</span>
            )}
          </div>
          {holder ? (
            <div className="flex items-center gap-3">
              <UserAvatar fullName={holder.user.full_name} size="lg" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Currently with</p>
                <p className="truncate text-sm font-semibold text-foreground">
                  {holder.user.full_name} <span className="font-normal text-muted-foreground">· {holder.role}</span>
                </p>
                <p className="text-sm text-muted-foreground">{holder.doing}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Closed. The sheet is read-only.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => {
            const { button, icon: Icon, variant } = ACTIONS[a];
            return (
              <Button key={a} size="sm" variant={variant} className="gap-1.5" onClick={() => open(a)}>
                <Icon className="size-3.5" />
                {button}
              </Button>
            );
          })}
          {started && queries.length > 0 && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={exportExcel}>
              <FileSpreadsheet className="size-3.5" />
              Export Excel
            </Button>
          )}
        </div>
      </div>

      {editable.length > 0 && (
        <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">
          It is your turn. You can edit: {editable.map((f) => LABEL[f]).join(", ")}.
        </p>
      )}

      <PrebidActivity lead={lead} />

      {started && (
        <section className="space-y-3" aria-label="Product sheet">
          <h3 className="text-sm font-semibold text-foreground">
            Product Sheet <span className="font-normal text-muted-foreground">({items.length})</span>
          </h3>
          {items.length === 0 && (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No rows yet.{canRows ? " Use Add Row to start the list." : ""}
            </p>
          )}
          <ol className="space-y-3">
            {items.map((it, i) => (
              <li key={it.id} aria-label={`Row ${i + 1}`} className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                    <span className="truncate">{it.product || "New row"}</span>
                  </p>
                  {canRows && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete row ${i + 1}`}
                      disabled={rowBusy}
                      onClick={() => setConfirmRow(ALL_FIELDS.some(([k]) => it[k]) ? it : { ...it, empty: true })}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
                {FIELD_GROUPS.map((g) => (
                  <div key={g.cols + g.fields[0][0]} className={`grid grid-cols-1 gap-3 ${g.cols}`}>
                    {g.fields.map(([key]) => (
                      <Cell
                        key={`${it.id}:${key}:${it[key]}`}
                        leadId={lead.id}
                        item={it}
                        field={key}
                        editable={editable.includes(key)}
                        onSaved={(saved) => patchItems((list) => list.map((x) => (x.id === saved.id ? saved : x)))}
                        onRefused={reload}
                      />
                    ))}
                  </div>
                ))}
              </li>
            ))}
          </ol>
        </section>
      )}

      {canRows && (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={addRow} disabled={rowBusy}>
          {rowBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Add Row
        </Button>
      )}

      <Dialog open={!!action} onOpenChange={(o) => !o && !busy && setAction(null)}>
        <DialogContent className="sm:max-w-md">
          {cfg && (
            <form onSubmit={submit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{cfg.title}</DialogTitle>
                <DialogDescription>{cfg.description}</DialogDescription>
              </DialogHeader>
              {picker && (
                <div className="space-y-1.5">
                  <label htmlFor="prebid-assignee" className="text-xs font-medium text-foreground">{picker.label} *</label>
                  <UserSelect id="prebid-assignee" users={people} loading={usersLoading} value={assigneeId} onChange={setAssigneeId} placeholder={`Select a ${picker.label}`} />
                  {!usersLoading && people.length === 0 && (
                    <p className="text-xs text-muted-foreground">No active {picker.label} users found. Ask an Admin to assign the role.</p>
                  )}
                </div>
              )}
              <div className="space-y-1.5">
                <label htmlFor="prebid-note" className="text-xs font-medium text-foreground">{cfg.noteLabel}</label>
                <Textarea id="prebid-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} className="min-h-[90px] text-sm" />
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setAction(null)} disabled={busy}>Close</Button>
                <Button type="submit" size="sm" disabled={busy} className="gap-1.5">
                  {busy && <Loader2 className="size-3.5 animate-spin" />}
                  {cfg.confirm}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmRow && !confirmRow.empty} onOpenChange={(o) => !o && setConfirmRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this row?</AlertDialogTitle>
            <AlertDialogDescription>Everything typed in it is removed for good.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={removeRow}>Delete Row</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {confirmRow?.empty && <EmptyRowRemover run={removeRow} />}
    </div>
  );
}

// An empty row needs no confirmation: remove it as soon as it is picked.
function EmptyRowRemover({ run }) {
  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
