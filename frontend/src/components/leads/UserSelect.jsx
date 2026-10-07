import { useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// Picks one user from the whole organisation, with a filter box so a long
// directory stays usable. allowNone adds an explicit "None" choice.
export function UserSelect({ id, users, loading, value, onChange, placeholder, allowNone = false, invalid = false }) {
  const [query, setQuery] = useState("");
  const selected = users.find((u) => u.id === value);
  const q = query.trim().toLowerCase();
  const shown = q
    ? users.filter((u) => `${u.full_name} ${u.username ?? ""} ${u.department ?? ""}`.toLowerCase().includes(q))
    : users;

  return (
    <DropdownMenu onOpenChange={(open) => !open && setQuery("")}>
      <DropdownMenuTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          size="sm"
          className={`h-9 w-full justify-between gap-1.5 bg-background text-sm font-normal text-foreground hover:bg-muted/50 ${invalid ? "border-destructive" : "border-input"}`}
        >
          <span className={`truncate ${selected ? "" : "text-muted-foreground"}`}>
            {selected?.full_name ?? placeholder}
          </span>
          <ChevronDown className="ml-auto size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[260px] p-0">
        <div className="flex items-center gap-2 border-b border-border px-2.5">
          <Search className="size-3.5 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // Radix menus steal letter keys for typeahead; keep them in the box.
            onKeyDown={(e) => e.key !== "Escape" && e.key !== "ArrowDown" && e.stopPropagation()}
            placeholder="Search people"
            aria-label="Search people"
            className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {allowNone && (
            <>
              <DropdownMenuItem onSelect={() => onChange("")}>None</DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {loading ? (
            <DropdownMenuItem disabled>Loading people…</DropdownMenuItem>
          ) : shown.length === 0 ? (
            <DropdownMenuItem disabled>No one matches "{query}"</DropdownMenuItem>
          ) : (
            shown.map((u) => (
              <DropdownMenuItem key={u.id} onSelect={() => onChange(u.id)} className="gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{u.full_name}</span>
                  {u.department && <span className="block truncate text-[11px] text-muted-foreground">{u.department}</span>}
                </span>
                {u.id === value && <Check className="size-3.5 text-primary" />}
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
