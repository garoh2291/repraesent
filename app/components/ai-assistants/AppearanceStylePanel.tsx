import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Brush,
  ChevronDown,
  ImageIcon,
  MousePointerClick,
  Palette,
  Plus,
  Ruler,
  X,
} from "lucide-react";
import {
  Cols,
  Panel,
  PanelBody,
  PanelHeader,
  PanelSection,
  Segmented,
  SegmentedButton,
} from "~/components/forms/chrome";
import { FieldAnchor } from "~/components/ai-assistants/FieldAnchor";
import { Field, FieldHint, ToggleField } from "~/components/wordpress/fields";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Slider } from "~/components/ui/slider";
import { MediaPickerDialog } from "~/components/media/MediaPickerDialog";
import { controlsFor } from "~/lib/ai-assistants/controls";
import { defaultMaxWidth } from "~/lib/ai-assistants/palette";
import {
  BORDER_WIDTH_MAX,
  MARGIN_Y_MAX,
  MAX_WIDTH_MAX,
  MAX_WIDTH_MIN,
  RADIUS_PX_MAX,
  WIDGET_COLOR_KEYS,
  WIDGET_HEIGHTS,
  WIDGET_SHADOWS,
  WIDGET_THEMES,
  type AppearanceConfig,
  type WidgetColors,
  type WidgetType,
} from "~/lib/api/ai-assistants";
import { cn } from "~/lib/utils";

interface Props {
  widgetType: WidgetType;
  appearance: AppearanceConfig;
  canEdit: boolean;
  onChange: (patch: Partial<AppearanceConfig>) => void;
}

const SWATCHES = [
  "#111111",
  "#2563eb",
  "#0f766e",
  "#7c3aed",
  "#dc2626",
  "#d97706",
];
const FONTS = ["system", "inherit", "geist"] as const;
const RADII = ["sm", "md", "lg", "pill"] as const;
/** What each preset resolves to, so switching to the slider starts where you are. */
const RADIUS_PRESET_PX: Record<AppearanceConfig["radius"], number> = {
  sm: 6,
  md: 12,
  lg: 18,
  pill: 24,
};
const DENSITIES = ["comfortable", "compact"] as const;
const HEADERS = ["solid", "gradient", "minimal"] as const;
const ICONS = ["chat", "sparkle", "question", "image"] as const;
const SIZES = ["sm", "md", "lg"] as const;
const RULE_MODES = ["all", "include", "exclude"] as const;
const BORDER_WIDTHS = [0, 1, 2, 3] as const;
const MAX_PATTERNS = 20;

/**
 * Colour, style, shape/space, launcher and on-page behaviour. Split off
 * AppearancePanel so each file stays readable; the parent owns the preview
 * column and the copy.
 *
 * Every section is gated by `controlsFor(widgetType)` — the widget type is the
 * one input that decides whether a control means anything at all.
 */
export function AppearanceStylePanel({
  widgetType,
  appearance: ap,
  canEdit,
  onChange,
}: Props) {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pattern, setPattern] = useState("");
  const [customColorsOpen, setCustomColorsOpen] = useState(
    () => Object.values(ap.colors ?? {}).some((v) => !!v),
  );
  const controls = controlsFor(widgetType);
  const set = (p: Partial<AppearanceConfig>) => canEdit && onChange(p);

  const setColor = (key: keyof WidgetColors, value: string | undefined) => {
    const colors = { ...(ap.colors ?? {}) };
    if (value && value.trim()) colors[key] = value.trim();
    else delete colors[key];
    set({ colors });
  };

  const addPattern = () => {
    const v = pattern.trim();
    if (!v || ap.page_rules.patterns.length >= MAX_PATTERNS) return;
    if (!ap.page_rules.patterns.includes(v)) {
      set({
        page_rules: {
          ...ap.page_rules,
          patterns: [...ap.page_rules.patterns, v.slice(0, 200)],
        },
      });
    }
    setPattern("");
  };

  const seg = <T extends string>(
    label: string,
    options: readonly T[],
    value: T,
    apply: (v: T) => void,
    i18nBase: string,
  ) => (
    <Field>
      <Label>{label}</Label>
      <Segmented label={label}>
        {options.map((o) => (
          <SegmentedButton
            key={o}
            active={value === o}
            onClick={() => apply(o)}
          >
            {t(`${i18nBase}.${o}`)}
          </SegmentedButton>
        ))}
      </Segmented>
    </Field>
  );

  const usePresetRadius = ap.radius_px == null;

  return (
    <>
      <Panel>
        <PanelHeader
          icon={<Palette className="h-3.5 w-3.5" />}
          title={t("aiAssistants.appearance.colours.title")}
        />
        <PanelBody>
          <Field>
            <Label>{t("aiAssistants.appearance.theme")}</Label>
            <RadioGroup
              value={ap.theme}
              disabled={!canEdit}
              onValueChange={(v) =>
                set({ theme: v as AppearanceConfig["theme"] })
              }
              className="grid-cols-1 gap-2 @sm:grid-cols-2"
            >
              {WIDGET_THEMES.map((th) => (
                <label
                  key={th}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2 transition-colors has-[[data-state=checked]]:border-foreground/40 has-[[data-state=checked]]:bg-muted/60"
                >
                  <RadioGroupItem value={th} className="mt-0.5" />
                  <span className="min-w-0 space-y-0.5">
                    <span className="flex items-center gap-1.5 text-sm">
                      {t(`aiAssistants.appearance.themes.${th}`)}
                      {th === "page" ? (
                        <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {t("aiAssistants.appearance.colours.recommended")}
                        </span>
                      ) : null}
                    </span>
                    <span className="block text-xs leading-relaxed text-muted-foreground">
                      {t(`aiAssistants.appearance.themeHints.${th}`)}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
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
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label={t("aiAssistants.appearance.primaryColor")}
                    disabled={!canEdit}
                    value={
                      /^#[0-9a-f]{6}$/i.test(ap.primary_color)
                        ? ap.primary_color
                        : "#000000"
                    }
                    onChange={(e) => set({ primary_color: e.target.value })}
                    className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
                  />
                  <Input
                    id="primary-color"
                    disabled={!canEdit}
                    value={ap.primary_color}
                    onChange={(e) => set({ primary_color: e.target.value })}
                    className="font-mono text-sm"
                  />
                </div>
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
                    onClick={() => set({ primary_color: c })}
                    className={cn(
                      "size-6 rounded-full border-2 transition-transform hover:scale-110 active:scale-95 motion-reduce:transition-none",
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
                    onClick={() => set({ accent_foreground: v })}
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

          <Collapsible
            open={customColorsOpen}
            onOpenChange={setCustomColorsOpen}
            className="rounded-xl border border-border"
          >
            <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50">
              <ChevronDown
                aria-hidden
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
                  customColorsOpen && "rotate-180",
                )}
              />
              <span className="flex-1">
                {t("aiAssistants.appearance.colours.customTitle")}
              </span>
              {Object.values(ap.colors ?? {}).filter(Boolean).length > 0 ? (
                <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
                  {Object.values(ap.colors ?? {}).filter(Boolean).length}
                </span>
              ) : null}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2.5 border-t border-border px-3 py-3">
              <FieldHint>
                {t("aiAssistants.appearance.colours.customHint")}
              </FieldHint>
              {WIDGET_COLOR_KEYS.map((key) => (
                <FieldAnchor
                  key={key}
                  path={`appearance.colors.${key}`}
                  className="flex items-center gap-2"
                >
                  <Label
                    htmlFor={`color-${key}`}
                    className="w-28 shrink-0 text-xs font-normal text-muted-foreground"
                  >
                    {t(`aiAssistants.appearance.colours.keys.${key}`)}
                  </Label>
                  <input
                    type="color"
                    aria-label={t(
                      `aiAssistants.appearance.colours.keys.${key}`,
                    )}
                    disabled={!canEdit}
                    value={
                      /^#[0-9a-f]{6}$/i.test(ap.colors?.[key] ?? "")
                        ? ap.colors![key]!
                        : "#ffffff"
                    }
                    onChange={(e) => setColor(key, e.target.value)}
                    className="h-8 w-9 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
                  />
                  <Input
                    id={`color-${key}`}
                    disabled={!canEdit}
                    value={ap.colors?.[key] ?? ""}
                    placeholder={t(
                      "aiAssistants.appearance.colours.followsPage",
                    )}
                    onChange={(e) => setColor(key, e.target.value)}
                    className="h-8 font-mono text-sm"
                  />
                  <button
                    type="button"
                    disabled={!canEdit || !ap.colors?.[key]}
                    aria-label={`${t("common.clear", { defaultValue: "Clear" })} ${t(`aiAssistants.appearance.colours.keys.${key}`)}`}
                    onClick={() => setColor(key, undefined)}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </FieldAnchor>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          icon={<Brush className="h-3.5 w-3.5" />}
          title={t("aiAssistants.appearance.style")}
        />
        <PanelBody>
          <Cols>
            {seg(
              t("aiAssistants.appearance.font.label"),
              FONTS,
              ap.font,
              (font) => set({ font }),
              "aiAssistants.appearance.font",
            )}
            {seg(
              t("aiAssistants.appearance.density.label"),
              DENSITIES,
              ap.density,
              (density) => set({ density }),
              "aiAssistants.appearance.density",
            )}
          </Cols>
          {seg(
            t("aiAssistants.appearance.headerStyle.label"),
            HEADERS,
            ap.header_style,
            (header_style) => set({ header_style }),
            "aiAssistants.appearance.headerStyle",
          )}
          <FieldHint>{t("aiAssistants.appearance.font.hint")}</FieldHint>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          icon={<Ruler className="h-3.5 w-3.5" />}
          title={t("aiAssistants.appearance.shape.title")}
        />
        <PanelBody>
          <Field>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>{t("aiAssistants.appearance.radius.label")}</Label>
              <ToggleField
                id="radius-preset"
                checked={usePresetRadius}
                disabled={!canEdit}
                onChange={(on) =>
                  set({
                    radius_px: on ? null : RADIUS_PRESET_PX[ap.radius],
                  })
                }
                label={t("aiAssistants.appearance.shape.usePreset")}
              />
            </div>
            {usePresetRadius ? (
              <Segmented label={t("aiAssistants.appearance.radius.label")}>
                {RADII.map((r) => (
                  <SegmentedButton
                    key={r}
                    active={ap.radius === r}
                    onClick={() => set({ radius: r })}
                  >
                    {t(`aiAssistants.appearance.radius.${r}`)}
                  </SegmentedButton>
                ))}
              </Segmented>
            ) : (
              <FieldAnchor
                path="appearance.radius_px"
                className="flex items-center gap-3"
              >
                <Slider
                  aria-label={t("aiAssistants.appearance.radius.label")}
                  disabled={!canEdit}
                  min={0}
                  max={RADIUS_PX_MAX}
                  step={1}
                  value={[ap.radius_px ?? 0]}
                  onValueChange={([v]) => set({ radius_px: v })}
                  className="flex-1"
                />
                <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {ap.radius_px ?? 0} px
                </span>
              </FieldAnchor>
            )}
            <FieldHint>{t("aiAssistants.appearance.shape.radiusHint")}</FieldHint>
          </Field>

          <Cols>
            <Field>
              <Label>{t("aiAssistants.appearance.shape.borderWidth")}</Label>
              <FieldAnchor path="appearance.border_width">
                <Segmented
                  label={t("aiAssistants.appearance.shape.borderWidth")}
                >
                  {BORDER_WIDTHS.map((w) => (
                    <SegmentedButton
                      key={w}
                      active={ap.border_width === w}
                      onClick={() => set({ border_width: w })}
                    >
                      {w === 0 ? t("aiAssistants.appearance.shape.none") : `${w} px`}
                    </SegmentedButton>
                  ))}
                </Segmented>
              </FieldAnchor>
            </Field>
            <Field>
              <Label>{t("aiAssistants.appearance.shape.shadow")}</Label>
              <Segmented label={t("aiAssistants.appearance.shape.shadow")}>
                {WIDGET_SHADOWS.map((s) => (
                  <SegmentedButton
                    key={s}
                    active={ap.shadow === s}
                    onClick={() => set({ shadow: s })}
                  >
                    {t(`aiAssistants.appearance.shape.shadows.${s}`)}
                  </SegmentedButton>
                ))}
              </Segmented>
            </Field>
          </Cols>

          {controls.box ? (
            <PanelSection title={t("aiAssistants.appearance.shape.boxTitle")}>
              <Cols>
                <Field>
                  <Label htmlFor="max-width">
                    {t("aiAssistants.appearance.shape.maxWidth")}
                  </Label>
                  <FieldAnchor path="appearance.max_width">
                    <div className="flex items-center gap-2">
                      <Input
                        id="max-width"
                        type="number"
                        inputMode="numeric"
                        min={MAX_WIDTH_MIN}
                        max={MAX_WIDTH_MAX}
                        disabled={!canEdit}
                        value={ap.max_width ?? ""}
                        placeholder={String(defaultMaxWidth(widgetType))}
                        onChange={(e) =>
                          set({
                            max_width:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                        onBlur={(e) =>
                          e.target.value === ""
                            ? undefined
                            : set({
                                max_width: clamp(
                                  Number(e.target.value),
                                  MAX_WIDTH_MIN,
                                  MAX_WIDTH_MAX,
                                ),
                              })
                        }
                      />
                      <span className="shrink-0 text-xs text-muted-foreground">
                        px
                      </span>
                    </div>
                  </FieldAnchor>
                  <FieldHint>
                    {t("aiAssistants.appearance.shape.maxWidthHint")}
                  </FieldHint>
                </Field>
                <Field>
                  <Label>{t("aiAssistants.appearance.shape.height")}</Label>
                  <Segmented label={t("aiAssistants.appearance.shape.height")}>
                    {WIDGET_HEIGHTS.map((h) => (
                      <SegmentedButton
                        key={h}
                        active={ap.height === h}
                        onClick={() => set({ height: h })}
                      >
                        {t(`aiAssistants.appearance.shape.heights.${h}`)}
                      </SegmentedButton>
                    ))}
                  </Segmented>
                </Field>
              </Cols>

              <Field>
                <Label>{t("aiAssistants.appearance.shape.marginY")}</Label>
                <FieldAnchor
                  path="appearance.margin_y"
                  className="flex items-center gap-3"
                >
                  <Slider
                    aria-label={t("aiAssistants.appearance.shape.marginY")}
                    disabled={!canEdit}
                    min={0}
                    max={MARGIN_Y_MAX}
                    step={4}
                    value={[ap.margin_y ?? 0]}
                    onValueChange={([v]) => set({ margin_y: v })}
                    className="flex-1"
                  />
                  <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {ap.margin_y ?? 0} px
                  </span>
                </FieldAnchor>
                <FieldHint>
                  {t("aiAssistants.appearance.shape.marginYHint")}
                </FieldHint>
              </Field>
            </PanelSection>
          ) : null}
        </PanelBody>
      </Panel>

      {controls.launcher ? (
        <Panel>
          <PanelHeader
            icon={<MousePointerClick className="h-3.5 w-3.5" />}
            title={t("aiAssistants.appearance.launcher.title")}
          />
          <PanelBody>
            <Field>
              <Label>{t("aiAssistants.appearance.position")}</Label>
              <Segmented label={t("aiAssistants.appearance.position")}>
                {(["left", "right"] as const).map((pos) => (
                  <SegmentedButton
                    key={pos}
                    active={ap.position === pos}
                    onClick={() => set({ position: pos })}
                  >
                    {t(`aiAssistants.appearance.positions.${pos}`)}
                  </SegmentedButton>
                ))}
              </Segmented>
            </Field>

            <Field>
              <Label>{t("aiAssistants.appearance.launcher.icon")}</Label>
              <RadioGroup
                value={ap.launcher_icon}
                disabled={!canEdit}
                onValueChange={(v) =>
                  set({ launcher_icon: v as AppearanceConfig["launcher_icon"] })
                }
                className="grid-cols-2 gap-2 @sm:grid-cols-4"
              >
                {ICONS.map((ic) => (
                  <label
                    key={ic}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-[[data-state=checked]]:border-foreground/40 has-[[data-state=checked]]:bg-muted/60"
                  >
                    <RadioGroupItem value={ic} />
                    {t(`aiAssistants.appearance.launcher.icons.${ic}`)}
                  </label>
                ))}
              </RadioGroup>
              {ap.launcher_icon === "image" ? (
                <div className="flex flex-col gap-2 @sm:flex-row @sm:items-center">
                  {ap.launcher_image_url ? (
                    <img
                      src={ap.launcher_image_url}
                      alt=""
                      className="size-9 shrink-0 rounded-full border border-border object-cover"
                    />
                  ) : null}
                  <FieldAnchor path="appearance.launcher_image_url">
                    <Input
                      disabled={!canEdit}
                      inputMode="url"
                      placeholder="https://…/icon.png"
                      value={ap.launcher_image_url ?? ""}
                      onChange={(e) =>
                        set({ launcher_image_url: e.target.value || undefined })
                      }
                      className="flex-1"
                    />
                  </FieldAnchor>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setPickerOpen(true)}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 text-xs transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    {t("aiAssistants.appearance.chooseFromLibrary")}
                  </button>
                </div>
              ) : null}
            </Field>

            {seg(
              t("aiAssistants.appearance.launcher.size"),
              SIZES,
              ap.launcher_size,
              (launcher_size) => set({ launcher_size }),
              "aiAssistants.appearance.launcher.sizes",
            )}

            <Cols>
              <Field>
                <Label htmlFor="offset-x">
                  {t("aiAssistants.appearance.launcher.offsetX")}
                </Label>
                <FieldAnchor path="appearance.offset_x">
                  <Input
                    id="offset-x"
                    type="number"
                    min={0}
                    max={200}
                    disabled={!canEdit}
                    value={ap.offset_x}
                    onChange={(e) =>
                      set({
                        offset_x: clamp(Number(e.target.value) || 0, 0, 200),
                      })
                    }
                  />
                </FieldAnchor>
              </Field>
              <Field>
                <Label htmlFor="offset-y">
                  {t("aiAssistants.appearance.launcher.offsetY")}
                </Label>
                <FieldAnchor path="appearance.offset_y">
                  <Input
                    id="offset-y"
                    type="number"
                    min={0}
                    max={200}
                    disabled={!canEdit}
                    value={ap.offset_y}
                    onChange={(e) =>
                      set({
                        offset_y: clamp(Number(e.target.value) || 0, 0, 200),
                      })
                    }
                  />
                </FieldAnchor>
              </Field>
            </Cols>
            <FieldHint>
              {t("aiAssistants.appearance.launcher.offsetsHint")}
            </FieldHint>
          </PanelBody>
        </Panel>
      ) : null}

      {controls.launcher ? (
        <Panel>
          <PanelHeader
            icon={<MousePointerClick className="h-3.5 w-3.5" />}
            title={t("aiAssistants.appearance.onPage.title")}
          />
          <PanelBody>
            <PanelSection title={t("aiAssistants.appearance.autoOpen.title")}>
              <ToggleField
                id="auto-open"
                checked={ap.auto_open.enabled}
                disabled={!canEdit}
                onChange={(enabled) =>
                  set({ auto_open: { ...ap.auto_open, enabled } })
                }
                label={t("aiAssistants.appearance.autoOpen.enabled")}
              />
              {ap.auto_open.enabled ? (
                <Cols>
                  <Field>
                    <Label htmlFor="auto-open-delay">
                      {t("aiAssistants.appearance.delaySeconds")}
                    </Label>
                    <FieldAnchor path="appearance.auto_open.delay_seconds">
                      <Input
                        id="auto-open-delay"
                        type="number"
                        min={0}
                        max={120}
                        disabled={!canEdit}
                        value={ap.auto_open.delay_seconds}
                        onChange={(e) =>
                          set({
                            auto_open: {
                              ...ap.auto_open,
                              delay_seconds: clamp(
                                Number(e.target.value) || 0,
                                0,
                                120,
                              ),
                            },
                          })
                        }
                      />
                    </FieldAnchor>
                  </Field>
                  <Field className="@sm:pt-7">
                    <ToggleField
                      id="auto-open-once"
                      checked={ap.auto_open.once_per_visitor}
                      disabled={!canEdit}
                      onChange={(once_per_visitor) =>
                        set({
                          auto_open: { ...ap.auto_open, once_per_visitor },
                        })
                      }
                      label={t("aiAssistants.appearance.autoOpen.once")}
                    />
                  </Field>
                </Cols>
              ) : null}
            </PanelSection>

            <PanelSection title={t("aiAssistants.appearance.nudge.title")}>
              <ToggleField
                id="nudge"
                checked={ap.nudge.enabled}
                disabled={!canEdit}
                onChange={(enabled) => set({ nudge: { ...ap.nudge, enabled } })}
                label={t("aiAssistants.appearance.nudge.enabled")}
              />
              {ap.nudge.enabled ? (
                <Cols>
                  <Field>
                    <Label htmlFor="nudge-text">
                      {t("aiAssistants.appearance.nudge.text")}
                    </Label>
                    <Input
                      id="nudge-text"
                      maxLength={120}
                      disabled={!canEdit}
                      value={ap.nudge.text}
                      placeholder={t(
                        "aiAssistants.appearance.nudge.placeholder",
                      )}
                      onChange={(e) =>
                        set({ nudge: { ...ap.nudge, text: e.target.value } })
                      }
                    />
                    <FieldHint>
                      {t("aiAssistants.appearance.nudge.perLanguageHint")}
                    </FieldHint>
                  </Field>
                  <Field>
                    <Label htmlFor="nudge-delay">
                      {t("aiAssistants.appearance.delaySeconds")}
                    </Label>
                    <FieldAnchor path="appearance.nudge.delay_seconds">
                      <Input
                        id="nudge-delay"
                        type="number"
                        min={0}
                        max={120}
                        disabled={!canEdit}
                        value={ap.nudge.delay_seconds}
                        onChange={(e) =>
                          set({
                            nudge: {
                              ...ap.nudge,
                              delay_seconds: clamp(
                                Number(e.target.value) || 0,
                                0,
                                120,
                              ),
                            },
                          })
                        }
                      />
                    </FieldAnchor>
                  </Field>
                </Cols>
              ) : null}
              <FieldHint>{t("aiAssistants.appearance.nudge.hint")}</FieldHint>
            </PanelSection>

            <PanelSection title={t("aiAssistants.appearance.pageRules.title")}>
              <ToggleField
                id="hide-mobile"
                checked={ap.hide_on_mobile}
                disabled={!canEdit}
                onChange={(hide_on_mobile) => set({ hide_on_mobile })}
                label={t("aiAssistants.appearance.hideOnMobile")}
              />
              <Field>
                <Label>{t("aiAssistants.appearance.pageRules.mode")}</Label>
                <Segmented label={t("aiAssistants.appearance.pageRules.mode")}>
                  {RULE_MODES.map((mode) => (
                    <SegmentedButton
                      key={mode}
                      active={ap.page_rules.mode === mode}
                      onClick={() =>
                        set({ page_rules: { ...ap.page_rules, mode } })
                      }
                    >
                      {t(`aiAssistants.appearance.pageRules.modes.${mode}`)}
                    </SegmentedButton>
                  ))}
                </Segmented>
              </Field>
              {ap.page_rules.mode !== "all" ? (
                <FieldAnchor
                  path="appearance.page_rules.patterns"
                  className="space-y-2"
                >
                  {ap.page_rules.patterns.length > 0 ? (
                    <ul className="flex flex-wrap gap-1.5">
                      {ap.page_rules.patterns.map((p) => (
                        <li
                          key={p}
                          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-xs"
                        >
                          {p}
                          {canEdit ? (
                            <button
                              type="button"
                              aria-label={`${t("common.remove", { defaultValue: "Remove" })} ${p}`}
                              onClick={() =>
                                set({
                                  page_rules: {
                                    ...ap.page_rules,
                                    patterns: ap.page_rules.patterns.filter(
                                      (x) => x !== p,
                                    ),
                                  },
                                })
                              }
                              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {canEdit && ap.page_rules.patterns.length < MAX_PATTERNS ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={pattern}
                        maxLength={200}
                        placeholder="/pricing"
                        onChange={(e) => setPattern(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addPattern();
                          }
                        }}
                        className="h-8 flex-1 font-mono text-sm"
                      />
                      <button
                        type="button"
                        onClick={addPattern}
                        disabled={!pattern.trim()}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-muted/40 px-2.5 text-xs transition-colors hover:bg-muted disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {t("common.add", { defaultValue: "Add" })}
                      </button>
                    </div>
                  ) : null}
                  <FieldHint>
                    {t("aiAssistants.appearance.pageRules.hint")}
                  </FieldHint>
                </FieldAnchor>
              ) : null}
            </PanelSection>
          </PanelBody>
        </Panel>
      ) : null}

      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(asset) => set({ launcher_image_url: asset.public_url })}
      />
    </>
  );
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}
