import { useMemo, useState } from "react";
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

export function SeoPanel({
  settings,
  patchSettings,
}: {
  settings: ReIndexSettings;
  patchSettings: PatchSettings;
}) {
  const { t } = useTranslation();
  const [mediaOpen, setMediaOpen] = useState(false);

  const previews = useMemo(() => {
    const siteName =
      settings.identity.site_title || PREVIEW_PAGE_TITLE.front_page;
    const tag = settings.identity.tagline;
    const out = {} as Record<FormatKey, string>;
    for (const k of FORMAT_KEYS) {
      out[k] = applyTitlePreview(
        settings.seo.formats[k],
        siteName,
        tag,
        PREVIEW_PAGE_TITLE[k],
      );
    }
    return out;
  }, [
    settings.identity.site_title,
    settings.identity.tagline,
    settings.seo.formats,
  ]);

  function insertToken(key: FormatKey, token: string) {
    const el = document.getElementById(`fmt-${key}`) as HTMLInputElement | null;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + token + el.value.slice(end);
    patchSettings((p) => ({
      ...p,
      seo: {
        ...p.seo,
        formats: { ...p.seo.formats, [key]: next },
      },
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
                      value={settings.seo.formats[fk]}
                      placeholder={DEFAULT_SETTINGS.seo.formats[fk]}
                      onChange={(e) =>
                        patchSettings((p) => ({
                          ...p,
                          seo: {
                            ...p.seo,
                            formats: {
                              ...p.seo.formats,
                              [fk]: e.target.value,
                            },
                          },
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
                  <div className="space-y-0.5">
                    <Label htmlFor="re-index-front-desc">
                      {t(
                        "wordpress.reIndex.frontMetaDesc",
                        "Front Page Meta Description",
                      )}
                    </Label>
                    <FieldHint>
                      {t(
                        "wordpress.reIndex.frontMetaDescHint",
                        "The meta description shown in search results for your homepage.",
                      )}
                    </FieldHint>
                  </div>
                  <Textarea
                    id="re-index-front-desc"
                    rows={3}
                    placeholder={t(
                      "wordpress.reIndex.frontMetaDescPlaceholder",
                      "A brief description of your site for search engines...",
                    )}
                    value={settings.seo.front_page_description}
                    onChange={(e) =>
                      patchSettings((p) => ({
                        ...p,
                        seo: {
                          ...p.seo,
                          front_page_description: e.target.value,
                        },
                      }))
                    }
                  />
                </Field>
            </>
          ) : null}
          <InfoNote>
            {settings.seo.enabled
              ? t(
                  "wordpress.reIndex.seoNoteOn",
                  "Custom title formats are active. Your theme's default title tags are overridden when re:index runs on the site.",
                )
              : t(
                  "wordpress.reIndex.seoNoteOff",
                  "Toggle on to override your theme's default title tags with custom formats per page type.",
                )}
          </InfoNote>
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
                  placeholder={t(
                    "wordpress.reIndex.siteTitlePlaceholder",
                    "Your site name",
                  )}
                  value={settings.identity.site_title}
                  onChange={(e) =>
                    patchSettings((p) => ({
                      ...p,
                      identity: {
                        ...p.identity,
                        site_title: e.target.value,
                      },
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
                  placeholder={t(
                    "wordpress.reIndex.taglinePlaceholder",
                    "Just another WordPress site",
                  )}
                  value={settings.identity.tagline}
                  onChange={(e) =>
                    patchSettings((p) => ({
                      ...p,
                      identity: { ...p.identity, tagline: e.target.value },
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
                  placeholder={t(
                    "wordpress.reIndex.ogDescriptionPlaceholder",
                    "A brief description shown in social media previews...",
                  )}
                  value={settings.og.og_description}
                  onChange={(e) =>
                    patchSettings((p) => ({
                      ...p,
                      og: { ...p.og, og_description: e.target.value },
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
                      {settings.identity.site_title ||
                        t("wordpress.reIndex.ogPreviewTitle", "Your site")}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {settings.og.og_description ||
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
