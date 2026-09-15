import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Palette, SlidersHorizontal } from "lucide-react";
import type { ReBannerConfig } from "~/lib/wordpress/plugin-settings-types";
import type { ReBannerStyleElement } from "~/lib/wordpress/re-banner-styles";
import { countOverrides } from "~/lib/wordpress/re-banner-styles";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { CardBody, CardHeader, SectionCard } from "~/components/wordpress/fields";
import { ColorField, SwitchRow } from "~/components/wordpress/re-cookie/fields";
import { BannerStyleInspector } from "~/components/wordpress/re-banner/banner-style-inspector";
import type { SetConfig } from "~/components/wordpress/re-banner/constants";
import { cn } from "~/lib/utils";

/**
 * How the banner looks: its colours and, behind a fold, the per-element
 * typography and spacing overrides. Which layout it is and how it sits in
 * the page are decided under Content, next to the words they shape.
 */
export function DesignPanel({
  draft,
  set,
  hasCta,
  onSelectElement,
}: {
  draft: ReBannerConfig;
  set: SetConfig;
  hasCta: boolean;
  onSelectElement: (element: ReBannerStyleElement | null) => void;
}) {
  const { t } = useTranslation();
  const isText = draft.variant === "text";
  const overrideCount = countOverrides(draft.styles);
  const [advancedOpen, setAdvancedOpen] = useState(overrideCount > 0);

  // The inspector announces its element while mounted; folding it away has
  // to take the outline off the preview too.
  useEffect(() => {
    if (!advancedOpen) onSelectElement(null);
  }, [advancedOpen, onSelectElement]);

  return (
    <div className="space-y-4">
      {isText ? null : (
        <SectionCard>
          <CardHeader
            icon={<Palette className="size-4" />}
            title={t("wordpress.reBanner.colours", "Colours")}
            subtitle={t(
              "wordpress.reBanner.coloursSubtitle",
              "The same three colours for every box layout. The button's label takes the background colour.",
            )}
          />
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-3">
              <ColorField
                id="rebnr-bg"
                label={t("wordpress.reBanner.bgColor", "Background")}
                value={draft.bg_color}
                placeholder="#0a0a0a"
                onChange={(v) => set("bg_color", v)}
              />
              <ColorField
                id="rebnr-fg"
                label={t("wordpress.reBanner.textColor", "Text")}
                value={draft.text_color}
                placeholder="#ffffff"
                onChange={(v) => set("text_color", v)}
              />
              <ColorField
                id="rebnr-accent"
                label={t("wordpress.reBanner.accentColor", "Button")}
                value={draft.accent_color}
                placeholder="#ffffff"
                onChange={(v) => set("accent_color", v)}
              />
            </div>

            {/*
              Dismissal needs the plugin's stylesheet and script to run, and a
              text banner ships neither — the plugin stores `false` for it
              regardless, so offering the toggle there would be drawing a
              promise nothing keeps.
            */}
            <SwitchRow
              id="rebnr-dismissible"
              checked={draft.dismissible}
              onChange={(v) => set("dismissible", v)}
              label={t("wordpress.reBanner.dismissible", "Visitors can close it")}
              description={t(
                "wordpress.reBanner.dismissibleHint",
                "Adds a × button. A visitor who closes the banner does not see it again in that browser.",
              )}
            />
          </CardBody>
        </SectionCard>
      )}

      <SectionCard>
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/30 sm:px-6"
            >
              <span
                aria-hidden
                className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
              >
                <SlidersHorizontal className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold tracking-tight">
                    {t("wordpress.reBanner.typographySpacing", "Typography & spacing")}
                  </span>
                  {overrideCount > 0 ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary tabular-nums">
                      {t("wordpress.reBanner.overrideBadge", "{{count}} set", { count: overrideCount })}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  {t(
                    "wordpress.reBanner.typographySpacingHint",
                    "Fine-tune one element at a time — size, weight, colour, margins. Everything starts on Auto and keeps the theme's value until you change it.",
                  )}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
                  advancedOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t p-5 sm:p-6">
              <BannerStyleInspector
                styles={draft.styles}
                variant={draft.variant}
                bodyHtml={draft.body_html}
                hasCta={hasCta}
                hasImage={draft.image_id > 0 && draft.variant !== "bar"}
                onChange={(styles) => set("styles", styles)}
                onSelectElement={onSelectElement}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </SectionCard>
    </div>
  );
}
