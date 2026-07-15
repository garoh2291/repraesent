import { useTranslation } from "react-i18next";
import {
  AlignHorizontalDistributeCenter,
  Palette,
  PanelBottom,
  Square,
} from "lucide-react";
import { Label } from "~/components/ui/label";
import type { ReCookieSettings } from "~/lib/wordpress/plugin-settings-types";
import type { PatchSettings } from "./constants";
import {
  CardBody,
  CardHeader,
  ColorField,
  Field,
  FieldGroup,
  FieldHint,
  SectionCard,
  Segmented,
  SliderField,
  SwitchRow,
} from "./fields";

export function DesignPanel({
  settings,
  patch,
}: {
  settings: ReCookieSettings;
  patch: PatchSettings;
}) {
  const { t } = useTranslation();

  function set<K extends keyof ReCookieSettings>(
    key: K,
    val: ReCookieSettings[K],
  ) {
    patch((prev) => ({ ...prev, [key]: val }));
  }

  return (
    <div className="space-y-4">
      <SectionCard>
        <CardHeader
          icon={<AlignHorizontalDistributeCenter className="size-4" />}
          title={t("wordpress.reCookie.layoutTitle", "Layout")}
          subtitle={t(
            "wordpress.reCookie.layoutDesc",
            "Where the banner sits and how rounded its corners are.",
          )}
        />
        <CardBody>
          <Field>
            <Label htmlFor="re-cookie-banner-position">
              {t("wordpress.reCookie.bannerPosition", "Banner position")}
            </Label>
            <Segmented
              value={settings.banner_position}
              onChange={(v) => set("banner_position", v)}
              ariaLabel={t(
                "wordpress.reCookie.bannerPosition",
                "Banner position",
              )}
              options={[
                {
                  value: "bottom",
                  label: t("wordpress.reCookie.bottom", "Bottom"),
                  icon: <PanelBottom className="size-3.5" />,
                },
                {
                  value: "center",
                  label: t("wordpress.reCookie.center", "Center"),
                  icon: <Square className="size-3.5" />,
                },
              ]}
            />
          </Field>

          <Field>
            <Label htmlFor="re-cookie-border-radius">
              {t("wordpress.reCookie.borderRadius", "Border radius (px)")}
            </Label>
            <SliderField
              id="re-cookie-border-radius"
              value={settings.border_radius}
              onChange={(v) => set("border_radius", v)}
              min={0}
              max={32}
              unit="px"
            />
          </Field>

          <SwitchRow
            id="re-cookie-show-modal-overlay"
            checked={settings.show_modal_overlay}
            onChange={(v) => set("show_modal_overlay", v)}
            label={t(
              "wordpress.reCookie.showModalOverlay",
              "Show overlay behind modal",
            )}
            description={t(
              "wordpress.reCookie.showModalOverlayDesc",
              "Dims the page behind the preferences modal and the centered banner.",
            )}
          />
        </CardBody>
      </SectionCard>

      <SectionCard>
        <CardHeader
          icon={<Palette className="size-4" />}
          title={t("wordpress.reCookie.designTitle", "Colors")}
          subtitle={t(
            "wordpress.reCookie.designDesc",
            "Customize the visual appearance of your cookie consent banner.",
          )}
        />
        <CardBody className="space-y-6">
          <FieldGroup label={t("wordpress.reCookie.colorsSurface", "Surface")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <ColorField
                id="re-cookie-background-color"
                label={t("wordpress.reCookie.backgroundColor", "Background color")}
                value={settings.background_color}
                placeholder="#ffffff"
                onChange={(v) => set("background_color", v)}
              />
              <ColorField
                id="re-cookie-text-color"
                label={t("wordpress.reCookie.textColor", "Text color")}
                value={settings.text_color}
                placeholder="#1f2937"
                onChange={(v) => set("text_color", v)}
              />
              <ColorField
                id="re-cookie-primary-color"
                label={t("wordpress.reCookie.primaryColor", "Primary color")}
                value={settings.primary_color}
                placeholder="#000000"
                onChange={(v) => set("primary_color", v)}
              />
            </div>
            <FieldHint>
              {t(
                "wordpress.reCookie.primaryColorHint",
                "The primary color is used for links, active toggles and the manage-cookies handle.",
              )}
            </FieldHint>
          </FieldGroup>

          <FieldGroup label={t("wordpress.reCookie.colorsButtons", "Buttons")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <ColorField
                id="re-cookie-accept-button-color"
                label={t(
                  "wordpress.reCookie.acceptButtonColor",
                  "Accept button color",
                )}
                value={settings.accept_button_color}
                placeholder="#000000"
                onChange={(v) => set("accept_button_color", v)}
              />
              <ColorField
                id="re-cookie-reject-button-color"
                label={t(
                  "wordpress.reCookie.rejectButtonColor",
                  "Reject button color",
                )}
                value={settings.reject_button_color}
                placeholder="#6b7280"
                onChange={(v) => set("reject_button_color", v)}
              />
              <ColorField
                id="re-cookie-secondary-button-color"
                label={t(
                  "wordpress.reCookie.secondaryButtonColor",
                  "Secondary button color",
                )}
                value={settings.secondary_button_color}
                placeholder="#e5e7eb"
                onChange={(v) => set("secondary_button_color", v)}
              />
            </div>
            <FieldHint>
              {t(
                "wordpress.reCookie.buttonColorHint",
                "Label color is derived automatically so text stays legible on each button.",
              )}
            </FieldHint>
          </FieldGroup>
        </CardBody>
      </SectionCard>
    </div>
  );
}
