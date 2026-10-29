import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  BarChart3,
  Layers,
  Megaphone,
  Play,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  Wrench,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import type {
  ReCookieCategorySlug,
  ReCookieSettings,
} from "~/lib/wordpress/plugin-settings-types";
import { WEBSITE_SETTINGS_PATH } from "~/lib/utils/wordpress-plugin-kind";
import {
  CATEGORY_LABELS,
  CATEGORY_SLUGS,
  type PatchSettings,
} from "./constants";
import { activeTagNames } from "./tracking-tags";
import {
  CardBody,
  CardHeader,
  ExpandableRow,
  Field,
  FieldHint,
  SectionCard,
  Segmented,
  SwitchRow,
} from "./fields";

const CATEGORY_ICONS: Record<ReCookieCategorySlug, React.ElementType> = {
  functional: Wrench,
  analytics: BarChart3,
  marketing: Megaphone,
  external_media: Play,
};

export function FunctionalityPanel({
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

  function setCat(
    slug: ReCookieCategorySlug,
    field: "enabled" | "title" | "description",
    val: boolean | string,
  ) {
    patch((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [slug]: { ...prev.categories[slug], [field]: val },
      },
    }));
  }

  return (
    <div className="space-y-4">
      <SectionCard>
        <CardHeader
          icon={<Layers className="size-4" />}
          title={t("wordpress.reCookie.categoriesTitle", "Cookie Categories")}
          subtitle={t(
            "wordpress.reCookie.categoriesDesc",
            "Configure cookie categories that users can enable or disable.",
          )}
        />
        <CardBody className="space-y-2.5">
          {CATEGORY_SLUGS.map((slug) => (
            <CategoryRow
              key={slug}
              slug={slug}
              value={settings.categories[slug]}
              onChange={(field, val) => setCat(slug, field, val)}
            />
          ))}
        </CardBody>
      </SectionCard>

      <SectionCard>
        <CardHeader
          icon={<SlidersHorizontal className="size-4" />}
          title={t("wordpress.reCookie.behaviorTitle", "Behavior Settings")}
          subtitle={t(
            "wordpress.reCookie.behaviorDesc",
            "Control how the banner behaves and when it appears.",
          )}
        />
        <CardBody>
          <Field>
            <Label htmlFor="re-cookie-manage-placement">
              {t(
                "wordpress.reCookie.managePlacement",
                "Manage button placement",
              )}
            </Label>
            <Segmented
              value={settings.manage_placement}
              onChange={(v) => set("manage_placement", v)}
              ariaLabel={t(
                "wordpress.reCookie.managePlacement",
                "Manage button placement",
              )}
              options={[
                {
                  value: "bottom-left",
                  label: t("wordpress.reCookie.bottomLeft", "Bottom left"),
                },
                {
                  value: "bottom-right",
                  label: t("wordpress.reCookie.bottomRight", "Bottom right"),
                },
              ]}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <Label htmlFor="re-cookie-banner-delay">
                {t(
                  "wordpress.reCookie.bannerDelay",
                  "Delay showing banner (ms)",
                )}
              </Label>
              <Input
                id="re-cookie-banner-delay"
                type="number"
                className="tabular-nums"
                value={settings.banner_delay_ms}
                min={0}
                onChange={(e) => set("banner_delay_ms", Number(e.target.value))}
              />
            </Field>

            <Field>
              <Label htmlFor="re-cookie-config-version">
                {t("wordpress.reCookie.configVersionShort", "Config version")}
              </Label>
              <Input
                id="re-cookie-config-version"
                type="number"
                className="tabular-nums"
                value={settings.config_version}
                min={1}
                onChange={(e) => set("config_version", Number(e.target.value))}
              />
              <FieldHint>
                {t(
                  "wordpress.reCookie.configVersionHint",
                  "Bump to re-prompt every visitor for consent.",
                )}
              </FieldHint>
            </Field>
          </div>

          <Field>
            <Label htmlFor="re-cookie-privacy-policy-url">
              {t("wordpress.reCookie.privacyPolicyUrl", "Privacy Policy")}
            </Label>
            <Input
              id="re-cookie-privacy-policy-url"
              type="url"
              value={settings.privacy_policy_url}
              placeholder="https://example.com/privacy-policy"
              onChange={(e) => set("privacy_policy_url", e.target.value)}
            />
            <FieldHint>
              {t(
                "wordpress.reCookie.privacyPolicyUrlHint",
                "Leave empty to hide the privacy policy link from the banner.",
              )}
            </FieldHint>
          </Field>
        </CardBody>
      </SectionCard>

      <TagsOnWebsiteCard settings={settings} />

      <SectionCard>
        <CardHeader
          icon={<ShieldCheck className="size-4" />}
          title={t("wordpress.reCookie.complianceTitle", "Blocking & compliance")}
          subtitle={t(
            "wordpress.reCookie.complianceDesc",
            "Keep third-party scripts from running before consent, and keep a record of what was chosen.",
          )}
        />
        <CardBody className="space-y-2.5">
          <SwitchRow
            id="re-cookie-output-buffer-blocker"
            checked={settings.output_buffer_blocker}
            onChange={(v) => set("output_buffer_blocker", v)}
            label={t(
              "wordpress.reCookie.outputBufferBlocker",
              "Output buffer script blocker",
            )}
            description={t(
              "wordpress.reCookie.scriptBlockerDesc",
              "Block scripts from loading before user consent.",
            )}
          />
          <SwitchRow
            id="re-cookie-consent-logging"
            checked={settings.consent_logging}
            onChange={(v) => set("consent_logging", v)}
            label={t("wordpress.reCookie.consentLogging", "Consent logging")}
            description={t(
              "wordpress.reCookie.loggingDesc",
              "Log user consent choices to the database for compliance tracking.",
            )}
          />
        </CardBody>
      </SectionCard>
    </div>
  );
}

/**
 * A category: switch on the header row, copy fields behind a disclosure. The
 * titles and descriptions here are the plugin's non-translated fallbacks — the
 * per-language copy lives on the Content tab.
 */
function CategoryRow({
  slug,
  value,
  onChange,
}: {
  slug: ReCookieCategorySlug;
  value: { enabled: boolean; title: string; description: string };
  onChange: (
    field: "enabled" | "title" | "description",
    val: boolean | string,
  ) => void;
}) {
  const { t } = useTranslation();
  const Icon = CATEGORY_ICONS[slug];

  const categoryLabel = t(
    `wordpress.reCookie.categories.${slug}`,
    CATEGORY_LABELS[slug],
  );

  return (
    <ExpandableRow
      icon={<Icon className="size-4" />}
      title={categoryLabel}
      meta={
        value.enabled
          ? t("wordpress.reCookie.categoryOn", "Shown to visitors")
          : t("wordpress.reCookie.categoryOff", "Hidden")
      }
      dimmed={!value.enabled}
      control={
        <Switch
          id={`re-cookie-cat-${slug}-enabled`}
          checked={value.enabled}
          onCheckedChange={(v) => onChange("enabled", v)}
          aria-label={t("wordpress.reCookie.enableCategory", "Enable {{category}}", {
            category: categoryLabel,
          })}
        />
      }
    >
      <div className="space-y-4">
        <Field>
          <Label htmlFor={`re-cookie-cat-${slug}-title`}>
            {t("wordpress.reCookie.fallbackTitle", "Fallback title")}
          </Label>
          <Input
            id={`re-cookie-cat-${slug}-title`}
            type="text"
            className="bg-card"
            value={value.title}
            onChange={(e) => onChange("title", e.target.value)}
          />
        </Field>
        <Field>
          <Label htmlFor={`re-cookie-cat-${slug}-description`}>
            {t("wordpress.reCookie.fallbackDescription", "Fallback description")}
          </Label>
          <Textarea
            id={`re-cookie-cat-${slug}-description`}
            rows={2}
            className="bg-card"
            value={value.description}
            onChange={(e) => onChange("description", e.target.value)}
          />
        </Field>
        <FieldHint>
          {t(
            "wordpress.reCookie.fallbackHint",
            "Used when no translation is available for the visitor's language. Translated copy lives on the Content tab.",
          )}
        </FieldHint>
      </div>
    </ExpandableRow>
  );
}

/**
 * The tags themselves are edited under Website settings — the same settings row,
 * so this list is always what the banner names. Here they are only listed, and
 * the card says so when the banner is switched off there.
 */
function TagsOnWebsiteCard({ settings }: { settings: ReCookieSettings }) {
  const { t } = useTranslation();
  const names = activeTagNames(settings);
  const bannerOff = settings.consent_mode === "off";
  const europeOnly = settings.consent_mode === "region";

  return (
    <SectionCard>
      <CardHeader
        icon={<Tag className="size-4" />}
        title={t("wordpress.reCookie.tagsOnSiteTitle", "Tags on your website")}
        subtitle={t(
          "wordpress.reCookie.tagsOnSiteDesc",
          "The banner lists these under their group. Add or change them in Website settings.",
        )}
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={WEBSITE_SETTINGS_PATH}>
              {t("wordpress.reCookie.editTags", "Edit tags")}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        }
      />
      <CardBody className="space-y-3">
        {bannerOff ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
            {t(
              "wordpress.reCookie.bannerOffNotice",
              "The banner is switched off in Website settings, so visitors don't see it and every tag loads straight away.",
            )}
          </p>
        ) : europeOnly ? (
          <p className="rounded-xl border px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
            {t(
              "wordpress.reCookie.bannerRegionNotice",
              "Website settings shows the banner only to visitors in Europe. Everyone else gets every tag straight away.",
            )}
          </p>
        ) : null}
        {names.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t(
              "wordpress.reCookie.noTags",
              "No tags yet. Add Google Analytics, Meta Pixel or your own scripts in Website settings.",
            )}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {names.map((name) => (
              <li
                key={name}
                className="rounded-lg border bg-muted/30 px-2.5 py-1 text-xs font-medium"
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </SectionCard>
  );
}
