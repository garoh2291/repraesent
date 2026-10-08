import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { useWorkspaceWpSite } from "~/lib/hooks/useWorkspaceWpSite";
import {
  useCreateReBanner,
  useDeleteReBanner,
  useToggleReBannerStatus,
  useUpdateReBanner,
  useWorkspaceReBanners,
} from "~/lib/hooks/useWorkspaceReBanners";
import type {
  ReBanner,
  ReBannerConfig,
} from "~/lib/wordpress/plugin-settings-types";
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
import { Alert, AlertDescription } from "~/components/ui/alert";
import { toast } from "sonner";
import { isEmptyStyles } from "~/lib/wordpress/re-banner-styles";
import { BannerEditor } from "~/components/wordpress/re-banner/banner-editor";
import { BannerList } from "~/components/wordpress/re-banner/banner-list";
import {
  BANNER_PARAM,
  DEFAULTS,
  TAB_PARAM,
  editingFromParam,
  flash,
  tabFromParam,
  toConfig,
  type EditorTab,
} from "~/components/wordpress/re-banner/constants";
import {
  PluginSettingsBackLink,
  ServicePauseToggle,
  PluginSettingsLoadingPage,
} from "~/components/wordpress/plugin-settings-chrome";
import { PageShell } from "~/components/wordpress/fields";

/**
 * re:banner settings inside Repraesent. Behavior matches the WordPress plugin
 * admin (list / edit / save / pause / delete); chrome matches the rest of the
 * dashboard. Saving goes through the Repraesent API, which routes the write
 * through the site's own plugin so its sanitizers and schedule validation run.
 *
 * This screen is only a shell: it owns the list-vs-editor switch and the draft
 * being edited, and hands both to `BannerList` / `BannerEditor`.
 *
 * Which banner is open, and which of its tabs, live in the URL
 * (`?banner=1739&tab=design`) rather than in state: a banner can be linked
 * to, a refresh lands where it was, and the browser's back button closes the
 * editor. The draft itself is state — it is the unsaved work.
 */
export function ReBannerSettingsPage() {
  const { t } = useTranslation();
  const { pluginUuid } = useParams<{ pluginUuid: string }>();

  const siteQuery = useWorkspaceWpSite(true);
  const hasSite = !!siteQuery.data?.sso_enabled;
  const listQuery = useWorkspaceReBanners(pluginUuid, hasSite);

  const createMutation = useCreateReBanner(pluginUuid);
  const updateMutation = useUpdateReBanner(pluginUuid);
  const deleteMutation = useDeleteReBanner(pluginUuid);
  const toggleMutation = useToggleReBannerStatus(pluginUuid);

  const loading = siteQuery.isLoading || listQuery.isLoading;
  const banners = useMemo(
    () => listQuery.data?.banners ?? [],
    [listQuery.data],
  );
  const linkTargets = listQuery.data?.link_targets ?? [];
  const timezone = listQuery.data?.timezone ?? "UTC";

  const [searchParams, setSearchParams] = useSearchParams();
  /** null = list; a number = editing that banner; "new" = create. From the URL. */
  const editing = editingFromParam(searchParams.get(BANNER_PARAM));
  const tab = tabFromParam(searchParams.get(TAB_PARAM));

  const [draft, setDraft] = useState<ReBannerConfig>(DEFAULTS);
  /** The draft as last opened or saved, for the "unsaved changes" badge. */
  const [savedSnapshot, setSavedSnapshot] = useState<string>(JSON.stringify(DEFAULTS));
  /**
   * What the draft was loaded for. Opening a banner from the list sets the
   * draft and this together; a deep link or a refresh sets only the URL, and
   * the effect below fills the draft in once the list has arrived.
   */
  const [loadedFor, setLoadedFor] = useState<number | "new" | null>(null);
  /** The banner awaiting delete confirmation, or null when the modal is closed. */
  const [confirmDelete, setConfirmDelete] = useState<ReBanner | null>(null);

  const loadError = siteQuery.isError
    ? extractErrorMessage(siteQuery.error)
    : listQuery.isError
      ? extractErrorMessage(listQuery.error)
      : null;

  const saving = createMutation.isPending || updateMutation.isPending;
  const dirty = useMemo(
    () => JSON.stringify(draft) !== savedSnapshot,
    [draft, savedSnapshot],
  );

  /**
   * The banner being edited, as the list knows it. The image URL lives on the
   * row rather than the draft (the draft only carries what the editor edits),
   * and so does the derived state.
   */
  const editingRow =
    typeof editing === "number"
      ? (banners.find((b) => b.id === editing) ?? null)
      : null;

  /**
   * Point the URL at a banner (or at the list, with `null`). Opening is
   * navigation, so it stacks history and Back closes the editor; a tab
   * change and the "new" → id hop after a create replace instead.
   */
  const navigateTo = useCallback(
    (
      next: { banner: number | "new" | null; tab?: EditorTab },
      replace = false,
    ) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next.banner === null) {
            params.delete(BANNER_PARAM);
            params.delete(TAB_PARAM);
          } else {
            params.set(BANNER_PARAM, String(next.banner));
            if (next.tab !== undefined) params.set(TAB_PARAM, next.tab);
          }
          return params;
        },
        // UI state only: skip the root locale revalidation.
        {
          replace,
          preventScrollReset: true,
          unstable_defaultShouldRevalidate: false,
        },
      );
    },
    [setSearchParams],
  );

  function load(target: number | "new", config: ReBannerConfig) {
    setDraft(config);
    setSavedSnapshot(JSON.stringify(config));
    setLoadedFor(target);
  }

  function openNew() {
    load("new", { ...DEFAULTS });
    navigateTo({ banner: "new" });
  }

  function openEdit(banner: ReBanner) {
    load(banner.id, toConfig(banner));
    navigateTo({ banner: banner.id });
  }

  function closeEditor() {
    navigateTo({ banner: null });
  }

  // A deep link or a refresh: the URL names a banner the draft was not loaded
  // for. Fill it in from the list once that is here; an id the site does not
  // have goes back to the list rather than opening an empty editor.
  useEffect(() => {
    if (editing === null) {
      if (loadedFor !== null) setLoadedFor(null);
      return;
    }
    if (editing === loadedFor) return;
    if (editing === "new") {
      load("new", { ...DEFAULTS });
      return;
    }
    if (listQuery.isError) {
      // The list (and its error) is the thing to show, not a spinner.
      navigateTo({ banner: null }, true);
      return;
    }
    if (!listQuery.data) return;
    const row = banners.find((b) => b.id === editing);
    if (row) load(editing, toConfig(row));
    else navigateTo({ banner: null }, true);
    // `load` is a plain setter bundle; the values it closes over are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, loadedFor, banners, listQuery.data, listQuery.isError, navigateTo]);

  function set<K extends keyof ReBannerConfig>(
    key: K,
    value: ReBannerConfig[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    if (editing === null) return;

    // The plugin validates the schedule window and answers with its own
    // wording ("The end date has to be after the start date."), which the API
    // passes through as a 400. Show that rather than a generic failure.
    const onError = (err: unknown) => flash(extractErrorMessage(err), "error");

    /**
     * A site still on re:banner 1.1 ignores `styles` entirely — the save
     * succeeds and the overrides come back empty. Saying so beats letting the
     * Design tab reset itself with no explanation. Same for `align` on 1.2.
     */
    const warnIfDropped = (saved: ReBanner) => {
      if (!isEmptyStyles(draft.styles) && isEmptyStyles(saved.styles)) {
        toast.warning(
          t(
            "wordpress.reBanner.stylesDropped",
            "Typography & spacing overrides were not kept — this site's re:banner plugin needs updating to 1.2.0 or later.",
          ),
        );
      }
      if (draft.align !== "auto" && saved.align === "auto") {
        toast.warning(
          t(
            "wordpress.reBanner.alignDropped",
            "Alignment was not kept — this site's re:banner plugin needs updating to 1.3.0 or later.",
          ),
        );
      }
      // An older plugin has no `placement` and pins the banner anyway — the
      // one outcome "only with the shortcode" was chosen to avoid.
      if (draft.placement === "shortcode" && saved.placement === "auto") {
        toast.warning(
          t(
            "wordpress.reBanner.placementDropped",
            "Shortcode-only placement was not kept — this site's re:banner plugin needs updating to 1.4.0 or later. Until then the banner is still pinned at the top of the page.",
          ),
        );
      }
    };

    const adopt = (saved: ReBanner) => {
      const next = toConfig(saved);
      setDraft(next);
      setSavedSnapshot(JSON.stringify(next));
    };

    if (editing === "new") {
      createMutation.mutate(draft, {
        onSuccess: (created) => {
          // Land on the saved banner so its shortcode is there to copy — the
          // plugin redirects to the edit screen after a create for the same
          // reason. Replace, so Back does not return to a stale "new".
          adopt(created);
          setLoadedFor(created.id);
          navigateTo({ banner: created.id, tab }, true);
          flash(t("wordpress.reBanner.saved", "Banner saved."));
          warnIfDropped(created);
        },
        onError,
      });
      return;
    }

    updateMutation.mutate(
      { id: editing, config: draft },
      {
        onSuccess: (saved) => {
          adopt(saved);
          flash(t("wordpress.reBanner.saved", "Banner saved."));
          warnIfDropped(saved);
        },
        onError,
      },
    );
  }

  function handleDelete() {
    const banner = confirmDelete;
    if (!banner) return;

    deleteMutation.mutate(banner.id, {
      onSuccess: () => {
        setConfirmDelete(null);
        if (editing === banner.id) closeEditor();
        flash(t("wordpress.reBanner.deleted", "Banner deleted."));
      },
      onError: (err) => {
        setConfirmDelete(null);
        flash(extractErrorMessage(err), "error");
      },
    });
  }

  // Also while a deep-linked banner's draft is still being filled in from
  // the list — otherwise the editor would paint one frame of defaults.
  if (loading || (editing !== null && editing !== loadedFor)) {
    return <PluginSettingsLoadingPage />;
  }

  return (
    <PageShell spaced={editing === null}>
      {editing === null ? (
        <>
          <div>
            <PluginSettingsBackLink
              label={t("wordpress.reBanner.backToWebsite", "Back to website")}
            />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  {t("wordpress.reBanner.heading", "Banners")}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(
                    "wordpress.reBanner.subheading",
                    "Temporary announcements that appear and remove themselves on schedule.",
                  )}
                </p>
              </div>
              <ServicePauseToggle
                pluginUuid={pluginUuid ?? ""}
                pauseHint={t(
                  "wordpress.reBanner.pauseHint",
                  "Switch off to pause every banner at once. Visitors see none until you switch back on. Nothing is deleted.",
                )}
              />
            </div>
          </div>

          {loadError ? (
            <Alert variant="destructive">
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          ) : null}

          <BannerList
            banners={banners}
            busyId={
              toggleMutation.isPending
                ? (toggleMutation.variables?.id ?? null)
                : null
            }
            onCreate={openNew}
            onEdit={openEdit}
            onToggle={(banner) =>
              toggleMutation.mutate({
                id: banner.id,
                status: banner.status === "active" ? "inactive" : "active",
              })
            }
            onDelete={setConfirmDelete}
          />
        </>
      ) : (
        <BannerEditor
          draft={draft}
          set={set}
          bannerId={editing === "new" ? null : editing}
          state={editingRow?.state ?? null}
          dirty={dirty}
          linkTargets={linkTargets}
          timezone={timezone}
          imageUrl={editingRow?.image_url ?? null}
          saving={saving}
          tab={tab}
          onTabChange={(next) => navigateTo({ banner: editing, tab: next }, true)}
          onSave={handleSave}
          onCancel={closeEditor}
          onDelete={editingRow ? () => setConfirmDelete(editingRow) : undefined}
        />
      )}

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("wordpress.reBanner.deleteTitle", "Delete this banner?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "wordpress.reBanner.deleteBody",
                "This cannot be undone. Any shortcode still pasted on a page stops rendering.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("wordpress.reBanner.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {t("wordpress.reBanner.confirmDelete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
