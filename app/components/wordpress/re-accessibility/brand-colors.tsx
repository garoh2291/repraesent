import { useTranslation } from "react-i18next";
import { Palette } from "lucide-react";
import {
  CardBody,
  CardHeader,
  FieldHint,
  SectionCard,
} from "~/components/wordpress/fields";
import { ColorField } from "~/components/wordpress/re-cookie/fields";
import {
  DEFAULTS,
  PRIMARY_KEYS,
  SECONDARY_KEYS,
  type PatchSettings,
  type ReAccessibilitySettings,
} from "./settings";
import { ContrastNote } from "./parts";

/**
 * The quick way in: the site's main and second colour, written to every
 * setting that carries them (PRIMARY_KEYS / SECONDARY_KEYS). The tabs below
 * still fine-tune each one alone.
 */
export function BrandColors({
  settings,
  patch,
}: {
  settings: ReAccessibilitySettings;
  patch: PatchSettings;
}) {
  const { t } = useTranslation();

  function setAll(keys: readonly (keyof ReAccessibilitySettings)[], value: string) {
    patch((prev) => ({
      ...prev,
      ...Object.fromEntries(keys.map((k) => [k, value])),
    }));
  }

  return (
    <SectionCard>
      <CardHeader
        icon={<Palette className="size-4" />}
        title={t("wordpress.reAccessibility.brandTitle", "Your colors")}
        subtitle={t(
          "wordpress.reAccessibility.brandDesc",
          "Pick your website's main color and a second color. The button and the menu use both. You can fine-tune every part in the tabs below.",
        )}
      />
      <CardBody>
        <div className="grid gap-3 sm:grid-cols-2">
          <ColorField
            id="re-accessibility-primary-color"
            label={t("wordpress.reAccessibility.primaryColor", "Main color")}
            value={settings.accent_color}
            placeholder={DEFAULTS.accent_color}
            onChange={(v) => setAll(PRIMARY_KEYS, v)}
          />
          <ColorField
            id="re-accessibility-secondary-color"
            label={t("wordpress.reAccessibility.secondaryColor", "Second color")}
            value={settings.launcher_icon_color}
            placeholder={DEFAULTS.launcher_icon_color}
            onChange={(v) => setAll(SECONDARY_KEYS, v)}
          />
        </div>
        <FieldHint>
          {t(
            "wordpress.reAccessibility.brandHint",
            "The main color fills the button and the options a visitor chose. The second color is the icon on the button.",
          )}
        </FieldHint>
        <ContrastNote
          foreground={settings.launcher_icon_color}
          background={settings.launcher_color}
          min={3}
        >
          {t(
            "wordpress.reAccessibility.brandSecondaryLow",
            "The second color is hard to see on the main color, so the button's icon is too. Choose colors that differ more, for example white on a dark main color.",
          )}
        </ContrastNote>
        <ContrastNote
          foreground={settings.accent_color}
          background={settings.card_color}
          min={3}
        >
          {t(
            "wordpress.reAccessibility.brandPrimaryLow",
            "Chosen options are hard to see with this main color. Choose a stronger one.",
          )}
        </ContrastNote>
      </CardBody>
    </SectionCard>
  );
}
