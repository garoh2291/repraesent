import { Eye, Monitor, Smartphone, Tablet } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FormRenderer } from "~/components/forms/FormRenderer";
import { withAlpha } from "~/lib/forms/css";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Slider } from "~/components/ui/slider";
import {
  Cols,
  Panel,
  PanelBody,
  PanelHeader,
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
  DEFAULT_FORM_THEME,
  FORM_FONT_KEYS,
  TRANSPARENT,
  type FormLayout,
  isMultiStep,
  isTransparent,
  normalizeLayout,
  type FormDefinition,
  type FormLocale,
} from "~/lib/forms/schema";

const RADII = [0, 4, 8, 12, 16] as const;
const WIDTHS = [480, 560, 640, 720, 880] as const;

const DEVICE_WIDTH = { mobile: 400, tablet: 720, desktop: 1000 } as const;
type Device = keyof typeof DEVICE_WIDTH;

interface Props {
  definition: FormDefinition;
  locale: FormLocale;
  fallbackLocale: FormLocale;
  disabled?: boolean;
  /** Read/write content for the ACTIVE locale — the same closures FieldInspector gets. */
  getText: (key: string) => string;
  setText: (key: string, value: string) => void;
  onChange: (patch: Partial<FormDefinition>) => void;
}

export function ThemePanel({
  definition,
  locale,
  fallbackLocale,
  disabled,
  getText,
  setText,
  onChange,
}: Props) {
  const { t } = useTranslation();
  const [device, setDevice] = useState<Device>("desktop");

  // Remembered so toggling Transparent off restores the colour you had rather
  // than snapping back to the stock grey. Seeded once — the picker is hidden
  // while transparent, so it cannot drift out of date.
  const [lastBackground, setLastBackground] = useState(() =>
    isTransparent(definition.theme.background)
      ? DEFAULT_FORM_THEME.background
      : definition.theme.background,
  );

  const theme = definition.theme;
  const patchTheme = (patch: Partial<FormDefinition["theme"]>) =>
    onChange({ theme: { ...theme, ...patch } });
  const bgTransparent = isTransparent(theme.background);

  const layout = normalizeLayout(definition.layout);
  const multi = isMultiStep(definition);
  const patchLayout = (patch: Partial<FormLayout>) =>
    onChange({ layout: { ...layout, ...patch } });
  // The preview flips steps on its own so you can see the progress style on
  // every step without leaving the tab.
  const [previewStep, setPreviewStep] = useState(0);

  return (
    <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className="space-y-4 sm:space-y-5">
        <Panel>
          <PanelHeader title={t("forms.design.colors")} />
          <PanelBody>
            <Field>
              <Label htmlFor="theme-accent">{t("forms.design.accent")}</Label>
              <ColorInput
                id="theme-accent"
                value={theme.accent}
                onChange={(value) => patchTheme({ accent: value })}
              />
            </Field>

            {/* Background is the only token that may be unpainted, so it gets
                its own row: a switch, and the picker only when it is a colour. */}
            <Field>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="theme-background">
                  {t("forms.design.background")}
                </Label>
                <ToggleField
                  id="theme-bg-transparent"
                  label={t("forms.design.transparent")}
                  checked={bgTransparent}
                  onChange={(on) => {
                    if (on) setLastBackground(theme.background);
                    patchTheme({
                      background: on ? TRANSPARENT : lastBackground,
                    });
                  }}
                />
              </div>
              {bgTransparent ? (
                <FieldHint>{t("forms.design.transparentHint")}</FieldHint>
              ) : (
                <ColorInput
                  id="theme-background"
                  value={theme.background}
                  onChange={(value) => patchTheme({ background: value })}
                />
              )}
            </Field>

            {/* Only the filled style paints a field, so the control appears
                only when it can do anything. Defaults to the tint the style
                used to hardcode, so an existing form looks unchanged until
                someone deliberately picks a colour. */}
            {theme.fieldStyle === "filled" ? (
              <Field>
                <Label htmlFor="theme-field-bg">
                  {t("forms.design.fieldBackground")}
                </Label>
                <ColorInput
                  id="theme-field-bg"
                  value={theme.fieldBackground ?? withAlpha(theme.text, 0.05)}
                  onChange={(value) => patchTheme({ fieldBackground: value })}
                />
              </Field>
            ) : null}

            {(
              [
                ["surface", t("forms.design.surface")],
                ["text", t("forms.design.text")],
                ["mutedText", t("forms.design.mutedText")],
                ["border", t("forms.design.border")],
              ] as const
            ).map(([key, label]) => (
              <Field key={key}>
                <Label htmlFor={`theme-${key}`}>{label}</Label>
                <ColorInput
                  id={`theme-${key}`}
                  value={theme[key]}
                  onChange={(value) => patchTheme({ [key]: value } as never)}
                />
              </Field>
            ))}
          </PanelBody>
        </Panel>

        {multi ? (
          <Panel>
            <PanelHeader title={t("forms.design.steps")} />
            <PanelBody>
              <Field>
                <Label>{t("forms.design.progressStyle")}</Label>
                <Segmented label={t("forms.design.progressStyle")}>
                  {(
                    [
                      ["bar", t("forms.design.progressBar")],
                      ["steps", t("forms.design.progressSteps")],
                      ["none", t("forms.design.progressNone")],
                    ] as const
                  ).map(([key, label]) => (
                    <SegmentedButton
                      key={key}
                      active={layout.progress === key}
                      onClick={() => patchLayout({ progress: key })}
                      className="flex items-center gap-2 px-2.5"
                    >
                      <ProgressGlyph kind={key} />
                      {label}
                    </SegmentedButton>
                  ))}
                </Segmented>
              </Field>
              <ToggleField
                id="theme-steptitles"
                label={t("forms.design.showStepTitles")}
                checked={layout.showStepTitles}
                disabled={disabled}
                onChange={(v) => patchLayout({ showStepTitles: v })}
              />
              <FieldHint>{t("forms.design.stepsHint")}</FieldHint>
            </PanelBody>
          </Panel>
        ) : null}

        <Panel>
          <PanelHeader title={t("forms.design.layout")} />
          <PanelBody>
            <Field>
              <Label>
                {t("forms.design.radius")} · {theme.radius}px
              </Label>
              <Slider
                disabled={disabled}
                min={0}
                max={4}
                step={1}
                value={[RADII.indexOf(theme.radius)]}
                onValueChange={([i]) => patchTheme({ radius: RADII[i] })}
              />
            </Field>

            {/* Inside the form's own background, not around it — this is the gap
                between the painted panel and the first field. Forms rendered
                flush at 0 before it existed; the fallback matches the default so
                an untouched definition picks it up. */}
            <Field>
              <Label>
                {t("forms.design.padding")} · {theme.padding ?? 16}px
              </Label>
              <Slider
                disabled={disabled}
                min={0}
                max={48}
                step={4}
                value={[theme.padding ?? 16]}
                onValueChange={([v]) => patchTheme({ padding: v })}
              />
            </Field>

            <Field>
              <Label>{t("forms.design.font")}</Label>
              <Select
                disabled={disabled}
                value={theme.fontFamily}
                onValueChange={(v) => patchTheme({ fontFamily: v as never })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORM_FONT_KEYS.map((font) => (
                    <SelectItem key={font} value={font}>
                      {font === "system"
                        ? "System"
                        : font === "dm_sans"
                          ? "DM Sans"
                          : font === "serif"
                            ? "Source Serif"
                            : font === "mono"
                              ? "JetBrains Mono"
                              : font.charAt(0).toUpperCase() + font.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Cols>
              <Field>
                <Label>{t("forms.design.fieldStyle")}</Label>
                <Select
                  disabled={disabled}
                  value={theme.fieldStyle}
                  onValueChange={(v) => patchTheme({ fieldStyle: v as never })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outlined">
                      {t("forms.design.outlined")}
                    </SelectItem>
                    <SelectItem value="filled">
                      {t("forms.design.filled")}
                    </SelectItem>
                    <SelectItem value="underline">
                      {t("forms.design.underline")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <Label>{t("forms.design.buttonStyle")}</Label>
                <Select
                  disabled={disabled}
                  value={theme.buttonStyle}
                  onValueChange={(v) => patchTheme({ buttonStyle: v as never })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solid">
                      {t("forms.design.solid")}
                    </SelectItem>
                    <SelectItem value="outline">
                      {t("forms.design.outline")}
                    </SelectItem>
                    <SelectItem value="soft">
                      {t("forms.design.soft")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </Cols>

            <Cols>
              <Field>
                <Label>{t("forms.design.width")}</Label>
                <Select
                  disabled={disabled}
                  value={String(theme.width)}
                  onValueChange={(v) =>
                    patchTheme({ width: Number(v) as never })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WIDTHS.map((w) => (
                      <SelectItem key={w} value={String(w)}>
                        {w}px
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <Label>{t("forms.design.density")}</Label>
                <Select
                  disabled={disabled}
                  value={theme.density}
                  onValueChange={(v) => patchTheme({ density: v as never })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">
                      {t("forms.design.compact")}
                    </SelectItem>
                    <SelectItem value="cozy">
                      {t("forms.design.cozy")}
                    </SelectItem>
                    <SelectItem value="comfortable">
                      {t("forms.design.comfortable")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </Cols>

            <ToggleField
              id="theme-fullwidth"
              label={t("forms.design.buttonFullWidth")}
              checked={theme.buttonFullWidth}
              onChange={(v) => patchTheme({ buttonFullWidth: v })}
            />
            <ToggleField
              id="theme-title"
              label={t("forms.design.showTitle")}
              checked={theme.showFormTitle}
              onChange={(v) => patchTheme({ showFormTitle: v })}
            />
            {/* Lives on FormDefinition, not on theme — hence onChange, not patchTheme. */}
            <ToggleField
              id="theme-langswitcher"
              label={t("forms.design.showLanguageSwitcher")}
              checked={definition.showLanguageSwitcher}
              onChange={(v) => onChange({ showLanguageSwitcher: v })}
            />
            <FieldHint>{t("forms.design.showLanguageSwitcherHint")}</FieldHint>
          </PanelBody>
        </Panel>
      </div>

      {/* Sticky, or the preview scrolls away from the settings it reflects.
          --fb-stick is declared on the builder shell and clears the command
          bar; the fallback keeps this component usable on its own. */}
      <Panel className="xl:sticky xl:top-[var(--fb-stick,1.5rem)] xl:self-start">
        <PanelHeader
          icon={<Eye className="h-3.5 w-3.5" />}
          title={t("forms.design.preview")}
          action={
            <Segmented label={t("forms.design.preview")}>
              {(
                [
                  ["mobile", Smartphone],
                  ["tablet", Tablet],
                  ["desktop", Monitor],
                ] as const
              ).map(([key, Icon]) => (
                <SegmentedButton
                  key={key}
                  active={device === key}
                  onClick={() => setDevice(key)}
                  label={t(`forms.design.${key}`)}
                  className="px-1.5 py-1.5"
                >
                  <Icon className="h-4 w-4" />
                </SegmentedButton>
              ))}
            </Segmented>
          }
        />
        <div
          className="overflow-x-auto p-5 sm:p-8"
          style={{ background: theme.background }}
        >
          <div
            className="mx-auto transition-[max-width]"
            style={{ maxWidth: DEVICE_WIDTH[device] }}
          >
            <div className="rf-canvas">
              <FormRenderer
                definition={definition}
                locale={locale}
                fallbackLocale={fallbackLocale}
                mode="preview"
                idPrefix="themepreview"
                values={{}}
                errors={{}}
                onChange={() => undefined}
                step={multi ? previewStep : undefined}
                onStepChange={(i) =>
                  setPreviewStep(
                    Math.min(Math.max(i, 0), definition.sections.length - 1),
                  )
                }
              />
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

/** Tiny 28×10 sketch of each progress style, so the choice needs no reading. */
function ProgressGlyph({ kind }: { kind: FormLayout["progress"] }) {
  if (kind === "bar") {
    return (
      <span
        aria-hidden
        className="inline-flex h-[10px] w-7 items-center rounded-full bg-current/15"
      >
        <span className="h-[3px] w-4 rounded-full bg-current" />
      </span>
    );
  }
  if (kind === "steps") {
    return (
      <span aria-hidden className="inline-flex w-7 items-center gap-0.5">
        <span className="h-[3px] flex-1 rounded-full bg-current" />
        <span className="h-[3px] flex-1 rounded-full bg-current" />
        <span className="h-[3px] flex-1 rounded-full bg-current/25" />
      </span>
    );
  }
  return (
    <span aria-hidden className="inline-flex w-7 items-center">
      <span className="h-px w-full bg-current/40" />
    </span>
  );
}
