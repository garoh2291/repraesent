import { CalendarCheck, ClipboardList, Clock, Mail, MessageCircleQuestion, Smartphone } from "lucide-react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";

/**
 * What the per-person "Inquiry alerts" switch actually turns on, and what
 * goes out regardless (INQUIRY_ALERTS.md). Mirrors the backend truthfully:
 *
 * switch on → new-inquiry email (leads.service notifyMembersOfNewLead),
 *   phone alert (phone-alerts raiseInquiry, also needs the phone set up),
 *   booking email (appointments), website-chat gaps email (gaps-digest).
 * always → task given (tasks.service), task due within 24h (due-soon cron).
 *
 * Shared by Team and Email summaries so both pages say the same thing.
 */

type Item = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Optional link: the setting that item depends on. */
  to?: string;
};

export const SWITCH_ITEMS: Item[] = [
  { key: "inquiryEmail", icon: Mail },
  { key: "phone", icon: Smartphone, to: "/settings/phone-alerts" },
  { key: "booking", icon: CalendarCheck },
  { key: "chatGaps", icon: MessageCircleQuestion },
];

export const ALWAYS_ITEMS: Item[] = [
  { key: "taskGiven", icon: ClipboardList },
  { key: "taskDue", icon: Clock },
];

export function AlertItemList({
  label,
  items,
  muted = false,
}: {
  label: string;
  items: Item[];
  /** The "always" group reads quieter — it is context, not the switch. */
  muted?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      <ul className="space-y-1.5">
        {items.map(({ key, icon: Icon, to }) => {
          const text = t(`settings.inquiryAlerts.items.${key}`);
          return (
            <li key={key} className="flex items-start gap-2.5 text-[14px] leading-5">
              <span
                className={cn(
                  "mt-px flex size-5 shrink-0 items-center justify-center rounded-md",
                  muted ? "text-muted-foreground" : "bg-muted text-foreground",
                )}
                aria-hidden
              >
                <Icon className="size-3.5" />
              </span>
              {to ? (
                <Link
                  to={to}
                  className={cn(
                    "underline decoration-border underline-offset-[3px] hover:decoration-foreground",
                    muted ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {text}
                </Link>
              ) : (
                <span className={muted ? "text-muted-foreground" : "text-foreground"}>{text}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
