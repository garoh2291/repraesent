import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuthContext } from "~/providers/auth-provider";
import { getStoredWorkspaceId } from "~/lib/api/axios-instance";
import { getWorkspaceInvoices } from "~/lib/api/workspaces";
import { formatBillingInterval } from "~/lib/utils/stripe";
import { formatDateMedium, formatCurrencyFromCents } from "~/lib/utils/format";
import {
  AlertTriangle,
  ExternalLink,
  FileText,
  Receipt,
  Package2,
  Sparkles,
  Calendar,
  LineChart,
  BarChart3,
  Inbox,
  Mail,
} from "lucide-react";
import { Trans } from "react-i18next";
import { Button } from "~/components/ui/button";
import i18n from "~/i18n";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";

const FALLBACK_SUPPORT_EMAIL = "support@repraesent.com";
function getSupportEmail(): string {
  return (
    (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) ??
    FALLBACK_SUPPORT_EMAIL
  );
}

export function meta() {
  return [
    { title: i18n.t("products.metaTitle") + " - Repraesent" },
    { name: "description", content: i18n.t("products.metaDescription") },
  ];
}

function formatDate(ts: string | number | undefined | null): string {
  if (ts == null) return "—";
  const sec = typeof ts === "string" ? parseInt(ts, 10) : ts;
  if (Number.isNaN(sec)) return "—";
  return formatDateMedium(new Date(sec * 1000));
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/12 text-emerald-700 border-emerald-500/20",
    trialing: "bg-blue-500/12 text-blue-700 border-blue-500/20",
    past_due: "bg-red-500/12 text-red-700 border-red-500/20",
    canceled: "bg-stone-100 text-stone-500 border-stone-200",
    invoice_sent: "bg-amber-500/12 text-amber-700 border-amber-500/20",
    pending: "bg-amber-500/12 text-amber-700 border-amber-500/20",
    paid: "bg-emerald-500/12 text-emerald-700 border-emerald-500/20",
  };
  const cls = map[status] ?? "bg-stone-100 text-stone-500 border-stone-200";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function Products() {
  const { t } = useTranslation();
  useDocumentMeta({
    titleKey: "products.metaTitle",
    descriptionKey: "products.metaDescription",
    titleSuffix: " - Repraesent",
  });
  const { currentWorkspace, workspaces } = useAuthContext();
  const workspaceId =
    getStoredWorkspaceId() ?? currentWorkspace?.id ?? workspaces[0]?.id;
  const ws = currentWorkspace ?? workspaces[0];
  const products = ws?.products ?? [];

  const { data: invoices = [] } = useQuery({
    queryKey: ["workspace-invoices", workspaceId],
    queryFn: () => getWorkspaceInvoices(workspaceId!),
    enabled: !!workspaceId,
  });

  const hasPastDue = products.some((p) => p.status === "past_due");
  const openInvoiceUrl = invoices.find(
    (inv) => inv.status === "open" && inv.hosted_invoice_url
  )?.hosted_invoice_url;
  const isTrialWorkspace = ws?.status === "trial";
  const supportEmail = getSupportEmail();

  return (
    <div className="mx-auto w-full max-w-[1280px] p-4 sm:p-6 py-10! space-y-6 sm:space-y-8 app-fade-in">
      {/* Heading */}
      <div className="app-fade-up space-y-1">
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
          {t("products.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("products.subtitle")}
        </p>
      </div>

      {/* Trial workspace marketing card (Doorboost-restored) */}
      {isTrialWorkspace && (
        <section className="app-fade-up app-fade-up-d1 relative overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-50 via-white to-amber-50/40 dark:from-amber-500/[0.07] dark:via-transparent dark:to-amber-500/[0.04] p-6 sm:p-8">
          <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl" />

          <div className="relative space-y-5">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                <Sparkles className="h-3 w-3" />
                {t("products.trial_card.eyebrow")}
              </span>
            </div>

            <div className="space-y-2 max-w-2xl">
              <h2 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-foreground leading-tight">
                {t("products.trial_card.title")}
              </h2>
              <p className="text-[15px] text-muted-foreground leading-relaxed">
                {t("products.trial_card.body")}
              </p>
            </div>

            <ul className="grid gap-2 sm:grid-cols-2 max-w-2xl pt-1">
              {[
                {
                  Icon: Calendar,
                  label: t("products.trial_card.feature_appointments"),
                },
                {
                  Icon: LineChart,
                  label: t("products.trial_card.feature_web_analytics"),
                },
                {
                  Icon: BarChart3,
                  label: t("products.trial_card.feature_ad_analytics"),
                },
                {
                  Icon: Inbox,
                  label: t("products.trial_card.feature_new_leads"),
                },
              ].map(({ Icon, label }) => (
                <li
                  key={label}
                  className="flex items-start gap-2.5 rounded-xl bg-white/60 dark:bg-white/[0.03] border border-amber-400/15 px-3.5 py-2.5"
                >
                  <span className="grid place-items-center w-7 h-7 shrink-0 rounded-lg bg-amber-400/15 text-amber-700 dark:text-amber-300">
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-sm text-foreground/90 leading-snug pt-0.5">
                    {label}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
              <Button
                asChild
                className="bg-amber-500 text-white hover:bg-amber-500/90 shadow-sm h-10 px-5"
              >
                <a href={`mailto:${supportEmail}`}>
                  <Mail className="w-4 h-4 mr-2" />
                  {t("products.trial_card.cta")}
                </a>
              </Button>
              <p className="text-xs text-muted-foreground">
                <Trans
                  i18nKey="products.trial_card.contact"
                  values={{ supportEmail }}
                  defaults="Or write us directly at <0>{{supportEmail}}</0>"
                  components={[
                    <a
                      key="link"
                      href={`mailto:${supportEmail}`}
                      className="font-semibold text-foreground underline-offset-2 hover:underline"
                    />,
                  ]}
                />
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Past-due warning */}
      {hasPastDue && (
        <div className="app-fade-up app-fade-up-d1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-red-300/40 bg-red-50 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <p className="text-sm font-medium text-red-800">
              {t("products.pastDueWarning")}
            </p>
          </div>
          {openInvoiceUrl && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="shrink-0 h-8 text-xs border-red-300 text-red-700 hover:bg-red-50 hover:text-red-700"
            >
              <a
                href={openInvoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("products.payNow")}
              </a>
            </Button>
          )}
        </div>
      )}

      {/* Subscriptions */}
      <div className="app-fade-up app-fade-up-d2 space-y-4">
        <div className="flex items-center gap-2">
          <Package2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("products.subscriptions")}
          </h2>
        </div>

        {products.length > 0 ? (
          <div className="space-y-2">
            {products.map((p) => {
              const product = p as {
                stripe_product_name: string;
                status: string;
                current_period_end?: number | null;
                recurring_interval?: string | null;
                type?: string | null;
                unit_amount?: string | null;
                currency?: string | null;
              };
              const periodEnd = product.current_period_end;
              const showDate =
                periodEnd != null &&
                !["invoice_sent", "pending"].includes(product.status);
              const now = Math.floor(Date.now() / 1000);
              const dateLabel =
                product.status === "canceled"
                  ? periodEnd != null && periodEnd < now
                    ? t("products.dateEnded")
                    : t("products.dateEnds")
                  : product.status === "trialing"
                    ? t("products.dateTrial")
                    : product.status === "past_due"
                      ? t("products.dateDue")
                      : t("products.dateRenews");

              const hasPrice =
                product.unit_amount != null && Number(product.unit_amount) > 0;

              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 gap-4"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">
                        {product.stripe_product_name}
                      </span>
                      {hasPrice && (
                        <span className="text-sm font-medium text-foreground">
                          {formatCurrencyFromCents(Number(product.unit_amount))}
                          {product.recurring_interval && (
                            <span className="text-xs text-muted-foreground font-normal">
                              /{product.recurring_interval}
                            </span>
                          )}
                        </span>
                      )}
                      {(product.recurring_interval || product.type) && (
                        <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                          {formatBillingInterval(
                            product.recurring_interval,
                            product.type
                          )}
                        </span>
                      )}
                    </div>
                    {showDate && periodEnd != null && (
                      <p className="text-xs text-muted-foreground">
                        {dateLabel} {formatDate(periodEnd)}
                      </p>
                    )}
                  </div>
                  <StatusPill status={p.status} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {t("products.noSubscriptions")}
            </p>
          </div>
        )}
      </div>

      {/* Invoice history */}
      <div className="app-fade-up app-fade-up-d3 space-y-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("products.invoiceHistory")}
        </h2>

        {invoices.length > 0 ? (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {t("settings.invoices.status")}
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {t("settings.invoices.dueDate")}
                  </th>
                  <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {t("settings.invoices.amount")}
                  </th>
                  <th className="w-28 px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const isPaid = inv.status === "paid";

                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <StatusPill status={inv.status ?? "unknown"} />
                      </td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">
                        {isPaid && inv.paid_at
                          ? t("products.datePaid", {
                              date: formatDate(inv.paid_at),
                            })
                          : inv.due_date
                            ? t("products.dateDueLabel", {
                                date: formatDate(inv.due_date),
                              })
                            : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-foreground tabular-nums">
                        {inv.amount_due != null
                          ? formatCurrencyFromCents(Number(inv.amount_due))
                          : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 justify-end">
                          {isPaid ? (
                            <>
                              {inv.invoice_pdf && (
                                <a
                                  href={inv.invoice_pdf}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                  title={t("products.downloadInvoice")}
                                >
                                  <FileText className="h-3 w-3" />
                                  {t("products.invoice")}
                                </a>
                              )}
                              {inv.hosted_invoice_url && (
                                <a
                                  href={inv.hosted_invoice_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                  title={t("products.viewReceipt")}
                                >
                                  <Receipt className="h-3 w-3" />
                                  {t("products.receipt")}
                                </a>
                              )}
                            </>
                          ) : (
                            inv.hosted_invoice_url && (
                              <a
                                href={inv.hosted_invoice_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                              >
                                {t("products.viewInvoice")}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {t("products.noInvoicesYet")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
