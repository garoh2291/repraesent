import { useTranslation } from "react-i18next";
import { ExternalLink, TriangleAlert } from "lucide-react";
import { BottomSheet } from "~/components/notebook/bottom-sheet";
import { Skeleton } from "~/components/ui/skeleton";
import { useAiVisibilityAnswer } from "~/lib/hooks/useAiVisibility";
import { cn } from "~/lib/utils";
import { AnswerText, highlightsFor } from "./answer-text";
import { useAiVisibilityContext } from "./context";
import { EngineMark, rank, shortDate, useToneWord } from "./shared";

/** One answer, in full: what was asked, what the assistant said, who it named, what it read. */
export function AnswerSheet({ answerId, onClose }: { answerId: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { state } = useAiVisibilityContext();
  const q = useAiVisibilityAnswer(answerId);
  const a = q.data;
  const toneWord = useToneWord();

  return (
    <BottomSheet
      open={!!answerId}
      onOpenChange={(o) => !o && onClose()}
      className="max-w-[760px]"
      title={a ? `“${a.prompt}”` : t("aiVisibility.answer.loading", "Loading answer…")}
      description={
        a ? (
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <EngineMark engine={a.engine} className="font-medium text-foreground" />
            <span>{shortDate(a.run_date)}</span>
            {a.country ? <span>{a.country}</span> : null}
            <span className="text-muted-foreground/70">{a.model}</span>
          </span>
        ) : undefined
      }
    >
      {!a ? (
        <div className="space-y-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Chip tone={a.own_mentioned ? "good" : "bad"}>
              {a.own_mentioned
                ? t("aiVisibility.answer.named", "Named you — {{rank}}", { rank: rank(a.own_position) })
                : t("aiVisibility.answer.notNamed", "Did not name you")}
            </Chip>
            {a.recommended ? <Chip tone="good">{t("aiVisibility.answer.recommended", "Recommended you")}</Chip> : null}
            {a.own_mentioned && a.own_sentiment != null ? (
              <Chip>{t("aiVisibility.answer.tone", "Tone: {{tone}}", { tone: toneWord((a.own_sentiment / 2 + 0.5) * 100) })}</Chip>
            ) : null}
            {a.own_cited ? <Chip tone="good">{t("aiVisibility.answer.cited", "Cited your website")}</Chip> : null}
            {!a.grounded && !a.error ? <Chip>{t("aiVisibility.answer.memory", "Answered from memory — no web sources")}</Chip> : null}
          </div>

          {a.error ? (
            <div className="flex gap-3 rounded-xl border border-overdue/30 bg-overdue-soft p-4 text-[13.5px] text-foreground">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-overdue" />
              <div>
                <p className="font-medium">{t("aiVisibility.answer.failed", "This question could not be asked.")}</p>
                <p className="mt-1 break-words text-muted-foreground">{a.error}</p>
              </div>
            </div>
          ) : (
            <AnswerText
              text={a.answer_text ?? ""}
              highlights={highlightsFor({
                brandName: state.project.brand_name,
                brandAliases: state.project.brand_aliases,
                competitors: state.competitors,
                mentions: a.mentions,
              })}
            />
          )}

          {a.mentions.length ? (
            <section>
              <h3 className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {t("aiVisibility.answer.brandsTitle", "Named, in order")}
              </h3>
              <ol className="flex flex-wrap gap-1.5">
                {a.mentions.map((m) => (
                  <li
                    key={`${m.position}-${m.name}`}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px]",
                      m.is_own ? "border-marker bg-marker-soft font-semibold text-foreground" : "border-border bg-card text-foreground/80",
                    )}
                  >
                    <span className="num text-muted-foreground">{m.position}</span>
                    {m.color ? <span className="size-1.5 rounded-full" style={{ backgroundColor: m.color }} aria-hidden /> : null}
                    {m.name}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {a.sources.length ? (
            <section>
              <h3 className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {t("aiVisibility.answer.sourcesTitle", "Websites it used ({{n}})", { n: a.sources.length })}
              </h3>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {a.sources.map((s) => (
                  <li key={s.url} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="num w-5 shrink-0 text-[12px] text-muted-foreground">{s.position}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-foreground">{s.title || s.domain}</p>
                      <p className="truncate text-[12px] text-muted-foreground">{s.domain}</p>
                    </div>
                    {s.owner ? (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                          s.owner === "own" ? "bg-marker-soft text-marker-ink" : "bg-foreground/[0.06] text-foreground/70",
                        )}
                      >
                        {s.owner === "own" ? t("aiVisibility.sourceType.own", "Your site") : s.owner_name}
                      </span>
                    ) : null}
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      aria-label={t("aiVisibility.answer.openSource", "Open {{domain}}", { domain: s.domain })}
                      className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </BottomSheet>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "good" | "bad" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium",
        tone === "good" && "bg-earned-soft text-earned",
        tone === "bad" && "bg-overdue-soft text-overdue",
        !tone && "bg-foreground/[0.06] text-foreground/75",
      )}
    >
      {children}
    </span>
  );
}
