import { useTranslation } from "react-i18next";
import { AtSign, Link2, ThumbsUp } from "lucide-react";
import type { EngineRates } from "~/lib/api/re-visible";
import { cn } from "~/lib/utils";
import { engineColor, engineLabel, formatPercent } from "./constants";

/**
 * One engine's card.
 *
 * The three numbers are deliberately separate, and in this order, because they
 * are three different things that clients routinely conflate:
 *
 *   Names you    — the answer said your name.
 *   Cites you    — the answer pointed at one of YOUR pages.
 *   Recommends   — the answer put you forward as a choice.
 *
 * An engine can name a brand while citing a directory instead of the brand's
 * own site, and it can cite a page without recommending the business. Collapsing
 * these into one "visibility score" is what makes most trackers useless for
 * deciding what to do next, so this card refuses to do it.
 */
export function EngineScoreCard({
  rates,
  className,
}: {
  rates: EngineRates;
  className?: string;
}) {
  const { t } = useTranslation();
  const accent = engineColor(rates.engine);
  const hasRuns = rates.runs_total > 0;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card p-4 sm:p-5",
        className,
      )}
    >
      {/* A hairline in the engine's colour, so the same engine is recognisable
          across the card, the chart and every table on the page. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: accent }}
      />

      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight">
          {engineLabel(rates.engine)}
        </h3>
        <span className="text-[11px] text-muted-foreground">
          {hasRuns
            ? t("wordpress.reVisible.runsCount", "{{count}} answers", {
                count: rates.runs_total,
              })
            : t("wordpress.reVisible.noRuns", "not asked yet")}
        </span>
      </div>

      <dl className="mt-4 space-y-3">
        <Metric
          icon={<AtSign className="size-3.5" aria-hidden />}
          label={t("wordpress.reVisible.namesYou", "Names you")}
          value={rates.mention_rate}
          hasRuns={hasRuns}
          accent={accent}
        />
        <Metric
          icon={<Link2 className="size-3.5" aria-hidden />}
          label={t("wordpress.reVisible.citesYou", "Cites your pages")}
          value={rates.citation_rate}
          hasRuns={hasRuns}
          accent={accent}
        />
        <Metric
          icon={<ThumbsUp className="size-3.5" aria-hidden />}
          label={t("wordpress.reVisible.recommendsYou", "Recommends you")}
          value={rates.recommendation_rate}
          hasRuns={hasRuns}
          accent={accent}
        />
      </dl>

      {hasRuns && rates.grounded_rate < 0.5 ? (
        <p className="mt-3 border-t pt-3 text-[11px] leading-relaxed text-muted-foreground">
          {t(
            "wordpress.reVisible.lowGrounded",
            "{{percent}} of these answers came from memory without searching, so citations were never possible.",
            { percent: formatPercent(1 - rates.grounded_rate) },
          )}
        </p>
      ) : null}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  hasRuns,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hasRuns: boolean;
  accent: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          {label}
        </dt>
        <dd className="text-sm font-semibold tabular-nums">
          {hasRuns ? formatPercent(value) : "—"}
        </dd>
      </div>
      {/* The bar is the comparison; the number is the value. Both, because the
          bar makes four cards scannable and the number is what gets quoted. */}
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${hasRuns ? Math.round(value * 100) : 0}%`,
            background: accent,
          }}
        />
      </div>
    </div>
  );
}
