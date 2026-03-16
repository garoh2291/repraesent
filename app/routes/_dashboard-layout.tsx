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
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />

      <main className="flex-1 min-w-0 m-4 overflow-y-auto bg-background flex flex-col">
        {showUnpaidBanner && (
          <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-amber-800 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">
                You have an unpaid invoice. Please pay by{" "}
                {formatDueDate(currentWorkspace.unpaid_invoice_due_date!)} or
                your workspace will be suspended.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a
                href={currentWorkspace.unpaid_invoice_url!}
                target="_blank"
                rel="noopener noreferrer"
              >
                View invoice
              </a>
            </Button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
