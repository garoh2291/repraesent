import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import {
  Mail,
  Phone,
  MapPin,
  Copy,
  Check,
  ExternalLink,
  Send,
  PhoneCall,
  CalendarClock,
  Briefcase,
} from "lucide-react";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { ContactSourceBadge } from "~/components/molecule/contact-badges";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { formatDate } from "~/lib/utils/format";
import type { ContactDetail } from "~/lib/api/contacts-crm";

export type { ContactDetail };

function initials(displayName: string): string {
  const cleaned = displayName.trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatAddressOneLine(row: Record<string, unknown>): string {
  const parts = [
    row.line1,
    row.line2,
    [row.postal_code, row.city].filter(Boolean).join(" "),
    row.state,
    row.country,
  ]
    .map((p) => (p == null ? "" : String(p).trim()))
    .filter(Boolean);
  return parts.join(", ");
}

function findContactPrimary(
  rows: Record<string, unknown>[],
  contactId: string | null,
): Record<string, unknown> | null {
  if (!contactId) return null;
  const scoped = rows.filter(
    (r) =>
      r.entity_table === "contacts" && String(r.entity_id) === contactId,
  );
  if (scoped.length === 0) return null;
  return scoped.find((r) => r.is_primary === true) ?? scoped[0];
}

function labelForRowType(
  row: Record<string, unknown> | null,
  t: ReturnType<typeof useTranslation>["t"],
): string | undefined {
  if (!row?.type) return undefined;
  const raw = String(row.type).trim();
  if (!raw) return undefined;
  return t(`contacts.types.${raw}`, {
    defaultValue: raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase(),
  });
}

interface CopyChipProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hrefAction?: {
    href: string;
    label: string;
    icon: React.ReactNode;
    newTab?: boolean;
  };
  secondary?: string;
  fallback?: string;
}

function CopyChip({
  icon,
  label,
  value,
  hrefAction,
  secondary,
  fallback,
}: CopyChipProps) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();
  const isEmpty = !value;

  const copy = async () => {
    if (isEmpty) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(
        t("contacts.copied", { defaultValue: "Copied to clipboard" })
      );
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(
        t("contacts.copyFailed", { defaultValue: "Could not copy" })
      );
    }
  };

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 rounded-xl border border-border/70 bg-card/60 px-3.5 py-3 transition-all",
        "hover:border-border hover:bg-card hover:shadow-(--shadow-sm)",
        isEmpty && "opacity-60"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          "bg-primary/10 text-primary",
          "[&>svg]:h-4 [&>svg]:w-4"
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "mt-0.5 truncate text-sm font-medium text-foreground",
            isEmpty && "italic text-muted-foreground/80"
          )}
          title={value || fallback}
        >
          {value || fallback || "—"}
        </p>
        {secondary ? (
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {secondary}
          </p>
        ) : null}
      </div>
      {!isEmpty ? (
        <div className="ml-1 flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {hrefAction ? (
            <a
              href={hrefAction.href}
              target={hrefAction.newTab ? "_blank" : undefined}
              rel={hrefAction.newTab ? "noreferrer" : undefined}
              aria-label={hrefAction.label}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&>svg]:h-3.5 [&>svg]:w-3.5"
            >
              {hrefAction.icon}
            </a>
          ) : null}
          <button
            type="button"
            onClick={copy}
            aria-label={t("contacts.copyValue", {
              defaultValue: "Copy {{label}}",
              label,
            })}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface ContactHeroProps {
  displayName: string;
  crm: Record<string, unknown>;
  contact: Record<string, unknown> | null;
  emails: Record<string, unknown>[];
  phones: Record<string, unknown>[];
  addresses: Record<string, unknown>[];
  leadId: string | null;
  viewContactId?: string | null;
  /** When set with `viewContactId`, shows a chip that opens the shared Create deal dialog. */
  onOpenCreateDeal?: () => void;
}

export function ContactHero({
  displayName,
  crm,
  contact,
  emails,
  phones,
  addresses,
  leadId,
  viewContactId,
  onOpenCreateDeal,
}: ContactHeroProps) {
  const { t } = useTranslation();
  const contactId = contact?.id ? String(contact.id) : null;

  const primaryEmailRow = useMemo(() => {
    return findContactPrimary(emails, contactId);
  }, [emails, contactId]);

  const primaryPhoneRow = useMemo(() => {
    return findContactPrimary(phones, contactId);
  }, [phones, contactId]);

  const primaryAddressRow = useMemo(() => {
    return findContactPrimary(addresses, contactId);
  }, [addresses, contactId]);

  const emailValue = primaryEmailRow
    ? String(primaryEmailRow.address ?? "")
    : "";
  const emailSecondary = labelForRowType(primaryEmailRow, t);

  const phoneValue = primaryPhoneRow
    ? String(primaryPhoneRow.number ?? "")
    : "";
  const phoneSecondary = labelForRowType(primaryPhoneRow, t);

  const addressValue = primaryAddressRow
    ? formatAddressOneLine(primaryAddressRow)
    : "";
  const addressSecondary = labelForRowType(primaryAddressRow, t);

  const source = String(crm.source ?? "");
  const lastContactedRaw = crm.last_contacted_at as
    | string
    | null
    | undefined;

  return (
    <section className="app-fade-up overflow-hidden rounded-2xl border border-border bg-card shadow-(--shadow)">
      <div
        aria-hidden
        className="relative h-20 bg-linear-to-r from-secondary/25 via-secondary/10 to-primary/10 dark:from-secondary/15 dark:via-secondary/5 dark:to-primary/15"
      />

      <div className="px-4 pb-5 pt-0 sm:px-6">
        <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
          <Avatar
            size="lg"
            className="size-20 shrink-0 border-4 border-card bg-card shadow-(--shadow)"
          >
            <AvatarFallback className="bg-linear-to-br from-secondary/30 to-primary/10 text-lg font-semibold tracking-tight text-foreground">
              {initials(displayName)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
              {displayName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {source ? <ContactSourceBadge source={source} /> : null}
              {lastContactedRaw ? (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <CalendarClock className="h-3 w-3" />
                  {t("contacts.lastContactedAt", {
                    defaultValue: "Last contacted {{date}}",
                    date: formatDate(new Date(lastContactedRaw), "PP"),
                  })}
                </span>
              ) : null}
              {leadId && !viewContactId ? (
                <Link
                  to={`/lead-form/${leadId}`}
                  className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {t("contacts.openLead", { defaultValue: "Open lead" })}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : null}
              {viewContactId ? (
                <>
                  <Link
                    to={`/contacts/${viewContactId}`}
                    state={{ from: "lead", leadId }}
                    className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    {t("leads.detail.viewContact", {
                      defaultValue: "View contact",
                    })}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  {onOpenCreateDeal ? (
                    <button
                      type="button"
                      onClick={onOpenCreateDeal}
                      className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      {t("leads.detail.createDeal", {
                        defaultValue: "Create deal",
                      })}
                      <Briefcase className="h-3 w-3" />
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <CopyChip
            icon={<Mail />}
            label={t("contacts.primaryEmailLabel", {
              defaultValue: "Primary email",
            })}
            value={emailValue}
            secondary={emailValue ? emailSecondary : undefined}
            fallback={t("contacts.noPrimaryEmail", {
              defaultValue: "No email on file",
            })}
            hrefAction={
              emailValue
                ? {
                    href: `mailto:${emailValue}`,
                    label: t("contacts.sendEmail", {
                      defaultValue: "Send email",
                    }),
                    icon: <Send />,
                  }
                : undefined
            }
          />
          <CopyChip
            icon={<Phone />}
            label={t("contacts.primaryPhoneLabel", {
              defaultValue: "Primary phone",
            })}
            value={phoneValue}
            secondary={phoneValue ? phoneSecondary : undefined}
            fallback={t("contacts.noPrimaryPhone", {
              defaultValue: "No phone on file",
            })}
            hrefAction={
              phoneValue
                ? {
                    href: `tel:${phoneValue.replace(/\s+/g, "")}`,
                    label: t("contacts.callPhone", {
                      defaultValue: "Call",
                    }),
                    icon: <PhoneCall />,
                  }
                : undefined
            }
          />
          <CopyChip
            icon={<MapPin />}
            label={t("contacts.primaryAddressLabel", {
              defaultValue: "Primary address",
            })}
            value={addressValue}
            secondary={addressValue ? addressSecondary : undefined}
            fallback={t("contacts.noPrimaryAddress", {
              defaultValue: "No address on file",
            })}
            hrefAction={
              addressValue
                ? {
                    href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressValue)}`,
                    label: t("contacts.openInMaps", {
                      defaultValue: "Open in Maps",
                    }),
                    icon: <ExternalLink />,
                    newTab: true,
                  }
                : undefined
            }
          />
        </div>
      </div>
    </section>
  );
}
