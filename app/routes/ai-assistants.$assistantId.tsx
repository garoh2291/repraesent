import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  ArrowLeft,
  AlertCircle,
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
import { cn } from "~/lib/utils";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { useWorkspaceAi } from "~/lib/hooks/useWorkspaceAi";
import { useAutosave } from "~/lib/hooks/useAutosave";
import { extractErrorMessage, extractIssues } from "~/lib/api/axios-instance";
import { revealField } from "~/components/ai-assistants/FieldAnchor";
import {
  issueFromServer,
  issuesByTab,
  mergeIssues,
  validateDraft,
  type AssistantIssue,
} from "~/lib/ai-assistants/validate";
import {
  EMPTY_FALLBACK_CONTACT,
  updateAssistant,
  withProfileDefaults,
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
    business_name: a.business_name ?? "",
    business_description: a.business_description,
    business_profile: withProfileDefaults(a.business_profile),
    retrieval: { rerank: a.retrieval?.rerank ?? false },
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
  /**
   * What the API rejected on the last save — merged into the local list so a
   * rule only the backend knows still lands on the right tab and field instead
   * of dying in a toast.
   */
  const [serverIssues, setServerIssues] = useState<AssistantIssue[]>([]);

  useEffect(() => {
    if (!assistant) return;
    setDraft(toDraft(assistant));
    setDirty(false);
    setServerIssues([]);
  }, [assistant?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = useCallback((p: Partial<AssistantDraft>) => {
    setDraft((prev) => (prev ? { ...prev, ...p } : prev));
    setDirty(true);
    // Anything the server rejected is stale the moment the draft moves; the
    // local mirror re-reports whatever is still wrong on the next render.
    setServerIssues((prev) => (prev.length ? [] : prev));
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

  // From the DRAFT, not the saved record: the badges have to move while you
  // type, not only after a rejected save.
  const issues = useMemo(
    () => mergeIssues(validateDraft(draft), serverIssues),
    [draft, serverIssues],
  );
  const counts = useMemo(() => issuesByTab(issues), [issues]);

  /** Switch to the tab that owns the fix, then ring the control it names. */
  const goToIssue = useCallback(
    (issue: AssistantIssue) => {
      setTab(issue.tab);
      revealField(issue.path);
    },
    // setTab is a stable closure over setSearchParams
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const describeIssue = useCallback(
    (issue: AssistantIssue) => {
      if (issue.code === "server") {
        return issue.message ?? issue.path;
      }
      return t(`aiAssistants.validation.${issue.code}`, {
        locale: issue.locale?.toUpperCase() ?? "",
        defaultValue: issue.message ?? issue.path,
      });
    },
    [t],
  );

  // The profile is only sent when it actually moved: the server flips
  // `business_profile_mode` to "edited" on every PATCH that carries it, and an
  // untouched auto-extracted card must stay auto (recrawls keep refreshing it).
  const savedProfile = assistant?.business_profile;
  const payload = useMemo(() => {
    if (!draft) return null;
    const { business_description: _omit, business_profile, ...rest } = draft;
    const profileMoved =
      JSON.stringify(business_profile) !==
      JSON.stringify(withProfileDefaults(savedProfile));
    return {
      ...rest,
      ...(profileMoved ? { business_profile } : {}),
      name: draft.name.trim(),
      business_name: draft.business_name.trim(),
    };
  }, [draft, savedProfile]);

  // "Regenerate from website" answers with the whole record; the draft is
  // hydrated on ID alone, so the fresh facts have to be copied in by hand.
  // Not marked dirty: nothing here needs saving, it just arrived from the server.
  const onProfileRegenerated = useCallback((record: AssistantRecord) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            business_profile: withProfileDefaults(record.business_profile),
          }
        : prev,
    );
  }, []);

  // Autosave stays quiet: a toast every time you stop typing is noise, and the
  // button already reads "Saved". Pressing Save yourself is the one case that
  // deserves an acknowledgement.
  const manualSave = useRef(false);

  const save = () => {
    if (!payload || issues.length > 0) return;
    saveMutation.mutate(payload, {
      onSuccess: () => {
        setDirty(false);
        setServerIssues([]);
        if (manualSave.current) toast.success(t("aiAssistants.detail.saved"));
        manualSave.current = false;
      },
      onError: (error) => {
        manualSave.current = false;
        const found = extractIssues(error).map(issueFromServer);
        setServerIssues(found);
        if (found[0]) {
          goToIssue(found[0]);
          toast.error(t("aiAssistants.validation.saveBlocked"), {
            description: found[0].message,
          });
          return;
        }
        fail(error);
      },
    });
  };

  const publish = async () => {
    if (!payload) return;
    if (issues.length > 0) {
      goToIssue(issues[0]);
      return;
    }
    try {
      if (dirty) {
        await saveMutation.mutateAsync(payload);
        setDirty(false);
      }
      await publishMutation.mutateAsync();
      toast.success(t("aiAssistants.detail.publishedToast"));
    } catch (err) {
      const found = extractIssues(err).map(issueFromServer);
      if (found.length) {
        setServerIssues(found);
        goToIssue(found[0]);
        toast.error(t("aiAssistants.validation.saveBlocked"), {
          description: found[0].message,
        });
        return;
      }
      fail(err);
    }
  };

  const busy =
    saveMutation.isPending ||
    publishMutation.isPending ||
    unpublishMutation.isPending;

  // A live assistant republishes on save, so an invalid config must never be
  // allowed to autosave — it would reach visitors. `busy` is the in-flight
  // guard: while a save runs this is false, and it re-arms when the save
  // settles with the draft still dirty.
  const canAutosave = canEdit && dirty && !busy && issues.length === 0;
  useAutosave(canAutosave, save, [payload]);

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
  /** Only the current tab's issues — the other tabs' counts already say so. */
  const tabIssues = issues.filter((i) => i.tab === tab);

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
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        tabIndex={issues.length ? 0 : -1}
                        className="inline-flex"
                      >
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!dirty || busy || issues.length > 0}
                          onClick={() => {
                            manualSave.current = true;
                            save();
                          }}
                          className="text-white/80 hover:bg-white/10 hover:text-white disabled:text-white/40"
                        >
                          {saveMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : issues.length > 0 ? (
                            <AlertCircle className="h-4 w-4" />
                          ) : dirty ? (
                            <Save className="h-4 w-4" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          {saveMutation.isPending
                            ? t("aiAssistants.detail.savingAuto")
                            : dirty
                              ? t("aiAssistants.detail.save")
                              : t("aiAssistants.detail.savedAuto")}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {issues.length > 0 ? (
                      <TooltipContent className="max-w-xs">
                        {describeIssue(issues[0])}
                      </TooltipContent>
                    ) : null}
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* A disabled control has pointer-events:none, so the
                          tooltip hangs off the wrapper or it never fires. */}
                      <span
                        tabIndex={0}
                        className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/15 px-3"
                      >
                        <Globe
                          className={cn(
                            "h-3.5 w-3.5",
                            isLive ? "text-emerald-400" : "text-white/40",
                          )}
                          aria-hidden
                        />
                        <Label
                          htmlFor="assistant-live-toggle"
                          className="cursor-pointer text-sm font-medium text-white/70"
                        >
                          {t("aiAssistants.detail.liveToggle")}
                        </Label>
                        {publishMutation.isPending ||
                        unpublishMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin text-white/70" />
                        ) : (
                          <Switch
                            id="assistant-live-toggle"
                            checked={isLive}
                            disabled={
                              busy ||
                              (!isLive && (!aiConfigured || issues.length > 0))
                            }
                            onCheckedChange={(next) => {
                              if (next) {
                                void publish();
                                return;
                              }
                              unpublishMutation.mutate(undefined, {
                                onSuccess: () =>
                                  toast.success(
                                    t("aiAssistants.detail.unpublishedToast"),
                                  ),
                                onError: fail,
                              });
                            }}
                            aria-label={t("aiAssistants.detail.liveToggle")}
                          />
                        )}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {!aiConfigured
                        ? t("aiAssistants.banner.publishDisabled")
                        : issues.length > 0 && !isLive
                          ? describeIssue(issues[0])
                          : isLive
                            ? t("aiAssistants.detail.liveTooltipOn")
                            : t("aiAssistants.detail.liveTooltipOff")}
                    </TooltipContent>
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
                <IssueBadge
                  count={counts[key] ?? 0}
                  label={t("aiAssistants.validation.badgeLabel", {
                    n: counts[key] ?? 0,
                  })}
                  onClick={() => {
                    const first = issues.find((i) => i.tab === key);
                    if (first) goToIssue(first);
                  }}
                />
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {tabIssues.length > 0 ? (
          <div className="app-fade-up mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-destructive">
              {t("aiAssistants.validation.bannerTitle", {
                n: tabIssues.length,
              })}
            </p>
            <ul className="mt-2 space-y-1">
              {tabIssues.slice(0, 8).map((issue) => (
                <li key={`${issue.code}-${issue.path}`}>
                  <button
                    type="button"
                    onClick={() => goToIssue(issue)}
                    className="text-left text-sm text-destructive underline-offset-2 hover:underline"
                  >
                    {describeIssue(issue)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <TabsContent value="knowledge" className="app-fade-up pt-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <KnowledgePanel
              assistantId={assistant.id}
              canEdit={canEdit}
              businessDescription={assistant.business_description}
              onDescriptionSaved={onDescriptionSaved}
              saveDescription={saveDescription}
              draft={draft}
              onChange={patch}
              profileMode={assistant.business_profile_mode ?? "auto"}
              profileUpdatedAt={assistant.business_profile_updated_at ?? null}
              onProfileRegenerated={onProfileRegenerated}
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

/** Mirrors the forms builder's tab-strip badge (`routes/forms.$formId.tsx`). */
function IssueBadge({
  count,
  label,
  onClick,
}: {
  count: number;
  label: string;
  onClick: () => void;
}) {
  if (count === 0) return null;
  return (
    <span
      role="button"
      tabIndex={-1}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold tabular-nums text-white"
    >
      {count}
    </span>
  );
}
