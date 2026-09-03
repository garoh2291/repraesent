import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ImageIcon,
  Languages,
  Palette,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import { MediaPickerDialog } from "~/components/media/MediaPickerDialog";
import { AppearanceStylePanel } from "~/components/ai-assistants/AppearanceStylePanel";
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
                <Input
                  id="display-name"
                  disabled={!canEdit}
                  maxLength={60}
                  value={persona.display_name}
                  onChange={(e) => setPersona({ display_name: e.target.value })}
                />
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
                    <Input
                      disabled={!canEdit}
                      inputMode="url"
                      placeholder="https://…/avatar.png"
                      value={ap.avatar_url ?? ""}
                      onChange={(e) =>
                        setAp({ avatar_url: e.target.value || undefined })
                      }
                      className="flex-1"
                    />
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
                <div className="min-w-[12rem] flex-1">
                  <ColorInput
                    id="primary-color"
                    value={ap.primary_color}
                    onChange={(v) => canEdit && setAp({ primary_color: v })}
                  />
                </div>
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
              <Input
                id="greeting"
                disabled={!canEdit}
                maxLength={400}
                value={persona.greeting}
                placeholder={DEFAULT_STRINGS[previewLocale].greeting}
                onChange={(e) => setPersona({ greeting: e.target.value })}
              />
              <FieldHint>{t("aiAssistants.appearance.greetingHint")}</FieldHint>
            </Field>

            <PanelSection title={t("aiAssistants.appearance.questionsTitle")}>
              {persona.suggested_questions.length > 0 ? (
                <ul className="space-y-1.5">
                  {persona.suggested_questions.map((q, i) => (
                    <li key={`${q}-${i}`} className="flex items-center gap-2">
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
                        className="h-8 flex-1"
                      />
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

            <PanelSection title={t("aiAssistants.appearance.stringsTitle")}>
              <FieldHint>{t("aiAssistants.appearance.stringsHint")}</FieldHint>
              <Accordion
                type="multiple"
                className="rounded-xl border border-border px-3"
              >
                {AI_LOCALES.map((locale) => (
                  <AccordionItem key={locale} value={locale}>
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
                    <AccordionContent className="space-y-3 pb-4">
                      {WIDGET_STRING_KEYS.map((key) => (
                        <div key={key} className="space-y-1">
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
                        </div>
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
