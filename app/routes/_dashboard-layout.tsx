import { useEffect, useState, useCallback } from "react";
import { Outlet } from "react-router";
import { useTranslation } from "react-i18next";
import { useAuthContext } from "~/providers/auth-provider";
import { Sidebar } from "~/components/sidebar";
import { Button } from "~/components/ui/button";
import { AlertTriangle, Menu } from "lucide-react";
import { OnboardingTour } from "~/components/onboarding-tour/OnboardingTour";
import { Sheet, SheetContent } from "~/components/ui/sheet";
import logoUrl from "~/components/icons/re_praesent-mark-brand-hor.svg?url";

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
  const [showTour, setShowTour] = useState(false);

  // Sync i18n and cookie from user's DB locale (source of truth for logged-in users)
  useEffect(() => {
    if (!user?.locale) return;
    const locale = user.locale === "en" || user.locale === "de" ? user.locale : "de";
    i18n.changeLanguage(locale);
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `personal_lang=${locale}; path=/; max-age=${maxAge}; samesite=lax`;
  }, [user?.locale, i18n]);

  // Show onboarding tour for active-workspace users who haven't completed it yet
  useEffect(() => {
    if (
      user &&
      user.onboarding_completed_at == null &&
      currentWorkspace?.status === "active"
    ) {
      // Small delay so the dashboard renders first — feels more natural
      const timer = setTimeout(() => setShowTour(true), 600);
      return () => clearTimeout(timer);
    }
  }, [user?.id, user?.onboarding_completed_at, currentWorkspace?.status]);

  const handleTourDone = useCallback(() => {
    setShowTour(false);
  }, []);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const showUnpaidBanner =
    currentWorkspace?.status === "active" &&
    currentWorkspace?.unpaid_invoice_due_date &&
    currentWorkspace?.unpaid_invoice_url;

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f0f11]">
      {/* Desktop sidebar */}
      <Sidebar className="hidden lg:flex" />

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="p-0 w-[260px] bg-[#111113] border-r border-white/5 gap-0"
        >
          <Sidebar onClose={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="flex-1 min-w-0 m-2 lg:ml-0 rounded-2xl overflow-y-auto bg-background flex flex-col shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
        {/* Mobile top bar */}
        <div className="flex lg:hidden items-center h-14 px-4 border-b border-border bg-card shrink-0 gap-3">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex-1 flex justify-center">
            <img
              src={logoUrl}
              alt="Repraesent"
              className="h-6 w-auto max-w-[110px]"
            />
          </div>
          <div className="w-9" />
        </div>

        {showUnpaidBanner && (
          <div className="mx-3 mt-3 sm:mx-4 sm:mt-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/8 px-4 py-3 text-amber-800">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
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
              className="shrink-0 h-8 border-amber-400/40 text-amber-800 hover:bg-amber-50 text-xs self-start sm:self-auto"
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

      {showTour && (
        <OnboardingTour
          onDone={handleTourDone}
          locale={user?.locale ?? "de"}
          services={currentWorkspace?.services ?? []}
        />
      )}
    </div>
  );
}
