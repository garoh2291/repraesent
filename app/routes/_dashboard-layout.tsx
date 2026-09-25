import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "~/providers/auth-provider";
import { Sidebar } from "~/components/sidebar";
import { PilotRouteGate } from "~/components/PilotRouteGate";
import { Button } from "~/components/ui/button";
import { AlertTriangle, Menu, Search } from "lucide-react";
import { MobileMenu } from "~/components/notebook/mobile-menu";
import { getWorkspaceInvoices } from "~/lib/api/workspaces";
import { updateUserLocale } from "~/lib/api/auth";
import { normalizeLocale, type SupportedLocale } from "~/i18n/locales";
import { DoorboostMigrationBanner } from "~/components/doorboost-migration-banner";
import { SyncCompleteModal } from "~/components/sync-complete-modal";
import { TrialBanner } from "~/components/trial-banner";
import { DemoBanner } from "~/components/demo-banner";
import logoUrl from "~/components/icons/re_praesent-mark-brand-hor.svg?url";
import { activeSection, useNavSections } from "~/lib/nav/sections";
import { SectionTabs } from "~/components/notebook/section-tabs";
import { BottomTabBar } from "~/components/notebook/bottom-tab-bar";
import {
  CommandPalette,
  openCommandPalette,
} from "~/components/notebook/command-palette";
import { LeadFlowProvider } from "~/components/notebook/lead-flow";
import { DealFlowProvider } from "~/components/notebook/deal-flow";
export default function DashboardLayout() {
  const { user, currentWorkspace } = useAuthContext();
  const location = useLocation();
  const isHomeOrSyncPage =
    location.pathname === "/" || location.pathname === "/sync";
  const { i18n, t } = useTranslation();
  const queryClient = useQueryClient();

  const localeSyncMutation = useMutation({
    mutationFn: (locale: SupportedLocale) => updateUserLocale(locale),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth"] }),
  });

  // Browser/cookie language is the source of truth. Keep the DB locale in sync
  // with what the user actually sees, so their emails follow their browser.
  useEffect(() => {
    if (!user) return;
    const effective = normalizeLocale(i18n.language);
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `personal_lang=${effective}; path=/; max-age=${maxAge}; samesite=lax`;
    if (effective !== user.locale && !localeSyncMutation.isPending) {
      localeSyncMutation.mutate(effective);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.locale, i18n.language]);

  // The old first-run OnboardingTour is retired (NOTEBOOK_UX_PLAN.md D11):
  // the Get-set-up card on Today replaces it. `onboarding_completed_at` and
  // every redirect that reads it are untouched.

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Any navigation (a tile, a search result, the back button) puts the sheet away.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const showUnpaidBanner =
    currentWorkspace?.status === "active" &&
    currentWorkspace?.unpaid_invoice_due_date &&
    currentWorkspace?.unpaid_invoice_url;

  const { data: unpaidInvoices = [] } = useQuery({
    queryKey: ["workspace-invoices", currentWorkspace?.id],
    queryFn: () => getWorkspaceInvoices(currentWorkspace!.id),
    enabled: !!showUnpaidBanner && !!currentWorkspace?.id,
  });

  const freshInvoiceUrl =
    unpaidInvoices.find(
      (inv) => inv.status === "open" && inv.hosted_invoice_url
    )?.hosted_invoice_url ?? currentWorkspace?.unpaid_invoice_url;

  const sections = useNavSections();
  const section = activeSection(sections, location.pathname);

  return (
    <LeadFlowProvider>
    <DealFlowProvider>
    <div className="flex h-dvh overflow-hidden bg-background">
      <PilotRouteGate />
      {/* Desktop sidebar — the ink column */}
      <Sidebar className="hidden lg:flex" collapsible />

      {/* Everything beyond the four tabs on phones: a light sheet from the
          bottom, opened from "More" (or the menu button in brand workspaces). */}
      <MobileMenu open={mobileNavOpen} onOpenChange={setMobileNavOpen} />

      <main
        className={
          // relative: absolutely positioned children (sr-only labels, badges) must be laid out
          // inside this scroll box; otherwise they stretch the page and add a second scrollbar.
          "relative flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-background" +
          (sections ? " pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0" : "")
        }
      >
        {/* Mobile top bar */}
        <div className="flex lg:hidden items-center h-14 px-4 border-b border-border bg-card shrink-0 gap-3">
          {sections ? (
            <Link to="/" className="flex min-w-0 flex-1 items-center">
              <img src={logoUrl} alt="Repraesent" className="h-6 w-auto max-w-[120px]" />
            </Link>
          ) : (
            <>
              <button
                onClick={() => setMobileNavOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Open navigation"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="flex-1 flex justify-center">
                <img src={logoUrl} alt="Repraesent" className="h-6 w-auto max-w-[110px]" />
              </div>
            </>
          )}
          {sections ? (
            <button
              type="button"
              onClick={openCommandPalette}
              className="press flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={t("command.title", "Go to or search")}
            >
              <Search className="h-4 w-4" />
            </button>
          ) : (
            <div className="w-9" />
          )}
        </div>

        {showUnpaidBanner && (
          <div className="mx-3 mt-3 sm:mx-4 sm:mt-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-overdue/30 bg-overdue-soft px-4 py-3 text-overdue">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p className="text-sm font-medium text-foreground">
                {t("billing.unpaidBanner")}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="shrink-0 h-8 text-xs self-start sm:self-auto"
            >
              <a
                href={freshInvoiceUrl!}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("billing.payNow")}
              </a>
            </Button>
          </div>
        )}
        {/* Demo workspaces are status "trial" too — DemoBanner wins. */}
        {currentWorkspace?.is_demo ? (
          <DemoBanner expiresAt={currentWorkspace.demo_expires_at} />
        ) : (
          currentWorkspace?.status === "trial" &&
          currentWorkspace?.id && (
            <TrialBanner workspaceId={currentWorkspace.id} />
          )
        )}
        {!isHomeOrSyncPage && currentWorkspace?.type !== "doorboost_brand" && (
          <DoorboostMigrationBanner />
        )}
        {section && section.tabs.length > 1 ? <SectionTabs section={section} /> : null}
        <Outlet />
      </main>

      {sections ? (
        <>
          <BottomTabBar sections={sections} onMore={() => setMobileNavOpen(true)} moreOpen={mobileNavOpen} />
          <CommandPalette />
        </>
      ) : null}

      <SyncCompleteModal />
    </div>
    </DealFlowProvider>
    </LeadFlowProvider>
  );
}
