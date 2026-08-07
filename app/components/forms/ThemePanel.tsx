import { ChevronDown, Eye, Monitor, Smartphone, Tablet } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FormRenderer } from "~/components/forms/FormRenderer";
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
import { Textarea } from "~/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
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
  FORM_ERROR_CODES,
  FORM_FONT_KEYS,
  TRANSPARENT,
  contentKey,
  isTransparent,
  type FormDefinition,
  type FormLocale,
} from "~/lib/forms/schema";

/** error.generic plus the 13 coded messages — what the summary counts. */
const ERROR_COPY_KEYS = ["generic", ...FORM_ERROR_CODES] as const;

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

  // Advisory only: a blank error string falls back to error.generic at render
  // time, so it is not a validation issue — just worth surfacing on the trigger.
  const blankErrorCount = [
    contentKey.errorGeneric(),
    ...FORM_ERROR_CODES.map((code) => contentKey.error(code)),
  ].filter((key) => getText(key).trim() === "").length;

  const theme = definition.theme;
  const patchTheme = (patch: Partial<FormDefinition["theme"]>) =>
    onChange({ theme: { ...theme, ...patch } });
  const bgTransparent = isTransparent(theme.background);
  const patchSuccess = (patch: Partial<FormDefinition["success"]>) =>
    onChange({ success: { ...definition.success, ...patch } });

  return (
    <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className="space-y-4 sm:space-y-5">
        <Panel>
          <PanelHeader title={t("forms.design.colors")} />
          <PanelBody>
            <Field>
              <Label>{t("forms.design.mode")}</Label>
              <Select
                disabled={disabled}
                value={theme.mode}
                onValueChange={(v) => {
                  // Swapping mode also swaps the neutral palette, otherwise
                  // "dark" just means dark text on a light card.
                  const dark = v === "dark";
                  // Keep the remembered colour on the new palette, so turning
                  // Transparent back off doesn't restore the old mode's grey.
                  setLastBackground(dark ? "#0c0a09" : "#f5f5f4");
                  patchTheme({
                    mode: dark ? "dark" : "light",
                    // Transparency is a deliberate choice about the host page,
                    // not part of the neutral palette — swapping mode keeps it.
                    background: bgTransparent
                      ? TRANSPARENT
                      : dark
                        ? "#0c0a09"
                        : "#f5f5f4",
                    surface: dark ? "#1c1917" : "#ffffff",
                    text: dark ? "#fafaf9" : "#131515",
                    mutedText: dark ? "#a8a29e" : "#78716c",
                    border: dark ? "#292524" : "#e7e5e4",
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">
                    {t("forms.design.light")}
                  </SelectItem>
                  <SelectItem value="dark">{t("forms.design.dark")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>

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

        <Panel>
          <PanelHeader title={t("forms.design.behaviour")} />
          <PanelBody>
            <Field>
              <Label>{t("forms.design.successMode")}</Label>
              <Select
                disabled={disabled}
                value={definition.success.mode}
                onValueChange={(v) => patchSuccess({ mode: v as never })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inline">
                    {t("forms.design.successInline")}
                  </SelectItem>
                  <SelectItem value="modal">
                    {t("forms.design.successModal")}
                  </SelectItem>
                  <SelectItem value="redirect">
                    {t("forms.design.successRedirect")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {definition.success.mode === "redirect" ? (
              <Field>
                <Label htmlFor="success-url">
                  {t("forms.design.redirectUrl")}
                </Label>
                <Input
                  id="success-url"
                  disabled={disabled}
                  placeholder="https://example.com/thank-you"
                  value={definition.success.redirectUrl ?? ""}
                  onChange={(e) =>
                    patchSuccess({ redirectUrl: e.target.value })
                  }
                />
                <FieldHint>{t("forms.validation.invalidRedirect")}</FieldHint>
              </Field>
            ) : null}

            {/* Copy shown per mode. The strings stay in definition.content
                whichever mode is selected, so flipping to redirect and back
                never loses them. */}
            {definition.success.mode === "inline" ? (
              <>
                <Field>
                  <Label htmlFor="success-inline">
                    {t("forms.design.successInlineText")}
                  </Label>
                  <Textarea
                    id="success-inline"
                    rows={3}
                    disabled={disabled}
                    value={getText(contentKey.successInline())}
                    onChange={(e) =>
                      setText(contentKey.successInline(), e.target.value)
                    }
                  />
                </Field>
                <ToggleField
                  id="success-reset"
                  label={t("forms.design.resetAfterSubmit")}
                  checked={definition.success.resetAfterSubmit}
                  onChange={(v) => patchSuccess({ resetAfterSubmit: v })}
                />
              </>
            ) : null}

            {definition.success.mode === "modal" ? (
              <>
                <Field>
                  <Label htmlFor="success-mt">
                    {t("forms.design.successModalTitle")}
                  </Label>
                  <Input
                    id="success-mt"
                    disabled={disabled}
                    value={getText(contentKey.successModalTitle())}
                    onChange={(e) =>
                      setText(contentKey.successModalTitle(), e.target.value)
                    }
                  />
                </Field>
                <Field>
                  <Label htmlFor="success-mb">
                    {t("forms.design.successModalBody")}
                  </Label>
                  <Textarea
                    id="success-mb"
                    rows={3}
                    disabled={disabled}
                    value={getText(contentKey.successModalBody())}
                    onChange={(e) =>
                      setText(contentKey.successModalBody(), e.target.value)
                    }
                  />
                </Field>
                <Field>
                  <Label htmlFor="success-mc">
                    {t("forms.design.successModalCta")}
                  </Label>
                  <Input
                    id="success-mc"
                    disabled={disabled}
                    value={getText(contentKey.successModalCta())}
                    onChange={(e) =>
                      setText(contentKey.successModalCta(), e.target.value)
                    }
                  />
                </Field>
              </>
            ) : null}
          </PanelBody>
        </Panel>

        <Panel>
          {/* The trigger IS the panel header — before this it was a hand-rolled
              copy of CardHeader that had already drifted from the original. */}
          <Collapsible className="group/errors">
            <CollapsibleTrigger asChild>
              <button type="button" className="block w-full text-left">
                <PanelHeader
                  title={t("forms.design.errors")}
                  meta={
                    <span className="text-[11px] normal-case tracking-normal text-muted-foreground/70">
                      {t("forms.design.errorsSummary", {
                        total: ERROR_COPY_KEYS.length,
                        blank: blankErrorCount,
                      })}
                    </span>
                  }
                  action={
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/errors:rotate-180" />
                  }
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <PanelBody>
                <FieldHint>{t("forms.design.errorsHint")}</FieldHint>

                {/* error.generic first and full-width: it is the fallback for
                    any code with no copy, and the failure banner in every
                    success mode, so it is the one a visitor is likeliest to see. */}
                <Field>
                  <Label htmlFor="err-generic">
                    {t("forms.design.error.generic")}
                  </Label>
                  <Input
                    id="err-generic"
                    disabled={disabled}
                    value={getText(contentKey.errorGeneric())}
                    onChange={(e) =>
                      setText(contentKey.errorGeneric(), e.target.value)
                    }
                  />
                </Field>

                <Cols>
                  {FORM_ERROR_CODES.map((code) => (
                    <Field key={code}>
                      <Label htmlFor={`err-${code}`}>
                        {t(`forms.design.error.${code}`)}
                      </Label>
                      <Input
                        id={`err-${code}`}
                        disabled={disabled}
                        value={getText(contentKey.error(code))}
                        onChange={(e) =>
                          setText(contentKey.error(code), e.target.value)
                        }
                      />
                    </Field>
                  ))}
                </Cols>
              </PanelBody>
            </CollapsibleContent>
          </Collapsible>
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
            <FormRenderer
              definition={definition}
              locale={locale}
              fallbackLocale={fallbackLocale}
              mode="preview"
              idPrefix="themepreview"
              values={{}}
              errors={{}}
              onChange={() => undefined}
            />
          </div>
        </div>
      </Panel>
    </div>
  );
}
