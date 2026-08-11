import { useTranslation } from "react-i18next";
import { MapPin, Palette } from "lucide-react";
import type {
  ReTranslateSettings,
  ReTranslateSwitcher,
  ReTranslateSwitcherLayout,
  ReTranslateSwitcherPosition,
  ReTranslateSwitcherShow,
} from "~/lib/wordpress/plugin-settings-types";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
import { Slider } from "~/components/ui/slider";
import { Switch } from "~/components/ui/switch";
import {
  CardHeader,
  Field,
  FieldHint,
  InfoNote,
  SectionCard,
} from "~/components/wordpress/fields";
import {
  SWITCHER_LAYOUTS,
  SWITCHER_LENGTHS,
  SWITCHER_POSITIONS,
  SWITCHER_SHOW_MODES,
  offsetFallback,
  languageDisplayCode,
  previewLanguage,
  type PatchSettings,
  type SwitcherLengthKey,
} from "./constants";
import { cn } from "~/lib/utils";

/**
 * The language switcher: where it goes and how it looks.
 *
 * Built around one admission the plugin's own admin makes — it does not know
 * what the theme looks like. So the default for every colour is to inherit, and
 * the controls exist for the case where inheriting lands the switcher somewhere
 * it needs to stand out. Lengths work the same way: empty means the plugin's own
 * stylesheet default (stated in `em`, so it scales with the surrounding text).
 */

const POSITION_LABELS: Record<ReTranslateSwitcherPosition, string> = {
  "bottom-right": "Bottom right",
  "bottom-left": "Bottom left",
  "top-right": "Top right",
  "top-left": "Top left",
};

const LAYOUT_LABELS: Record<ReTranslateSwitcherLayout, string> = {
  inline: "Side by side",
  dropdown: "Dropdown",
};

/** Colour wells, grouped as the plugin groups them. The fallback is only what
 *  the native picker opens on — an untouched field stays empty and inherits. */
const COLOR_GROUPS: {
  group: "all" | "current";
  key: keyof ReTranslateSwitcher["colors"];
  label: string;
  fallback: string;
}[] = [
  { group: "all", key: "text", label: "Text", fallback: "#111111" },
  { group: "all", key: "bg", label: "Background", fallback: "#ffffff" },
  { group: "all", key: "border", label: "Border", fallback: "#d4d4d8" },
  { group: "current", key: "active_text", label: "Text", fallback: "#ffffff" },
  { group: "current", key: "active_bg", label: "Background", fallback: "#111111" },
];

/** Which way "more" goes depends on the corner the pill is pinned to. */
const OFFSET_LABELS: Record<
  ReTranslateSwitcherPosition,
  { y: string; x: string }
> = {
  "bottom-right": { y: "Up from the bottom", x: "In from the right" },
  "bottom-left": { y: "Up from the bottom", x: "In from the left" },
  "top-right": { y: "Down from the top", x: "In from the right" },
  "top-left": { y: "Down from the top", x: "In from the left" },
};

export function SwitcherPanel({
  settings,
  patchSettings,
}: {
  settings: ReTranslateSettings;
  patchSettings: PatchSettings;
}) {
  const { t } = useTranslation();
  const switcher = settings.switcher;

  function update(patch: Partial<ReTranslateSwitcher>) {
    patchSettings((prev) => ({
      ...prev,
      switcher: { ...prev.switcher, ...patch },
    }));
  }

  function updateColor(
    key: keyof ReTranslateSwitcher["colors"],
    value: string,
  ) {
    patchSettings((prev) => ({
      ...prev,
      switcher: {
        ...prev.switcher,
        colors: { ...prev.switcher.colors, [key]: value },
      },
    }));
  }

  // What the "shown as" buttons put on their faces: the site's own source
  // language, so the modes differ visibly rather than in the abstract.
  const sample = previewLanguage({ code: settings.source_language || "en" });
  const sampleCode = languageDisplayCode(sample.code);
  const showExample: Record<ReTranslateSwitcherShow, string> = {
    label: sample.label,
    code: sampleCode,
    flag: sample.flag || sampleCode,
    flag_label: sample.flag ? `${sample.flag} ${sample.label}` : sample.label,
    flag_code: sample.flag ? `${sample.flag} ${sampleCode}` : sampleCode,
  };

  const offsetLabels = OFFSET_LABELS[switcher.position];

  return (
    <div className="space-y-4">
      {settings.languages.length === 0 ? (
        <InfoNote>
          {t(
            "wordpress.reTranslate.switcherNoLanguages",
            "Add a target language and the switcher appears on the front end. With one language there is nothing to switch between, so it stays hidden.",
          )}
        </InfoNote>
      ) : null}

      <SectionCard>
        <CardHeader
          icon={<MapPin className="size-3.5" />}
          title={t("wordpress.reTranslate.switcherWhereTitle", "Where it goes")}
          subtitle={t(
            "wordpress.reTranslate.switcherWhereSubtitle",
            "A pill fixed to a corner of every page",
          )}
        />
        <div className="space-y-4 p-5 sm:p-6">
          <Field>
            <Label htmlFor="re-translate-position">
              {t("wordpress.reTranslate.corner", "Corner")}
            </Label>
            <NativeSelect
              id="re-translate-position"
              className="w-full"
              value={switcher.position}
              onChange={(e) =>
                update({
                  position: e.target.value as ReTranslateSwitcherPosition,
                })
              }
            >
              {SWITCHER_POSITIONS.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {t(
                    `wordpress.reTranslate.position.${value}`,
                    POSITION_LABELS[value],
                  )}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldHint>
              {t(
                "wordpress.reTranslate.cornerHint",
                "Cookie banners, chat bubbles and back-to-top buttons all head for the bottom right. Move the switcher if something is already sitting there.",
              )}
            </FieldHint>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            {SWITCHER_LAYOUTS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={switcher.layout === value}
                onClick={() => update({ layout: value })}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                  switcher.layout === value
                    ? "border-primary/40 bg-primary/5"
                    : "hover:bg-muted/40",
                )}
              >
                <LayoutArt layout={value} />
                <span className="text-sm font-medium">
                  {t(
                    `wordpress.reTranslate.layout.${value}`,
                    LAYOUT_LABELS[value],
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <CardHeader
          icon={<Palette className="size-3.5" />}
          title={t("wordpress.reTranslate.switcherLookTitle", "How it looks")}
          subtitle={t(
            "wordpress.reTranslate.switcherLookSubtitle",
            "Anything you leave alone is inherited from the theme",
          )}
        />
        <div className="space-y-6 p-5 sm:p-6">
          <div className="space-y-4">
            {(["all", "current"] as const).map((group) => (
              <Field key={group}>
                <Label>
                  {group === "all"
                    ? t("wordpress.reTranslate.colorsAll", "Every language")
                    : t("wordpress.reTranslate.colorsCurrent", "The current one")}
                </Label>
                <div className="flex flex-wrap gap-3">
                  {COLOR_GROUPS.filter((c) => c.group === group).map((color) => (
                    <ColorWell
                      key={color.key}
                      id={`re-translate-color-${color.key}`}
                      label={t(
                        `wordpress.reTranslate.color.${color.key}`,
                        color.label,
                      )}
                      value={switcher.colors[color.key]}
                      fallback={color.fallback}
                      inheritedLabel={t(
                        "wordpress.reTranslate.inherited",
                        "Inherited",
                      )}
                      clearLabel={t("wordpress.reTranslate.clear", "Clear")}
                      onChange={(value) => updateColor(color.key, value)}
                    />
                  ))}
                </div>
              </Field>
            ))}
          </div>

          <Field>
            <Label>
              {t("wordpress.reTranslate.shownAs", "Each language shown as")}
            </Label>
            <div className="flex flex-wrap gap-2">
              {SWITCHER_SHOW_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={switcher.show === mode}
                  onClick={() => update({ show: mode })}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    switcher.show === mode
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-muted/60",
                  )}
                >
                  {showExample[mode]}
                </button>
              ))}
            </div>
            <FieldHint>
              {t(
                "wordpress.reTranslate.shownAsHint",
                "Flags only appear on languages you gave one to, and are always announced by name.",
              )}
            </FieldHint>
          </Field>

          <Field>
            <Label>{t("wordpress.reTranslate.radius", "Corner radius")}</Label>
            <LengthSlider
              name="radius"
              label={t("wordpress.reTranslate.radiusLabel", "Radius")}
              switcher={switcher}
              onChange={update}
            />
          </Field>

          <Field>
            <Label>{t("wordpress.reTranslate.padding", "Padding")}</Label>
            <FieldHint>
              {t(
                "wordpress.reTranslate.paddingHint",
                "The room inside each language, around its own text.",
              )}
            </FieldHint>
            <LengthSlider
              name="pad_y"
              label={t("wordpress.reTranslate.padY", "Top and bottom")}
              switcher={switcher}
              onChange={update}
            />
            <LengthSlider
              name="pad_x"
              label={t("wordpress.reTranslate.padX", "Left and right")}
              switcher={switcher}
              onChange={update}
            />
          </Field>

          <Field>
            <Label>
              {t("wordpress.reTranslate.offset", "Distance from the corner")}
            </Label>
            <FieldHint>
              {switcher.position.startsWith("bottom")
                ? t(
                    "wordpress.reTranslate.offsetHintBottom",
                    "Moves the whole switcher across the page. Left alone it lines up with a cookie manager button; raise it if one is sharing this corner.",
                  )
                : t(
                    "wordpress.reTranslate.offsetHintTop",
                    "Moves the whole switcher across the page — for when a sticky header is already sitting where it lands.",
                  )}
            </FieldHint>
            <LengthSlider
              name="offset_y"
              label={t(
                `wordpress.reTranslate.offsetY.${switcher.position}`,
                offsetLabels.y,
              )}
              switcher={switcher}
              onChange={update}
              fallback={offsetFallback(switcher.position)}
            />
            <LengthSlider
              name="offset_x"
              label={t(
                `wordpress.reTranslate.offsetX.${switcher.position}`,
                offsetLabels.x,
              )}
              switcher={switcher}
              onChange={update}
            />
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {t(
                  "wordpress.reTranslate.hideCurrent",
                  "Hide the current language",
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {t(
                  "wordpress.reTranslate.hideCurrentHint",
                  "Show only the languages a visitor can switch to.",
                )}
              </p>
            </div>
            <Switch
              id="re-translate-hide-current"
              checked={switcher.hide_current}
              onCheckedChange={(checked) => update({ hide_current: checked })}
              aria-label={t(
                "wordpress.reTranslate.hideCurrent",
                "Hide the current language",
              )}
            />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function LayoutArt({ layout }: { layout: ReTranslateSwitcherLayout }) {
  if (layout === "dropdown") {
    return (
      <span aria-hidden className="flex w-10 shrink-0 flex-col gap-1">
        <span className="h-2.5 rounded-sm bg-foreground/70" />
        <span className="h-1.5 rounded-sm bg-muted-foreground/30" />
        <span className="h-1.5 rounded-sm bg-muted-foreground/30" />
      </span>
    );
  }
  return (
    <span aria-hidden className="flex w-10 shrink-0 gap-1">
      <span className="h-2.5 flex-1 rounded-sm bg-foreground/70" />
      <span className="h-2.5 flex-1 rounded-sm bg-muted-foreground/30" />
      <span className="h-2.5 flex-1 rounded-sm bg-muted-foreground/30" />
    </span>
  );
}

/**
 * One optional pixel length. Empty means the plugin's own stylesheet default
 * stands, so the slider rests where that lands and the readout says "Default"
 * until the value is actually the site owner's.
 */
function LengthSlider({
  name,
  label,
  switcher,
  onChange,
  fallback,
}: {
  name: SwitcherLengthKey;
  label: string;
  switcher: ReTranslateSwitcher;
  onChange: (patch: Partial<ReTranslateSwitcher>) => void;
  fallback?: number;
}) {
  const { t } = useTranslation();
  const spec = SWITCHER_LENGTHS[name];
  const resting = fallback ?? spec.fallback;
  const stored = switcher[name];
  const set = stored !== "";

  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 text-xs text-muted-foreground">
        {label}
      </span>
      <Slider
        className="min-w-24 flex-1"
        aria-label={label}
        min={0}
        max={spec.sliderMax}
        step={1}
        value={[set ? Number(stored) : resting]}
        onValueChange={([value]) =>
          onChange({ [name]: String(value ?? 0) } as Partial<ReTranslateSwitcher>)
        }
      />
      <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {set ? `${stored}px` : t("wordpress.reTranslate.default", "Default")}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("shrink-0 text-xs", !set && "invisible")}
        onClick={() =>
          onChange({ [name]: "" } as Partial<ReTranslateSwitcher>)
        }
      >
        {t("wordpress.reTranslate.reset", "Reset")}
      </Button>
    </div>
  );
}

/**
 * A colour is picked, not typed: the well is the control, the hex underneath is
 * the readout, and clearing it is one click back to inheriting.
 */
function ColorWell({
  id,
  label,
  value,
  fallback,
  inheritedLabel,
  clearLabel,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  fallback: string;
  inheritedLabel: string;
  clearLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border px-3 py-2">
      <label
        htmlFor={id}
        className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-lg border"
        style={value ? { background: value } : undefined}
      >
        {value ? null : (
          <span
            aria-hidden
            className="absolute inset-0 bg-[repeating-linear-gradient(45deg,var(--color-muted)_0_4px,transparent_4px_8px)]"
          />
        )}
        <input
          id={id}
          type="color"
          value={value || fallback}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <span className="min-w-0">
        <span className="block text-xs font-medium">{label}</span>
        <span className="block font-mono text-[11px] text-muted-foreground">
          {value || inheritedLabel}
        </span>
      </span>
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={`${clearLabel} ${label}`}
          className="shrink-0 rounded-md px-1.5 text-sm leading-none text-muted-foreground hover:text-foreground"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
