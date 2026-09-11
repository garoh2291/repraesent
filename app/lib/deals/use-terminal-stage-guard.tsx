import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ReopenDealConfirmModal,
  type ReopenConfirmPhase,
} from "~/components/organism/reopen-deal-confirm-modal";
import { resolveStageLabel } from "~/lib/pipeline-stages/labels";
import type { PipelineStage } from "~/lib/api/pipeline-stages";

/** The little a guarded deal has to expose. */
export interface GuardableDeal {
  id: string;
  title: string | null;
  stage: string;
  won_at?: string | null;
  lost_at?: string | null;
}

/**
 * Confirms before a deal leaves a won or lost stage.
 *
 * A hook rather than a check inside one drag handler, because there are three
 * ways to move a deal and putting the guard in the most obvious one is exactly
 * how the other two end up unguarded: the kanban's drag AND its card context
 * menu (both funnel through `moveDealToStage`), and the stage stepper on the
 * deal page.
 *
 * `Cmd/Ctrl+Z` undo deliberately does NOT go through here. Undo restores a state
 * the user was already in a moment ago; making it argue back would make undo
 * feel broken, and the thing it is undoing was itself confirmed.
 *
 * The categories come from the stage map both surfaces already hold, so this
 * costs no extra fetch.
 */
export function useTerminalStageGuard({
  byKey,
  onProceed,
}: {
  byKey: Map<string, PipelineStage>;
  /** Run the actual move. Called immediately when no confirmation is needed. */
  onProceed: (dealId: string, stage: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [pendingMove, setPendingMove] = useState<{
    deal: GuardableDeal;
    stage: string;
    fromCategory: "won" | "lost";
  } | null>(null);
  const [phase, setPhase] = useState<ReopenConfirmPhase>("confirm");

  const requestStageChange = useCallback(
    (deal: GuardableDeal, targetStage: string) => {
      if (deal.stage === targetStage) return;

      const from = byKey.get(deal.stage)?.category;
      const to = byKey.get(targetStage)?.category;

      // Only LEAVING a terminal stage is guarded. Entering one is a deliberate
      // act with its own affordance, and moving between won and lost keeps the
      // deal decided either way.
      const leavingTerminal =
        (from === "won" || from === "lost") && to !== "won" && to !== "lost";

      if (!leavingTerminal) {
        onProceed(deal.id, targetStage);
        return;
      }

      setPhase("confirm");
      setPendingMove({
        deal,
        stage: targetStage,
        fromCategory: from as "won" | "lost",
      });
    },
    [byKey, onProceed],
  );

  const confirm = useCallback(() => {
    if (!pendingMove) return;
    setPhase("saving");
    onProceed(pendingMove.deal.id, pendingMove.stage);
    setPendingMove(null);
    setPhase("confirm");
  }, [pendingMove, onProceed]);

  const outcomeDate = (() => {
    if (!pendingMove) return null;
    const raw =
      pendingMove.fromCategory === "won"
        ? pendingMove.deal.won_at
        : pendingMove.deal.lost_at;
    if (!raw) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Intl.DateTimeFormat(i18n.language, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(parsed);
  })();

  const targetStage = pendingMove ? byKey.get(pendingMove.stage) : undefined;

  const guardModal = pendingMove ? (
    <ReopenDealConfirmModal
      open
      phase={phase}
      dealName={
        pendingMove.deal.title?.trim() ||
        t("pipeline.untitledDeal", { defaultValue: "This deal" })
      }
      fromCategory={pendingMove.fromCategory}
      toStageLabel={
        targetStage
          ? resolveStageLabel(targetStage, t)
          : pendingMove.stage
      }
      outcomeDate={outcomeDate}
      onConfirm={confirm}
      onClose={() => {
        setPendingMove(null);
        setPhase("confirm");
      }}
    />
  ) : null;

  return { requestStageChange, guardModal };
}
