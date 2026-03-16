import { useAuthContext } from "~/providers/auth-provider";
import { getStoredWorkspaceId } from "~/lib/api/axios-instance";
import { FileText } from "lucide-react";
import { Button } from "~/components/ui/button";

export function meta() {
  return [
    { title: "Setting up - Repraesent" },
    { name: "description", content: "Your workspace is being set up" },
  ];
}

export default function Pending() {
  const { currentWorkspace, workspaces } = useAuthContext();
  const workspaceId =
    getStoredWorkspaceId() ?? currentWorkspace?.id ?? workspaces[0]?.id;
  const ws = currentWorkspace ?? workspaces[0];
  const products = (ws as { products?: Array<{ status?: string; hosted_invoice_url?: string | null }> })?.products ?? [];
  const status = ws?.status ?? "pending";
  const hasPastDue =
    status === "past_due" ||
    products.some((p) => p.status === "past_due");
  const hasInvoiceSent = products.some((p) => p.status === "invoice_sent");
  const invoiceUrl =
    products.find((p) => p.status === "invoice_sent")?.hosted_invoice_url ??
    (ws as { unpaid_invoice_url?: string })?.unpaid_invoice_url;

  if (!workspaceId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (hasPastDue) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="mx-auto max-w-md space-y-6 text-center">
          <div className="flex justify-center">
            <div className="rounded-full bg-amber-500/20 p-4">
              <FileText className="h-12 w-12 text-amber-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Payment overdue</h1>
          <p className="text-muted-foreground">
            Please check your inbox for an invoice from Stripe.
          </p>
          {invoiceUrl && (
            <Button asChild>
              <a href={invoiceUrl} target="_blank" rel="noopener noreferrer">
                View Invoice
              </a>
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (hasInvoiceSent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="mx-auto max-w-md space-y-6 text-center">
          <div className="flex justify-center">
            <div className="rounded-full bg-blue-500/20 p-4">
              <FileText className="h-12 w-12 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Invoice sent — awaiting your payment</h1>
          <p className="text-muted-foreground">
            We have sent you an invoice by email. Please pay it to activate your
            account.
          </p>
          {invoiceUrl && (
            <Button asChild>
              <a href={invoiceUrl} target="_blank" rel="noopener noreferrer">
                Pay invoice now
              </a>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="mx-auto max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-primary/20 p-4">
            <FileText className="h-12 w-12 text-primary" />
          </div>
        </div>
        <h1 className="text-2xl font-bold">Setting up your workspace</h1>
        <p className="text-muted-foreground">
          Our team is configuring your subscription. You&apos;ll receive an email
          when your workspace is ready.
        </p>
      </div>
    </div>
  );
}
