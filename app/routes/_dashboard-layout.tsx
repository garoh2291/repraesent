import { Outlet } from "react-router";
import { useAuthContext } from "~/providers/auth-provider";
import { Sidebar } from "~/components/sidebar";
import { Button } from "~/components/ui/button";
import { AlertTriangle } from "lucide-react";

function formatDueDate(unixStr: string): string {
  const sec = parseInt(unixStr, 10);
  if (Number.isNaN(sec)) return unixStr;
  return new Date(sec * 1000).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function DashboardLayout() {
  const { currentWorkspace } = useAuthContext();
  const showUnpaidBanner =
    currentWorkspace?.status === "active" &&
    currentWorkspace?.unpaid_invoice_due_date &&
    currentWorkspace?.unpaid_invoice_url;

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f0f11]">
      <Sidebar />

      <main className="flex-1 min-w-0 m-2 ml-0 rounded-2xl overflow-y-auto bg-background flex flex-col shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
        {showUnpaidBanner && (
          <div className="mx-4 mt-4 flex items-center justify-between gap-4 rounded-xl border border-amber-400/30 bg-amber-400/8 px-4 py-3 text-amber-800">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-sm font-medium text-amber-900">
                Unpaid invoice — pay by{" "}
                <span className="font-semibold">
                  {formatDueDate(currentWorkspace!.unpaid_invoice_due_date!)}
                </span>{" "}
                or your workspace will be suspended.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="shrink-0 h-8 border-amber-400/40 text-amber-800 hover:bg-amber-50 text-xs"
            >
              <a
                href={currentWorkspace!.unpaid_invoice_url!}
                target="_blank"
                rel="noopener noreferrer"
              >
                Pay now →
              </a>
            </Button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
