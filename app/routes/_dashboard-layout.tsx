import { useEffect } from "react";
import { Outlet } from "react-router";
import { useTranslation } from "react-i18next";
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
  const { user, currentWorkspace } = useAuthContext();
  const { i18n, t } = useTranslation();

  // Sync i18n from user's locale
  useEffect(() => {
    const locale = user?.locale ?? "de";
    const hasPersonal = document.cookie.split(";").some((c) =>
      c.trim().startsWith("personal_lang="),
    );
    if (!hasPersonal) {
      i18n.changeLanguage(locale);
    }
  }, [user?.locale, i18n]);

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
                {t("billing.unpaidBanner", {
                  date: formatDueDate(
                    currentWorkspace!.unpaid_invoice_due_date!,
                  ),
                })}
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
                {t("billing.payNow")}
              </a>
            </Button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
