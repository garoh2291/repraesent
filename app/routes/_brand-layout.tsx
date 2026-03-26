import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { useAuthContext } from "~/providers/auth-provider";
import { BarChart3, Store, LineChart, LogOut, Menu, X } from "lucide-react";
import { Sheet, SheetContent } from "~/components/ui/sheet";
import { LanguageSwitcher } from "~/components/language-switcher";
import { cn } from "~/lib/utils";

const NAV_ITEMS = [
  { key: "navHome", path: "/brand", icon: BarChart3, exact: true },
  { key: "navWorkspaces", path: "/brand/workspaces", icon: Store, exact: false },
  { key: "navAnalytics", path: "/brand/analytics", icon: LineChart, exact: false },
] as const;

function BrandSidebar({ onClose }: { onClose?: () => void }) {
  const { user, brand, logout, isLoggingOut } = useAuthContext();
  const { t } = useTranslation();
  const location = useLocation();

  const BACKEND_IMG_URL =
    import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:8000";

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col bg-[#111113] border-r border-white/5">
      {/* Brand identity */}
      <div className="flex h-14 shrink-0 items-center px-4 border-b border-white/5 gap-2.5">
        {brand?.logo ? (
          <img
            src={`${BACKEND_IMG_URL}${brand.logo}`}
            alt={brand.name}
            className="h-7 w-7 rounded-lg object-contain shrink-0"
          />
        ) : (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white text-[11px] font-bold">
            {brand?.name?.charAt(0)?.toUpperCase() ?? "B"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white/90 truncate leading-tight">
            {brand?.name ?? "Brand"}
          </p>
          <p className="text-[11px] text-white/35 truncate leading-tight">
            {user?.email}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md text-white/35 hover:text-white/70 hover:bg-white/5 transition-colors"
            aria-label="Close navigation"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5">
        {NAV_ITEMS.map(({ key, path, icon: Icon, exact }) => {
          const isActive = exact
            ? location.pathname === path
            : location.pathname.startsWith(path);
          return (
            <Link
              key={key}
              to={path}
              onClick={onClose}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium border-l-2 transition-all duration-150",
                isActive
                  ? "border-amber-400 bg-amber-400/10 text-amber-300"
                  : "border-transparent text-white/45 hover:bg-white/5 hover:text-white/75"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t(`brand.${key}`, key)}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: language + logout */}
      <div className="shrink-0 border-t border-white/5 p-3 space-y-1">
        <div className="px-1 py-1">
          <LanguageSwitcher variant="dark" persistToDb />
        </div>
        <button
          onClick={() => logout()}
          disabled={isLoggingOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-white/35 hover:bg-white/5 hover:text-white/60 transition-all duration-150 disabled:opacity-50"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {isLoggingOut ? t("common.loading") : t("common.logout", "Sign out")}
        </button>
      </div>
    </aside>
  );
}

export default function BrandLayout() {
  const { user } = useAuthContext();
  const { i18n, t } = useTranslation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  const activeNav = NAV_ITEMS.find(({ path, exact }) =>
    exact ? location.pathname === path : location.pathname.startsWith(path)
  ) ?? NAV_ITEMS[0];

  useEffect(() => {
    if (!user?.locale) return;
    const locale =
      user.locale === "en" || user.locale === "de" ? user.locale : "de";
    i18n.changeLanguage(locale);
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `personal_lang=${locale}; path=/; max-age=${maxAge}; samesite=lax`;
  }, [user?.locale, i18n]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f0f11]">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <BrandSidebar />
      </div>

      {/* Mobile sidebar sheet */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="p-0 w-[220px] bg-[#111113] border-r border-white/5 gap-0"
        >
          <BrandSidebar onClose={() => setMobileNavOpen(false)} />
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
            <span className="text-sm font-semibold text-foreground">
              {t(`brand.${activeNav.key}`, activeNav.key)}
            </span>
          </div>
          <div className="w-9" />
        </div>

        <Outlet />
      </main>
    </div>
  );
}
