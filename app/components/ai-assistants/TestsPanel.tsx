import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FlaskConical,
  Loader2,
  Play,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Panel, PanelBody, PanelHeader } from "~/components/forms/chrome";
import { FieldHint, InfoNote } from "~/components/wordpress/fields";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { GuardChip } from "~/components/ai-assistants/GuardChip";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import type { AssistantTest, GuardDecision } from "~/lib/api/ai-assistants";
import { useAiTests, useTestMutations } from "~/lib/hooks/useAiAssistants";
import { cn } from "~/lib/utils";

/**
 * Regression questions: "does the assistant still find the right chunk for
 * this?" The cheap run checks retrieval only; the LLM run also grades the
 * answer for the expected keywords and costs tokens, so it asks first.
 */
export function TestsPanel({
  assistantId,
  canEdit,
}: {
  assistantId: string;
  canEdit: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { data: tests, isLoading } = useAiTests(assistantId);
  const m = useTestMutations(assistantId);
  const [question, setQuestion] = useState("");
  const [keywords, setKeywords] = useState("");
  const [confirmLlm, setConfirmLlm] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  const fail = (e: unknown) =>
    toast.error(t("common.failedToSave", { defaultValue: "Could not save" }), {
      description: extractErrorMessage(e),
    });

  const parseKeywords = (raw: string) =>
    raw
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 10);

  const add = () => {
    const q = question.trim();
    if (!q) return;
    m.create.mutate(
      { question: q, expected_keywords: parseKeywords(keywords) },
      {
        onSuccess: () => {
          setQuestion("");
          setKeywords("");
        },
        onError: fail,
      },
    );
  };

  const run = (body: { with_llm?: boolean; ids?: string[] }) => {
    setRunningId(body.ids?.[0] ?? "all");
    m.run.mutate(body, {
      onSuccess: (r) =>
        toast.success(
          t("aiAssistants.tests.ranToast", {
            passed: r.passed,
            failed: r.failed,
          }),
        ),
      onError: fail,
      onSettled: () => setRunningId(null),
    });
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  const count = tests?.length ?? 0;
  const passed = tests?.filter((x) => x.last_result?.passed).length ?? 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Panel>
        <PanelHeader
          icon={<FlaskConical className="h-3.5 w-3.5" />}
          title={t("aiAssistants.tests.title")}
          meta={
            count > 0 ? (
              <span className="text-[11px] tabular-nums text-muted-foreground/70">
                {t("aiAssistants.tests.summary", { passed, total: count })}
              </span>
            ) : null
          }
          action={
            canEdit && count > 0 ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={m.run.isPending}
                  onClick={() => run({})}
                >
                  {runningId === "all" && !confirmLlm ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  {t("aiAssistants.tests.runAll")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  loading={m.run.isPending && confirmLlm}
                  disabled={m.run.isPending}
                  onClick={() => setConfirmLlm(true)}
                >
                  {m.run.isPending && confirmLlm ? null : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {t("aiAssistants.tests.runLlm")}
                </Button>
              </div>
            ) : null
          }
        />
        <PanelBody>
          {canEdit ? (
            <form
              className="grid gap-2 rounded-xl border border-border bg-muted/30 p-3 @sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]"
              onSubmit={(e) => {
                e.preventDefault();
                add();
              }}
            >
              <Input
                value={question}
                maxLength={300}
                placeholder={t("aiAssistants.tests.questionPlaceholder")}
                onChange={(e) => setQuestion(e.target.value)}
                className="h-9 bg-background"
              />
              <Input
                value={keywords}
                maxLength={300}
                placeholder={t("aiAssistants.tests.keywordsPlaceholder")}
                onChange={(e) => setKeywords(e.target.value)}
                className="h-9 bg-background"
              />
              <Button
                type="submit"
                size="sm"
                className="h-9"
                loading={m.create.isPending}
                disabled={!question.trim()}
              >
                {m.create.isPending ? null : <Plus className="h-3.5 w-3.5" />}
                {t("aiAssistants.tests.add")}
              </Button>
            </form>
          ) : null}

          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : count === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("aiAssistants.tests.empty")}
            </p>
          ) : (
            <ul className="divide-y divide-border/70 rounded-xl border border-border">
              {tests!.map((x) => (
                <TestRow
                  key={x.id}
                  test={x}
                  canEdit={canEdit}
                  running={runningId === x.id}
                  formatDate={formatDate}
                  onRun={() => run({ ids: [x.id] })}
                  onDelete={() => m.remove.mutate(x.id, { onError: fail })}
                />
              ))}
            </ul>
          )}
        </PanelBody>
      </Panel>

      <aside className="space-y-3 lg:sticky lg:top-[var(--ai-stick,5.5rem)] lg:self-start">
        <InfoNote>{t("aiAssistants.tests.note1")}</InfoNote>
        <InfoNote>{t("aiAssistants.tests.note2")}</InfoNote>
      </aside>

      <AlertDialog open={confirmLlm} onOpenChange={setConfirmLlm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("aiAssistants.tests.llmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("aiAssistants.tests.llmBody", { count })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmLlm(false);
                run({ with_llm: true });
              }}
            >
              {t("aiAssistants.tests.runLlm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TestRow({
  test: x,
  canEdit,
  running,
  formatDate,
  onRun,
  onDelete,
}: {
  test: AssistantTest;
  canEdit: boolean;
  running: boolean;
  formatDate: (iso: string) => string;
  onRun: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const r = x.last_result;
  const state: "pass" | "fail" | "never" = !r
    ? "never"
    : r.passed
      ? "pass"
      : "fail";
  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <span
        className={cn(
          "mt-0.5 inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
          state === "pass" &&
            "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
          state === "fail" &&
            "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
          state === "never" && "border-border text-muted-foreground",
        )}
      >
        {t(`aiAssistants.tests.state.${state}`)}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm">{x.question}</p>
        {x.expected_keywords.length > 0 ? (
          <p className="flex flex-wrap gap-1">
            {x.expected_keywords.map((k) => (
              <span
                key={k}
                className={cn(
                  "rounded-md px-1.5 py-0.5 font-mono text-[10px]",
                  r?.missing_keywords.includes(k)
                    ? "bg-red-500/10 text-red-700 line-through dark:text-red-300"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {k}
              </span>
            ))}
          </p>
        ) : null}
        {r ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <GuardChip decision={r.decision as GuardDecision} />
            <span className="tabular-nums">
              {t("aiAssistants.tests.similarity")}{" "}
              {r.best_similarity != null ? r.best_similarity.toFixed(2) : "—"}
            </span>
            {r.with_llm ? <span>{t("aiAssistants.tests.withLlm")}</span> : null}
            <span>{formatDate(r.ran_at)}</span>
          </p>
        ) : null}
        {r?.answer ? (
          <p
            className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground"
            title={r.answer}
          >
            {r.answer}
          </p>
        ) : null}
      </div>
      {canEdit ? (
        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={running}
            onClick={onRun}
            aria-label={t("aiAssistants.tests.run")}
          >
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            onClick={onDelete}
            aria-label={t("common.delete", { defaultValue: "Delete" })}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}
    </li>
  );
}
