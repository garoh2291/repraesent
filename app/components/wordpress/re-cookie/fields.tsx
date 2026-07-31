import React from "react";
import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Slider } from "~/components/ui/slider";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { cn } from "~/lib/utils";
import type { ReCookieNamedScript } from "~/lib/wordpress/plugin-settings-types";
import { PageShell as SharedPageShell } from "~/components/wordpress/fields";

/**
 * Controls specific to the re:cookie admin. The screen is a design tool, so its
 * inputs (swatches, segmented pickers, sliders, script repeaters) are heavier
 * than the plain label-over-input stack the other plugin pages use.
 *
 * The layout chrome it shares with every other plugin screen — SectionCard,
 * CardHeader, Field, FieldHint, ToggleField — lives in
 * `~/components/wordpress/fields`. It used to be duplicated here, and the two
 * copies had already drifted apart.
 */

export {
  CardBody,
  CardHeader,
  Field,
  FieldHint,
  InfoNote,
  SectionCard,
  ToggleField,
} from "~/components/wordpress/fields";

/** Same shell width as every other plugin settings screen; sections own their spacing. */
export function PageShell(
  props: Omit<React.ComponentProps<typeof SharedPageShell>, "width" | "spaced">,
) {
  return <SharedPageShell {...props} width="md" spaced={false} />;
}

export function FieldGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <h3 className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </h3>
      {children}
    </section>
  );
}

/**
 * A switch on a bordered row, with the label as the click target and room for a
 * description. Replaces the old bare `ToggleField` — a checkbox floating in a
 * column of text fields read as an afterthought.
 */
export function SwitchRow({
  id,
  checked,
  onChange,
  label,
  description,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-xl border px-4 py-3 transition-colors",
        checked ? "border-primary/30 bg-primary/[0.03]" : "bg-card",
      )}
    >
      <div className="min-w-0">
        <Label htmlFor={id} className="font-medium">
          {label}
        </Label>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="shrink-0"
      />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={ariaLabel}
      className={cn(
        "w-fit gap-1 rounded-xl border bg-muted/40 p-1 shadow-none",
        className,
      )}
    >
      {options.map((opt) => (
        <ToggleGroupItem
          key={opt.value}
          value={opt.value}
          aria-label={opt.label}
          className={cn(
            "gap-1.5 rounded-lg border-0 px-3 text-sm font-medium text-muted-foreground",
            "data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-xs",
          )}
        >
          {opt.icon}
          {opt.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Colour swatch + hex input. The native picker only accepts a valid hex, so a
 * half-typed value in the text field falls back to the placeholder for the
 * swatch instead of resetting what the user is typing.
 */
export function ColorField({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const swatch = HEX.test(value) ? value : placeholder;
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-2.5 transition-colors focus-within:border-ring">
      <div className="relative size-9 shrink-0">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg border shadow-xs"
          style={{ background: swatch }}
        />
        <input
          type="color"
          id={`${id}-picker`}
          aria-label={label}
          value={swatch}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </div>
      <div className="min-w-0 flex-1">
        <Label
          htmlFor={id}
          className="text-xs font-medium text-muted-foreground"
        >
          {label}
        </Label>
        <Input
          type="text"
          id={id}
          value={value}
          placeholder={placeholder}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 border-0 bg-transparent px-0 py-0 font-mono text-sm uppercase shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </div>
    </div>
  );
}

/** Slider bound to a number input, for values with a sensible range. */
export function SliderField({
  id,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
}: {
  id: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) {
  const clamped = Number.isFinite(value) ? Math.min(Math.max(value, min), max) : min;
  return (
    <div className="flex items-center gap-4">
      <Slider
        id={id}
        value={[clamped]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className="flex-1"
      />
      <div className="flex items-center gap-1.5 rounded-lg border bg-muted/40 px-2.5 py-1">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-12 bg-transparent text-right text-sm tabular-nums outline-none"
          aria-label={unit ? `${id} (${unit})` : id}
        />
        {unit ? (
          <span className="text-xs text-muted-foreground">{unit}</span>
        ) : null}
      </div>
    </div>
  );
}

export function NamedScriptsRepeater({
  items,
  onChange,
}: {
  items: ReCookieNamedScript[];
  onChange: (items: ReCookieNamedScript[]) => void;
}) {
  const { t } = useTranslation();

  function update(idx: number, field: "name" | "script", val: string) {
    onChange(items.map((it, i) => (i === idx ? { ...it, [field]: val } : it)));
  }
  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...items, { name: "", script: "" }]);
  }

  return (
    <div className="space-y-2.5">
      {items.map((item, idx) => (
        <div key={idx} className="rounded-xl border bg-muted/30 p-3">
          <div className="mb-2.5 flex items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 font-mono text-xs font-bold text-primary">
              {idx + 1}
            </span>
            <Input
              type="text"
              placeholder={t(
                "wordpress.reCookie.scriptNamePlaceholder",
                "Script name",
              )}
              value={item.name}
              onChange={(e) => update(idx, "name", e.target.value)}
              className="h-8 flex-1 bg-card"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => remove(idx)}
              aria-label={t("wordpress.reCookie.removeScript", "Remove script")}
            >
              <X className="size-4" />
            </Button>
          </div>
          <Textarea
            placeholder="<script>…</script>"
            value={item.script}
            onChange={(e) => update(idx, "script", e.target.value)}
            className="min-h-[72px] bg-card font-mono text-xs"
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full border-dashed text-muted-foreground"
        onClick={add}
      >
        <Plus className="size-4" />
        {t("wordpress.reCookie.addScript", "Add script")}
      </Button>
    </div>
  );
}
