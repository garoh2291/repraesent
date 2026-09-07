import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  CreditCard,
  ExternalLink,
  Package,
  Repeat,
} from "lucide-react";
import type { Lead } from "~/lib/api/leads";
import type {
  LeadCheckoutLineItem,
  LeadCheckoutSession,
} from "~/lib/api/lead-checkout";
import {
  extractLeadCheckout,
  formatCheckoutAddressOneLine,
  type CheckoutStatus,
  type LeadCheckout,
} from "~/lib/leads/checkout";
import { useLeadCheckoutSessions } from "~/lib/hooks/useLeadCheckoutSessions";
import { useStripeConnection } from "~/lib/hooks/useWorkspaceIntegrations";
import { stripeDashboardUrl } from "~/lib/api/stripe-catalog";
import { formatIntervalShort } from "~/components/organism/deal-products-section";
import { statusLabel } from "~/components/molecule/lead-payment-pill";
import TooltipContainer from "~/components/tooltip-container";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { formatDateTime, formatMoneyFromMinor } from "~/lib/utils/format";
import { cn } from "~/lib/utils";

/**
 * What a product-form lead paid for, to whom it was billed and where Stripe
 * keeps the money. Metadata paints the block instantly; the session endpoint
 * fills in the line items, subtotal, test/live flag and earlier attempts.
 *
 * `variant="card"` is the full page's own card; `variant="embedded"` sits in
 * the sheet's stack of quiet sections.
 */
export function LeadPaymentSection({
  lead,
  variant,
  sessionsEnabled = true,
}: {
  lead: Lead;
  variant: "card" | "embedded";
  /** false in brand / read-only sheets, which have no CRM endpoint access. */
  sessionsEnabled?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const checkout = extractLeadCheckout(lead);
  const sessions = useLeadCheckoutSessions(
    lead.id,
    !!checkout && sessionsEnabled,
  );
  const { stripe } = useStripeConnection(!!checkout && sessionsEnabled);
  if (!checkout) return null;

  const rows = sessions.data ?? [];
  const primary =
    rows.find((s) => s.stripe_session_id === checkout.sessionId) ?? rows[0];
  const account = primary?.stripe_account_id ?? stripe?.external_account_id;
  const livemode = primary?.livemode ?? stripe?.livemode ?? null;
  const amount =
    checkout.amountTotal != null && checkout.currency
      ? formatMoneyFromMinor(checkout.amountTotal, checkout.currency)
      : primary?.amount_total != null && primary.currency
        ? formatMoneyFromMinor(primary.amount_total, primary.currency)
        : null;

  const header = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <h3
          className={cn(
            variant === "card"
              ? "text-sm font-semibold text-foreground"
              : "text-xs font-semibold text-muted-foreground",
          )}
        >
          {t("leads.payment.title", { defaultValue: "Payment" })}
        </h3>
        <CheckoutStatusPill status={checkout.status} />
        {livemode === false ? (
          <span className="inline-flex shrink-0 items-center rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            {t("leads.payment.testMode", { defaultValue: "Test mode" })}
          </span>
        ) : null}
      </div>
      {amount ? (
        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
          {amount}
        </span>
      ) : null}
    </div>
  );

  const body = (
    <>
      <SummaryStrip checkout={checkout} primary={primary} />
      <ItemsBlock
        primary={primary}
        loading={sessionsEnabled && sessions.isLoading}
        error={sessions.isError}
        enabled={sessionsEnabled}
      />
      <CustomerBlock
        checkout={checkout}
        locale={i18n.language}
        wide={variant === "card"}
      />
      <StripeRow checkout={checkout} account={account} livemode={livemode} />
      {rows.length > 1 ? (
        <Attempts rows={rows} primaryId={primary?.id} />
      ) : null}
    </>
  );

  if (variant === "card") {
    return (
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-(--shadow)">
        <header className="border-b border-border px-4 py-3.5 sm:px-5">
          {header}
        </header>
        {body}
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {header}
      <div className="overflow-hidden rounded-lg border border-border/50 bg-card">
        {body}
      </div>
    </div>
  );
}

/* ── pieces ─────────────────────────────────────────────────── */

const PILL_TONE: Record<CheckoutStatus, string> = {
  paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  processing: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  failed: "bg-destructive/10 text-destructive",
  expired: "bg-muted text-muted-foreground",
};

export function CheckoutStatusPill({ status }: { status: CheckoutStatus }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        PILL_TONE[status],
      )}
    >
      {statusLabel(status, t)}
    </span>
  );
}

function SummaryStrip({
  checkout,
  primary,
}: {
  checkout: LeadCheckout;
  primary: LeadCheckoutSession | undefined;
}) {
  const { t } = useTranslation();
  const Icon = checkout.mode === "subscription" ? Repeat : CreditCard;
  const mode = checkout.mode
    ? t(`leads.payment.mode.${checkout.mode}`, { defaultValue: checkout.mode })
    : null;

  let first: string;
  let second: string | null;
  if (checkout.status === "paid" || checkout.status === "processing") {
    first =
      [mode, checkout.completedAt ? formatDateTime(checkout.completedAt) : null]
        .filter(Boolean)
        .join(" · ") || statusLabel(checkout.status, t);
    second = checkout.products.length > 0 ? checkout.products.join(", ") : null;
  } else if (checkout.status === "failed") {
    first = t("leads.payment.failedHint", {
      defaultValue: "The payment was declined.",
    });
    second = checkout.products.join(", ") || null;
  } else if (checkout.status === "expired") {
    first = t("leads.payment.expiredHint", {
      defaultValue: "The visitor left checkout without paying.",
    });
    second = checkout.products.join(", ") || null;
  } else {
    first = t("leads.payment.notCompleted", {
      defaultValue: "Checkout was opened but not completed.",
    });
    second =
      [
        checkout.products.join(", ") || null,
        primary?.expires_at
          ? t("leads.payment.expiresAt", {
              defaultValue: "Expires {{date}}",
              date: formatDateTime(primary.expires_at),
            })
          : null,
      ]
        .filter(Boolean)
        .join(" · ") || null;
  }

  return (
    <div className="flex items-start gap-2.5 border-b border-border/40 bg-muted/30 px-3 py-2.5 sm:px-4">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border bg-background text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-5 text-foreground">{first}</p>
        {second ? (
          <p className="truncate text-[11px] text-muted-foreground">{second}</p>
        ) : null}
      </div>
    </div>
  );
}

function ItemsBlock({
  primary,
  loading,
  error,
  enabled,
}: {
  primary: LeadCheckoutSession | undefined;
  loading: boolean;
  error: boolean;
  enabled: boolean;
}) {
  const { t } = useTranslation();
  if (!enabled) return null;
  if (loading) {
    return (
      <div className="space-y-2 px-4 py-3 sm:px-5">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }
  if (error) {
    return (
      <p className="px-4 py-3 text-xs text-muted-foreground sm:px-5">
        {t("leads.payment.loadError", {
          defaultValue: "Checkout details could not be loaded.",
        })}
      </p>
    );
  }
  if (!primary) return null;
  const items = primary.line_items;
  const showSubtotal =
    primary.amount_subtotal != null &&
    primary.amount_total != null &&
    primary.amount_subtotal !== primary.amount_total;
  return (
    <div className="border-b border-border/40">
      {items.length === 0 ? (
        <p className="px-4 py-3 text-xs text-muted-foreground sm:px-5">
          {t("leads.payment.noItems", {
            defaultValue: "No line items recorded",
          })}
        </p>
      ) : (
        <ul className="divide-y divide-border/40">
          {items.map((item) => (
            <LineRow key={item.price_id} item={item} />
          ))}
        </ul>
      )}
      {primary.amount_total != null && primary.currency ? (
        <div className="space-y-1 border-t border-border/40 bg-muted/30 px-4 py-2.5 text-xs sm:px-5">
          {showSubtotal ? (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>
                {t("leads.payment.subtotal", { defaultValue: "Subtotal" })}
              </span>
              <span className="tabular-nums">
                {formatMoneyFromMinor(
                  primary.amount_subtotal!,
                  primary.currency,
                )}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between font-semibold text-foreground">
            <span>{t("leads.payment.total", { defaultValue: "Total" })}</span>
            <span className="tabular-nums">
              {formatMoneyFromMinor(primary.amount_total, primary.currency)}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LineRow({ item }: { item: LeadCheckoutLineItem }) {
  const { t } = useTranslation();
  const interval =
    item.type === "recurring"
      ? formatIntervalShort(item.interval, item.interval_count, t)
      : null;
  const unit =
    item.unit_amount != null
      ? formatMoneyFromMinor(item.unit_amount, item.currency)
      : "—";
  const total =
    item.unit_amount != null
      ? formatMoneyFromMinor(item.unit_amount * item.quantity, item.currency)
      : "—";
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-background">
        <Package className="h-4 w-4 text-muted-foreground/60" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-foreground">
            {item.name}
          </p>
          {interval ? (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
              <Repeat className="h-2.5 w-2.5" />
              {interval}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[11px] tabular-nums text-muted-foreground">
          {unit}
          {" × "}
          {item.quantity}
        </p>
      </div>
      <span className="w-20 shrink-0 text-right text-sm font-medium tabular-nums text-foreground">
        {total}
      </span>
    </li>
  );
}

function CustomerBlock({
  checkout,
  locale,
  wide,
}: {
  checkout: LeadCheckout;
  locale: string;
  wide: boolean;
}) {
  const { t } = useTranslation();
  if (!checkout.billing && !checkout.shipping) return null;
  const column = (
    label: string,
    name: string | null,
    lines: (string | null)[],
  ) => (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-muted-foreground/80">
        {label}
      </p>
      {name ? (
        <p className="text-sm font-medium text-foreground">{name}</p>
      ) : null}
      {lines.filter(Boolean).map((line) => (
        <p key={line} className="break-words text-xs text-muted-foreground">
          {line}
        </p>
      ))}
    </div>
  );
  return (
    <div
      className={cn(
        "grid gap-4 border-b border-border/40 px-4 py-3 sm:px-5",
        wide && checkout.shipping ? "sm:grid-cols-2" : "",
      )}
    >
      {checkout.billing
        ? column(
            t("leads.payment.billing", { defaultValue: "Billing" }),
            checkout.billing.name,
            [
              checkout.billing.email,
              checkout.billing.phone,
              checkout.billing.address
                ? formatCheckoutAddressOneLine(checkout.billing.address, locale)
                : null,
            ],
          )
        : null}
      {checkout.shipping
        ? column(
            t("leads.payment.shipping", { defaultValue: "Shipping" }),
            checkout.shipping.name,
            [
              checkout.shipping.address
                ? formatCheckoutAddressOneLine(
                    checkout.shipping.address,
                    locale,
                  )
                : null,
            ],
          )
        : null}
    </div>
  );
}

function StripeRow({
  checkout,
  account,
  livemode,
}: {
  checkout: LeadCheckout;
  account: string | null | undefined;
  livemode: boolean | null;
}) {
  const { t } = useTranslation();
  const links: { key: string; label: string; path: string }[] = [];
  if (checkout.paymentIntentId) {
    links.push({
      key: "pi",
      label: t("leads.payment.stripe.payment", { defaultValue: "Payment" }),
      path: `payments/${checkout.paymentIntentId}`,
    });
  }
  if (checkout.subscriptionId) {
    links.push({
      key: "sub",
      label: t("leads.payment.stripe.subscription", {
        defaultValue: "Subscription",
      }),
      path: `subscriptions/${checkout.subscriptionId}`,
    });
  }
  if (checkout.customerId) {
    links.push({
      key: "cus",
      label: t("leads.payment.stripe.customer", { defaultValue: "Customer" }),
      path: `customers/${checkout.customerId}`,
    });
  }
  if (links.length === 0 && !checkout.sessionId) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[11px] text-muted-foreground sm:px-5">
      {links.map((link) => (
        <a
          key={link.key}
          href={stripeDashboardUrl(account, livemode, link.path)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
        >
          {link.label}
          <ExternalLink className="h-3 w-3" />
        </a>
      ))}
      {checkout.sessionId ? (
        <TooltipContainer tooltipContent={checkout.sessionId}>
          <span className="truncate font-mono">
            {t("leads.payment.stripe.session", { defaultValue: "Session" })}{" "}
            {checkout.sessionId.slice(0, 14)}…
          </span>
        </TooltipContainer>
      ) : null}
    </div>
  );
}

function Attempts({
  rows,
  primaryId,
}: {
  rows: LeadCheckoutSession[];
  primaryId: string | undefined;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const others = rows.filter((r) => r.id !== primaryId);
  if (others.length === 0) return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between border-t border-border/40 px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground sm:px-5">
        <span>
          {t("leads.payment.attempts", { defaultValue: "Earlier attempts" })}
        </span>
        <span className="inline-flex items-center gap-1 tabular-nums">
          {others.length}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              open && "rotate-180",
            )}
          />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="divide-y divide-border/40 border-t border-border/40">
          {others.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 px-4 py-2 text-xs sm:px-5"
            >
              <span className="text-muted-foreground">
                {formatDateTime(row.created_at)}
              </span>
              <span className="flex items-center gap-2">
                <CheckoutStatusPill status={row.outcome} />
                <span className="tabular-nums text-foreground">
                  {row.amount_total != null && row.currency
                    ? formatMoneyFromMinor(row.amount_total, row.currency)
                    : "—"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
