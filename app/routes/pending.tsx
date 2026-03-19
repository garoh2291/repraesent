import { useAuthContext } from "~/providers/auth-provider";
import { getStoredWorkspaceId } from "~/lib/api/axios-instance";
import {
  FileText,
  Clock,
  Users,
  Building2,
  Sparkles,
  Mail,
} from "lucide-react";
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
    0%, 100% { opacity: 1;   transform: scale(1); }
    50%       { opacity: 0.7; transform: scale(0.97); }
  }
  @keyframes sp-ring-pulse {
    0%   { transform: scale(1);    opacity: 0.6; }
    100% { transform: scale(1.7);  opacity: 0;   }
  }
  @keyframes sp-float {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-6px); }
  }
  @keyframes sp-float-dot {
    0%, 100% { transform: translateY(0px) scale(1); opacity: 0.7; }
    50%       { transform: translateY(-4px) scale(1.1); opacity: 1; }
  }
  @keyframes sp-connector-pulse {
    0%, 100% { opacity: 0.2; }
    50%       { opacity: 0.5; }
  }

  .sp-fade-up    { animation: sp-fade-up 0.55s cubic-bezier(0.16, 1, 0.3, 1) both; }
  .sp-fade-up-d1 { animation-delay: 0.08s; }
  .sp-fade-up-d2 { animation-delay: 0.16s; }
  .sp-fade-up-d3 { animation-delay: 0.24s; }
  .sp-fade-up-d4 { animation-delay: 0.32s; }
  .sp-fade-up-d5 { animation-delay: 0.40s; }
  .sp-fade-in    { animation: sp-fade-in 0.5s ease both; }
  .sp-breathe    { animation: sp-breathe 2.8s ease-in-out infinite; }
  .sp-heading    { font-family: 'Lora', Georgia, serif; }

  .sp-icon-float-1 { animation: sp-float 3.2s ease-in-out infinite; }
  .sp-icon-float-2 { animation: sp-float 3.2s ease-in-out 0.8s infinite; }
  .sp-icon-float-3 { animation: sp-float 3.2s ease-in-out 1.6s infinite; }

  .sp-connector   { animation: sp-connector-pulse 2s ease-in-out infinite; }
  .sp-connector-2 { animation: sp-connector-pulse 2s ease-in-out 0.7s infinite; }

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
  const products =
    (
      ws as {
        products?: Array<{
          status?: string;
          hosted_invoice_url?: string | null;
        }>;
      }
    )?.products ?? [];
  const status = ws?.status ?? "pending";
  const hasPastDue =
    status === "past_due" || products.some((p) => p.status === "past_due");
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
                  <a
                    href={invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View invoice →
                  </a>
                </Button>
              </div>
            )}

            <div className="sp-fade-up sp-fade-up-d3 pt-2 border-t border-stone-200 dark:border-zinc-800">
              <p className="text-xs text-muted-foreground">Need help?</p>
              <a
                href="mailto:support@repraesent.com"
                className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:opacity-70 transition-opacity"
              >
                <Mail className="h-3.5 w-3.5" />
                support@repraesent.com
              </a>
            </div>
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
                  <a
                    href={invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Pay invoice now →
                  </a>
                </Button>
              </div>
            )}

            <div className="sp-fade-up sp-fade-up-d3 pt-2 border-t border-stone-200 dark:border-zinc-800">
              <p className="text-xs text-muted-foreground">Need help?</p>
              <a
                href="mailto:support@repraesent.com"
                className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:opacity-70 transition-opacity"
              >
                <Mail className="h-3.5 w-3.5" />
                support@repraesent.com
              </a>
            </div>
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
        <div className="mx-auto max-w-sm space-y-8 text-center">
          {/* ── Animated illustration ── */}
          <div className="sp-fade-up flex flex-col items-center gap-4">
            {/* Three floating icon chips */}
            <div className="flex items-end justify-center gap-3">
              {/* Chip 1 — Team */}
              <div className="sp-icon-float-1 flex flex-col items-center gap-1.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 shadow-sm">
                  <Users className="h-5 w-5 text-foreground/50" />
                </div>
                <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  Team
                </span>
              </div>

              {/* Connector dots */}
              <div className="sp-connector mb-5 flex gap-0.5 pb-1">
                <span className="h-1 w-1 rounded-full bg-stone-300 dark:bg-zinc-600" />
                <span className="h-1 w-1 rounded-full bg-stone-300 dark:bg-zinc-600" />
                <span className="h-1 w-1 rounded-full bg-stone-300 dark:bg-zinc-600" />
              </div>

              {/* Chip 2 — Workspace (center, tallest) */}
              <div className="sp-icon-float-2 flex flex-col items-center gap-1.5">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[#111113] shadow-lg sp-ring-pulse text-[#111113]">
                  <Building2 className="h-7 w-7 text-white/80" />
                  {/* amber dot */}
                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-400 border-2 border-stone-50 dark:border-zinc-950 sp-breathe" />
                </div>
                <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  Workspace
                </span>
              </div>

              {/* Connector dots */}
              <div className="sp-connector-2 mb-5 flex gap-0.5 pb-1">
                <span className="h-1 w-1 rounded-full bg-stone-300 dark:bg-zinc-600" />
                <span className="h-1 w-1 rounded-full bg-stone-300 dark:bg-zinc-600" />
                <span className="h-1 w-1 rounded-full bg-stone-300 dark:bg-zinc-600" />
              </div>

              {/* Chip 3 — Features */}
              <div className="sp-icon-float-3 flex flex-col items-center gap-1.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 shadow-sm">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                </div>
                <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  Features
                </span>
              </div>
            </div>
          </div>

          {/* Copy */}
          <div className="space-y-3 sp-fade-up sp-fade-up-d2">
            <h1 className="sp-heading text-[26px] font-semibold text-foreground leading-snug">
              Setting up your workspace
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Our team is configuring your subscription. You'll receive an email
              once your workspace is ready.
            </p>
          </div>

          {/* Status pill */}
          <div className="sp-fade-up sp-fade-up-d3 inline-flex items-center gap-2 rounded-full border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2 text-xs font-medium text-muted-foreground shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground/40 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-foreground/60" />
            </span>
            In progress
          </div>

          {/* Support contact */}
          <div className="sp-fade-up sp-fade-up-d4 pt-2 border-t border-stone-200 dark:border-zinc-800">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Questions? Reach out to our support team
            </p>
            <a
              href="mailto:support@repraesent.com"
              className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:opacity-70 transition-opacity"
            >
              <Mail className="h-3.5 w-3.5" />
              support@repraesent.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
