import { useTranslation } from "react-i18next";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ExternalLink,
  ImageIcon,
  LayoutTemplate,
  Link2,
  MousePointerClick,
  PanelBottom,
  PanelTop,
  Type,
} from "lucide-react";
import type {
  ReBannerConfig,
  ReBannerLinkTarget,
} from "~/lib/wordpress/plugin-settings-types";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
import {
  CardBody,
  CardHeader,
  Field,
  FieldHint,
  SectionCard,
} from "~/components/wordpress/fields";
import { Segmented, SwitchRow } from "~/components/wordpress/re-cookie/fields";
import { BannerBodyEditor } from "~/components/wordpress/re-banner/banner-body-editor";
import { VariantPicker } from "~/components/wordpress/re-banner/variant-picker";
import {
  ALIGNS,
  effectiveAlign,
  POSITIONS,
  type SetConfig,
} from "~/components/wordpress/re-banner/constants";

/**
 * What the banner is and says: its layout, its words, its picture and its
 * button.
 *
 * The layout comes first because it decides what the rest of the tab even
 * asks for — Text has no picture and no button, Bar has no picture. The
 * text variant's words are placed exactly as written: a heading in the
 * editor is a heading on the page, with nothing wrapped around it, which is
 * why there is no "wrapper element" to choose here.
 *
 * Alignment sits with the layout on purpose. It used to live only as a
 * per-element text-align override, which meant centring a banner required
 * knowing whether its words were a heading or a paragraph; on the site that
 * showed up as "I centred it and nothing moved". Now it is one banner-level
 * setting that moves image, words and button together.
 *
 * The text variant has no picture and no button — the editor's own link tool
 * is strictly better there, because an <a> inside the text inherits the
 * theme's link styling where the button is a plugin-styled pill that would
 * need plugin CSS to draw. One way to make a link, not two.
 *
 * The banner's internal name is not here either: it is edited in place in
 * the sticky header, where it is displayed.
 */
export function ContentPanel({
  draft,
  set,
  linkTargets,
  imageUrl,
  saving,
  onPickImage,
}: {
  draft: ReBannerConfig;
  set: SetConfig;
  linkTargets: ReBannerLinkTarget[];
  imageUrl: string | null;
  saving: boolean;
  onPickImage: () => void;
}) {
  const { t } = useTranslation();
  const isText = draft.variant === "text";
  const showImage = !isText && draft.variant !== "bar";
  const align = effectiveAlign(draft.variant, draft.align);
  const alignIcons = { left: AlignLeft, center: AlignCenter, right: AlignRight };

  return (
    <div className="space-y-4">
      <SectionCard>
        <CardHeader
          icon={<LayoutTemplate className="size-4" />}
          title={t("wordpress.reBanner.layout", "Layout")}
          subtitle={t(
            "wordpress.reBanner.layoutSubtitle",
            "Four boxes share the same content and colours — switching between them never means re-entering anything. Text is the odd one out: no box, your theme's own styling.",
          )}
        />
        <CardBody>
          <Field>
            <VariantPicker
              value={draft.variant}
              onChange={(v) => set("variant", v)}
            />
          </Field>

          {isText ? (
            <Field>
              <Label>{t("wordpress.reBanner.align", "Alignment")}</Label>
              <Segmented<ReBannerConfig["align"]>
                ariaLabel={t("wordpress.reBanner.align", "Alignment")}
                value={
                  draft.align === "left" || draft.align === "center" || draft.align === "right"
                    ? draft.align
                    : "auto"
                }
                onChange={(v) => set("align", v)}
                options={[
                  {
                    value: "auto" as const,
                    label: t("wordpress.reBanner.auto", "Auto"),
                  },
                  ...ALIGNS.map((option) => {
                    const Icon = alignIcons[option.key];
                    return {
                      value: option.key,
                      label: t(option.i18n, option.fallback),
                      icon: <Icon className="size-3.5" aria-hidden />,
                    };
                  }),
                ]}
              />
              <FieldHint>
                {t(
                  "wordpress.reBanner.alignTextHint",
                  "Centres the words in the page column. Automatic leaves your theme's alignment alone.",
                )}
              </FieldHint>
            </Field>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <Label>{t("wordpress.reBanner.position", "Position")}</Label>
                <Segmented<ReBannerConfig["position"]>
                  ariaLabel={t("wordpress.reBanner.position", "Position")}
                  value={draft.position}
                  onChange={(v) => set("position", v)}
                  options={POSITIONS.map((option) => ({
                    value: option.key,
                    label: t(option.i18n, option.fallback),
                    icon:
                      option.key === "top" ? (
                        <PanelTop className="size-3.5" aria-hidden />
                      ) : (
                        <PanelBottom className="size-3.5" aria-hidden />
                      ),
                  }))}
                />
                <FieldHint>
                  {draft.variant === "card" || draft.variant === "hero"
                    ? t(
                        "wordpress.reBanner.positionInFlowHint",
                        "Card and Hero sit in the page: top prints before the content, bottom after it.",
                      )
                    : t(
                        "wordpress.reBanner.positionPinnedHint",
                        "Pinned to the top or bottom edge of the window.",
                      )}
                </FieldHint>
              </Field>

              <Field>
                <Label>{t("wordpress.reBanner.align", "Alignment")}</Label>
                <Segmented<ReBannerConfig["align"]>
                  ariaLabel={t("wordpress.reBanner.align", "Alignment")}
                  value={align}
                  onChange={(v) => set("align", v)}
                  options={ALIGNS.map((option) => {
                    const Icon = alignIcons[option.key];
                    return {
                      value: option.key,
                      label: t(option.i18n, option.fallback),
                      icon: <Icon className="size-3.5" aria-hidden />,
                    };
                  })}
                />
                <FieldHint>
                  {t(
                    "wordpress.reBanner.alignHint",
                    "Moves the image, the words and the button together.",
                  )}
                </FieldHint>
              </Field>
            </div>
          )}
        </CardBody>
      </SectionCard>

      <SectionCard>
        <CardHeader
          icon={<Type className="size-4" />}
          title={t("wordpress.reBanner.content", "Text")}
          subtitle={
            isText
              ? t(
                  "wordpress.reBanner.bodyHtmlHintText",
                  "Paragraphs, headings, links, emphasis and lists — placed on the page exactly as written, with nothing wrapped around them. Colours, fonts and spacing come from your theme unless you override them under Design.",
                )
              : t(
                  "wordpress.reBanner.bodyHtmlHintBox",
                  "Paragraphs, headings, links, emphasis and lists. Colours and sizes live under Design.",
                )
          }
        />
        <CardBody>
          <Field>
            <Label htmlFor="rebnr-body-html">
              {t("wordpress.reBanner.bodyHtml", "Banner text")}
            </Label>
            <BannerBodyEditor
              value={draft.body_html}
              onChange={(html) => set("body_html", html)}
              disabled={saving}
            />
          </Field>

        </CardBody>
      </SectionCard>

      {showImage ? (
        <SectionCard>
          <CardHeader
            icon={<ImageIcon className="size-4" />}
            title={t("wordpress.reBanner.image", "Image")}
            subtitle={t(
              "wordpress.reBanner.imageHint",
              "Optional. A small picture beside the text — or behind it, for the Hero layout.",
            )}
          />
          <CardBody>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={onPickImage}
                className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted text-muted-foreground transition-colors hover:border-foreground/40"
                aria-label={t("wordpress.reBanner.selectImage", "Select image")}
              >
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="size-full object-cover" />
                ) : (
                  <ImageIcon className="size-6" aria-hidden />
                )}
              </button>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={onPickImage}>
                    {imageUrl
                      ? t("wordpress.reBanner.changeImage", "Change image")
                      : t("wordpress.reBanner.selectImage", "Select image")}
                  </Button>
                  {draft.image_id > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => set("image_id", 0)}
                    >
                      {t("wordpress.reBanner.removeImage", "Remove")}
                    </Button>
                  ) : null}
                </div>
                <FieldHint>
                  {t(
                    "wordpress.reBanner.imageLibraryHint",
                    "From the site's media library. Upload new images in WordPress.",
                  )}
                </FieldHint>
              </div>
            </div>
          </CardBody>
        </SectionCard>
      ) : null}

      {isText ? null : (
        <SectionCard>
          <CardHeader
            icon={<MousePointerClick className="size-4" />}
            title={t("wordpress.reBanner.cta", "Button")}
            subtitle={t(
              "wordpress.reBanner.ctaSubtitle",
              "Leave the label empty for a banner with no button.",
            )}
          />
          <CardBody>
            <Field>
              <Label htmlFor="rebnr-cta-label">
                {t("wordpress.reBanner.ctaLabel", "Button label")}
              </Label>
              <Input
                id="rebnr-cta-label"
                value={draft.cta_label}
                placeholder={t("wordpress.reBanner.ctaLabelPlaceholder", "Shop the sale")}
                onChange={(e) => set("cta_label", e.target.value)}
              />
            </Field>

            {draft.cta_label.trim() === "" ? null : (
              <>
                <Field>
                  <Label>{t("wordpress.reBanner.ctaType", "Links to")}</Label>
                  <Segmented<ReBannerConfig["cta_type"]>
                    ariaLabel={t("wordpress.reBanner.ctaType", "Links to")}
                    value={draft.cta_type}
                    onChange={(v) => set("cta_type", v)}
                    options={[
                      {
                        value: "url",
                        label: t("wordpress.reBanner.ctaTypeUrl", "Custom URL"),
                        icon: <ExternalLink className="size-3.5" aria-hidden />,
                      },
                      {
                        value: "post",
                        label: t("wordpress.reBanner.ctaTypePost", "A page on this site"),
                        icon: <Link2 className="size-3.5" aria-hidden />,
                      },
                    ]}
                  />
                </Field>

                {draft.cta_type === "url" ? (
                  <Field>
                    <Label htmlFor="rebnr-cta-url">
                      {t("wordpress.reBanner.ctaUrl", "URL")}
                    </Label>
                    <Input
                      id="rebnr-cta-url"
                      type="url"
                      placeholder="https://"
                      className="font-mono text-sm"
                      value={draft.cta_url}
                      onChange={(e) => set("cta_url", e.target.value)}
                    />
                  </Field>
                ) : (
                  <Field>
                    <Label htmlFor="rebnr-cta-post">
                      {t("wordpress.reBanner.ctaPost", "Page or post")}
                    </Label>
                    <NativeSelect
                      id="rebnr-cta-post"
                      value={String(draft.cta_post_id)}
                      onChange={(e) => set("cta_post_id", Number(e.target.value) || 0)}
                    >
                      <NativeSelectOption value="0">
                        {t("wordpress.reBanner.selectOne", "— Select —")}
                      </NativeSelectOption>
                      {linkTargets.map((target) => (
                        <NativeSelectOption key={target.id} value={String(target.id)}>
                          {`${target.title} — ${
                            target.type === "page"
                              ? t("wordpress.reBanner.typePage", "Page")
                              : t("wordpress.reBanner.typePost", "Post")
                          }`}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                )}

                <SwitchRow
                  id="rebnr-new-tab"
                  checked={draft.cta_new_tab}
                  onChange={(v) => set("cta_new_tab", v)}
                  label={t("wordpress.reBanner.newTab", "Open in a new tab")}
                />
              </>
            )}
          </CardBody>
        </SectionCard>
      )}
    </div>
  );
}
