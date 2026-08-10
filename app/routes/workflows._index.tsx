import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Workflow as WorkflowIcon, Zap } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import i18n from "~/i18n";
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
import { Skeleton } from "~/components/ui/skeleton";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  createWorkflow,
  listWorkflows,
  type WorkflowSummary,
} from "~/lib/api/workflows";
import { starterGraph } from "~/lib/workflows/graph";
import { useCanEditForms } from "~/lib/hooks/useCanEditForms";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";

export function meta() {
  return [
    { title: `${i18n.t("workflows.metaTitle")} - Repraesent` },
    { name: "description", content: i18n.t("workflows.metaDescription") },
  ];
}

export default function WorkflowsIndex() {
  const { t, i18n: i18next } = useTranslation();
  useDocumentMeta({
    titleKey: "workflows.metaTitle",
    descriptionKey: "workflows.metaDescription",
    titleSuffix: " - Repraesent",
  });

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canEdit = useCanEditForms();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");

  const { data: workflows, isPending } = useQuery({
    queryKey: ["workflows"],
    queryFn: listWorkflows,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createWorkflow({ name: name.trim(), graph: starterGraph("leads") }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setCreateOpen(false);
      setName("");
      navigate(`/workflows/${created.id}`);
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const list = workflows ?? [];

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 p-4 py-10! sm:space-y-8 sm:p-6 app-fade-in">
      <div className="flex flex-col gap-3 app-fade-up sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {t("workflows.title")}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("workflows.subtitle")}
          </p>
        </div>
        {canEdit && list.length > 0 ? (
          <Button
            onClick={() => setCreateOpen(true)}
            className="h-10 w-full gap-1.5 bg-foreground px-4 text-background hover:bg-foreground/90 hover:text-background sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            {t("workflows.new")}
          </Button>
        ) : null}
      </div>

      <div className="border-t border-border" />

      {isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center app-fade-up">
          <span
            aria-hidden
            className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl border border-border bg-muted/40 text-muted-foreground"
          >
            <WorkflowIcon className="h-5 w-5" />
          </span>
          <p className="font-medium">{t("workflows.emptyTitle")}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {t("workflows.emptyHint")}
          </p>
          {canEdit ? (
            <Button
              onClick={() => setCreateOpen(true)}
              className="mt-4 h-10 gap-1.5 bg-foreground px-4 text-background hover:bg-foreground/90 hover:text-background"
            >
              <Plus className="h-4 w-4" />
              {t("workflows.new")}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 app-fade-up app-fade-up-d1 lg:grid-cols-2">
          {list.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              locale={i18next.language}
              onOpen={() => navigate(`/workflows/${workflow.id}`)}
            />
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("workflows.new")}</DialogTitle>
            <DialogDescription>{t("workflows.newHint")}</DialogDescription>
          </DialogHeader>
          <form
            id="create-workflow"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) createMutation.mutate();
            }}
            className="space-y-2"
          >
            <Label htmlFor="wf-name">{t("workflows.nameLabel")}</Label>
            <Input
              id="wf-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("workflows.namePlaceholder")}
            />
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              form="create-workflow"
              disabled={!name.trim() || createMutation.isPending}
              className="bg-foreground text-background hover:bg-foreground/90 hover:text-background"
            >
              {createMutation.isPending ? t("common.saving") : t("workflows.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WorkflowCard({
  workflow,
  locale,
  onOpen,
}: {
  workflow: WorkflowSummary;
  locale: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/30 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{workflow.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {workflow.entity
              ? t(`workflows.entity.${workflow.entity}`)
              : t("workflows.noTrigger")}
            {workflow.trigger_type
              ? ` · ${t(`workflows.trigger.type_${workflow.trigger_type}`)}`
              : ""}
          </p>
        </div>
        <StatusBadge status={workflow.status} unpublished={workflow.has_unpublished_changes} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Zap className="h-3 w-3" />
          {t("workflows.runsLast7", { count: workflow.runs_7d })}
        </span>
        {workflow.failed_7d > 0 ? (
          <span className="text-destructive">
            {t("workflows.failedLast7", { count: workflow.failed_7d })}
          </span>
        ) : null}
        {workflow.last_run_at ? (
          <span>
            {t("workflows.lastRun", {
              when: new Date(workflow.last_run_at).toLocaleString(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function StatusBadge({
  status,
  unpublished,
}: {
  status: WorkflowSummary["status"];
  unpublished: boolean;
}) {
  const { t } = useTranslation();

  const tone =
    status === "active"
      ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
      : status === "paused"
        ? "border-amber-400/40 bg-amber-400/10 text-amber-800 dark:text-amber-200"
        : "border-border bg-muted/50 text-muted-foreground";

  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}>
        {t(`workflows.status.${status}`)}
      </span>
      {unpublished ? (
        <span className="text-[10px] text-muted-foreground">
          {t("workflows.unpublishedChanges")}
        </span>
      ) : null}
    </span>
  );
}
