import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { useCreatePipeline } from "~/lib/hooks/usePipelines";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

/**
 * "New pipeline" dialog (sidebar +). Creates the pipeline — seeded with the
 * standard deal stages server-side — and navigates onto its empty board.
 */
export function CreatePipelineDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createMutation = useCreatePipeline();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
    }
  }, [open]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createMutation.mutate(
      {
        name: trimmed,
        ...(description.trim() ? { description: description.trim() } : {}),
      },
      {
        onSuccess: (created) => {
          onOpenChange(false);
          toast.success(
            t("pipeline.pipelineCreated", { defaultValue: "Pipeline created." }),
          );
          void navigate(`/pipeline?p=${created.id}`);
        },
        onError: (err) =>
          toast.error(
            extractErrorMessage(err) ||
              t("pipeline.errors.pipelineCreateFailed", {
                defaultValue: "Could not create pipeline.",
              }),
          ),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("pipeline.createPipelineTitle", {
              defaultValue: "New pipeline",
            })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pipeline-name">
              {t("pipeline.pipelineNameLabel", { defaultValue: "Name" })}
            </Label>
            <Input
              id="pipeline-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              maxLength={80}
              autoFocus
              placeholder={t("pipeline.pipelineNamePlaceholder", {
                defaultValue: "e.g. Enterprise sales",
              })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pipeline-description">
              {t("pipeline.pipelineDescriptionLabel", {
                defaultValue: "Description (optional)",
              })}
            </Label>
            <Textarea
              id="pipeline-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={t("pipeline.pipelineDescriptionPlaceholder", {
                defaultValue: "What runs through this pipeline?",
              })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={!name.trim() || createMutation.isPending}
          >
            {t("pipeline.createPipelineTitle", {
              defaultValue: "New pipeline",
            })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
