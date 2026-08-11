import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { FieldHint } from "~/components/wordpress/fields";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  testWorkflow,
  type RecentRecord,
  type WorkflowEntity,
} from "~/lib/api/workflows";

/**
 * Dry-run against a real record.
 *
 * Nothing is sent: conditions are evaluated for real, delays collapse to zero,
 * and every step is recorded with the fully rendered email so the Runs tab can
 * show exactly what would have gone out.
 */
export function TestRunDialog({
  open,
  onOpenChange,
  workflowId,
  entity,
  presetRecord,
  dirty,
  onSaveFirst,
  onFinished,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string;
  entity: WorkflowEntity;
  /** Whoever the builder is previewing as; saves retyping an id. */
  presetRecord: RecentRecord | null;
  dirty: boolean;
  onSaveFirst: () => Promise<unknown>;
  onFinished: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [entityId, setEntityId] = useState(presetRecord?.id ?? "");

  // Follow the builder's selection while the dialog is closed, so opening it
  // after picking someone does not present a stale id.
  useEffect(() => {
    if (!open) setEntityId(presetRecord?.id ?? "");
  }, [open, presetRecord?.id]);

  const runMutation = useMutation({
    mutationFn: async () => {
      // The tester runs the server's draft, so unsaved edits would not be the
      // thing being tested.
      if (dirty) await onSaveFirst();
      return testWorkflow(workflowId, { entity_id: entityId.trim() });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["workflow-runs", workflowId] });
      toast.success(
        result.simulatedPaths.length > 0
          ? t("workflows.testDone.simulated", {
              fields: result.simulatedPaths.join(", "),
            })
          : t("workflows.testDone.plain"),
      );
      onOpenChange(false);
      setEntityId("");
      onFinished();
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            {t("workflows.testTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("workflows.testHint", { entity: t(`workflows.entity.${entity}`) })}
          </DialogDescription>
        </DialogHeader>

        <form
          id="wf-test"
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (entityId.trim()) runMutation.mutate();
          }}
        >
          <Label htmlFor="wf-entity-id">
            {t("workflows.testRecordId", { entity: t(`workflows.entity.${entity}`) })}
          </Label>
          <Input
            id="wf-entity-id"
            autoFocus
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
            className="font-mono text-xs"
          />
          <FieldHint>{t("workflows.testSimulateHint")}</FieldHint>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="wf-test"
            disabled={!entityId.trim() || runMutation.isPending}
            className="bg-foreground text-background hover:bg-foreground/90 hover:text-background"
          >
            {runMutation.isPending ? t("workflows.testRunning") : t("workflows.testRun")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
