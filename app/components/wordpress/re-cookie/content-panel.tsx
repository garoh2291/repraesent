import { useTranslation } from "react-i18next";
import { Globe, Languages } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import type {
  ReCookieCategorySlug,
  ReCookieLang,
  ReCookieSettings,
  ReCookieTranslationLang,
} from "~/lib/wordpress/plugin-settings-types";
import {
  CATEGORY_LABELS,
  CATEGORY_SLUGS,
  type PatchSettings,
} from "./constants";
import {
  CardBody,
  CardHeader,
  Field,
  FieldGroup,
  FieldHint,
  SectionCard,
  Segmented,
} from "./fields";

const LANGS = ["en", "de"] as const;

export function ContentPanel({
  settings,
  activeLang,
  onActiveLangChange,
  patch,
}: {
  settings: ReCookieSettings;
  activeLang: ReCookieLang;
  onActiveLangChange: (lang: ReCookieLang) => void;
  patch: PatchSettings;
}) {
  const { t } = useTranslation();

  const langLabel = (lang: ReCookieLang) =>
    lang === "en"
      ? t("wordpress.reCookie.english", "English")
      : t("wordpress.reCookie.german", "German");

  function set<K extends keyof ReCookieSettings>(
    key: K,
    val: ReCookieSettings[K],
  ) {
    patch((prev) => ({ ...prev, [key]: val }));
  }

  function setTranslation(
    lang: ReCookieLang,
    group: keyof ReCookieTranslationLang,
    field: string,
    val: string,
  ) {
    patch((prev) => {
      const langData = prev.translations[lang];
      const groupData = langData[group] as Record<string, unknown>;
      return {
        ...prev,
        translations: {
          ...prev.translations,
          [lang]: { ...langData, [group]: { ...groupData, [field]: val } },
        },
      };
    });
  }

  function setTranslationCategory(
    lang: ReCookieLang,
    cat: ReCookieCategorySlug,
    field: "title" | "description",
    val: string,
  ) {
    patch((prev) => {
      const langData = prev.translations[lang];
      return {
        ...prev,
        translations: {
          ...prev.translations,
          [lang]: {
            ...langData,
            categories: {
              ...langData.categories,
              [cat]: { ...langData.categories[cat], [field]: val },
            },
          },
        },
      };
    });
  }

  return (
    <div className="space-y-4">
      <SectionCard>
        <CardHeader
          icon={<Globe className="size-4" />}
          title={t("wordpress.reCookie.defaultLanguage", "Default Language")}
          subtitle={t(
            "wordpress.reCookie.defaultLanguageHint",
            "Default language for the cookie consent banner. Users can see content in their browser language if available.",
          )}
        />
        <CardBody>
          <Segmented
            value={settings.default_language}
            onChange={(lang) => {
              set("default_language", lang);
              onActiveLangChange(lang);
            }}
            ariaLabel={t("wordpress.reCookie.defaultLanguage", "Default Language")}
            options={LANGS.map((lang) => ({
              value: lang,
              label: langLabel(lang),
            }))}
          />
        </CardBody>
      </SectionCard>

      <SectionCard>
        <CardHeader
          icon={<Languages className="size-4" />}
          title={t("wordpress.reCookie.contentTitle", "Banner Content")}
          subtitle={t(
            "wordpress.reCookie.contentDesc",
            "Edit all text content displayed in the cookie consent banner and modal.",
          )}
          action={
            <Segmented
              value={activeLang}
              onChange={onActiveLangChange}
              ariaLabel={t(
                "wordpress.reCookie.editingLanguage",
                "Editing language",
              )}
              className="bg-card"
              options={LANGS.map((lang) => ({
                value: lang,
                label: langLabel(lang),
              }))}
            />
          }
        />
        <CardBody className="space-y-8">
          {/* Remounting per language keeps uncontrolled focus/scroll state from
              carrying across a language switch. */}
          <TranslationPanel
            key={activeLang}
            lang={activeLang}
            data={settings.translations[activeLang]}
            onChange={(group, field, val) =>
              setTranslation(activeLang, group, field, val)
            }
            onCategoryChange={(cat, field, val) =>
              setTranslationCategory(activeLang, cat, field, val)
            }
          />
        </CardBody>
      </SectionCard>
    </div>
  );
}

const BUTTON_KEYS = [
  "acceptAll",
  "rejectAll",
  "customize",
  "savePreferences",
  "deny",
  "manageCookies",
] as const;

function TranslationPanel({
  lang,
  data,
  onChange,
  onCategoryChange,
}: {
  lang: string;
  data: ReCookieTranslationLang;
  onChange: (
    group: keyof ReCookieTranslationLang,
    field: string,
    val: string,
  ) => void;
  onCategoryChange: (
    cat: ReCookieCategorySlug,
    field: "title" | "description",
    val: string,
  ) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <FieldGroup label={t("wordpress.reCookie.contentTitle", "Banner Content")}>
        <Field>
          <Label htmlFor={`re-cookie-${lang}-banner-title`}>
            {t("wordpress.reCookie.bannerTitle", "Banner Title")}
          </Label>
          <Input
            id={`re-cookie-${lang}-banner-title`}
            type="text"
            value={data.banner.title}
            onChange={(e) => onChange("banner", "title", e.target.value)}
          />
        </Field>
        <Field>
          <Label htmlFor={`re-cookie-${lang}-banner-description`}>
            {t("wordpress.reCookie.bannerDescription", "Banner Description")}
          </Label>
          <Textarea
            id={`re-cookie-${lang}-banner-description`}
            rows={3}
            value={data.banner.description}
            onChange={(e) => onChange("banner", "description", e.target.value)}
          />
        </Field>
        <Field>
          <Label htmlFor={`re-cookie-${lang}-privacy-policy-text`}>
            {t(
              "wordpress.reCookie.privacyPolicyText",
              "Privacy Policy Link Text",
            )}
          </Label>
          <Input
            id={`re-cookie-${lang}-privacy-policy-text`}
            type="text"
            value={data.banner.privacyPolicy}
            onChange={(e) =>
              onChange("banner", "privacyPolicy", e.target.value)
            }
          />
        </Field>
      </FieldGroup>

      <FieldGroup
        label={t("wordpress.reCookie.buttonLabels", "Button Labels")}
        className="border-t pt-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {BUTTON_KEYS.map((key) => (
            <Field key={key}>
              <Label htmlFor={`re-cookie-${lang}-btn-${key}`}>
                {t(`wordpress.reCookie.buttons.${key}`)}
              </Label>
              <Input
                id={`re-cookie-${lang}-btn-${key}`}
                type="text"
                value={(data.buttons as Record<string, string>)[key] ?? ""}
                onChange={(e) => onChange("buttons", key, e.target.value)}
              />
            </Field>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup
        label={t("wordpress.reCookie.modalContent", "Modal Content")}
        className="border-t pt-6"
      >
        <Field>
          <Label htmlFor={`re-cookie-${lang}-modal-title`}>
            {t("wordpress.reCookie.modalTitle", "Modal Title")}
          </Label>
          <Input
            id={`re-cookie-${lang}-modal-title`}
            type="text"
            value={data.modal.title}
            onChange={(e) => onChange("modal", "title", e.target.value)}
          />
        </Field>
        <Field>
          <Label htmlFor={`re-cookie-${lang}-modal-description`}>
            {t("wordpress.reCookie.modalDescription", "Modal Description")}
          </Label>
          <Textarea
            id={`re-cookie-${lang}-modal-description`}
            rows={2}
            value={data.modal.description}
            onChange={(e) => onChange("modal", "description", e.target.value)}
          />
        </Field>
      </FieldGroup>

      <FieldGroup
        label={t("wordpress.reCookie.categoriesTitle", "Cookie Categories")}
        className="border-t pt-6"
      >
        {CATEGORY_SLUGS.map((cat) => (
          <div key={cat} className="rounded-xl border bg-muted/20 p-4">
            <p className="mb-3 text-xs font-semibold tracking-tight">
              {t(`wordpress.reCookie.categories.${cat}`, CATEGORY_LABELS[cat])}
            </p>
            <div className="space-y-4">
              <Field>
                <Label htmlFor={`re-cookie-${lang}-cat-${cat}-title`}>
                  {t("wordpress.reCookie.title", "Title")}
                </Label>
                <Input
                  id={`re-cookie-${lang}-cat-${cat}-title`}
                  type="text"
                  className="bg-card"
                  value={data.categories[cat].title}
                  onChange={(e) =>
                    onCategoryChange(cat, "title", e.target.value)
                  }
                />
              </Field>
              <Field>
                <Label htmlFor={`re-cookie-${lang}-cat-${cat}-description`}>
                  {t("wordpress.reCookie.description", "Description")}
                </Label>
                <Textarea
                  id={`re-cookie-${lang}-cat-${cat}-description`}
                  rows={2}
                  className="bg-card"
                  value={data.categories[cat].description}
                  onChange={(e) =>
                    onCategoryChange(cat, "description", e.target.value)
                  }
                />
              </Field>
            </div>
          </div>
        ))}
      </FieldGroup>

      <FieldGroup
        label={t("wordpress.reCookie.vendorDescription", "Vendor Description")}
        className="border-t pt-6"
      >
        <Field>
          <Label htmlFor={`re-cookie-${lang}-vendor-template`}>
            {t(
              "wordpress.reCookie.vendorTemplate",
              "Vendor Description Template",
            )}
          </Label>
          <Input
            id={`re-cookie-${lang}-vendor-template`}
            type="text"
            value={data.vendor.description}
            onChange={(e) => onChange("vendor", "description", e.target.value)}
          />
          <FieldHint>
            {t(
              "wordpress.reCookie.vendorHint",
              "Use {category} as placeholder for category name.",
            )}
          </FieldHint>
        </Field>
      </FieldGroup>

      <FieldGroup
        label={t("wordpress.reCookie.mediaBlocker", "Media Blocker")}
        className="border-t pt-6"
      >
        <Field>
          <Label htmlFor={`re-cookie-${lang}-media-blocked-message`}>
            {t("wordpress.reCookie.mediaBlockedMessage", "Media Blocked Message")}
          </Label>
          <Input
            id={`re-cookie-${lang}-media-blocked-message`}
            type="text"
            value={data.mediaBlocker.message}
            onChange={(e) =>
              onChange("mediaBlocker", "message", e.target.value)
            }
          />
          <FieldHint>
            {t(
              "wordpress.reCookie.mediaBlockerHint",
              "Shown when embedded media (e.g. YouTube) is blocked until External Media cookies are enabled.",
            )}
          </FieldHint>
        </Field>
      </FieldGroup>
    </>
  );
}
