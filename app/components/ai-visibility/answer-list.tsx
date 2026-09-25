import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import type { AnswerSummary } from "~/lib/api/ai-visibility";
import { cn } from "~/lib/utils";
import { useAiVisibilityContext } from "./context";
import { EngineMark, rank, shortDate } from "./shared";

/** A compact row per answer: question, engine, day, and whether you were in it. */
export function AnswerList({
  items,
  onOpen,
  showPrompt = true,
}: {
  items: AnswerSummary[];
  onOpen: (id: string) => void;
  showPrompt?: boolean;
}) {
  const { t } = useTranslation();
  const { state } = useAiVisibilityContext();
  const colorOf = new Map(state.competitors.map((c) => [c.id, c.color]));

  return (
    <ul className="divide-y divide-border">
      {items.map((a) => (
        <li key={a.id}>
          <button
            type="button"
            onClick={() => onOpen(a.id)}
            className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-foreground/[0.025] focus-visible:bg-foreground/[0.04] focus-visible:outline-none sm:px-5"
          >
            <span
              aria-hidden
              className={cn(
                "mt-1 flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold num",
                a.error
                  ? "bg-foreground/[0.06] text-muted-foreground"
                  : a.own_mentioned
                    ? "bg-marker text-foreground"
                    : "border border-dashed border-foreground/25 text-muted-foreground",
              )}
            >
              {a.error ? "!" : a.own_mentioned ? a.own_position ?? "✓" : "–"}
            </span>
            <span className="min-w-0 flex-1">
              {showPrompt ? <span className="line-clamp-2 text-[14px] font-medium text-foreground">{a.prompt}</span> : null}
              <span className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted-foreground", showPrompt && "mt-1")}>
                <EngineMark engine={a.engine} />
                <span>{shortDate(a.run_date)}</span>
                {a.error ? (
                  <span className="text-overdue">{t("aiVisibility.answers.failed", "Could not be asked")}</span>
                ) : a.own_mentioned ? (
                  <span className="text-foreground/80">
                    {t("aiVisibility.answers.namedAt", "You: {{rank}}", { rank: rank(a.own_position) })}
                    {a.recommended ? ` · ${t("aiVisibility.answers.recommended", "recommended")}` : ""}
                  </span>
                ) : (
                  <span>{t("aiVisibility.answers.notNamed", "You were not named")}</span>
                )}
                {a.brands.filter((b) => !b.is_own).length ? (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    {a.brands
                      .filter((b) => !b.is_own)
                      .slice(0, 3)
                      .map((b) => (
                        <span key={b.name} className="inline-flex items-center gap-1 truncate">
                          <span className="size-1.5 rounded-full" style={{ backgroundColor: (b.competitor_id && colorOf.get(b.competitor_id)) || "#8a8a8a" }} aria-hidden />
                          {b.name}
                        </span>
                      ))}
                  </span>
                ) : null}
              </span>
            </span>
            <ChevronRight className="mt-1.5 size-4 shrink-0 text-muted-foreground/60" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
