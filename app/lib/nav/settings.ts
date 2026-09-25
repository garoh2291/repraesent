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
 * Labels reuse the keys the deleted tab strip used, so all four locales already
 * have them. Order matches the old tabs.
 */
export const SETTINGS_NAV = [
  { to: "/settings/profile", labelKey: "settings.tabs.profile", Icon: User, group: "you" },
  { to: "/settings/team", labelKey: "settings.tabs.areaSettings", Icon: Users, group: "workspace" },
  {
    to: "/settings/business-profile",
    labelKey: "settings.tabs.businessProfile",
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
  { to: "/settings/bcc", labelKey: "settings.tabs.bcc", Icon: Inbox, group: "connections" },
  {
    to: "/settings/integrations",
    labelKey: "settings.tabs.integrations",
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
    labelKey: "settings.tabs.ai",
    Icon: Sparkles,
    group: "connections",
  },
  {
    to: "/settings/email-notifications",
    labelKey: "settings.tabs.emailNotifications",
    Icon: MailCheck,
    group: "alerts",
  },
  {
    to: "/settings/notifications",
    labelKey: "settings.tabs.notifications",
    Icon: BellRing,
    group: "alerts",
  },
  {
    to: "/settings/pipelines",
    labelKey: "settings.tabs.pipelines",
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
  { key: "workspace", labelKey: "sections.settingsGroups.workspace", fallback: "Workspace" },
  { key: "connections", labelKey: "sections.settingsGroups.connections", fallback: "Connections" },
  { key: "alerts", labelKey: "sections.settingsGroups.alerts", fallback: "Alerts" },
  { key: "sales", labelKey: "sections.settingsGroups.sales", fallback: "Sales" },
  { key: "root", labelKey: "sections.settingsGroups.root", fallback: "re:praesent" },
] as const;
