import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink,
  FilePen,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Trash2,
  Upload,
  Workflow as WorkflowIcon,
  Zap,
} from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import i18n from "~/i18n";
import { Button } from "~/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "~/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
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
  deleteWorkflow,
  listWorkflows,
  publishWorkflow,
  restoreWorkflow,
  setWorkflowStatus,
  type WorkflowSummary,
} from "~/lib/api/workflows";
import { normalizeLocale } from "~/i18n/locales";
import { starterGraph } from "~/lib/workflows/graph";
import {
  insertWorkflowIntoLists,
  patchWorkflowInLists,
  removeWorkflowFromLists,
  restoreSnapshots,
  type ListSnapshots,
} from "~/lib/workflows/optimistic";
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
  /**
   * Ids with a delete in flight. A second Delete on the same card would 404
   * and then "roll back" to a snapshot taken after the first one — putting the
   * card back on screen as though nothing had happened.
   */
  const [deleting, setDeleting] = useState<string[]>([]);

  const { data: workflows, isPending } = useQuery({
    queryKey: ["workflows"],
    queryFn: listWorkflows,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createWorkflow({
        name: name.trim(),
        graph: starterGraph("leads"),
        // The language the author is working in, not the column default of
        // German — a new workflow's email steps should open in the language
        // they are about to write.
        default_locale: normalizeLocale(i18next.language),
      }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setCreateOpen(false);
      setName("");
      navigate(`/workflows/${created.id}`);
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  /**
   * Every card action follows the pipeline board's pattern: patch the caches
   * in the handler, hand the snapshot to the mutation, roll it back if the
   * server disagrees. The badge changes on the click, not on the response.
   */
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["workflows"] });
    void queryClient.invalidateQueries({ queryKey: ["workflow"] });
  };

  const statusMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "active" | "paused" | "draft";
      snapshots: ListSnapshots;
    }) => setWorkflowStatus(id, status),
    onError: (error, vars) => {
      restoreSnapshots(queryClient, vars.snapshots);
      toast.error(extractErrorMessage(error));
    },
    onSettled: invalidate,
  });

  const publishMutation = useMutation({
    mutationFn: ({ id }: { id: string; snapshots: ListSnapshots }) =>
      publishWorkflow(id),
    onSuccess: (detail, vars) => {
      // The optimistic patch could not know the new published version id, and
      // that id is exactly what decides whether Activate and Back to draft are
      // offered next. Take the server's answer.
      patchWorkflowInLists(queryClient, vars.id, {
        status: detail.status,
        published_version_id: detail.published_version_id,
        has_unpublished_changes: detail.has_unpublished_changes,
      });
    },
    onError: (error, vars) => {
      restoreSnapshots(queryClient, vars.snapshots);
      // The server lists what is missing far better than the card could — it
      // has the graph and this list does not.
      toast.error(extractErrorMessage(error));
    },
    onSettled: invalidate,
  });

  const restoreMutation = useMutation({
    mutationFn: ({ workflow }: { workflow: WorkflowSummary; snapshots: ListSnapshots }) =>
      restoreWorkflow(workflow.id),
    onError: (error, vars) => {
      restoreSnapshots(queryClient, vars.snapshots);
      toast.error(extractErrorMessage(error));
    },
    onSettled: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: ({ workflow }: { workflow: WorkflowSummary; snapshots: ListSnapshots }) =>
      deleteWorkflow(workflow.id),
    onError: (error, vars) => {
      restoreSnapshots(queryClient, vars.snapshots);
      toast.error(extractErrorMessage(error));
    },
    onSuccess: (_data, vars) => {
      // No confirmation dialog on the way in — an undo that works is a better
      // guarantee than a dialog everybody learns to click through. Long enough
      // to notice the card is gone and change your mind.
      toast.success(t("workflows.deleted"), {
        duration: 10_000,
        action: {
          label: t("common.undo", { defaultValue: "Undo" }),
          onClick: () => undoDelete(vars.workflow),
        },
      });
    },
    onSettled: (_data, _error, vars) => {
      setDeleting((ids) => ids.filter((id) => id !== vars.workflow.id));
      invalidate();
    },
  });

  const changeStatus = (
    workflow: WorkflowSummary,
    status: "active" | "paused" | "draft",
  ) => {
    void queryClient.cancelQueries({ queryKey: ["workflows"] });
    const snapshots = patchWorkflowInLists(queryClient, workflow.id, { status });
    statusMutation.mutate({ id: workflow.id, status, snapshots });
  };

  const publish = (workflow: WorkflowSummary) => {
    void queryClient.cancelQueries({ queryKey: ["workflows"] });
    // Publishing takes a draft live; an already-live workflow keeps the status
    // it has, which is what the server does too.
    const snapshots = patchWorkflowInLists(queryClient, workflow.id, {
      status: workflow.status === "draft" ? "active" : workflow.status,
      has_unpublished_changes: false,
    });
    publishMutation.mutate({ id: workflow.id, snapshots });
  };

  const remove = (workflow: WorkflowSummary) => {
    if (deleting.includes(workflow.id)) return;
    setDeleting((ids) => [...ids, workflow.id]);
    void queryClient.cancelQueries({ queryKey: ["workflows"] });
    const snapshots = removeWorkflowFromLists(queryClient, workflow.id);
    deleteMutation.mutate({ workflow, snapshots });
  };

  const undoDelete = (workflow: WorkflowSummary) => {
    void queryClient.cancelQueries({ queryKey: ["workflows"] });
    const snapshots = insertWorkflowIntoLists(queryClient, workflow);
    restoreMutation.mutate({ workflow, snapshots });
  };

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
              canEdit={canEdit}
              deleting={deleting.includes(workflow.id)}
              onOpen={() => navigate(`/workflows/${workflow.id}`)}
              onChangeStatus={changeStatus}
              onPublish={publish}
              onDelete={remove}
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
              {createMutation.isPending
                ? t("common.saving")
                : t("workflows.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * What you can do to a workflow from here.
 *
 * One list, rendered twice — as a right-click menu on the card (the deal board
 * already teaches that gesture) and behind a ⋯ button (right-click is not
 * discoverable and does not exist on touch). Two renderings of one array, so
 * they can never drift apart.
 */
interface WorkflowAction {
  key: string;
  icon: ReactNode;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
  separatorBefore?: boolean;
}

function WorkflowCard({
  workflow,
  locale,
  canEdit,
  deleting,
  onOpen,
  onChangeStatus,
  onPublish,
  onDelete,
}: {
  workflow: WorkflowSummary;
  locale: string;
  canEdit: boolean;
  /** A delete is in flight for this card; a second one would undo the first. */
  deleting: boolean;
  onOpen: () => void;
  onChangeStatus: (
    workflow: WorkflowSummary,
    status: "active" | "paused" | "draft",
  ) => void;
  onPublish: (workflow: WorkflowSummary) => void;
  onDelete: (workflow: WorkflowSummary) => void;
}) {
  const { t } = useTranslation();

  const live = !!workflow.published_version_id;
  const actions: WorkflowAction[] = [
    {
      key: "open",
      icon: <ExternalLink />,
      label: t("workflows.contextOpen", { defaultValue: "Open workflow" }),
      onSelect: onOpen,
    },
  ];

  if (canEdit) {
    // Publish is only ever worth offering when there is something to publish:
    // saving already publishes a runnable draft, so the rest of the time this
    // would be a no-op wearing a verb.
    if (!live || workflow.has_unpublished_changes) {
      actions.push({
        key: "publish",
        icon: <Upload />,
        label: t("workflows.publish"),
        onSelect: () => onPublish(workflow),
        separatorBefore: true,
      });
    }

    if (workflow.status === "active") {
      actions.push({
        key: "pause",
        icon: <Pause />,
        label: t("workflows.pause"),
        onSelect: () => onChangeStatus(workflow, "paused"),
        separatorBefore: !live || workflow.has_unpublished_changes ? false : true,
      });
    } else {
      // Disabled rather than hidden: "you cannot activate this yet" is the
      // useful answer, and hiding it would leave a never-published workflow
      // looking like it has no way forward.
      actions.push({
        key: "activate",
        icon: <Play />,
        label: t("workflows.activate"),
        onSelect: () => onChangeStatus(workflow, "active"),
        disabled: !live,
        separatorBefore: !live || workflow.has_unpublished_changes ? false : true,
      });
    }

    if (live && workflow.status !== "draft") {
      actions.push({
        key: "draft",
        icon: <FilePen />,
        label: t("workflows.backToDraft", { defaultValue: "Back to draft" }),
        onSelect: () => onChangeStatus(workflow, "draft"),
      });
    }

    actions.push({
      key: "delete",
      icon: <Trash2 />,
      label: t("common.delete", { defaultValue: "Delete" }),
      onSelect: () => onDelete(workflow),
      disabled: deleting,
      destructive: true,
      separatorBefore: true,
    });
  }

  const card = (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group flex cursor-pointer flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/30 sm:p-5"
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

        <div className="flex shrink-0 items-start gap-1">
          <StatusBadge status={workflow.status} />
          {actions.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="-mr-1 -mt-1 h-7 w-7 text-muted-foreground transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 data-[state=open]:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={workflow.name}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52"
                onClick={(e) => e.stopPropagation()}
              >
                {actions.map((action) => (
                  <Fragment key={action.key}>
                    {action.separatorBefore ? <DropdownMenuSeparator /> : null}
                    <DropdownMenuItem
                      disabled={action.disabled}
                      variant={action.destructive ? "destructive" : "default"}
                      onSelect={action.onSelect}
                    >
                      {action.icon}
                      {action.label}
                    </DropdownMenuItem>
                  </Fragment>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
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
    </div>
  );

  // Viewers get the plain card — every action past Open is a write.
  if (!canEdit) return card;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{card}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        {actions.map((action) => (
          <Fragment key={action.key}>
            {action.separatorBefore ? <ContextMenuSeparator /> : null}
            <ContextMenuItem
              disabled={action.disabled}
              variant={action.destructive ? "destructive" : "default"}
              onSelect={action.onSelect}
            >
              {action.icon}
              {action.label}
            </ContextMenuItem>
          </Fragment>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function StatusBadge({ status }: { status: WorkflowSummary["status"] }) {
  const { t } = useTranslation();

  const tone =
    status === "active"
      ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
      : status === "paused"
        ? "border-amber-400/40 bg-amber-400/10 text-amber-800 dark:text-amber-200"
        : "border-border bg-muted/50 text-muted-foreground";

  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <span
        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}
      >
        {t(`workflows.status.${status}`)}
      </span>
      {/*
        No "unpublished changes" caption: saving publishes, so it no longer
        describes anything an author can act on. The only remaining case is a
        workflow too incomplete to run, which the builder explains far better
        than a caption here could.
      */}
    </span>
  );
}
