import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Brush, ImageIcon, MousePointerClick, Plus, X } from "lucide-react";
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
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { MediaPickerDialog } from "~/components/media/MediaPickerDialog";
import type { AppearanceConfig, WidgetType } from "~/lib/api/ai-assistants";

interface Props {
  widgetType: WidgetType;
  appearance: AppearanceConfig;
  canEdit: boolean;
  onChange: (patch: Partial<AppearanceConfig>) => void;
}

const FONTS = ["system", "inherit", "geist"] as const;
const RADII = ["sm", "md", "lg", "pill"] as const;
const DENSITIES = ["comfortable", "compact"] as const;
const HEADERS = ["solid", "gradient", "minimal"] as const;
const ICONS = ["chat", "sparkle", "question", "image"] as const;
const SIZES = ["sm", "md", "lg"] as const;
const RULE_MODES = ["all", "include", "exclude"] as const;
const MAX_PATTERNS = 20;

/**
 * Style, launcher and on-page behaviour. Split off AppearancePanel so each
 * file stays readable; the parent owns the preview column.
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
  const set = (p: Partial<AppearanceConfig>) => canEdit && onChange(p);

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

  return (
    <>
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
              t("aiAssistants.appearance.radius.label"),
              RADII,
              ap.radius,
              (radius) => set({ radius }),
              "aiAssistants.appearance.radius",
            )}
          </Cols>
          <Cols>
            {seg(
              t("aiAssistants.appearance.density.label"),
              DENSITIES,
              ap.density,
              (density) => set({ density }),
              "aiAssistants.appearance.density",
            )}
            {seg(
              t("aiAssistants.appearance.headerStyle.label"),
              HEADERS,
              ap.header_style,
              (header_style) => set({ header_style }),
              "aiAssistants.appearance.headerStyle",
            )}
          </Cols>
          <FieldHint>{t("aiAssistants.appearance.font.hint")}</FieldHint>
        </PanelBody>
      </Panel>

      {widgetType === "bubble" ? (
        <Panel>
          <PanelHeader
            icon={<MousePointerClick className="h-3.5 w-3.5" />}
            title={t("aiAssistants.appearance.launcher.title")}
          />
          <PanelBody>
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

      {widgetType === "bubble" ? (
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
