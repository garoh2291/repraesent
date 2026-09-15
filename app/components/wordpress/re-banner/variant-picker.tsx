import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import type { ReBannerVariant } from "~/lib/wordpress/plugin-settings-types";
import { cn } from "~/lib/utils";

/**
 * The five layouts as tiles, each with a thumbnail of the shape it makes on
 * a page. A dropdown of "Bar — full-width strip" asks the reader to imagine
 * five layouts from five phrases; a row of little pages shows them.
 */
const TILES: {
  key: ReBannerVariant;
  i18n: string;
  fallback: string;
  hintI18n: string;
  hint: string;
}[] = [
  {
    key: "bar",
    i18n: "wordpress.reBanner.variantTiles.bar",
    fallback: "Bar",
    hintI18n: "wordpress.reBanner.variantTiles.barHint",
    hint: "Full-width strip pinned to the edge",
  },
  {
    key: "card",
    i18n: "wordpress.reBanner.variantTiles.card",
    fallback: "Card",
    hintI18n: "wordpress.reBanner.variantTiles.cardHint",
    hint: "Centred panel in the page",
  },
  {
    key: "hero",
    i18n: "wordpress.reBanner.variantTiles.hero",
    fallback: "Hero",
    hintI18n: "wordpress.reBanner.variantTiles.heroHint",
    hint: "Full-width band, image behind",
  },
  {
    key: "floating",
    i18n: "wordpress.reBanner.variantTiles.floating",
    fallback: "Floating",
    hintI18n: "wordpress.reBanner.variantTiles.floatingHint",
    hint: "Small card in a corner",
  },
  {
    key: "text",
    i18n: "wordpress.reBanner.variantTiles.text",
    fallback: "Text",
    hintI18n: "wordpress.reBanner.variantTiles.textHint",
    hint: "No box — inherits your theme",
  },
];

export function VariantPicker({
  value,
  onChange,
  disabled,
}: {
  value: ReBannerVariant;
  onChange: (variant: ReBannerVariant) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div
      role="radiogroup"
      aria-label={t("wordpress.reBanner.variant", "Layout")}
      className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5"
    >
      {TILES.map((tile) => {
        const active = tile.key === value;
        return (
          <button
            key={tile.key}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(tile.key)}
            className={cn(
              "group relative flex flex-col gap-2 rounded-xl border p-2 text-left transition-all",
              "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              active
                ? "border-foreground bg-card shadow-sm"
                : "border-border bg-card hover:border-foreground/40",
              disabled && "pointer-events-none opacity-60",
            )}
          >
            <Thumb variant={tile.key} active={active} />
            <span className="px-0.5 pb-0.5">
              <span className="block text-sm font-semibold leading-tight tracking-tight">
                {t(tile.i18n, tile.fallback)}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                {t(tile.hintI18n, tile.hint)}
              </span>
            </span>
            {active ? (
              <span className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-foreground text-background">
                <Check className="size-2.5" strokeWidth={3} aria-hidden />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A 4:3 page with the banner's silhouette on it. Everything is a plain div
 * so the tiles cost nothing and pick up the theme's tokens.
 */
function Thumb({ variant, active }: { variant: ReBannerVariant; active: boolean }) {
  const ink = active ? "bg-foreground" : "bg-foreground/70 group-hover:bg-foreground";
  const line = "bg-foreground/15";

  return (
    <span
      aria-hidden
      className="relative block aspect-[4/3] w-full overflow-hidden rounded-lg border border-border/70 bg-muted/40"
    >
      {/* Page furniture */}
      <span className={cn("absolute left-2 top-2 h-1 w-4 rounded-sm", line)} />
      <span className={cn("absolute right-2 top-2 h-1 w-6 rounded-sm", line)} />

      {variant === "bar" ? (
        <>
          <span className={cn("absolute inset-x-0 top-0 h-[22%]", ink)}>
            <span className="absolute left-[10%] top-1/2 h-[3px] w-[30%] -translate-y-1/2 rounded-sm bg-background/90" />
            <span className="absolute right-[8%] top-1/2 h-[6px] w-[18%] -translate-y-1/2 rounded-full bg-background/90" />
          </span>
          <span className={cn("absolute left-2 top-[34%] h-1.5 w-[45%] rounded-sm", line)} />
          <span className={cn("absolute left-2 top-[50%] h-1 w-[70%] rounded-sm", line)} />
          <span className={cn("absolute left-2 top-[62%] h-1 w-[60%] rounded-sm", line)} />
        </>
      ) : null}

      {variant === "card" ? (
        <>
          <span className={cn("absolute left-2 top-[22%] h-1.5 w-[45%] rounded-sm", line)} />
          <span className={cn("absolute left-[16%] right-[16%] top-[36%] h-[34%] rounded-md", ink)}>
            <span className="absolute left-[10%] top-[26%] h-[3px] w-[45%] rounded-sm bg-background/90" />
            <span className="absolute left-[10%] top-[52%] h-[2px] w-[60%] rounded-sm bg-background/60" />
            <span className="absolute right-[8%] top-1/2 h-[6px] w-[20%] -translate-y-1/2 rounded-full bg-background/90" />
          </span>
          <span className={cn("absolute left-2 top-[80%] h-1 w-[70%] rounded-sm", line)} />
        </>
      ) : null}

      {variant === "hero" ? (
        <>
          <span className={cn("absolute inset-x-0 top-0 h-[56%]", ink)}>
            <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,.28),transparent_55%)]" />
            <span className="absolute left-1/2 top-[30%] h-[4px] w-[46%] -translate-x-1/2 rounded-sm bg-background/90" />
            <span className="absolute left-1/2 top-[50%] h-[2px] w-[60%] -translate-x-1/2 rounded-sm bg-background/60" />
            <span className="absolute left-1/2 top-[68%] h-[6px] w-[22%] -translate-x-1/2 rounded-full bg-background/90" />
          </span>
          <span className={cn("absolute left-2 top-[66%] h-1.5 w-[45%] rounded-sm", line)} />
          <span className={cn("absolute left-2 top-[80%] h-1 w-[70%] rounded-sm", line)} />
        </>
      ) : null}

      {variant === "floating" ? (
        <>
          <span className={cn("absolute left-2 top-[22%] h-1.5 w-[45%] rounded-sm", line)} />
          <span className={cn("absolute left-2 top-[38%] h-1 w-[70%] rounded-sm", line)} />
          <span className={cn("absolute left-2 top-[50%] h-1 w-[60%] rounded-sm", line)} />
          <span className={cn("absolute bottom-2 right-2 h-[40%] w-[42%] rounded-md shadow-md", ink)}>
            <span className="absolute left-[12%] top-[22%] h-[3px] w-[60%] rounded-sm bg-background/90" />
            <span className="absolute left-[12%] top-[44%] h-[2px] w-[70%] rounded-sm bg-background/60" />
            <span className="absolute inset-x-[12%] bottom-[14%] h-[5px] rounded-full bg-background/90" />
          </span>
        </>
      ) : null}

      {variant === "text" ? (
        <>
          <span className={cn("absolute left-2 top-[22%] h-1.5 w-[30%] rounded-sm", line)} />
          <span
            className={cn(
              "absolute left-[36%] top-[19%] h-2.5 w-[38%] rounded-sm",
              active ? "bg-foreground" : "bg-foreground/70 group-hover:bg-foreground",
            )}
          />
          <span className={cn("absolute left-2 top-[42%] h-1 w-[70%] rounded-sm", line)} />
          <span className={cn("absolute left-2 top-[54%] h-1 w-[80%] rounded-sm", line)} />
          <span className={cn("absolute left-2 top-[66%] h-1 w-[55%] rounded-sm", line)} />
          <span className="absolute bottom-1.5 right-2 font-serif text-[13px] italic leading-none text-foreground/70">
            Aa
          </span>
        </>
      ) : null}
    </span>
  );
}
