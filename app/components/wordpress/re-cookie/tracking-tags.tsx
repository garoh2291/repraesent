import { useTranslation } from "react-i18next";
import {
  BarChart3,
  Facebook,
  Megaphone,
  Tag,
  Target,
  Wrench,
} from "lucide-react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { cn } from "~/lib/utils";
import type {
  ReCookieConsentMode,
  ReCookieNamedScript,
  ReCookieScriptCategory,
  ReCookieSettings,
} from "~/lib/wordpress/plugin-settings-types";
import {
  asScriptList,
  NAMED_SCRIPT_CATS,
  NAMED_SCRIPT_LABELS,
  type PatchSettings,
} from "./constants";
import {
  ID_INPUT,
  PROVIDER_LABEL,
  validateTrackingId,
  type TrackingIdProblem,
  type TrackingIdProvider,
} from "./tracking-ids";
import {
  ExpandableRow,
  Field,
  FieldHint,
  NamedScriptsRepeater,
  Segmented,
} from "./fields";

/**
 * The tags re:cookie adds to the website — Google's and Meta's integrations and
 * the customer's own scripts. Edited under Website settings; the cookie banner
 * screen only lists them. Both read the same `re_cookie_settings` row, so a tag
 * added here is the tag the banner names.
 */

const SCRIPT_CATEGORY_ICONS: Record<ReCookieScriptCategory, React.ElementType> = {
  functional: Wrench,
  analytics: BarChart3,
  marketing: Megaphone,
};

type IntegrationProvider = "gtm" | "google_ads" | "ga4" | "meta";

function useIntegrationSetter(patch: PatchSettings) {
  return (provider: IntegrationProvider, field: string, val: unknown) =>
    patch((prev) => ({
      ...prev,
      integrations: {
        ...prev.integrations,
        [provider]: { ...prev.integrations[provider], [field]: val },
      },
    }));
}

/** GTM, Google Ads, GA4 and Meta Pixel: a switch each, the ID underneath. */
export function TrackingIntegrations({
  settings,
  patch,
}: {
  settings: ReCookieSettings;
  patch: PatchSettings;
}) {
  const { t } = useTranslation();
  const setIntegration = useIntegrationSetter(patch);

  return (
    <div className="space-y-3">
      <IntegrationCard
        icon={<Tag className="size-4" />}
        name={t("wordpress.reCookie.gtmEnabled", "Google Tag Manager")}
        enabled={settings.integrations.gtm.enabled}
        onEnabledChange={(v) => setIntegration("gtm", "enabled", v)}
        switchId="re-cookie-gtm-enabled"
      >
        <Field>
          <Label htmlFor={ID_INPUT.gtm}>
            {t("wordpress.reCookie.gtmContainerId", "GTM container ID")}
          </Label>
          <Input
            id={ID_INPUT.gtm}
            type="text"
            className="max-w-xs bg-card font-mono"
            value={settings.integrations.gtm.container_id}
            placeholder="GTM-XXXXXXX"
            onChange={(e) =>
              setIntegration("gtm", "container_id", e.target.value)
            }
          />
          <FieldHint>
            {t(
              "wordpress.reCookie.gtmContainerIdHint",
              "GTM-XXXXXXX only. Do not put AW- or G- IDs here.",
            )}
          </FieldHint>
          <TrackingIdNotice
            provider="gtm"
            value={settings.integrations.gtm.container_id}
            enabled={settings.integrations.gtm.enabled}
          />
        </Field>
      </IntegrationCard>

      <IntegrationCard
        icon={<Target className="size-4" />}
        name={t("wordpress.reCookie.googleAdsEnabled", "Google Ads")}
        enabled={settings.integrations.google_ads.enabled}
        onEnabledChange={(v) => setIntegration("google_ads", "enabled", v)}
        switchId="re-cookie-google-ads-enabled"
      >
        <Field>
          <Label htmlFor={ID_INPUT.google_ads}>
            {t(
              "wordpress.reCookie.googleAdsConversionId",
              "Google Ads conversion ID",
            )}
          </Label>
          <Input
            id={ID_INPUT.google_ads}
            type="text"
            className="max-w-xs bg-card font-mono"
            value={settings.integrations.google_ads.conversion_id}
            placeholder="AW-1234567890"
            onChange={(e) =>
              setIntegration("google_ads", "conversion_id", e.target.value)
            }
          />
          <FieldHint>
            {t(
              "wordpress.websiteSettings.googleAdsHint",
              "Don't paste the same AW- snippet again under Your own scripts.",
            )}
          </FieldHint>
          <TrackingIdNotice
            provider="google_ads"
            value={settings.integrations.google_ads.conversion_id}
            enabled={settings.integrations.google_ads.enabled}
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
          <Label htmlFor={ID_INPUT.ga4}>
            {t("wordpress.reCookie.ga4MeasurementId", "GA4 measurement ID")}
          </Label>
          <Input
            id={ID_INPUT.ga4}
            type="text"
            className="max-w-xs bg-card font-mono"
            value={settings.integrations.ga4.measurement_id}
            placeholder="G-XXXXXXXXXX"
            onChange={(e) =>
              setIntegration("ga4", "measurement_id", e.target.value)
            }
          />
          <TrackingIdNotice
            provider="ga4"
            value={settings.integrations.ga4.measurement_id}
            enabled={settings.integrations.ga4.enabled}
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
          <Label htmlFor={ID_INPUT.meta}>
            {t("wordpress.reCookie.metaPixelId", "Meta Pixel ID")}
          </Label>
          <Input
            id={ID_INPUT.meta}
            type="text"
            className="max-w-xs bg-card font-mono"
            value={settings.integrations.meta.pixel_id}
            placeholder="Pixel ID"
            onChange={(e) => setIntegration("meta", "pixel_id", e.target.value)}
          />
          <TrackingIdNotice
            provider="meta"
            value={settings.integrations.meta.pixel_id}
            enabled={settings.integrations.meta.enabled}
          />
        </Field>
      </IntegrationCard>
    </div>
  );
}

/**
 * The customer's own scripts (Plausible, Hotjar, a chat widget…), filed under
 * the banner group they belong to. With the banner on, each one can be marked
 * to load without asking.
 */
export function OwnScripts({
  settings,
  patch,
  consentMode,
}: {
  settings: ReCookieSettings;
  patch: PatchSettings;
  consentMode: ReCookieConsentMode;
}) {
  const { t } = useTranslation();

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
    <div className="space-y-3">
      {NAMED_SCRIPT_CATS.map((cat) => {
        const items = asScriptList(settings.integrations.named_scripts[cat]);
        const Icon = SCRIPT_CATEGORY_ICONS[cat];
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
              showAlwaysOn={consentMode !== "off"}
            />
          </ExpandableRow>
        );
      })}
    </div>
  );
}

/** Every tag that is switched on, by the name the cookie banner shows. */
export function activeTagNames(settings: ReCookieSettings): string[] {
  const { integrations } = settings;
  const names: string[] = [];
  if (integrations.gtm.enabled && integrations.gtm.container_id.trim())
    names.push(PROVIDER_LABEL.gtm);
  if (
    integrations.google_ads.enabled &&
    integrations.google_ads.conversion_id.trim()
  )
    names.push(PROVIDER_LABEL.google_ads);
  if (integrations.ga4.enabled && integrations.ga4.measurement_id.trim())
    names.push(PROVIDER_LABEL.ga4);
  if (integrations.meta.enabled && integrations.meta.pixel_id.trim())
    names.push(PROVIDER_LABEL.meta);
  for (const cat of NAMED_SCRIPT_CATS) {
    for (const item of asScriptList(integrations.named_scripts[cat])) {
      const name = item.name.trim();
      if (name && item.script.trim() && !names.includes(name)) names.push(name);
    }
  }
  return names;
}

const ID_PROBLEM_TEXT: Record<TrackingIdProblem, string> = {
  ads_label:
    "Enter only the AW-1234567890 part — drop the /conversion-label suffix.",
  ads: "Must look like AW-1234567890.",
  gtm: "Must look like GTM-XXXXXXX. AW- and G- IDs belong in their own fields.",
  ga4: "Must look like G-XXXXXXXXXX.",
};

/**
 * Why this tracking ID will not do what it looks like it does: either the shape
 * is one WordPress will reject on save, or an ID is filled in while the
 * integration is switched off — in which case the tag never loads and nothing
 * anywhere says so.
 */
function TrackingIdNotice({
  provider,
  value,
  enabled,
}: {
  provider: TrackingIdProvider;
  value: string;
  enabled: boolean;
}) {
  const { t } = useTranslation();
  const problem = validateTrackingId(provider, value);
  if (problem) {
    return (
      <p className="text-xs leading-relaxed text-destructive">
        {t(`wordpress.reCookie.idProblem.${problem}`, ID_PROBLEM_TEXT[problem])}
      </p>
    );
  }
  if (value.trim() !== "" && !enabled) {
    return (
      <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
        {t(
          "wordpress.reCookie.idSwitchedOff",
          "{{name}} is switched off, so this ID will not load on the site. Turn it on above to activate the tag.",
          { name: PROVIDER_LABEL[provider] },
        )}
      </p>
    );
  }
  return null;
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
