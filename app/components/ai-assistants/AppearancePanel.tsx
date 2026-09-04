import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import {
  ImageIcon,
  Languages,
  Palette,
  Plus,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { MediaPickerDialog } from "~/components/media/MediaPickerDialog";
import { AppearanceStylePanel } from "~/components/ai-assistants/AppearanceStylePanel";
import {
  FieldAnchor,
  useRevealListener,
} from "~/components/ai-assistants/FieldAnchor";
import {
  Cols,
  Panel,
  PanelBody,
  PanelHeader,
  PanelSection,
  Segmented,
  SegmentedButton,
} from "~/components/forms/chrome";
import {
  ColorInput,
  Field,
  FieldHint,
  ToggleField,
} from "~/components/wordpress/fields";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { WidgetPreview } from "~/components/ai-assistants/WidgetPreview";
import {
  AI_LOCALES,
  DEFAULT_STRINGS,
  WIDGET_STRING_KEYS,
  WIDGET_TYPES,
  withAppearanceDefaults,
  type AiLocale,
  type AppearanceConfig,
  type AssistantDraft,
  type WidgetStrings,
  type WidgetType,
} from "~/lib/api/ai-assistants";
import type { TranslateAssistantRequest } from "~/lib/api/assistant-translate";
import { useAssistantTranslate } from "~/lib/hooks/useAssistantTranslate";
import { cn } from "~/lib/utils";

interface Props {
  draft: AssistantDraft;
  canEdit: boolean;
  onChange: (patch: Partial<AssistantDraft>) => void;
}

const SWATCHES = [
  "#111111",
  "#2563eb",
  "#0f766e",
  "#7c3aed",
  "#dc2626",
  "#d97706",
];
const MAX_QUESTIONS = 6;

/**
 * The assistant has no per-record default language: the widget picks one at
 * runtime and every other language is authored against the English column, so
 * English is the translation source.
 */
const SOURCE_LOCALE: AiLocale = "en";

/** Key namespace sent to the API — `strings.` mirrors appearance.strings. */
const STRING_KEY_PREFIX = "strings.";

export function AppearancePanel({ draft, canEdit, onChange }: Props) {
  const { t, i18n } = useTranslation();
  // v1 rows predate the style/launcher/page fields; fill them so every
  // control has a value and the first save writes a complete object.
  const ap = useMemo(
    () => withAppearanceDefaults(draft.appearance),
    [draft.appearance],
  );
  const persona = draft.persona;
  const setAp = (p: Partial<AppearanceConfig>) =>
    onChange({ appearance: { ...ap, ...p } });
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const setPersona = (p: Partial<AssistantDraft["persona"]>) =>
    onChange({ persona: { ...persona, ...p } });

  const initialLocale = (AI_LOCALES as readonly string[]).includes(
    i18n.language,
  )
    ? (i18n.language as AiLocale)
    : "en";
  const [previewLocale, setPreviewLocale] = useState<AiLocale>(initialLocale);
  const [newQuestion, setNewQuestion] = useState("");
  // Controlled so a per-locale string issue can open its own section before the
  // anchor it points at exists in the DOM.
  const [openLocales, setOpenLocales] = useState<string[]>([]);
  useRevealListener((path) => {
    const locale = path.match(/^appearance\.strings\.([a-z]{2})\b/)?.[1];
    if (locale) {
      setOpenLocales((prev) =>
        prev.includes(locale) ? prev : [...prev, locale],
      );
    }
  });

  const addQuestion = () => {
    const q = newQuestion.trim();
    if (!q || persona.suggested_questions.length >= MAX_QUESTIONS) return;
    setPersona({
      suggested_questions: [...persona.suggested_questions, q.slice(0, 120)],
    });
    setNewQuestion("");
  };

  const setString = (
    locale: AiLocale,
    key: keyof WidgetStrings,
    value: string,
  ) => {
    const current = { ...(ap.strings[locale] ?? {}) };
    if (value.trim()) current[key] = value;
    else delete current[key];
    setAp({ strings: { ...ap.strings, [locale]: current } });
  };

  // --- AI translation ------------------------------------------------------

  const { assistantId } = useParams();
  const { translating, anyTranslating, run } =
    useAssistantTranslate(assistantId);
  const [confirmRetranslate, setConfirmRetranslate] = useState<
    AiLocale | "all" | null
  >(null);

  /**
   * The merge happens after an await, so it must not read the `ap` captured by
   * the closure that fired the request — the user keeps typing while the model
   * works, and every keystroke made in the meantime would be reverted.
   */
  const apRef = useRef(ap);
  apRef.current = ap;

  /**
   * Source text for a key: the English column first, then the single-string
   * field that feeds the same slot on the record. A key with neither is left
   * alone — the widget's own built-in defaults are already translated, so
   * paying to translate them would be pure waste.
   */
  const sourceText = (key: keyof WidgetStrings): string => {
    const explicit = ap.strings[SOURCE_LOCALE]?.[key];
    if (explicit?.trim()) return explicit;
    const fallbacks: Partial<Record<keyof WidgetStrings, string | undefined>> =
      {
        greeting: persona.greeting,
        launcher_label: ap.launcher_label,
        header_subtitle: ap.header_subtitle,
        nudge_text: ap.nudge.text,
        lead_intro: draft.lead_capture.intro_text,
        lead_thanks: draft.lead_capture.thank_you_text,
      };
    return fallbacks[key]?.trim() ? fallbacks[key]! : "";
  };

  const targetLocales = useMemo(
    () => AI_LOCALES.filter((l) => l !== SOURCE_LOCALE),
    [],
  );

  const runTranslate = (targets: readonly AiLocale[], overwrite: boolean) => {
    const items: TranslateAssistantRequest["items"] = {};
    const payloadTargets: TranslateAssistantRequest["targets"] = [];

    for (const locale of targets) {
      const keys: string[] = [];
      for (const key of WIDGET_STRING_KEYS) {
        if (!overwrite && (ap.strings[locale]?.[key] ?? "").trim()) continue;
        const value = sourceText(key);
        if (!value) continue;
        const itemKey = `${STRING_KEY_PREFIX}${key}`;
        items[itemKey] = { value };
        keys.push(itemKey);
      }
      if (keys.length > 0) payloadTargets.push({ locale, keys });
    }

    if (payloadTargets.length === 0) {
      toast.info(t("aiAssistants.translate.nothingToDo"));
      return;
    }

    void (async () => {
      const response = await run({
        source_locale: SOURCE_LOCALE,
        items,
        targets: payloadTargets,
      });
      if (!response) return;

      const strings = { ...apRef.current.strings };
      for (const result of response.results) {
        if (!result.ok) continue;
        const merged = { ...(strings[result.locale] ?? {}) };
        for (const [itemKey, value] of Object.entries(result.values)) {
          const key = itemKey.slice(
            STRING_KEY_PREFIX.length,
          ) as keyof WidgetStrings;
          if (!WIDGET_STRING_KEYS.includes(key)) continue;
          if (value.trim()) merged[key] = value;
        }
        strings[result.locale] = merged;
      }
      onChange({ appearance: { ...apRef.current, strings } });
    })();
  };

  const translateDisabled = !canEdit || anyTranslating || !assistantId;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,44%)]">
      <div className="space-y-5">
        <Panel>
          <PanelHeader
            icon={<Palette className="h-3.5 w-3.5" />}
            title={t("aiAssistants.appearance.widgetTitle")}
          />
          <PanelBody>
            <Field>
              <Label>{t("aiAssistants.create.typeLabel")}</Label>
              <RadioGroup
                value={draft.widget_type}
                disabled={!canEdit}
                onValueChange={(v) =>
                  onChange({ widget_type: v as WidgetType })
                }
                className="grid-cols-1 gap-2 @sm:grid-cols-2"
              >
                {WIDGET_TYPES.map((w) => (
                  <label
                    key={w}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2 has-[[data-state=checked]]:border-foreground/40 has-[[data-state=checked]]:bg-muted/60"
                  >
                    <RadioGroupItem value={w} className="mt-0.5" />
                    <span className="space-y-0.5">
                      <span className="block text-sm">
                        {t(`aiAssistants.widgetType.${w}`)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t(`aiAssistants.widgetType.${w}Hint`)}
                      </span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </Field>

            <Cols>
              <Field>
                <Label htmlFor="display-name">
                  {t("aiAssistants.appearance.displayName")}
                </Label>
                <FieldAnchor path="persona.display_name">
                  <Input
                    id="display-name"
                    disabled={!canEdit}
                    maxLength={60}
                    value={persona.display_name}
                    onChange={(e) =>
                      setPersona({ display_name: e.target.value })
                    }
                  />
                </FieldAnchor>
              </Field>
              <Field>
                <Label htmlFor="header-subtitle">
                  {t("aiAssistants.appearance.headerSubtitle")}
                </Label>
                <Input
                  id="header-subtitle"
                  disabled={!canEdit}
                  maxLength={120}
                  value={ap.header_subtitle ?? ""}
                  placeholder={DEFAULT_STRINGS[previewLocale].header_subtitle}
                  onChange={(e) =>
                    setAp({ header_subtitle: e.target.value || undefined })
                  }
                />
              </Field>
            </Cols>

            <Field>
              <Label>{t("aiAssistants.appearance.avatar")}</Label>
              <div className="flex flex-col gap-2 @sm:flex-row @sm:items-center">
                <Segmented label={t("aiAssistants.appearance.avatar")}>
                  <SegmentedButton
                    active={ap.avatar_mode === "initial"}
                    onClick={() => canEdit && setAp({ avatar_mode: "initial" })}
                  >
                    <UserRound className="mr-1 inline h-3 w-3" />
                    {t("aiAssistants.appearance.avatarInitial")}
                  </SegmentedButton>
                  <SegmentedButton
                    active={ap.avatar_mode === "image"}
                    onClick={() => canEdit && setAp({ avatar_mode: "image" })}
                  >
                    {t("aiAssistants.appearance.avatarImage")}
                  </SegmentedButton>
                </Segmented>
                {ap.avatar_mode === "image" ? (
                  <>
                    {ap.avatar_url ? (
                      <img
                        src={ap.avatar_url}
                        alt=""
                        className="size-9 shrink-0 rounded-full border border-border object-cover"
                      />
                    ) : null}
                    <FieldAnchor
                      path="appearance.avatar_url"
                      className="flex-1"
                    >
                      <Input
                        disabled={!canEdit}
                        inputMode="url"
                        placeholder="https://…/avatar.png"
                        value={ap.avatar_url ?? ""}
                        onChange={(e) =>
                          setAp({ avatar_url: e.target.value || undefined })
                        }
                      />
                    </FieldAnchor>
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setAvatarPickerOpen(true)}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 text-xs transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      {t("aiAssistants.appearance.chooseFromLibrary")}
                    </button>
                  </>
                ) : null}
              </div>
            </Field>

            <Field>
              <Label htmlFor="primary-color">
                {t("aiAssistants.appearance.primaryColor")}
              </Label>
              <div className="flex flex-wrap items-center gap-3">
                <FieldAnchor
                  path="appearance.primary_color"
                  className="min-w-[12rem] flex-1"
                >
                  <ColorInput
                    id="primary-color"
                    value={ap.primary_color}
                    onChange={(v) => canEdit && setAp({ primary_color: v })}
                  />
                </FieldAnchor>
                <div
                  className="flex gap-1.5"
                  role="group"
                  aria-label={t("aiAssistants.appearance.presets")}
                >
                  {SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={!canEdit}
                      aria-label={c}
                      onClick={() => setAp({ primary_color: c })}
                      className={cn(
                        "size-6 rounded-full border-2 transition-transform hover:scale-110 motion-reduce:transition-none",
                        ap.primary_color.toLowerCase() === c
                          ? "border-foreground"
                          : "border-transparent",
                      )}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </Field>

            <Field>
              <Label>{t("aiAssistants.appearance.accentForeground")}</Label>
              <FieldAnchor path="appearance.accent_foreground">
                <Segmented label={t("aiAssistants.appearance.accentForeground")}>
                  {(["auto", "light", "dark"] as const).map((v) => (
                    <SegmentedButton
                      key={v}
                      active={(ap.accent_foreground ?? "auto") === v}
                      onClick={() => canEdit && setAp({ accent_foreground: v })}
                    >
                      {t(`aiAssistants.appearance.accentForegroundOption.${v}`)}
                    </SegmentedButton>
                  ))}
                </Segmented>
              </FieldAnchor>
              <FieldHint>
                {t("aiAssistants.appearance.accentForegroundHint")}
              </FieldHint>
            </Field>

            <Cols>
              <Field>
                <Label>{t("aiAssistants.appearance.theme")}</Label>
                <Segmented label={t("aiAssistants.appearance.theme")}>
                  {(["auto", "light", "dark"] as const).map((th) => (
                    <SegmentedButton
                      key={th}
                      active={ap.theme === th}
                      onClick={() => canEdit && setAp({ theme: th })}
                    >
                      {t(`aiAssistants.appearance.themes.${th}`)}
                    </SegmentedButton>
                  ))}
                </Segmented>
              </Field>
              <Field>
                <Label>{t("aiAssistants.appearance.position")}</Label>
                <Segmented label={t("aiAssistants.appearance.position")}>
                  {(["left", "right"] as const).map((pos) => (
                    <SegmentedButton
                      key={pos}
                      active={ap.position === pos}
                      onClick={() => canEdit && setAp({ position: pos })}
                    >
                      {t(`aiAssistants.appearance.positions.${pos}`)}
                    </SegmentedButton>
                  ))}
                </Segmented>
              </Field>
            </Cols>

            {draft.widget_type === "bubble" ? (
              <Field>
                <Label htmlFor="launcher-label">
                  {t("aiAssistants.appearance.launcherLabel")}
                </Label>
                <Input
                  id="launcher-label"
                  disabled={!canEdit}
                  maxLength={60}
                  value={ap.launcher_label ?? ""}
                  placeholder={DEFAULT_STRINGS[previewLocale].launcher_label}
                  onChange={(e) =>
                    setAp({ launcher_label: e.target.value || undefined })
                  }
                />
              </Field>
            ) : null}

            <ToggleField
              id="powered-by"
              checked={ap.show_powered_by}
              disabled={!canEdit}
              onChange={(show_powered_by) => setAp({ show_powered_by })}
              label={t("aiAssistants.appearance.showPoweredBy")}
            />
          </PanelBody>
        </Panel>

        <AppearanceStylePanel
          widgetType={draft.widget_type}
          appearance={ap}
          canEdit={canEdit}
          onChange={setAp}
        />

        <Panel>
          <PanelHeader
            icon={<Languages className="h-3.5 w-3.5" />}
            title={t("aiAssistants.appearance.conversationTitle")}
          />
          <PanelBody>
            <Field>
              <Label htmlFor="greeting">
                {t("aiAssistants.appearance.greeting")}
              </Label>
              <FieldAnchor path="persona.greeting">
                <Input
                  id="greeting"
                  disabled={!canEdit}
                  maxLength={400}
                  value={persona.greeting}
                  placeholder={DEFAULT_STRINGS[previewLocale].greeting}
                  onChange={(e) => setPersona({ greeting: e.target.value })}
                />
              </FieldAnchor>
              <FieldHint>{t("aiAssistants.appearance.greetingHint")}</FieldHint>
            </Field>

            <PanelSection title={t("aiAssistants.appearance.questionsTitle")}>
              {persona.suggested_questions.length > 0 ? (
                <ul
                  id="ai-field-persona.suggested_questions"
                  className="space-y-1.5"
                >
                  {persona.suggested_questions.map((q, i) => (
                    <li key={`${q}-${i}`} className="flex items-center gap-2">
                      <FieldAnchor
                        path={`persona.suggested_questions.${i}`}
                        className="flex-1"
                      >
                        <Input
                          disabled={!canEdit}
                          maxLength={120}
                          value={q}
                          onChange={(e) =>
                            setPersona({
                              suggested_questions:
                                persona.suggested_questions.map((x, j) =>
                                  j === i ? e.target.value : x,
                                ),
                            })
                          }
                          className="h-8 w-full"
                        />
                      </FieldAnchor>
                      {canEdit ? (
                        <button
                          type="button"
                          aria-label={t("common.remove", {
                            defaultValue: "Remove",
                          })}
                          onClick={() =>
                            setPersona({
                              suggested_questions:
                                persona.suggested_questions.filter(
                                  (_, j) => j !== i,
                                ),
                            })
                          }
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {canEdit && persona.suggested_questions.length < MAX_QUESTIONS ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={newQuestion}
                    maxLength={120}
                    placeholder={t(
                      "aiAssistants.appearance.questionPlaceholder",
                    )}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addQuestion();
                      }
                    }}
                    className="h-8 flex-1"
                  />
                  <button
                    type="button"
                    onClick={addQuestion}
                    disabled={!newQuestion.trim()}
                    aria-label={t("common.add", { defaultValue: "Add" })}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-muted/40 px-2.5 text-xs transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("common.add", { defaultValue: "Add" })}
                  </button>
                </div>
              ) : null}
              <FieldHint>
                {t("aiAssistants.appearance.questionsHint", {
                  count: persona.suggested_questions.length,
                  max: MAX_QUESTIONS,
                })}
              </FieldHint>
            </PanelSection>

            <PanelSection
              title={t("aiAssistants.appearance.stringsTitle")}
              action={
                canEdit ? (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      loading={anyTranslating}
                      disabled={translateDisabled}
                      onClick={() => runTranslate(targetLocales, false)}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {t("aiAssistants.translate.allLanguages")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={translateDisabled}
                      onClick={() => setConfirmRetranslate("all")}
                      className="text-muted-foreground"
                    >
                      {t("aiAssistants.translate.retranslate")}
                    </Button>
                  </div>
                ) : null
              }
            >
              <FieldHint>{t("aiAssistants.appearance.stringsHint")}</FieldHint>
              <Accordion
                type="multiple"
                value={openLocales}
                onValueChange={setOpenLocales}
                className="rounded-xl border border-border px-3"
              >
                {AI_LOCALES.map((locale) => (
                  <AccordionItem key={locale} value={locale}>
                    {/* The trigger is a <button>; the AI actions cannot nest
                        inside it, so they sit beside it and the Radix header
                        (an h3) takes the remaining width. */}
                    <div className="flex items-center gap-1 [&>h3]:min-w-0 [&>h3]:flex-1">
                      <AccordionTrigger className="text-sm">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-[11px] uppercase text-muted-foreground">
                            {locale}
                          </span>
                          {t(`aiAssistants.locales.${locale}`)}
                          {Object.keys(ap.strings[locale] ?? {}).length > 0 ? (
                            <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
                              {Object.keys(ap.strings[locale] ?? {}).length}
                            </span>
                          ) : null}
                        </span>
                      </AccordionTrigger>
                      {canEdit && locale !== SOURCE_LOCALE ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            loading={translating.has(locale)}
                            disabled={translateDisabled}
                            onClick={() => runTranslate([locale], false)}
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            {t("aiAssistants.translate.withAi")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={translateDisabled}
                            onClick={() => setConfirmRetranslate(locale)}
                            className="text-muted-foreground"
                          >
                            {t("aiAssistants.translate.retranslate")}
                          </Button>
                        </>
                      ) : null}
                    </div>
                    <AccordionContent className="space-y-3 pb-4">
                      {WIDGET_STRING_KEYS.map((key) => (
                        <FieldAnchor
                          key={key}
                          path={`appearance.strings.${locale}.${key}`}
                          className="space-y-1"
                        >
                          <Label
                            htmlFor={`str-${locale}-${key}`}
                            className="text-xs text-muted-foreground"
                          >
                            {t(`aiAssistants.appearance.strings.${key}`)}
                          </Label>
                          <Input
                            id={`str-${locale}-${key}`}
                            disabled={!canEdit}
                            value={ap.strings[locale]?.[key] ?? ""}
                            placeholder={DEFAULT_STRINGS[locale][key]}
                            onChange={(e) =>
                              setString(locale, key, e.target.value)
                            }
                            className="h-8 text-sm"
                          />
                        </FieldAnchor>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </PanelSection>
          </PanelBody>
        </Panel>
      </div>

      <aside className="space-y-3 lg:sticky lg:top-[var(--ai-stick,5.5rem)] lg:self-start">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("aiAssistants.appearance.preview")}
          </span>
          <Segmented label={t("aiAssistants.appearance.previewLocale")}>
            {AI_LOCALES.map((l) => (
              <SegmentedButton
                key={l}
                active={previewLocale === l}
                onClick={() => setPreviewLocale(l)}
                className="uppercase"
              >
                {l}
              </SegmentedButton>
            ))}
          </Segmented>
        </div>
        <WidgetPreview
          widgetType={draft.widget_type}
          businessName={draft.name}
          persona={persona}
          appearance={ap}
          locale={previewLocale}
        />
      </aside>

      {/* Retranslate overwrites hand-written copy, so it asks first — the
          strings are not saved yet and there is no undo in this panel. */}
      <AlertDialog
        open={confirmRetranslate !== null}
        onOpenChange={(open) => !open && setConfirmRetranslate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("aiAssistants.translate.retranslateTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("aiAssistants.translate.retranslateBody", {
                locale:
                  confirmRetranslate && confirmRetranslate !== "all"
                    ? t(`aiAssistants.locales.${confirmRetranslate}`)
                    : t("aiAssistants.translate.allLanguages"),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = confirmRetranslate;
                setConfirmRetranslate(null);
                if (!target) return;
                runTranslate(target === "all" ? targetLocales : [target], true);
              }}
            >
              {t("aiAssistants.translate.retranslate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MediaPickerDialog
        open={avatarPickerOpen}
        onOpenChange={setAvatarPickerOpen}
        onSelect={(asset) =>
          setAp({ avatar_mode: "image", avatar_url: asset.public_url })
        }
      />
    </div>
  );
}
