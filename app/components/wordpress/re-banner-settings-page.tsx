import { useMemo, useState } from "react";
import { useParams } from "react-router";
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
import { BannerEditor } from "~/components/wordpress/re-banner/banner-editor";
import { BannerList } from "~/components/wordpress/re-banner/banner-list";
import {
  DEFAULTS,
  flash,
  toConfig,
} from "~/components/wordpress/re-banner/constants";
import { PluginSettingsLoadingPage } from "~/components/wordpress/plugin-settings-chrome";
import { PageShell } from "~/components/wordpress/fields";

/**
 * re:banner settings inside Repraesent. Behavior matches the WordPress plugin
 * admin (list / edit / save / pause / delete); chrome matches the rest of the
 * dashboard. Saving goes through the Repraesent API, which routes the write
 * through the site's own plugin so its sanitizers and schedule validation run.
 *
 * This screen is only a shell: it owns the list-vs-editor switch and the draft
 * being edited, and hands both to `BannerList` / `BannerEditor`.
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

  /** null = list; a number = editing that banner; "new" = create. */
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<ReBannerConfig>(DEFAULTS);
  /** The banner awaiting delete confirmation, or null when the modal is closed. */
  const [confirmDelete, setConfirmDelete] = useState<ReBanner | null>(null);

  const loadError = siteQuery.isError
    ? extractErrorMessage(siteQuery.error)
    : listQuery.isError
      ? extractErrorMessage(listQuery.error)
      : null;

  const saving = createMutation.isPending || updateMutation.isPending;

  /**
   * The image URL for the banner being edited. It lives on the list row rather
   * than the draft, because the draft only carries what the editor edits.
   */
  const editingImageUrl =
    typeof editing === "number"
      ? (banners.find((b) => b.id === editing)?.image_url ?? null)
      : null;

  function openNew() {
    setDraft({ ...DEFAULTS });
    setEditing("new");
  }

  function openEdit(banner: ReBanner) {
    setDraft(toConfig(banner));
    setEditing(banner.id);
  }

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

    if (editing === "new") {
      createMutation.mutate(draft, {
        onSuccess: (created) => {
          // Land on the saved banner so its shortcode is there to copy — the
          // plugin redirects to the edit screen after a create for the same reason.
          setDraft(toConfig(created));
          setEditing(created.id);
          flash(t("wordpress.reBanner.saved", "Banner saved."));
        },
        onError,
      });
      return;
    }

    updateMutation.mutate(
      { id: editing, config: draft },
      {
        onSuccess: (saved) => {
          setDraft(toConfig(saved));
          flash(t("wordpress.reBanner.saved", "Banner saved."));
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
        if (editing === banner.id) setEditing(null);
        flash(t("wordpress.reBanner.deleted", "Banner deleted."));
      },
      onError: (err) => {
        setConfirmDelete(null);
        flash(extractErrorMessage(err), "error");
      },
    });
  }

  if (loading) {
    return <PluginSettingsLoadingPage />;
  }

  return (
    <PageShell>
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

      {loadError ? (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      {editing === null ? (
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
      ) : (
        <BannerEditor
          draft={draft}
          set={set}
          bannerId={editing === "new" ? null : editing}
          linkTargets={linkTargets}
          timezone={timezone}
          imageUrl={editingImageUrl}
          saving={saving}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
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
