import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FlaskConical, Pause, Play, Save, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import i18n from "~/i18n";
import { NodeInspector } from "~/components/workflows/NodeInspector";
import { StepList } from "~/components/workflows/StepList";
import { RunsPanel } from "~/components/workflows/RunsPanel";
import { AnalyticsPanel } from "~/components/workflows/AnalyticsPanel";
import { PreviewAsPicker } from "~/components/workflows/PreviewAsPicker";
import { TestRunDialog } from "~/components/workflows/TestRunDialog";
import { WorkflowSettingsPanel } from "~/components/workflows/WorkflowSettingsPanel";
import {
  GhostAction,
  Panel,
  PanelBody,
  PanelHeader,
} from "~/components/forms/chrome";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { SUPPORTED_LOCALES } from "~/i18n/locales";
import {
  getFieldCatalog,
  getWorkflow,
  getWorkflowCapabilities,
  publishWorkflow,
  setWorkflowStatus,
  updateWorkflow,
  type NodeType,
  type RecentRecord,
  type TriggerConfig,
  type WorkflowGraph,
} from "~/lib/api/workflows";
import { getWorkspaceDetail } from "~/lib/api/workspaces";
import { publishBlockers, starterGraph, triggerOf } from "~/lib/workflows/graph";
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

  const { data: catalog } = useQuery({
    queryKey: ["workflow-field-catalog"],
    queryFn: getFieldCatalog,
  });

  const { data: capability } = useQuery({
    queryKey: ["workflow-capabilities"],
    queryFn: getWorkflowCapabilities,
  });

  // Members come from the workspace detail endpoint; there is no dedicated
  // members list, and this key is already warm elsewhere in the app.
  const { data: workspaceDetail } = useQuery({
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
   * What a template can interpolate: the record, its previous values, and
   * anything an earlier step returned. Built from the same catalogue the
   * conditions use, so the two never disagree about what a field is called.
   */
  const variables = useMemo(() => {
    const paths = fields.map((f) => `trigger.record.${f.path}`);
    const previous = fields
      .filter((f) => !f.dynamic)
      .map((f) => `trigger.old.${f.path}`);
    return [...paths, ...previous];
  }, [fields]);

  const selectedNode = useMemo(() => {
    if (!graph || !selectedId) return null;
    return graph.nodes.find((n) => n.id === selectedId) ?? null;
  }, [graph, selectedId]);

  const memberOptions = useMemo(
    () =>
      (workspaceDetail?.members ?? []).map((m) => {
        const full = `${m.user_first_name ?? ""} ${m.user_last_name ?? ""}`.trim();
        return {
          userId: m.user_id,
          label: full ? `${full} (${m.user_email})` : m.user_email,
        };
      }),
    [workspaceDetail],
  );

  const blockers = useMemo(
    () => (graph ? publishBlockers(graph, t, allSteps(graph)) : []),
    [graph, t],
  );

  // --- mutations -----------------------------------------------------------

  const saveMutation = useMutation({
    mutationFn: () =>
      updateWorkflow(workflowId!, { name: name.trim(), graph: graph! }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
      await queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setDirty(false);
      toast.success(t("workflows.saved"));
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      // Publish always reads the server's draft, so an unsaved edit would be
      // silently left behind.
      if (dirty) await updateWorkflow(workflowId!, { name: name.trim(), graph: graph! });
      return publishWorkflow(workflowId!);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
      await queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setDirty(false);
      toast.success(t("workflows.published"));
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const statusMutation = useMutation({
    mutationFn: (status: "active" | "paused") =>
      setWorkflowStatus(workflowId!, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
      await queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const patchGraph = (next: WorkflowGraph) => {
    setGraph(next);
    setDirty(true);
  };

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
        <p className="text-sm text-muted-foreground">{t("workflows.notFound")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-5 p-4 py-10! sm:p-6 app-fade-in">
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
                  workflow.status === "active"
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                    : "border-white/10 bg-white/5 text-white/50"
                }`}
              >
                {t(`workflows.status.${workflow.status}`)}
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
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <FlaskConical className="h-3.5 w-3.5" />
                {t("workflows.test")}
              </button>

              {workflow.published_version_id ? (
                <button
                  type="button"
                  onClick={() =>
                    statusMutation.mutate(
                      workflow.status === "active" ? "paused" : "active",
                    )
                  }
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {workflow.status === "active" ? (
                    <>
                      <Pause className="h-3.5 w-3.5" />
                      {t("workflows.pause")}
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" />
                      {t("workflows.activate")}
                    </>
                  )}
                </button>
              ) : null}

              <button
                type="button"
                disabled={!dirty || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-[#131515] transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <Save className="h-4 w-4" />
                {t("workflows.save")}
              </button>

              <button
                type="button"
                disabled={blockers.length > 0 || publishMutation.isPending}
                title={blockers[0]}
                onClick={() => publishMutation.mutate()}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-amber-400 px-4 text-sm font-medium text-[#131515] transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <Upload className="h-4 w-4" />
                {t("workflows.publish")}
              </button>
            </div>
          ) : null}
        </div>

        {blockers.length > 0 && canEdit ? (
          <div className="border-t border-white/5 px-4 py-2 text-xs text-amber-300/90 sm:px-5">
            {t("workflows.cannotPublish")}: {blockers.join(" · ")}
          </div>
        ) : null}
      </div>

      {/* --- tabs -------------------------------------------------------- */}
      <Tabs value={tab} onValueChange={setTab} className="app-fade-up app-fade-up-d1">
        <div className="border-b border-border">
          <TabsList variant="line" className="-mb-px">
            <TabsTrigger value="build">{t("workflows.tabBuild")}</TabsTrigger>
            <TabsTrigger value="settings">{t("workflows.tabSettings")}</TabsTrigger>
            <TabsTrigger value="runs">{t("workflows.tabRuns")}</TabsTrigger>
            <TabsTrigger value="analytics">{t("workflows.tabAnalytics")}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="build" className="pt-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
            <Panel>
              <PanelHeader title={t("workflows.stepsTitle")} />
              <PanelBody>
                <StepList
                  graph={graph}
                  selectedId={selectedId}
                  disabled={!canEdit}
                  onSelect={setSelectedId}
                  onAdd={(type: Exclude<NodeType, "trigger">, lane: LaneRef) => {
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

            <Panel>
              <PanelHeader
                title={
                  selectedNode
                    ? t(`workflows.node.${selectedNode.type}`)
                    : t("workflows.inspector.title")
                }
                action={
                  dirty ? (
                    <GhostAction onClick={() => saveMutation.mutate()}>
                      <Save className="h-4 w-4" />
                      {t("workflows.save")}
                    </GhostAction>
                  ) : null
                }
              />
              <PanelBody>
                <NodeInspector
                  node={selectedNode}
                  fields={fields}
                  dateFields={dateFields}
                  locales={[...SUPPORTED_LOCALES]}
                  activeLocale={activeLocale}
                  variables={variables}
                  members={memberOptions}
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
        </TabsContent>

        <TabsContent value="settings" className="pt-5">
          <WorkflowSettingsPanel
            workflow={workflow}
            fields={fields}
            disabled={!canEdit}
            onSaved={async () => {
              await queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
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
