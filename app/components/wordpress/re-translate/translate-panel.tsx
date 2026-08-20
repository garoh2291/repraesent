import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CornerDownLeft,
  ExternalLink,
  Search,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type {
  ReTranslateMode,
  ReTranslateSettings,
} from "~/lib/wordpress/plugin-settings-types";
import type {
  TranslateContentItem,
  TranslateLanguageProgress,
  TranslateString,
} from "~/lib/api/wordpress-hub";
import { requestWpSsoLogin } from "~/lib/api/wordpress-hub";
import {
  progressFromTranslateStrings,
  refetchTranslateContentLists,
  useTranslateContent,
  useTranslateContentDetail,
  useSaveTranslateStrings,
  useMachineTranslateContent,
} from "~/lib/hooks/useWorkspaceReTranslate";
import { useQueryClient } from "@tanstack/react-query";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { useSearchShortcut } from "~/lib/hooks/useSearchShortcut";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
import { SectionCard } from "~/components/wordpress/fields";
import {
  PAGE_PARAM,
  TYPE_PARAM,
  SINGLETON_PLUGIN_TYPES,
  flash,
  humanizeFieldKey,
  isPluginTypeFilter,
  languageDisplayName,
  languageFlag,
  pageFromParam,
  translatedPluginLabel,
  translatedPostTypeLabel,
  typeFromParam,
  typeToParam,
} from "./constants";
import { BulkTranslateBar } from "./bulk-translate-bar";
import { cn } from "~/lib/utils";

const PER_PAGE = 20;
const DEBOUNCE_MS = 350;
/** Brief beat so the flash registers, then fade starts. */
const HIGHLIGHT_HOLD_MS = 350;
/** Matches `duration-700` on the row so the clear fires after the fade. */
const HIGHLIGHT_FADE_MS = 700;

const SEARCH_PARAM_OPTS = {
  replace: true,
  preventScrollReset: true,
  unstable_defaultShouldRevalidate: false,
} as const;

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

function itemKey(
  item: Pick<TranslateContentItem, "object_type" | "id">
): string {
  return `${item.object_type}-${item.id}`;
}

function singletonPluginItem(
  objectType: string,
  displayName: string
): TranslateContentItem {
  return {
    id: 0,
    object_type: objectType,
    title: displayName,
    type_label: displayName,
    status: "source",
    strings: 0,
    languages: {},
  };
}

type LanguageOverrides = Record<
  string,
  Record<string, TranslateLanguageProgress>
>;

export function TranslatePanel({
  settings,
  pluginUuid,
  onCountersChanged,
}: {
  settings: ReTranslateSettings;
  pluginUuid: string;
  /** Something translated — re-read the server's translation counters. */
  onCountersChanged?: () => void;
}) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const typeFilter = typeFromParam(searchParams.get(TYPE_PARAM));
  const [editingItem, setEditingItem] = useState<TranslateContentItem | null>(
    null
  );
  const [lastOpenedKey, setLastOpenedKey] = useState<string | null>(null);
  const [languageOverrides, setLanguageOverrides] = useState<LanguageOverrides>(
    {}
  );
  const clearHighlight = useCallback(() => setLastOpenedKey(null), []);

  const clearTypeFilter = useCallback(() => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete(TYPE_PARAM);
      params.delete(PAGE_PARAM);
      return params;
    }, SEARCH_PARAM_OPTS);
  }, [setSearchParams]);

  const applyLanguages = useCallback(
    (
      item: Pick<TranslateContentItem, "object_type" | "id">,
      languages: Record<string, TranslateLanguageProgress>
    ) => {
      const key = itemKey(item);
      setLanguageOverrides((prev) => ({
        ...prev,
        [key]: { ...(prev[key] ?? {}), ...languages },
      }));
    },
    []
  );

  // Cookie / maintenance are one pack each — skip the redundant one-row list.
  useEffect(() => {
    if (!SINGLETON_PLUGIN_TYPES.has(typeFilter)) return;
    const plugin = (settings.available_plugins ?? []).find(
      (entry) => entry.object_type === typeFilter
    );
    const displayName = plugin?.display_name?.trim() || typeFilter;
    setEditingItem((current) => {
      if (
        current &&
        current.object_type === typeFilter &&
        String(current.id) === "0"
      ) {
        return current.title === displayName
          ? current
          : { ...current, title: displayName, type_label: displayName };
      }
      return singletonPluginItem(typeFilter, displayName);
    });
  }, [typeFilter, settings.available_plugins]);

  // Keep the list mounted while editing so Back is instant.
  return (
    <>
      <div className={editingItem ? "hidden" : undefined}>
        <ContentList
          settings={settings}
          pluginUuid={pluginUuid}
          highlightedKey={lastOpenedKey}
          languageOverrides={languageOverrides}
          onHighlightClear={clearHighlight}
          onCountersChanged={onCountersChanged}
          onEdit={(item) => {
            setLastOpenedKey(null);
            setEditingItem(item);
          }}
        />
      </div>
      {editingItem ? (
        <StringEditor
          item={editingItem}
          settings={settings}
          pluginUuid={pluginUuid}
          onCountersChanged={onCountersChanged}
          onLanguagesChange={(languages) =>
            applyLanguages(editingItem, languages)
          }
          onBack={() => {
            const singleton = SINGLETON_PLUGIN_TYPES.has(
              editingItem.object_type
            );
            setLastOpenedKey(singleton ? null : itemKey(editingItem));
            setEditingItem(null);
            if (singleton) clearTypeFilter();
            // Background reconcile only — overrides already paint the new %.
            void refetchTranslateContentLists(queryClient, pluginUuid);
          }}
        />
      ) : null}
    </>
  );
}

/* ── Content list ────────────────────────────────────────────────────── */

function ContentList({
  settings,
  pluginUuid,
  highlightedKey,
  languageOverrides,
  onHighlightClear,
  onCountersChanged,
  onEdit,
}: {
  settings: ReTranslateSettings;
  pluginUuid: string;
  highlightedKey: string | null;
  languageOverrides: LanguageOverrides;
  onHighlightClear: () => void;
  /** A bulk run finished — re-read the server's translation counters. */
  onCountersChanged?: () => void;
  onEdit: (item: TranslateContentItem) => void;
}) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const { ref: searchInputRef, withHint } = useSearchShortcut();
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const typeFilter = typeFromParam(searchParams.get(TYPE_PARAM));
  const [highlightVisible, setHighlightVisible] = useState(() =>
    Boolean(highlightedKey)
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const highlightedRowRef = useRef<HTMLButtonElement | null>(null);

  const page = pageFromParam(searchParams.get(PAGE_PARAM));

  const setPage = useCallback(
    (next: number | ((prev: number) => number)) => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        const current = pageFromParam(params.get(PAGE_PARAM));
        const resolved = typeof next === "function" ? next(current) : next;
        const clamped = Math.max(1, Math.floor(resolved));
        if (clamped <= 1) params.delete(PAGE_PARAM);
        else params.set(PAGE_PARAM, String(clamped));
        return params;
      }, SEARCH_PARAM_OPTS);
    },
    [setSearchParams]
  );

  const setTypeFilter = useCallback(
    (value: FilterType) => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        const encoded = typeToParam(value);
        if (!encoded) params.delete(TYPE_PARAM);
        else params.set(TYPE_PARAM, encoded);
        params.delete(PAGE_PARAM);
        return params;
      }, SEARCH_PARAM_OPTS);
    },
    [setSearchParams]
  );

  const onSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setDebouncedSearch(value);
        setPage(1);
      }, DEBOUNCE_MS);
    },
    [setPage]
  );

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
    } else if (isPluginTypeFilter(typeFilter)) {
      p.object_type = typeFilter;
    } else if (typeFilter !== "all") {
      p.object_type = "post";
      p.post_type = typeFilter;
    }
    return p;
  }, [page, debouncedSearch, typeFilter]);

  const { data, isLoading, isFetching, isPlaceholderData } =
    useTranslateContent(pluginUuid, params);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PER_PAGE)) : 1;
  // Spinner on first load and when paging/filtering (placeholder = old page).
  // Same-key background refetch (back from editor) keeps rows visible.
  const showLoader =
    (!data && (isLoading || isFetching)) || (isFetching && isPlaceholderData);

  // If filters shrink the result set, pull an out-of-range page back into bounds.
  useEffect(() => {
    if (!data || isLoading || data.total === 0) return;
    if (page > totalPages) setPage(totalPages);
  }, [data, isLoading, page, totalPages, setPage]);

  useEffect(() => {
    if (!highlightedKey || showLoader) return;
    setHighlightVisible(true);
    highlightedRowRef.current?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
    const fadeTimer = window.setTimeout(
      () => setHighlightVisible(false),
      HIGHLIGHT_HOLD_MS
    );
    const clearTimer = window.setTimeout(
      () => onHighlightClear(),
      HIGHLIGHT_HOLD_MS + HIGHLIGHT_FADE_MS
    );
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [highlightedKey, showLoader, onHighlightClear]);

  const availablePlugins = settings.available_plugins ?? [];

  const typeOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [
      { value: "all", label: t("wordpress.reTranslate.allTypes", "All types") },
    ];
    for (const pt of settings.post_types) {
      opts.push({
        value: pt,
        label: translatedPostTypeLabel(pt, t),
      });
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

  const typeFilterLabel = useMemo(() => {
    if (isPluginTypeFilter(typeFilter)) {
      const plugin = availablePlugins.find((p) => p.object_type === typeFilter);
      return plugin
        ? translatedPluginLabel(plugin.object_type, t, plugin.display_name)
        : t("wordpress.reTranslate.plugins", "Plugins");
    }
    return (
      typeOptions.find((opt) => opt.value === typeFilter)?.label ??
      t("wordpress.reTranslate.allTypes", "All types")
    );
  }, [typeFilter, typeOptions, availablePlugins, t]);

  const selectType = useCallback(
    (value: string) => {
      setTypeFilter(value);
    },
    [setTypeFilter]
  );

  return (
    <div className="space-y-4">
      <BulkTranslateBar
        settings={settings}
        pluginUuid={pluginUuid}
        onCountersChanged={onCountersChanged}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-48">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={withHint(
              t("wordpress.reTranslate.searchPlaceholder", "Search content...")
            )}
            className="pl-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-9 w-auto min-w-40 justify-between gap-2 px-3 font-normal shadow-xs"
            >
              <span className="truncate">{typeFilterLabel}</span>
              <ChevronDown className="size-4 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            {typeOptions.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onSelect={() => selectType(opt.value)}
                className={cn(typeFilter === opt.value && "bg-accent")}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
            {availablePlugins.length > 0 ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger
                  className={cn(isPluginTypeFilter(typeFilter) && "bg-accent")}
                >
                  {t("wordpress.reTranslate.plugins", "Plugins")}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-44">
                  {availablePlugins.map((plugin) => (
                    <DropdownMenuItem
                      key={plugin.object_type}
                      onSelect={() => selectType(plugin.object_type)}
                      className={cn(
                        typeFilter === plugin.object_type && "bg-accent"
                      )}
                    >
                      {translatedPluginLabel(
                        plugin.object_type,
                        t,
                        plugin.display_name
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SectionCard>
        {showLoader ? (
          <div className="flex items-center justify-center py-20">
            <Spinner className="size-6" />
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">
              {isPluginTypeFilter(typeFilter)
                ? t(
                    "wordpress.reTranslate.noPluginContent",
                    "No translatable copy found for this plugin yet."
                  )
                : t(
                    "wordpress.reTranslate.noContent",
                    "No content found. Run a scan from Settings to index your site."
                  )}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {data.items.map((item) => {
              const key = itemKey(item);
              const isHighlighted = key === highlightedKey && highlightVisible;
              const languages = {
                ...item.languages,
                ...(languageOverrides[key] ?? {}),
              };
              return (
                <button
                  key={key}
                  ref={key === highlightedKey ? highlightedRowRef : undefined}
                  type="button"
                  onClick={() => onEdit(item)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 px-5 py-3.5 text-left transition-colors duration-700 hover:bg-muted/40",
                    isHighlighted && "bg-muted"
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {item.title || `#${item.id}`}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {item.object_type === "chrome"
                        ? t(
                            "wordpress.reTranslate.headerFooter",
                            "Header & footer"
                          )
                        : item.object_type === "rf_form"
                          ? t("wordpress.reTranslate.forms", "Forms")
                          : isPluginTypeFilter(item.object_type)
                            ? translatedPluginLabel(
                                item.object_type,
                                t,
                                item.type_label
                              )
                            : translatedPostTypeLabel(
                                item.post_type || item.object_type,
                                t
                              )}
                      {item.strings
                        ? ` · ${item.strings.toLocaleString()} strings`
                        : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {settings.languages.map((lang) => {
                      const row = languages[lang.code];
                      const status =
                        !row || !row.total
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
              );
            })}
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
  onLanguagesChange,
  onCountersChanged,
  onBack,
}: {
  item: TranslateContentItem;
  settings: ReTranslateSettings;
  pluginUuid: string;
  onLanguagesChange: (
    languages: Record<string, TranslateLanguageProgress>
  ) => void;
  /** Strings changed — re-read the server's translation counters. */
  onCountersChanged?: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [language, setLanguage] = useState(
    () => settings.languages[0]?.code ?? ""
  );
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [openingEditor, setOpeningEditor] = useState(false);

  const { data, isLoading } = useTranslateContentDetail(
    pluginUuid,
    item.id,
    language,
    item.object_type
  );

  const saveMutation = useSaveTranslateStrings(pluginUuid);
  const machineTranslateMutation = useMachineTranslateContent(pluginUuid);
  const [modeDialogOpen, setModeDialogOpen] = useState(false);
  const [translateMode, setTranslateMode] =
    useState<ReTranslateMode>("empty_only");

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

  function publishLanguagesFromStrings(
    strings: TranslateString[],
    baseLanguages?: Record<string, TranslateLanguageProgress>
  ) {
    const progress = progressFromTranslateStrings(strings);
    onLanguagesChange({
      ...(baseLanguages ?? data?.item.languages ?? item.languages),
      [language]: progress,
    });
  }

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
            "Couldn't open the WordPress editor. Connect SSO for this site first."
          ),
        "error"
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
    const byId = new Map(toSave.map((s) => [s.id, s]));
    saveMutation.mutate(toSave, {
      onSuccess: (res) => {
        setDrafts({});
        const nextStrings = data.strings.map((s) => {
          const next = byId.get(s.id);
          if (!next) return s;
          return {
            ...s,
            translated_text: next.translated_text,
            status: next.status,
            is_stale: false,
          };
        });
        publishLanguagesFromStrings(nextStrings, data.item.languages);
        onCountersChanged?.();
        flash(
          t("wordpress.reTranslate.savedStrings", "{{count}} strings saved.", {
            count: res.strings?.length ?? toSave.length,
          })
        );
      },
      onError: (err) => flash(extractErrorMessage(err), "error"),
    });
  }

  function openMachineTranslateDialog() {
    setTranslateMode("empty_only");
    setModeDialogOpen(true);
  }

  function handleMachineTranslate() {
    setModeDialogOpen(false);
    machineTranslateMutation.mutate(
      {
        id: item.id,
        language,
        objectType: item.object_type,
        mode: translateMode,
      },
      {
        onSuccess: async () => {
          const detailKey = [
            "wordpress",
            "re-translate",
            "content-detail",
            pluginUuid,
            item.id,
            language,
            item.object_type ?? "post",
          ] as const;
          await queryClient.refetchQueries({ queryKey: [...detailKey] });
          const detail = queryClient.getQueryData<{
            item: TranslateContentItem;
          }>(detailKey);
          if (detail?.item.languages) {
            onLanguagesChange(detail.item.languages);
          }
          onCountersChanged?.();
          flash(
            t(
              "wordpress.reTranslate.machineTranslated",
              "All fields translated."
            )
          );
        },
        onError: (err) => flash(extractErrorMessage(err), "error"),
      }
    );
  }

  function confirmBack() {
    if (isDirty) {
      const ok = window.confirm(
        t(
          "wordpress.reTranslate.unsavedConfirm",
          "You have unsaved changes. Leave anyway?"
        )
      );
      if (!ok) return;
    }
    if (data?.item.languages) {
      onLanguagesChange(data.item.languages);
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
              {languageFlag(lang.code)}{" "}
              {languageDisplayName(lang.code, lang.label)}
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
            onClick={openMachineTranslateDialog}
          >
            {machineTranslateMutation.isPending ? (
              <Spinner className="size-3.5" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {t(
              "wordpress.reTranslate.machineTranslate",
              "Translate all fields"
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
                "No strings found for this item."
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

      <Dialog open={modeDialogOpen} onOpenChange={setModeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4" />
              {t(
                "wordpress.reTranslate.machineTranslate",
                "Translate all fields"
              )}
            </DialogTitle>
            <DialogDescription>
              {t(
                "wordpress.reTranslate.translateModeHelp",
                "Choose whether to fill only blank fields or re-translate everything for this language."
              )}
            </DialogDescription>
          </DialogHeader>
          <RadioGroup
            value={translateMode}
            onValueChange={(value) =>
              setTranslateMode(value as ReTranslateMode)
            }
            className="gap-2"
          >
            <label className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 hover:bg-muted/40">
              <RadioGroupItem
                value="empty_only"
                id="detail-mode-empty"
                className="mt-0.5"
              />
              <span className="min-w-0 flex-1">
                <Label
                  htmlFor="detail-mode-empty"
                  className="cursor-pointer font-medium"
                >
                  {t(
                    "wordpress.reTranslate.modeEmptyOnly",
                    "Only empty fields"
                  )}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "wordpress.reTranslate.modeEmptyOnlyHelp",
                    "Fill fields that were left blank. Existing translations stay as they are."
                  )}
                </p>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 hover:bg-muted/40">
              <RadioGroupItem
                value="overwrite"
                id="detail-mode-overwrite"
                className="mt-0.5"
              />
              <span className="min-w-0 flex-1">
                <Label
                  htmlFor="detail-mode-overwrite"
                  className="cursor-pointer font-medium"
                >
                  {t(
                    "wordpress.reTranslate.modeOverwrite",
                    "Re-translate everything"
                  )}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "wordpress.reTranslate.modeOverwriteHelp",
                    "Overwrite existing translations too, not only empty fields."
                  )}
                </p>
              </span>
            </label>
          </RadioGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModeDialogOpen(false)}
            >
              {t("wordpress.reTranslate.cancel", "Cancel")}
            </Button>
            <Button
              type="button"
              disabled={machineTranslateMutation.isPending}
              onClick={handleMachineTranslate}
            >
              {machineTranslateMutation.isPending ? (
                <Spinner className="size-3.5" />
              ) : null}
              {t("wordpress.reTranslate.machineTranslateStart", "Translate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
