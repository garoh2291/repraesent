import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import type { WorkspaceMemberOption } from "~/lib/hooks/useWorkspaceMembers";

/** Radix Select has no empty value, so "nobody" needs a sentinel. */
export const NO_MEMBER = "__none__";

/** Their name, or their e-mail when they have not set one. */
export function memberLabel(m: WorkspaceMemberOption): string {
  return (
    `${m.user_first_name ?? ""} ${m.user_last_name ?? ""}`.trim() || m.user_email
  );
}

/**
 * Searchable workspace-member picker.
 *
 * A plain Select could not cope: workspace emails here run to
 * `demo.sarah+819d0e5c@demo.repraesent.com`, which blew the menu past the
 * trigger and clipped every row. A popover sized to the trigger with its own
 * search box keeps the list readable and usable at twenty members, and the
 * email truncates instead of pushing the layout apart.
 *
 * Its four strings are props rather than `t()` calls: this is used from the
 * forms builder and from the AI-assistant builder, which own different i18n
 * namespaces, and neither should have to borrow the other's keys.
 */
export function MemberPicker({
  members,
  value,
  disabled,
  placeholder,
  searchPlaceholder,
  emptyText,
  noneLabel,
  onChange,
}: {
  members: WorkspaceMemberOption[];
  value?: string;
  disabled?: boolean;
  /** Shown on the trigger when nobody is selected. */
  placeholder: string;
  searchPlaceholder: string;
  /** Shown when the search matches nothing. */
  emptyText: string;
  /** The explicit "nobody" row. */
  noneLabel: string;
  /** Receives a user id, or `NO_MEMBER`. */
  onChange: (userId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // Reset on close: cmdk keeps its own filter state, so without this the next
  // open still shows the last search and an empty list.
  const [query, setQuery] = useState("");
  const selected = members.find((m) => m.user_id === value);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border bg-background px-3 text-sm disabled:opacity-50"
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <MemberAvatar member={selected} />
              <span className="min-w-0 truncate">{memberLabel(selected)}</span>
            </span>
          ) : (
            <span className="truncate text-muted-foreground">
              {placeholder}
            </span>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <Command>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={searchPlaceholder}
          />
          <CommandList className="max-h-64">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={noneLabel}
                onSelect={() => {
                  onChange(NO_MEMBER);
                  setOpen(false);
                }}
              >
                <span className="flex-1 truncate">{noneLabel}</span>
                {!selected ? <Check className="h-3.5 w-3.5" /> : null}
              </CommandItem>
              {members.map((m) => (
                <CommandItem
                  key={m.user_id}
                  value={`${memberLabel(m)} ${m.user_email}`}
                  onSelect={() => {
                    onChange(m.user_id);
                    setOpen(false);
                  }}
                >
                  <MemberAvatar member={m} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{memberLabel(m)}</span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {m.user_email}
                    </span>
                  </span>
                  {m.user_id === value ? (
                    <Check className="h-3.5 w-3.5 shrink-0" />
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function MemberAvatar({ member }: { member: WorkspaceMemberOption }) {
  const src = member.user_avatar_thumb_url ?? member.user_avatar_url;
  const name = memberLabel(member);
  return (
    <span
      aria-hidden
      className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[10px] font-semibold text-muted-foreground"
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
}
