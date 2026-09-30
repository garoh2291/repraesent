import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ListChecks } from "lucide-react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { getAlertFields, type AlertFieldRef } from "~/lib/api/inquiry-alerts";
import { humanizeMetaKey } from "~/lib/leads/field-label";
import { useAuthContext } from "~/providers/auth-provider";
import { ALWAYS_ITEMS, AlertItemList, SWITCH_ITEMS } from "./alert-coverage";

/** "Name, phone, where from" — the chosen fields as one readable line. */
export function useFieldSummary() {
  const { t } = useTranslation();
  return (fields: AlertFieldRef[]) => {
    if (!fields.length) return "—";
    const labels = fields.map((f) =>
      f.kind === "core"
        ? t(`settings.inquiryMessage.fields.${f.key}`)
        : f.kind === "all"
          ? t("settings.inquiryMessage.all.label")
          : humanizeMetaKey(f.key),
    );
    // No lower-casing: German nouns keep their capital.
    return labels.join(", ");
  };
}

/**
 * Team → Inquiry alerts: how many people hear about a new inquiry, what the
 * switch gives them, what always goes out, and the way into "What the
 * inquiry message shows". The switches themselves stay in the member list.
 */
export function InquiryAlertsOverview({
  members,
}: {
  members: Array<{ lead_notification?: boolean | null }>;
}) {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const summarize = useFieldSummary();

  const { data: config } = useQuery({
    queryKey: ["inquiry-alerts", currentWorkspace?.id],
    queryFn: getAlertFields,
    enabled: !!currentWorkspace?.id,
  });

  const total = members.length;
  const on = members.filter((m) => m.lead_notification).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2.5 px-5 py-3.5">
        {on === 0 && total > 0 ? (
          <p className="text-sm text-foreground">
            <span className="marker font-medium">
              {t("settings.inquiryAlerts.noneOn")}
            </span>
          </p>
        ) : (
          <>
            <span
              className="size-2 shrink-0 rounded-full bg-foreground"
              aria-hidden
            />
            <p className="num text-sm font-medium text-foreground">
              {t("settings.inquiryAlerts.countOn", { on, count: total })}
            </p>
          </>
        )}
      </div>

      <div className="grid gap-5 border-t border-border px-5 py-4 md:grid-cols-2 md:gap-8">
        <AlertItemList
          label={t("settings.inquiryAlerts.switchOnLabel")}
          items={SWITCH_ITEMS}
        />
        <AlertItemList
          label={t("settings.inquiryAlerts.alwaysLabel")}
          items={ALWAYS_ITEMS}
          muted
        />
      </div>

      <Link
        to="/settings/team/inquiry-message"
        prefetch="intent"
        className="press group flex min-h-14 items-center gap-3 border-t border-border px-5 py-3 transition-colors hover:bg-muted/50 active:bg-muted"
      >
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted"
          aria-hidden
        >
          <ListChecks className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium text-foreground">
            {t("settings.inquiryAlerts.messageRow")}
          </span>
          <span className="block truncate text-[13px] text-muted-foreground">
            {config ? summarize(config.fields) : " "}
          </span>
        </span>
        {config ? (
          <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground max-sm:hidden">
            {config.customised
              ? t("settings.inquiryAlerts.customBadge")
              : t("settings.inquiryAlerts.standardBadge")}
          </span>
        ) : null}
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
          aria-hidden
        />
      </Link>

      <p className="border-t border-border bg-muted/30 px-5 py-3 text-[13px] text-muted-foreground">
        {t("settings.inquiryAlerts.summariesNote")}{" "}
        <Link
          to="/settings/email-notifications"
          className="font-medium text-foreground underline decoration-border underline-offset-[3px] hover:decoration-foreground"
        >
          {t("settings.navLabels.emailSummaries")}
        </Link>
      </p>
    </div>
  );
}
