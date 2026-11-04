import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { iconSvg } from "./icons";
import {
  DEFAULTS,
  LAUNCHER_ICONS,
  contrastRatio,
  type PatchSettings,
  type ReAccessibilityLauncherIcon,
  type ReAccessibilitySettings,
} from "./settings";

/**
 * The launcher icons as a radio group of swatches drawn in the chosen colors
 * and shape (`radius` as a share of the button's size, 0–0.5).
 */
export function IconPicker({
  value,
  onChange,
  background,
  ink,
  radius,
}: {
  value: ReAccessibilityLauncherIcon;
  onChange: (icon: ReAccessibilityLauncherIcon) => void;
  background: string;
  ink: string;
  radius: number;
}) {
  const { t } = useTranslation();
  const names: Record<ReAccessibilityLauncherIcon, string> = {
    access: t("wordpress.reAccessibility.iconAccess", "Person"),
    "access-ring": t("wordpress.reAccessibility.iconAccessRing", "Person in a circle"),
    wheelchair: t("wordpress.reAccessibility.iconWheelchair", "Wheelchair"),
    eye: t("wordpress.reAccessibility.iconEye", "Eye"),
    sliders: t("wordpress.reAccessibility.iconSliders", "Sliders"),
    contrast: t("wordpress.reAccessibility.iconContrast", "Contrast"),
    text: t("wordpress.reAccessibility.iconText", "Text size"),
    heart: t("wordpress.reAccessibility.iconHeart", "Heart"),
  };

  return (
    <div
      role="radiogroup"
      aria-label={t("wordpress.reAccessibility.icon", "Icon")}
      className="grid grid-cols-4 gap-2"
    >
      {LAUNCHER_ICONS.map((icon) => {
        const selected = icon === value;
        return (
          <button
            key={icon}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={names[icon]}
            title={names[icon]}
            onClick={() => onChange(icon)}
            className={cn(
              "flex h-16 items-center justify-center rounded-xl border bg-card transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              selected
                ? "border-foreground ring-1 ring-foreground"
                : "hover:border-foreground/30",
            )}
          >
            <span
              aria-hidden
              className="flex size-10 items-center justify-center [&_svg]:size-6"
              style={{
                background,
                color: ink,
                borderRadius: `${Math.min(0.5, Math.max(0, radius)) * 100}%`,
              }}
              // Our own static SVG (icons.ts), never user input.
              dangerouslySetInnerHTML={{ __html: iconSvg(icon) }}
            />
          </button>
        );
      })}
    </div>
  );
}

/**
 * Warns when two colors are too close to read: `min` is the WCAG ratio the
 * pair needs (4.5 for text, 3 for icons and borders). Silent while a color
 * is half-typed.
 */
export function ContrastNote({
  foreground,
  background,
  min,
  children,
}: {
  foreground: string;
  background: string;
  min: number;
  children: ReactNode;
}) {
  const ratio = contrastRatio(foreground, background);
  if (ratio === null || ratio >= min) return null;

  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
    >
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>
        {children}{" "}
        <span className="tabular-nums">({ratio.toFixed(1)}:1)</span>
      </span>
    </p>
  );
}

/**
 * A labelled group of fields inside a card. Kept here rather than imported
 * from re-cookie/fields, which shtemaran's copy doesn't carry.
 */
export function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </h3>
      {children}
    </section>
  );
}

/** Puts the given settings back to how re:accessibility looks out of the box. */
export function ResetDesign({
  keys,
  patch,
  label,
}: {
  keys: readonly (keyof ReAccessibilitySettings)[];
  patch: PatchSettings;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-muted-foreground"
      onClick={() =>
        patch((prev) => {
          const next = { ...prev };
          for (const key of keys) {
            (next as Record<string, unknown>)[key] = DEFAULTS[key];
          }
          return next;
        })
      }
    >
      <RotateCcw className="size-3.5" />
      {label}
    </Button>
  );
}
