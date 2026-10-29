import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  Bot,
  BookUser,
  Building2,
  CalendarRange,
  CheckSquare,
  ClipboardList,
  Columns3,
  Globe,
  ImageIcon,
  Inbox,
  LayoutTemplate,
  Mail,
  MailCheck,
  Megaphone,
  PanelsTopLeft,
  Send,
  ShoppingBag,
  Sun,
  Users,
  UsersRound,
  Workflow,
  Eye,
  LineChart,
  Briefcase,
  Radar,
  CalendarClock,
  CalendarDays,
  BookOpen,
  SlidersHorizontal,
  FlaskConical,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { OpenAiMark } from "~/components/icons/openai-mark";
import { getLocalizedServiceName } from "~/lib/api/auth";
import { useAuthContext } from "~/providers/auth-provider";
import { usePilotFeatures } from "~/lib/feature-flags";
import { useAppointmentConfigs } from "~/lib/hooks/useAppointmentConfigs";
import { useCalendarSummary } from "~/lib/hooks/useCalendarSummary";
import { useWorkspaceWpSite } from "~/lib/hooks/useWorkspaceWpSite";
import {
  usePreloadWpPluginInstalls,
  useWorkspaceWpPluginInstalls,
} from "~/lib/hooks/useWorkspaceWpPluginInstalls";
import {
  useSwitchWpSite,
  useWorkspaceWpSites,
  useWpSitesHosting,
} from "~/lib/hooks/useWorkspaceWpSites";
import {
  pluginKindIcon,
  WEBSITE_SETTINGS_PATH,
  WEBSITE_STAGING_PATH,
  wordpressPluginSettingsPath,
} from "~/lib/utils/wordpress-plugin-kind";
import { useStripeConnection } from "~/lib/hooks/useWorkspaceIntegrations";
import { usePipelinesQuery } from "~/lib/hooks/usePipelines";

/**
 * The navigation, organised by the owner's jobs rather than by modules
 * (NOTEBOOK_UX_PLAN.md §2). Every existing destination still has a home here —
 * nothing is removed, it just lives one level down, as a tab of its section.
 * Every gate the old hand-written sidebar applied (pilot flags, services,
 * demo, Stripe, WordPress SSO, calendar sources) is kept with the same meaning.
 */

export type SectionKey = "today" | "customers" | "deals" | "appointments" | "results" | "website";

export type IconType = ComponentType<{ className?: string }>;

export interface SectionTab {
  key: string;
  label: string;
  to: string;
  icon: IconType;
  /** Path prefixes that make this tab active (defaults to `to`). */
  match?: string[];
  /** Exact-path match only. */
  exact?: boolean;
  /** Shows the neutral "Demo" pill (pilot features). */
  pilot?: boolean;
  /** Shows the "New" pill. */
  isNew?: boolean;
  /** A dropdown of sub-destinations (pipelines, media views). */
  items?: { key: string; label: string; to: string; meta?: string }[];
  /** Pipeline tab: admins can create a pipeline from the dropdown. */
  createPipeline?: boolean;
}

/** A page listed under its section in the left panel (Website › Production, › Staging). */
export interface SectionChild {
  key: string;
  label: string;
  to: string;
  icon: IconType;
  /**
   * Whether the section's other pages work on this one right now: Settings
   * and the services follow the open site, so they light up its entry.
   */
  selected: boolean;
  /**
   * Runs with the click, before the page opens: makes this entry's site the
   * open one, so the tabs above the page are already that site's.
   */
  onSelect?: () => void;
}

export interface NavSection {
  key: SectionKey;
  label: string;
  icon: IconType;
  to: string;
  /** Path prefixes that light this section up. */
  match: string[];
  tabs: SectionTab[];
  /** Pages nested under the section in the left panel. */
  children?: SectionChild[];
  /** Runs with a click on the section itself, before its page opens. */
  onSelect?: () => void;
  /** Shows the neutral "Demo" pill (pilot features). */
  pilot?: boolean;
}

const lucideIconNames = new Set(
  Object.keys(LucideIcons).filter((key) => /^[A-Z]/.test(key)),
);

function kebabToPascal(name: string) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function serviceIcon(name?: string | null): IconType {
  const pascal = name ? kebabToPascal(name) : null;
  if (pascal && lucideIconNames.has(pascal)) {
    return (LucideIcons as unknown as Record<string, IconType>)[pascal];
  }
  return PanelsTopLeft;
}

/** Which section a dynamic workspace service belongs to (by slug, then type). */
function sectionForService(slug: string, type: string): SectionKey {
  if (type === "appointments" || slug === "appointments") return "deals";
  if (
    slug === "analytics" ||
    slug === "social-ads" ||
    type === "analytics" ||
    type.includes("ads")
  ) {
    return "results";
  }
  if (slug === "email" || type === "email" || type === "email-config") {
    return "customers";
  }
  return "website";
}

export function pathMatches(pathname: string, prefixes: string[], exact = false) {
  return prefixes.some((p) =>
    exact || p === "/"
      ? pathname === p
      : pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`),
  );
}

/**
 * The five sections with the tabs this workspace can actually use. Brand
 * (DoorBoost) workspaces keep their own list and get `null` here.
 */
export function useNavSections(): NavSection[] | null {
  const { t, i18n } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const pilot = usePilotFeatures();
  const isBrand = currentWorkspace?.type === "doorboost_brand";
  const isDemo = currentWorkspace?.is_demo === true;
  const enabled = !!currentWorkspace?.id && !isBrand;

  const { data: wpSite } = useWorkspaceWpSite(enabled);
  // The site list (a quick database read): Staging shows when it has a copy.
  const { data: wpSites } = useWorkspaceWpSites(enabled);
  const isElsewhere = useWpSitesHosting(enabled && !!wpSite);
  // The site's services (cookie banner, SEO, translations…) are Website tabs.
  const { data: wpInstalls } = useWorkspaceWpPluginInstalls(
    enabled ? wpSite?.id : undefined,
  );
  // Every site's services, loaded in the background: a switch between
  // Production and Staging then shows the new site's tabs at once.
  usePreloadWpPluginInstalls(enabled ? (wpSites ?? []).map((s) => s.id) : []);
  const switchSite = useSwitchWpSite();
  const { isConnected: hasStripe } = useStripeConnection(enabled);
  const hasAppointmentsService =
    currentWorkspace?.services?.some((s) => s.service_type === "appointments") ??
    false;
  const { data: appointmentConfigs } = useAppointmentConfigs(
    hasAppointmentsService && enabled,
  );
  const { data: calendarSummary } = useCalendarSummary(enabled);
  const pipelinesQuery = usePipelinesQuery();
  const isAdmin = currentWorkspace?.member_role === "admin";

  if (!currentWorkspace || isBrand) return null;

  const showWebsite = !!wpSite || isDemo;
  const hasLive = !!wpSites?.some((s) => s.type === "production");
  const hasStaging = !!wpSites?.some((s) => s.type !== "production");
  const openIsStaging = hasStaging && !!wpSite && wpSite.type !== "production";
  // The site each page opens: the open one if it's that kind, else the first.
  const siteOf = (production: boolean) =>
    wpSite && (wpSite.type === "production") === production
      ? wpSite
      : wpSites?.find((s) => (s.type === "production") === production);
  const productionSite = siteOf(true);
  const stagingSite = siteOf(false);
  const open = (site: typeof wpSite) => () => {
    if (site && site.id !== wpSite?.id) switchSite(site);
  };
  // Website opens the production site; with only a staging copy, that copy.
  const websiteHome = !hasLive && hasStaging ? WEBSITE_STAGING_PATH : "/website";
  // Production and Staging sit under Website in the left panel only when both exist.
  const websiteChildren: SectionChild[] | undefined =
    showWebsite && hasLive && hasStaging
      ? [
          {
            key: "live",
            label: t("nav.websiteProduction", "Production"),
            to: "/website",
            icon: Globe,
            selected: !openIsStaging,
            onSelect: open(productionSite),
          },
          {
            key: "staging",
            label: t("nav.websiteStaging", "Staging"),
            to: WEBSITE_STAGING_PATH,
            icon: FlaskConical,
            selected: openIsStaging,
            onSelect: open(stagingSite),
          },
        ]
      : undefined;
  const showAppointments =
    (hasAppointmentsService && !!appointmentConfigs?.length) || isDemo;
  const showCalendar =
    (calendarSummary?.google_account_count ?? 0) +
      (calendarSummary?.baikal_config_count ?? 0) >
      0 || isDemo;
  const showWorkflows = pilot.workflows || isDemo;

  const customers: SectionTab[] = [
    {
      key: "inquiries",
      label: t("sections.tabs.inquiries", "Inquiries"),
      to: "/lead-form",
      icon: Users,
    },
    {
      key: "people",
      label: t("sections.tabs.people", "People"),
      to: "/contacts",
      icon: BookUser,
    },
    {
      key: "companies",
      label: t("sections.tabs.companies", "Companies"),
      to: "/companies",
      icon: Building2,
    },
    {
      key: "inbox",
      label: t("sections.tabs.inbox", "Inbox"),
      to: "/mail",
      icon: Mail,
    },
  ];
  if (pilot.emailCampaigns) {
    customers.push(
      {
        key: "campaigns",
        label: t("nav.emailCampaigns", "Campaigns"),
        to: "/campaigns",
        icon: Send,
        pilot: true,
      },
      {
        key: "segments",
        label: t("nav.segments", "Segments"),
        to: "/segments",
        icon: UsersRound,
        pilot: true,
      },
      {
        key: "templates",
        label: t("nav.emailTemplates", "Templates"),
        to: "/email-templates",
        icon: LayoutTemplate,
        pilot: true,
      },
    );
  }
  if (showWorkflows) {
    customers.push({
      key: "workflows",
      label: t("nav.workflows", "Workflows"),
      to: "/workflows",
      icon: Workflow,
      pilot: true,
    });
  }

  const pipelines = pipelinesQuery.data ?? [];
  const defaultPipeline = pipelines.find((p) => p.is_default) ?? pipelines[0];
  const deals: SectionTab[] = [
    {
      key: "pipeline",
      label: t("sections.tabs.pipeline", "Pipeline"),
      to: "/pipeline",
      icon: Columns3,
      items:
        pipelines.length > 1 || isAdmin
          ? pipelines.map((p) => ({
              key: p.id,
              label: p.name,
              to: p.id === defaultPipeline?.id ? "/pipeline" : `/pipeline?p=${p.id}`,
              meta: String(p.deal_count ?? ""),
            }))
          : undefined,
      createPipeline: isAdmin,
    },
    {
      key: "tasks",
      label: t("nav.tasks", "Tasks"),
      to: "/tasks",
      icon: CheckSquare,
    },
  ];
  // Appointments as a section of their own (pilot `appointmentBook`): the
  // calendar pages move there from Deals. Without the pilot, nothing changes.
  const appointmentBook = pilot.appointmentBook;
  const appointments: SectionTab[] = [];
  if (appointmentBook) {
    appointments.push(
      {
        key: "upcoming",
        label: t("sections.tabs.upcoming", "Upcoming"),
        to: "/appointments",
        icon: CalendarClock,
        // Exact: the other tabs live under /appointments/… too.
        exact: true,
      },
      {
        key: "appointment-calendar",
        label: t("sections.tabs.appointmentCalendar", "Calendar"),
        to: "/appointments/calendar",
        icon: CalendarDays,
      },
    );
    if (showCalendar) {
      appointments.push({
        key: "team-calendar",
        label: t("sections.tabs.teamCalendar", "Team calendar"),
        to: "/calendar",
        icon: CalendarRange,
        match: ["/calendar", "/instructions"],
      });
    }
    if (showAppointments) {
      appointments.push({
        key: "booking-page",
        label: t("sections.tabs.bookingPage", "Booking page"),
        to: "/appointments/booking-page",
        icon: BookOpen,
      });
    }
  } else if (showCalendar || showAppointments) {
    deals.push({
      key: "calendar",
      label: t("nav.calendar", "Calendar"),
      to: showCalendar ? "/calendar" : "/appointments/booking-page",
      icon: CalendarRange,
      match: ["/calendar", "/appointments", "/instructions"],
    });
  }
  if (hasStripe || isDemo) {
    deals.push({
      key: "products",
      label: t("nav.stripeProducts", "Products"),
      to: "/products",
      icon: ShoppingBag,
    });
  }

  const results: SectionTab[] = [
    {
      key: "overview",
      label: t("sections.tabs.overview", "Overview"),
      to: "/results",
      icon: LineChart,
      exact: true,
    },
    {
      key: "chatgpt",
      label: t("sections.tabs.chatgptAds", "ChatGPT ads"),
      to: "/openai-ads",
      icon: OpenAiMark,
    },
  ];
  results.push({
    key: "ai-visibility",
    label: t("sections.tabs.aiVisibility", "AI visibility"),
    to: "/ai-visibility",
    icon: Radar,
  });

  const forms: SectionTab = {
    key: "forms",
    label: t("nav.forms", "Forms"),
    to: "/forms",
    icon: ClipboardList,
  };
  const website: SectionTab[] = [];
  // Settings for the whole site goes last in the strip, after everything else.
  let websiteSettings: SectionTab | null = null;
  if (showWebsite) {
    website.push({
      key: "site",
      label: t("nav.websiteOverview", "Overview"),
      // The open site's own page: Live, or Staging while a copy is open.
      to: openIsStaging ? WEBSITE_STAGING_PATH : "/website",
      match: ["/website", WEBSITE_STAGING_PATH],
      icon: Globe,
      // Exact: the other Website pages live under /website/… as their own tabs.
      exact: true,
    });
    // A site we don't host has no settings or services to manage here.
    if (!isElsewhere(wpSite?.id)) {
      websiteSettings = {
        key: "site-settings",
        label: t("nav.websiteSettings", "Settings"),
        to: WEBSITE_SETTINGS_PATH,
        icon: SlidersHorizontal,
        // Exact: /website/settings/<uuid> is a service tab.
        exact: true,
      };
    }
    // Forms comes right after Overview, before the services.
    website.push(forms);
    if (!isElsewhere(wpSite?.id)) {
      const plugins = [...(wpInstalls?.plugins ?? [])].sort((a, b) =>
        a.display_name.localeCompare(b.display_name, undefined, {
          sensitivity: "base",
        }),
      );
      for (const p of plugins) {
        website.push({
          key: `wp-${p.plugin_uuid}`,
          label: p.display_name,
          to: wordpressPluginSettingsPath(p.plugin_uuid),
          icon: pluginKindIcon(p.name),
        });
      }
    }
  }
  if (!showWebsite) website.push(forms);
  if (pilot.aiAssistant) {
    website.push({
      key: "chat",
      label: t("sections.tabs.aiChat", "AI chat"),
      to: "/ai-assistants",
      icon: Bot,
      pilot: true,
    });
  }
  website.push({
    key: "files",
    label: t("sections.tabs.files", "Files"),
    to: "/media",
    icon: ImageIcon,
    items: [
      { key: "library", label: t("nav.mediaLibrary", "Library"), to: "/media" },
      {
        key: "favorites",
        label: t("nav.mediaFavorites", "Favourites"),
        to: "/media/favorites",
      },
      { key: "bin", label: t("nav.mediaBin", "Recycle bin"), to: "/media/bin" },
    ],
  });

  // Dynamic workspace services — same filter and order as before; each lands
  // in the section it belongs to, so none of them disappears.
  const services =
    currentWorkspace.services
      ?.filter((s) => s.service_type !== "appointments" || showAppointments)
      .slice()
      .sort((a, b) => (a.service_order ?? 0) - (b.service_order ?? 0)) ?? [];
  for (const s of services) {
    if (!s.service_slug) continue;
    const to = `/${s.service_slug}`;
    const section = sectionForService(s.service_slug, s.service_type ?? "");
    // Appointments is already reachable through the Calendar / Booking page tab.
    if (
      s.service_type === "appointments" &&
      (deals.some((d) => d.key === "calendar") || appointments.some((a) => a.key === "booking-page"))
    ) {
      continue;
    }
    const tab: SectionTab = {
      key: `svc-${s.service_id}`,
      label: getLocalizedServiceName(s, i18n.language ?? "de"),
      to,
      icon:
        s.service_slug === "social-ads"
          ? Megaphone
          : s.service_slug === "analytics"
            ? Eye
            : s.service_slug === "email"
              ? MailCheck
              : serviceIcon(s.service_icon),
    };
    ({ customers, deals, results, website } as Record<string, SectionTab[]>)[
      section === "today" ? "website" : section
    ].push(tab);
  }
  if (websiteSettings) website.push(websiteSettings);

  return [
    {
      key: "today",
      label: t("sections.today", "Today"),
      icon: Sun,
      to: "/",
      match: ["/"],
      tabs: [],
    },
    {
      key: "customers",
      label: t("sections.customers", "Customers"),
      icon: Inbox,
      to: "/lead-form",
      match: [
        "/lead-form",
        "/contacts",
        "/mail",
        "/campaigns",
        "/segments",
        "/email-templates",
        "/workflows",
        "/email",
        ...customers.map((c) => c.to),
      ],
      tabs: customers,
    },
    {
      key: "deals",
      label: t("sections.deals", "Deals"),
      icon: Briefcase,
      to: "/pipeline",
      match: [
        "/pipeline",
        "/tasks",
        ...(appointmentBook ? [] : ["/calendar", "/appointments", "/instructions"]),
        "/products",
        ...deals.map((d) => d.to.split("?")[0]),
      ],
      tabs: deals,
    },
    ...(appointmentBook
      ? [
          {
            key: "appointments" as const,
            label: t("sections.appointments", "Appointments"),
            icon: CalendarClock,
            to: "/appointments",
            match: ["/appointments", "/calendar", "/instructions"],
            tabs: appointments,
            pilot: true,
          },
        ]
      : []),
    {
      key: "results",
      label: t("sections.results", "Results"),
      icon: BarChart3,
      to: "/results",
      match: [
        "/results",
        "/openai-ads",
        "/social-ads",
        "/analytics",
        ...results.map((r) => r.to),
      ],
      tabs: results,
    },
    {
      key: "website",
      label: t("sections.website", "Website"),
      icon: Globe,
      to: showWebsite ? websiteHome : (website[0]?.to ?? "/forms"),
      match: [
        "/website",
        "/forms",
        "/ai-assistants",
        "/media",
        ...website.map((w) => w.to),
      ],
      tabs: website,
      children: websiteChildren,
      onSelect: showWebsite ? open(hasLive ? productionSite : stagingSite) : undefined,
    },
  ];
}

/** The section the current path belongs to, if any. */
export function activeSection(
  sections: NavSection[] | null,
  pathname: string,
): NavSection | null {
  if (!sections) return null;
  if (pathname === "/") return sections[0];
  return (
    sections
      .slice(1)
      .find((s) => pathMatches(pathname, s.match)) ?? null
  );
}

/**
 * Which nested entry is current: the one whose page is open, else — on the
 * section's other pages — the one they work on.
 */
export function activeChild(
  section: NavSection,
  pathname: string,
): SectionChild | null {
  const children = section.children ?? [];
  return (
    children.find((c) => pathname === c.to) ??
    children.find((c) => c.selected) ??
    null
  );
}

export function tabIsActive(tab: SectionTab, pathname: string) {
  return pathMatches(pathname, tab.match ?? [tab.to.split("?")[0]], tab.exact);
}
