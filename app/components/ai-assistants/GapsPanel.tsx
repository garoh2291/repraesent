import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import {
  AlertTriangle,
  HelpCircle,
  MessageSquareText,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Panel, PanelBody, PanelHeader } from "~/components/forms/chrome";
import { FieldHint } from "~/components/wordpress/fields";
import { Skeleton } from "~/components/ui/skeleton";
import { TextSourceDialog } from "~/components/ai-assistants/AddSourceDialogs";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import type { GapItem } from "~/lib/api/ai-assistants";
import {
  useAiGaps,
  useAiSources,
  useGapMutations,
  useSourceMutations,
} from "~/lib/hooks/useAiAssistants";

/**
 * Questions the assistant could not answer in the last 30 days, grouped by
 * normalised text. "Add answer" opens the text-source dialog prefilled with
 * the question so the fix is one paste away — and records a resolution, which
 * is what actually makes the row disappear: the gap itself is derived from
 * immutable message history and cannot clear itself.
 *
 * A row that comes back marked "unverified" is the honest case: the answer was
 * added, the question was re-asked through the real pipeline, and the assistant
 * still could not answer it.
 */
export function GapsPanel({
  assistantId,
  canEdit,
}: {
  assistantId: string;
  canEdit: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useAiGaps(assistantId, 30);
  const { data: sources } = useAiSources(assistantId);
  const m = useSourceMutations(assistantId);
  const gapM = useGapMutations(assistantId);
  const [answering, setAnswering] = useState<GapItem | null>(null);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, {
      day: "2-digit",
      month: "short",
    });

  const reasons = (g: GapItem) => {
    const out: string[] = [];
    if (g.gate) out.push(`${t("aiAssistants.gaps.reasons.gate")} ${g.gate}`);
    if (g.off_topic)
      out.push(`${t("aiAssistants.gaps.reasons.offTopic")} ${g.off_topic}`);
    if (g.dont_know)
      out.push(`${t("aiAssistants.gaps.reasons.dontKnow")} ${g.dont_know}`);
    return out.join(" · ");
  };

  const sourceTitle = (sourceId: string | null) =>
    sources?.find((s) => s.id === sourceId)?.title ?? null;

  const onDismiss = (g: GapItem) =>
    gapM.dismiss.mutate(g.question, {
      onSuccess: () =>
        toast.success(t("aiAssistants.gaps.dismissed"), {
          action: {
            label: t("aiAssistants.gaps.undo"),
            onClick: () => gapM.undo.mutate(g.normalized),
          },
        }),
      onError: (e) =>
        toast.error(t("common.failedToSave", { defaultValue: "Could not save" }), {
          description: extractErrorMessage(e),
        }),
    });

  return (
    <Panel>
      <PanelHeader
        icon={<HelpCircle className="h-3.5 w-3.5" />}
        title={t("aiAssistants.gaps.title")}
        meta={
          data ? (
            <span className="text-[11px] tabular-nums text-muted-foreground/70">
              {t("aiAssistants.gaps.total", { count: data.total_unanswered })}
            </span>
          ) : null
        }
      />
      <PanelBody>
        <FieldHint>{t("aiAssistants.gaps.hint")}</FieldHint>
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("aiAssistants.gaps.empty")}
          </p>
        ) : (
          <ul className="divide-y divide-border/70 rounded-xl border border-border">
            {data!.items.map((g) => (
              <li
                key={g.normalized}
                className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-start"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm">{g.question}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                    <span className="font-medium tabular-nums text-foreground">
                      ×{g.count}
                    </span>
                    {reasons(g) ? <span>{reasons(g)}</span> : null}
                    <span>
                      {t("aiAssistants.gaps.lastSeen", {
                        when: formatDate(g.last_at),
                      })}
                    </span>
                  </p>
                  {g.resolution_status === "unverified" ? (
                    <p className="flex flex-wrap items-center gap-1 pt-1 text-[11px] text-amber-600 dark:text-amber-500">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span>{t("aiAssistants.gaps.unverified")}</span>
                      {canEdit && sourceTitle(g.resolution_source_id) ? (
                        <button
                          type="button"
                          onClick={() => setAnswering(g)}
                          className="underline underline-offset-2 hover:no-underline"
                        >
                          {sourceTitle(g.resolution_source_id)}
                        </button>
                      ) : null}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {g.conversation_ids[0] ? (
                    <Link
                      to={`?tab=conversations&open=${g.conversation_ids[0]}`}
                      className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <MessageSquareText className="h-3.5 w-3.5" />
                      {t("aiAssistants.gaps.viewConversation")}
                    </Link>
                  ) : null}
                  {canEdit ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onDismiss(g)}
                        disabled={gapM.dismiss.isPending}
                        className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                        {t("aiAssistants.gaps.dismiss")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnswering(g)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-muted/40 px-2.5 text-xs transition-colors hover:bg-muted"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {g.resolution_status === "unverified"
                          ? t("aiAssistants.gaps.improveAnswer")
                          : t("aiAssistants.gaps.addAnswer")}
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelBody>

      <TextSourceDialog
        open={!!answering}
        onOpenChange={(o) => !o && setAnswering(null)}
        pending={m.create.isPending || gapM.resolve.isPending}
        initial={
          answering
            ? {
                title: answering.question.slice(0, 200),
                raw_text: `# ${answering.question}\n\n`,
              }
            : null
        }
        onSubmit={(input) => {
          const gap = answering;
          if (!gap) return;
          m.create.mutate(
            { type: "text", ...input },
            {
              onSuccess: (source) => {
                setAnswering(null);
                // The source alone changes nothing: without the resolution the
                // gap keeps showing until the message ages out.
                gapM.resolve.mutate(
                  { question: gap.question, source_id: source.id },
                  {
                    onSuccess: () =>
                      toast.success(t("aiAssistants.gaps.answerAdded"), {
                        action: {
                          label: t("aiAssistants.gaps.undo"),
                          onClick: () => gapM.undo.mutate(gap.normalized),
                        },
                      }),
                    onError: (e) =>
                      toast.error(t("aiAssistants.gaps.resolveFailed"), {
                        description: extractErrorMessage(e),
                      }),
                  },
                );
              },
              onError: (e) =>
                toast.error(
                  t("common.failedToSave", { defaultValue: "Could not save" }),
                  {
                    description: extractErrorMessage(e),
                  },
                ),
            },
          );
        }}
      />
    </Panel>
  );
}
