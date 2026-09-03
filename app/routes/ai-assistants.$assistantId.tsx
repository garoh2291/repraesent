import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Globe,
  Loader2,
  MoreHorizontal,
  Save,
  Trash2,
} from "lucide-react";
import { ActionsPanel } from "~/components/ai-assistants/ActionsPanel";
import { AiKeyBanner } from "~/components/ai-assistants/AiKeyBanner";
import { AppearancePanel } from "~/components/ai-assistants/AppearancePanel";
import { AssistantStatusBadge } from "~/components/ai-assistants/AssistantStatusBadge";
import { BehaviourPanel } from "~/components/ai-assistants/BehaviourPanel";
import { ConversationsPanel } from "~/components/ai-assistants/ConversationsPanel";
import { KnowledgePanel } from "~/components/ai-assistants/KnowledgePanel";
import { LeadCapturePanel } from "~/components/ai-assistants/LeadCapturePanel";
import { PlaygroundPanel } from "~/components/ai-assistants/PlaygroundPanel";
import { PublishPanel } from "~/components/ai-assistants/PublishPanel";
import { TestsPanel } from "~/components/ai-assistants/TestsPanel";
import { UsageCard } from "~/components/ai-assistants/UsageCard";
import { UnsavedChangesGuard } from "~/components/forms/UnsavedChangesGuard";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { isWorkspaceAiNotConfigured } from "~/lib/api/workspace-ai";
import { useWorkspaceAi } from "~/lib/hooks/useWorkspaceAi";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  EMPTY_FALLBACK_CONTACT,
  updateAssistant,
  type AssistantDraft,
  type AssistantRecord,
} from "~/lib/api/ai-assistants";
import {
  useAiAssistant,
  useCanEditAiAssistants,
  useDeleteAssistant,
  usePublishAssistant,
  useUnpublishAssistant,
  useUpdateAssistant,
} from "~/lib/hooks/useAiAssistants";
import i18n from "~/i18n";

const TABS = [
  "knowledge",
  "behaviour",
  "appearance",
  "actions",
  "tests",
  "conversations",
  "publish",
  "playground",
] as const;
type Tab = (typeof TABS)[number];
/** v1 URLs still in bookmarks and emails. */
const LEGACY_TABS: Record<string, Tab> = { leads: "actions", share: "publish" };

export function meta() {
  return [{ title: `${i18n.t("aiAssistants.list.title")} · Repraesent` }];
}

function toDraft(a: AssistantRecord): AssistantDraft {
  return {
    name: a.name,
    widget_type: a.widget_type,
    business_description: a.business_description,
    chat_model: a.chat_model,
    temperature: a.temperature,
    max_output_tokens: a.max_output_tokens,
    daily_token_budget: a.daily_token_budget,
    allowed_domains: a.allowed_domains ?? [],
    persona: a.persona,
    appearance: a.appearance,
    lead_capture: a.lead_capture,
    actions: a.actions ?? [],
    answer_length: a.answer_length ?? "medium",
    fallback_contact: a.fallback_contact ?? EMPTY_FALLBACK_CONTACT,
  };
}

export default function AiAssistantDetailRoute() {
  const { assistantId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canEdit = useCanEditAiAssistants();

  const { data: assistant, isLoading } = useAiAssistant(assistantId);
  const saveMutation = useUpdateAssistant(assistantId);
  const publishMutation = usePublishAssistant(assistantId);
  const unpublishMutation = useUnpublishAssistant(assistantId);
  const deleteMutation = useDeleteAssistant();
  const { data: workspaceAi } = useWorkspaceAi();
  const aiConfigured =
    !workspaceAi || (workspaceAi.connected && workspaceAi.status !== "revoked");

  const tab: Tab = (() => {
    const wanted = searchParams.get("tab");
    return wanted && (TABS as readonly string[]).includes(wanted)
      ? (wanted as Tab)
      : "knowledge";
  })();
  const setTab = (next: string) =>
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === "knowledge") p.delete("tab");
        else p.set("tab", next);
        return p;
      },
      { replace: true },
    );

  // --- local draft -----------------------------------------------------------
  // Hydrated on ID alone: refetches after save/publish must not overwrite edits.
  const [draft, setDraft] = useState<AssistantDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (!assistant) return;
    setDraft(toDraft(assistant));
    setDirty(false);
  }, [assistant?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = useCallback((p: Partial<AssistantDraft>) => {
    setDraft((prev) => (prev ? { ...prev, ...p } : prev));
    setDirty(true);
  }, []);

  // The description autosaves on its own; keep the draft in step so a later
  // full Save does not re-send a stale copy over it.
  const saveDescription = useCallback(
    (value: string) =>
      updateAssistant(assistantId!, { business_description: value }),
    [assistantId],
  );
  const onDescriptionSaved = useCallback(
    (value: string) =>
      setDraft((prev) =>
        prev ? { ...prev, business_description: value } : prev,
      ),
    [],
  );

  const fail = (error: unknown) => {
    if (isWorkspaceAiNotConfigured(error)) {
      toast.error(t("aiAssistants.banner.title"), {
        description: t("aiAssistants.banner.body"),
        action: {
          label: t("aiAssistants.banner.openSettings"),
          onClick: () => navigate("/settings/ai"),
        },
      });
      return;
    }
    toast.error(t("common.failedToSave", { defaultValue: "Could not save" }), {
      description: extractErrorMessage(error),
    });
  };

  const payload = useMemo(() => {
    if (!draft) return null;
    const { business_description: _omit, ...rest } = draft;
    return { ...rest, name: draft.name.trim() };
  }, [draft]);

  const save = () => {
    if (!payload) return;
    saveMutation.mutate(payload, {
      onSuccess: () => {
        setDirty(false);
        toast.success(t("aiAssistants.detail.saved"));
      },
      onError: fail,
    });
  };

  const publish = async () => {
    if (!payload) return;
    try {
      if (dirty) {
        await saveMutation.mutateAsync(payload);
        setDirty(false);
      }
      await publishMutation.mutateAsync();
      toast.success(t("aiAssistants.detail.publishedToast"));
    } catch (err) {
      fail(err);
    }
  };

  const busy =
    saveMutation.isPending ||
    publishMutation.isPending ||
    unpublishMutation.isPending;

  if (isLoading || !assistant || !draft) {
    return (
      <div className="mx-auto w-full max-w-[1280px] space-y-6 p-4 sm:p-6">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-9 w-2/3 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const isLive = assistant.status === "published";

  return (
    <div
      className="mx-auto w-full max-w-[1280px] space-y-5 p-4 sm:p-6"
      style={{ "--ai-stick": "5.5rem" } as React.CSSProperties}
    >
      <UnsavedChangesGuard when={canEdit && dirty} />

      <div className="app-fade-down sticky top-0 z-30 -mx-4 bg-background/80 px-4 pb-3 pt-4 backdrop-blur sm:-mx-6 sm:px-6 sm:pt-6">
        <div className="overflow-hidden rounded-2xl bg-[#111113] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.35)]">
          <div className="flex min-w-0 flex-wrap items-center gap-2 px-4 py-2.5 sm:gap-3 sm:px-5">
            <Link
              to="/ai-assistants"
              aria-label={t("aiAssistants.detail.back")}
              title={t("aiAssistants.detail.back")}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-white/10 hover:text-white/80"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <Input
              value={draft.name}
              disabled={!canEdit}
              onChange={(e) => patch({ name: e.target.value })}
              aria-label={t("aiAssistants.create.nameLabel")}
              className="h-9 min-w-[10rem] flex-1 rounded-lg border-transparent bg-transparent px-0 text-lg font-semibold tracking-tight text-white shadow-none selection:bg-white/20 focus-visible:border-white/10 focus-visible:bg-white/5 focus-visible:px-2.5 disabled:opacity-100 sm:text-xl"
            />

            <AssistantStatusBadge
              tone="dark"
              status={assistant.status}
              hasUnpublishedChanges={assistant.has_unpublished_changes || dirty}
            />

            {canEdit ? (
              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!dirty || busy}
                  onClick={save}
                  className="text-white/80 hover:bg-white/10 hover:text-white disabled:text-white/40"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : dirty ? (
                    <Save className="h-4 w-4" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {dirty
                    ? t("aiAssistants.detail.save")
                    : t("aiAssistants.detail.saved")}
                </Button>
                {isLive ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      unpublishMutation.mutate(undefined, {
                        onSuccess: () =>
                          toast.success(
                            t("aiAssistants.detail.unpublishedToast"),
                          ),
                        onError: fail,
                      })
                    }
                    className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
                  >
                    {t("aiAssistants.detail.unpublish")}
                  </Button>
                ) : null}
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        tabIndex={aiConfigured ? -1 : 0}
                        className="inline-flex"
                      >
                        <Button
                          size="sm"
                          disabled={
                            !aiConfigured ||
                            busy ||
                            (isLive &&
                              !dirty &&
                              !assistant.has_unpublished_changes)
                          }
                          onClick={() => void publish()}
                          className="bg-white text-black hover:bg-white/90"
                        >
                          {publishMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Globe className="h-4 w-4" />
                          )}
                          {isLive
                            ? t("aiAssistants.detail.republish")
                            : t("aiAssistants.detail.publish")}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {!aiConfigured ? (
                      <TooltipContent>
                        {t("aiAssistants.banner.publishDisabled")}
                      </TooltipContent>
                    ) : null}
                  </Tooltip>
                </TooltipProvider>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t("common.actions", {
                        defaultValue: "Actions",
                      })}
                      className="text-white/60 hover:bg-white/10 hover:text-white"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("aiAssistants.detail.delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <AiKeyBanner />

      {!canEdit ? (
        <p className="text-sm text-muted-foreground">
          {t("aiAssistants.detail.readOnly")}
        </p>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="app-fade-up app-fade-up-d1 overflow-x-auto border-b border-border">
          <TabsList variant="line" className="-mb-px">
            {TABS.map((key) => (
              <TabsTrigger key={key} value={key}>
                {t(`aiAssistants.tabs.${key}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="knowledge" className="app-fade-up pt-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <KnowledgePanel
              assistantId={assistant.id}
              canEdit={canEdit}
              businessDescription={assistant.business_description}
              onDescriptionSaved={onDescriptionSaved}
              saveDescription={saveDescription}
            />
            <aside className="lg:sticky lg:top-[var(--ai-stick)] lg:self-start">
              <UsageCard
                assistantId={assistant.id}
                today={assistant.usage_today}
              />
            </aside>
          </div>
        </TabsContent>
        <TabsContent value="behaviour" className="app-fade-up pt-5">
          <BehaviourPanel draft={draft} canEdit={canEdit} onChange={patch} />
        </TabsContent>
        <TabsContent value="appearance" className="app-fade-up pt-5">
          <AppearancePanel draft={draft} canEdit={canEdit} onChange={patch} />
        </TabsContent>
        <TabsContent value="actions" className="app-fade-up space-y-5 pt-5">
          <ActionsPanel draft={draft} canEdit={canEdit} onChange={patch} />
          <LeadCapturePanel draft={draft} canEdit={canEdit} onChange={patch} />
        </TabsContent>
        <TabsContent value="tests" className="app-fade-up pt-5">
          <TestsPanel assistantId={assistant.id} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="publish" className="app-fade-up pt-5">
          <PublishPanel
            assistantId={assistant.id}
            status={assistant.status}
            hasUnpublishedChanges={assistant.has_unpublished_changes || dirty}
            widgetType={draft.widget_type}
          />
        </TabsContent>
        <TabsContent value="conversations" className="app-fade-up pt-5">
          <ConversationsPanel
            assistantId={assistant.id}
            assistantName={assistant.name}
          />
        </TabsContent>
        <TabsContent value="playground" className="app-fade-up pt-5">
          <PlaygroundPanel assistantId={assistant.id} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("aiAssistants.list.deleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("aiAssistants.list.deleteBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteMutation.mutate(assistant.id, {
                  onSuccess: () => {
                    setDirty(false);
                    toast.success(t("aiAssistants.list.deleted"));
                    navigate("/ai-assistants");
                  },
                  onError: fail,
                })
              }
            >
              {t("common.delete", { defaultValue: "Delete" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
