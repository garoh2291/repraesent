import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Lock, X } from "lucide-react";
import { getContacts } from "~/lib/api/contacts-crm";
import TooltipContainer from "~/components/tooltip-container";
import { cn } from "~/lib/utils";

export interface Recipient {
  email: string;
  name?: string | null;
  /** A locked chip cannot be removed — currently only the BCC logging address. */
  locked?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/**
 * A wrapping chip list with a contact typeahead, the way every mail client does
 * recipients.
 *
 * Chips wrap rather than scrolling in one clipped row: an address you cannot
 * see is an address you cannot check before hitting Send.
 */
export function RecipientField({
  label,
  value,
  onChange,
  lockedHint,
  autoFocus,
  disabled,
}: {
  label: string;
  value: Recipient[];
  onChange: (next: Recipient[]) => void;
  /** Tooltip explaining why a locked chip is there. */
  lockedHint?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [debounced, setDebounced] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(draft.trim()), 250);
    return () => window.clearTimeout(id);
  }, [draft]);

  const { data: suggestions } = useQuery({
    queryKey: ["contacts", "compose-recipients", debounced],
    queryFn: () => getContacts({ search: debounced, limit: 6 }),
    enabled: open && debounced.length >= 2,
  });

  const taken = useMemo(
    () => new Set(value.map((r) => r.email.toLowerCase())),
    [value],
  );

  const options = (suggestions?.data ?? []).filter(
    (c) => c.primary_email && !taken.has(c.primary_email.toLowerCase()),
  );

  const add = (recipient: Recipient): boolean => {
    const email = recipient.email.trim().toLowerCase();
    if (!email) return true;
    if (!isValidEmail(email)) {
      setError(
        t("compose.invalidEmail", {
          defaultValue: "{{value}} is not a valid email address",
          value: recipient.email.trim(),
        }),
      );
      return false;
    }
    setError(null);
    if (taken.has(email)) return true;
    onChange([...value, { ...recipient, email }]);
    return true;
  };

  const commitDraft = (): boolean => {
    if (!draft.trim()) {
      setError(null);
      return true;
    }
    // Pasting a list of addresses is common; split on the usual separators.
    const parts = draft
      .split(/[,;\s]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const failed = parts.filter((p) => !add({ email: p }));
    if (failed.length === 0) {
      setDraft("");
      return true;
    }
    setDraft(failed.join(", "));
    return false;
  };

  const remove = (email: string) => {
    onChange(value.filter((r) => r.email !== email));
    setError(null);
  };

  return (
    <div className="border-b border-border/70 px-1 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <label
          htmlFor={inputId}
          className="shrink-0 pl-1 text-xs font-medium text-muted-foreground"
        >
          {label}
        </label>

        {value.map((r) =>
          r.locked ? (
            <LockedChip key={r.email} recipient={r} hint={lockedHint} />
          ) : (
            <span
              key={r.email}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted py-1 pl-2.5 pr-1 text-xs text-foreground"
            >
              <span className="truncate">{r.name?.trim() || r.email}</span>
              <button
                type="button"
                onClick={() => remove(r.email)}
                disabled={disabled}
                aria-label={t("compose.removeRecipient", {
                  defaultValue: "Remove {{email}}",
                  email: r.email,
                })}
                className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-border hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <X className="size-3" />
              </button>
            </span>
          ),
        )}

        <div className="relative min-w-[8rem] flex-1">
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            value={draft}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            autoComplete="off"
            onChange={(e) => {
              setDraft(e.target.value);
              setOpen(true);
              if (error) setError(null);
            }}
            onBlur={() => {
              // Give a suggestion click time to land before the list closes.
              window.setTimeout(() => setOpen(false), 150);
              commitDraft();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "," || e.key === ";") {
                e.preventDefault();
                commitDraft();
              } else if (
                e.key === "Backspace" &&
                draft === "" &&
                value.length > 0
              ) {
                const last = [...value].reverse().find((r) => !r.locked);
                if (last) remove(last.email);
              }
            }}
            className="h-9 w-full bg-transparent px-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />

          {open && options.length > 0 && (
            <ul
              role="listbox"
              className="absolute top-full left-0 z-50 mt-1 max-h-56 w-72 max-w-[80vw] overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-(--shadow)"
            >
              {options.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    // onMouseDown, not onClick: the input's blur fires first and
                    // would close the list before a click could register.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      add({
                        email: c.primary_email!,
                        name: c.contact_full_name,
                      });
                      setDraft("");
                      setOpen(false);
                    }}
                    className="flex w-full flex-col items-start gap-0.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <span className="text-sm text-foreground">
                      {c.contact_full_name ?? c.primary_email}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {c.primary_email}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1 pl-1 text-xs text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function LockedChip({
  recipient,
  hint,
}: {
  recipient: Recipient;
  hint?: string;
}) {
  const chip = (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-dashed border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
      <Lock aria-hidden className="size-3 shrink-0" />
      <span className="truncate">{recipient.email}</span>
    </span>
  );

  if (!hint) return chip;
  return (
    <TooltipContainer tooltipContent={hint} showCopyButton={false}>
      {/* Focusable so the explanation is reachable without a pointer. */}
      <span
        tabIndex={0}
        className="max-w-full rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {chip}
      </span>
    </TooltipContainer>
  );
}
