import TooltipContainer from "~/components/tooltip-container";
import { cn } from "~/lib/utils";

// Icons live in /public/icons — reference by URL (Vite serves /public as root)
const appointmentIcon = "/icons/appointment.svg";
const facebookIcon = "/icons/facebook.svg";
const googleIcon = "/icons/google.svg";
const instagramIcon = "/icons/instagram.svg";
const websiteIcon = "/icons/website.svg";

type SourceKind =
  | "appointment"
  | "facebook"
  | "google"
  | "instagram"
  | "website"
  | "unknown";

/**
 * Resolve a raw source string (from `lead.source_label` or `lead.source_table`)
 * into one of our known icon kinds.
 */
function resolveSourceKind(raw: string | null | undefined): SourceKind {
  if (!raw) return "unknown";
  const s = raw.toLowerCase();

  if (s === "appointment_booking" || s.includes("appointment")) {
    return "appointment";
  }
  if (s === "fb" || s.includes("facebook")) return "facebook";
  if (s === "ig" || s.includes("instagram")) return "instagram";
  if (s.includes("google")) return "google";
  // Default: any URL or the literal "urls" maps to the website icon
  if (
    s === "urls" ||
    s === "website" ||
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.includes(".")
  ) {
    return "website";
  }
  return "unknown";
}

const ICON_MAP: Record<Exclude<SourceKind, "unknown">, string> = {
  appointment: appointmentIcon,
  facebook: facebookIcon,
  google: googleIcon,
  instagram: instagramIcon,
  website: websiteIcon,
};

export interface LeadSourceIconProps {
  /** Raw source — try source_label first, fall back to source_table */
  source: string | null | undefined;
  /** Optional second source used as fallback if first is null */
  fallbackSource?: string | null;
  /**
   * Direct platform override (e.g. "facebook", "google").
   * When provided, skips string-based resolution and uses this directly.
   * Use for campaign leads where source_label is a campaign name, not a URL.
   */
  platform?: string | null;
  className?: string;
  size?: number;
}

/**
 * Renders an icon for a lead's source with a tooltip showing the raw label.
 * Falls back to an em-dash when source is null/unknown.
 */
export function LeadSourceIcon({
  source,
  fallbackSource,
  platform,
  className,
  size = 18,
}: LeadSourceIconProps) {
  const resolved = source ?? fallbackSource ?? null;
  // platform prop takes precedence — used when source_label is a campaign name
  const kind = platform ? resolveSourceKind(platform) : resolveSourceKind(resolved);
  const tooltipLabel = resolved ?? "—";

  if (kind === "unknown") {
    return (
      <TooltipContainer tooltipContent={tooltipLabel} showCopyButton={false}>
        <span
          className={cn(
            "inline-flex items-center justify-center text-muted-foreground/50",
            className,
          )}
          style={{ width: size, height: size }}
        >
          —
        </span>
      </TooltipContainer>
    );
  }

  return (
    <TooltipContainer tooltipContent={tooltipLabel} showCopyButton={false}>
      <span
        className={cn(
          "inline-flex items-center justify-center shrink-0",
          className,
        )}
        style={{ width: size, height: size }}
      >
        <img
          src={ICON_MAP[kind]}
          alt={kind}
          width={size}
          height={size}
          className="object-contain"
          draggable={false}
        />
      </span>
    </TooltipContainer>
  );
}
