import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

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
      {/*
        A tooltip, not a popover. The content is a sentence of explanation with
        nothing to interact with, so it should appear on hover and on keyboard
        focus rather than demanding a click.

        The click handler is what makes it usable at all: this badge renders
        inside the segment card's <Link> (and inside the wizard's audience
        button), so clicking the icon used to navigate away instead of showing
        anything — which is why it read as dead.
      */}
      {gap > 0 ? (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={t("emailCampaigns.segments.gapWhy", {
                  defaultValue: "Why fewer sendable?",
                })}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-72 text-xs leading-relaxed">
              {t("emailCampaigns.segments.gapExplainer", {
                defaultValue:
                  "Sendable excludes contacts without an email address and anyone who unsubscribed. Campaigns only email sendable contacts.",
              })}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </span>
  );
}
