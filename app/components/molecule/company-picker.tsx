import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Building2, Plus, X } from "lucide-react";
import { getContacts } from "~/lib/api/contacts-crm";
import { useAuthContext } from "~/providers/auth-provider";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "~/components/ui/popover";

/**
 * A company chosen in a form: an existing one (`id` set) or a name the owner
 * just typed (`id` null) — that one is created when the form is saved, so
 * nobody has to leave the dialog to add a company first.
 */
export interface CompanyPickerValue {
  id: string | null;
  name: string;
}

export const EMPTY_COMPANY: CompanyPickerValue = { id: null, name: "" };

/** What the API wants for a picked or typed company. */
export function companyPickerPayload(value: CompanyPickerValue): {
  parent_contact_id?: string;
  parent_company_name?: string;
} {
  if (value.id) return { parent_contact_id: value.id };
  const name = value.name.trim();
  return name ? { parent_company_name: name } : {};
}

const COMPANY_ERROR_CODES = [
  "COMPANY_NAME_REQUIRED",
  "COMPANY_NOT_FOUND",
  "COMPANY_PARENT_SELF",
  "COMPANY_PARENT_NOT_COMPANY",
  "COMPANY_PARENT_LOOP",
] as const;

/**
 * The translated sentence for a company rule the server refused, or null when
 * the error is something else (the caller then shows its own message).
 */
export function companyErrorMessage(
  error: unknown,
  t: (key: string) => string,
): string | null {
  const code = (error as { response?: { data?: { code?: unknown } } })
    ?.response?.data?.code;
  return typeof code === "string" &&
    (COMPANY_ERROR_CODES as readonly string[]).includes(code)
    ? t(`contacts.company.errors.${code}`)
    : null;
}

interface CompanyPickerProps {
  id?: string;
  value: CompanyPickerValue;
  onChange: (value: CompanyPickerValue) => void;
  placeholder?: string;
  /** The company being edited — it cannot be part of itself. */
  excludeId?: string;
  disabled?: boolean;
}

export function CompanyPicker({
  id,
  value,
  onChange,
  placeholder,
  excludeId,
  disabled,
}: CompanyPickerProps) {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounced = useDebounce(value.name.trim(), 250);

  // Phones: this field sits in a bottom sheet with the keyboard up. The list
  // must stay in the strip between the sheet top and the keyboard, so the
  // keyboard height (`--kb`, set by useKeyboardInset) counts as an edge.
  const [keyboard, setKeyboard] = useState(0);
  useEffect(() => {
    if (!open) return;
    const read = () =>
      setKeyboard(
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--kb"),
        ) || 0,
      );
    read();
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", read);
    return () => viewport?.removeEventListener("resize", read);
  }, [open]);

  /** Once the keyboard is up, keep the field itself in view above the list. */
  const keepInView = () => {
    window.setTimeout(
      () => wrapperRef.current?.scrollIntoView({ block: "nearest" }),
      300,
    );
  };

  const query = useQuery({
    queryKey: ["contacts", "company-picker", debounced],
    queryFn: () =>
      getContacts({
        page: 1,
        limit: 8,
        kind: "company",
        search: debounced || undefined,
      }),
    enabled: !!currentWorkspace && open && !disabled,
    staleTime: 30 * 1000,
  });

  const rows = (query.data?.data ?? []).filter((c) => c.id !== excludeId);
  const typed = value.name.trim();
  const exact = rows.find(
    (c) => (c.contact_full_name ?? "").trim().toLowerCase() === typed.toLowerCase(),
  );
  const showNew = !value.id && typed.length > 0 && !exact && !query.isFetching;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative" ref={wrapperRef}>
          <Building2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={id}
            value={value.name}
            disabled={disabled}
            onChange={(e) => {
              onChange({ id: null, name: e.target.value });
              setOpen(true);
            }}
            onFocus={() => {
              setOpen(true);
              keepInView();
            }}
            onClick={() => setOpen(true)}
            placeholder={placeholder}
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="next"
            className="px-9 max-sm:pr-11"
          />
          {value.name ? (
            <button
              type="button"
              onClick={() => onChange(EMPTY_COMPANY)}
              aria-label={t("common.clearSearch", { defaultValue: "Clear" })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground max-sm:right-0 max-sm:flex max-sm:size-11 max-sm:items-center max-sm:justify-center max-sm:[&>svg]:size-4"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        collisionPadding={{ top: 8, left: 8, right: 8, bottom: keyboard + 8 }}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          // Keep the list open while the owner types in the field above it.
          if (
            e.target instanceof Node &&
            wrapperRef.current?.contains(e.target)
          ) {
            e.preventDefault();
          }
        }}
        className="w-(--radix-popover-trigger-width) p-0 flex flex-col overflow-hidden"
      >
        <div className="min-h-0 max-h-[min(220px,var(--radix-popover-content-available-height))] overflow-y-auto overscroll-contain">
          {query.isFetching && rows.length === 0 ? (
            <div className="flex items-center justify-center py-4">
              <div className="h-4 w-4 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
            </div>
          ) : null}
          {rows.map((row) => {
            const name = row.contact_full_name?.trim() || "—";
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  onChange({ id: row.id, name });
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted max-sm:min-h-11 max-sm:text-[15px] active:bg-muted"
              >
                <span className="flex-1 truncate font-medium">{name}</span>
                {row.parent_full_name ? (
                  <span className="max-w-[140px] truncate text-xs text-muted-foreground">
                    {row.parent_full_name}
                  </span>
                ) : null}
              </button>
            );
          })}
          {showNew ? (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted max-sm:min-h-11 max-sm:text-[15px] active:bg-muted"
            >
              <Plus className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">
                {t("contacts.company.addNew", {
                  defaultValue: "Add “{{name}}” as a new company",
                  name: typed,
                })}
              </span>
            </button>
          ) : null}
          {!query.isFetching && rows.length === 0 && !showNew ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground max-sm:text-[13px]">
              {t("contacts.company.typeToFind", {
                defaultValue: "Type a company name.",
              })}
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
