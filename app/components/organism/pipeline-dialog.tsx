import { Globe, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import type { Pipeline } from "~/lib/api/pipelines";
import { useCreatePipeline, useUpdatePipeline } from "~/lib/hooks/usePipelines";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";

/**
 * Create or edit a pipeline.
 *
 * One dialog for both, because they ask the same three questions and a board
 * created with the wrong visibility must be fixable in the same words it was
 * made with. Before this, a pipeline was edited in three places — the title
 * renamed in place, the description typed into a borderless input beneath it,
 * and its visibility buried in /settings/pipelines — and no single screen
 * showed you what a pipeline actually was.
 *
 * `pipeline` absent = create.
 */
export function PipelineDialog({
  open,
  pipeline,
  onOpenChange,
}: {
  open: boolean;
  /** The pipeline being edited; omit to create a new one. */
  pipeline?: Pipeline;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createMutation = useCreatePipeline();
  const updateMutation = useUpdatePipeline();

  const editing = !!pipeline;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [confirmPrivate, setConfirmPrivate] = useState(false);

  // Seeded on open, not on mount: the dialog outlives the pipeline it was last
  // opened for, and reopening it on a different board must not show the old one.
  useEffect(() => {
    if (!open) return;
    setName(pipeline?.name ?? "");
    setDescription(pipeline?.description ?? "");
    setIsPublic(pipeline?.public_tracking_enabled ?? false);
    setConfirmPrivate(false);
  }, [open, pipeline]);

  const pending = createMutation.isPending || updateMutation.isPending;
  const trimmed = name.trim();

  /**
   * Going public → private is the one irreversible thing this dialog does:
   * every link already sent stops working immediately, and the customers
   * holding them are never told. Everything else here is a rename.
   */
  const revoking = editing && pipeline!.public_tracking_enabled && !isPublic;

  const save = () => {
    if (!trimmed) return;

    if (editing) {
      updateMutation.mutate(
        {
          pipelineId: pipeline!.id,
          payload: {
            name: trimmed,
            description: description.trim() || null,
            public_tracking_enabled: isPublic,
          },
        },
        {
          onSuccess: () => {
            onOpenChange(false);
            toast.success(
              t("pipeline.pipelineSaved", { defaultValue: "Pipeline saved." }),
            );
          },
          onError: (err) =>
            toast.error(
              extractErrorMessage(err) ||
                t("pipeline.errors.pipelineSaveFailed", {
                  defaultValue: "Could not save pipeline.",
                }),
            ),
        },
      );
      return;
    }

    createMutation.mutate(
      {
        name: trimmed,
        ...(description.trim() ? { description: description.trim() } : {}),
        public_tracking_enabled: isPublic,
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

  const submit = () => {
    if (revoking) {
      setConfirmPrivate(true);
      return;
    }
    save();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? t("pipeline.editPipelineTitle", {
                    defaultValue: "Edit pipeline",
                  })
                : t("pipeline.createPipelineTitle", {
                    defaultValue: "New pipeline",
                  })}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t("pipeline.pipelineDialogHint", {
                defaultValue:
                  "Name this board, describe what runs through it, and choose whether customers can track their deals.",
              })}
            </DialogDescription>
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

            <VisibilityChoice
              value={isPublic}
              disabled={pending}
              onChange={setIsPublic}
            />

            {revoking ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">
                {t("pipeline.visibility.revokeWarning", {
                  defaultValue:
                    "Every tracking link already sent will stop working as soon as you save.",
                })}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button type="button" onClick={submit} disabled={!trimmed || pending}>
              {editing
                ? t("common.save", { defaultValue: "Save" })
                : t("pipeline.createPipelineTitle", {
                    defaultValue: "New pipeline",
                  })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmPrivate} onOpenChange={setConfirmPrivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("pipeline.visibility.revokeTitle", {
                defaultValue: "Make this pipeline private?",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("pipeline.visibility.revokeBody", {
                defaultValue:
                  "Every tracking link already sent to a customer stops working immediately, and nobody is told. Turning it public again issues the same links, not new ones.",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                setConfirmPrivate(false);
                save();
              }}
            >
              {t("pipeline.visibility.revokeConfirm", {
                defaultValue: "Make private",
              })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Private or public, as two named states rather than a switch.
 *
 * A bare toggle labelled "Customer tracking" leaves the off state unnamed, and
 * the reader has to infer what not-tracking means. Two cards say both outcomes
 * out loud, and each carries its consequence in a sentence — which is the only
 * part anyone actually needs to read.
 *
 * Radios, not buttons: this is a choice between mutually exclusive states, and
 * arrow keys should move between them.
 */
function VisibilityChoice({
  value,
  disabled,
  onChange,
}: {
  value: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  const { t } = useTranslation();

  const options = [
    {
      isPublic: false,
      Icon: Lock,
      label: t("pipeline.visibility.private", { defaultValue: "Private" }),
      hint: t("pipeline.visibility.privateHint", {
        defaultValue: "Deals on this board stay inside the workspace.",
      }),
    },
    {
      isPublic: true,
      Icon: Globe,
      label: t("pipeline.visibility.public", { defaultValue: "Public" }),
      hint: t("pipeline.visibility.publicHint", {
        defaultValue:
          "Each deal gets a private link a customer can open to track their order.",
      }),
    },
  ];

  return (
    <fieldset className="space-y-1.5" disabled={disabled}>
      <legend className="text-sm font-medium leading-none">
        {t("pipeline.visibility.label", { defaultValue: "Customer tracking" })}
      </legend>
      <div className="grid gap-2 pt-1">
        {options.map((option) => {
          const selected = value === option.isPublic;
          return (
            <label
              key={String(option.isPublic)}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                selected
                  ? "border-foreground bg-muted/50"
                  : "border-border hover:bg-muted/30",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="radio"
                name="pipeline-visibility"
                className="sr-only"
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(option.isPublic)}
              />
              {/* The dot is drawn rather than native so it can sit inside a
                  full-width hit target — the whole card is the control. */}
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  selected ? "border-foreground" : "border-muted-foreground/40",
                )}
              >
                {selected ? (
                  <span className="size-2 rounded-full bg-foreground" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <option.Icon className="size-3.5 text-muted-foreground" aria-hidden />
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  {option.hint}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
