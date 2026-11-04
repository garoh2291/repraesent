import { useTranslation } from "react-i18next";
import { FileText, Globe } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  CardBody,
  CardHeader,
  Field,
  FieldHint,
  SectionCard,
} from "~/components/wordpress/fields";
import { ColorField, SwitchRow } from "~/components/wordpress/re-cookie/fields";
import { DEFAULTS, type PatchSettings, type ReAccessibilitySettings } from "./settings";

/** Help that works on every page, menu or not, and the statement page. */
export function WebsitePanel({
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
          icon={<Globe className="size-4" />}
          title={t("wordpress.reAccessibility.siteTitle", "On every page")}
          subtitle={t(
            "wordpress.reAccessibility.siteDesc",
            "Help for keyboard and screen reader users that works without opening the menu.",
          )}
        />
        <CardBody>
          <SwitchRow
            id="re-accessibility-skip-link"
            checked={settings.skip_link}
            onChange={(v) => set("skip_link", v)}
            label={t("wordpress.reAccessibility.skipLink", "“Skip to content” link")}
            description={t(
              "wordpress.reAccessibility.skipLinkDesc",
              "Appears on the first press of the Tab key and jumps past the menu bar. Left out when your theme has its own.",
            )}
          />
          <SwitchRow
            id="re-accessibility-focus-ring"
            checked={settings.focus_ring}
            onChange={(v) => set("focus_ring", v)}
            label={t("wordpress.reAccessibility.focusRing", "Clear keyboard focus")}
            description={t(
              "wordpress.reAccessibility.focusRingDesc",
              "A strong outline around whatever the keyboard is on, so visitors always see where they are.",
            )}
          />
          {settings.focus_ring ? (
            <ColorField
              id="re-accessibility-focus-color"
              label={t("wordpress.reAccessibility.focusColor", "Outline color")}
              value={settings.focus_color}
              placeholder={DEFAULTS.focus_color}
              onChange={(v) => set("focus_color", v)}
            />
          ) : null}
          <SwitchRow
            id="re-accessibility-reduced-motion"
            checked={settings.reduced_motion}
            onChange={(v) => set("reduced_motion", v)}
            label={t("wordpress.reAccessibility.reducedMotion", "Less motion when asked")}
            description={t(
              "wordpress.reAccessibility.reducedMotionDesc",
              "Turns animations down for visitors whose phone or computer is set to reduce motion.",
            )}
          />
        </CardBody>
      </SectionCard>

      <SectionCard>
        <CardHeader
          icon={<FileText className="size-4" />}
          title={t("wordpress.reAccessibility.statementTitle", "Accessibility statement")}
          subtitle={t(
            "wordpress.reAccessibility.statementDesc",
            "A page that tells visitors what you do for accessibility and how to reach you about a barrier. It is linked from the menu.",
          )}
        />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <Label htmlFor="re-accessibility-contact-email">
                {t("wordpress.reAccessibility.contactEmail", "Email for feedback")}
              </Label>
              <Input
                id="re-accessibility-contact-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                value={settings.contact_email}
                placeholder={t("wordpress.reAccessibility.contactEmailPlaceholder", "Your website's admin email")}
                onChange={(e) => set("contact_email", e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="re-accessibility-contact-phone">
                {t("wordpress.reAccessibility.contactPhone", "Phone for feedback")}
              </Label>
              <Input
                id="re-accessibility-contact-phone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={settings.contact_phone}
                placeholder={t("wordpress.reAccessibility.optional", "Optional")}
                onChange={(e) => set("contact_phone", e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="re-accessibility-statement-date">
                {t("wordpress.reAccessibility.statementDate", "Last checked on")}
              </Label>
              <Input
                id="re-accessibility-statement-date"
                type="date"
                value={settings.statement_date}
                onChange={(e) => set("statement_date", e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="re-accessibility-statement-url">
                {t("wordpress.reAccessibility.statementUrl", "Your own statement page")}
              </Label>
              <Input
                id="re-accessibility-statement-url"
                type="url"
                inputMode="url"
                autoComplete="off"
                value={settings.statement_url}
                placeholder="https://"
                onChange={(e) => set("statement_url", e.target.value)}
              />
            </Field>
          </div>
          <FieldHint>
            {t(
              "wordpress.reAccessibility.statementUrlHint",
              "Leave the page address empty to use the statement we created on your website.",
            )}
          </FieldHint>
        </CardBody>
      </SectionCard>
    </div>
  );
}
