import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Bot, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { AiKeyBanner } from "~/components/ai-assistants/AiKeyBanner";
import { AssistantStatusBadge } from "~/components/ai-assistants/AssistantStatusBadge";
import { CreateAssistantWizard } from "~/components/ai-assistants/CreateAssistantWizard";
import { WidgetTypeIcon } from "~/components/ai-assistants/WidgetTypeIcon";
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
import { extractErrorMessage } from "~/lib/api/axios-instance";
import type { AssistantSummary } from "~/lib/api/ai-assistants";
import { useSearchShortcut } from "~/lib/hooks/useSearchShortcut";
import {
  useAiAssistants,
  useCanEditAiAssistants,
  useDeleteAssistant,
} from "~/lib/hooks/useAiAssistants";
import { cn } from "~/lib/utils";
import i18n from "~/i18n";

export function meta() {
  return [
    { title: `${i18n.t("aiAssistants.list.title")} · Repraesent` },
    { name: "description", content: i18n.t("aiAssistants.list.hint") },
  ];
}

export default function AiAssistantsIndexRoute() {
  const { t, i18n: i18next } = useTranslation();
  const navigate = useNavigate();
  const canEdit = useCanEditAiAssistants();
  const { data: assistants, isLoading } = useAiAssistants();
  const deleteMutation = useDeleteAssistant();

  const [search, setSearch] = useState("");
  const { ref: searchInputRef, withHint } = useSearchShortcut();
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AssistantSummary | null>(
    null,
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assistants ?? [];
    return (assistants ?? []).filter((a) => a.name.toLowerCase().includes(q));
  }, [assistants, search]);

  const fail = (error: unknown) =>
    toast.error(t("common.failedToSave", { defaultValue: "Could not save" }), {
      description: extractErrorMessage(error),
    });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18next.language, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  return (
    <div className="mx-auto w-full max-w-[1280px] p-4 sm:p-6 py-10! space-y-6 sm:space-y-8 app-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("aiAssistants.list.title")}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("aiAssistants.list.hint")}
          </p>
        </div>
        {canEdit ? (
          <Button onClick={() => setCreateOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4" />
            {t("aiAssistants.list.new")}
          </Button>
        ) : null}
      </div>

      <div className="border-t" />

      <AiKeyBanner />

      {(assistants?.length ?? 0) > 0 ? (
        <Input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={withHint(t("aiAssistants.list.search"))}
          className="max-w-xs"
        />
      ) : null}

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-16 text-center app-fade-up">
          <span className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/40">
            <Bot className="h-6 w-6 text-muted-foreground" aria-hidden />
          </span>
          <div className="space-y-1.5">
            <p className="font-medium">{t("aiAssistants.list.empty")}</p>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
              {t("aiAssistants.list.emptyHint")}
            </p>
          </div>
          {canEdit ? (
            <Button variant="outline" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("aiAssistants.list.new")}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a, index) => {
            const kbReady =
              a.sources_total > 0 && a.sources_ready === a.sources_total;
            return (
              <div
                key={a.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/ai-assistants/${a.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/ai-assistants/${a.id}`);
                  }
                }}
                className={cn(
                  `app-fade-up app-fade-up-d${Math.min(index + 1, 4)}`,
                  // Phones: a 2-column grid so the overflow menu is pinned to
                  // the top-right corner (where a thumb reaches for it) and the
                  // stats get a full-width row of their own instead of being
                  // squeezed against it. sm+ keeps the original single row.
                  "group grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-3 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20",
                  "sm:flex sm:items-center sm:justify-between sm:gap-4",
                )}
              >
                <div className="min-w-0 space-y-1.5">
                  {/* The name is the identity: it gets its own line rather than
                      competing with three chips for the same wrap. */}
                  <div className="truncate font-medium">{a.name}</div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <AssistantStatusBadge status={a.status} />
                    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                      <WidgetTypeIcon type={a.widget_type} />
                      {t(`aiAssistants.widgetType.${a.widget_type}`)}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums",
                        a.sources_total === 0
                          ? "border-border text-muted-foreground"
                          : kbReady
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
                      )}
                      title={t("aiAssistants.list.kbTitle")}
                    >
                      {t("aiAssistants.list.kb", {
                        ready: a.sources_ready,
                        total: a.sources_total,
                      })}
                    </span>
                  </div>
                  {/* One line on every width: the slug gives way, the date —
                      the part that changes — always stays readable. */}
                  <p className="flex items-baseline gap-1 text-xs text-muted-foreground">
                    <span className="truncate font-mono">{a.slug}</span>
                    <span aria-hidden>·</span>
                    <span className="shrink-0">
                      {t("aiAssistants.list.updated")}{" "}
                      {formatDate(a.updated_at)}
                    </span>
                  </p>
                </div>

                <div className="sm:order-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={a.name}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenuItem
                        onSelect={() => navigate(`/ai-assistants/${a.id}`)}
                      >
                        {t("aiAssistants.list.open")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          navigate(`/ai-assistants/${a.id}?tab=conversations`)
                        }
                      >
                        {t("aiAssistants.list.viewConversations")}
                      </DropdownMenuItem>
                      {canEdit ? (
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setPendingDelete(a)}
                        >
                          <Trash2 className="h-4 w-4" />
                          {t("common.delete", { defaultValue: "Delete" })}
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {/* Phones: full-width footer under a hairline. sm+: back inline,
                    before the menu (order-2/3 below). */}
                <div className="col-span-2 flex items-center gap-6 border-t border-border/60 pt-3 sm:order-2 sm:col-span-1 sm:border-0 sm:pt-0">
                  <Stat
                    value={a.conversations_30d}
                    label={t("aiAssistants.list.conversations30d")}
                  />
                  <Stat
                    value={a.leads_30d}
                    label={t("aiAssistants.list.leads30d")}
                  />
                </div>

              </div>
            );
          })}
        </div>
      )}

      <CreateAssistantWizard open={createOpen} onOpenChange={setCreateOpen} />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
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
                pendingDelete &&
                deleteMutation.mutate(pendingDelete.id, {
                  onSuccess: () => {
                    toast.success(t("aiAssistants.list.deleted"));
                    setPendingDelete(null);
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

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="py-0.5 text-left sm:px-2 sm:py-1 sm:text-right">
      <div
        className={cn(
          "text-lg font-semibold tabular-nums leading-none",
          value === 0 && "text-muted-foreground",
        )}
      >
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
