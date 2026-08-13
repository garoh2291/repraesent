import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Film,
  Globe,
  Layers,
  LayoutTemplate,
  MessageSquareText,
  MousePointerClick,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { extractErrorMessage } from "~/lib/api/axios-instance";
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
  FieldHint,
  InfoNote,
  SectionCard,
  Segmented,
} from "./fields";
import { PluginLangBar } from "~/components/wordpress/plugin-lang-bar";
import { usePluginTranslateLanguages } from "~/lib/hooks/usePluginTranslateLanguages";
import { usePluginOverlayPack } from "~/lib/hooks/usePluginOverlayPack";
import {
  cookieTreeFromOverlay,
  cookieTreeToSavePayload,
  emptyCookieTree,
  type OverlayStringMap,
} from "~/lib/wordpress/plugin-i18n";

const LEGACY_LANGS = ["en", "de"] as const;

export type CookieOverlaySaveHandle = {
  /** Unsaved translation edits are pending in one or more target languages. */
  dirty: boolean;
  /** Persist every dirty language overlay in one request (no-op when clean). */
  save: () => Promise<void>;
  /**
   * Copy on screen right now, so the preview follows the language being
   * edited. `null` while editing the source, whose copy is in `settings`.
   */
  copy: ReCookieTranslationLang | null;
};

/**
 * One target language being edited. Drafts are kept per language for the life
 * of the panel, so switching back and forth neither refetches nor throws away
 * what was typed — the Save button persists every dirty language at once.
 */
type LangDraft = {
  /** Server rows (ids + source text) the save payload is built from. */
  map: OverlayStringMap;
  tree: ReCookieTranslationLang;
  dirty: boolean;
};

export function ContentPanel({
  settings,
  activeLang,
  onActiveLangChange,
  patch,
  onOverlayHandle,
}: {
  settings: ReCookieSettings;
  activeLang: ReCookieLang;
  onActiveLangChange: (lang: ReCookieLang) => void;
  patch: PatchSettings;
  /** Lets the parent save overlays together with settings. */
  onOverlayHandle?: (handle: CookieOverlaySaveHandle) => void;
}) {
  const { t } = useTranslation();
  const i18n = usePluginTranslateLanguages();
  const overlays = usePluginOverlayPack(i18n.translatePluginUuid);

  const multilingual = i18n.enabled;
  const isSource = !multilingual || activeLang === i18n.source;

  const [drafts, setDrafts] = useState<Record<string, LangDraft>>({});
  const [loadingLang, setLoadingLang] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const inFlight = useRef<Set<string>>(new Set());

  const sourceTree = useMemo(
    () =>
      settings.translations[i18n.source] ??
      settings.translations[settings.default_language] ??
      emptyCookieTree(),
    [settings.translations, i18n.source, settings.default_language],
  );
  // Hydrating an overlay falls back to the source copy; read it without making
  // every keystroke on the source language retrigger the load effect.
  const sourceTreeRef = useRef(sourceTree);
  useEffect(() => {
    sourceTreeRef.current = sourceTree;
  }, [sourceTree]);

  // re:translate resolves a beat after the settings do, and until it does the
  // active language is whatever `default_language` happens to be. Until the
  // user picks one themselves, stay pinned to the source language.
  const userPickedLang = useRef(false);
  useEffect(() => {
    if (!multilingual || !i18n.source) return;
    const codes = new Set(i18n.languages.map((l) => l.code));
    if (activeLang === i18n.source) return;
    if (!userPickedLang.current || !codes.has(activeLang)) {
      onActiveLangChange(i18n.source);
    }
  }, [multilingual, i18n.source, i18n.languages, activeLang, onActiveLangChange]);

  const pickLang = (code: string) => {
    userPickedLang.current = true;
    onActiveLangChange(code);
  };

  const loadOverlay = overlays.load;
  const saveOverlayPack = overlays.save;

  // Fetch a target language once; every later visit is served from `drafts`.
  useEffect(() => {
    if (!multilingual || isSource || !activeLang) return;
    if (drafts[activeLang] || inFlight.current.has(activeLang)) return;

    const lang = activeLang;
    inFlight.current.add(lang);
    setLoadingLang(lang);
    setLoadError(null);

    void (async () => {
      try {
        const map = await loadOverlay("cookie", 0, lang);
        setDrafts((prev) =>
          prev[lang]
            ? prev
            : {
                ...prev,
                [lang]: {
                  map,
                  tree: cookieTreeFromOverlay(map, sourceTreeRef.current),
                  dirty: false,
                },
              },
        );
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        inFlight.current.delete(lang);
        setLoadingLang((cur) => (cur === lang ? null : cur));
      }
    })();
  }, [multilingual, isSource, activeLang, drafts, loadOverlay, retryToken]);

  const dirtyLangs = useMemo(
    () => Object.keys(drafts).filter((lang) => drafts[lang]?.dirty),
    [drafts],
  );

  const saveOverlays = useCallback(async () => {
    const payload = dirtyLangs.flatMap((lang) => {
      const draft = drafts[lang];
      return draft ? cookieTreeToSavePayload(draft.tree, draft.map) : [];
    });
    if (payload.length === 0) return;
    await saveOverlayPack(payload);
    setDrafts((prev) => {
      const next: Record<string, LangDraft> = {};
      for (const [lang, draft] of Object.entries(prev)) {
        next[lang] = draft.dirty ? { ...draft, dirty: false } : draft;
      }
      return next;
    });
  }, [dirtyLangs, drafts, saveOverlayPack]);

  const targetDraft = multilingual && !isSource ? drafts[activeLang] : undefined;
  // While a language loads, the source copy stands in so the form keeps its
  // shape instead of collapsing to a "Loading…" line.
  const displayTree: ReCookieTranslationLang =
    multilingual && !isSource
      ? (targetDraft?.tree ?? sourceTree)
      : (settings.translations[activeLang] ??
        settings.translations[settings.default_language] ??
        emptyCookieTree());

  const busy = multilingual && !isSource && !targetDraft;

  const onOverlayHandleRef = useRef(onOverlayHandle);
  onOverlayHandleRef.current = onOverlayHandle;

  useEffect(() => {
    onOverlayHandleRef.current?.({
      dirty: dirtyLangs.length > 0,
      save: saveOverlays,
      copy: isSource ? null : displayTree,
    });
  }, [dirtyLangs, saveOverlays, isSource, displayTree]);

  const langLabel = (lang: string) => {
    if (lang === "en") return t("wordpress.reCookie.english", "English");
    if (lang === "de") return t("wordpress.reCookie.german", "German");
    return lang.toUpperCase();
  };

  const activeLangLabel =
    i18n.languages.find((l) => l.code === activeLang)?.label ??
    langLabel(activeLang);

  function updateDraft(
    lang: string,
    updater: (tree: ReCookieTranslationLang) => ReCookieTranslationLang,
  ) {
    setDrafts((prev) => {
      const draft = prev[lang];
      if (!draft) return prev;
      return { ...prev, [lang]: { ...draft, tree: updater(draft.tree), dirty: true } };
    });
  }

  function setTranslation(
    lang: string,
    group: keyof ReCookieTranslationLang,
    field: string,
    val: string,
  ) {
    if (multilingual && !isSource) {
      updateDraft(lang, (tree) => {
        const groupData = tree[group] as Record<string, unknown>;
        return { ...tree, [group]: { ...groupData, [field]: val } };
      });
      return;
    }
    patch((prev) => {
      const langData = prev.translations[lang] ?? emptyCookieTree();
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
    lang: string,
    cat: ReCookieCategorySlug,
    field: "title" | "description",
    val: string,
  ) {
    if (multilingual && !isSource) {
      updateDraft(lang, (tree) => ({
        ...tree,
        categories: {
          ...tree.categories,
          [cat]: { ...tree.categories[cat], [field]: val },
        },
      }));
      return;
    }
    patch((prev) => {
      const langData = prev.translations[lang] ?? emptyCookieTree();
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
          title={t("wordpress.reCookie.languageTitle", "Language")}
          subtitle={
            multilingual
              ? t(
                  "wordpress.reCookie.defaultLanguageLocked",
                  "Used as the cookie copy source when re:translate is off. While re:translate is active, the banner follows the site language.",
                )
              : t(
                  "wordpress.reCookie.defaultLanguageHint",
                  "Default language for the cookie consent banner. Users can see content in their browser language if available.",
                )
          }
        />
        <CardBody>
          <Field>
            <Label>{t("wordpress.reCookie.defaultLanguage", "Default Language")}</Label>
            {i18n.loading ? (
              <div
                aria-hidden
                className="h-9 w-48 animate-pulse rounded-xl border bg-muted/40"
              />
            ) : (
              <Segmented
                value={settings.default_language}
                onChange={(lang) => {
                  patch((prev) => ({ ...prev, default_language: lang }));
                  if (!multilingual) onActiveLangChange(lang);
                }}
                ariaLabel={t(
                  "wordpress.reCookie.defaultLanguage",
                  "Default Language",
                )}
                options={(multilingual
                  ? i18n.languages.map((l) => l.code)
                  : [...LEGACY_LANGS]
                ).map((lang) => ({
                  value: lang,
                  label: multilingual
                    ? (i18n.languages.find((l) => l.code === lang)?.label ??
                      langLabel(lang))
                    : langLabel(lang),
                }))}
              />
            )}
          </Field>

          <Field>
            <div className="flex items-center gap-2">
              <Label>
                {t("wordpress.reCookie.editingLanguage", "Editing language")}
              </Label>
              {loadingLang === activeLang ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Spinner className="size-3" />
                  {t("wordpress.reCookie.loadingLanguage", "Loading language…")}
                </span>
              ) : null}
            </div>
            {i18n.loading ? (
              // re:translate answers after the settings do; a placeholder keeps
              // the row from flashing the legacy picker and then swapping.
              <div
                aria-hidden
                className="h-9 w-48 animate-pulse rounded-xl border bg-muted/40"
              />
            ) : multilingual ? (
              <PluginLangBar
                languages={i18n.languages}
                active={activeLang}
                source={i18n.source}
                dirtyLanguages={dirtyLangs}
                disabled={overlays.saving}
                ariaLabel={t(
                  "wordpress.reCookie.editingLanguage",
                  "Editing language",
                )}
                onChange={pickLang}
              />
            ) : (
              <Segmented
                value={activeLang}
                onChange={pickLang}
                ariaLabel={t(
                  "wordpress.reCookie.editingLanguage",
                  "Editing language",
                )}
                options={LEGACY_LANGS.map((lang) => ({
                  value: lang,
                  label: langLabel(lang),
                }))}
              />
            )}
            {multilingual ? (
              <FieldHint>
                {isSource
                  ? t(
                      "wordpress.reCookie.editingSource",
                      "Editing the source language — this copy is stored in the plugin settings.",
                    )
                  : t(
                      "wordpress.reCookie.editingTranslation",
                      "Editing {{lang}} — saved as a translation in re:translate.",
                      { lang: activeLangLabel },
                    )}
              </FieldHint>
            ) : null}
          </Field>

          {loadError ? (
            <InfoNote>
              <div className="flex flex-wrap items-center gap-2">
                <span>{loadError}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRetryToken((n) => n + 1)}
                >
                  {t("wordpress.reCookie.retry", "Retry")}
                </Button>
              </div>
            </InfoNote>
          ) : null}
        </CardBody>
      </SectionCard>

      <div
        aria-busy={busy}
        className={cn(
          "space-y-4 transition-opacity duration-200",
          busy && "opacity-60",
        )}
      >
        <TranslationCards
          lang={activeLang}
          data={displayTree}
          disabled={busy}
          onChange={(group, field, val) =>
            setTranslation(activeLang, group, field, val)
          }
          onCategoryChange={(cat, field, val) =>
            setTranslationCategory(activeLang, cat, field, val)
          }
        />
      </div>
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

/**
 * The banner copy, one card per surface — same card rhythm as the Design and
 * Functionality tabs, instead of a single card split by rules.
 */
function TranslationCards({
  lang,
  data,
  disabled,
  onChange,
  onCategoryChange,
}: {
  lang: string;
  data: ReCookieTranslationLang;
  disabled?: boolean;
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
      <SectionCard>
        <CardHeader
          icon={<MessageSquareText className="size-4" />}
          title={t("wordpress.reCookie.contentTitle", "Banner Content")}
          subtitle={t(
            "wordpress.reCookie.bannerSectionDesc",
            "The first thing visitors see, before any choice is made.",
          )}
        />
        <CardBody>
          <Field>
            <Label htmlFor={`re-cookie-${lang}-banner-title`}>
              {t("wordpress.reCookie.bannerTitle", "Banner Title")}
            </Label>
            <Input
              id={`re-cookie-${lang}-banner-title`}
              type="text"
              disabled={disabled}
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
              disabled={disabled}
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
              disabled={disabled}
              value={data.banner.privacyPolicy}
              onChange={(e) =>
                onChange("banner", "privacyPolicy", e.target.value)
              }
            />
          </Field>
        </CardBody>
      </SectionCard>

      <SectionCard>
        <CardHeader
          icon={<MousePointerClick className="size-4" />}
          title={t("wordpress.reCookie.buttonLabels", "Button Labels")}
          subtitle={t(
            "wordpress.reCookie.buttonLabelsDesc",
            "Wording on every consent action in the banner and the modal.",
          )}
        />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2">
            {BUTTON_KEYS.map((key) => (
              <Field key={key}>
                <Label htmlFor={`re-cookie-${lang}-btn-${key}`}>
                  {t(`wordpress.reCookie.buttons.${key}`)}
                </Label>
                <Input
                  id={`re-cookie-${lang}-btn-${key}`}
                  type="text"
                  disabled={disabled}
                  value={(data.buttons as Record<string, string>)[key] ?? ""}
                  onChange={(e) => onChange("buttons", key, e.target.value)}
                />
              </Field>
            ))}
          </div>
        </CardBody>
      </SectionCard>

      <SectionCard>
        <CardHeader
          icon={<LayoutTemplate className="size-4" />}
          title={t("wordpress.reCookie.modalContent", "Modal Content")}
          subtitle={t(
            "wordpress.reCookie.modalContentDesc",
            "Shown in the preferences modal, above the category list.",
          )}
        />
        <CardBody>
          <Field>
            <Label htmlFor={`re-cookie-${lang}-modal-title`}>
              {t("wordpress.reCookie.modalTitle", "Modal Title")}
            </Label>
            <Input
              id={`re-cookie-${lang}-modal-title`}
              type="text"
              disabled={disabled}
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
              disabled={disabled}
              value={data.modal.description}
              onChange={(e) => onChange("modal", "description", e.target.value)}
            />
          </Field>
        </CardBody>
      </SectionCard>

      <SectionCard>
        <CardHeader
          icon={<Layers className="size-4" />}
          title={t("wordpress.reCookie.categoriesTitle", "Cookie Categories")}
          subtitle={t(
            "wordpress.reCookie.categoriesContentDesc",
            "Names and explanations for each toggle in the preferences modal.",
          )}
        />
        <CardBody className="space-y-3">
          {CATEGORY_SLUGS.map((cat) => (
            <div key={cat} className="rounded-xl border bg-muted/20 p-4">
              <p className="mb-3 text-sm font-medium">
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
                    disabled={disabled}
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
                    disabled={disabled}
                    value={data.categories[cat].description}
                    onChange={(e) =>
                      onCategoryChange(cat, "description", e.target.value)
                    }
                  />
                </Field>
              </div>
            </div>
          ))}
        </CardBody>
      </SectionCard>

      <SectionCard>
        <CardHeader
          icon={<Film className="size-4" />}
          title={t("wordpress.reCookie.noticesTitle", "Vendor & media notices")}
          subtitle={t(
            "wordpress.reCookie.noticesDesc",
            "Copy shown next to individual services and in place of blocked embeds.",
          )}
        />
        <CardBody>
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
              disabled={disabled}
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
          <Field>
            <Label htmlFor={`re-cookie-${lang}-media-blocked-message`}>
              {t(
                "wordpress.reCookie.mediaBlockedMessage",
                "Media Blocked Message",
              )}
            </Label>
            <Input
              id={`re-cookie-${lang}-media-blocked-message`}
              type="text"
              disabled={disabled}
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
        </CardBody>
      </SectionCard>
    </>
  );
}
