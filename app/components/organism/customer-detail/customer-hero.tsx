import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Copy,
  Check,
  Building2,
  ExternalLink,
  CalendarClock,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { formatDate } from "~/lib/utils/format";
import type { CustomerDetail } from "~/lib/api/customers";

export type { CustomerDetail };

function initials(displayName: string): string {
  const cleaned = displayName.trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function statusBadgeVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active" || status === "imported") return "secondary";
  if (status === "completed") return "default";
  if (status === "churned" || status === "lost") return "destructive";
  return "outline";
}

function sourceBadgeVariant(
  source: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (source === "lead_conversion") return "default";
  return "outline";
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

function findPrimary(
  rows: Record<string, unknown>[],
  table: "contacts" | "companies",
  entityId: string | null,
): Record<string, unknown> | null {
  if (!entityId) return null;
  const scoped = rows.filter(
    (r) => r.entity_table === table && String(r.entity_id) === entityId,
  );
  if (scoped.length === 0) return null;
  return scoped.find((r) => r.is_primary === true) ?? scoped[0];
}

interface CopyChipProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hrefAction?: { href: string; label: string };
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
        t("customers.copied", { defaultValue: "Copied to clipboard" }),
      );
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("customers.copyFailed", { defaultValue: "Could not copy" }));
    }
  };

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 rounded-xl border border-border/70 bg-card/60 px-3.5 py-3 transition-all",
        "hover:border-border hover:bg-card hover:shadow-(--shadow-sm)",
        isEmpty && "opacity-60",
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          "bg-primary/10 text-primary",
          "[&>svg]:h-4 [&>svg]:w-4",
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
            isEmpty && "italic text-muted-foreground/80",
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
              aria-label={hrefAction.label}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
          <button
            type="button"
            onClick={copy}
            aria-label={t("customers.copyValue", {
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

interface CustomerHeroProps {
  displayName: string;
  customer: Record<string, unknown>;
  contact: Record<string, unknown> | null;
  company: Record<string, unknown> | null;
  emails: Record<string, unknown>[];
  phones: Record<string, unknown>[];
  addresses: Record<string, unknown>[];
  leadId: string | null;
}

export function CustomerHero({
  displayName,
  customer,
  contact,
  company,
  emails,
  phones,
  addresses,
  leadId,
}: CustomerHeroProps) {
  const { t } = useTranslation();
  const contactId = contact?.id ? String(contact.id) : null;
  const companyId = company?.id ? String(company.id) : null;

  const primaryEmailRow = useMemo(() => {
    return (
      findPrimary(emails, "contacts", contactId) ??
      findPrimary(emails, "companies", companyId)
    );
  }, [emails, contactId, companyId]);

  const primaryPhoneRow = useMemo(() => {
    return (
      findPrimary(phones, "contacts", contactId) ??
      findPrimary(phones, "companies", companyId)
    );
  }, [phones, contactId, companyId]);

  const primaryAddressRow = useMemo(() => {
    return (
      findPrimary(addresses, "contacts", contactId) ??
      findPrimary(addresses, "companies", companyId)
    );
  }, [addresses, contactId, companyId]);

  const emailValue = primaryEmailRow
    ? String(primaryEmailRow.address ?? "")
    : "";
  const emailScope =
    primaryEmailRow?.entity_table === "companies"
      ? t("customers.scopeCompany", { defaultValue: "Company" })
      : t("customers.scopePersonal", { defaultValue: "Personal" });

  const phoneValue = primaryPhoneRow
    ? String(primaryPhoneRow.number ?? "")
    : "";
  const phoneScope =
    primaryPhoneRow?.entity_table === "companies"
      ? t("customers.scopeCompany", { defaultValue: "Company" })
      : t("customers.scopePersonal", { defaultValue: "Personal" });

  const addressValue = primaryAddressRow
    ? formatAddressOneLine(primaryAddressRow)
    : "";
  const addressScope =
    primaryAddressRow?.entity_table === "companies"
      ? t("customers.scopeCompany", { defaultValue: "Company" })
      : t("customers.scopePersonal", { defaultValue: "Personal" });

  const status = String(customer.status ?? "");
  const source = String(customer.source ?? "");
  const companyName = company ? String(company.name ?? "") : "";
  const lastContactedRaw = customer.last_contacted_at as string | null | undefined;

  return (
    <section className="app-fade-up overflow-hidden rounded-2xl border border-border bg-card shadow-(--shadow)">
      <div
        aria-hidden
        className="relative h-20 bg-linear-to-r from-secondary/25 via-secondary/10 to-primary/10 dark:from-secondary/15 dark:via-secondary/5 dark:to-primary/15"
      />

      <div className="px-4 pb-5 pt-0 sm:px-6">
        <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-5">
          <Avatar
            size="lg"
            className="size-20 shrink-0 border-4 border-card bg-card shadow-(--shadow)"
          >
            <AvatarFallback className="bg-linear-to-br from-secondary/30 to-primary/10 text-lg font-semibold tracking-tight text-foreground">
              {initials(displayName)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 pt-1 sm:pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/customers"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" />
                {t("customers.backToList", { defaultValue: "Back to customers" })}
              </Link>
            </div>
            <h1 className="mt-0.5 truncate text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
              {displayName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {status ? (
                <Badge
                  variant={statusBadgeVariant(status)}
                  className="capitalize"
                >
                  {status}
                </Badge>
              ) : null}
              {source ? (
                <Badge
                  variant={sourceBadgeVariant(source)}
                  className="capitalize"
                >
                  {source.replace(/_/g, " ")}
                </Badge>
              ) : null}
              {companyName ? (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  <span className="truncate">{companyName}</span>
                </span>
              ) : null}
              {lastContactedRaw ? (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <CalendarClock className="h-3 w-3" />
                  {t("customers.lastContactedAt", {
                    defaultValue: "Last contacted {{date}}",
                    date: formatDate(new Date(lastContactedRaw), "PP"),
                  })}
                </span>
              ) : null}
              {leadId ? (
                <Link
                  to={`/lead-form/${leadId}`}
                  className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {t("customers.openLead", { defaultValue: "Open lead" })}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <CopyChip
            icon={<Mail />}
            label={t("customers.primaryEmailLabel", {
              defaultValue: "Primary email",
            })}
            value={emailValue}
            secondary={emailValue ? emailScope : undefined}
            fallback={t("customers.noPrimaryEmail", {
              defaultValue: "No email on file",
            })}
            hrefAction={
              emailValue
                ? {
                    href: `mailto:${emailValue}`,
                    label: t("customers.sendEmail", {
                      defaultValue: "Send email",
                    }),
                  }
                : undefined
            }
          />
          <CopyChip
            icon={<Phone />}
            label={t("customers.primaryPhoneLabel", {
              defaultValue: "Primary phone",
            })}
            value={phoneValue}
            secondary={phoneValue ? phoneScope : undefined}
            fallback={t("customers.noPrimaryPhone", {
              defaultValue: "No phone on file",
            })}
            hrefAction={
              phoneValue
                ? {
                    href: `tel:${phoneValue.replace(/\s+/g, "")}`,
                    label: t("customers.callPhone", {
                      defaultValue: "Call",
                    }),
                  }
                : undefined
            }
          />
          <CopyChip
            icon={<MapPin />}
            label={t("customers.primaryAddressLabel", {
              defaultValue: "Primary address",
            })}
            value={addressValue}
            secondary={addressValue ? addressScope : undefined}
            fallback={t("customers.noPrimaryAddress", {
              defaultValue: "No address on file",
            })}
            hrefAction={
              addressValue
                ? {
                    href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressValue)}`,
                    label: t("customers.openInMaps", {
                      defaultValue: "Open in Maps",
                    }),
                  }
                : undefined
            }
          />
        </div>
      </div>
    </section>
  );
}
