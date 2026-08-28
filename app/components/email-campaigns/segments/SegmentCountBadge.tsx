import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

/**
 * "1,240 matched · 1,010 sendable" with a popover explaining the gap. The gap
 * is the consent story (opt-in × suppression × missing email), and showing it
 * beats a silent shrink at send time.
 */
export function SegmentCountBadge({
  matched,
  sendable,
  loading,
}: {
  matched: number | null;
  sendable: number | null;
  loading?: boolean;
}) {
  const { t, i18n } = useTranslation();

  if (loading) {
    return (
      <span className="text-xs text-muted-foreground">
        {t("emailCampaigns.segments.counting", { defaultValue: "Counting…" })}
      </span>
    );
  }
  if (matched === null || sendable === null) {
    return (
      <span className="text-xs text-muted-foreground">
        {t("emailCampaigns.segments.notCounted", { defaultValue: "—" })}
      </span>
    );
  }

  const fmt = (value: number) => value.toLocaleString(i18n.language);
  const gap = matched - sendable;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="font-medium">
        {t("emailCampaigns.segments.matched", {
          defaultValue: "{{count}} matched",
          count: matched,
          countFormatted: fmt(matched),
        })}
      </span>
      <span className="text-muted-foreground">·</span>
      <span
        className={
          sendable === 0
            ? "font-medium text-destructive"
            : "font-medium text-emerald-600 dark:text-emerald-400"
        }
      >
        {t("emailCampaigns.segments.sendable", {
          defaultValue: "{{count}} sendable",
          count: sendable,
          countFormatted: fmt(sendable),
        })}
      </span>
      {gap > 0 ? (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t("emailCampaigns.segments.gapWhy", {
                defaultValue: "Why fewer sendable?",
              })}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted"
            >
              <Info className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 text-xs leading-relaxed">
            {t("emailCampaigns.segments.gapExplainer", {
              defaultValue:
                "Sendable excludes contacts without an email address and anyone who unsubscribed. Campaigns only email sendable contacts.",
            })}
          </PopoverContent>
        </Popover>
      ) : null}
    </span>
  );
}
