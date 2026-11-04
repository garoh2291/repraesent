import { useTranslation } from "react-i18next";
import { LayoutList, ListChecks } from "lucide-react";
import { Switch } from "~/components/ui/switch";
import { cn } from "~/lib/utils";
import {
  CardBody,
  CardHeader,
  FieldHint,
  SectionCard,
} from "~/components/wordpress/fields";
import { SwitchRow } from "~/components/wordpress/re-cookie/fields";
import { iconSvg } from "./icons";
import {
  FEATURE_GROUPS,
  FEATURE_KEYS,
  type PatchSettings,
  type ReAccessibilityFeature,
  type ReAccessibilityFeatureGroup,
  type ReAccessibilitySettings,
} from "./settings";

/** Which adjustments the menu offers, and the extra rows around them. */
export function FeaturesPanel({
  settings,
  patch,
}: {
  settings: ReAccessibilitySettings;
  patch: PatchSettings;
}) {
  const { t } = useTranslation();

  const names: Record<ReAccessibilityFeature, { label: string; does: string }> = {
    contrast: {
      label: t("wordpress.reAccessibility.fContrast", "Contrast"),
      does: t("wordpress.reAccessibility.fContrastDesc", "Inverted, dark or light colors"),
    },
    links: {
      label: t("wordpress.reAccessibility.fLinks", "Mark links"),
      does: t("wordpress.reAccessibility.fLinksDesc", "Underlines and frames every link"),
    },
    text: {
      label: t("wordpress.reAccessibility.fText", "Text size"),
      does: t("wordpress.reAccessibility.fTextDesc", "Four sizes, up to 175%"),
    },
    spacing: {
      label: t("wordpress.reAccessibility.fSpacing", "Letter spacing"),
      does: t("wordpress.reAccessibility.fSpacingDesc", "More room between letters and words"),
    },
    pause: {
      label: t("wordpress.reAccessibility.fPause", "Stop motion"),
      does: t("wordpress.reAccessibility.fPauseDesc", "Stops motion, videos and sliders"),
    },
    images: {
      label: t("wordpress.reAccessibility.fImages", "Hide images"),
      does: t("wordpress.reAccessibility.fImagesDesc", "For a calmer page"),
    },
    dyslexia: {
      label: t("wordpress.reAccessibility.fDyslexia", "Readable font"),
      does: t("wordpress.reAccessibility.fDyslexiaDesc", "Easier-to-read fonts"),
    },
    cursor: {
      label: t("wordpress.reAccessibility.fCursor", "Reading aid"),
      does: t("wordpress.reAccessibility.fCursorDesc", "Big cursor, reading mask, reading guide"),
    },
    tooltips: {
      label: t("wordpress.reAccessibility.fTooltips", "Show labels"),
      does: t("wordpress.reAccessibility.fTooltipsDesc", "Names buttons and pictures on hover"),
    },
    lineheight: {
      label: t("wordpress.reAccessibility.fLineheight", "Line spacing"),
      does: t("wordpress.reAccessibility.fLineheightDesc", "More room between lines"),
    },
    align: {
      label: t("wordpress.reAccessibility.fAlign", "Align text"),
      does: t("wordpress.reAccessibility.fAlignDesc", "Left, right, centered or justified"),
    },
    saturation: {
      label: t("wordpress.reAccessibility.fSaturation", "Color strength"),
      does: t("wordpress.reAccessibility.fSaturationDesc", "Softer, stronger or gray colors"),
    },
  };

  const groupNames: Record<ReAccessibilityFeatureGroup, string> = {
    seeing: t("wordpress.reAccessibility.groupSeeing", "Seeing"),
    reading: t("wordpress.reAccessibility.groupReading", "Reading"),
    navigating: t("wordpress.reAccessibility.groupNavigating", "Navigating"),
  };

  const onCount = FEATURE_KEYS.filter((k) => settings.features[k]).length;

  function setFeature(key: ReAccessibilityFeature, on: boolean) {
    patch((prev) => ({ ...prev, features: { ...prev.features, [key]: on } }));
  }

  function set<K extends keyof ReAccessibilitySettings>(
    key: K,
    value: ReAccessibilitySettings[K],
  ) {
    patch((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-4">
      <SectionCard>
        <CardHeader
          icon={<ListChecks className="size-4" />}
          title={t("wordpress.reAccessibility.featuresTitle", "Adjustments")}
          subtitle={t(
            "wordpress.reAccessibility.featuresDesc",
            "What the menu offers, under the same tabs visitors see. Visitors choose for themselves; switch one off here to leave it out.",
          )}
          action={
            <span className="text-xs text-muted-foreground tabular-nums">
              {t("wordpress.reAccessibility.featuresCount", "{{on}} of {{all}} on", {
                on: onCount,
                all: FEATURE_KEYS.length,
              })}
            </span>
          }
        />
        <CardBody>
          <div className="space-y-5">
            {FEATURE_GROUPS.map(({ id: group, features }) => (
              <section key={group} aria-labelledby={`re-accessibility-group-${group}`}>
                <h3
                  id={`re-accessibility-group-${group}`}
                  className="mb-2 text-xs font-semibold text-muted-foreground"
                >
                  {groupNames[group]}
                </h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {features.map((key) => {
                    const on = settings.features[key];
                    const id = `re-accessibility-feature-${key}`;
                    return (
                      <li
                        key={key}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                          on ? "bg-card" : "bg-muted/30",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-[18px]",
                            on ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                          )}
                          // Our own static SVG (icons.ts), never user input.
                          dangerouslySetInnerHTML={{ __html: iconSvg(key) }}
                        />
                        <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                          <span className="block truncate text-sm font-medium">
                            {names[key].label}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {names[key].does}
                          </span>
                        </label>
                        <Switch
                          id={id}
                          checked={on}
                          onCheckedChange={(v) => setFeature(key, v)}
                          className="shrink-0"
                        />
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
          {onCount === 0 ? (
            <FieldHint>
              {t(
                "wordpress.reAccessibility.featuresNone",
                "With everything off, the menu is empty. Switch on at least the ones your visitors need.",
              )}
            </FieldHint>
          ) : null}
        </CardBody>
      </SectionCard>

      <SectionCard>
        <CardHeader
          icon={<LayoutList className="size-4" />}
          title={t("wordpress.reAccessibility.menuPartsTitle", "More in the menu")}
        />
        <CardBody>
          <SwitchRow
            id="re-accessibility-show-oversized"
            checked={settings.show_oversized}
            onChange={(v) => set("show_oversized", v)}
            label={t("wordpress.reAccessibility.showOversized", "Bigger menu switch")}
            description={t(
              "wordpress.reAccessibility.showOversizedDesc",
              "Lets visitors make the menu itself larger.",
            )}
          />
          <SwitchRow
            id="re-accessibility-show-widget-options"
            checked={settings.show_widget_options}
            onChange={(v) => set("show_widget_options", v)}
            label={t("wordpress.reAccessibility.showWidgetOptions", "Move or hide the button")}
            description={t(
              "wordpress.reAccessibility.showWidgetOptionsDesc",
              "Lets visitors move the button to the other side or hide it for themselves.",
            )}
          />
          <SwitchRow
            id="re-accessibility-shortcut"
            checked={settings.shortcut}
            onChange={(v) => set("shortcut", v)}
            label={t("wordpress.reAccessibility.shortcutAltA", "Open with Alt+A")}
            description={t(
              "wordpress.reAccessibility.shortcutDesc",
              "Keyboard users can open the menu from anywhere, even with the button hidden. On a Mac it is Option+A.",
            )}
          />
        </CardBody>
      </SectionCard>
    </div>
  );
}
