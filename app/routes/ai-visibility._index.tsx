import { useState } from "react";
import { Link, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, ListTodo, MessageSquareQuote, Radar } from "lucide-react";
import { useAiVisibilityAnswer, useAiVisibilityAnswers, useAiVisibilityOverview } from "~/lib/hooks/useAiVisibility";
import { cn } from "~/lib/utils";
import { Panel, PanelHeader } from "~/components/notebook/panel";
import { EmptyState } from "~/components/notebook/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { useAiVisibilityContext } from "~/components/ai-visibility/context";
import { AnswerText, highlightsFor } from "~/components/ai-visibility/answer-text";
import { AnswerSheet } from "~/components/ai-visibility/answer-sheet";
import { AnswerList } from "~/components/ai-visibility/answer-list";
import { TrendChart } from "~/components/ai-visibility/trend-chart";
import { Impact } from "~/components/ai-visibility/impact";
import { Bar, Delta, EngineMark, Explain, num, pct, rank, shortDate, useDomainTypeLabel, useFilters, useToneWord } from "~/components/ai-visibility/shared";

/**
 * The first screen: one sentence, four numbers, what to do next — then the
 * proof (the chart, the ranking, a real answer). Everything deeper is one tab away.
 */
export default function AiVisibilityOverview() {
  const { t } = useTranslation();
  const { state } = useAiVisibilityContext();
  const [filters] = useFilters();
  const q = useAiVisibilityOverview(filters);
  const latest = useAiVisibilityAnswers({ ...filters, limit: 6, offset: 0 });
  const [openId, setOpenId] = useState<string | null>(null);
  const toneWord = useToneWord();
  const typeLabel = useDomainTypeLabel();
  const { search } = useLocation();
  const d = q.data;

  if (!d) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const own = d.own;
  const prev = d.previous;
  const nothing = d.answers === 0;
  const running = !!state.latest_batch?.running;

  return (
    <div className={cn("space-y-6 transition-opacity", q.isFetching && q.isPlaceholderData && "opacity-60")}>
      {/* The sentence */}
      <Panel className="p-5 sm:p-7">
        {nothing ? (
          <EmptyState
            className="p-0 sm:p-0"
            icon={<Radar />}
            title={
              running
                ? t("aiVisibility.overview.firstComing", "The first answers are on their way.")
                : t("aiVisibility.overview.noAnswers", "No answers in this period yet.")
            }
            body={
              running
                ? t("aiVisibility.overview.firstComingBody", "Numbers appear here as each assistant answers. A full run takes a few minutes.")
                : t("aiVisibility.overview.noAnswersBody", "Answers are collected on every run day. Pick a longer period, or start a run now.")
            }
          />
        ) : (
          <>
            <p className="title-display max-w-4xl text-[21px] font-medium leading-snug text-foreground sm:text-[27px]">
              {t(`aiVisibility.overview.lead.${d.period}`, "In the last 7 days,")}{" "}
              {t("aiVisibility.overview.sentenceA", "AI assistants named {{brand}} in", { brand: state.project.brand_name })}{" "}
              <span className={cn("font-semibold", (own.visibility ?? 0) > 0 && "marker")}>{pct(own.visibility)}</span>{" "}
              {t("aiVisibility.overview.sentenceB", "of {{n}} answers", { n: num(d.answers) })}
              {own.rank && d.brands_count > 1 ? (
                <>
                  {" — "}
                  <strong className="font-semibold">
                    {t("aiVisibility.overview.rankOf", "{{rank}} of {{total}} brands you compare", {
                      rank: t(`aiVisibility.ordinal.${Math.min(own.rank, 10)}`, `#${own.rank}`),
                      total: d.brands_count,
                    })}
                  </strong>
                </>
              ) : null}
              .
            </p>

            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-border pt-6 sm:grid-cols-4">
              <Metric
                label={t("aiVisibility.metric.visibility", "Named in")}
                value={pct(own.visibility)}
                delta={<Delta cur={own.visibility} prev={prev.visibility} kind="pp" />}
                help={t(
                  "aiVisibility.metric.visibilityHelp",
                  "Share of answers that mention you by name. Industry name: visibility. The single most important number here.",
                )}
              />
              <Metric
                label={t("aiVisibility.metric.position", "Average place")}
                value={rank(own.position)}
                delta={<Delta cur={own.position} prev={prev.position} kind="units" lowerIsBetter />}
                help={t(
                  "aiVisibility.metric.positionHelp",
                  "When you are named: where, counting every business in the answer. #1 means named first. Industry name: position.",
                )}
              />
              <Metric
                label={t("aiVisibility.metric.tone", "How you're described")}
                value={own.tone == null ? "—" : toneWord(own.tone)}
                sub={own.tone == null ? null : `${own.tone}/100`}
                delta={<Delta cur={own.tone} prev={prev.tone} kind="units" />}
                help={t(
                  "aiVisibility.metric.toneHelp",
                  "The tone of answers that name you, from 0 (negative) to 100 (glowing); 50 is neutral. Most businesses sit between 65 and 85. Industry name: sentiment.",
                )}
              />
              <Metric
                label={t("aiVisibility.metric.share", "Share of mentions")}
                value={pct(own.share_of_voice)}
                delta={<Delta cur={own.share_of_voice} prev={prev.share_of_voice} kind="pp" />}
                help={t(
                  "aiVisibility.metric.shareHelp",
                  "Of all the times you and your tracked competitors are mentioned, how many are you. Industry name: share of voice.",
                )}
              />
            </div>
            <p className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-muted-foreground">
              {own.recommended != null ? (
                <span>{t("aiVisibility.overview.recommended", "Recommended you in {{p}} of answers", { p: pct(own.recommended) })}</span>
              ) : null}
              {d.cited_not_named > 0 ? (
                <span>{t("aiVisibility.overview.citedNotNamed", "Read your website without naming you: {{n}}×", { n: d.cited_not_named })}</span>
              ) : null}
              {d.failed > 0 ? <span>{t("aiVisibility.overview.failed", "{{n}} questions could not be asked (not counted)", { n: d.failed })}</span> : null}
            </p>
          </>
        )}
      </Panel>

      {/* What to do next */}
      {d.actions.length ? (
        <Panel>
          <PanelHeader
            title={t("aiVisibility.overview.nextTitle", "What to do next")}
            count={d.actions.length}
            marker
            action={
              <Link to={`/ai-visibility/actions${search}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-foreground hover:underline">
                {t("aiVisibility.overview.allActions", "All")}
                <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <ul className="divide-y divide-border">
            {d.actions.map((a) => (
              <li key={a.id}>
                <Link to={`/ai-visibility/actions${search}#${a.id}`} className="flex items-start gap-3 px-4 py-3.5 hover:bg-foreground/[0.025] sm:px-5">
                  <Impact value={a.impact} className="mt-1.5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-medium text-foreground">{a.title}</span>
                    <span className="mt-0.5 line-clamp-2 block text-[13px] text-muted-foreground">{a.why}</span>
                  </span>
                  {a.task_id ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-marker-soft px-2 py-0.5 text-[11px] font-medium text-marker-ink">
                      <ListTodo className="size-3" aria-hidden />
                      {a.task_assignee_name
                        ? t("aiVisibility.actions.task.chipAssigned", "Task · {{name}}", { name: a.task_assignee_name })
                        : t("aiVisibility.actions.task.label", "Task")}
                    </span>
                  ) : a.status === "in_progress" ? (
                    <span className="shrink-0 rounded-full bg-marker-soft px-2 py-0.5 text-[11px] font-medium text-marker-ink">
                      {t("aiVisibility.actions.status.in_progress", "In progress")}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {!nothing ? (
        <>
          {/* You vs competitors */}
          <Panel>
            <PanelHeader
              title={t("aiVisibility.overview.vsTitle", "You and your competitors")}
              hint={t("aiVisibility.overview.vsHint", "share of answers naming each brand")}
            />
            <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-[1.4fr_1fr]">
              <TrendChart trend={d.trend} brands={d.brands} />
              <ol className="space-y-2.5">
                {d.brands.slice(0, 8).map((b, i) => (
                  <li key={b.key} className="grid grid-cols-[1.25rem_1fr_3.25rem] items-center gap-x-2.5 gap-y-1">
                    <span className="num text-[12px] text-muted-foreground">{i + 1}</span>
                    <span className={cn("flex min-w-0 items-center gap-1.5 text-[13.5px]", b.is_own ? "font-semibold text-foreground" : "text-foreground/85")}>
                      {!b.is_own ? <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: b.color ?? "#9a9a9a" }} aria-hidden /> : null}
                      <span className={cn("truncate", b.is_own && "marker")}>{b.name}</span>
                    </span>
                    <span className="num text-right text-[13px] text-foreground">{pct(b.visibility)}</span>
                    <span />
                    <Bar value={b.visibility} own={b.is_own} color={b.color} className="col-span-2" />
                  </li>
                ))}
              </ol>
            </div>
            <div className="border-t border-border px-4 py-2.5 text-right sm:px-5">
              <Link to={`/ai-visibility/competitors${search}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-foreground hover:underline">
                {t("aiVisibility.overview.allCompetitors", "Compare in detail")}
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* By assistant */}
            <Panel>
              <PanelHeader title={t("aiVisibility.overview.byEngine", "By assistant")} />
              <ul className="divide-y divide-border">
                {d.engines.map((e) => (
                  <li key={e.engine} className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-3 px-4 py-3 sm:px-5">
                    <EngineMark engine={e.engine} className="text-[13.5px] font-medium text-foreground" />
                    <span className="min-w-0">
                      <Bar value={e.visibility} own />
                      <span className="mt-1 block text-[11.5px] text-muted-foreground">
                        {e.answers
                          ? t("aiVisibility.overview.engineLine", "{{n}} answers · place {{rank}}", { n: e.answers, rank: rank(e.position) })
                          : t("aiVisibility.overview.engineNone", "no answers yet")}
                        {e.failed ? ` · ${t("aiVisibility.overview.engineFailed", "{{n}} failed", { n: e.failed })}` : ""}
                      </span>
                    </span>
                    <span className="num text-right text-[14px] font-semibold text-foreground">{pct(e.visibility)}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            {/* Top sources */}
            <Panel>
              <PanelHeader
                title={t("aiVisibility.overview.sourcesTitle", "Websites the assistants read most")}
                action={
                  <Link to={`/ai-visibility/sources${search}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-foreground hover:underline">
                    {t("aiVisibility.overview.allSources", "All")}
                    <ArrowRight className="size-3.5" />
                  </Link>
                }
              />
              {d.top_sources.length ? (
                <ul className="divide-y divide-border">
                  {d.top_sources.map((s) => (
                    <li key={s.domain} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-foreground">{s.domain}</span>
                        <span className="block text-[11.5px] text-muted-foreground">{typeLabel(s.owner ?? s.type)}</span>
                      </span>
                      <span className="num text-right text-[13px] text-foreground">{pct(s.used_pct)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact title={t("aiVisibility.overview.noSources", "No websites cited yet.")} />
              )}
            </Panel>
          </div>
        </>
      ) : null}

      <LatestQuote onOpen={setOpenId} />

      {latest.data?.items.length ? (
        <Panel>
          <PanelHeader
            title={t("aiVisibility.overview.latestTitle", "Latest answers")}
            action={
              <Link to={`/ai-visibility/answers${search}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-foreground hover:underline">
                {t("aiVisibility.overview.allAnswers", "All")}
                <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <AnswerList items={latest.data.items} onOpen={setOpenId} />
        </Panel>
      ) : null}

      <AnswerSheet answerId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function Metric({ label, value, sub, delta, help }: { label: string; value: string; sub?: string | null; delta?: React.ReactNode; help: string }) {
  return (
    <div className="min-w-0">
      <p className="title-display num truncate text-[28px] font-semibold text-foreground sm:text-[34px]">{value}</p>
      <p className="mt-1 flex items-center gap-1 text-[13px] text-muted-foreground">
        {label}
        <Explain>{help}</Explain>
      </p>
      <p className="mt-0.5 flex min-h-[18px] items-center gap-2 text-[12px] text-muted-foreground">
        {sub ? <span className="num">{sub}</span> : null}
        {delta}
      </p>
    </div>
  );
}

/**
 * The most recent answer that named the business, quoted with the
 * highlighter — the proof behind the numbers above.
 */
function LatestQuote({ onOpen }: { onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  const { state } = useAiVisibilityContext();
  const [filters] = useFilters();
  const named = useAiVisibilityAnswers({ ...filters, mentioned: "yes", limit: 1, offset: 0 });
  const first = named.data?.items[0] ?? null;
  const detail = useAiVisibilityAnswer(first?.id ?? null);
  const a = detail.data;
  if (!first || !a?.answer_text) return null;

  return (
    <Panel className="overflow-hidden">
      <div className="flex items-start gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <p className="text-[12px] text-muted-foreground">
            <EngineMark engine={a.engine} className="font-medium text-foreground" /> · {shortDate(a.run_date)} ·{" "}
            {t("aiVisibility.overview.quoteAsked", "someone asked")}
          </p>
          <p className="mt-0.5 text-[15px] font-medium text-foreground">“{a.prompt}”</p>
        </div>
      </div>
      <div className="px-4 py-4 sm:px-5">
        <AnswerText
          text={a.answer_text}
          clampLines={9}
          highlights={highlightsFor({
            brandName: state.project.brand_name,
            brandAliases: state.project.brand_aliases,
            competitors: state.competitors,
            mentions: a.mentions,
          })}
        />
        <button
          type="button"
          onClick={() => onOpen(a.id)}
          className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
        >
          {t("aiVisibility.overview.readAll", "Read the whole answer and its sources")}
          <ArrowRight className="size-3.5" />
        </button>
      </div>
    </Panel>
  );
}
