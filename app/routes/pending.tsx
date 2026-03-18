import { useAuthContext } from "~/providers/auth-provider";
import { getStoredWorkspaceId } from "~/lib/api/axios-instance";
import { FileText, Clock } from "lucide-react";
import { Button } from "~/components/ui/button";
import { StatusPageHeader } from "~/components/status-page-header";

export function meta() {
  return [
    { title: "Setting up - Repraesent" },
    { name: "description", content: "Your workspace is being set up" },
  ];
}

const STATUS_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;600&display=swap');

  @keyframes sp-fade-up {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes sp-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes sp-breathe {
    0%, 100% { opacity: 1;   transform: scale(1);    box-shadow: 0 0 0 0 transparent; }
    50%       { opacity: 0.7; transform: scale(0.97); box-shadow: 0 0 0 12px transparent; }
  }
  @keyframes sp-ring-pulse {
    0%   { transform: scale(1);    opacity: 0.6; }
    100% { transform: scale(1.7);  opacity: 0;   }
  }
  @keyframes sp-spin-slow {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  .sp-fade-up    { animation: sp-fade-up 0.55s cubic-bezier(0.16, 1, 0.3, 1) both; }
  .sp-fade-up-d1 { animation-delay: 0.08s; }
  .sp-fade-up-d2 { animation-delay: 0.16s; }
  .sp-fade-up-d3 { animation-delay: 0.24s; }
  .sp-fade-in    { animation: sp-fade-in 0.5s ease both; }
  .sp-breathe    { animation: sp-breathe 2.8s ease-in-out infinite; }
  .sp-spin-slow  { animation: sp-spin-slow 1.8s linear infinite; }
  .sp-heading    { font-family: 'Lora', Georgia, serif; }

  .sp-ring-pulse::before {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: 9999px;
    border: 2px solid currentColor;
    opacity: 0;
    animation: sp-ring-pulse 2s ease-out infinite;
  }
  .sp-ring-pulse::after {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: 9999px;
    border: 2px solid currentColor;
    opacity: 0;
    animation: sp-ring-pulse 2s ease-out 1s infinite;
  }
`;

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
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  if (hasPastDue) {
    return (
      <div className="flex min-h-screen flex-col bg-stone-50 dark:bg-zinc-950">
        <style>{STATUS_STYLES}</style>
        <StatusPageHeader />
        <div className="flex flex-1 flex-col items-center justify-center p-8">
          <div className="mx-auto max-w-sm space-y-7 text-center sp-fade-up">
            {/* Icon */}
            <div className="flex justify-center sp-fade-up">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800">
                <FileText className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
            </div>

            {/* Copy */}
            <div className="space-y-3 sp-fade-up sp-fade-up-d1">
              <h1 className="sp-heading text-[26px] font-semibold text-foreground leading-snug">
                Payment overdue
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Please check your inbox for an invoice from Stripe, or use the
                link below to pay directly.
              </p>
            </div>

            {invoiceUrl && (
              <div className="sp-fade-up sp-fade-up-d2">
                <Button
                  asChild
                  className="h-11 px-8 font-medium text-sm transition-all duration-150 hover:opacity-90"
                >
                  <a href={invoiceUrl} target="_blank" rel="noopener noreferrer">
                    View invoice →
                  </a>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (hasInvoiceSent) {
    return (
      <div className="flex min-h-screen flex-col bg-stone-50 dark:bg-zinc-950">
        <style>{STATUS_STYLES}</style>
        <StatusPageHeader />
        <div className="flex flex-1 flex-col items-center justify-center p-8">
          <div className="mx-auto max-w-sm space-y-7 text-center">
            {/* Icon */}
            <div className="flex justify-center sp-fade-up">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-200 dark:border-blue-800">
                <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </div>

            {/* Copy */}
            <div className="space-y-3 sp-fade-up sp-fade-up-d1">
              <h1 className="sp-heading text-[26px] font-semibold text-foreground leading-snug">
                Invoice sent — awaiting your payment
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We sent you an invoice by email. Pay it to activate your
                workspace and get started.
              </p>
            </div>

            {invoiceUrl && (
              <div className="sp-fade-up sp-fade-up-d2">
                <Button
                  asChild
                  className="h-11 px-8 font-medium text-sm transition-all duration-150 hover:opacity-90"
                >
                  <a href={invoiceUrl} target="_blank" rel="noopener noreferrer">
                    Pay invoice now →
                  </a>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-stone-50 dark:bg-zinc-950">
      <style>{STATUS_STYLES}</style>
      <StatusPageHeader />
      <div className="flex flex-1 flex-col items-center justify-center p-8">
        <div className="mx-auto max-w-sm space-y-7 text-center">
          {/* Animated pending indicator */}
          <div className="flex justify-center sp-fade-up">
            <div className="relative flex h-20 w-20 items-center justify-center sp-breathe text-foreground/20">
              {/* Pulsing ring */}
              <div className="absolute inset-0 rounded-full border-2 border-foreground/10" />
              {/* Inner circle */}
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 shadow-sm">
                <Clock className="h-6 w-6 text-foreground/60" />
              </div>
            </div>
          </div>

          {/* Copy */}
          <div className="space-y-3 sp-fade-up sp-fade-up-d1">
            <h1 className="sp-heading text-[26px] font-semibold text-foreground leading-snug">
              Setting up your workspace
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Our team is configuring your subscription. You'll receive an email
              once your workspace is ready.
            </p>
          </div>

          {/* Status indicator */}
          <div className="sp-fade-up sp-fade-up-d2 inline-flex items-center gap-2 rounded-full border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2 text-xs font-medium text-muted-foreground shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground/40 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-foreground/60" />
            </span>
            In progress
          </div>
        </div>
      </div>
    </div>
  );
}
