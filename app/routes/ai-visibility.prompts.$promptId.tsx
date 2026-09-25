import { useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useAiVisibilityPrompt, useInvalidateAiVisibility } from "~/lib/hooks/useAiVisibility";
import { aiVisibilityApi, apiErrorMessage } from "~/lib/api/ai-visibility";
import { cn } from "~/lib/utils";
import { Panel, PanelHeader } from "~/components/notebook/panel";
import { EmptyState } from "~/components/notebook/empty-state";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { useAiVisibilityContext } from "~/components/ai-visibility/context";
import { AnswerList } from "~/components/ai-visibility/answer-list";
import { AnswerSheet } from "~/components/ai-visibility/answer-sheet";
import { Bar, EngineMark, intentLabel, pct, rank, useDomainTypeLabel, useFilters, useToneWord } from "~/components/ai-visibility/shared";

/** One question: who the assistants name for it, what they read, every answer. */
export default function AiVisibilityPromptDetail() {
  const { t } = useTranslation();
  const { promptId = "" } = useParams();
  const { canEdit } = useAiVisibilityContext();
  const [filters] = useFilters();
  const q = useAiVisibilityPrompt(promptId, filters);
  const invalidate = useInvalidateAiVisibility();
  const [openId, setOpenId] = useState<string | null>(null);
  const { search } = useLocation();
  const toneWord = useToneWord();
  const typeLabel = useDomainTypeLabel();
  const d = q.data;

  if (q.isError) {
    return (
      <Panel>
        <EmptyState title={t("aiVisibility.prompt.notFound", "This question no longer exists.")} />
      </Panel>
    );
  }
  if (!d) return <Skeleton className="h-72 rounded-xl" />;

  const setStatus = async (status: "active" | "archived") => {
    try {
      await aiVisibilityApi.updatePrompt(d.prompt.id, { status });
      void invalidate();
    } catch (err) {
      toast.error(apiErrorMessage(err, t("aiVisibility.prompts.saveFailed", "Could not update the questions.")));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/ai-visibility/prompts${search}`} className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" />
          {t("aiVisibility.prompt.back", "All questions")}
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="title-display text-[22px] font-semibold leading-snug text-foreground sm:text-[26px]">“{d.prompt.text}”</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {intentLabel(t, d.prompt.intent)}
              {d.prompt.branded ? ` · ${t("aiVisibility.prompts.branded", "names a brand")}` : ""}
              {d.prompt.status !== "active" ? ` · ${t(`aiVisibility.prompt.status.${d.prompt.status}`, d.prompt.status)}` : ""}
            </p>
          </div>
          {canEdit ? (
            d.prompt.status === "active" ? (
              <Button variant="outline" size="sm" onClick={() => setStatus("archived")}>
                {t("aiVisibility.prompts.archive", "Archive")}
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStatus("active")}>
                {t("aiVisibility.prompts.track", "Track")}
              </Button>
            )
          ) : null}
        </div>
      </div>

      <Panel className="grid grid-cols-3 divide-x divide-border">
        {[
          { label: t("aiVisibility.metric.visibility", "Named in"), value: pct(d.own.visibility) },
          { label: t("aiVisibility.metric.position", "Average place"), value: rank(d.own.position) },
          { label: t("aiVisibility.metric.tone", "How you're described"), value: d.own.tone == null ? "—" : toneWord(d.own.tone) },
        ].map((m) => (
          <div key={m.label} className="px-4 py-4 sm:px-5">
            <p className="title-display num text-[24px] font-semibold text-foreground sm:text-[28px]">{m.value}</p>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">{m.label}</p>
          </div>
        ))}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title={t("aiVisibility.prompt.whoTitle", "Who gets named for this")} />
          {d.brands.some((b) => (b.visibility ?? 0) > 0) ? (
            <ol className="space-y-2.5 p-4 sm:p-5">
              {d.brands
                .filter((b) => (b.visibility ?? 0) > 0 || b.is_own)
                .map((b) => (
                  <li key={b.key} className="grid grid-cols-[1fr_3rem] items-center gap-x-3 gap-y-1">
                    <span className={cn("truncate text-[13.5px]", b.is_own ? "font-semibold" : "text-foreground/85")}>
                      <span className={cn(b.is_own && "marker")}>{b.name}</span>
                    </span>
                    <span className="num text-right text-[13px]">{pct(b.visibility)}</span>
                    <Bar value={b.visibility} own={b.is_own} color={b.color} className="col-span-2" />
                  </li>
                ))}
            </ol>
          ) : (
            <EmptyState compact title={t("aiVisibility.prompt.nobody", "No tracked brand was named yet.")} />
          )}
        </Panel>
        <Panel>
          <PanelHeader title={t("aiVisibility.overview.byEngine", "By assistant")} />
          <ul className="divide-y divide-border">
            {d.engines.map((e) => (
              <li key={e.engine} className="flex items-center justify-between px-4 py-2.5 text-[13.5px] sm:px-5">
                <EngineMark engine={e.engine} className="font-medium" />
                <span className="num text-muted-foreground">
                  {e.answers ? `${pct(e.visibility)} · ${rank(e.position)}` : t("aiVisibility.overview.engineNone", "no answers yet")}
                </span>
              </li>
            ))}
          </ul>
          {d.sources.length ? (
            <>
              <PanelHeader className="border-t" title={t("aiVisibility.prompt.sourcesTitle", "Websites it read")} />
              <ul className="divide-y divide-border">
                {d.sources.slice(0, 6).map((s) => (
                  <li key={s.domain} className="flex items-center justify-between gap-3 px-4 py-2 text-[13px] sm:px-5">
                    <span className="min-w-0 truncate">
                      {s.domain} <span className="text-muted-foreground">· {typeLabel(s.owner ?? s.type)}</span>
                    </span>
                    <span className="num text-muted-foreground">{s.answers_used}×</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </Panel>
      </div>

      <Panel>
        <PanelHeader title={t("aiVisibility.prompt.answersTitle", "Every answer")} count={d.answers.total} />
        {d.answers.items.length ? (
          <AnswerList items={d.answers.items} onOpen={setOpenId} showPrompt={false} />
        ) : (
          <EmptyState compact title={t("aiVisibility.prompt.noAnswers", "Not asked yet in this period.")} />
        )}
      </Panel>
      <AnswerSheet answerId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
