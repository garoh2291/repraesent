import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuthContext } from "~/providers/auth-provider";
import { getStoredWorkspaceId } from "~/lib/api/axios-instance";
import { getWorkspaceInvoices } from "~/lib/api/workspaces";
import { formatBillingInterval } from "~/lib/utils/stripe";
import { AlertTriangle, ExternalLink, Package2 } from "lucide-react";
import { Button } from "~/components/ui/button";

export function meta() {
  return [
    { title: "Products - Repraesent" },
    { name: "description", content: "Your subscriptions and invoices" },
  ];
}

function formatDate(ts: string | number | undefined | null): string {
  if (ts == null) return "—";
  const sec = typeof ts === "string" ? parseInt(ts, 10) : ts;
  if (Number.isNaN(sec)) return "—";
  return new Date(sec * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

      {/* Past-due warning */}
      {hasPastDue && (
        <div className="app-fade-up app-fade-up-d1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-red-300/40 bg-red-50 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <p className="text-sm font-medium text-red-800">
              {t("products.pastDueWarning")}
            </p>
          </div>
          {(ws as { unpaid_invoice_url?: string })?.unpaid_invoice_url && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="shrink-0 h-8 text-xs border-red-300 text-red-700 hover:bg-red-50"
            >
              <a
                href={
                  (ws as { unpaid_invoice_url?: string }).unpaid_invoice_url!
                }
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
                  <th className="w-20 px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => (
                  <tr
                    key={inv.id}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <StatusPill status={inv.status ?? "unknown"} />
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">
                      {inv.status === "paid" && inv.paid_at
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
                        ? `€${(Number(inv.amount_due) / 100).toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      {inv.hosted_invoice_url && (
                        <a
                          href={inv.hosted_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          {t("products.viewInvoice")}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
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
