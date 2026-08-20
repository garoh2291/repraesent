import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImageIcon, Trash2 } from "lucide-react";
import type { ReIndexSettings } from "~/lib/wordpress/plugin-settings-types";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  DEFAULT_SETTINGS,
  FORMAT_KEYS,
  FORMAT_META,
  PREVIEW_PAGE_TITLE,
  TITLE_TOKENS,
  applyTitlePreview,
  type FormatKey,
  type PatchSettings,
} from "./constants";
import {
  Field,
  FieldHint,
  InfoNote,
  SectionCard,
  ToggleField,
} from "~/components/wordpress/fields";
import { MediaLibraryPicker } from "./media-library-picker";
import { PluginLangBar } from "~/components/wordpress/plugin-lang-bar";
import { usePluginTranslateLanguages } from "~/lib/hooks/usePluginTranslateLanguages";
import { usePluginOverlayPack } from "~/lib/hooks/usePluginOverlayPack";
import {
  siteSeoFromOverlay,
  siteSeoToSavePayload,
  type OverlayStringMap,
  type SiteSeoOverlayValues,
} from "~/lib/wordpress/plugin-i18n";
export function SeoPanel({
  settings,
  patchSettings,
  onOverlaySaveReady,
}: {
  settings: ReIndexSettings;
  patchSettings: PatchSettings;
  /** Parent calls this on Save when editing a target language. */
  onOverlaySaveReady?: (
    handle: { save: () => Promise<void>; dirty: boolean } | null,
  ) => void;
}) {
  const { t } = useTranslation();
  const [mediaOpen, setMediaOpen] = useState(false);
  const i18n = usePluginTranslateLanguages();
  const overlays = usePluginOverlayPack(i18n.translatePluginUuid);
  const multilingual = i18n.enabled;
  const [activeLang, setActiveLang] = useState("");
  const [overlayMap, setOverlayMap] = useState<OverlayStringMap>({});
  const [overlayDirty, setOverlayDirty] = useState(false);
  const [langLoading, setLangLoading] = useState(false);

  useEffect(() => {
    if (i18n.source && !activeLang) setActiveLang(i18n.source);
  }, [i18n.source, activeLang]);

  const isSource = !multilingual || activeLang === i18n.source;

  const sourceSeoValues = useMemo(
    (): SiteSeoOverlayValues => ({
      blogname: settings.identity.site_title,
      blogdescription: settings.identity.tagline,
      front_page_desc: settings.seo.front_page_description,
      og_description: settings.og.og_description,
      formats: { ...settings.seo.formats },
    }),
    [settings],
  );

  const [display, setDisplay] = useState<SiteSeoOverlayValues>(sourceSeoValues);

  useEffect(() => {
    if (isSource) {
      setDisplay(sourceSeoValues);
      setOverlayDirty(false);
    }
  }, [isSource, sourceSeoValues]);

  const loadOverlay = overlays.load;
  const saveOverlayPack = overlays.save;

  const loadTarget = useCallback(
    async (language: string) => {
      setLangLoading(true);
      try {
        const map = await loadOverlay("site", 0, language);
        setOverlayMap(map);
        setDisplay(siteSeoFromOverlay(map, sourceSeoValues));
        setOverlayDirty(false);
      } finally {
        setLangLoading(false);
      }
    },
    [loadOverlay, sourceSeoValues],
  );

  useEffect(() => {
    if (multilingual && activeLang && activeLang !== i18n.source) {
      void loadTarget(activeLang);
    }
  }, [multilingual, activeLang, i18n.source, loadTarget]);

  useEffect(() => {
    if (!onOverlaySaveReady) return;
    if (multilingual && !isSource) {
      onOverlaySaveReady({
        dirty: overlayDirty,
        save: async () => {
          await saveOverlayPack(siteSeoToSavePayload(display, overlayMap));
          setOverlayDirty(false);
        },
      });
    } else {
      onOverlaySaveReady(null);
    }
  }, [
    onOverlaySaveReady,
    multilingual,
    isSource,
    overlayDirty,
    display,
    overlayMap,
    saveOverlayPack,
  ]);

  function patchDisplay(updater: (prev: SiteSeoOverlayValues) => SiteSeoOverlayValues) {
    setDisplay((prev) => {
      const next = updater(prev);
      if (isSource) {
        patchSettings((p) => ({
          ...p,
          identity: {
            ...p.identity,
            site_title: next.blogname,
            tagline: next.blogdescription,
          },
          seo: {
            ...p.seo,
            formats: next.formats,
            front_page_description: next.front_page_desc,
          },
          og: {
            ...p.og,
            og_description: next.og_description,
          },
        }));
      } else {
        setOverlayDirty(true);
      }
      return next;
    });
  }

  const previews = useMemo(() => {
    const siteName = display.blogname || PREVIEW_PAGE_TITLE.front_page;
    const tag = display.blogdescription;
    const out = {} as Record<FormatKey, string>;
    for (const k of FORMAT_KEYS) {
      out[k] = applyTitlePreview(
        display.formats[k],
        siteName,
        tag,
        PREVIEW_PAGE_TITLE[k],
      );
    }
    return out;
  }, [display]);

  function insertToken(key: FormatKey, token: string) {
    const el = document.getElementById(`fmt-${key}`) as HTMLInputElement | null;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + token + el.value.slice(end);
    patchDisplay((d) => ({
      ...d,
      formats: { ...d.formats, [key]: next },
    }));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function activeFormatKey(): FormatKey {
    const active = document.activeElement as HTMLElement | null;
    if (active?.id?.startsWith("fmt-")) {
      const key = active.id.slice(4) as FormatKey;
      if ((FORMAT_KEYS as readonly string[]).includes(key)) return key;
    }
    return "front_page";
  }

  return (
    <div className="space-y-4">
      {multilingual ? (
        <div className="rounded-2xl border bg-card px-5 py-3">
          <PluginLangBar
            languages={i18n.languages}
            active={activeLang || i18n.source}
            source={i18n.source}
            dirty={overlayDirty}
            disabled={langLoading || overlays.loading}
            unsavedMessage={t(
              "wordpress.reIndex.unsavedSwitch",
              "You have unsaved changes. Switch language anyway?",
            )}
            ariaLabel={t("wordpress.reIndex.seoLanguage", "SEO language")}
            onChange={setActiveLang}
          />
          {!isSource ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {t(
                "wordpress.reIndex.editingTranslation",
                "Editing {{lang}} SEO — saved as a translation in re:translate.",
                {
                  lang:
                    i18n.languages.find((l) => l.code === activeLang)?.label ??
                    activeLang,
                },
              )}
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              {t(
                "wordpress.reIndex.editingSource",
                "Editing source language SEO — changes update site options.",
              )}
            </p>
          )}
        </div>
      ) : null}

      <SectionCard>
        <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              {t("wordpress.reIndex.seoTitles", "SEO Page Titles")}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t(
                "wordpress.reIndex.seoTitlesSubtitle",
                "Custom title tag formats per page type",
              )}
            </p>
          </div>
          <ToggleField
            id="re-index-seo-enabled"
            checked={settings.seo.enabled}
            disabled={!isSource}
            onChange={(checked) =>
              patchSettings((p) => ({
                ...p,
                seo: { ...p.seo, enabled: checked },
              }))
            }
            label={
              settings.seo.enabled
                ? t(
                    "wordpress.reIndex.seoCustomActive",
                    "Custom formats active",
                  )
                : t(
                    "wordpress.reIndex.seoThemeDefaults",
                    "Using theme defaults",
                  )
            }
          />
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          {settings.seo.enabled ? (
            <>
              <p className="text-xs text-muted-foreground">
                {t(
                  "wordpress.reIndex.seoDesc",
                  "Customize the title tag for each type of page. Click a token to insert it at the cursor, or type it directly.",
                )}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("wordpress.reIndex.tokens", "Tokens:")}
                </span>
                {TITLE_TOKENS.map(([tok, tid]) => (
                  <button
                    key={tid}
                    type="button"
                    title={tid}
                    className="rounded-md border bg-muted/50 px-2 py-1 font-mono text-[11px] text-foreground hover:bg-muted"
                    onClick={() => {
                      insertToken(
                        activeFormatKey(),
                        tok === "[sep]" ? " | " : tok,
                      );
                    }}
                  >
                    {tok}
                  </button>
                ))}
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                {FORMAT_KEYS.map((fk) => (
                  <Field key={fk}>
                    <div className="space-y-0.5">
                      <Label htmlFor={`fmt-${fk}`}>
                        {t(
                          `wordpress.reIndex.formats.${fk}.label`,
                          FORMAT_META[fk].label,
                        )}
                      </Label>
                      <FieldHint>
                        {t(
                          `wordpress.reIndex.formats.${fk}.description`,
                          FORMAT_META[fk].description,
                        )}
                      </FieldHint>
                    </div>
                    <Input
                      id={`fmt-${fk}`}
                      type="text"
                      disabled={langLoading}
                      value={display.formats[fk]}
                      placeholder={DEFAULT_SETTINGS.seo.formats[fk]}
                      onChange={(e) =>
                        patchDisplay((d) => ({
                          ...d,
                          formats: { ...d.formats, [fk]: e.target.value },
                        }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">
                        {t("wordpress.reIndex.preview", "Preview:")}
                      </span>{" "}
                      {previews[fk]}
                    </p>
                  </Field>
                ))}
              </div>
              <Field className="mt-5">
                <Label htmlFor="re-index-front-desc">
                  {t(
                    "wordpress.reIndex.frontPageDesc",
                    "Front page meta description",
                  )}
                </Label>
                <Textarea
                  id="re-index-front-desc"
                  rows={2}
                  disabled={langLoading}
                  value={display.front_page_desc}
                  onChange={(e) =>
                    patchDisplay((d) => ({
                      ...d,
                      front_page_desc: e.target.value,
                    }))
                  }
                />
              </Field>
            </>
          ) : (
            <InfoNote>
              {t(
                "wordpress.reIndex.seoOffNote",
                "Toggle on to override your theme's default title tags with custom formats per page type.",
              )}
            </InfoNote>
          )}
        </div>
      </SectionCard>

      <SectionCard>
        <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              {t("wordpress.reIndex.identityTitle", "Site Identity")}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t(
                "wordpress.reIndex.identitySubtitle",
                "Site title and tagline used in SEO previews",
              )}
            </p>
          </div>
          <ToggleField
            id="re-index-identity-enabled"
            checked={settings.identity.enabled}
            disabled={!isSource}
            onChange={(checked) =>
              patchSettings((p) => ({
                ...p,
                identity: { ...p.identity, enabled: checked },
              }))
            }
            label={
              settings.identity.enabled
                ? t("wordpress.reIndex.identityEditing", "Editing here")
                : t("wordpress.reIndex.identityWpNative", "Using WP native")
            }
          />
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          {settings.identity.enabled ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <Label htmlFor="re-index-site-title">
                  {t("wordpress.reIndex.siteTitle", "Site Title")}
                </Label>
                <Input
                  id="re-index-site-title"
                  type="text"
                  disabled={langLoading}
                  placeholder={t(
                    "wordpress.reIndex.siteTitlePlaceholder",
                    "Your site name",
                  )}
                  value={display.blogname}
                  onChange={(e) =>
                    patchDisplay((d) => ({
                      ...d,
                      blogname: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field>
                <Label htmlFor="re-index-site-tagline">
                  {t("wordpress.reIndex.tagline", "Tagline")}
                </Label>
                <Input
                  id="re-index-site-tagline"
                  type="text"
                  disabled={langLoading}
                  placeholder={t(
                    "wordpress.reIndex.taglinePlaceholder",
                    "Just another WordPress site",
                  )}
                  value={display.blogdescription}
                  onChange={(e) =>
                    patchDisplay((d) => ({
                      ...d,
                      blogdescription: e.target.value,
                    }))
                  }
                />
              </Field>
            </div>
          ) : null}
          <InfoNote>
            {settings.identity.enabled
              ? t(
                  "wordpress.reIndex.identityNoteOn",
                  "Changes apply to WordPress Options (blogname / blogdescription).",
                )
              : t(
                  "wordpress.reIndex.identityNoteOff",
                  "Toggle on to edit here; values still sync with Settings → General on the site.",
                )}
          </InfoNote>
        </div>
      </SectionCard>

      <SectionCard>
        <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              {t("wordpress.reIndex.ogTitle", "Open Graph Image")}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t(
                "wordpress.reIndex.ogSubtitle",
                "Default social share image and description",
              )}
            </p>
          </div>
          <ToggleField
            id="re-index-og-enabled"
            checked={settings.og.enabled}
            disabled={!isSource}
            onChange={(checked) =>
              patchSettings((p) => ({
                ...p,
                og: { ...p.og, enabled: checked },
              }))
            }
            label={
              settings.og.enabled
                ? t("wordpress.reIndex.ogActive", "Tag active")
                : t("wordpress.reIndex.ogInactive", "Tag inactive")
            }
          />
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          {settings.og.enabled ? (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex aspect-[1.91/1] w-full max-w-[200px] shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                  {settings.og.image_url ? (
                    <img
                      src={settings.og.image_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 px-3 text-center text-muted-foreground">
                      <ImageIcon className="h-6 w-6" />
                      <span className="text-[11px]">
                        {t(
                          "wordpress.reIndex.ogNoImage",
                          "No image selected",
                        )}
                      </span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <FieldHint>
                    {t(
                      "wordpress.reIndex.ogHint",
                      "Recommended: 1200 × 630 px, JPEG or PNG. Pick an image from this site’s WordPress media library.",
                    )}
                  </FieldHint>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!isSource}
                      onClick={() => setMediaOpen(true)}
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      {settings.og.image_id
                        ? t("wordpress.reIndex.ogChange", "Change image")
                        : t("wordpress.reIndex.ogSelect", "Select from library")}
                    </Button>
                    {settings.og.image_id ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!isSource}
                        onClick={() =>
                          patchSettings((p) => ({
                            ...p,
                            og: {
                              ...p.og,
                              image_id: 0,
                              image_url: "",
                              compressed_url: "",
                            },
                          }))
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t("wordpress.reIndex.ogRemove", "Remove")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              <MediaLibraryPicker
                open={mediaOpen}
                onOpenChange={setMediaOpen}
                selectedId={settings.og.image_id}
                onSelect={(item) =>
                  patchSettings((p) => ({
                    ...p,
                    og: {
                      ...p.og,
                      image_id: item.id,
                      image_url: item.thumb_url || item.url,
                      compressed_url: "",
                    },
                  }))
                }
              />

              <Field>
                <div className="space-y-0.5">
                  <Label htmlFor="re-index-og-desc">
                    {t("wordpress.reIndex.ogDescription", "OG Description")}
                  </Label>
                  <FieldHint>
                    {t(
                      "wordpress.reIndex.ogDescriptionHint",
                      "Shown when your site is shared on social media.",
                    )}
                  </FieldHint>
                </div>
                <Textarea
                  id="re-index-og-desc"
                  rows={3}
                  disabled={langLoading}
                  placeholder={t(
                    "wordpress.reIndex.ogDescriptionPlaceholder",
                    "A brief description shown in social media previews...",
                  )}
                  value={display.og_description}
                  onChange={(e) =>
                    patchDisplay((d) => ({
                      ...d,
                      og_description: e.target.value,
                    }))
                  }
                />
              </Field>

              {/* Centered social card preview */}
              <div className="flex justify-center">
                <div className="w-full max-w-[320px] overflow-hidden rounded-xl border bg-card shadow-sm">
                  <p className="border-b px-3 py-2 text-center text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    {t("wordpress.reIndex.ogPreview", "Preview")}
                  </p>
                  <div className="aspect-[1.91/1] bg-muted">
                    {settings.og.image_url ? (
                      <img
                        src={settings.og.image_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-8 w-8 opacity-40" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 px-3 py-2.5">
                    <p className="truncate text-sm font-semibold">
                      {display.blogname ||
                        t("wordpress.reIndex.ogPreviewTitle", "Your site")}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {display.og_description ||
                        t(
                          "wordpress.reIndex.ogPreviewDesc",
                          "Your Open Graph description will appear here.",
                        )}
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : null}
          <InfoNote>
            {settings.og.enabled
              ? t(
                  "wordpress.reIndex.ogNoteOn",
                  "OG tags are output on the WordPress front end when an image is set. Save settings to apply.",
                )
              : t(
                  "wordpress.reIndex.ogNoteOff",
                  "Toggle on to set a default Open Graph image on the site.",
                )}
          </InfoNote>
        </div>
      </SectionCard>
    </div>
  );
}
