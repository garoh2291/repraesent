import {
  AtSign,
  BellRing,
  CalendarDays,
  Headset,
  Inbox,
  Kanban,
  MailCheck,
  Plug,
  Rocket,
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
export const SETTINGS_NAV = [
  { to: "/settings/profile", labelKey: "settings.navLabels.profile", Icon: User, group: "you" },
  { to: "/settings/team", labelKey: "settings.navLabels.team", Icon: Users, group: "workspace" },
  {
    to: "/settings/business-profile",
    labelKey: "settings.navLabels.businessDetails",
    Icon: Store,
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
] as const;

export const SETTINGS_GROUPS = [
  { key: "you", labelKey: "sections.settingsGroups.you", fallback: "You" },
  { key: "workspace", labelKey: "sections.settingsGroups.workspace", fallback: "Your business" },
  { key: "connections", labelKey: "sections.settingsGroups.connections", fallback: "Connections" },
  { key: "alerts", labelKey: "sections.settingsGroups.alerts", fallback: "Updates" },
  { key: "sales", labelKey: "sections.settingsGroups.sales", fallback: "Deals" },
  { key: "root", labelKey: "sections.settingsGroups.root", fallback: "re:praesent" },
] as const;
