import {
  History,
  AtSign,
  Building,
  Network,
  BellRing,
  CalendarDays,
  Headset,
  Inbox,
  Kanban,
  MailCheck,
  Plug,
  Reply,
  Rocket,
  Smartphone,
  Sparkles,
  Store,
  User,
  Users,
} from "lucide-react";
import { OpenAiMark } from "~/components/icons/openai-mark";

/**
 * The settings sub-navigation.
 *
 * Labels in the notebook voice (PRODUCT_DIRECTION.md): what the page is for, in
 * the owner's words — "Team", "Deal stages", not "Area Settings". Order matches
 * the old tabs.
 */
/**
 * A person's own set-up inside a business (their mailbox, calendar, email
 * copies, summaries, phone alerts). Hidden for agency people who opened the
 * business through their agency: they are not its members and get no alerts
 * there (AGENCY_MODE_PLAN.md decisions).
 */
export const PERSONAL_SETTINGS = new Set([
  "/settings/email-accounts",
  "/settings/calendars",
  "/settings/bcc",
  "/settings/email-notifications",
  "/settings/phone-alerts",
]);

export const SETTINGS_NAV = [
  { to: "/settings/profile", labelKey: "settings.navLabels.profile", Icon: User, group: "you" },
  { to: "/settings/team", labelKey: "settings.navLabels.team", Icon: Users, group: "workspace" },
  {
    to: "/settings/business-profile",
    labelKey: "settings.navLabels.businessDetails",
    Icon: Store,
    group: "workspace",
  },
  // Activity log: admins only (use-nav-model.ts).
  {
    to: "/settings/activity",
    labelKey: "settings.navLabels.activity",
    Icon: History,
    group: "workspace",
  },
  // Agency mode: a business's own admins ask for it here; an agency sees its
  // limit here (use-nav-model.ts decides who sees it).
  {
    to: "/settings/agency",
    labelKey: "settings.navLabels.agency",
    Icon: Network,
    group: "workspace",
  },
  {
    to: "/settings/email-accounts",
    labelKey: "settings.tabs.emailAccounts",
    Icon: AtSign,
    group: "connections",
  },
  {
    to: "/settings/calendars",
    labelKey: "settings.tabs.calendars",
    Icon: CalendarDays,
    group: "connections",
  },
  { to: "/settings/bcc", labelKey: "settings.navLabels.emailCopies", Icon: Inbox, group: "connections" },
  // Only for workspaces with our mail service (use-nav-model.ts).
  {
    to: "/settings/confirmation-emails",
    labelKey: "settings.navLabels.confirmationEmails",
    Icon: Reply,
    group: "connections",
  },
  {
    to: "/settings/integrations",
    labelKey: "settings.navLabels.connectedApps",
    Icon: Plug,
    group: "connections",
  },
  {
    to: "/settings/openai-ads",
    labelKey: "settings.tabs.openaiAds",
    Icon: OpenAiMark,
    group: "connections",
  },
  {
    to: "/settings/ai",
    labelKey: "settings.navLabels.aiKey",
    Icon: Sparkles,
    group: "connections",
  },
  {
    to: "/settings/email-notifications",
    labelKey: "settings.navLabels.emailSummaries",
    Icon: MailCheck,
    group: "alerts",
  },
  {
    to: "/settings/phone-alerts",
    labelKey: "settings.navLabels.phoneAlerts",
    Icon: Smartphone,
    group: "alerts",
  },
  {
    to: "/settings/notifications",
    labelKey: "settings.navLabels.teamChat",
    Icon: BellRing,
    group: "alerts",
  },
  {
    to: "/settings/pipelines",
    labelKey: "settings.navLabels.dealStages",
    Icon: Kanban,
    group: "sales",
  },
  {
    to: "/settings/onboarding",
    labelKey: "settings.tabs.onboarding",
    Icon: Rocket,
    group: "root",
  },
  {
    to: "/settings/support",
    labelKey: "settings.tabs.support",
    Icon: Headset,
    group: "root",
  },
  {
    to: "/settings/agencies",
    labelKey: "settings.navLabels.agencies",
    Icon: Building,
    group: "root",
  },
] as const;

export const SETTINGS_GROUPS = [
  { key: "you", labelKey: "sections.settingsGroups.you", fallback: "You" },
  { key: "workspace", labelKey: "sections.settingsGroups.workspace", fallback: "Your business" },
  { key: "connections", labelKey: "sections.settingsGroups.connections", fallback: "Connections" },
  { key: "alerts", labelKey: "sections.settingsGroups.alerts", fallback: "Updates" },
  { key: "sales", labelKey: "sections.settingsGroups.sales", fallback: "Deals" },
  { key: "root", labelKey: "sections.settingsGroups.root", fallback: "re:praesent" },
] as const;
