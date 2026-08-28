import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutTemplate, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  createEmailTemplate,
  deleteEmailTemplate,
  listEmailTemplates,
  type EmailTemplateSummary,
} from "~/lib/api/email-templates";
import { normalizeLocale } from "~/i18n/locales";
import { formatDateMedium } from "~/lib/utils/format";
import { ConfirmDeleteDialog } from "~/components/molecule/confirm-delete-dialog";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { useSearchShortcut } from "~/lib/hooks/useSearchShortcut";

export default function EmailTemplatesIndex() {
  const { t, i18n: i18next } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useDocumentMeta({
    titleKey: "emailCampaigns.templates.metaTitle",
    titleSuffix: " - Repraesent",
  });

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const { ref: searchInputRef, withHint } = useSearchShortcut();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [pendingDelete, setPendingDelete] =
    useState<EmailTemplateSummary | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["email-templates", debouncedSearch],
    queryFn: () =>
      listEmailTemplates({ page: 1, limit: 100, search: debouncedSearch }),
  });

  const create = useMutation({
    mutationFn: () =>
      createEmailTemplate({
        name: newName.trim(),
        // The language the author is working in. Without this the server falls
        // back to the column default and every new template opened in German.
        default_locale: normalizeLocale(i18next.language),
      }),
    onSuccess: (template) => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      navigate(`/email-templates/${template.id}`);
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: deleteEmailTemplate,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["email-templates"] }),
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const templates = data?.data ?? [];

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 p-4 py-10! sm:space-y-8 sm:p-6 app-fade-in">
      <div className="flex flex-col gap-3 app-fade-up sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {t("emailCampaigns.templates.title", {
              defaultValue: "Email templates",
            })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("emailCampaigns.templates.subtitle", {
              defaultValue:
                "Reusable designs for campaigns, workflows and one-off emails.",
            })}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("emailCampaigns.templates.create", {
            defaultValue: "New template",
          })}
        </Button>
      </div>

      <Input
        ref={searchInputRef}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={withHint(
          t("emailCampaigns.templates.searchPlaceholder", {
            defaultValue: "Search templates…",
          }),
        )}
        className="max-w-sm"
      />

      {isPending ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("common.loading", { defaultValue: "Loading…" })}
        </p>
      ) : templates.length === 0 ? (
        <div className="app-fade-up flex flex-col items-center gap-3 rounded-2xl border border-dashed px-4 py-16 text-center">
          <LayoutTemplate className="h-8 w-8 text-muted-foreground/50" />
          <div>
            <p className="font-medium">
              {t("emailCampaigns.templates.emptyTitle", {
                defaultValue: "No templates yet",
              })}
            </p>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              {t("emailCampaigns.templates.emptyHint", {
                defaultValue:
                  "Build a design once, then use it in campaigns, workflows, forms and the composer.",
              })}
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} variant="outline">
            <Plus className="mr-1.5 h-4 w-4" />
            {t("emailCampaigns.templates.create", {
              defaultValue: "New template",
            })}
          </Button>
        </div>
      ) : (
        <div className="app-fade-up app-fade-up-d1 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onDelete={() => setPendingDelete(template)}
            />
          ))}
        </div>
      )}

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => !next && setPendingDelete(null)}
        name={pendingDelete?.name ?? null}
        description={t("emailCampaigns.templates.deleteConfirm", {
          defaultValue:
            "Campaigns already sent keep the copy they were sent with, but anything still using this template will lose it. This cannot be undone.",
        })}
        busy={remove.isPending}
        onConfirm={() => {
          if (pendingDelete) remove.mutate(pendingDelete.id);
          setPendingDelete(null);
        }}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t("emailCampaigns.templates.create", {
                defaultValue: "New template",
              })}
            </DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("emailCampaigns.templates.namePlaceholder", {
              defaultValue: "Template name",
            })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) create.mutate();
            }}
          />
          <DialogFooter>
            <Button
              onClick={() => create.mutate()}
              disabled={!newName.trim() || create.isPending}
            >
              {create.isPending
                ? t("common.creating", { defaultValue: "Creating…" })
                : t("common.create", { defaultValue: "Create" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateCard({
  template,
  onDelete,
}: {
  template: EmailTemplateSummary;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="group relative rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
      <Link to={`/email-templates/${template.id}`} className="block space-y-2">
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium">{template.name}</span>
          {template.current_version > 0 ? (
            <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              v{template.current_version}
              {template.has_unpublished_changes ? " *" : ""}
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {t("emailCampaigns.templates.draftBadge", {
                defaultValue: "Draft",
              })}
            </span>
          )}
        </div>
        {template.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {template.description}
          </p>
        ) : null}
        {/* `pr-10` clears the delete button pinned to the bottom-right corner,
            which would otherwise land on top of the date on hover. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-10">
          {template.complete_locales.map((locale) => (
            <span
              key={locale}
              className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground"
            >
              {locale}
            </span>
          ))}
          {/* When it was last touched. Every other list in the app carries this
              and the template library did not, which made it the one place you
              could not tell a live asset from an abandoned one. */}
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {t("emailCampaigns.templates.updatedAt", {
              defaultValue: "Updated {{when}}",
              when: formatDateMedium(template.updated_at),
            })}
          </span>
        </div>
      </Link>
      <button
        type="button"
        onClick={onDelete}
        aria-label={t("common.delete", { defaultValue: "Delete" })}
        className="absolute bottom-3 right-3 rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
