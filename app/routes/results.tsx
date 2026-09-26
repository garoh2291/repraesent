import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, Plug } from "lucide-react";
import i18n from "~/i18n";
import { cn } from "~/lib/utils";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { useResultsSummary } from "~/lib/hooks/useResultsSummary";
import type { AiVisibilitySummary, Funnel, ResultPeriod, SourceBucket } from "~/lib/api/results";
import { usePilotFeatures } from "~/lib/feature-flags";
import { durationWords } from "~/lib/utils/duration-words";
import { formatCurrency, formatNumber } from "~/lib/utils/format";
import { PageContainer, PageHeader } from "~/components/notebook/page-header";
import { Panel, PanelHeader } from "~/components/notebook/panel";
import { EmptyState } from "~/components/notebook/empty-state";
import { Stat } from "~/components/notebook/stat";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import {
  DealsSummarySection,
  LeadAnalyticsChart,
} from "~/components/business/overview-sections";

export function meta() {
  return [
    { title: i18n.t("results.metaTitle", "Results") + " - Repraesent" },
    { name: "description", content: i18n.t("results.metaDescription", "") },
  ];
}

const PERIODS: ResultPeriod[] = ["7d", "30d", "90d", "12m"];

function delta(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || prev === 0) return null;
  return (cur - prev) / prev;
}

/** Under five answered inquiries, a "usually" would not be true. */
const FIRST_REPLY_MIN_SAMPLE = 5;

const CONNECT: Partial<Record<SourceBucket, string>> = {
  google: "/social-ads",
  facebook: "/social-ads",
  instagram: "/social-ads",
  openai: "/openai-ads",
  ai_assistants: "/ai-visibility",
  chat: "/ai-assistants",
  website: "/forms",
};

/**
 * "What is this doing for me?" in the owner's words (NOTEBOOK_UX_PLAN.md §6):
 * one sentence first, then where people came from. The deep analytics pages
 * stay one tab away.
 */
export default function ResultsPage() {
  const { t, i18n: i18nInstance } = useTranslation();
  const pilot = usePilotFeatures();
  useDocumentMeta({ titleKey: "results.metaTitle", titleSuffix: " - Repraesent" });
  const [period, setPeriod] = useState<ResultPeriod>("30d");
  const q = useResultsSummary(period);
  const data = q.data && q.data.supported ? q.data : null;

  const money = (v: number) => formatCurrency(v, data?.currency ?? "EUR");
  const f: Funnel | null = data?.funnel ?? null;
  const p: Funnel | null = data?.previous ?? null;
  const nothing =
    !!f &&
    !f.people_saw &&
    f.contacted === 0 &&
    f.new_customers === 0 &&
    f.earned === 0;

  return (
    <PageContainer className="space-y-6 sm:space-y-8">
      <PageHeader
        title={t("results.title", "Results")}
        subtitle={t("results.subtitle", "How many people found you, reached out and became customers.")}
        actions={
          <div
            role="tablist"
            aria-label={t("results.period", "Period")}
            className="inline-flex rounded-lg border border-border bg-card p-0.5"
          >
            {PERIODS.map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={period === k}
                onClick={() => setPeriod(k)}
                className={cn(
                  "num rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                  period === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`results.periods.${k}`)}
              </button>
            ))}
          </div>
        }
      />

      {q.isError || (q.data && !q.data.supported) ? (
        <Panel>
          <EmptyState
            icon={<Plug />}
            title={
              q.isError
                ? t("results.loadFailed", "Results could not load.")
                : t("results.notAvailable", "Results are not available for this area.")
            }
            action={
              q.isError ? (
                <Button variant="outline" onClick={() => void q.refetch()}>
                  {t("common.retry", "Try again")}
                </Button>
              ) : undefined
            }
          />
        </Panel>
      ) : null}

      {/* The sentence */}
      {q.isError || (q.data && !q.data.supported) ? null : (
      <Panel className="p-5 sm:p-7">
        {!f ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              {[0, 1, 2, 3].map((k) => (
                <Skeleton key={k} className="h-16" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <p className="title-display max-w-4xl text-[22px] font-medium leading-snug text-foreground sm:text-[28px]">
              {nothing ? (
                t("results.sentenceEmpty", "Nothing to count yet for this period.")
              ) : (
                <>
                  {t(`results.sentence.lead.${period}`)}{" "}
                  {f.people_saw != null ? (
                    <>
                      <strong className="font-semibold">
                        {t("results.sentence.saw", "{{n}} people saw you", { n: formatNumber(f.people_saw) })}
                      </strong>
                      {", "}
                    </>
                  ) : null}
                  <strong className="font-semibold">
                    {t("results.sentence.contacted", "{{n}} reached out", { n: formatNumber(f.contacted) })}
                  </strong>
                  {", "}
                  <strong className="font-semibold">
                    {t("results.sentence.customers", "{{count}} became customers", { count: f.new_customers })}
                  </strong>{" "}
                  {t("results.sentence.and", "and you earned")}{" "}
                  <span className={cn("font-semibold", f.earned > 0 && "marker")}>{money(f.earned)}</span>.
                </>
              )}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-6 border-t border-border pt-6 sm:grid-cols-4">
              <Stat
                value={f.people_saw == null ? "—" : formatNumber(f.people_saw)}
                label={t("results.saw", "saw you")}
                delta={delta(f.people_saw, p?.people_saw ?? null)}
                deltaLabel={t("results.vsBefore", "vs. before")}
              />
              <Stat
                value={formatNumber(f.contacted)}
                label={t("results.contacted", "contacted you")}
                delta={delta(f.contacted, p?.contacted ?? null)}
                deltaLabel={t("results.vsBefore", "vs. before")}
              />
              <Stat
                value={formatNumber(f.new_customers)}
                label={t("results.customers", "new customers")}
                delta={delta(f.new_customers, p?.new_customers ?? null)}
                deltaLabel={t("results.vsBefore", "vs. before")}
              />
              <Stat
                value={money(f.earned)}
                label={t("results.earned", "earned")}
                tone={f.earned > 0 ? "earned" : undefined}
                delta={delta(f.earned, p?.earned ?? null)}
                deltaLabel={t("results.vsBefore", "vs. before")}
              />
            </div>
            {data?.paid_tracking && f.paid != null && f.to_collect != null && f.earned > 0 ? (
              <p className="mt-4 text-[14px] text-foreground">
                {f.to_collect > 0
                  ? t("results.paidSplit", "Of this, {{paid}} is paid and {{toCollect}} is still to collect.", {
                      paid: money(f.paid),
                      toCollect: money(f.to_collect),
                    })
                  : t("results.paidAll", "All of it is paid.")}
              </p>
            ) : null}
            {data && Object.keys(data.other_currencies).length > 0 ? (
              <p className="mt-4 text-[12.5px] text-muted-foreground">
                {t("results.otherCurrencies", "Also earned in other currencies:")}{" "}
                {Object.entries(data.other_currencies)
                  .map(([c, v]) => formatCurrency(v, c))
                  .join(" · ")}
              </p>
            ) : null}
            {data?.first_reply &&
            data.first_reply.median_minutes != null &&
            data.first_reply.sample >= FIRST_REPLY_MIN_SAMPLE ? (
              <p className="mt-4 text-[14px] text-foreground">
                {t("results.firstReply", "You usually answer a new inquiry within {{time}}.", {
                  time: durationWords(data.first_reply.median_minutes, i18nInstance.language),
                })}
              </p>
            ) : null}
            {f.people_saw != null ? (
              <p className="mt-2 text-[12px] text-muted-foreground">
                {t(
                  "results.sawNote",
                  "“Saw you” adds website visitors and people your ads reached — someone who did both counts twice.",
                )}
              </p>
            ) : null}
          </>
        )}
      </Panel>
      )}

      {/* Where they came from */}
      <Panel>
        <PanelHeader title={t("results.bySource", "Where they came from")} />
        {q.isLoading ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : !data || data.by_source.length === 0 ? (
          <EmptyState
            compact
            icon={<Plug />}
            title={t("results.noSources", "No sources to show yet.")}
            body={t(
              "results.noSourcesBody",
              "Results fill in as people find you — connect your ads or put a form or chat on your website.",
            )}
            action={
              <Link
                to="/forms"
                className="inline-flex items-center gap-1 text-[13px] font-medium text-foreground underline decoration-foreground/30 underline-offset-4"
              >
                {t("results.addForm", "Add a form to your website")}
                <ArrowRight className="size-3.5" />
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[14px]">
              <thead>
                <tr className="border-b border-border text-left text-[12px] text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">{t("results.col.source", "Source")}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{t("results.col.saw", "Saw you")}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{t("results.col.contacted", "Reached out")}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{t("results.col.customers", "Customers")}</th>
                  <th className="px-5 py-2.5 text-right font-medium">{t("results.col.earned", "Earned")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.by_source.map((r) => (
                  <tr key={r.source}>
                    <td className="px-5 py-3 font-medium text-foreground">{t(`results.sources.${r.source}`)}</td>
                    <td className="num px-3 py-3 text-right text-muted-foreground">
                      {r.saw == null ? (
                        CONNECT[r.source] ? (
                          <Link to={CONNECT[r.source]!} className="text-[12px] underline decoration-foreground/20 underline-offset-4 hover:text-foreground">
                            —
                          </Link>
                        ) : (
                          "—"
                        )
                      ) : (
                        formatNumber(r.saw)
                      )}
                    </td>
                    <td className="num px-3 py-3 text-right">{formatNumber(r.contacted)}</td>
                    <td className="num px-3 py-3 text-right">{formatNumber(r.customers)}</td>
                    <td className={cn("num px-5 py-3 text-right", r.earned > 0 && "font-semibold text-earned")}>
                      {r.earned > 0 ? money(r.earned) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-5 py-3 text-[12px] text-muted-foreground">
            <span>
              {t("results.connected.website", "Website visitors")}:{" "}
              {data.connected.website ? t("results.on", "on") : t("results.off", "not connected")}
            </span>
            <span>
              {t("results.connected.ads", "Ads")}:{" "}
              {data.connected.ads.length
                ? data.connected.ads.map((a) => t(`results.sources.${a}`, a)).join(", ")
                : t("results.off", "not connected")}
            </span>
            <span>
              {t("results.connected.openai", "ChatGPT ads")}:{" "}
              {data.connected.openai ? t("results.on", "on") : t("results.off", "not connected")}
            </span>
          </div>
        ) : null}
      </Panel>

      {pilot.aiVisibility && data?.ai_visibility ? (
        <AiVisibilityCard summary={data.ai_visibility} fromAi={data.from_ai} currency={data.currency} />
      ) : null}

      {/* The old home screen's overviews, kept */}
      <LeadAnalyticsChart />
      <DealsSummarySection />
    </PageContainer>
  );
}

/**
 * What AI assistants say about the business, from checks that already ran.
 * Three states: not set up (what it does + Set up), set up without answers
 * yet, and the plain count of answers that named the business.
 */
function AiVisibilityCard({
  summary,
  fromAi,
  currency,
}: {
  summary: AiVisibilitySummary;
  fromAi?: { saw: number | null; contacted: number; customers: number; earned: number };
  currency: string;
}) {
  const { t } = useTranslation();
  const sent = fromAi && (fromAi.contacted > 0 || fromAi.customers > 0) ? fromAi : null;
  const link =
    "inline-flex items-center gap-1 text-[13px] font-medium text-foreground underline decoration-foreground/30 underline-offset-4";
  return (
    <Panel>
      <PanelHeader title={t("results.ai.title", "What AI assistants say about you")} />
      <div className="space-y-3 px-4 py-4 sm:px-5">
        {!summary.set_up ? (
          <>
            <p className="text-[14px] text-muted-foreground">
              {t(
                "results.ai.notSetUp",
                "See whether ChatGPT and other AI assistants name your business when people ask them for a recommendation.",
              )}
            </p>
            <Button asChild variant="outline">
              <Link to="/ai-visibility/setup">{t("results.ai.setUp", "Set it up")}</Link>
            </Button>
          </>
        ) : summary.answers === 0 ? (
          <p className="text-[14px] text-muted-foreground">
            {summary.status === "paused"
              ? t("results.ai.paused", "Checks are paused, so there is nothing new for this period.")
              : t("results.ai.noAnswers", "No checks ran in this period yet. Results show here after the next one.")}
          </p>
        ) : (
          <>
            <p className="title-display text-[18px] font-medium leading-snug text-foreground sm:text-[20px]">
              {t("results.ai.named", "ChatGPT and other AI assistants named you in {{named}} of {{answers}} answers.", {
                named: formatNumber(summary.named),
                answers: formatNumber(summary.answers),
              })}
            </p>
            {summary.previous_answers > 0 ? (
              <p className="text-[13px] text-muted-foreground">
                {t("results.ai.before", "The period before: {{named}} of {{answers}}.", {
                  named: formatNumber(summary.previous_named),
                  answers: formatNumber(summary.previous_answers),
                })}
              </p>
            ) : null}
          </>
        )}
        {sent ? (
          <p className="text-[14px] text-foreground">
            {t("results.ai.sent", "{{count}} people contacted you after an AI assistant sent them.", {
              count: sent.contacted,
              formattedCount: formatNumber(sent.contacted),
            })}
            {sent.customers > 0
              ? " " +
                t("results.ai.sentEarned", "{{customers}} became customers · {{earned}} earned.", {
                  customers: formatNumber(sent.customers),
                  earned: formatCurrency(sent.earned, currency),
                })
              : null}
          </p>
        ) : null}
        {summary.set_up ? (
          <Link to="/ai-visibility" className={link}>
            {t("results.ai.details", "See the questions and answers")}
            <ArrowRight className="size-3.5" />
          </Link>
        ) : null}
      </div>
    </Panel>
  );
}
