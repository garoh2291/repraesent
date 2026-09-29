import { Link, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import type { FactTopic } from "~/lib/api/ai-visibility";
import { useAiVisibilityFacts } from "~/lib/hooks/useAiVisibility";
import { Panel, PanelHeader } from "~/components/notebook/panel";
import { EngineMark, useFilters } from "~/components/ai-visibility/shared";

export function useFactTopicLabel() {
  const { t } = useTranslation();
  return (topic: FactTopic) =>
    ({
      hours: t("aiVisibility.facts.topic.hours", "Opening hours"),
      address: t("aiVisibility.facts.topic.address", "Address"),
      phone: t("aiVisibility.facts.topic.phone", "Phone"),
      email: t("aiVisibility.facts.topic.email", "Email"),
      website: t("aiVisibility.facts.topic.website", "Website"),
      services: t("aiVisibility.facts.topic.services", "What you offer"),
      prices: t("aiVisibility.facts.topic.prices", "Prices"),
    })[topic];
}

/**
 * "What AI gets wrong about you": what answers said about the business that
 * does not match its details, and the words assistants use for it. Every quote
 * is copied from a real answer (the server drops anything it cannot find).
 */
export function FactsPanel({ onOpenAnswer }: { onOpenAnswer: (id: string) => void }) {
  const { t } = useTranslation();
  const [filters] = useFilters();
  const q = useAiVisibilityFacts(filters);
  const topicLabel = useFactTopicLabel();
  const { search } = useLocation();
  const d = q.data;
  if (!d || !d.ready) return null;

  const link = "inline-flex items-center gap-1 text-[13px] font-medium text-foreground underline decoration-foreground/30 underline-offset-4";
  const wrong = d.wrong;
  const words = d.words;

  return (
    <Panel>
      <PanelHeader
        title={t("aiVisibility.facts.title", "What AI gets wrong about you")}
        count={wrong.length || undefined}
        marker={wrong.length > 0}
      />
      <div className="space-y-4 px-4 py-4 sm:px-5">
        {d.known.length === 0 ? (
          <div className="space-y-2">
            <p className="text-[14px] text-muted-foreground">
              {t(
                "aiVisibility.facts.noFacts",
                "Add your opening hours, address and what you offer, and we check whether AI assistants get them right.",
              )}
            </p>
            <Link to="/settings/business-profile" className={link}>
              {t("aiVisibility.facts.addDetails", "Add your business details")}
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        ) : wrong.length ? (
          <ul className="space-y-4">
            {wrong.map((w) => (
              <li key={w.topic} className="space-y-1.5">
                <p className="text-[14.5px] font-medium text-foreground">
                  {topicLabel(w.topic)}
                  <span className="font-normal text-muted-foreground">
                    {" · "}
                    {t("aiVisibility.facts.inAnswers", "in {{count}} answers", { count: w.answers })}
                  </span>
                </p>
                {w.examples.map((e) => (
                  <button
                    key={e.answer_id + e.said}
                    type="button"
                    onClick={() => onOpenAnswer(e.answer_id)}
                    className="flex w-full items-start gap-2 rounded-md py-1 text-left text-[13.5px] hover:bg-foreground/[0.025]"
                  >
                    <EngineMark engine={e.engine} showLabel={false} className="mt-0.5 shrink-0" />
                    <span className="min-w-0 text-foreground/85">
                      {t("aiVisibility.facts.said", "AI said:")} <q className="italic">{e.said}</q>
                    </span>
                  </button>
                ))}
                <p className="text-[13px] text-muted-foreground">
                  {t("aiVisibility.facts.yourFact", "You told us:")} <span className="text-foreground">{w.fact}</span>
                </p>
              </li>
            ))}
            <li>
              <Link to={`/ai-visibility/actions${search}`} className={link}>
                {t("aiVisibility.facts.howToFix", "How to correct it")}
                <ArrowRight className="size-3.5" />
              </Link>
            </li>
          </ul>
        ) : (
          <p className="text-[14px] text-muted-foreground">
            {d.checked > 0
              ? t("aiVisibility.facts.allRight", "Nothing wrong in {{count}} answers that said something concrete about you.", { count: d.checked })
              : t("aiVisibility.facts.nothingYet", "No answer has said anything concrete about you yet.")}
          </p>
        )}

        {words.own.length || words.rival ? (
          <div className="space-y-1 border-t border-border pt-3 text-[13.5px]">
            {words.own.length ? (
              <p>
                <span className="text-muted-foreground">{t("aiVisibility.facts.wordsYou", "How AI describes you:")}</span>{" "}
                <span className="font-medium text-foreground">{words.own.join(" · ")}</span>
              </p>
            ) : null}
            {words.rival ? (
              <p>
                <span className="text-muted-foreground">
                  {t("aiVisibility.facts.wordsRival", "How AI describes {{name}}:", { name: words.rival.name })}
                </span>{" "}
                <span className="text-foreground">{words.rival.words.join(" · ")}</span>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
