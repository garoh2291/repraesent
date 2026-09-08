import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ImageIcon, Loader2 } from "lucide-react";
import type {
  ReBannerConfig,
  ReBannerLinkTarget,
} from "~/lib/wordpress/plugin-settings-types";
import type { WpMediaItem } from "~/lib/api/wordpress-hub";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
import {
  CardBody,
  CardHeader,
  ColorInput,
  Field,
  FieldHint,
  SectionCard,
  ToggleField,
  TwoCol,
} from "~/components/wordpress/fields";
import { MediaLibraryPicker } from "~/components/wordpress/re-index/media-library-picker";
import { BannerPreview } from "~/components/wordpress/re-banner/banner-preview";
import {
  POSITIONS,
  VARIANTS,
  VISIBILITIES,
  fromDateInput,
  shortcodeFor,
  toDateInput,
  type SetConfig,
} from "~/components/wordpress/re-banner/constants";

export function BannerEditor({
  draft,
  set,
  bannerId,
  linkTargets,
  timezone,
  imageUrl,
  saving,
  onSave,
  onCancel,
}: {
  draft: ReBannerConfig;
  set: SetConfig;
  /** null while creating — there is no shortcode to show yet. */
  bannerId: number | null;
  linkTargets: ReBannerLinkTarget[];
  timezone: string;
  imageUrl: string | null;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  // The picker hands back a fresh URL; until the list refetches, that is the
  // only way the preview knows what the newly chosen image looks like.
  const [pickedUrl, setPickedUrl] = useState<string | null>(null);

  const shownImage = draft.image_id === 0 ? null : (pickedUrl ?? imageUrl);

  function handlePick(item: WpMediaItem) {
    set("image_id", item.id);
    setPickedUrl(item.thumb_url || item.url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <ChevronLeft className="size-4" aria-hidden />
          {t("wordpress.reBanner.backToList", "All banners")}
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            {t("wordpress.reBanner.cancel", "Cancel")}
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("wordpress.reBanner.save", "Save banner")}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {/* ── Content ─────────────────────────────────────────────── */}
          <SectionCard>
            <CardHeader title={t("wordpress.reBanner.content", "Content")} />
            <CardBody>
              <Field>
                <Label htmlFor="rebnr-title">
                  {t("wordpress.reBanner.title", "Title")}
                </Label>
                <Input
                  id="rebnr-title"
                  value={draft.title}
                  onChange={(e) => set("title", e.target.value)}
                />
              </Field>

              <Field>
                <Label htmlFor="rebnr-description">
                  {t("wordpress.reBanner.description", "Description")}
                </Label>
                <Textarea
                  id="rebnr-description"
                  rows={3}
                  value={draft.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Field>

              <Field>
                <Label>{t("wordpress.reBanner.image", "Image")}</Label>
                <div className="flex items-center gap-3">
                  <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted text-muted-foreground">
                    {shownImage ? (
                      <img
                        src={shownImage}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="size-5" aria-hidden />
                    )}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPickerOpen(true)}
                    >
                      {t("wordpress.reBanner.selectImage", "Select image")}
                    </Button>
                    {draft.image_id > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          set("image_id", 0);
                          setPickedUrl(null);
                        }}
                      >
                        {t("wordpress.reBanner.removeImage", "Remove")}
                      </Button>
                    ) : null}
                  </div>
                </div>
                <FieldHint>
                  {t(
                    "wordpress.reBanner.imageHint",
                    "Pick from the site's media library. Upload new images in WordPress.",
                  )}
                </FieldHint>
              </Field>
            </CardBody>
          </SectionCard>

          {/* ── CTA ─────────────────────────────────────────────────── */}
          <SectionCard>
            <CardHeader
              title={t("wordpress.reBanner.cta", "Call to action")}
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
                  onChange={(e) => set("cta_label", e.target.value)}
                />
              </Field>

              <Field>
                <Label htmlFor="rebnr-cta-type">
                  {t("wordpress.reBanner.ctaType", "Links to")}
                </Label>
                <NativeSelect
                  id="rebnr-cta-type"
                  value={draft.cta_type}
                  onChange={(e) =>
                    set("cta_type", e.target.value as ReBannerConfig["cta_type"])
                  }
                >
                  <NativeSelectOption value="url">
                    {t("wordpress.reBanner.ctaTypeUrl", "Custom URL")}
                  </NativeSelectOption>
                  <NativeSelectOption value="post">
                    {t(
                      "wordpress.reBanner.ctaTypePost",
                      "Page or post on this site",
                    )}
                  </NativeSelectOption>
                </NativeSelect>
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
                    onChange={(e) =>
                      set("cta_post_id", Number(e.target.value) || 0)
                    }
                  >
                    <NativeSelectOption value="0">
                      {t("wordpress.reBanner.selectOne", "— Select —")}
                    </NativeSelectOption>
                    {linkTargets.map((target) => (
                      <NativeSelectOption
                        key={target.id}
                        value={String(target.id)}
                      >
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

              <ToggleField
                id="rebnr-new-tab"
                checked={draft.cta_new_tab}
                onChange={(v) => set("cta_new_tab", v)}
                label={t("wordpress.reBanner.newTab", "Open in a new tab")}
              />
            </CardBody>
          </SectionCard>

          {/* ── Schedule ────────────────────────────────────────────── */}
          <SectionCard>
            <CardHeader
              title={t("wordpress.reBanner.schedule", "Schedule")}
              subtitle={t(
                "wordpress.reBanner.scheduleSubtitle",
                "Times are in the site's timezone ({{timezone}}). Leave a field empty for open-ended.",
                { timezone },
              )}
            />
            <CardBody>
              <TwoCol>
                <Field>
                  <Label htmlFor="rebnr-starts">
                    {t("wordpress.reBanner.startsAt", "Starts")}
                  </Label>
                  <Input
                    id="rebnr-starts"
                    type="datetime-local"
                    value={toDateInput(draft.starts_at)}
                    onChange={(e) =>
                      set("starts_at", fromDateInput(e.target.value))
                    }
                  />
                </Field>
                <Field>
                  <Label htmlFor="rebnr-ends">
                    {t("wordpress.reBanner.endsAt", "Ends")}
                  </Label>
                  <Input
                    id="rebnr-ends"
                    type="datetime-local"
                    value={toDateInput(draft.ends_at)}
                    onChange={(e) =>
                      set("ends_at", fromDateInput(e.target.value))
                    }
                  />
                </Field>
              </TwoCol>

              <ToggleField
                id="rebnr-status"
                checked={draft.status === "active"}
                onChange={(v) => set("status", v ? "active" : "inactive")}
                label={t(
                  "wordpress.reBanner.active",
                  "Active — turn off to pause without changing the dates",
                )}
              />
            </CardBody>
          </SectionCard>

          {/* ── Placement ───────────────────────────────────────────── */}
          <SectionCard>
            <CardHeader title={t("wordpress.reBanner.placement", "Placement")} />
            <CardBody>
              <Field>
                <Label htmlFor="rebnr-visibility">
                  {t("wordpress.reBanner.visibility", "Show on")}
                </Label>
                <NativeSelect
                  id="rebnr-visibility"
                  value={draft.visibility}
                  onChange={(e) =>
                    set(
                      "visibility",
                      e.target.value as ReBannerConfig["visibility"],
                    )
                  }
                >
                  {VISIBILITIES.map((option) => (
                    <NativeSelectOption key={option.key} value={option.key}>
                      {t(option.i18n, option.fallback)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>

              {draft.visibility !== "all" ? (
                <Field>
                  <Label htmlFor="rebnr-pages">
                    {t("wordpress.reBanner.pages", "Pages")}
                  </Label>
                  <select
                    id="rebnr-pages"
                    multiple
                    size={6}
                    className="w-full rounded-md border border-input bg-transparent p-2 text-sm"
                    value={draft.page_ids.map(String)}
                    onChange={(e) =>
                      set(
                        "page_ids",
                        Array.from(e.target.selectedOptions, (o) =>
                          Number(o.value),
                        ).filter((n) => n > 0),
                      )
                    }
                  >
                    {linkTargets.map((target) => (
                      <option key={target.id} value={String(target.id)}>
                        {target.title}
                      </option>
                    ))}
                  </select>
                  <FieldHint>
                    {t(
                      "wordpress.reBanner.pagesHint",
                      "Selecting none is treated as everywhere.",
                    )}
                  </FieldHint>
                </Field>
              ) : null}

              <Field>
                <Label htmlFor="rebnr-priority">
                  {t("wordpress.reBanner.priority", "Priority")}
                </Label>
                <Input
                  id="rebnr-priority"
                  type="number"
                  min={0}
                  step={1}
                  value={draft.priority}
                  onChange={(e) => set("priority", Number(e.target.value) || 0)}
                />
                <FieldHint>
                  {t(
                    "wordpress.reBanner.priorityHint",
                    "When several banners are live in the same position, the highest priority wins and the rest stay hidden.",
                  )}
                </FieldHint>
              </Field>
            </CardBody>
          </SectionCard>
        </div>

        {/* ── Style + preview ───────────────────────────────────────── */}
        <div className="space-y-6">
          <SectionCard>
            <CardHeader title={t("wordpress.reBanner.style", "Style")} />
            <CardBody>
              <Field>
                <Label htmlFor="rebnr-variant">
                  {t("wordpress.reBanner.variant", "Variant")}
                </Label>
                <NativeSelect
                  id="rebnr-variant"
                  value={draft.variant}
                  onChange={(e) =>
                    set("variant", e.target.value as ReBannerConfig["variant"])
                  }
                >
                  {VARIANTS.map((option) => (
                    <NativeSelectOption key={option.key} value={option.key}>
                      {t(option.i18n, option.fallback)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>

              <Field>
                <Label htmlFor="rebnr-position">
                  {t("wordpress.reBanner.position", "Position")}
                </Label>
                <NativeSelect
                  id="rebnr-position"
                  value={draft.position}
                  onChange={(e) =>
                    set("position", e.target.value as ReBannerConfig["position"])
                  }
                >
                  {POSITIONS.map((option) => (
                    <NativeSelectOption key={option.key} value={option.key}>
                      {t(option.i18n, option.fallback)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>

              <TwoCol>
                <Field>
                  <Label htmlFor="rebnr-bg">
                    {t("wordpress.reBanner.bgColor", "Background")}
                  </Label>
                  <ColorInput
                    id="rebnr-bg"
                    value={draft.bg_color}
                    onChange={(v) => set("bg_color", v)}
                  />
                </Field>
                <Field>
                  <Label htmlFor="rebnr-fg">
                    {t("wordpress.reBanner.textColor", "Text")}
                  </Label>
                  <ColorInput
                    id="rebnr-fg"
                    value={draft.text_color}
                    onChange={(v) => set("text_color", v)}
                  />
                </Field>
              </TwoCol>

              <Field>
                <Label htmlFor="rebnr-accent">
                  {t("wordpress.reBanner.accentColor", "Button")}
                </Label>
                <ColorInput
                  id="rebnr-accent"
                  value={draft.accent_color}
                  onChange={(v) => set("accent_color", v)}
                />
              </Field>

              <ToggleField
                id="rebnr-dismissible"
                checked={draft.dismissible}
                onChange={(v) => set("dismissible", v)}
                label={t(
                  "wordpress.reBanner.dismissible",
                  "Visitors can dismiss it",
                )}
              />
            </CardBody>
          </SectionCard>

          <SectionCard>
            <CardHeader
              title={t("wordpress.reBanner.preview", "Preview")}
              subtitle={t(
                "wordpress.reBanner.previewSubtitle",
                "An approximation — your theme's fonts and spacing apply on the site itself.",
              )}
            />
            <CardBody>
              <BannerPreview config={draft} imageUrl={shownImage} />
            </CardBody>
          </SectionCard>

          {bannerId !== null ? (
            <SectionCard>
              <CardHeader
                title={t("wordpress.reBanner.shortcode", "Shortcode")}
                subtitle={t(
                  "wordpress.reBanner.shortcodeSubtitle",
                  "Paste this to place the banner inside page content instead of pinning it.",
                )}
              />
              <CardBody>
                <code className="block select-all rounded-md bg-muted px-3 py-2 font-mono text-sm">
                  {shortcodeFor(bannerId)}
                </code>
              </CardBody>
            </SectionCard>
          ) : null}
        </div>
      </div>

      <MediaLibraryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedId={draft.image_id}
        onSelect={handlePick}
      />
    </div>
  );
}
