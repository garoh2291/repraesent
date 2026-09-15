import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link2, Link2Off } from "lucide-react";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import {
  REBNR_SIDES,
  REBNR_STYLE_RANGES,
  type ReBannerSide,
} from "~/lib/wordpress/re-banner-styles";

const SIDE_I18N: Record<(typeof REBNR_SIDES)[number], [string, string]> = {
  top: ["wordpress.reBanner.sides.top", "Top"],
  right: ["wordpress.reBanner.sides.right", "Right"],
  bottom: ["wordpress.reBanner.sides.bottom", "Bottom"],
  left: ["wordpress.reBanner.sides.left", "Left"],
};

/**
 * Four per-side pixel inputs for a margin or padding.
 *
 * An empty box is an *unset* side, not zero — the plugin only writes the sides
 * that were set, so the theme's value survives on the others. "Link" writes
 * one number into all four, the way design tools do, and unlinks the moment a
 * side is edited on its own.
 */
export function SideInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: ReBannerSide | undefined;
  onChange: (next: ReBannerSide | undefined) => void;
}) {
  const { t } = useTranslation();
  const [linked, setLinked] = useState(false);
  const [min, max] = REBNR_STYLE_RANGES.side;
  const sides = value ?? {};
  const isSet = Object.keys(sides).length > 0;

  function update(side: (typeof REBNR_SIDES)[number], raw: string) {
    const next: ReBannerSide = { ...sides };
    const n = raw === "" ? undefined : Number(raw);
    const targets = linked ? REBNR_SIDES : [side];
    for (const s of targets) {
      if (n === undefined || !Number.isFinite(n)) delete next[s];
      else next[s] = Math.max(min, Math.min(max, Math.round(n)));
    }
    onChange(Object.keys(next).length > 0 ? next : undefined);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium text-muted-foreground">
          {label}
          {isSet ? (
            <span className="ml-1.5 inline-block size-1.5 rounded-full bg-primary align-middle" aria-hidden />
          ) : null}
        </Label>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-pressed={linked}
            aria-label={t("wordpress.reBanner.linkSides", "Link all sides")}
            onClick={() => setLinked((v) => !v)}
            className={cn(linked && "bg-muted text-foreground")}
          >
            {linked ? <Link2 className="size-3.5" aria-hidden /> : <Link2Off className="size-3.5" aria-hidden />}
          </Button>
          {isSet ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => onChange(undefined)}
              className="text-muted-foreground"
            >
              {t("wordpress.reBanner.reset", "Reset")}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {REBNR_SIDES.map((side) => (
          <label key={side} className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t(SIDE_I18N[side][0], SIDE_I18N[side][1])}
            </span>
            <span className="flex items-center rounded-md border bg-transparent px-1.5 focus-within:border-ring">
              <input
                id={`${id}-${side}`}
                type="number"
                inputMode="numeric"
                min={min}
                max={max}
                step={1}
                placeholder="–"
                value={sides[side] ?? ""}
                onChange={(e) => update(side, e.target.value)}
                className="h-7 w-full min-w-0 bg-transparent text-right text-sm tabular-nums outline-none placeholder:text-muted-foreground/60"
              />
              <span className="pl-0.5 text-[10px] text-muted-foreground">px</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
