import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Play, Radar } from "lucide-react";
import i18n from "~/i18n";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { useAiVisibilityStatus, useInvalidateAiVisibility } from "~/lib/hooks/useAiVisibility";
import { aiVisibilityApi, apiErrorMessage, type ProjectState } from "~/lib/api/ai-visibility";
import { useAuthContext } from "~/providers/auth-provider";
import { cn } from "~/lib/utils";
import { PageContainer, PageHeader } from "~/components/notebook/page-header";
import { Panel } from "~/components/notebook/panel";
import { EmptyState } from "~/components/notebook/empty-state";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { AiVisibilityContext } from "~/components/ai-visibility/context";
import { RunProgress, StateNotice } from "~/components/ai-visibility/run-banner";
import { JobsStrip, useJobWatcher } from "~/components/ai-visibility/jobs-strip";
import { ENGINE_META, FilterSelect, PERIODS, Segmented, eur, useFilters } from "~/components/ai-visibility/shared";

export function meta() {
  return [{ title: i18n.t("aiVisibility.metaTitle", "AI visibility") + " - Repraesent" }];
}

/**
 * /ai-visibility — Peec-style tracking of what AI assistants tell people
 * (AI_VISIBILITY_PLAN.md). This layout owns what every sub-page shares: the
 * project state, the run button, the spend chip, the notices and the filters.
 */
export default function AiVisibilityLayout() {
  const { t } = useTranslation();
  useDocumentMeta({ titleKey: "aiVisibility.metaTitle", titleSuffix: " - Repraesent" });
  const location = useLocation();
  const navigate = useNavigate();
  const { currentWorkspace } = useAuthContext();
  const canEdit = currentWorkspace?.member_role !== "viewer";
  const status = useAiVisibilityStatus();
  const invalidate = useInvalidateAiVisibility();
  const [filters, setFilters] = useFilters();
  const [startedBatch, setStartedBatch] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  // Toasts + refresh for background jobs, including ones that finished while
  // the page was closed. Mounted here once, for setup and every tab.
  useJobWatcher();

  const data = status.data;
  const onSetup = location.pathname.startsWith("/ai-visibility/setup");
  const needsSetup = !!data && (!data.project || data.project.status === "setup");

  useEffect(() => {
    if (!data) return;
    if (needsSetup && !onSetup) navigate("/ai-visibility/setup", { replace: true });
    if (!needsSetup && onSetup) navigate("/ai-visibility", { replace: true });
  }, [data, needsSetup, onSetup, navigate]);

  if (status.isError) {
    return (
      <PageContainer>
        <Panel>
          <EmptyState
            icon={<Radar />}
            title={t("aiVisibility.loadFailed", "AI visibility could not load.")}
            body={apiErrorMessage(status.error, "")}
            action={
              <Button variant="outline" onClick={() => void status.refetch()}>
                {t("common.retry", "Try again")}
              </Button>
            }
          />
        </Panel>
      </PageContainer>
    );
  }

  if (!data || (needsSetup && !onSetup) || (!needsSetup && onSetup)) {
    return (
      <PageContainer className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </PageContainer>
    );
  }

  if (needsSetup) return <Outlet context={{ status: data }} />;

  const state = data as ProjectState;
  const runningId = startedBatch ?? (state.latest_batch?.running ? state.latest_batch.id : null);
  const path = location.pathname.replace(/\/+$/, "");
  const showFilters = !/\/(actions|plan|website)$/.test(path);

  const runNow = async () => {
    setStarting(true);
    try {
      const res = await aiVisibilityApi.run();
      // A batch id with planned=0 is the run already in flight — follow it.
      if (res.batch_id) setStartedBatch(res.batch_id);
      else if (res.skipped === "nothing_due") toast.success(t("aiVisibility.run.nothingDue", "Every question was already asked today. The next run is scheduled."));
      else if (res.skipped === "cap") toast.error(t("aiVisibility.run.cap", "This month's spending limit is reached."));
      else if (res.skipped === "no_key") toast.error(t("aiVisibility.run.noKey", "Connect your OpenRouter key first."));
      else if (res.skipped === "no_prompts") toast.error(t("aiVisibility.run.noPrompts", "Add at least one question first."));
      else toast.error(t("aiVisibility.run.skipped", "Nothing was started."));
      void invalidate();
    } catch (err) {
      toast.error(apiErrorMessage(err, t("aiVisibility.run.failed", "Could not start the run.")));
    } finally {
      setStarting(false);
    }
  };

  const tabs = [
    { to: "/ai-visibility", label: t("aiVisibility.nav.overview", "Overview"), end: true },
    { to: "/ai-visibility/actions", label: t("aiVisibility.nav.actions", "What to do") },
    { to: "/ai-visibility/website", label: t("aiVisibility.nav.website", "Your website") },
    { to: "/ai-visibility/prompts", label: t("aiVisibility.nav.prompts", "Questions") },
    { to: "/ai-visibility/competitors", label: t("aiVisibility.nav.competitors", "Competitors") },
    { to: "/ai-visibility/sources", label: t("aiVisibility.nav.sources", "Sources") },
    { to: "/ai-visibility/answers", label: t("aiVisibility.nav.answers", "Answers") },
    { to: "/ai-visibility/plan", label: t("aiVisibility.nav.plan", "Plan & cost") },
  ];
  const spendShare = state.spend.cap_eur_cents ? state.spend.month_eur_cents / state.spend.cap_eur_cents : 0;
  const search = location.search;

  return (
    <AiVisibilityContext.Provider value={{ state, canEdit }}>
      <PageContainer className="space-y-5 sm:space-y-6">
        <PageHeader
          title={t("aiVisibility.title", "AI visibility")}
          subtitle={t(
            "aiVisibility.subtitle",
            "What ChatGPT, Perplexity and other AI assistants tell people who ask for a business like {{brand}}.",
            { brand: state.project.brand_name },
          )}
          actions={
            <>
              <NavLink
                to={`/ai-visibility/plan${search}`}
                className="group inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[12.5px] text-muted-foreground hover:text-foreground"
                title={t("aiVisibility.spendTitle", "Spent this month on AI visibility (your OpenRouter key). Everything on the key: Settings → AI.")}
              >
                <span className="relative h-1.5 w-10 overflow-hidden rounded-full bg-foreground/[0.08]" aria-hidden>
                  <span
                    className={cn("absolute inset-y-0 left-0 rounded-full", spendShare >= 0.9 ? "bg-overdue" : "bg-foreground/70")}
                    style={{ width: `${Math.min(100, spendShare * 100)}%` }}
                  />
                </span>
                <span className="num">
                  {t("aiVisibility.spendChip", "{{spent}} of {{cap}}", { spent: eur(state.spend.month_eur_cents), cap: eur(state.spend.cap_eur_cents) })}
                </span>
              </NavLink>
              {canEdit && state.project.status === "active" ? (
                <Button onClick={runNow} disabled={starting || !!runningId} size="sm" className="h-9">
                  <Play className="size-3.5" />
                  {runningId ? t("aiVisibility.running", "Running…") : t("aiVisibility.runNow", "Run now")}
                </Button>
              ) : null}
            </>
          }
        />

        <StateNotice state={state} />
        <JobsStrip canEdit={canEdit} onRetryRun={runNow} />
        {runningId ? <RunProgress key={runningId} batchId={runningId} onDone={() => setStartedBatch(null)} /> : null}

        {/* Tabs on one row (scrolls sideways on a phone), the filters for the tab below. */}
        <div className="space-y-3 border-b border-border pb-3">
          <nav aria-label={t("aiVisibility.nav.label", "AI visibility sections")} className="-mx-4 overflow-x-auto px-4 scrollbar-hide sm:mx-0 sm:px-0">
            <ul className="flex min-w-max gap-1">
              {tabs.map((tab) => (
                <li key={tab.to}>
                  <NavLink
                    to={`${tab.to}${search}`}
                    end={tab.end}
                    className={({ isActive }) =>
                      cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25",
                        isActive ? "bg-foreground text-background" : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground",
                      )
                    }
                  >
                    {tab.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          {showFilters ? (
            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect
                aria-label={t("aiVisibility.filters.engine", "Assistant")}
                value={filters.engine ?? ""}
                onChange={(e) => setFilters({ engine: (e.target.value || null) as typeof filters.engine })}
              >
                <option value="">{t("aiVisibility.filters.allEngines", "All assistants")}</option>
                {state.project.engines.map((e) => (
                  <option key={e} value={e}>
                    {ENGINE_META[e].label}
                  </option>
                ))}
              </FilterSelect>
              {state.topics.length ? (
                <FilterSelect
                  aria-label={t("aiVisibility.filters.topic", "Topic")}
                  value={filters.topic_id ?? ""}
                  onChange={(e) => setFilters({ topic_id: e.target.value || null })}
                  className="max-w-[220px]"
                >
                  <option value="">{t("aiVisibility.filters.allTopics", "All topics")}</option>
                  {state.topics.map((tp) => (
                    <option key={tp.id} value={tp.id}>
                      {tp.name}
                    </option>
                  ))}
                </FilterSelect>
              ) : null}
              <Segmented
                label={t("aiVisibility.filters.period", "Period")}
                value={filters.period}
                onChange={(p) => setFilters({ period: p })}
                options={PERIODS.map((p) => ({ value: p, label: t(`aiVisibility.periods.${p}`, p) }))}
              />
            </div>
          ) : null}
        </div>

        <Outlet context={{ status: data }} />
      </PageContainer>
    </AiVisibilityContext.Provider>
  );
}
