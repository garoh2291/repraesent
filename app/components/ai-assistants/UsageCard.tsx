import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Panel, PanelBody, PanelHeader } from "~/components/forms/chrome";
import { AdvancedSection } from "~/components/notebook/advanced-section";
import { Activity, ThumbsDown, ThumbsUp } from "lucide-react";
import { useAiUsage, useChatModels } from "~/lib/hooks/useAiAssistants";
import type { AssistantUsageToday } from "~/lib/api/ai-assistants";
import { formatEurFromMicroUsd } from "~/lib/api/ai-assistants";

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/**
 * Today at a glance, plus thirty days of message volume as a bar strip. Pure
 * divs, not Recharts: four numbers and thirty bars need no axis machinery,
 * and this stays crisp inside a 340px column. Tokens and the per-model split
 * mean nothing to an owner — they live under Advanced for whoever pays the
 * AI bill.
 */
export function UsageCard({
  assistantId,
  today,
}: {
  assistantId: string;
  today: AssistantUsageToday;
}) {
  const { t, i18n } = useTranslation();
  const { data: usage } = useAiUsage(assistantId, 30);
  const { data: models } = useChatModels();
  const days = usage?.days;

  const bars = useMemo(() => {
    const list = days ?? [];
    const max = Math.max(1, ...list.map((d) => d.messages));
    return list.map((d) => ({
      day: d.day,
      messages: d.messages,
      leads: d.leads,
      height: Math.max(d.messages > 0 ? 6 : 2, (d.messages / max) * 100),
    }));
  }, [days]);

  const total30 = bars.reduce((s, b) => s + b.messages, 0);
  const up30 = (days ?? []).reduce((s, d) => s + (d.feedback_up ?? 0), 0);
  const down30 = (days ?? []).reduce((s, d) => s + (d.feedback_down ?? 0), 0);
  const unanswered30 = (days ?? []).reduce(
    (s, d) => s + (d.unanswered ?? 0),
    0,
  );
  const modelLabel = (id: string) =>
    models?.models.find((m) => m.id === id)?.label ?? id;
  // Spend is shown in the same currency as the budget field that caps it — a
  // "€5/day" limit beside "$0.03 spent" reads as a bug.
  const eur = (micro: number) => formatEurFromMicroUsd(micro, models?.usd_per_eur ?? 1.08);

  const stats: Array<{ label: string; value: string }> = [
    { label: t("aiAssistants.usage.messages"), value: compact(today.messages) },
    { label: t("aiAssistants.usage.blocked"), value: compact(today.blocked) },
    { label: t("aiAssistants.usage.inquiries"), value: compact(today.leads) },
    {
      label: t("aiAssistants.usage.spent"),
      value: eur(today.cost_micro_usd),
    },
  ];

  return (
    <Panel>
      <PanelHeader
        icon={<Activity className="h-3.5 w-3.5" />}
        title={t("aiAssistants.usage.title")}
        meta={
          <span className="text-[11px] text-muted-foreground/70">
            {t("aiAssistants.usage.today")}
          </span>
        }
      />
      <PanelBody className="space-y-4">
        {/* Two by two: the card lives in a narrow sidebar, and four columns
            cut "Spent (estimate)" — and every German label — in half. */}
        <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <dd className="truncate text-base font-semibold tabular-nums tracking-tight">
                {s.value}
              </dd>
              <dt className="text-[11px] leading-tight text-muted-foreground">
                {s.label}
              </dt>
            </div>
          ))}
        </dl>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
            <span>{t("aiAssistants.usage.last30")}</span>
            <span className="tabular-nums">
              {t("aiAssistants.usage.messagesCount", { count: total30 })}
            </span>
          </div>
          <div
            className="flex h-12 items-end gap-[2px]"
            role="img"
            aria-label={t("aiAssistants.usage.last30")}
          >
            {bars.length === 0
              ? Array.from({ length: 30 }).map((_, i) => (
                  <span
                    key={i}
                    className="flex-1 rounded-sm bg-muted"
                    style={{ height: 2 }}
                  />
                ))
              : bars.map((b) => (
                  <span
                    key={b.day}
                    title={`${new Date(b.day).toLocaleDateString(i18n.language, { day: "2-digit", month: "short" })} · ${b.messages}`}
                    className={
                      b.leads > 0
                        ? "flex-1 rounded-sm bg-emerald-500/80"
                        : "flex-1 rounded-sm bg-foreground/60"
                    }
                    style={{ height: `${b.height}%` }}
                  />
                ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span
              className="inline-flex items-center gap-1 tabular-nums"
              title={t("aiAssistants.usage.thumbsUp")}
            >
              <ThumbsUp className="h-3 w-3" aria-hidden />
              {up30}
            </span>
            <span
              className="inline-flex items-center gap-1 tabular-nums"
              title={t("aiAssistants.usage.thumbsDown")}
            >
              <ThumbsDown className="h-3 w-3" aria-hidden />
              {down30}
            </span>
            <span className="tabular-nums">
              {t("aiAssistants.usage.unanswered", { count: unanswered30 })}
            </span>
          </div>
        </div>

        <AdvancedSection
          storageKey="ai-usage"
          hint={t("aiAssistants.usage.advancedHint")}
        >
          <p className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              {t("aiAssistants.usage.tokensToday")}
            </span>
            <span className="tabular-nums">
              {compact(today.tokens_in + today.tokens_out)}
            </span>
          </p>
          {usage && usage.models.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground">
                {t("aiAssistants.usage.byModel")}
              </p>
              <ul className="space-y-1">
                {usage.models.map((m) => (
                  <li
                    key={m.model}
                    className="flex items-baseline justify-between gap-2 text-xs"
                  >
                    <span className="truncate" title={m.model}>
                      {modelLabel(m.model)}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {compact(m.messages)} ·{" "}
                      {compact(m.tokens_in + m.tokens_out)} tok ·{" "}
                      {eur(m.cost_micro_usd)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </AdvancedSection>
      </PanelBody>
    </Panel>
  );
}
