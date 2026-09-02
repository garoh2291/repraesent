import { CreditCard, Repeat } from "lucide-react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  extractLeadCheckout,
  type CheckoutLeadLike,
  type CheckoutStatus,
  type LeadCheckout,
} from "~/lib/leads/checkout";
import { formatDateTime, formatMoneyFromMinor } from "~/lib/utils/format";
import { cn } from "~/lib/utils";

/**
 * The card / table indicator for a product-form lead: what they bought and
 * what it came to, toned by outcome. Same shell as the appointment pill so the
 * two sit side by side on a kanban card.
 */
const TONE: Record<CheckoutStatus, string> = {
  paid: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  processing:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
  pending: "border-border bg-muted text-muted-foreground",
  expired: "border-border bg-muted text-muted-foreground",
};

const TEXT_TONE: Record<CheckoutStatus, string> = {
  paid: "text-emerald-700 dark:text-emerald-400",
  processing: "text-amber-700 dark:text-amber-400",
  failed: "text-destructive",
  pending: "text-muted-foreground",
  expired: "text-muted-foreground",
};

export function statusLabel(status: CheckoutStatus, t: TFunction): string {
  return t(`leads.payment.status.${status}`, { defaultValue: status });
}

/** "Appointment +1" — the first product, and how many more. */
export function productLabel(c: LeadCheckout, t: TFunction): string | null {
  if (c.products.length === 0) return null;
  const [first, ...rest] = c.products;
  return rest.length > 0
    ? `${first} ${t("leads.payment.more", { defaultValue: "+{{count}}", count: rest.length })}`
    : first;
}

/** Tooltip text: "Paid · €42.00 · Subscription · 2 Sept 2026, 16:14 · Appointment, Lead Crm". */
export function formatCheckoutSummary(c: LeadCheckout, t: TFunction): string {
  const parts = [statusLabel(c.status, t)];
  if (c.amountTotal != null && c.currency) {
    parts.push(formatMoneyFromMinor(c.amountTotal, c.currency));
  }
  if (c.mode) {
    parts.push(t(`leads.payment.mode.${c.mode}`, { defaultValue: c.mode }));
  }
  if (c.completedAt) parts.push(formatDateTime(c.completedAt));
  if (c.products.length > 0) parts.push(c.products.join(", "));
  return parts.join(" · ");
}

export function LeadPaymentPill({
  lead,
  variant = "pill",
  className,
}: {
  lead: CheckoutLeadLike;
  /** "text" = the bare mobile meta-row item, no border or background. */
  variant?: "pill" | "text";
  className?: string;
}) {
  const { t } = useTranslation();
  const checkout = extractLeadCheckout(lead);
  if (!checkout) return null;

  const Icon = checkout.mode === "subscription" ? Repeat : CreditCard;
  const amount =
    checkout.amountTotal != null && checkout.currency
      ? formatMoneyFromMinor(checkout.amountTotal, checkout.currency)
      : null;
  const product = productLabel(checkout, t);
  const text =
    [product, amount].filter(Boolean).join(" · ") ||
    statusLabel(checkout.status, t);
  const title = formatCheckoutSummary(checkout, t);

  if (variant === "text") {
    return (
      <span
        className={cn(
          "inline-flex min-w-0 items-center gap-1 text-[10px] tabular-nums",
          TEXT_TONE[checkout.status],
          className,
        )}
        title={title}
      >
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate">{text}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex min-w-0 max-w-[160px] items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
        TONE[checkout.status],
        className,
      )}
      title={title}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{text}</span>
    </span>
  );
}
