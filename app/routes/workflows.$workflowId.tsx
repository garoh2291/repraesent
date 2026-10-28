import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronRight,
  CircleAlert,
  FlaskConical,
  Power,
  Save,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import i18n from "~/i18n";
import { UnsavedChangesGuard } from "~/components/forms/UnsavedChangesGuard";
import { NodeInspector } from "~/components/workflows/NodeInspector";
import { StepList } from "~/components/workflows/StepList";
import { RunsPanel } from "~/components/workflows/RunsPanel";
import { AnalyticsPanel } from "~/components/workflows/AnalyticsPanel";
import { PreviewAsPicker } from "~/components/workflows/PreviewAsPicker";
import { TestRunDialog } from "~/components/workflows/TestRunDialog";
import { WorkflowSettingsPanel } from "~/components/workflows/WorkflowSettingsPanel";
import {
  Panel,
  PanelBody,
  PanelHeader,
} from "~/components/forms/chrome";
import { Input } from "~/components/ui/input";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Switch } from "~/components/ui/switch";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { SUPPORTED_LOCALES } from "~/i18n/locales";
import {
  discardWorkflowDraft,
  getFieldCatalog,
  getRecentRecords,
  getWorkflow,
  getWorkflowCapabilities,
  publishWorkflow,
  setWorkflowStatus,
  updateWorkflow,
  type NodeType,
  type RecentRecord,
  type TriggerConfig,
  type WorkflowDetail,
  type WorkflowGraph,
} from "~/lib/api/workflows";
import {
  markWorkflowsStale,
  patchWorkflowInLists,
  restoreSnapshots,
  type ListSnapshots,
} from "~/lib/workflows/optimistic";
import { getWorkspaceDetail } from "~/lib/api/workspaces";
import {
  publishProblems,
  starterGraph,
  triggerOf,
} from "~/lib/workflows/graph";
import {
  addToLane,
  allSteps,
  moveNode,
  removeNode,
  replaceConfig,
  type LaneRef,
} from "~/lib/workflows/tree";
import { useAuthContext } from "~/providers/auth-provider";
import { useCanEditForms } from "~/lib/hooks/useCanEditForms";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";

export function meta() {
  return [{ title: `${i18n.t("workflows.metaTitle")} - Repraesent` }];
}

export default function WorkflowBuilder() {
  const { workflowId } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canEdit = useCanEditForms();
  const { currentWorkspace } = useAuthContext();
  useDocumentMeta({
    titleKey: "workflows.metaTitle",
    titleSuffix: " - Repraesent",
  });

  const { data: workflow, isLoading } = useQuery({
    queryKey: ["workflow", workflowId],
    queryFn: () => getWorkflow(workflowId!),
    enabled: !!workflowId,
  });

  const { data: catalog, isLoading: catalogLoading } = useQuery({
    queryKey: ["workflow-field-catalog"],
    queryFn: getFieldCatalog,
  });

  const { data: capability } = useQuery({
    queryKey: ["workflow-capabilities"],
    queryFn: getWorkflowCapabilities,
  });

  // Members come from the workspace detail endpoint; there is no dedicated
  // members list, and this key is already warm elsewhere in the app.
  const { data: workspaceDetail, isLoading: membersLoading } = useQuery({
    queryKey: ["workspace-detail"],
    queryFn: getWorkspaceDetail,
    enabled: !!currentWorkspace?.id,
  });

  // --- local draft ---------------------------------------------------------
  // Same arrangement as the Forms builder: edit locally, save explicitly, so a
  // background refetch never yanks the graph out from under an edit.
  const [name, setName] = useState("");
  const [graph, setGraph] = useState<WorkflowGraph | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeLocale, setActiveLocale] = useState("en");
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState("build");
  const [testOpen, setTestOpen] = useState(false);
  // One record drives every live preview in the builder, so what you see in a
  // template is what that record would actually receive.
  const [previewRecord, setPreviewRecord] = useState<RecentRecord | null>(null);

  useEffect(() => {
    if (!workflow) return;
    setName(workflow.name);
    const next =
      workflow.graph.nodes.length > 0 ? workflow.graph : starterGraph("leads");
    setGraph(next);
    setSelectedId(triggerOf(next)?.id ?? null);
    setActiveLocale(workflow.default_locale);
    setDirty(false);
    // Keyed on id alone — re-hydrating on every mutation would discard edits.
  }, [workflow?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const trigger = graph ? triggerOf(graph) : null;
  const triggerConfig = trigger?.config as TriggerConfig | undefined;
  const entity = triggerConfig?.entity ?? "leads";

  useEffect(() => {
    setPreviewRecord(null);
  }, [entity]);

  const entityCatalog = useMemo(
    () => catalog?.find((c) => c.entity === entity),
    [catalog, entity],
  );

  const fields = entityCatalog?.fields ?? [];

  const dateFields = useMemo(
    () => fields.filter((f) => f.kind === "date").map((f) => f.path),
    [fields],
  );

  /**
   * The pipeline this workflow is limited to, when its trigger says so.
   *
   * A deal stage KEY can exist on several boards, so "set stage to won" is
   * ambiguous until a pipeline is named. Read from the trigger filter rather
   * than asked for again in the step: the author already answered it there,
   * and asking twice invites the two answers to disagree.
   */
  const pipelineScope = useMemo(() => {
    const match = triggerConfig?.filter?.conditions?.find(
      (c) =>
        "path" in c &&
        c.path === "pipeline_id" &&
        c.operator === "eq" &&
        typeof c.value === "string",
    );
    return match && "value" in match ? (match.value as string) : undefined;
  }, [triggerConfig]);

  const selectedNode = useMemo(() => {
    if (!graph || !selectedId) return null;
    return graph.nodes.find((n) => n.id === selectedId) ?? null;
  }, [graph, selectedId]);

  const memberOptions = useMemo(
    () =>
      (workspaceDetail?.members ?? []).map((m) => {
        const full =
          `${m.user_first_name ?? ""} ${m.user_last_name ?? ""}`.trim();
        return {
          userId: m.user_id,
          label: full ? `${full} (${m.user_email})` : m.user_email,
        };
      }),
    [workspaceDetail],
  );

  const problems = useMemo(
    () => (graph ? publishProblems(graph, t, allSteps(graph)) : []),
    [graph, t],
  );
  // "This is ready. Turn it on?" — shown after a save that left nothing to do
  // on a workflow that is not on yet. Cleared by any further edit.
  const [justReady, setJustReady] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  /** Open the step a "thing left" is about, and bring it into view. */
  const focusNode = (nodeId: string | null) => {
    setTab("build");
    if (!nodeId) return;
    setSelectedId(nodeId);
    requestAnimationFrame(() =>
      document
        .getElementById("workflow-inspector")
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  /**
   * No record picked for previews yet: take the most recent one, so an email
   * step shows a real filled-in message the moment it opens. None at all →
   * previews fall back to sample details, and say so.
   */
  const { data: recentForPreview } = useQuery({
    queryKey: ["workflow-recent-records", entity, ""],
    queryFn: () => getRecentRecords(entity, ""),
    enabled: !!workflow && !previewRecord,
    staleTime: 60_000,
  });
  useEffect(() => {
    if (!previewRecord && recentForPreview?.length) {
      setPreviewRecord(recentForPreview[0]);
    }
  }, [recentForPreview]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- mutations -----------------------------------------------------------

  const saveMutation = useMutation({
    mutationFn: () =>
      updateWorkflow(workflowId!, { name: name.trim(), graph: graph! }),
    onSuccess: async (saved) => {
      queryClient.setQueryData(["workflow", workflowId], saved);
      await queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setDirty(false);
      // Saving never publishes. Say what that means for something already on.
      const isOn = !!saved.published_version_id && saved.status !== "draft";
      toast.success(
        isOn && saved.has_unpublished_changes
          ? t("workflows.golive.savedNotLive")
          : t("workflows.saved"),
      );
      setJustReady(!isOn && problems.length === 0);
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  /**
   * "Turn on" and "Publish changes". Unsaved edits are saved first — nobody
   * means "publish the version from before my last edit".
   */
  const publishMutation = useMutation({
    mutationFn: async () => {
      if (dirty) {
        await updateWorkflow(workflowId!, { name: name.trim(), graph: graph! });
      }
      return publishWorkflow(workflowId!);
    },
    onSuccess: async (detail: WorkflowDetail, _vars, _ctx) => {
      const wasOn = !!workflow?.published_version_id && workflow.status !== "draft";
      queryClient.setQueryData(["workflow", workflowId], detail);
      setDirty(false);
      setJustReady(false);
      toast.success(
        wasOn ? t("workflows.golive.published") : t("workflows.golive.turnedOn"),
      );
      markWorkflowsStale(queryClient, workflowId);
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const discardMutation = useMutation({
    mutationFn: () => discardWorkflowDraft(workflowId!),
    onSuccess: (detail) => {
      queryClient.setQueryData(["workflow", workflowId], detail);
      setName(detail.name);
      setGraph(detail.graph);
      setSelectedId(triggerOf(detail.graph)?.id ?? null);
      setDirty(false);
      setDiscardOpen(false);
      toast.success(t("workflows.golive.discarded"));
      markWorkflowsStale(queryClient, workflowId);
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  /**
   * Optimistic, like the card menu on the list: the badge and this button's own
   * label both read the cache, so they flip in the same frame as the click
   * rather than a round trip later.
   */
  const statusMutation = useMutation({
    mutationFn: ({
      status,
    }: {
      status: "active" | "paused" | "draft";
      snapshots: ListSnapshots;
    }) => setWorkflowStatus(workflowId!, status),
    onSuccess: (detail) =>
      queryClient.setQueryData(["workflow", workflowId], detail),
    onError: (error, vars) => {
      restoreSnapshots(queryClient, vars.snapshots);
      toast.error(extractErrorMessage(error));
    },
    onSettled: () => markWorkflowsStale(queryClient, workflowId),
  });

  const changeStatus = (status: "active" | "paused" | "draft") => {
    void queryClient.cancelQueries({ queryKey: ["workflow", workflowId] });
    const snapshots = patchWorkflowInLists(queryClient, workflowId!, { status });
    statusMutation.mutate({ status, snapshots });
  };

  const patchGraph = (next: WorkflowGraph) => {
    setGraph(next);
    setDirty(true);
    setJustReady(false);
  };

  // "On" means published and not taken back to draft. Paused still counts as
  // on — it is live, switched off for now, and its edits need publishing.
  const isOn = !!workflow?.published_version_id && workflow.status !== "draft";

  if (isLoading || !graph) {
    return (
      <div className="mx-auto w-full max-w-[1280px] space-y-4 p-4 py-10! sm:p-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="mx-auto w-full max-w-[1280px] p-6">
        <p className="text-sm text-muted-foreground">
          {t("workflows.notFound")}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-5 p-4 py-10! sm:p-6 app-fade-in">
      {/* Saving is one button now, which makes losing the work to a stray
          click the obvious next hazard. Same guard the forms builder uses. */}
      <UnsavedChangesGuard
        when={dirty}
        titleKey="workflows.leaveTitle"
        bodyKey="workflows.leaveBody"
      />

      {/* --- command bar ----------------------------------------------- */}
      <div className="overflow-hidden rounded-2xl bg-[#111113] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.35)] app-fade-up">
        <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <Link
              to="/workflows"
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/35 transition-colors hover:text-white/60"
            >
              <ArrowLeft className="h-3 w-3" />
              {t("workflows.backToList")}
            </Link>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
              <Input
                value={name}
                disabled={!canEdit}
                onChange={(e) => {
                  setName(e.target.value);
                  setDirty(true);
                }}
                className="h-auto max-w-full border-0 bg-transparent p-0 text-lg font-semibold tracking-tight text-white shadow-none focus-visible:ring-0 sm:text-[22px]"
              />
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                  isOn && workflow.status === "active"
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                    : "border-white/10 bg-white/5 text-white/50"
                }`}
              >
                {!isOn
                  ? t("workflows.golive.stateOff")
                  : workflow.status === "active"
                    ? t("workflows.golive.stateOn")
                    : t("workflows.golive.statePaused")}
              </span>
            </div>
          </div>

          {canEdit ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <PreviewAsPicker
                entity={entity}
                selected={previewRecord}
                onSelect={setPreviewRecord}
              />

              <button
                type="button"
                onClick={() => setTestOpen(true)}
                // A test run executes the DRAFT, never the published version.
                // Saying so matters: a green test on a corrected draft reads as
                // proof the live workflow is fixed, and it is not.
                title={t("workflows.testRunsDraft", {
                  defaultValue:
                    "Runs the draft you are editing, not the published version",
                })}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <FlaskConical className="h-3.5 w-3.5" />
                {t("workflows.test")}
              </button>

              <button
                type="button"
                disabled={!dirty || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" />
                {t("workflows.save")}
              </button>

              {/* The one main button: what is left, Turn on, or the On switch. */}
              {problems.length > 0 ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-secondary px-3 text-sm font-medium text-secondary-foreground transition-opacity hover:opacity-90"
                    >
                      <CircleAlert className="h-3.5 w-3.5" />
                      {t("workflows.golive.thingsLeft", {
                        count: problems.length,
                      })}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] p-2">
                    <p className="px-2 pb-1.5 pt-1 text-xs text-muted-foreground">
                      {isOn
                        ? t("workflows.golive.thingsLeftHintLive")
                        : t("workflows.golive.thingsLeftHint")}
                    </p>
                    <ul className="space-y-0.5">
                      {problems.map((p, i) => (
                        <li key={`${p.nodeId}-${i}`}>
                          <button
                            type="button"
                            onClick={() => focusNode(p.nodeId)}
                            className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                          >
                            <span className="h-4 w-4 shrink-0 rounded-full border-2 border-foreground/30" />
                            <span className="min-w-0 flex-1">{p.message}</span>
                            {p.nodeId ? (
                              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </PopoverContent>
                </Popover>
              ) : !isOn ? (
                <button
                  type="button"
                  disabled={publishMutation.isPending}
                  onClick={() => publishMutation.mutate()}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-[#131515] transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  <Power className="h-4 w-4" />
                  {t("workflows.golive.turnOn")}
                </button>
              ) : null}

              {isOn ? (
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white/80">
                  <Switch
                    checked={workflow.status === "active"}
                    disabled={statusMutation.isPending}
                    onCheckedChange={(on) => changeStatus(on ? "active" : "paused")}
                    aria-label={t("workflows.golive.onSwitch")}
                  />
                  {workflow.status === "active"
                    ? t("workflows.golive.stateOn")
                    : t("workflows.golive.statePaused")}
                </label>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Saving does not publish. Something already on keeps running the
            version that was live until the owner publishes the edits. */}
        {canEdit && isOn && (workflow.has_unpublished_changes || dirty) ? (
          <div className="flex flex-col gap-2 bg-secondary px-4 py-2.5 text-secondary-foreground sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="min-w-0 text-sm">
              <span className="font-semibold">
                {t("workflows.golive.notLiveYet")}
              </span>
              <span className="block text-xs opacity-75 sm:ml-2 sm:inline">
                {t("workflows.golive.waitingKeepOld")}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={discardMutation.isPending || (!workflow.has_unpublished_changes && !dirty)}
                onClick={() => setDiscardOpen(true)}
                className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium underline-offset-2 hover:underline disabled:opacity-40"
              >
                {t("workflows.golive.discard")}
              </button>
              <button
                type="button"
                disabled={problems.length > 0 || publishMutation.isPending}
                title={problems.length > 0 ? t("workflows.golive.fixFirst") : undefined}
                onClick={() => publishMutation.mutate()}
                className="inline-flex h-9 items-center rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {t("workflows.golive.publishChanges")}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {canEdit && justReady && !isOn && problems.length === 0 && !dirty ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-secondary/40 p-4 sm:flex-row sm:items-center sm:justify-between app-fade-up">
          <div className="min-w-0">
            <p className="font-medium">{t("workflows.golive.readyTitle")}</p>
            <p className="text-sm text-muted-foreground">
              {t("workflows.golive.readyBody")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setJustReady(false)}
              className="inline-flex h-10 items-center rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground"
            >
              {t("workflows.golive.notYet")}
            </button>
            <button
              type="button"
              disabled={publishMutation.isPending}
              onClick={() => publishMutation.mutate()}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-medium text-background hover:opacity-90 disabled:opacity-40"
            >
              <Power className="h-4 w-4" />
              {t("workflows.golive.turnOn")}
            </button>
          </div>
        </div>
      ) : null}

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("workflows.golive.discardTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("workflows.golive.discardBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", { defaultValue: "Cancel" })}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                discardMutation.mutate();
              }}
            >
              {t("workflows.golive.discardConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- tabs -------------------------------------------------------- */}
      <Tabs
        value={tab}
        onValueChange={setTab}
        className="app-fade-up app-fade-up-d1"
      >
        <div className="border-b border-border">
          <TabsList variant="line" className="-mb-px">
            <TabsTrigger value="build">{t("workflows.tabBuild")}</TabsTrigger>
            <TabsTrigger value="settings">
              {t("workflows.tabSettings")}
            </TabsTrigger>
            <TabsTrigger value="runs">{t("workflows.tabRuns")}</TabsTrigger>
            <TabsTrigger value="analytics">
              {t("workflows.tabAnalytics")}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="build" className="pt-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
            <Panel>
              <PanelHeader title={t("workflows.stepsTitle")} />
              <PanelBody>
                <StepList
                  graph={graph}
                  fieldLabel={(path) =>
                    fields.find((f) => f.path === path)?.label
                  }
                  selectedId={selectedId}
                  disabled={!canEdit}
                  onSelect={setSelectedId}
                  onAdd={(
                    type: Exclude<NodeType, "trigger">,
                    lane: LaneRef,
                  ) => {
                    const result = addToLane(
                      graph,
                      lane,
                      type,
                      workflow.default_locale,
                    );
                    patchGraph(result.graph);
                    setSelectedId(result.nodeId);
                  }}
                  onRemove={(nodeId) => {
                    patchGraph(removeNode(graph, nodeId));
                    if (selectedId === nodeId) {
                      setSelectedId(triggerOf(graph)?.id ?? null);
                    }
                  }}
                  onMove={(nodeId, direction) =>
                    patchGraph(moveNode(graph, nodeId, direction))
                  }
                />
              </PanelBody>
            </Panel>

            <div id="workflow-inspector" className="min-w-0 scroll-mt-4">
            <Panel>
              {/* No Save here. There used to be one, calling the same mutation
                  as the command bar's — two buttons for one action, and this
                  one without the pending guard, so a double-click sent two
                  concurrent writes. The inspector edits the graph in memory on
                  every keystroke; saving is a single decision and belongs in
                  one place. */}
              <PanelHeader
                title={
                  selectedNode
                    ? t(`workflows.node.${selectedNode.type}`)
                    : t("workflows.inspector.title")
                }
              />
              <PanelBody>
                <NodeInspector
                  node={selectedNode}
                  entity={entity}
                  pipelineScope={pipelineScope}
                  fields={fields}
                  dateFields={dateFields}
                  locales={[...SUPPORTED_LOCALES]}
                  activeLocale={activeLocale}
                  members={memberOptions}
                  catalogLoading={catalogLoading || membersLoading}
                  capability={capability}
                  disabled={!canEdit}
                  workflowId={workflowId!}
                  previewRecord={previewRecord}
                  onLocaleChange={setActiveLocale}
                  onChange={(config) =>
                    selectedNode &&
                    patchGraph(replaceConfig(graph, selectedNode.id, config))
                  }
                />
              </PanelBody>
            </Panel>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="pt-5">
          <WorkflowSettingsPanel
            workflow={workflow}
            fields={fields}
            disabled={!canEdit}
            onSaved={async () => {
              await queryClient.invalidateQueries({
                queryKey: ["workflow", workflowId],
              });
              await queryClient.invalidateQueries({ queryKey: ["workflows"] });
            }}
            onDeleted={() => navigate("/workflows")}
          />
        </TabsContent>

        <TabsContent value="runs" className="pt-5">
          <RunsPanel workflowId={workflowId!} />
        </TabsContent>

        <TabsContent value="analytics" className="pt-5">
          <AnalyticsPanel workflowId={workflowId!} graph={graph} />
        </TabsContent>
      </Tabs>

      <TestRunDialog
        open={testOpen}
        onOpenChange={setTestOpen}
        workflowId={workflowId!}
        entity={entity}
        presetRecord={previewRecord}
        dirty={dirty}
        onSaveFirst={() => saveMutation.mutateAsync()}
        onFinished={() => setTab("runs")}
      />
    </div>
  );
}
