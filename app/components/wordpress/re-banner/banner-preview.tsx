import { cn } from "~/lib/utils";
import type { ReBannerConfig } from "~/lib/wordpress/plugin-settings-types";

/**
 * A miniature of what the banner will look like on the site.
 *
 * This is a re-drawing rather than the plugin's own markup — the dashboard
 * cannot load a customer site's stylesheet — so it is deliberately restrained:
 * it shows the content slots, the colours and the shape of each variant, and
 * makes no promise about typography or exact spacing. The authoritative
 * preview is the one in wp-admin, which renders the real markup with the real
 * stylesheet.
 */
export function BannerPreview({
  config,
  imageUrl,
}: {
  config: ReBannerConfig;
  imageUrl: string | null;
}) {
  const title = config.title.trim();
  const description = config.description.trim();
  const ctaLabel = config.cta_label.trim();

  const surface = {
    backgroundColor: config.bg_color || "#0a0a0a",
    color: config.text_color || "#ffffff",
  };

  const cta = {
    backgroundColor: config.accent_color || "#ffffff",
    color: config.bg_color || "#0a0a0a",
  };

  const body = (
    <div className="min-w-0 flex-1">
      {title ? (
        <p className="truncate text-sm font-semibold">{title}</p>
      ) : null}
      {description ? (
        <p className="mt-0.5 line-clamp-2 text-xs opacity-80">{description}</p>
      ) : null}
      {!title && !description ? (
        <p className="text-xs opacity-50">No content yet</p>
      ) : null}
    </div>
  );

  const button = ctaLabel ? (
    <span
      className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold"
      style={cta}
    >
      {ctaLabel}
    </span>
  ) : null;

  const image = imageUrl ? (
    <img
      src={imageUrl}
      alt=""
      className={cn(
        "shrink-0 object-cover",
        config.variant === "floating"
          ? "h-16 w-full rounded-md"
          : config.variant === "card"
            ? "size-12 rounded-md"
            : "size-8 rounded-full",
      )}
    />
  ) : null;

  return (
    <div className="relative flex min-h-40 flex-col justify-between overflow-hidden rounded-xl border bg-muted/40 p-3">
      {/* The page the banner sits on, suggested rather than drawn. */}
      <div className="pointer-events-none absolute inset-x-6 top-1/2 -translate-y-1/2 space-y-2 opacity-40">
        <div className="h-2 w-2/3 rounded bg-foreground/15" />
        <div className="h-2 w-1/2 rounded bg-foreground/15" />
        <div className="h-2 w-3/5 rounded bg-foreground/15" />
      </div>

      {config.variant === "hero" ? (
        <div
          className="relative z-10 flex flex-col items-center gap-1.5 rounded-lg px-4 py-6 text-center"
          style={surface}
        >
          {image}
          {body}
          {button}
        </div>
      ) : (
        <div
          className={cn(
            "relative z-10 flex items-center gap-3 rounded-lg px-3 py-2.5",
            config.variant === "card" && "mx-auto w-11/12",
            config.variant === "floating" &&
              "ml-auto w-3/5 flex-col items-stretch text-left",
            config.position === "bottom" ? "order-last mt-auto" : "mb-auto",
          )}
          style={surface}
        >
          {image}
          {body}
          {button}
          {config.dismissible ? (
            <span className="shrink-0 text-sm opacity-50">×</span>
          ) : null}
        </div>
      )}
    </div>
  );
}
