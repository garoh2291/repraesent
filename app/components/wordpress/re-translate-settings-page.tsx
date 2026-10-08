import { useParams, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { Languages as LanguagesIcon, MousePointerClick, Palette } from "lucide-react";
import { useReTranslateActions, useReTranslateOverview } from "~/lib/hooks/useReTranslate";
import { useResolvePluginKind } from "~/lib/hooks/useWorkspaceWpPluginCatalog";
import { formatPluginSettingsTitle } from "~/lib/utils/wordpress-plugin-kind";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { PluginSettingsBackLink, PluginSettingsLoadingPage, ServiceLiveToggle } from "~/components/wordpress/plugin-settings-chrome";
import { InfoNote, PageShell } from "~/components/wordpress/fields";
import { errorText, flash } from "~/components/wordpress/re-translate/constants";
import { LanguagesPanel } from "~/components/wordpress/re-translate/languages-panel";
import { MenuPanel } from "~/components/wordpress/re-translate/menu-panel";
import { StylePanel } from "~/components/wordpress/re-translate/style-panel";

const TABS = ["languages", "style", "menu"] as const;
type Tab = (typeof TABS)[number];

/**
 * re:translate inside Repraesent. One screen per job: languages & pages
 * (translate, check, make live), how it should sound, the language menu
 * visitors use, and the two site-wide switches.
 */
export function ReTranslateSettingsPage() {
  const { t } = useTranslation();
  const { pluginUuid = "" } = useParams<{ pluginUuid: string }>();
  const { catalogItem } = useResolvePluginKind(pluginUuid);
  const title = formatPluginSettingsTitle(catalogItem?.display_name, t("wordpress.reTranslate.title", "Translation"));
  const [params, setParams] = useSearchParams();
  const asked = params.get("tab") === "switcher" ? "menu" : (params.get("tab") ?? "");
  const tab: Tab = (TABS as readonly string[]).includes(asked) ? (asked as Tab) : "languages";
  const target = { pluginUuid };
  const { data, isLoading, error } = useReTranslateOverview(target);
  const { saveOptions } = useReTranslateActions(target);

  if (isLoading) return <PluginSettingsLoadingPage />;

  return (
    <PageShell width="md">
      <PluginSettingsBackLink label={t("wordpress.reTranslate.back", "Back to website")} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between app-fade-up">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="title-display text-[26px] font-semibold text-foreground sm:text-[30px]">{title}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{data?.plugin.home ? (data.plugin.site_url ?? data.plugin.home).replace(/^https?:\/\//i, "").replace(/\/$/, "") : t("wordpress.reTranslate.subtitle", "Your website in more languages")}</p>
        </div>
        {data ? (
          <ServiceLiveToggle
            id="re-translate-live"
            live={!data.settings.paused}
            busy={saveOptions.isPending}
            pauseHint={t("wordpress.reTranslate.pauseHint", "Every visitor sees the original pages until you turn this on again. Nothing is deleted.")}
            onChange={(live) =>
              saveOptions.mutate(
                { paused: !live },
                {
                  onSuccess: () => flash(live ? t("wordpress.reTranslate.resumed", "Translations are live again.") : t("wordpress.reTranslate.paused", "Translations paused. Visitors see the original pages.")),
                  onError: (err) => flash(errorText(t, err), "error"),
                },
              )
            }
          />
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {errorText(t, error)}
        </div>
      ) : null}

      {data?.plugin.v1_active ? (
        <InfoNote>{t("wordpress.reTranslate.v1Active", "The old translation service (re:translate) is still switched on for this website. Switch it off first; until then this one waits.")}</InfoNote>
      ) : null}
      {data && !data.plugin.core_buffer ? (
        <InfoNote>{t("wordpress.reTranslate.needsUpdate", "Your website needs a WordPress update before translated pages can be shown. Ask us to update it.")}</InfoNote>
      ) : null}

      {data ? (
        <Tabs value={tab} onValueChange={(v) => setParams((p) => { const n = new URLSearchParams(p); n.set("tab", v); return n; }, { replace: true, preventScrollReset: true })} className="app-fade-up app-fade-up-d1 gap-4">
          <TabsList aria-label={t("wordpress.reTranslate.tabs", "Translation")}>
            <TabsTrigger value="languages" className="gap-1.5">
              <LanguagesIcon className="size-3.5" />
              {t("wordpress.reTranslate.tabLanguages", "Languages & pages")}
            </TabsTrigger>
            <TabsTrigger value="style" className="gap-1.5">
              <Palette className="size-3.5" />
              {t("wordpress.reTranslate.tabStyle", "How it sounds")}
            </TabsTrigger>
            <TabsTrigger value="menu" className="gap-1.5">
              <MousePointerClick className="size-3.5" />
              {t("wordpress.reTranslate.tabMenu", "Language Menu Placement")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="languages" className="mt-0">
            <LanguagesPanel target={target} overview={data} />
          </TabsContent>
          <TabsContent value="style" className="mt-0">
            <StylePanel target={target} />
          </TabsContent>
          <TabsContent value="menu" className="mt-0">
            <MenuPanel target={target} overview={data} />
          </TabsContent>
        </Tabs>
      ) : null}
    </PageShell>
  );
}
