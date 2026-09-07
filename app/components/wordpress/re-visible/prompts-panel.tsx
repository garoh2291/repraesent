import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import {
  CardBody,
  CardHeader,
  InfoNote,
  SectionCard,
} from "~/components/wordpress/fields";
import { useSearchShortcut } from "~/lib/hooks/useSearchShortcut";
import type {
  PromptCandidate,
  PromptIntent,
  VisibilityPrompt,
} from "~/lib/api/re-visible";
import { PROMPT_INTENTS } from "~/lib/api/re-visible";
import { intentLabel } from "./constants";
import { PromptRunsDetail } from "./prompt-runs-detail";

/**
 * The questions being tracked.
 *
 * Every row costs money on every run — one prompt is `engines x runs_per_prompt`
 * live web searches a week — so the affordances lean towards curation: a switch
 * to stop asking without losing history, and Delete behind it rather than next
 * to it.
 */
export function PromptsPanel({
  pluginUuid,
  prompts,
  loading,
  openPromptId,
  onOpenPrompt,
  onAdd,
  onUpdate,
  onDelete,
  onGenerate,
  onAccept,
  generating,
  saving,
}: {
  pluginUuid: string;
  prompts: VisibilityPrompt[];
  loading: boolean;
  openPromptId: string | null;
  onOpenPrompt: (promptId: string | null) => void;
  onAdd: (text: string, intent: PromptIntent) => void;
  onUpdate: (promptId: string, patch: { active?: boolean }) => void;
  onDelete: (promptId: string) => void;
  onGenerate: () => Promise<PromptCandidate[]>;
  onAccept: (candidates: PromptCandidate[]) => void;
  generating: boolean;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const { ref: searchInputRef, withHint } = useSearchShortcut();

  const [search, setSearch] = useState("");
  const [intentFilter, setIntentFilter] = useState<string>("all");
  const [newText, setNewText] = useState("");
  const [newIntent, setNewIntent] = useState<PromptIntent>("category");
  const [candidates, setCandidates] = useState<PromptCandidate[] | null>(null);
  const [rejected, setRejected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return prompts.filter((prompt) => {
      if (intentFilter !== "all" && prompt.intent !== intentFilter) return false;
      if (!needle) return true;

      return (
        prompt.text.toLowerCase().includes(needle) ||
        (prompt.topic ?? "").toLowerCase().includes(needle)
      );
    });
  }, [prompts, search, intentFilter]);

  async function handleGenerate() {
    const generated = await onGenerate();
    setRejected(new Set());
    setCandidates(generated);
  }

  const accepted = (candidates ?? []).filter((c) => !rejected.has(c.text));

  return (
    <div className="space-y-6">
      <SectionCard>
        <CardHeader
          title={t("wordpress.reVisible.promptsTitle", "Questions")}
          subtitle={t(
            "wordpress.reVisible.promptsSubtitle",
            "What a buyer types into an AI assistant. The useful ones do not mention your name — those tell you whether the engines surface you to someone who has never heard of you.",
          )}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <>
                  <Spinner className="size-3.5" />
                  {t("wordpress.reVisible.generating", "Reading your site…")}
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" aria-hidden />
                  {t("wordpress.reVisible.suggestQuestions", "Suggest questions")}
                </>
              )}
            </Button>
          }
        />
        <CardBody>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={withHint(
                t("wordpress.reVisible.searchPrompts", "Search questions"),
              )}
              className="sm:max-w-sm"
            />
            <Select value={intentFilter} onValueChange={setIntentFilter}>
              <SelectTrigger className="sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("wordpress.reVisible.allIntents", "All kinds")}
                </SelectItem>
                {PROMPT_INTENTS.map((intent) => (
                  <SelectItem key={intent} value={intent}>
                    {intentLabel(intent)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-12 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {prompts.length === 0
                ? t(
                    "wordpress.reVisible.promptsEmpty",
                    "No questions yet. Suggest some from your site content, or add one below.",
                  )
                : t("wordpress.reVisible.promptsNoMatch", "Nothing matches that.")}
            </p>
          ) : (
            <ul className="divide-y">
              {filtered.map((prompt) => {
                const open = openPromptId === prompt.id;

                return (
                  <li key={prompt.id} className="py-2 first:pt-0">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => onOpenPrompt(open ? null : prompt.id)}
                        className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        {open ? (
                          <ChevronDown className="size-4" aria-hidden />
                        ) : (
                          <ChevronRight className="size-4" aria-hidden />
                        )}
                        <span className="sr-only">
                          {t("wordpress.reVisible.showAnswers", "Show answers")}
                        </span>
                      </button>

                      <div className="min-w-0 flex-1">
                        <p
                          className={
                            prompt.active
                              ? "text-sm"
                              : "text-sm text-muted-foreground line-through"
                          }
                        >
                          {prompt.text}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary" className="text-[10px]">
                            {intentLabel(prompt.intent)}
                          </Badge>
                          {prompt.topic ? (
                            <span className="text-[11px] text-muted-foreground">
                              {prompt.topic}
                            </span>
                          ) : null}
                          {prompt.source === "ai" ? (
                            <span className="text-[11px] text-muted-foreground">
                              {t("wordpress.reVisible.suggested", "suggested")}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <Switch
                          checked={prompt.active}
                          disabled={saving}
                          aria-label={
                            prompt.active
                              ? t(
                                  "wordpress.reVisible.stopAsking",
                                  "Stop asking this",
                                )
                              : t(
                                  "wordpress.reVisible.startAsking",
                                  "Start asking this again",
                                )
                          }
                          onCheckedChange={(active) =>
                            onUpdate(prompt.id, { active })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={() => onDelete(prompt.id)}
                          aria-label={t("wordpress.reVisible.remove", "Remove")}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      </div>
                    </div>

                    {open ? (
                      <div className="mt-3 pl-6">
                        <PromptRunsDetail
                          pluginUuid={pluginUuid}
                          promptId={prompt.id}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row">
            <Textarea
              value={newText}
              onChange={(event) => setNewText(event.target.value)}
              rows={2}
              placeholder={t(
                "wordpress.reVisible.newPromptPlaceholder",
                "Who installs heat pumps in Cologne?",
              )}
              className="flex-1"
            />
            <div className="flex gap-2 sm:flex-col">
              <Select
                value={newIntent}
                onValueChange={(value) => setNewIntent(value as PromptIntent)}
              >
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROMPT_INTENTS.map((intent) => (
                    <SelectItem key={intent} value={intent}>
                      {intentLabel(intent)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => {
                  if (!newText.trim()) return;
                  onAdd(newText.trim(), newIntent);
                  setNewText("");
                }}
                disabled={!newText.trim() || saving}
              >
                <Plus className="size-3.5" aria-hidden />
                {t("wordpress.reVisible.addQuestion", "Add")}
              </Button>
            </div>
          </div>
        </CardBody>
      </SectionCard>

      {candidates ? (
        <SectionCard>
          <CardHeader
            icon={<Sparkles className="size-4" aria-hidden />}
            title={t("wordpress.reVisible.candidatesTitle", "Suggested questions")}
            subtitle={t(
              "wordpress.reVisible.candidatesSubtitle",
              "Nothing is tracked until you add it. Untick anything a real buyer would not type.",
            )}
            action={
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCandidates(null)}
                >
                  {t("wordpress.reVisible.discard", "Discard")}
                </Button>
                <Button
                  size="sm"
                  disabled={accepted.length === 0 || saving}
                  onClick={() => {
                    onAccept(accepted);
                    setCandidates(null);
                  }}
                >
                  {t("wordpress.reVisible.addSelected", "Add {{count}}", {
                    count: accepted.length,
                  })}
                </Button>
              </div>
            }
          />
          <CardBody>
            {candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t(
                  "wordpress.reVisible.candidatesEmpty",
                  "Nothing new came back. Every suggestion was already on the list.",
                )}
              </p>
            ) : (
              <ul className="divide-y">
                {candidates.map((candidate) => {
                  const on = !rejected.has(candidate.text);

                  return (
                    <li
                      key={candidate.text}
                      className="flex items-start gap-3 py-2.5 first:pt-0"
                    >
                      <Switch
                        checked={on}
                        onCheckedChange={(next) => {
                          setRejected((prev) => {
                            const copy = new Set(prev);
                            if (next) copy.delete(candidate.text);
                            else copy.add(candidate.text);
                            return copy;
                          });
                        }}
                        aria-label={candidate.text}
                      />
                      <div className="min-w-0">
                        <p className={on ? "text-sm" : "text-sm text-muted-foreground"}>
                          {candidate.text}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <Badge variant="secondary" className="text-[10px]">
                            {intentLabel(candidate.intent)}
                          </Badge>
                          {candidate.topic ? (
                            <span className="text-[11px] text-muted-foreground">
                              {candidate.topic}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </SectionCard>
      ) : null}

      <InfoNote>
        {t(
          "wordpress.reVisible.promptCostNote",
          "Each question is asked of every engine several times a week, because the same question gets a different answer each time. Keeping the list tight keeps the numbers meaningful and the cost predictable.",
        )}
      </InfoNote>
    </div>
  );
}
