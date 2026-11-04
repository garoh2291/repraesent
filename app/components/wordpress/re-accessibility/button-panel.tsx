import { useTranslation } from "react-i18next";
import {
  Move,
  PanelLeft,
  PanelRight,
  Palette,
  Shapes,
  Sparkles,
} from "lucide-react";
import { Label } from "~/components/ui/label";
import {
  CardBody,
  CardHeader,
  Field,
  FieldHint,
  SectionCard,
} from "~/components/wordpress/fields";
import {
  ColorField,
  Segmented,
  SliderField,
  SwitchRow,
} from "~/components/wordpress/re-cookie/fields";
import { BOUNDS, DEFAULTS, type PatchSettings, type ReAccessibilitySettings } from "./settings";
import { ContrastNote, IconPicker, ResetDesign } from "./parts";

const BUTTON_KEYS = [
  "launcher_icon",
  "launcher_icon_size",
  "launcher_color",
  "launcher_icon_color",
  "launcher_border_color",
  "launcher_size",
  "launcher_radius",
  "launcher_border_width",
  "launcher_shadow",
  "position",
  "offset_x",
  "offset_y",
  "hide_on_mobile",
] as const satisfies readonly (keyof ReAccessibilitySettings)[];

/** The button in the corner: its icon, colors, shape and place. */
export function ButtonPanel({
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

  return (
    <div className="space-y-4">
      <SectionCard>
        <CardHeader
          icon={<Sparkles className="size-4" />}
          title={t("wordpress.reAccessibility.iconTitle", "Icon")}
          subtitle={t(
            "wordpress.reAccessibility.iconDesc",
            "The symbol on your button. Pick one your visitors will recognize.",
          )}
        />
        <CardBody>
          <IconPicker
            value={settings.launcher_icon}
            onChange={(v) => set("launcher_icon", v)}
            background={settings.launcher_color}
            ink={settings.launcher_icon_color}
            radius={settings.launcher_radius / settings.launcher_size}
          />
          <Field>
            <Label htmlFor="re-accessibility-icon-size">
              {t("wordpress.reAccessibility.iconSize", "Icon size")}
            </Label>
            <SliderField
              id="re-accessibility-icon-size"
              value={settings.launcher_icon_size}
              onChange={(v) => set("launcher_icon_size", v)}
              min={BOUNDS.launcher_icon_size[0]}
              max={BOUNDS.launcher_icon_size[1]}
              unit="%"
            />
            <FieldHint>
              {t(
                "wordpress.reAccessibility.iconSizeHint",
                "How much of the button the icon fills.",
              )}
            </FieldHint>
          </Field>
        </CardBody>
      </SectionCard>

      <SectionCard>
        <CardHeader
          icon={<Palette className="size-4" />}
          title={t("wordpress.reAccessibility.buttonColorsTitle", "Colors")}
          subtitle={t(
            "wordpress.reAccessibility.buttonColorsDesc",
            "Pick colors that stand out from your website, so the button is easy to find.",
          )}
        />
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-2">
            <ColorField
              id="re-accessibility-launcher-color"
              label={t("wordpress.reAccessibility.buttonColor", "Button")}
              value={settings.launcher_color}
              placeholder={DEFAULTS.launcher_color}
              onChange={(v) => set("launcher_color", v)}
            />
            <ColorField
              id="re-accessibility-launcher-icon-color"
              label={t("wordpress.reAccessibility.iconColor", "Icon")}
              value={settings.launcher_icon_color}
              placeholder={DEFAULTS.launcher_icon_color}
              onChange={(v) => set("launcher_icon_color", v)}
            />
            <ColorField
              id="re-accessibility-launcher-border-color"
              label={t("wordpress.reAccessibility.borderColor", "Border")}
              value={settings.launcher_border_color}
              placeholder={DEFAULTS.launcher_border_color}
              onChange={(v) => set("launcher_border_color", v)}
            />
          </div>
          <ContrastNote
            foreground={settings.launcher_icon_color}
            background={settings.launcher_color}
            min={3}
          >
            {t(
              "wordpress.reAccessibility.iconContrastLow",
              "The icon is hard to see on this button color. Choose a lighter or darker icon.",
            )}
          </ContrastNote>
        </CardBody>
      </SectionCard>

      <SectionCard>
        <CardHeader
          icon={<Shapes className="size-4" />}
          title={t("wordpress.reAccessibility.shapeTitle", "Size and shape")}
        />
        <CardBody>
          <Field>
            <Label htmlFor="re-accessibility-launcher-size">
              {t("wordpress.reAccessibility.buttonSize", "Button size")}
            </Label>
            <SliderField
              id="re-accessibility-launcher-size"
              value={settings.launcher_size}
              onChange={(v) => set("launcher_size", v)}
              min={BOUNDS.launcher_size[0]}
              max={BOUNDS.launcher_size[1]}
              unit="px"
            />
            <FieldHint>
              {t(
                "wordpress.reAccessibility.buttonSizeHint",
                "At least 44 px, so it is easy to tap with a finger.",
              )}
            </FieldHint>
          </Field>
          <Field>
            <Label htmlFor="re-accessibility-launcher-radius">
              {t("wordpress.reAccessibility.cornerRadius", "Corner radius")}
            </Label>
            <SliderField
              id="re-accessibility-launcher-radius"
              value={settings.launcher_radius}
              onChange={(v) => set("launcher_radius", v)}
              min={BOUNDS.launcher_radius[0]}
              max={BOUNDS.launcher_radius[1]}
              unit="px"
            />
            <FieldHint>
              {t(
                "wordpress.reAccessibility.cornerRadiusHint",
                "0 is a square. Half the button size or more makes it round.",
              )}
            </FieldHint>
          </Field>
          <Field>
            <Label htmlFor="re-accessibility-launcher-border-width">
              {t("wordpress.reAccessibility.borderWidth", "Border width")}
            </Label>
            <SliderField
              id="re-accessibility-launcher-border-width"
              value={settings.launcher_border_width}
              onChange={(v) => set("launcher_border_width", v)}
              min={BOUNDS.launcher_border_width[0]}
              max={BOUNDS.launcher_border_width[1]}
              unit="px"
            />
          </Field>
          <SwitchRow
            id="re-accessibility-launcher-shadow"
            checked={settings.launcher_shadow}
            onChange={(v) => set("launcher_shadow", v)}
            label={t("wordpress.reAccessibility.shadow", "Shadow")}
            description={t(
              "wordpress.reAccessibility.shadowDesc",
              "Lifts the button off the page so it stays visible on busy pictures.",
            )}
          />
        </CardBody>
      </SectionCard>

      <SectionCard>
        <CardHeader
          icon={<Move className="size-4" />}
          title={t("wordpress.reAccessibility.placeTitle", "Place")}
          subtitle={t(
            "wordpress.reAccessibility.placeDesc",
            "Where the button sits. Visitors can still move it to the other side for themselves.",
          )}
        />
        <CardBody>
          <Field>
            <Label>{t("wordpress.reAccessibility.side", "Side")}</Label>
            <Segmented
              value={settings.position}
              onChange={(v) => set("position", v)}
              ariaLabel={t("wordpress.reAccessibility.side", "Side")}
              options={[
                {
                  value: "left",
                  label: t("wordpress.reAccessibility.left", "Bottom left"),
                  icon: <PanelLeft className="size-3.5" />,
                },
                {
                  value: "right",
                  label: t("wordpress.reAccessibility.right", "Bottom right"),
                  icon: <PanelRight className="size-3.5" />,
                },
              ]}
            />
          </Field>
          <Field>
            <Label htmlFor="re-accessibility-offset-x">
              {t("wordpress.reAccessibility.offsetX", "Distance from the side")}
            </Label>
            <SliderField
              id="re-accessibility-offset-x"
              value={settings.offset_x}
              onChange={(v) => set("offset_x", v)}
              min={BOUNDS.offset_x[0]}
              max={BOUNDS.offset_x[1]}
              unit="px"
            />
          </Field>
          <Field>
            <Label htmlFor="re-accessibility-offset-y">
              {t("wordpress.reAccessibility.offsetY", "Distance from the bottom")}
            </Label>
            <SliderField
              id="re-accessibility-offset-y"
              value={settings.offset_y}
              onChange={(v) => set("offset_y", v)}
              min={BOUNDS.offset_y[0]}
              max={BOUNDS.offset_y[1]}
              unit="px"
            />
            <FieldHint>
              {t(
                "wordpress.reAccessibility.offsetYHint",
                "Raise it if it covers a chat bubble or the cookie button.",
              )}
            </FieldHint>
          </Field>
          <SwitchRow
            id="re-accessibility-hide-on-mobile"
            checked={settings.hide_on_mobile}
            onChange={(v) => set("hide_on_mobile", v)}
            label={t("wordpress.reAccessibility.hideOnMobile", "Hide on phones")}
            description={t(
              "wordpress.reAccessibility.hideOnMobileDesc",
              "Only the button. The rest of the accessibility help stays on.",
            )}
          />
        </CardBody>
      </SectionCard>

      <div className="flex justify-end">
        <ResetDesign
          keys={BUTTON_KEYS}
          patch={patch}
          label={t("wordpress.reAccessibility.resetButton", "Back to the original button")}
        />
      </div>
    </div>
  );
}
