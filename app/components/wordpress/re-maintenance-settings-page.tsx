import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { Eye, MessageSquareText, Power, Save } from "lucide-react";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { useWorkspacePluginSettingsForm } from "~/lib/hooks/useWorkspacePluginSettings";
import { useResolvePluginKind } from "~/lib/hooks/useWorkspaceWpPluginCatalog";
import type { ReMaintenanceSettings } from "~/lib/wordpress/plugin-settings-types";
import { formatPluginSettingsTitle } from "~/lib/utils/wordpress-plugin-kind";
import { PluginSettingsBackLink, PluginSettingsLoadingPage } from "~/components/wordpress/plugin-settings-chrome";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  DEFAULT_MESSAGE,
  DEFAULT_SETTINGS,
  flash,
} from "~/components/wordpress/re-maintenance/constants";
import {
  CardHeader,
  Field,
  FieldHint,
  InfoNote,
  PageShell,
  SectionCard,
  ToggleField,
} from "~/components/wordpress/fields";
import { PluginLangBar } from "~/components/wordpress/plugin-lang-bar";
import { usePluginTranslateLanguages } from "~/lib/hooks/usePluginTranslateLanguages";
import { usePluginOverlayPack } from "~/lib/hooks/usePluginOverlayPack";
import {
  maintenanceFromOverlay,
  maintenanceToSavePayload,
  type OverlayStringMap,
} from "~/lib/wordpress/plugin-i18n";
import { cn } from "~/lib/utils";

/**
 * re:maintenance settings inside Repraesent. Behavior matches the WordPress
 * plugin admin (status, preview, messages); chrome matches the dashboard.
 */
export function ReMaintenanceSettingsPage() {
  const { t } = useTranslation();
  const { pluginUuid = "" } = useParams<{ pluginUuid: string }>();
  const { catalogItem } = useResolvePluginKind(pluginUuid);
  const pageTitle = formatPluginSettingsTitle(
    catalogItem?.display_name,
    "re:maintenance",
  );
  const i18n = usePluginTranslateLanguages();
  const overlays = usePluginOverlayPack(i18n.translatePluginUuid);
  const [activeLang, setActiveLang] = useState("");
  const [overlayMap, setOverlayMap] = useState<OverlayStringMap>({});
  const [displayMessages, setDisplayMessages] = useState({
    message: "",
    sub_message: "",
  });
  const [overlayDirty, setOverlayDirty] = useState(false);
  const [langLoading, setLangLoading] = useState(false);

  const {
    settings,
    setSettings,
    reseed,
    site,
    found,
    loading,
    saving,
    dirty,
    loadError,
    saveMutation,
    hasSite,
  } = useWorkspacePluginSettingsForm<ReMaintenanceSettings>(
    pluginUuid,
    DEFAULT_SETTINGS,
  );

  const { maintenance, site: wpSite } = settings;
  const multilingual = i18n.enabled;
  const isSource = !multilingual || activeLang === i18n.source;

  useEffect(() => {
    if (i18n.source && !activeLang) setActiveLang(i18n.source);
  }, [i18n.source, activeLang]);

  useEffect(() => {
    if (isSource) {
      setDisplayMessages({
        message: maintenance.message,
        sub_message: maintenance.sub_message,
      });
      setOverlayDirty(false);
    }
  }, [isSource, maintenance.message, maintenance.sub_message]);

  const loadOverlay = overlays.load;

  const loadTarget = useCallback(
    async (language: string) => {
      setLangLoading(true);
      try {
        const map = await loadOverlay("maintenance", 0, language);
        setOverlayMap(map);
        setDisplayMessages(
          maintenanceFromOverlay(map, {
            message: maintenance.message,
            sub_message: maintenance.sub_message,
          }),
        );
        setOverlayDirty(false);
      } finally {
        setLangLoading(false);
      }
    },
    [loadOverlay, maintenance.message, maintenance.sub_message],
  );

  useEffect(() => {
    if (multilingual && activeLang && activeLang !== i18n.source) {
      void loadTarget(activeLang);
    }
  }, [multilingual, activeLang, i18n.source, loadTarget]);

  function patch(
    updater: (prev: ReMaintenanceSettings) => ReMaintenanceSettings,
  ) {
    setSettings(updater);
  }

  function setMessage(field: "message" | "sub_message", value: string) {
    setDisplayMessages((prev) => ({ ...prev, [field]: value }));
    if (isSource) {
      patch((p) => ({
        ...p,
        maintenance: { ...p.maintenance, [field]: value },
      }));
    } else {
      setOverlayDirty(true);
    }
  }

  async function handleSave() {
    try {
      if (multilingual && !isSource) {
        await overlays.save(
          maintenanceToSavePayload(displayMessages, overlayMap),
        );
        setOverlayDirty(false);
        flash(t("wordpress.reMaintenance.saved", "Settings saved."));
        return;
      }
      saveMutation.mutate(settings as unknown as Record<string, unknown>, {
        onSuccess: (data) => {
          reseed(data.settings);
          flash(t("wordpress.reMaintenance.saved", "Settings saved."));
        },
        onError: (err) => flash(extractErrorMessage(err), "error"),
      });
    } catch (err) {
      flash(extractErrorMessage(err), "error");
    }
  }

  if (loading) {
    return <PluginSettingsLoadingPage />;
  }

  if (!hasSite) {
    return (
      <PageShell>
        <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {t(
            "wordpress.reMaintenance.noSite",
            "This workspace doesn't have a WordPress site connected yet.",
          )}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PluginSettingsBackLink
        label={t("wordpress.reMaintenance.backToPlugins", "Back to plugins")}
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
            {dirty || overlayDirty ? (
              <Badge
                variant="secondary"
                className="gap-1.5 font-normal text-muted-foreground"
              >
                <span className="size-1.5 rounded-full bg-amber-500" />
                {t("wordpress.reMaintenance.unsaved", "Unsaved changes")}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {site?.url
              ? site.url.replace(/^https?:\/\//i, "")
              : t(
                  "wordpress.reMaintenance.subtitle",
                  "Branded maintenance mode by re:praesent",
                )}
          </p>
        </div>
        <Button onClick={() => void handleSave()} disabled={saving || overlays.saving} className="shrink-0">
          <Save className="h-4 w-4" />
          {saving || overlays.saving
            ? t("wordpress.reMaintenance.saving", "Saving…")
            : t("wordpress.reMaintenance.save", "Save settings")}
        </Button>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {loadError}
        </div>
      ) : null}

      {!found ? (
        <InfoNote>
          {t(
            "wordpress.reMaintenance.notConfigured",
            "No re:maintenance options in the database yet — saving will create them.",
          )}
        </InfoNote>
      ) : null}

      <div className="grid gap-4 app-fade-up app-fade-up-d1 lg:grid-cols-2">
        <SectionCard>
          <CardHeader
            title={t("wordpress.reMaintenance.statusTitle", "Status")}
            subtitle={t(
              "wordpress.reMaintenance.statusSubtitle",
              "Turn maintenance mode on or off for visitors",
            )}
          />
          <div className="space-y-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge
                variant="outline"
                className={cn(
                  "gap-1.5",
                  maintenance.enabled
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                    : undefined,
                )}
              >
                <Power className="h-3 w-3" />
                {maintenance.enabled
                  ? t("wordpress.reMaintenance.active", "Active")
                  : t("wordpress.reMaintenance.inactive", "Inactive")}
              </Badge>
              <ToggleField
                id="re-maintenance-enabled"
                checked={maintenance.enabled}
                disabled={!isSource}
                onChange={(checked) =>
                  patch((p) => ({
                    ...p,
                    maintenance: { ...p.maintenance, enabled: checked },
                  }))
                }
                label={
                  maintenance.enabled
                    ? t(
                        "wordpress.reMaintenance.toggleOn",
                        "Maintenance on",
                      )
                    : t(
                        "wordpress.reMaintenance.toggleOff",
                        "Maintenance off",
                      )
                }
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {maintenance.enabled
                ? t(
                    "wordpress.reMaintenance.statusOn",
                    "Visitors see the maintenance page",
                  )
                : t(
                    "wordpress.reMaintenance.statusOff",
                    "Site is live for all visitors",
                  )}
            </p>
          </div>
        </SectionCard>

        <SectionCard>
          <CardHeader
            title={t("wordpress.reMaintenance.previewTitle", "Preview")}
            subtitle={t(
              "wordpress.reMaintenance.previewSubtitle",
              "How the maintenance page looks to visitors",
            )}
          />
          <div className="p-5 sm:p-6">
            <div className="rounded-xl border bg-muted/30 px-5 py-8 text-center">
              <div className="mx-auto mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Eye className="h-4 w-4" />
              </div>
              <p className="text-base font-semibold tracking-tight">
                {wpSite.site_title || "—"}
              </p>
              <p className="mt-3 text-sm font-medium">
                {displayMessages.message || "—"}
              </p>
              {displayMessages.sub_message?.trim() ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {displayMessages.sub_message}
                </p>
              ) : null}
              {wpSite.tagline?.trim() ? (
                <p className="mt-4 text-[11px] tracking-wide text-muted-foreground uppercase">
                  {wpSite.tagline}
                </p>
              ) : null}
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard className="app-fade-up app-fade-up-d2">
        <CardHeader
          title={t(
            "wordpress.reMaintenance.messageTitle",
            "Maintenance Message",
          )}
          subtitle={t(
            "wordpress.reMaintenance.messageSubtitle",
            "Copy shown on the coming-soon page",
          )}
          action={
            multilingual ? (
              <PluginLangBar
                languages={i18n.languages}
                active={activeLang || i18n.source}
                source={i18n.source}
                dirty={overlayDirty}
                disabled={langLoading || overlays.loading}
                unsavedMessage={t(
                  "wordpress.reMaintenance.unsavedSwitch",
                  "You have unsaved message changes. Switch language anyway?",
                )}
                ariaLabel={t(
                  "wordpress.reMaintenance.messageLanguage",
                  "Message language",
                )}
                onChange={setActiveLang}
              />
            ) : undefined
          }
        />
        <div className="space-y-4 p-5 sm:p-6">
          <Field>
            <Label htmlFor="re-maintenance-message">
              {t(
                "wordpress.reMaintenance.primaryMessage",
                "Primary message (shown in bold)",
              )}
            </Label>
            <Textarea
              id="re-maintenance-message"
              rows={2}
              placeholder={DEFAULT_MESSAGE}
              disabled={langLoading}
              value={displayMessages.message}
              onChange={(e) => setMessage("message", e.target.value)}
            />
          </Field>
          <Field>
            <Label htmlFor="re-maintenance-sub-message">
              {t(
                "wordpress.reMaintenance.secondaryMessage",
                "Secondary message (optional descriptive text)",
              )}
            </Label>
            <FieldHint>
              {t(
                "wordpress.reMaintenance.secondaryHint",
                "Shown under the primary message when set.",
              )}
            </FieldHint>
            <Textarea
              id="re-maintenance-sub-message"
              rows={3}
              disabled={langLoading}
              placeholder={t(
                "wordpress.reMaintenance.secondaryPlaceholder",
                "Entdecken Sie bald unsere Produkte...",
              )}
              value={displayMessages.sub_message}
              onChange={(e) => setMessage("sub_message", e.target.value)}
            />
          </Field>
          <InfoNote>
            <span className="inline-flex items-start gap-2">
              <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {t(
                  "wordpress.reMaintenance.infoNote",
                  "The page title and tagline come from WordPress Settings → General and are shown for preview only here. Set a logo in the Customizer → Site Identity on the site.",
                )}
              </span>
            </span>
          </InfoNote>
        </div>
      </SectionCard>
    </PageShell>
  );
}
