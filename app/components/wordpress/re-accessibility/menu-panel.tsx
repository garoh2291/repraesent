import { useTranslation } from "react-i18next";
import { PanelRight, Palette, Shapes } from "lucide-react";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
import {
  CardBody,
  CardHeader,
  Field,
  FieldHint,
  SectionCard,
} from "~/components/wordpress/fields";
import {
  ColorField,
  SliderField,
} from "~/components/wordpress/re-cookie/fields";
import {
  BOUNDS,
  DEFAULTS,
  MENU_PALETTES,
  type MenuPalette,
  type PatchSettings,
  type ReAccessibilitySettings,
} from "./settings";
import { ContrastNote, FieldGroup, ResetDesign } from "./parts";

const MENU_KEYS = [
  "panel_width",
  "panel_radius",
  "card_radius",
  "control_radius",
  "accent_color",
  "surface_color",
  "header_color",
  "card_color",
  "text_color",
  "muted_color",
  "line_color",
] as const satisfies readonly (keyof ReAccessibilitySettings)[];

/** The menu that opens from the button: colors, corners and layout. */
export function MenuPanel({
  settings,
  patch,
}: {
  settings: ReAccessibilitySettings;
  patch: PatchSettings;
}) {
  const { t } = useTranslation();

  function set<K extends keyof ReAccessibilitySettings>(
    key: K,
    value: ReAccessibilitySettings[K],
  ) {
    patch((prev) => ({ ...prev, [key]: value }));
  }

  const paletteNames: Record<string, string> = {
    light: t("wordpress.reAccessibility.paletteLight", "Light"),
    white: t("wordpress.reAccessibility.paletteWhite", "White"),
    dark: t("wordpress.reAccessibility.paletteDark", "Dark"),
    contrast: t("wordpress.reAccessibility.paletteContrast", "High contrast"),
  };

  const color = (
    key: keyof MenuPalette | "accent_color",
    label: string,
  ) => (
    <ColorField
      id={`re-accessibility-${key.replace(/_/g, "-")}`}
      label={label}
      value={settings[key]}
      placeholder={DEFAULTS[key]}
      onChange={(v) => set(key, v)}
    />
  );

  return (
    <div className="space-y-4">
      <SectionCard>
        <CardHeader
          icon={<Palette className="size-4" />}
          title={t("wordpress.reAccessibility.menuColorsTitle", "Colors")}
          subtitle={t(
            "wordpress.reAccessibility.menuColorsDesc",
            "Start from a set and adjust any color you like.",
          )}
        />
        <CardBody className="space-y-6">
          <div
            role="group"
            aria-label={t("wordpress.reAccessibility.palettes", "Color sets")}
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {MENU_PALETTES.map(({ id, palette }) => {
              const active = (Object.keys(palette) as (keyof MenuPalette)[]).every(
                (k) => settings[k].toLowerCase() === palette[k],
              );
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => patch((prev) => ({ ...prev, ...palette }))}
                  className={cn(
                    "flex flex-col gap-2 rounded-xl border bg-card p-2.5 text-left text-xs font-medium transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    active
                      ? "border-foreground ring-1 ring-foreground"
                      : "hover:border-foreground/30",
                  )}
                >
                  <span
                    aria-hidden
                    className="flex h-9 items-center gap-1 rounded-lg border p-1.5"
                    style={{ background: palette.surface_color }}
                  >
                    <span
                      className="h-full flex-1 rounded"
                      style={{
                        background: palette.card_color,
                        boxShadow: `inset 0 0 0 1px ${palette.line_color}`,
                      }}
                    />
                    <span
                      className="h-full flex-1 rounded"
                      style={{
                        background: palette.card_color,
                        boxShadow: `inset 0 0 0 1px ${palette.line_color}`,
                      }}
                    />
                    <span
                      className="h-full flex-1 rounded"
                      style={{ background: settings.accent_color }}
                    />
                    <span
                      className="h-1.5 w-3 rounded-full"
                      style={{ background: palette.text_color }}
                    />
                  </span>
                  {paletteNames[id]}
                </button>
              );
            })}
          </div>

          <FieldGroup label={t("wordpress.reAccessibility.highlight", "Highlight")}>
            {color("accent_color", t("wordpress.reAccessibility.accentColor", "Highlight color"))}
            <FieldHint>
              {t(
                "wordpress.reAccessibility.accentColorFillHint",
                "Fills the option a visitor chose, and a switched-on switch.",
              )}
            </FieldHint>
            <ContrastNote
              foreground={settings.accent_color}
              background={settings.card_color}
              min={3}
            >
              {t(
                "wordpress.reAccessibility.accentContrastLow",
                "Switched-on adjustments are hard to tell apart with this highlight color. Choose a stronger one.",
              )}
            </ContrastNote>
          </FieldGroup>

          <FieldGroup label={t("wordpress.reAccessibility.surfaces", "Surfaces")}>
            <div className="grid gap-3 sm:grid-cols-2">
              {color("surface_color", t("wordpress.reAccessibility.surfaceColor", "Background"))}
              {color("header_color", t("wordpress.reAccessibility.headerColor", "Header and footer"))}
              {color("card_color", t("wordpress.reAccessibility.cardColor", "List of adjustments"))}
              {color("line_color", t("wordpress.reAccessibility.lineColor", "Lines"))}
            </div>
          </FieldGroup>

          <FieldGroup label={t("wordpress.reAccessibility.texts", "Text")}>
            <div className="grid gap-3 sm:grid-cols-2">
              {color("text_color", t("wordpress.reAccessibility.textColor", "Text"))}
              {color("muted_color", t("wordpress.reAccessibility.mutedColor", "Small print"))}
            </div>
            <ContrastNote
              foreground={settings.text_color}
              background={settings.card_color}
              min={4.5}
            >
              {t(
                "wordpress.reAccessibility.textContrastLow",
                "Text in the list is hard to read. People who need this menu most need strong contrast.",
              )}
            </ContrastNote>
            <ContrastNote
              foreground={settings.muted_color}
              background={settings.surface_color}
              min={4.5}
            >
              {t(
                "wordpress.reAccessibility.mutedContrastLow",
                "The small print is hard to read on the background.",
              )}
            </ContrastNote>
          </FieldGroup>
        </CardBody>
      </SectionCard>

      <SectionCard>
        <CardHeader
          icon={<PanelRight className="size-4" />}
          title={t("wordpress.reAccessibility.layoutTitle", "Layout")}
        />
        <CardBody>
          <Field>
            <Label htmlFor="re-accessibility-panel-width">
              {t("wordpress.reAccessibility.panelWidth", "Menu width")}
            </Label>
            <SliderField
              id="re-accessibility-panel-width"
              value={settings.panel_width}
              onChange={(v) => set("panel_width", v)}
              min={BOUNDS.panel_width[0]}
              max={BOUNDS.panel_width[1]}
              step={10}
              unit="px"
            />
            <FieldHint>
              {t(
                "wordpress.reAccessibility.panelWidthHint",
                "On phones the menu always fits the screen.",
              )}
            </FieldHint>
          </Field>
        </CardBody>
      </SectionCard>

      <SectionCard>
        <CardHeader
          icon={<Shapes className="size-4" />}
          title={t("wordpress.reAccessibility.cornersTitle", "Corners")}
          subtitle={t(
            "wordpress.reAccessibility.cornersDesc",
            "0 px is square. Higher numbers round the corners more.",
          )}
        />
        <CardBody>
          <Field>
            <Label htmlFor="re-accessibility-panel-radius">
              {t("wordpress.reAccessibility.panelRadius", "Menu")}
            </Label>
            <SliderField
              id="re-accessibility-panel-radius"
              value={settings.panel_radius}
              onChange={(v) => set("panel_radius", v)}
              min={BOUNDS.panel_radius[0]}
              max={BOUNDS.panel_radius[1]}
              unit="px"
            />
          </Field>
          <Field>
            <Label htmlFor="re-accessibility-card-radius">
              {t("wordpress.reAccessibility.cardRadius", "List of adjustments")}
            </Label>
            <SliderField
              id="re-accessibility-card-radius"
              value={settings.card_radius}
              onChange={(v) => set("card_radius", v)}
              min={BOUNDS.card_radius[0]}
              max={BOUNDS.card_radius[1]}
              unit="px"
            />
          </Field>
          <Field>
            <Label htmlFor="re-accessibility-control-radius">
              {t("wordpress.reAccessibility.controlRadius", "Options and buttons")}
            </Label>
            <SliderField
              id="re-accessibility-control-radius"
              value={settings.control_radius}
              onChange={(v) => set("control_radius", v)}
              min={BOUNDS.control_radius[0]}
              max={BOUNDS.control_radius[1]}
              unit="px"
            />
          </Field>
        </CardBody>
      </SectionCard>

      <div className="flex justify-end">
        <ResetDesign
          keys={MENU_KEYS}
          patch={patch}
          label={t("wordpress.reAccessibility.resetMenu", "Back to the original menu")}
        />
      </div>
    </div>
  );
}
