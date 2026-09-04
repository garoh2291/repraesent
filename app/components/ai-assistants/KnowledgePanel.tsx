import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Check, FileText, Globe, Loader2, Type } from "lucide-react";
import { toast } from "sonner";
import {
  GhostAction,
  Panel,
  PanelBody,
  PanelHeader,
  PanelSection,
} from "~/components/forms/chrome";
import { FieldHint } from "~/components/wordpress/fields";
import { Textarea } from "~/components/ui/textarea";
import { BusinessFactsCard } from "~/components/ai-assistants/BusinessFactsCard";
import { GapsPanel } from "~/components/ai-assistants/GapsPanel";
import { SourceDocumentsDrawer } from "~/components/ai-assistants/SourceDocumentsDrawer";
import {
  CrawlWebsiteDialog,
  TextSourceDialog,
} from "~/components/ai-assistants/AddSourceDialogs";
import { UploadDropzone } from "~/components/ai-assistants/UploadDropzone";
import { SourceRow, relativeTime } from "~/components/ai-assistants/SourceRow";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  getSourceText,
  type AssistantDraft,
  type AssistantRecord,
  type BusinessProfileMode,
  type KnowledgeSource,
  type SourceType,
} from "~/lib/api/ai-assistants";
import { useAiSources, useSourceMutations } from "~/lib/hooks/useAiAssistants";

interface Props {
  assistantId: string;
  canEdit: boolean;
  /** Saved value from the server — the autosave diffs against it. */
  businessDescription: string;
  onDescriptionSaved: (value: string) => void;
  saveDescription: (value: string) => Promise<unknown>;
  /** Main draft — the business facts ride the same autosave as every field. */
  draft: AssistantDraft;
  onChange: (patch: Partial<AssistantDraft>) => void;
  profileMode: BusinessProfileMode;
  profileUpdatedAt: string | null;
  onProfileRegenerated: (record: AssistantRecord) => void;
}

const GROUP_ORDER: SourceType[] = ["website", "document", "text"];
const GROUP_ICON: Record<SourceType, React.ReactNode> = {
  website: <Globe className="h-3.5 w-3.5" />,
  document: <FileText className="h-3.5 w-3.5" />,
  text: <Type className="h-3.5 w-3.5" />,
  description: <BookOpen className="h-3.5 w-3.5" />,
};

export function KnowledgePanel({
  assistantId,
  canEdit,
  businessDescription,
  onDescriptionSaved,
  saveDescription,
  draft,
  onChange,
  profileMode,
  profileUpdatedAt,
  onProfileRegenerated,
}: Props) {
  const { t, i18n } = useTranslation();
  const { data: sources, isLoading } = useAiSources(assistantId);
  const m = useSourceMutations(assistantId);

  // --- description autosave ------------------------------------------------
  const [description, setDescription] = useState(businessDescription);
  const [descState, setDescState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const lastSaved = useRef(businessDescription);
  useEffect(() => {
    setDescription(businessDescription);
    lastSaved.current = businessDescription;
  }, [assistantId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!canEdit || description === lastSaved.current) return;
    const timer = setTimeout(async () => {
      setDescState("saving");
      try {
        await saveDescription(description);
        lastSaved.current = description;
        onDescriptionSaved(description);
        setDescState("saved");
        setTimeout(() => setDescState("idle"), 2000);
      } catch (err) {
        setDescState("idle");
        toast.error(
          t("common.failedToSave", { defaultValue: "Could not save" }),
          {
            description: extractErrorMessage(err),
          },
        );
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [description, canEdit, saveDescription, onDescriptionSaved, t]);

  // --- dialogs ---------------------------------------------------------------
  const [crawlOpen, setCrawlOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeSource | null>(null);
  const [editingText, setEditingText] = useState("");
  const [viewingPages, setViewingPages] = useState<KnowledgeSource | null>(
    null,
  );

  const grouped = useMemo(() => {
    const map = new Map<SourceType, KnowledgeSource[]>();
    for (const s of sources ?? []) {
      if (s.type === "description") continue;
      map.set(s.type, [...(map.get(s.type) ?? []), s]);
    }
    return GROUP_ORDER.filter((k) => map.has(k)).map((k) => ({
      type: k,
      items: map.get(k)!,
    }));
  }, [sources]);

  const fail = (err: unknown) =>
    toast.error(t("common.failedToSave", { defaultValue: "Could not save" }), {
      description: extractErrorMessage(err),
    });

  const formatDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString(i18n.language, {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;
  const formatRelative = (iso: string) => relativeTime(iso, i18n.language);

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader
          icon={<BookOpen className="h-3.5 w-3.5" />}
          title={t("aiAssistants.knowledge.descriptionTitle")}
          action={
            <span
              aria-live="polite"
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
            >
              {descState === "saving" ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />
                  {t("aiAssistants.knowledge.saving")}
                </>
              ) : descState === "saved" ? (
                <>
                  <Check className="h-3 w-3 text-emerald-500" />
                  {t("aiAssistants.knowledge.saved")}
                </>
              ) : null}
            </span>
          }
        />
        <PanelBody>
          <FieldHint>{t("aiAssistants.knowledge.descriptionHint")}</FieldHint>
          <Textarea
            value={description}
            disabled={!canEdit}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("aiAssistants.knowledge.descriptionPlaceholder")}
            className="min-h-[140px] leading-relaxed"
            maxLength={4000}
          />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          icon={<Globe className="h-3.5 w-3.5" />}
          title={t("aiAssistants.knowledge.sourcesTitle")}
          meta={
            sources ? (
              <span className="text-[11px] tabular-nums text-muted-foreground/70">
                {t("aiAssistants.knowledge.readyCount", {
                  ready: sources.filter((s) => s.status === "ready").length,
                  total: sources.length,
                })}
              </span>
            ) : null
          }
          action={
            canEdit ? (
              <div className="flex gap-2">
                <GhostAction onClick={() => setCrawlOpen(true)}>
                  <Globe className="h-3.5 w-3.5" />
                  {t("aiAssistants.knowledge.crawl.action")}
                </GhostAction>
                <GhostAction
                  onClick={() => {
                    setEditing(null);
                    setTextOpen(true);
                  }}
                >
                  <Type className="h-3.5 w-3.5" />
                  {t("aiAssistants.knowledge.text.action")}
                </GhostAction>
              </div>
            ) : null
          }
        />
        <PanelBody>
          {canEdit ? (
            <PanelSection title={t("aiAssistants.knowledge.upload.title")}>
              <UploadDropzone upload={m.upload} />
            </PanelSection>
          ) : null}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              {t("common.loading", { defaultValue: "Loading…" })}
            </p>
          ) : grouped.length === 0 ? (
            <PanelSection>
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t("aiAssistants.knowledge.empty")}
              </p>
            </PanelSection>
          ) : (
            grouped.map((g) => (
              <PanelSection
                key={g.type}
                title={t(`aiAssistants.sourceType.${g.type}`)}
              >
                <ul className="divide-y divide-border/70 rounded-xl border border-border">
                  {g.items.map((s) => (
                    <SourceRow
                      key={s.id}
                      source={s}
                      icon={GROUP_ICON[s.type]}
                      canEdit={canEdit}
                      formatDate={formatDate}
                      formatRelative={formatRelative}
                      busy={
                        (m.resync.isPending && m.resync.variables === s.id) ||
                        (m.remove.isPending && m.remove.variables === s.id) ||
                        (m.update.isPending &&
                          (m.update.variables as { sourceId?: string } | undefined)
                            ?.sourceId === s.id)
                      }
                      onResync={() => m.resync.mutate(s.id, { onError: fail })}
                      onDelete={() => m.remove.mutate(s.id, { onError: fail })}
                      onToggle={(enabled) =>
                        m.update.mutate(
                          { sourceId: s.id, enabled },
                          { onError: fail },
                        )
                      }
                      onRecrawl={(recrawl_interval) =>
                        m.update.mutate(
                          { sourceId: s.id, recrawl_interval },
                          { onError: fail },
                        )
                      }
                      onViewPages={
                        s.type === "website"
                          ? () => setViewingPages(s)
                          : undefined
                      }
                      onEdit={
                        s.type === "text"
                          ? () => {
                              getSourceText(assistantId, s.id)
                                .then((txt) => {
                                  setEditing(s);
                                  setEditingText(txt.raw_text);
                                  setTextOpen(true);
                                })
                                .catch(fail);
                            }
                          : undefined
                      }
                    />
                  ))}
                </ul>
              </PanelSection>
            ))
          )}
        </PanelBody>
      </Panel>

      <BusinessFactsCard
        assistantId={assistantId}
        canEdit={canEdit}
        draft={draft}
        onChange={onChange}
        mode={profileMode}
        updatedAt={profileUpdatedAt}
        onRegenerated={onProfileRegenerated}
      />

      <GapsPanel assistantId={assistantId} canEdit={canEdit} />

      <SourceDocumentsDrawer
        assistantId={assistantId}
        source={viewingPages}
        onClose={() => setViewingPages(null)}
      />

      <CrawlWebsiteDialog
        open={crawlOpen}
        onOpenChange={setCrawlOpen}
        pending={m.create.isPending}
        onSubmit={(input) =>
          m.create.mutate(
            { type: "website", ...input },
            {
              onSuccess: () => {
                setCrawlOpen(false);
                toast.success(t("aiAssistants.knowledge.crawl.started"));
              },
              onError: fail,
            },
          )
        }
      />

      <TextSourceDialog
        open={textOpen}
        onOpenChange={setTextOpen}
        pending={m.create.isPending || m.update.isPending}
        initial={
          editing ? { title: editing.title, raw_text: editingText } : null
        }
        onSubmit={(input) => {
          const done = () => {
            setTextOpen(false);
            setEditing(null);
          };
          if (editing) {
            m.update.mutate(
              { sourceId: editing.id, ...input },
              { onSuccess: done, onError: fail },
            );
          } else {
            m.create.mutate(
              { type: "text", ...input },
              { onSuccess: done, onError: fail },
            );
          }
        }}
      />
    </div>
  );
}
