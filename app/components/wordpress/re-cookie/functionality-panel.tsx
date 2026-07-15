import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  ChevronDown,
  Code2,
  Facebook,
  Layers,
  Megaphone,
  Play,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  Wrench,
} from "lucide-react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import type {
  ReCookieCategorySlug,
  ReCookieNamedScript,
  ReCookieScriptCategory,
  ReCookieSettings,
} from "~/lib/wordpress/plugin-settings-types";
import {
  asScriptList,
  CATEGORY_LABELS,
  CATEGORY_SLUGS,
  NAMED_SCRIPT_CATS,
  NAMED_SCRIPT_LABELS,
  type PatchSettings,
} from "./constants";
import {
  CardBody,
  CardHeader,
  Field,
  FieldHint,
  NamedScriptsRepeater,
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

  function setIntegration(
    provider: "gtm" | "ga4" | "meta",
    field: string,
    val: unknown,
  ) {
    patch((prev) => ({
      ...prev,
      integrations: {
        ...prev.integrations,
        [provider]: { ...prev.integrations[provider], [field]: val },
      },
    }));
  }

  function setNamedScripts(
    cat: ReCookieScriptCategory,
    items: ReCookieNamedScript[],
  ) {
    patch((prev) => ({
      ...prev,
      integrations: {
        ...prev.integrations,
        named_scripts: { ...prev.integrations.named_scripts, [cat]: items },
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

      <SectionCard>
        <CardHeader
          icon={<Tag className="size-4" />}
          title={t("wordpress.reCookie.integrationsTitle", "Integrations")}
          subtitle={t(
            "wordpress.reCookie.integrationsDesc",
            "Set up tracking scripts and integrations (GTM, GA4, Meta Pixel, etc.).",
          )}
        />
        <CardBody className="space-y-3">
          <IntegrationCard
            icon={<Tag className="size-4" />}
            name={t("wordpress.reCookie.gtmEnabled", "Google Tag Manager")}
            enabled={settings.integrations.gtm.enabled}
            onEnabledChange={(v) => setIntegration("gtm", "enabled", v)}
            switchId="re-cookie-gtm-enabled"
          >
            <Field>
              <Label htmlFor="re-cookie-gtm-container-id">
                {t("wordpress.reCookie.gtmContainerId", "GTM container ID")}
              </Label>
              <Input
                id="re-cookie-gtm-container-id"
                type="text"
                className="max-w-xs bg-card font-mono"
                value={settings.integrations.gtm.container_id}
                placeholder="GTM-XXXXXXX"
                onChange={(e) =>
                  setIntegration("gtm", "container_id", e.target.value)
                }
              />
            </Field>
          </IntegrationCard>

          <IntegrationCard
            icon={<BarChart3 className="size-4" />}
            name={t("wordpress.reCookie.ga4Enabled", "Google Analytics 4")}
            enabled={settings.integrations.ga4.enabled}
            onEnabledChange={(v) => setIntegration("ga4", "enabled", v)}
            switchId="re-cookie-ga4-enabled"
          >
            <Field>
              <Label htmlFor="re-cookie-ga4-measurement-id">
                {t("wordpress.reCookie.ga4MeasurementId", "GA4 measurement ID")}
              </Label>
              <Input
                id="re-cookie-ga4-measurement-id"
                type="text"
                className="max-w-xs bg-card font-mono"
                value={settings.integrations.ga4.measurement_id}
                placeholder="G-XXXXXXXXXX"
                onChange={(e) =>
                  setIntegration("ga4", "measurement_id", e.target.value)
                }
              />
            </Field>
            <Field>
              <Label htmlFor="re-cookie-ga4-load-via">
                {t("wordpress.reCookie.ga4LoadVia", "GA4 load method")}
              </Label>
              <Segmented
                value={settings.integrations.ga4.load_via}
                onChange={(v) => setIntegration("ga4", "load_via", v)}
                ariaLabel={t("wordpress.reCookie.ga4LoadVia", "GA4 load method")}
                className="bg-card"
                options={[
                  {
                    value: "gtag",
                    label: t("wordpress.reCookie.directGtag", "Direct gtag"),
                  },
                  {
                    value: "gtm",
                    label: t("wordpress.reCookie.viaGtm", "Via GTM"),
                  },
                ]}
              />
            </Field>
          </IntegrationCard>

          <IntegrationCard
            icon={<Facebook className="size-4" />}
            name={t("wordpress.reCookie.metaEnabled", "Meta Pixel")}
            enabled={settings.integrations.meta.enabled}
            onEnabledChange={(v) => setIntegration("meta", "enabled", v)}
            switchId="re-cookie-meta-enabled"
          >
            <Field>
              <Label htmlFor="re-cookie-meta-pixel-id">
                {t("wordpress.reCookie.metaPixelId", "Meta Pixel ID")}
              </Label>
              <Input
                id="re-cookie-meta-pixel-id"
                type="text"
                className="max-w-xs bg-card font-mono"
                value={settings.integrations.meta.pixel_id}
                placeholder="Pixel ID"
                onChange={(e) =>
                  setIntegration("meta", "pixel_id", e.target.value)
                }
              />
            </Field>
          </IntegrationCard>
        </CardBody>
      </SectionCard>

      <SectionCard>
        <CardHeader
          icon={<Code2 className="size-4" />}
          title={t("wordpress.reCookie.namedScriptsTitle", "Consent-gated scripts")}
          subtitle={t(
            "wordpress.reCookie.namedScriptsDesc",
            "Scripts injected only once the visitor consents to the matching category.",
          )}
        />
        <CardBody className="space-y-3">
          {NAMED_SCRIPT_CATS.map((cat) => {
            const items = asScriptList(settings.integrations.named_scripts[cat]);
            const Icon = CATEGORY_ICONS[cat];
            return (
              <ExpandableRow
                key={cat}
                icon={<Icon className="size-4" />}
                title={t(
                  `wordpress.reCookie.namedScripts.${cat}`,
                  NAMED_SCRIPT_LABELS[cat],
                )}
                meta={
                  items.length === 0
                    ? t("wordpress.reCookie.noScripts", "No scripts")
                    : t("wordpress.reCookie.scriptCount", {
                        count: items.length,
                        defaultValue: "{{count}} script(s)",
                      })
                }
                defaultOpen={items.length > 0}
              >
                <NamedScriptsRepeater
                  items={items}
                  onChange={(next) => setNamedScripts(cat, next)}
                />
              </ExpandableRow>
            );
          })}
        </CardBody>
      </SectionCard>

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

/** An integration: enable switch on the row, credentials underneath. */
function IntegrationCard({
  icon,
  name,
  enabled,
  onEnabledChange,
  switchId,
  children,
}: {
  icon: React.ReactNode;
  name: string;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  switchId: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border transition-colors",
        enabled ? "border-primary/30 bg-primary/[0.03]" : "bg-muted/20",
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span
          aria-hidden
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            enabled
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          {icon}
        </span>
        <Label htmlFor={switchId} className="flex-1 font-medium">
          {name}
        </Label>
        <Switch
          id={switchId}
          checked={enabled}
          onCheckedChange={onEnabledChange}
        />
      </div>
      <div className="space-y-4 border-t px-4 py-4">{children}</div>
    </div>
  );
}

/** Disclosure row: summary line always visible, editor revealed on demand. */
function ExpandableRow({
  icon,
  title,
  meta,
  control,
  children,
  dimmed,
  defaultOpen = false,
}: {
  icon: React.ReactNode;
  title: string;
  meta?: string;
  control?: React.ReactNode;
  children: React.ReactNode;
  dimmed?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border transition-colors",
        dimmed ? "bg-muted/20" : "bg-card",
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            aria-hidden
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
              dimmed
                ? "bg-muted text-muted-foreground"
                : "bg-primary/10 text-primary",
            )}
          >
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{title}</span>
            {meta ? (
              <span className="block truncate text-xs text-muted-foreground">
                {meta}
              </span>
            ) : null}
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        {control ? <div className="shrink-0 pl-1">{control}</div> : null}
      </div>
      {open ? (
        <div className="border-t bg-muted/20 px-4 py-4">{children}</div>
      ) : null}
    </div>
  );
}
