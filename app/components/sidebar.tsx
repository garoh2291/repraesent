import { Link } from "react-router";
import { usePendingPathname } from "~/lib/nav/use-pending-nav";
import {
  Children,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { cn } from "~/lib/utils";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  Globe,
  HomeIcon,
  Loader2,
  LogOut,
  Megaphone,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Store,
  Users,
  X,
  Search,
  Headset,
} from "lucide-react";
import { SafeImg } from "~/components/atom/safe-img";

import { useAuthContext } from "~/providers/auth-provider";
import { PILOT_FEATURE_LABEL_KEY } from "~/lib/feature-flags";
import { useWorkspaceWpPluginInstalls } from "~/lib/hooks/useWorkspaceWpPluginInstalls";
import { LanguageSwitcher } from "~/components/language-switcher";
import { ContactSalesDialog } from "~/components/sales-contact/contact-sales-dialog";
import {
  pluginKindIcon,
  wordpressPluginSettingsPath,
} from "~/lib/utils/wordpress-plugin-kind";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

import logoUrl from "~/components/icons/re_praesent-mark-brand-hor.svg?url";
import { activeSection, useNavSections } from "~/lib/nav/sections";
import { PILOT_SETTINGS, useNavModel } from "~/lib/nav/use-nav-model";
import { useToday } from "~/lib/hooks/useToday";
import { MarkerCount } from "~/components/notebook/stat";
import { openCommandPalette } from "~/components/notebook/command-palette";
import { isMacPlatform } from "~/lib/utils/platform";

/**
 * True while the desktop sidebar is collapsed to its icon rail. NavLink and
 * PipelineNav read it so every call site keeps its normal children — in
 * collapsed mode only the leading icon is rendered, which also hides badges
 * and bare text nodes without touching thirty call sites.
 */
const SidebarCollapsedContext = createContext(false);

const COLLAPSE_STORAGE_KEY = "sidebar_collapsed";

function NavLink({
  to,
  isActive,
  children,
  disabled,
  onClick,
  className,
}: {
  to: string;
  isActive: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}) {
  const collapsed = useContext(SidebarCollapsedContext);
  return (
    <Link
      to={to}
      prefetch="intent"
      onClick={onClick}
      aria-disabled={disabled}
      className={[
        "flex items-center rounded-lg py-2 text-[13px] font-medium",
        collapsed ? "justify-center px-0" : "gap-2.5 px-3",
        "border-l-2 transition-all duration-150",
        disabled
          ? "cursor-not-allowed border-transparent text-white/25"
          : isActive
            ? "border-marker bg-white/[0.07] text-white"
            : "border-transparent text-white/55 hover:bg-white/5 hover:text-white/85",
        className ?? "",
      ].join(" ")}
    >
      {collapsed ? Children.toArray(children)[0] : children}
    </Link>
  );
}

/**
 * "Demo" label on entries behind a pilot flag. Same build as the amber NEW
 * pill, but neutral — it reads as a status, not a promotion. Never the first
 * child of a NavLink, so the collapsed rail drops it with the label.
 */
function DemoPill() {
  const { t } = useTranslation();
  return (
    <span className="ml-auto rounded-full bg-foreground/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
      {t(PILOT_FEATURE_LABEL_KEY, { defaultValue: "Demo" })}
    </span>
  );
}

/**
 * The website sub-navigation, rendered in place of the main nav list while the
 * user is somewhere under /website — same drill-in shape as Settings, so the
 * "Website" entry replaces the list rather than nesting one inside it.
 *
 * Route-driven like Settings: deep links and refreshes land in the right mode
 * for free, and there is nothing to reset on the way out.
 */
function WebsiteSubNav({ onClose }: { onClose?: () => void }) {
  const { t } = useTranslation();
  // The page being opened counts as current, so the tap shows at once.
  const navPath = usePendingPathname().pathname;
  const installsQuery = useWorkspaceWpPluginInstalls(true);
  const plugins = [...(installsQuery.data?.plugins ?? [])].sort((a, b) =>
    a.display_name.localeCompare(b.display_name, undefined, {
      sensitivity: "base",
    })
  );
  const waitingForPlugins = installsQuery.isPending && !installsQuery.data;

  return (
    <>
      {/* Separated from the list below so it reads as a way out rather than a
        destination of its own. */}
      <div className="mb-2 border-b border-white/5 pb-2">
        <NavLink to="/" isActive={false} onClick={onClose}>
          <ArrowLeft className="h-4 w-4 shrink-0" />
          {t("common.back")}
        </NavLink>
      </div>

      <NavLink
        to="/website"
        isActive={navPath === "/website"}
        onClick={onClose}
      >
        <Globe className="h-4 w-4 shrink-0" />
        <span className="truncate">{t("nav.websiteOverview", "Overview")}</span>
      </NavLink>

      {waitingForPlugins ? (
        <div
          className="flex items-center gap-2.5 rounded-lg border-l-2 border-transparent px-3 py-2 text-[13px] font-medium text-white/35"
          aria-busy="true"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-white/25" />
          <span className="truncate">
            {t("nav.loadingPlugins", "Loading services…")}
          </span>
        </div>
      ) : (
        plugins.map((p) => {
          const path = wordpressPluginSettingsPath(p.plugin_uuid);
          const Icon = pluginKindIcon(p.name);
          return (
            <NavLink
              key={p.plugin_uuid}
              to={path}
              isActive={navPath === path}
              onClick={onClose}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{p.display_name}</span>
            </NavLink>
          );
        })
      )}
    </>
  );
}

/** Opens ⌘K. The hint is added after hydration (platform-specific). */
function SearchRow() {
  const { t } = useTranslation();
  const collapsed = useContext(SidebarCollapsedContext);
  const [hint, setHint] = useState("");
  useEffect(() => {
    // Keyboard shortcuts mean nothing on a phone.
    const touch = window.matchMedia?.("(pointer: coarse)").matches;
    setHint(touch ? "" : isMacPlatform() ? "⌘K" : "Ctrl K");
  }, []);
  return (
    <button
      type="button"
      data-search-hint=""
      onClick={openCommandPalette}
      title={collapsed ? t("command.title", "Go to or search") : undefined}
      className={cn(
        "mb-2 flex w-full items-center rounded-lg border border-white/[0.07] bg-white/[0.03] py-2 text-[13px] text-white/45 transition-colors hover:border-white/15 hover:text-white/75",
        collapsed ? "justify-center px-0" : "gap-2.5 px-3"
      )}
    >
      <Search className="h-4 w-4 shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 truncate text-left">
            {t("command.short", "Search")}
          </span>
          <span className="num text-[11px] text-white/30">{hint}</span>
        </>
      )}
    </button>
  );
}

/**
 * The main list: five jobs, not thirty modules (NOTEBOOK_UX_PLAN.md §2).
 * Each section's own pages are one tap away in the tab strip at the top of
 * the content, so the sidebar never has to nest.
 */
function MainSections({ onClose }: { onClose?: () => void }) {
  // The page being opened counts as current, so the tap shows at once.
  const navPath = usePendingPathname().pathname;
  const sections = useNavSections();
  const active = activeSection(sections, navPath);
  const today = useToday("me", !!sections);
  const counts = today.data && today.data.supported ? today.data.counts : null;
  const needsYou = counts
    ? // People waiting — the same number the Today greeting shows.
      counts.new_leads + counts.follow_ups_due + (counts.signups ?? 0)
    : 0;
  if (!sections) return null;
  return (
    <>
      <SearchRow />
      {sections.map((section) => {
        const Icon = section.icon;
        return (
          <NavLink
            key={section.key}
            to={section.to}
            isActive={active?.key === section.key}
            onClick={onClose}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{section.label}</span>
            {section.key === "today" && needsYou > 0 ? (
              <MarkerCount n={needsYou} dark className="ml-auto" />
            ) : null}
          </NavLink>
        );
      })}
    </>
  );
}

export function Sidebar({
  onClose,
  className,
  collapsible = false,
}: {
  onClose?: () => void;
  className?: string;
  /** Desktop instance only — the mobile sheet always renders expanded. */
  collapsible?: boolean;
}) {
  const { logout, isLoggingOut } = useAuthContext();
  const { t, i18n } = useTranslation();
  // The page being opened counts as current, so the tap shows at once.
  const navPath = usePendingPathname().pathname;
  // Who sees what: shared with the phone menu sheet (~/lib/nav/use-nav-model).
  const {
    currentWorkspace,
    workspaces,
    brand,
    showBrandSwitchEntry,
    hasMultipleWorkspaces,
    isDoorboostBrandWs,
    showContactSales,
    inSettings,
    inWebsite,
    settingsGroups,
    switchWorkspace: handleWorkspaceChange,
    switchToBrand,
  } = useNavModel();
  const [contactOpen, setContactOpen] = useState(false);

  // Collapsed = icon rail. Restored from localStorage AFTER mount so the SSR
  // markup always matches the first client render (expanded) — a mismatch here
  // would hydrate the whole shell wrong.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (!collapsible) return;
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");
    } catch {
      // storage blocked — stay expanded
    }
  }, [collapsible]);
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // storage blocked — the toggle still works for this session
      }
      return next;
    });
  };

  return (
    <SidebarCollapsedContext.Provider value={collapsed}>
      <aside
        className={cn(
          "ink-surface flex h-full shrink-0 flex-col bg-[#111113] border-r border-white/5 transition-[width] duration-200",
          // Inside the phone menu sheet it fills the sheet; a fixed 220px
          // column left a second dark strip beside it.
          onClose ? "w-full border-r-0" : collapsed ? "w-[64px]" : "w-[220px]",
          className
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex h-14 shrink-0 items-center border-b border-white/5 gap-2",
            collapsed ? "justify-center px-0" : "px-4"
          )}
        >
          <Link
            to="/"
            className={cn(
              "flex items-center min-w-0",
              collapsed ? "justify-center" : "flex-1"
            )}
            onClick={onClose}
          >
            {collapsed ? (
              <img
                src="/dend-mark-white-favicon.svg"
                alt="Repraesent"
                className="h-7 w-7 opacity-90"
              />
            ) : (
              <img
                src={logoUrl}
                alt="Repraesent"
                className="h-7 w-auto max-w-[120px] brightness-0 invert opacity-90"
              />
            )}
          </Link>
          {collapsible && !collapsed && (
            <button
              onClick={toggleCollapsed}
              className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md text-white/35 hover:text-white/70 hover:bg-white/5 transition-colors"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </button>
          )}
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

        {/* Expand control — the header only fits the mark when collapsed */}
        {collapsible && collapsed && (
          <div className="flex shrink-0 justify-center border-b border-white/5 py-1.5">
            <button
              onClick={toggleCollapsed}
              className="flex h-7 w-7 items-center justify-center rounded-md text-white/35 hover:text-white/70 hover:bg-white/5 transition-colors"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Workspace selector */}
        <div
          className={cn(
            "shrink-0 py-3 border-b border-white/5",
            collapsed ? "px-1.5" : "px-3"
          )}
        >
          {currentWorkspace &&
            (hasMultipleWorkspaces ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    title={collapsed ? currentWorkspace.name : undefined}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg py-2 text-left text-[13px] text-white/55 hover:bg-white/5 hover:text-white/80 transition-colors duration-150",
                      collapsed ? "justify-center px-0" : "px-2.5"
                    )}
                  >
                    {(currentWorkspace.avatar_thumb_url ??
                    currentWorkspace.avatar_url) ? (
                      <SafeImg
                        src={
                          (currentWorkspace.avatar_thumb_url ??
                            currentWorkspace.avatar_url)!
                        }
                        className="h-6 w-6 shrink-0 rounded-md bg-white/90 object-contain p-0.5"
                        fallback={
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/10 text-white text-[10px] font-bold">
                            {currentWorkspace.name.charAt(0).toUpperCase()}
                          </div>
                        }
                      />
                    ) : (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/10 text-white text-[10px] font-bold">
                        {currentWorkspace.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate font-medium text-white/70">
                          {currentWorkspace.name}
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/30" />
                      </>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-48">
                  {showBrandSwitchEntry && brand && (
                    <DropdownMenuItem
                      key="__brand__"
                      onClick={() => {
                        onClose?.();
                        switchToBrand();
                      }}
                    >
                      <Building2 className="h-4 w-4" />
                      <span className="flex-1 truncate">{brand.name}</span>
                      <span className="ml-2 rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                        {t("nav.brand_label", "Brand")}
                      </span>
                    </DropdownMenuItem>
                  )}
                  {workspaces.map((ws) => (
                    <DropdownMenuItem
                      key={ws.id}
                      onClick={() => handleWorkspaceChange(ws.id)}
                    >
                      {(ws.avatar_thumb_url ?? ws.avatar_url) ? (
                        <SafeImg
                          src={(ws.avatar_thumb_url ?? ws.avatar_url)!}
                          className="h-4 w-4 shrink-0 rounded-sm bg-white object-contain"
                          fallback={<Building2 className="h-4 w-4" />}
                        />
                      ) : (
                        <Building2 className="h-4 w-4" />
                      )}
                      <span className="flex-1 truncate">{ws.name}</span>
                      {ws.type === "doorboost_brand" && (
                        <span className="ml-2 rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                          {t("nav.brand_label", "Brand")}
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div
                title={collapsed ? currentWorkspace.name : undefined}
                className={cn(
                  "flex items-center gap-2 py-2",
                  collapsed ? "justify-center px-0" : "px-2.5"
                )}
              >
                {(currentWorkspace.avatar_thumb_url ??
                currentWorkspace.avatar_url) ? (
                  <SafeImg
                    src={
                      (currentWorkspace.avatar_thumb_url ??
                        currentWorkspace.avatar_url)!
                    }
                    className="h-6 w-6 shrink-0 rounded-md bg-white/90 object-contain p-0.5"
                    fallback={
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/10 text-white text-[10px] font-bold">
                        {currentWorkspace.name.charAt(0).toUpperCase()}
                      </div>
                    }
                  />
                ) : (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/10 text-white text-[10px] font-bold">
                    {currentWorkspace.name.charAt(0).toUpperCase()}
                  </div>
                )}
                {!collapsed && (
                  <span className="truncate text-[13px] font-medium text-white/70">
                    {currentWorkspace.name}
                  </span>
                )}
              </div>
            ))}
        </div>

        {/* Navigation */}
        <nav
          className={cn(
            "min-h-0 flex-1 overflow-y-auto space-y-0.5",
            collapsed ? "p-1.5" : "p-3"
          )}
        >
          {inSettings ? (
            <>
              {/* Separated from the list below so it reads as a way out rather
                than a fifth destination. */}
              <div className="mb-2 border-b border-white/5 pb-2">
                <NavLink to="/" isActive={false} onClick={onClose}>
                  <ArrowLeft className="h-4 w-4 shrink-0" />
                  {t("common.back")}
                </NavLink>
              </div>

              {settingsGroups.map((group) => {
                const items = group.items;
                return (
                  <div key={group.key} className="pb-2">
                    {!collapsed && (
                      <p className="px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-white/30">
                        {t(group.labelKey, group.fallback)}
                      </p>
                    )}
                    {items.map(({ to, labelKey, Icon }) => (
                      <NavLink
                        key={to}
                        to={to}
                        isActive={navPath.startsWith(to)}
                        onClick={onClose}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{t(labelKey)}</span>
                        {PILOT_SETTINGS.has(to) ? (
                          <DemoPill />
                        ) : null}
                      </NavLink>
                    ))}
                  </div>
                );
              })}
            </>
          ) : inWebsite ? (
            <WebsiteSubNav onClose={onClose} />
          ) : isDoorboostBrandWs ? (
            <>
              <NavLink
                to="/db-brand"
                isActive={navPath === "/db-brand"}
                onClick={onClose}
              >
                <HomeIcon className="h-4 w-4 shrink-0" />
                {t("nav.home", "Home")}
              </NavLink>
              <NavLink
                to="/brand-retailers"
                isActive={
                  navPath.startsWith("/brand-retailers") ||
                  navPath.startsWith("/db-brand/retailers")
                }
                onClick={onClose}
              >
                <Store className="h-4 w-4 shrink-0" />
                {t("nav.brand_retailers", "Retailers")}
              </NavLink>
              <NavLink
                to="/brand-campaigns"
                isActive={navPath.startsWith("/brand-campaigns")}
                onClick={onClose}
              >
                <Megaphone className="h-4 w-4 shrink-0" />
                {t("nav.brand_campaigns", "Campaigns")}
              </NavLink>
              <NavLink
                to="/brand-leads"
                isActive={navPath.startsWith("/brand-leads")}
                onClick={onClose}
              >
                <Users className="h-4 w-4 shrink-0" />
                {t("nav.brand_leads", "Leads")}
              </NavLink>
            </>
          ) : (
            <MainSections onClose={onClose} />
          )}
        </nav>

        {/* Bottom: language → settings/billing → logout */}
        <div
          className={cn(
            "shrink-0 border-t border-white/5 space-y-0.5",
            collapsed ? "p-1.5" : "p-3"
          )}
        >
          <div className={collapsed ? "px-0 py-1 pb-2" : "px-3 py-1 pb-2"}>
            <LanguageSwitcher
              variant={collapsed ? "grid-dark" : "dark"}
              persistToDb
            />
          </div>
          {showContactSales && (
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              title={collapsed ? t("salesContact.nav") : undefined}
              className={cn(
                "flex w-full items-center rounded-lg border-l-2 border-transparent py-2 text-[13px] font-medium text-white/45 transition-all duration-150 hover:bg-white/5 hover:text-white/75 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/25",
                collapsed ? "justify-center px-0" : "gap-2.5 px-3"
              )}
            >
              <Headset className="h-4 w-4 shrink-0" aria-hidden />
              {collapsed ? (
                <span className="sr-only">{t("salesContact.nav")}</span>
              ) : (
                <span className="truncate">{t("salesContact.nav")}</span>
              )}
            </button>
          )}
          {!isDoorboostBrandWs && (
            <>
              {/* Hidden inside settings: the nav above already lists every
                section, so this would sit here permanently highlighted. */}
              {!inSettings && (
                <NavLink
                  to="/settings/profile"
                  isActive={false}
                  onClick={onClose}
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  {t("nav.settings")}
                </NavLink>
              )}
              <NavLink
                to="/billing"
                isActive={navPath === "/billing"}
                onClick={onClose}
              >
                <Package className="h-4 w-4 shrink-0" />
                {t("nav.billing")}
              </NavLink>
            </>
          )}
          <button
            onClick={() => logout()}
            disabled={isLoggingOut}
            title={collapsed ? t("nav.logout") : undefined}
            className={cn(
              "flex w-full items-center rounded-lg py-2 text-[13px] font-medium text-white/35 hover:bg-white/5 hover:text-white/60 transition-all duration-150 disabled:opacity-50",
              collapsed ? "justify-center px-0" : "gap-2.5 px-3"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed &&
              (isLoggingOut ? t("common.loading") : t("nav.logout"))}
          </button>

          {/* Legal links — no room on the rail */}
          {(() => {
            if (collapsed) return null;
            const isEn = i18n.language === "en";
            const base = isEn
              ? "https://repraesent.com/en"
              : "https://repraesent.com";
            return (
              <div className="flex items-center gap-3 px-3 pt-1">
                <a
                  href={`${base}/privacy.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-white/20 hover:text-white/45 transition-colors"
                >
                  {isEn ? "Privacy" : "Datenschutz"}
                </a>
                <span className="text-white/10 text-[10px]">·</span>
                <a
                  href={`${base}/impressum.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-white/20 hover:text-white/45 transition-colors"
                >
                  Impressum
                </a>
              </div>
            );
          })()}
        </div>
      </aside>
      {showContactSales && (
        <ContactSalesDialog open={contactOpen} onOpenChange={setContactOpen} />
      )}
    </SidebarCollapsedContext.Provider>
  );
}
