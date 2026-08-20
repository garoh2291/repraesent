import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { useWorkspaceWpSite } from "~/lib/hooks/useWorkspaceWpSite";
import {
  useCreateReAppointmentButton,
  useDeleteReAppointmentButton,
  useToggleReAppointmentButtonStatus,
  useUpdateReAppointmentButton,
  useWorkspaceReAppointmentButtons,
} from "~/lib/hooks/useWorkspaceReAppointment";
import type {
  ReAppointmentButton,
  ReAppointmentButtonConfig,
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
import { ButtonEditor } from "~/components/wordpress/re-appointment/button-editor";
import { ButtonList } from "~/components/wordpress/re-appointment/button-list";
import {
  DEFAULTS,
  flash,
  toConfig,
} from "~/components/wordpress/re-appointment/constants";
import { PluginSettingsLoadingPage } from "~/components/wordpress/plugin-settings-chrome";
import { PageShell } from "~/components/wordpress/fields";

/**
 * re:appointment settings inside Repraesent. Behavior matches the WordPress
 * plugin admin (list / edit / save / placement / preview); chrome matches the
 * rest of the dashboard. Saving goes through the Repraesent API.
 *
 * This screen is only a shell: it owns the list-vs-editor switch and the draft
 * being edited, and hands both to `ButtonList` / `ButtonEditor`.
 */
export function ReAppointmentSettingsPage() {
  const { t } = useTranslation();
  const { pluginUuid } = useParams<{ pluginUuid: string }>();

  const siteQuery = useWorkspaceWpSite(true);
  const hasSite = !!siteQuery.data?.sso_enabled;
  const listQuery = useWorkspaceReAppointmentButtons(pluginUuid, hasSite);

  const createMutation = useCreateReAppointmentButton(pluginUuid);
  const updateMutation = useUpdateReAppointmentButton(pluginUuid);
  const deleteMutation = useDeleteReAppointmentButton(pluginUuid);
  const toggleStatusMutation = useToggleReAppointmentButtonStatus(pluginUuid);

  const loading = siteQuery.isLoading || listQuery.isLoading;
  const buttons = useMemo(
    () => listQuery.data?.buttons ?? [],
    [listQuery.data],
  );
  const pages = listQuery.data?.pages ?? [];
  const slots = listQuery.data?.slots ?? [];

  /** null = list; a number = editing that button; "new" = create. */
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<ReAppointmentButtonConfig>(DEFAULTS);
  /** The button awaiting delete confirmation, or null when the modal is closed. */
  const [confirmDelete, setConfirmDelete] = useState<ReAppointmentButton | null>(
    null,
  );

  const loadError = siteQuery.isError
    ? extractErrorMessage(siteQuery.error)
    : listQuery.isError
      ? extractErrorMessage(listQuery.error)
      : null;

  const saving = createMutation.isPending || updateMutation.isPending;

  function openNew() {
    setDraft({ ...DEFAULTS });
    setEditing("new");
  }

  function openEdit(button: ReAppointmentButton) {
    setDraft(toConfig(button));
    setEditing(button.id);
  }

  function set<K extends keyof ReAppointmentButtonConfig>(
    key: K,
    value: ReAppointmentButtonConfig[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    if (editing === null) return;

    const onError = (err: unknown) => flash(extractErrorMessage(err), "error");

    if (editing === "new") {
      createMutation.mutate(draft, {
        onSuccess: (created) => {
          // Land on the saved button so its shortcode is there to copy — the
          // plugin redirects to the edit screen after a create for the same reason.
          setDraft(toConfig(created));
          setEditing(created.id);
          flash(t("wordpress.reAppointment.saved", "Button saved."));
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
          flash(t("wordpress.reAppointment.saved", "Button saved."));
        },
        onError,
      },
    );
  }

  function confirmDeleteButton() {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    setConfirmDelete(null);
    deleteMutation.mutate(id, {
      onSuccess: () =>
        flash(t("wordpress.reAppointment.deleted", "Button deleted.")),
      onError: (err) => flash(extractErrorMessage(err), "error"),
    });
  }

  function handleToggleStatus(button: ReAppointmentButton) {
    const next = button.status === "active" ? "inactive" : "active";
    toggleStatusMutation.mutate(
      { id: button.id, status: next },
      {
        onSuccess: () =>
          flash(
            next === "active"
              ? t("wordpress.reAppointment.activated", "Button activated.")
              : t("wordpress.reAppointment.deactivated", "Button deactivated."),
          ),
        onError: (err) => flash(extractErrorMessage(err), "error"),
      },
    );
  }

  if (loading) {
    return <PluginSettingsLoadingPage />;
  }

  if (!hasSite) {
    return (
      <PageShell>
        <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {t(
            "wordpress.reAppointment.noSite",
            "This workspace doesn't have a WordPress site connected yet.",
          )}
        </div>
      </PageShell>
    );
  }

  if (editing !== null) {
    return (
      <ButtonEditor
        draft={draft}
        buttonId={editing === "new" ? 0 : editing}
        pages={pages}
        slots={slots}
        saving={saving}
        onSet={set}
        onSave={handleSave}
        onSaveWithLabelOverlay={({ sourceLabel, saveOverlay }) => {
          if (editing === null || editing === "new") return;
          const config = { ...draft, label: sourceLabel };
          updateMutation.mutate(
            { id: editing, config },
            {
              onSuccess: async (saved) => {
                setDraft(toConfig(saved));
                try {
                  await saveOverlay();
                  flash(t("wordpress.reAppointment.saved", "Button saved."));
                } catch (err) {
                  flash(extractErrorMessage(err), "error");
                }
              },
              onError: (err) => flash(extractErrorMessage(err), "error"),
            },
          );
        }}
        onCancel={() => setEditing(null)}
        onCopied={() => flash(t("wordpress.reAppointment.copied", "Copied."))}
      />
    );
  }

  return (
    <>
      <ButtonList
        buttons={buttons}
        slots={slots}
        error={loadError}
        onCreate={openNew}
        onEdit={openEdit}
        onDelete={setConfirmDelete}
        onToggleStatus={handleToggleStatus}
        onCopied={() => flash(t("wordpress.reAppointment.copied", "Copied."))}
      />

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(
                "wordpress.reAppointment.confirmDeleteTitle",
                "Delete this button?",
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("wordpress.reAppointment.confirmDeleteBody", {
                defaultValue:
                  'Delete "{{label}}"? This cannot be undone, and any shortcodes for it will stop working.',
                label: confirmDelete?.label ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDeleteButton}
            >
              {t("wordpress.reAppointment.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
