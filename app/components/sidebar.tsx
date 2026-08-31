import { Link, useLocation, useNavigate } from "react-router";
import {
  Children,
  Fragment,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { cn } from "~/lib/utils";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  AtSign,
  BellRing,
  Building2,
  BookUser,
  CalendarDays,
  CalendarRange,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Columns3,
  Kanban,
  Globe,
  HomeIcon,
  ImageIcon,
  Loader2,
  Inbox,
  Info,
  LayoutTemplate,
  LogOut,
  Mail,
  Megaphone,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Plus,
  Send,
  Settings,
  ShoppingBag,
  Star,
  Store,
  Trash2,
  User,
  Users,
  UsersRound,
  Workflow,
  X,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { InstructionsModal } from "~/components/instructions-modal";
import { OpenAiMark } from "~/components/icons/openai-mark";

import { getLocalizedServiceName } from "~/lib/api/auth";
import { useAuthContext } from "~/providers/auth-provider";
import { setStoredSelectedView, BRAND_VIEW } from "~/lib/api/axios-instance";
import { useAppointmentConfigs } from "~/lib/hooks/useAppointmentConfigs";
import { useCalendarSummary } from "~/lib/hooks/useCalendarSummary";
import { usePilotFeatures } from "~/lib/feature-flags";
import { useWorkspaceWpSite } from "~/lib/hooks/useWorkspaceWpSite";
import { useWorkspaceWpPluginInstalls } from "~/lib/hooks/useWorkspaceWpPluginInstalls";
import { useStripeConnection } from "~/lib/hooks/useWorkspaceIntegrations";
import { LanguageSwitcher } from "~/components/language-switcher";
import { usePipelinesQuery } from "~/lib/hooks/usePipelines";
import { CreatePipelineDialog } from "~/components/organism/create-pipeline-dialog";
import {
  pluginKindIcon,
  wordpressPluginSettingsPath,
} from "~/lib/utils/wordpress-plugin-kind";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

import logoUrl from "~/components/icons/re_praesent-mark-brand-hor.svg?url";

const lucideIconNames = new Set(
  Object.keys(LucideIcons).filter((key) => /^[A-Z]/.test(key)),
);

function kebabToPascal(name: string) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function DynamicIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = (LucideIcons as Record<string, unknown>)[name] as
    | React.ComponentType<{ className?: string }>
    | undefined;
  if (!Icon) return null;
  return <Icon className={className} />;
}

/**
 * The settings sub-navigation.
 *
 * Labels reuse the keys the deleted tab strip used, so all four locales already
 * have them. Order matches the old tabs.
 */
const SETTINGS_NAV = [
  { to: "/settings/profile", labelKey: "settings.tabs.profile", Icon: User },
  { to: "/settings/team", labelKey: "settings.tabs.areaSettings", Icon: Users },
  {
    to: "/settings/email-accounts",
    labelKey: "settings.tabs.emailAccounts",
    Icon: AtSign,
  },
  {
    to: "/settings/calendars",
    labelKey: "settings.tabs.calendars",
    Icon: CalendarDays,
  },
  { to: "/settings/bcc", labelKey: "settings.tabs.bcc", Icon: Inbox },
  {
    to: "/settings/notifications",
    labelKey: "settings.tabs.notifications",
    Icon: BellRing,
  },
  {
    to: "/settings/integrations",
    labelKey: "settings.tabs.integrations",
    Icon: Plug,
  },
  {
    to: "/settings/openai-ads",
    labelKey: "settings.tabs.openaiAds",
    Icon: OpenAiMark,
  },
  {
    to: "/settings/pipelines",
    labelKey: "settings.tabs.pipelines",
    Icon: Kanban,
  },
] as const;

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
      onClick={onClick}
      aria-disabled={disabled}
      className={[
        "flex items-center rounded-lg py-2 text-[13px] font-medium",
        collapsed ? "justify-center px-0" : "gap-2.5 px-3",
        "border-l-2 transition-all duration-150",
        disabled
          ? "cursor-not-allowed border-transparent text-white/25"
          : isActive
            ? "border-amber-400 bg-amber-400/10 text-amber-300"
            : "border-transparent text-white/45 hover:bg-white/5 hover:text-white/75",
        className ?? "",
      ].join(" ")}
    >
      {collapsed ? Children.toArray(children)[0] : children}
    </Link>
  );
}

/**
 * The "Pipeline" nav entry: a collapsible listing every deal pipeline
 * (Default first) plus an admin-only "New pipeline" row. Falls back to the
 * old flat link while the pipelines query has nothing to show.
 */
function PipelineNav({ onClose }: { onClose?: () => void }) {
  const { t } = useTranslation();
  const location = useLocation();
  const { currentWorkspace } = useAuthContext();
  const isAdmin = currentWorkspace?.member_role === "admin";
  const onPipeline = location.pathname.startsWith("/pipeline");
  const [open, setOpen] = useState(onPipeline);
  const [newOpen, setNewOpen] = useState(false);
  const pipelinesQuery = usePipelinesQuery();
  const pipelines = pipelinesQuery.data ?? [];
  const collapsed = useContext(SidebarCollapsedContext);

  // Landing anywhere under /pipeline reveals the list.
  useEffect(() => {
    if (onPipeline) setOpen(true);
  }, [onPipeline]);

  // No room for a nested list on the icon rail — one link to the default view.
  if (collapsed) {
    return (
      <NavLink to="/pipeline" isActive={onPipeline} onClick={onClose}>
        <Columns3 className="h-4 w-4 shrink-0" />
      </NavLink>
    );
  }

  if (!pipelinesQuery.isSuccess || pipelines.length === 0) {
    return (
      <NavLink to="/pipeline" isActive={onPipeline} onClick={onClose}>
        <Columns3 className="h-4 w-4 shrink-0" />
        {t("nav.pipeline", { defaultValue: "Pipeline" })}
      </NavLink>
    );
  }

  const defaultPipeline = pipelines.find((p) => p.is_default) ?? pipelines[0];
  const activeParam =
    location.pathname === "/pipeline"
      ? new URLSearchParams(location.search).get("p")
      : undefined;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      {/* Toggles only — never closes the mobile sheet and never navigates. */}
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium",
            "border-l-2 transition-all duration-150",
            onPipeline && !open
              ? "border-amber-400 bg-amber-400/10 text-amber-300"
              : onPipeline
                ? "border-transparent text-amber-300/90 hover:bg-white/5"
                : "border-transparent text-white/45 hover:bg-white/5 hover:text-white/75",
          )}
        >
          <Columns3 className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">
            {t("nav.pipeline", { defaultValue: "Pipeline" })}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/30 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5 pt-0.5">
        {pipelines.map((p) => {
          const isDefault = p.id === defaultPipeline?.id;
          const isActive =
            activeParam !== undefined &&
            (activeParam ?? null) === (isDefault ? null : p.id);
          return (
            <NavLink
              key={p.id}
              to={isDefault ? "/pipeline" : `/pipeline?p=${p.id}`}
              isActive={isActive}
              onClick={onClose}
              className="ml-5"
            >
              <span className="truncate">{p.name}</span>
              <span className="ml-auto text-[10px] tabular-nums text-white/25">
                {p.deal_count}
              </span>
            </NavLink>
          );
        })}
        {isAdmin && (
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className={cn(
              "ml-5 flex w-[calc(100%-1.25rem)] items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium",
              "border-l-2 border-transparent text-white/45 transition-all duration-150 hover:bg-white/5 hover:text-white/75",
            )}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            {t("nav.newPipeline", { defaultValue: "New pipeline" })}
          </button>
        )}
      </CollapsibleContent>
      <CreatePipelineDialog open={newOpen} onOpenChange={setNewOpen} />
    </Collapsible>
  );
}

/**
 * The "Media" nav entry: a collapsible with Library / Favourites / Recycle
 * bin views. Same behavior as PipelineNav — the trigger only toggles the
 * group; navigation happens via the sub-items.
 */
function MediaNav({ onClose }: { onClose?: () => void }) {
  const { t } = useTranslation();
  const location = useLocation();
  const onMedia = location.pathname.startsWith("/media");
  const [open, setOpen] = useState(onMedia);
  const collapsed = useContext(SidebarCollapsedContext);

  // Landing anywhere under /media reveals the views.
  useEffect(() => {
    if (onMedia) setOpen(true);
  }, [onMedia]);

  // No room for a nested list on the icon rail — one link to the library.
  if (collapsed) {
    return (
      <NavLink to="/media" isActive={onMedia} onClick={onClose}>
        <ImageIcon className="h-4 w-4 shrink-0" />
      </NavLink>
    );
  }

  const views = [
    {
      to: "/media",
      icon: <ImageIcon className="h-3.5 w-3.5 shrink-0" />,
      label: t("nav.mediaLibrary", { defaultValue: "Library" }),
      active: location.pathname === "/media",
    },
    {
      to: "/media/favorites",
      icon: <Star className="h-3.5 w-3.5 shrink-0" />,
      label: t("nav.mediaFavorites", { defaultValue: "Favourites" }),
      active: location.pathname === "/media/favorites",
    },
    {
      to: "/media/bin",
      icon: <Trash2 className="h-3.5 w-3.5 shrink-0" />,
      label: t("nav.mediaBin", { defaultValue: "Recycle bin" }),
      active: location.pathname === "/media/bin",
    },
  ];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      {/* Toggles only — never closes the mobile sheet and never navigates. */}
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium",
            "border-l-2 transition-all duration-150",
            onMedia && !open
              ? "border-amber-400 bg-amber-400/10 text-amber-300"
              : onMedia
                ? "border-transparent text-amber-300/90 hover:bg-white/5"
                : "border-transparent text-white/45 hover:bg-white/5 hover:text-white/75",
          )}
        >
          <ImageIcon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">
            {t("nav.media", { defaultValue: "Media" })}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/30 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5 pt-0.5">
        {views.map((v) => (
          <NavLink
            key={v.to}
            to={v.to}
            isActive={v.active}
            onClick={onClose}
            className="ml-5"
          >
            {v.icon}
            <span className="truncate">{v.label}</span>
          </NavLink>
        ))}
      </CollapsibleContent>
    </Collapsible>
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
  const location = useLocation();
  const installsQuery = useWorkspaceWpPluginInstalls(true);
  const plugins = [...(installsQuery.data?.plugins ?? [])].sort((a, b) =>
    a.display_name.localeCompare(b.display_name, undefined, {
      sensitivity: "base",
    }),
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
        isActive={location.pathname === "/website"}
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
              isActive={location.pathname === path}
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
  const {
    user,
    currentWorkspace,
    workspaces,
    brand,
    setCurrentWorkspace,
    logout,
    isLoggingOut,
  } = useAuthContext();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  // Brand users with a linked brand entity get a "Brand" entry in the switcher
  // so they can hop back to their brand dashboard from a workspace view.
  const showBrandSwitchEntry = user?.user_type === "brand" && !!brand;
  const hasMultipleWorkspaces =
    (workspaces?.length ?? 0) > 1 ||
    (showBrandSwitchEntry && (workspaces?.length ?? 0) >= 1);
  const [instructionsMarkdown, setInstructionsMarkdown] = useState<
    string | null
  >(null);
  // A live demo is a product tour: every destination stays visible even with
  // nothing connected, so the visitor can see what the app does. The pages
  // show their own empty states. Real workspaces keep the gates below.
  const isDemoWorkspace = currentWorkspace?.is_demo === true;
  const hasAppointmentsService =
    currentWorkspace?.services?.some(
      (s) => s.service_type === "appointments",
    ) ?? false;
  const { data: appointmentConfigs } = useAppointmentConfigs(
    hasAppointmentsService && !!currentWorkspace?.id,
  );
  const showAppointmentsInSidebar =
    (hasAppointmentsService && !!appointmentConfigs?.length) || isDemoWorkspace;
  // The team Calendar page only exists once someone connected a source, so
  // the nav entry follows the same summary the page itself redirects on.
  const { data: calendarSummary } = useCalendarSummary(!!currentWorkspace?.id);
  const showCalendarInSidebar =
    (calendarSummary?.google_account_count ?? 0) +
      (calendarSummary?.baikal_config_count ?? 0) >
      0 || isDemoWorkspace;
  const isDoorboostBrandWs = currentWorkspace?.type === "doorboost_brand";
  // TEMPORARY: Workflows and Settings → Integrations are still being piloted,
  // so in production only the pilot workspace sees those nav entries. Local
  // development always shows them.
  // Pilot gating lives in ~/lib/feature-flags. These hide entries only — the
  // routes stay reachable by URL, and none of this is a permission boundary.
  const pilot = usePilotFeatures();
  const showWorkflows = pilot.workflows || isDemoWorkspace;
  const showEmailCampaigns = pilot.emailCampaigns;
  // Route-driven rather than stateful: deep links and refreshes land in the
  // right mode for free, and there is nothing to reset on the way out.
  const inSettings = location.pathname.startsWith("/settings");
  const { data: wpSite } = useWorkspaceWpSite(
    !!currentWorkspace?.id && !isDoorboostBrandWs,
  );
  const { isConnected: hasStripeConnection } = useStripeConnection(
    !!currentWorkspace?.id && !isDoorboostBrandWs,
  );
  const showWebsite = !!wpSite?.sso_enabled || isDemoWorkspace;
  // Same drill-in as Settings: /website replaces the nav list with Overview
  // plus the workspace's services, and "Back" returns to the main list.
  const inWebsite = showWebsite && location.pathname.startsWith("/website");

  const handleWorkspaceChange = (workspaceId: string) => {
    setCurrentWorkspace(workspaceId);
    navigate("/", { replace: true });
  };

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
          "flex h-full shrink-0 flex-col bg-[#111113] border-r border-white/5 transition-[width] duration-200",
          collapsed ? "w-[64px]" : "w-[220px]",
          className,
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex h-14 shrink-0 items-center border-b border-white/5 gap-2",
            collapsed ? "justify-center px-0" : "px-4",
          )}
        >
          <Link
            to="/"
            className={cn(
              "flex items-center min-w-0",
              collapsed ? "justify-center" : "flex-1",
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
            collapsed ? "px-1.5" : "px-3",
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
                      collapsed ? "justify-center px-0" : "px-2.5",
                    )}
                  >
                    {(currentWorkspace.avatar_thumb_url ?? currentWorkspace.avatar_url) ? (
                      <img
                        src={(currentWorkspace.avatar_thumb_url ?? currentWorkspace.avatar_url)!}
                        alt=""
                        className="h-6 w-6 shrink-0 rounded-md bg-white/90 object-contain p-0.5"
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
                        setStoredSelectedView(BRAND_VIEW);
                        navigate("/brand", { replace: true });
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
                        <img
                          src={(ws.avatar_thumb_url ?? ws.avatar_url)!}
                          alt=""
                          className="h-4 w-4 shrink-0 rounded-sm bg-white object-contain"
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
                  collapsed ? "justify-center px-0" : "px-2.5",
                )}
              >
                {(currentWorkspace.avatar_thumb_url ?? currentWorkspace.avatar_url) ? (
                  <img
                    src={(currentWorkspace.avatar_thumb_url ?? currentWorkspace.avatar_url)!}
                    alt=""
                    className="h-6 w-6 shrink-0 rounded-md bg-white/90 object-contain p-0.5"
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
            collapsed ? "p-1.5" : "p-3",
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

              {SETTINGS_NAV.filter(
                (item) =>
                  item.to !== "/settings/integrations" ||
                  pilot.integrations ||
                  isDemoWorkspace,
              ).map(({ to, labelKey, Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  isActive={location.pathname.startsWith(to)}
                  onClick={onClose}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t(labelKey)}</span>
                </NavLink>
              ))}
            </>
          ) : inWebsite ? (
            <WebsiteSubNav onClose={onClose} />
          ) : isDoorboostBrandWs ? (
            <>
              <NavLink
                to="/db-brand"
                isActive={location.pathname === "/db-brand"}
                onClick={onClose}
              >
                <HomeIcon className="h-4 w-4 shrink-0" />
                {t("nav.home", "Home")}
              </NavLink>
              <NavLink
                to="/brand-retailers"
                isActive={
                  location.pathname.startsWith("/brand-retailers") ||
                  location.pathname.startsWith("/db-brand/retailers")
                }
                onClick={onClose}
              >
                <Store className="h-4 w-4 shrink-0" />
                {t("nav.brand_retailers", "Retailers")}
              </NavLink>
              <NavLink
                to="/brand-campaigns"
                isActive={location.pathname.startsWith("/brand-campaigns")}
                onClick={onClose}
              >
                <Megaphone className="h-4 w-4 shrink-0" />
                {t("nav.brand_campaigns", "Campaigns")}
              </NavLink>
              <NavLink
                to="/brand-leads"
                isActive={location.pathname.startsWith("/brand-leads")}
                onClick={onClose}
              >
                <Users className="h-4 w-4 shrink-0" />
                {t("nav.brand_leads", "Leads")}
              </NavLink>
            </>
          ) : (
            <>
              <NavLink
                to="/"
                isActive={location.pathname === "/"}
                onClick={onClose}
              >
                <HomeIcon className="h-4 w-4 shrink-0" />
                {t("nav.home")}
              </NavLink>

              {showWebsite && (
                <NavLink to="/website" isActive={false} onClick={onClose}>
                  <Globe className="h-4 w-4 shrink-0" />
                  {t("nav.wordpress", "Website")}
                </NavLink>
              )}

              {/* Forms is available to every workspace, so it sits outside the
                services map rather than being gated on a service_type. */}
              <NavLink
                to="/forms"
                isActive={location.pathname.startsWith("/forms")}
                onClick={onClose}
              >
                <ClipboardList className="h-4 w-4 shrink-0" />
                {t("nav.forms", "Forms")}
              </NavLink>

              {/* Gated on the connection rather than a service entitlement: the
                catalogue is a live proxy, so with no Stripe account there is
                literally nothing for the page to show — except in a demo,
                where the page's own connect-Stripe card is the point. */}
              {(hasStripeConnection || isDemoWorkspace) && (
                <NavLink
                  to="/products"
                  isActive={location.pathname.startsWith("/products")}
                  onClick={onClose}
                >
                  <ShoppingBag className="h-4 w-4 shrink-0" />
                  {t("nav.stripeProducts", { defaultValue: "Products" })}
                </NavLink>
              )}

              {/* Always visible — the feature is self-serve (any workspace admin
                pastes their own API key), so the entry point has to exist
                before a connection does. Unconnected workspaces land on the
                onboarding state of /openai-ads. The "New" pill stays for
                everyone while the feature is fresh; drop it here when it no
                longer is. */}
              <NavLink
                to="/openai-ads"
                isActive={location.pathname.startsWith("/openai-ads")}
                onClick={onClose}
              >
                <OpenAiMark className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {t("nav.openaiAds", { defaultValue: "OpenAI Ads" })}
                </span>
                <span className="ml-auto rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300">
                  {t("nav.newBadge", { defaultValue: "New" })}
                </span>
              </NavLink>

              {showWorkflows && (
                <NavLink
                  to="/workflows"
                  isActive={location.pathname.startsWith("/workflows")}
                  onClick={onClose}
                >
                  <Workflow className="h-4 w-4 shrink-0" />
                  {t("nav.workflows", { defaultValue: "Workflows" })}
                </NavLink>
              )}

              {showEmailCampaigns && (
                <>
                  <NavLink
                    to="/campaigns"
                    isActive={location.pathname.startsWith("/campaigns")}
                    onClick={onClose}
                  >
                    <Send className="h-4 w-4 shrink-0" />
                    {t("nav.emailCampaigns", { defaultValue: "Campaigns" })}
                  </NavLink>
                  <NavLink
                    to="/segments"
                    isActive={location.pathname.startsWith("/segments")}
                    onClick={onClose}
                  >
                    <UsersRound className="h-4 w-4 shrink-0" />
                    {t("nav.segments", { defaultValue: "Segments" })}
                  </NavLink>
                  <NavLink
                    to="/email-templates"
                    isActive={location.pathname.startsWith("/email-templates")}
                    onClick={onClose}
                  >
                    <LayoutTemplate className="h-4 w-4 shrink-0" />
                    {t("nav.emailTemplates", { defaultValue: "Templates" })}
                  </NavLink>
                  <MediaNav onClose={onClose} />
                </>
              )}

              {currentWorkspace?.services
                ?.filter(
                  (service) =>
                    service.service_type !== "appointments" ||
                    showAppointmentsInSidebar,
                )
                ?.slice()
                ?.sort(
                  (a, b) => (a.service_order ?? 0) - (b.service_order ?? 0),
                )
                ?.map((service) => {
                  const href = service.service_slug
                    ? `/${service.service_slug}`
                    : "#";
                  const isActive =
                    !!service.service_slug &&
                    (location.pathname === `/${service.service_slug}` ||
                      location.pathname.startsWith(
                        `/${service.service_slug}/`,
                      ));
                  const hasSlug = !!service.service_slug;
                  const iconName = service.service_icon
                    ? kebabToPascal(service.service_icon)
                    : null;
                  const hasIcon = !!iconName && lucideIconNames.has(iconName);

                  const instructions = (
                    service.service_config as Record<string, unknown> | null
                  )?.instructions as string | undefined;
                  const hasInstructions = !!instructions;
                  const isLeadFormService =
                    service.service_type === "lead-form" ||
                    service.service_slug === "lead-form";
                  return (
                    <Fragment key={service.service_id}>
                      <div className="flex items-center group/svc">
                        <NavLink
                          to={href}
                          isActive={isActive}
                          disabled={!hasSlug}
                          onClick={(e) => {
                            if (!hasSlug) e.preventDefault();
                            else onClose?.();
                          }}
                          className="flex-1 min-w-0"
                        >
                          {hasIcon && (
                            <DynamicIcon
                              name={iconName!}
                              className="h-4 w-4 shrink-0"
                            />
                          )}
                          <span className="truncate">
                            {getLocalizedServiceName(
                              service,
                              i18n.language ?? "de",
                            )}
                          </span>
                        </NavLink>
                        {hasInstructions && !collapsed && (
                          <button
                            type="button"
                            title="View instructions"
                            onClick={() =>
                              setInstructionsMarkdown(instructions!)
                            }
                            className="
                      ml-0.5 mr-1 flex h-5 w-5 shrink-0 items-center justify-center
                      rounded opacity-0 group-hover/svc:opacity-100
                      text-white/25 hover:text-amber-400 hover:bg-amber-400/8
                      transition-all duration-150
                    "
                          >
                            <Info className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      {isLeadFormService && (
                        <>
                          {" "}
                          <NavLink
                            to="/contacts"
                            isActive={location.pathname.startsWith("/contacts")}
                            onClick={onClose}
                          >
                            <BookUser className="h-4 w-4 shrink-0" />
                            {t("nav.contacts", { defaultValue: "Contacts" })}
                          </NavLink>
                          <NavLink
                            to="/mail"
                            isActive={location.pathname.startsWith("/mail")}
                            onClick={onClose}
                          >
                            <Mail className="h-4 w-4 shrink-0" />
                            {t("nav.mail", { defaultValue: "Mail" })}
                          </NavLink>
                          <PipelineNav onClose={onClose} />
                          <NavLink
                            to="/tasks"
                            isActive={location.pathname === "/tasks"}
                            onClick={onClose}
                          >
                            <CheckSquare className="h-4 w-4 shrink-0" />
                            {t("nav.tasks")}
                          </NavLink>
                        </>
                      )}
                    </Fragment>
                  );
                })}

              {showCalendarInSidebar && (
                <NavLink
                  to="/calendar"
                  isActive={location.pathname.startsWith("/calendar")}
                  onClick={onClose}
                >
                  <CalendarRange className="h-4 w-4 shrink-0" />
                  {t("nav.calendar", { defaultValue: "Calendar" })}
                </NavLink>
              )}
            </>
          )}
        </nav>

        {/* Bottom: language → settings/billing → logout */}
        <div
          className={cn(
            "shrink-0 border-t border-white/5 space-y-0.5",
            collapsed ? "p-1.5" : "p-3",
          )}
        >
          <div className={collapsed ? "px-0 py-1 pb-2" : "px-3 py-1 pb-2"}>
            <LanguageSwitcher
              variant={collapsed ? "grid-dark" : "dark"}
              persistToDb
            />
          </div>
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
                isActive={location.pathname === "/billing"}
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
              collapsed ? "justify-center px-0" : "gap-2.5 px-3",
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

        {/* Instructions modal */}
        {instructionsMarkdown !== null && (
          <InstructionsModal
            open
            onClose={() => setInstructionsMarkdown(null)}
            markdown={instructionsMarkdown}
          />
        )}
      </aside>
    </SidebarCollapsedContext.Provider>
  );
}
