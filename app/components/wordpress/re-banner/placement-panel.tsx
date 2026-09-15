import { useTranslation } from "react-i18next";
import { Code2, Globe, ListChecks, ListX, MapPin, PanelTop } from "lucide-react";
import type {
  ReBannerConfig,
  ReBannerLinkTarget,
  ReBannerPlacement,
  ReBannerVisibility,
} from "~/lib/wordpress/plugin-settings-types";
import { Label } from "~/components/ui/label";
import {
  CardBody,
  CardHeader,
  Field,
  FieldHint,
  InfoNote,
  SectionCard,
} from "~/components/wordpress/fields";
import { CopyButton } from "~/components/molecule/copy-button";
import { PagePicker } from "~/components/wordpress/re-banner/page-picker";
import {
  PLACEMENTS,
  VISIBILITIES,
  shortcodeFor,
  type SetConfig,
} from "~/components/wordpress/re-banner/constants";
import { cn } from "~/lib/utils";

/**
 * Where the banner appears.
 *
 * A box layout is placed one of two ways, and the choice is exclusive: the
 * plugin pins it at the top of the page (then the page rules say where), or
 * it appears only where its shortcode is pasted (then there are no page
 * rules — the shortcode is the rule). Offering the shortcode alongside
 * automatic placement, as this panel once did, meant a banner could show
 * twice on one page. For `text` the shortcode is the ONLY placement — there
 * is nothing to inherit from at the top of <body> — so that choice is not
 * asked.
 *
 * No priority field: every banner is 0 and the newest live one wins a
 * position. A number nobody could predict the effect of was not worth a row.
 */
export function PlacementPanel({
  draft,
  set,
  bannerId,
  linkTargets,
  saving,
}: {
  draft: ReBannerConfig;
  set: SetConfig;
  /** null while creating — there is no shortcode to show yet. */
  bannerId: number | null;
  linkTargets: ReBannerLinkTarget[];
  saving: boolean;
}) {
  const { t } = useTranslation();
  const isText = draft.variant === "text";
  const byShortcode = isText || draft.placement === "shortcode";

  const shortcodeCard = (
    <SectionCard>
      <CardHeader
        icon={<Code2 className="size-4" />}
        title={t("wordpress.reBanner.shortcode", "Shortcode")}
        subtitle={
          isText
            ? t(
                "wordpress.reBanner.shortcodeSubtitleText",
                "The only way a text banner is placed. Paste it wherever the words belong — including inside a heading, where it takes on the heading's styling.",
              )
            : t(
                "wordpress.reBanner.shortcodeSubtitle",
                "Paste it into a page or a template where the banner belongs. The plugin will not pin it anywhere on its own.",
              )
        }
      />
      <CardBody>
        {bannerId !== null ? (
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 select-all truncate rounded-lg border bg-muted/50 px-3 py-2 font-mono text-sm">
              {shortcodeFor(bannerId)}
            </code>
            <CopyButton
              value={shortcodeFor(bannerId)}
              label={t("wordpress.reBanner.copyShortcode", "Copy")}
            />
          </div>
        ) : (
          <InfoNote>
            {t(
              "wordpress.reBanner.shortcodePending",
              "Save the banner to get its shortcode.",
            )}
          </InfoNote>
        )}

        {bannerId !== null ? (
          <FieldHint>
            {t("wordpress.reBanner.fromTemplate", "From a theme template:")}{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
              {`<?php echo do_shortcode('${shortcodeFor(bannerId)}'); ?>`}
            </code>
          </FieldHint>
        ) : null}
      </CardBody>
    </SectionCard>
  );

  if (isText) {
    return (
      <div className="space-y-4">
        {shortcodeCard}
        <InfoNote>
          {t(
            "wordpress.reBanner.textPlacementNote",
            "A text banner goes exactly where you paste its shortcode, so page rules do not apply to it.",
          )}
        </InfoNote>
      </div>
    );
  }

  const placementIcons: Record<ReBannerPlacement, typeof Globe> = {
    auto: PanelTop,
    shortcode: Code2,
  };
  const visibilityIcons: Record<ReBannerVisibility, typeof Globe> = {
    all: Globe,
    include: ListChecks,
    exclude: ListX,
  };

  const radioClass = (active: boolean) =>
    cn(
      "flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-all",
      "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
      active
        ? "border-foreground bg-card shadow-sm"
        : "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground",
    );

  return (
    <div className="space-y-4">
      <SectionCard>
        <CardHeader
          icon={<MapPin className="size-4" />}
          title={t("wordpress.reBanner.placement", "How it is placed")}
          subtitle={t(
            "wordpress.reBanner.placementSubtitle",
            "Pinned at the top of the page by the plugin, or only where you paste its shortcode — one or the other, never both.",
          )}
        />
        <CardBody>
          <div
            role="radiogroup"
            aria-label={t("wordpress.reBanner.placement", "How it is placed")}
            className="grid gap-2 sm:grid-cols-2"
          >
            {PLACEMENTS.map((option) => {
              const Icon = placementIcons[option.key];
              const active = draft.placement === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={saving}
                  onClick={() => set("placement", option.key)}
                  className={radioClass(active)}
                >
                  <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="min-w-0">
                    <span className="block font-medium leading-snug">
                      {t(option.i18n, option.fallback)}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                      {t(option.hintI18n, option.hint)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {byShortcode ? null : (
            <>
              <Field>
                <Label>{t("wordpress.reBanner.visibility", "Show on")}</Label>
                <div
                  role="radiogroup"
                  aria-label={t("wordpress.reBanner.visibility", "Show on")}
                  className="grid gap-2 sm:grid-cols-3"
                >
                  {VISIBILITIES.map((option) => {
                    const Icon = visibilityIcons[option.key];
                    const active = draft.visibility === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={saving}
                        onClick={() => set("visibility", option.key)}
                        className={radioClass(active)}
                      >
                        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span className="font-medium leading-snug">
                          {t(option.i18n, option.fallback)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Field>

              {draft.visibility !== "all" ? (
                <Field>
                  <Label>
                    {draft.visibility === "include"
                      ? t("wordpress.reBanner.pagesInclude", "Show only on")
                      : t("wordpress.reBanner.pagesExclude", "Hide on")}
                  </Label>
                  <PagePicker
                    targets={linkTargets}
                    value={draft.page_ids}
                    onChange={(ids) => set("page_ids", ids)}
                    disabled={saving}
                  />
                  <FieldHint>
                    {t(
                      "wordpress.reBanner.pagesHint",
                      "Selecting none is treated as everywhere.",
                    )}
                  </FieldHint>
                </Field>
              ) : null}

              <FieldHint>
                {t(
                  "wordpress.reBanner.newestWinsHint",
                  "When several banners are live in the same position, the newest one shows and the rest stay hidden.",
                )}
              </FieldHint>
            </>
          )}
        </CardBody>
      </SectionCard>

      {byShortcode ? shortcodeCard : null}
    </div>
  );
}
