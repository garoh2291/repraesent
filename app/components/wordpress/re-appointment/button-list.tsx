import { useMemo } from "react";
import { useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { Check, CircleSlash, Grid2x2, Pencil, Plus, Trash2 } from "lucide-react";
import type {
  ReAppointmentActionType,
  ReAppointmentButton,
  ReAppointmentSlot,
} from "~/lib/wordpress/plugin-settings-types";
import { cn } from "~/lib/utils";
import { formatPluginSettingsTitle } from "~/lib/utils/wordpress-plugin-kind";
import { useResolvePluginKind } from "~/lib/hooks/useWorkspaceWpPluginCatalog";
import { PluginSettingsBackLink } from "~/components/wordpress/plugin-settings-chrome";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { ACTION_TYPES, ACTION_TYPE_I18N, shortcodeFor } from "./constants";
import { PageShell, SectionCard, StatTile } from "~/components/wordpress/fields";

export function ButtonList({
  buttons,
  slots,
  error,
  onCreate,
  onEdit,
  onDelete,
  onToggleStatus,
  onCopied,
}: {
  buttons: ReAppointmentButton[];
  slots: ReAppointmentSlot[];
  error: string | null;
  onCreate: () => void;
  onEdit: (b: ReAppointmentButton) => void;
  onDelete: (b: ReAppointmentButton) => void;
  onToggleStatus: (b: ReAppointmentButton) => void;
  onCopied: () => void;
}) {
  const { t } = useTranslation();
  const { pluginUuid } = useParams<{ pluginUuid: string }>();
  const { catalogItem } = useResolvePluginKind(pluginUuid);
  const pageTitle = formatPluginSettingsTitle(
    catalogItem?.display_name,
    "re:appointment",
  );

  const total = buttons.length;
  const active = buttons.filter((b) => b.status === "active").length;
  const inactive = total - active;

  const slotLabels = useMemo(
    () => new Map(slots.map((s) => [s.key, s.label])),
    [slots],
  );

  const actionLabel = (type: ReAppointmentActionType) => {
    const fallback = ACTION_TYPES.find((a) => a.key === type)?.label ?? type;
    const key = ACTION_TYPE_I18N[type];
    return key ? t(key, fallback) : fallback;
  };

  return (
    <PageShell>
      <PluginSettingsBackLink
        label={t("wordpress.reAppointment.backToPlugins", "Back to plugins")}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between app-fade-up">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {pageTitle}
            </h1>
            {catalogItem?.version ? (
              <Badge variant="outline">v{catalogItem.version}</Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {t(
              "wordpress.reAppointment.subtitle",
              "Configurable CTA buttons by re:praesent — modals, shortcodes & placement",
            )}
          </p>
        </div>
        <Button onClick={onCreate} className="shrink-0">
          <Plus className="h-4 w-4" />
          {t("wordpress.reAppointment.addButton", "Add New Button")}
        </Button>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-3 app-fade-up app-fade-up-d1 sm:gap-4">
        <StatTile
          size="lg"
          icon={<Grid2x2 className="h-3.5 w-3.5" />}
          label={t("wordpress.reAppointment.statTotal", "Total buttons")}
          value={total}
          tone="neutral"
        />
        <StatTile
          size="lg"
          icon={<Check className="h-3.5 w-3.5" />}
          label={t("wordpress.reAppointment.statActive", "Active")}
          value={active}
          tone="positive"
        />
        <StatTile
          size="lg"
          icon={<CircleSlash className="h-3.5 w-3.5" />}
          label={t("wordpress.reAppointment.statInactive", "Inactive")}
          value={inactive}
          tone="muted"
        />
      </div>

      <SectionCard className="app-fade-up app-fade-up-d2">
        {buttons.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {t("wordpress.reAppointment.emptyTitle", "No buttons yet")}
              </p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                {t(
                  "wordpress.reAppointment.emptyText",
                  "Create your first button to generate a shortcode you can paste anywhere on your site.",
                )}
              </p>
            </div>
            <Button onClick={onCreate}>
              <Plus className="h-4 w-4" />
              {t("wordpress.reAppointment.addButton", "Add New Button")}
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium sm:px-5">
                    {t("wordpress.reAppointment.colId", "ID")}
                  </th>
                  <th className="px-4 py-3 font-medium sm:px-5">
                    {t("wordpress.reAppointment.colLabel", "Button label")}
                  </th>
                  <th className="px-4 py-3 font-medium sm:px-5">
                    {t("wordpress.reAppointment.colAction", "Action type")}
                  </th>
                  <th className="px-4 py-3 font-medium sm:px-5">
                    {t("wordpress.reAppointment.colPlacement", "Placement")}
                  </th>
                  <th className="px-4 py-3 font-medium sm:px-5">
                    {t("wordpress.reAppointment.colShortcode", "Shortcode")}
                  </th>
                  <th className="px-4 py-3 font-medium sm:px-5">
                    {t("wordpress.reAppointment.colStatus", "Status")}
                  </th>
                  <th className="px-4 py-3 text-right font-medium sm:px-5">
                    {t("wordpress.reAppointment.colActions", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {buttons.map((b) => {
                  const isActive = b.status === "active";
                  const placements = b.placement_slots
                    .map((key) => slotLabels.get(key))
                    .filter((l): l is string => !!l);

                  return (
                    <tr
                      key={b.id}
                      className="transition-colors hover:bg-muted/40"
                    >
                      <td className="px-4 py-3 tabular-nums text-muted-foreground sm:px-5">
                        #{b.id}
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <button
                          type="button"
                          className="font-medium text-foreground hover:text-primary hover:underline"
                          onClick={() => onEdit(b)}
                        >
                          {b.label}
                        </button>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <Badge variant="secondary">
                          {actionLabel(b.action_type)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        {placements.length > 0 ||
                        b.placement_targets.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {placements.map((label) => (
                              <Badge key={label} variant="outline">
                                {label}
                              </Badge>
                            ))}
                            {b.placement_targets.length > 0 && (
                              <Badge variant="outline">
                                {b.placement_targets.length === 1
                                  ? t(
                                      "wordpress.reAppointment.customPosition",
                                      "Custom position ({{count}})",
                                      { count: b.placement_targets.length },
                                    )
                                  : t(
                                      "wordpress.reAppointment.customPositions",
                                      "Custom positions ({{count}})",
                                      { count: b.placement_targets.length },
                                    )}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            {t(
                              "wordpress.reAppointment.shortcodeOnly",
                              "Shortcode only",
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <ShortcodeButton id={b.id} onCopied={onCopied} />
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={isActive}
                            aria-label={
                              isActive
                                ? t(
                                    "wordpress.reAppointment.deactivate",
                                    "Deactivate button",
                                  )
                                : t(
                                    "wordpress.reAppointment.activate",
                                    "Activate button",
                                  )
                            }
                            onCheckedChange={() => onToggleStatus(b)}
                          />
                          <span
                            className={cn(
                              "text-xs",
                              isActive
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-muted-foreground",
                            )}
                          >
                            {isActive
                              ? t("wordpress.reAppointment.active", "Active")
                              : t("wordpress.reAppointment.inactive", "Inactive")}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            title={t("wordpress.reAppointment.edit", "Edit")}
                            onClick={() => onEdit(b)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title={t("wordpress.reAppointment.delete", "Delete")}
                            onClick={() => onDelete(b)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}

function ShortcodeButton({
  id,
  onCopied,
}: {
  id: number;
  onCopied: () => void;
}) {
  const { t } = useTranslation();
  const shortcode = shortcodeFor(id);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shortcode);
      onCopied();
    } catch {
      // Clipboard blocked (insecure context / denied). The shortcode is on
      // screen, so it can still be selected by hand.
    }
  }

  return (
    <button
      type="button"
      title={t("wordpress.reAppointment.clickToCopy", "Click to copy")}
      onClick={copy}
      className="rounded-md border bg-muted/50 px-2 py-1 font-mono text-xs text-foreground transition-colors hover:bg-muted"
    >
      <code>{shortcode}</code>
    </button>
  );
}
