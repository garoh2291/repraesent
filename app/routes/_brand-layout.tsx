import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useAuthContext } from "~/providers/auth-provider";
import {
  BarChart3,
  Building2,
  ChevronDown,
  Store,
  LineChart,
  ShoppingBag,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Sheet, SheetContent } from "~/components/ui/sheet";
import { LanguageSwitcher } from "~/components/language-switcher";
import { setStoredWorkspaceId } from "~/lib/api/axios-instance";
import { cn } from "~/lib/utils";
import logoUrl from "~/components/icons/re_praesent-mark-brand-hor.svg?url";

const NAV_ITEMS = [
  { key: "navHome", path: "/brand", icon: BarChart3, exact: true },
  {
    key: "navWorkspaces",
    path: "/brand/workspaces",
    icon: Store,
    exact: false,
  },
  {
    key: "navAnalytics",
    path: "/brand/analytics",
    icon: LineChart,
    exact: false,
  },
  { key: "navOrders", path: "/brand/orders", icon: ShoppingBag, exact: false },
] as const;

function BrandSidebar({ onClose }: { onClose?: () => void }) {
  const {
    brand,
    workspaces,
    setCurrentWorkspace,
    logout,
    isLoggingOut,
  } = useAuthContext();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const hasWorkspaces = (workspaces?.length ?? 0) > 0;
  // Reset when brand.logo changes (e.g. after upload), retry loading.
  const [logoBroken, setLogoBroken] = useState(false);
  useEffect(() => {
    setLogoBroken(false);
  }, [brand?.logo]);

  const BACKEND_IMG_URL =
    import.meta.env.VITE_API_URL?.replace(/\/api$/, "") ||
    "http://localhost:8001";

  const goToWorkspace = (workspaceId: string) => {
    onClose?.();
    setStoredWorkspaceId(workspaceId);
    setCurrentWorkspace(workspaceId);
    navigate("/", { replace: true });
  };

  const showLogoImg = !!brand?.logo && !logoBroken;
  const brandAvatar = showLogoImg ? (
    <img
      src={`${BACKEND_IMG_URL}${brand!.logo}`}
      alt={brand!.name}
      onError={() => setLogoBroken(true)}
      className="h-6 w-6 rounded-md object-contain shrink-0 bg-white/5"
    />
  ) : (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold">
      {brand?.name?.charAt(0)?.toUpperCase() ?? "B"}
    </div>
  );

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col bg-[#111113] border-r border-white/5">
      {/* Logo — matches workspace sidebar so the layout doesn't shift on view switch */}
      <div className="flex h-14 shrink-0 items-center px-4 border-b border-white/5 gap-2">
        <Link to="/brand" className="flex items-center flex-1 min-w-0" onClick={onClose}>
          <img
            src={logoUrl}
            alt="Repraesent"
            className="h-7 w-auto max-w-[120px] brightness-0 invert opacity-90"
          />
        </Link>
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

      {/* Brand selector (mirrors workspace selector — same height, same compact layout, no email) */}
      <div className="shrink-0 px-3 py-3 border-b border-white/5">
        {hasWorkspaces ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-white/55 hover:bg-white/5 hover:text-white/80 transition-colors duration-150">
                {brandAvatar}
                <span className="flex-1 truncate font-medium text-white/70">
                  {brand?.name ?? "Brand"}
                </span>
                <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300">
                  {t("nav.brand_label", "Brand")}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/30" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-48">
              <DropdownMenuItem disabled className="opacity-100">
                <Building2 className="h-4 w-4" />
                <span className="flex-1 truncate">{brand?.name}</span>
                <span className="ml-2 rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                  {t("nav.brand_label", "Brand")}
                </span>
              </DropdownMenuItem>
              {workspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => goToWorkspace(ws.id)}
                >
                  <Building2 className="h-4 w-4" />
                  <span className="flex-1 truncate">{ws.name}</span>
                  {ws.type === "doorboost_brand" && (
                    <span className="ml-2 rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      {t("nav.brand_label", "Brand")}
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-2 px-2.5 py-2">
            {brandAvatar}
            <span className="flex-1 truncate text-[13px] font-medium text-white/70">
              {brand?.name ?? "Brand"}
            </span>
            <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300">
              {t("nav.brand_label", "Brand")}
            </span>
          </div>
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

  const activeNav =
    NAV_ITEMS.find(({ path, exact }) =>
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
