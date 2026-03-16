import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "~/providers/auth-provider";
import { getStoredWorkspaceId } from "~/lib/api/axios-instance";
import { getWorkspaceInvoices } from "~/lib/api/workspaces";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Package, FileText, AlertTriangle } from "lucide-react";
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

export default function Products() {
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Products</h1>
        <p className="text-muted-foreground">
          Your subscriptions and invoice history
        </p>
      </div>

      {hasPastDue && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">
              Some subscriptions are past due. Please pay to avoid suspension.
            </p>
          </div>
          {(ws as { unpaid_invoice_url?: string })?.unpaid_invoice_url && (
            <Button variant="outline" size="sm" asChild>
              <a
                href={(ws as { unpaid_invoice_url?: string }).unpaid_invoice_url!}
                target="_blank"
                rel="noopener noreferrer"
              >
                View invoice
              </a>
            </Button>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Subscriptions
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Products attached to your workspace
          </p>
        </CardHeader>
        <CardContent>
          {products.length > 0 ? (
            <div className="space-y-3">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <span className="font-medium">{p.stripe_product_name}</span>
                  <Badge
                    variant={
                      p.status === "active"
                        ? "default"
                        : p.status === "past_due"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {p.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground py-4">
              No products yet. Add products during onboarding.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice history
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Past invoices from Stripe
          </p>
        </CardHeader>
        <CardContent>
          {invoices.length > 0 ? (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Due date</th>
                    <th className="text-right p-3 font-medium">Amount</th>
                    <th className="w-24 p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0">
                      <td className="p-3">
                        <Badge variant="secondary">{inv.status ?? "—"}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {formatDate(inv.due_date)}
                      </td>
                      <td className="p-3 text-right">
                        {inv.amount_due != null
                          ? `€${(Number(inv.amount_due) / 100).toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="p-3">
                        {inv.hosted_invoice_url && (
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={inv.hosted_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View
                            </a>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground py-4">
              No invoices yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
