import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ExternalLink, FileText, Sparkles, X } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import {
  CardBody,
  CardHeader,
  InfoNote,
  SectionCard,
} from "~/components/wordpress/fields";
import type { Suggestion } from "~/lib/api/re-visible";

/**
 * AI content proposals per page.
 *
 * Suggestions only, and the copy says so: the client copies the text into
 * WordPress themselves. Auto-publishing a rewrite would be both a trust problem
 * and, under Google's spam policy, a risk to the site's search visibility.
 */
export function ContentPanel({
  suggestions,
  loading,
  onSetStatus,
  onOpenWordPress,
  saving,
}: {
  suggestions: Suggestion[];
  loading: boolean;
  onSetStatus: (suggestionId: string, status: Suggestion["status"]) => void;
  onOpenWordPress: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;
  }

  return (
    <div className="space-y-6">
      <SectionCard>
        <CardHeader
          icon={<Sparkles className="size-4" aria-hidden />}
          title={t("wordpress.reVisible.suggestionsTitle", "Content suggestions")}
          subtitle={t(
            "wordpress.reVisible.suggestionsSubtitle",
            "Generated in WordPress, from the AI Analytics box on each page. Copy what you want into the page — nothing is published for you.",
          )}
          action={
            <Button variant="outline" size="sm" onClick={onOpenWordPress}>
              <ExternalLink className="size-3.5" aria-hidden />
              {t("wordpress.reVisible.openEditor", "Open in WordPress")}
            </Button>
          }
        />
        <CardBody>
          {suggestions.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t(
                  "wordpress.reVisible.suggestionsEmpty",
                  "No suggestions yet. In WordPress, edit a page and use “Get AI suggestions” in the AI answer + FAQ box.",
                )}
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {suggestions.map((suggestion) => {
                const open = expanded === suggestion.id;

                return (
                  <li key={suggestion.id} className="py-3 first:pt-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setExpanded(open ? null : suggestion.id)}
                          className="flex items-center gap-1.5 text-left text-sm font-medium hover:underline"
                        >
                          <FileText className="size-3.5 shrink-0" aria-hidden />
                          {suggestion.post_title ||
                            t("wordpress.reVisible.untitled", "Untitled page")}
                        </button>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={suggestion.status} />
                          {suggestion.output.faqs.length > 0 ? (
                            <span className="text-[11px] text-muted-foreground">
                              {t(
                                "wordpress.reVisible.faqCount",
                                "{{count}} questions",
                                { count: suggestion.output.faqs.length },
                              )}
                            </span>
                          ) : null}
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(suggestion.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {suggestion.status === "new" ? (
                        <div className="flex gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={saving}
                            onClick={() => onSetStatus(suggestion.id, "applied")}
                          >
                            <Check className="size-3.5" aria-hidden />
                            {t("wordpress.reVisible.markUsed", "Mark as used")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={saving}
                            onClick={() => onSetStatus(suggestion.id, "dismissed")}
                          >
                            <X className="size-3.5" aria-hidden />
                            {t("wordpress.reVisible.dismiss", "Dismiss")}
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    {open ? (
                      <SuggestionBody suggestion={suggestion} />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </SectionCard>

      <InfoNote>
        {t(
          "wordpress.reVisible.contentAdvice",
          "What measurably works: one direct 40–60 word answer at the top of the page, sections of 120–180 words each answering a single question, three to five real FAQ pairs, and a named author with a visible date. Keyword repetition measurably reduces citations.",
        )}
      </InfoNote>
    </div>
  );
}

function StatusBadge({ status }: { status: Suggestion["status"] }) {
  const { t } = useTranslation();

  if (status === "applied") {
    return (
      <Badge variant="secondary" className="text-[10px]">
        {t("wordpress.reVisible.statusApplied", "used")}
      </Badge>
    );
  }

  if (status === "dismissed") {
    return (
      <Badge variant="outline" className="text-[10px]">
        {t("wordpress.reVisible.statusDismissed", "dismissed")}
      </Badge>
    );
  }

  return (
    <Badge className="text-[10px]">
      {t("wordpress.reVisible.statusNew", "new")}
    </Badge>
  );
}

function SuggestionBody({ suggestion }: { suggestion: Suggestion }) {
  const { t } = useTranslation();
  const { output } = suggestion;

  return (
    <div className="mt-3 space-y-3 rounded-xl border bg-muted/20 p-3">
      {output.answer_block ? (
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("wordpress.reVisible.answerBlock", "Direct answer")}
          </h4>
          <p className="mt-1 text-sm leading-relaxed">{output.answer_block}</p>
        </div>
      ) : null}

      {output.faqs.length > 0 ? (
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("wordpress.reVisible.faqs", "Questions")}
          </h4>
          <dl className="mt-1 space-y-2">
            {output.faqs.map((faq, index) => (
              <div key={`${faq.question}-${index}`}>
                <dt className="text-sm font-medium">{faq.question}</dt>
                <dd className="text-sm text-muted-foreground">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {output.structure_notes.length > 0 ? (
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("wordpress.reVisible.structureNotes", "Notes")}
          </h4>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
            {output.structure_notes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
