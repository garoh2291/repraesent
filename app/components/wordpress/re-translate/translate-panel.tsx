import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CornerDownLeft,
  ExternalLink,
  Search,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type { ReTranslateSettings } from "~/lib/wordpress/plugin-settings-types";
import type {
  TranslateContentItem,
  TranslateString,
} from "~/lib/api/wordpress-hub";
import { requestWpSsoLogin } from "~/lib/api/wordpress-hub";
import {
  useTranslateContent,
  useTranslateContentDetail,
  useSaveTranslateStrings,
  useMachineTranslateContent,
} from "~/lib/hooks/useWorkspaceReTranslate";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
import { SectionCard } from "~/components/wordpress/fields";
import {
  flash,
  humanizeFieldKey,
  languageDisplayName,
  languageFlag,
  postTypeLabel,
} from "./constants";

const PER_PAGE = 20;
const DEBOUNCE_MS = 350;

type FilterType = "all" | string;

/**
 * Open the post editor in a new tab via workspace SSO — same pattern as
 * re:index page SEO. The gateway lands on the editor URL directly.
 */
async function openEditViaSso(editUrl: string): Promise<void> {
  const ssoUrl = await requestWpSsoLogin({ redirect: editUrl });
  const tab = window.open(ssoUrl, "_blank");
  if (!tab) window.location.href = ssoUrl;
}

export function TranslatePanel({
  settings,
  pluginUuid,
}: {
  settings: ReTranslateSettings;
  pluginUuid: string;
}) {
  const { t } = useTranslation();
  const [editingItem, setEditingItem] = useState<TranslateContentItem | null>(
    null,
  );

  if (editingItem) {
    return (
      <StringEditor
        item={editingItem}
        settings={settings}
        pluginUuid={pluginUuid}
        onBack={() => setEditingItem(null)}
      />
    );
  }

  return (
    <ContentList
      settings={settings}
      pluginUuid={pluginUuid}
      onEdit={setEditingItem}
    />
  );
}

/* ── Content list ────────────────────────────────────────────────────── */

function ContentList({
  settings,
  pluginUuid,
  onEdit,
}: {
  settings: ReTranslateSettings;
  pluginUuid: string;
  onEdit: (item: TranslateContentItem) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<FilterType>("all");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const onSearchChange = useCallback((value: string) => {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, DEBOUNCE_MS);
  }, []);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const params = useMemo(() => {
    const p: Record<string, unknown> = {
      page,
      per_page: PER_PAGE,
    };
    if (debouncedSearch) p.search = debouncedSearch;
    if (typeFilter === "_header_footer") {
      p.object_type = "chrome";
    } else if (typeFilter === "_rf_forms") {
      p.object_type = "rf_form";
    } else if (typeFilter !== "all") {
      p.object_type = "post";
      p.post_type = typeFilter;
    }
    return p;
  }, [page, debouncedSearch, typeFilter]);

  const { data, isLoading, isFetching } = useTranslateContent(pluginUuid, params);
  const totalPages = data ? Math.ceil(data.total / PER_PAGE) : 1;
  const showLoader = isLoading || isFetching;

  const typeOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [
      { value: "all", label: t("wordpress.reTranslate.allTypes", "All types") },
    ];
    for (const pt of settings.post_types) {
      opts.push({ value: pt, label: postTypeLabel(pt) });
    }
    opts.push({
      value: "_header_footer",
      label: t("wordpress.reTranslate.headerFooter", "Header & footer"),
    });
    if (settings.has_rf_forms) {
      opts.push({
        value: "_rf_forms",
        label: t("wordpress.reTranslate.forms", "Forms"),
      });
    }
    return opts;
  }, [settings.post_types, settings.has_rf_forms, t]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-48">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t(
              "wordpress.reTranslate.searchPlaceholder",
              "Search content...",
            )}
            className="pl-9"
          />
        </div>
        <NativeSelect
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="w-auto"
        >
          {typeOptions.map((opt) => (
            <NativeSelectOption key={opt.value} value={opt.value}>
              {opt.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <SectionCard>
        {showLoader ? (
          <div className="flex items-center justify-center py-20">
            <Spinner className="size-6" />
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">
              {t(
                "wordpress.reTranslate.noContent",
                "No content found. Run a scan from Settings to index your site.",
              )}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {data.items.map((item) => (
              <button
                key={`${item.object_type}-${item.id}`}
                type="button"
                onClick={() => onEdit(item)}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {item.title || `#${item.id}`}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {item.type_label ||
                      postTypeLabel(item.post_type || item.object_type)}
                    {item.strings
                      ? ` · ${item.strings.toLocaleString()} strings`
                      : ""}
                  </span>
                </span>
                <span className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {settings.languages.map((lang) => {
                    const row = item.languages[lang.code];
                    const status = !row || !row.total
                      ? "untranslated"
                      : row.stale > 0
                        ? "stale"
                        : row.translated >= row.total
                          ? "translated"
                          : row.translated > 0
                            ? "partial"
                            : "untranslated";
                    return (
                      <Badge
                        key={lang.code}
                        variant="outline"
                        className={statusBadgeClass(status)}
                        title={`${lang.label} — ${row?.percent ?? 0}%`}
                      >
                        {lang.code.toUpperCase()}
                        {row?.total
                          ? ` ${status === "stale" ? "!" : `${row.percent}%`}`
                          : ""}
                      </Badge>
                    );
                  })}
                </span>
              </button>
            ))}
          </div>
        )}

        {!showLoader && totalPages > 1 ? (
          <div className="flex items-center justify-between border-t px-5 py-3">
            <span className="text-xs tabular-nums text-muted-foreground">
              {t("wordpress.reTranslate.page", "Page {{page}} of {{total}}", {
                page,
                total: totalPages,
              })}
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "translated":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case "partial":
      return "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300";
    case "stale":
      return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
    default:
      return "text-muted-foreground";
  }
}

/* ── String editor ───────────────────────────────────────────────────── */

function StringEditor({
  item,
  settings,
  pluginUuid,
  onBack,
}: {
  item: TranslateContentItem;
  settings: ReTranslateSettings;
  pluginUuid: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [language, setLanguage] = useState(
    () => settings.languages[0]?.code ?? "",
  );
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [openingEditor, setOpeningEditor] = useState(false);

  const { data, isLoading } = useTranslateContentDetail(
    pluginUuid,
    item.id,
    language,
    item.object_type,
  );

  const saveMutation = useSaveTranslateStrings(pluginUuid);
  const machineTranslateMutation = useMachineTranslateContent(pluginUuid);

  const editUrl = data?.item.edit_url || item.edit_url;

  useEffect(() => {
    setDrafts({});
  }, [language, item.id]);

  const dirtyIds = useMemo(() => {
    if (!data) return [];
    return data.strings
      .filter((s) => {
        const draft = drafts[s.id];
        return draft !== undefined && draft !== (s.translated_text ?? "");
      })
      .map((s) => s.id);
  }, [data, drafts]);

  const isDirty = dirtyIds.length > 0;

  async function handleOpenEditor() {
    if (!editUrl) return;
    setOpeningEditor(true);
    try {
      await openEditViaSso(editUrl);
    } catch (err) {
      flash(
        extractErrorMessage(err) ||
          t(
            "wordpress.reTranslate.openInEditorFailed",
            "Couldn't open the WordPress editor. Connect SSO for this site first.",
          ),
        "error",
      );
    } finally {
      setOpeningEditor(false);
    }
  }

  function handleSave() {
    if (!data) return;
    const toSave = data.strings
      .filter((s) => dirtyIds.includes(s.id))
      .map((s) => {
        const text = drafts[s.id] ?? s.translated_text ?? "";
        return {
          id: s.id,
          translated_text: text,
          status: text.trim() ? "reviewed" : "untranslated",
        };
      });
    saveMutation.mutate(toSave, {
      onSuccess: (res) => {
        setDrafts({});
        flash(
          t("wordpress.reTranslate.savedStrings", "{{count}} strings saved.", {
            count: res.strings?.length ?? toSave.length,
          }),
        );
      },
      onError: (err) => flash(extractErrorMessage(err), "error"),
    });
  }

  function handleMachineTranslate() {
    machineTranslateMutation.mutate(
      { id: item.id, language, objectType: item.object_type },
      {
        onSuccess: () =>
          flash(
            t(
              "wordpress.reTranslate.machineTranslated",
              "All fields translated.",
            ),
          ),
        onError: (err) => flash(extractErrorMessage(err), "error"),
      },
    );
  }

  function confirmBack() {
    if (isDirty) {
      const ok = window.confirm(
        t(
          "wordpress.reTranslate.unsavedConfirm",
          "You have unsaved changes. Leave anyway?",
        ),
      );
      if (!ok) return;
    }
    onBack();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={confirmBack}
        >
          <ArrowLeft className="size-4" />
          {t("wordpress.reTranslate.backToList", "Back")}
        </Button>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">
            {item.title || `#${item.id}`}
          </h3>
        </div>
        <NativeSelect
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-auto"
        >
          {settings.languages.map((lang) => (
            <NativeSelectOption key={lang.code} value={lang.code}>
              {languageFlag(lang.code)} {languageDisplayName(lang.code, lang.label)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isDirty ? (
          <Badge
            variant="secondary"
            className="gap-1.5 font-normal text-muted-foreground"
          >
            <span className="size-1.5 rounded-full bg-amber-500" />
            {t("wordpress.reTranslate.dirtyCount", "{{count}} unsaved", {
              count: dirtyIds.length,
            })}
          </Badge>
        ) : null}
        <div className="flex-1" />
        {editUrl ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={openingEditor}
            onClick={handleOpenEditor}
          >
            {openingEditor ? (
              <Spinner className="size-3.5" />
            ) : (
              <ExternalLink className="size-3.5" />
            )}
            {t("wordpress.reTranslate.openInEditor", "Open in editor")}
          </Button>
        ) : null}
        {settings.has_machine_translate ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={machineTranslateMutation.isPending}
            onClick={handleMachineTranslate}
          >
            {machineTranslateMutation.isPending ? (
              <Spinner className="size-3.5" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {t(
              "wordpress.reTranslate.machineTranslate",
              "Translate all fields",
            )}
          </Button>
        ) : null}
        <Button
          size="sm"
          className="gap-1.5"
          disabled={!isDirty || saveMutation.isPending}
          onClick={handleSave}
        >
          {saveMutation.isPending ? (
            <Spinner className="size-3.5" />
          ) : (
            <CornerDownLeft className="size-3.5" />
          )}
          {t("wordpress.reTranslate.saveAll", "Save all")}
        </Button>
      </div>

      <SectionCard>
        {isLoading && !data ? (
          <div className="flex items-center justify-center py-20">
            <Spinner className="size-6" />
          </div>
        ) : !data || data.strings.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">
              {t(
                "wordpress.reTranslate.noStrings",
                "No strings found for this item.",
              )}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {data.strings.map((str) => (
              <StringRow
                key={str.id}
                str={str}
                draft={drafts[str.id]}
                onDraftChange={(val) =>
                  setDrafts((prev) => ({ ...prev, [str.id]: val }))
                }
              />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function StringRow({
  str,
  draft,
  onDraftChange,
}: {
  str: TranslateString;
  draft: string | undefined;
  onDraftChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const value = draft ?? str.translated_text ?? "";
  const isStale = str.is_stale;
  const isDirty = draft !== undefined && draft !== (str.translated_text ?? "");

  return (
    <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
      <div className="min-w-0">
        <p className="mb-1 text-[11px] font-medium text-muted-foreground">
          {humanizeFieldKey(str.field_key)}
        </p>
        <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
          {str.current_source_text || str.source_text}
        </p>
      </div>
      <div className="min-w-0 space-y-2">
        <div className="relative">
          <Textarea
            value={value}
            onChange={(e) => onDraftChange(e.target.value)}
            rows={2}
            className={
              isDirty
                ? "border-amber-500/50 ring-1 ring-amber-500/20"
                : undefined
            }
          />
        </div>
        {isStale ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
            <TriangleAlert className="size-3" />
            {t("wordpress.reTranslate.sourceChanged", "Source changed")}
          </span>
        ) : null}
      </div>
    </div>
  );
}

