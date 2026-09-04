import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CircleHelp, MessageCircle, Send, Sparkles } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  resolveWidgetStrings,
  withAppearanceDefaults,
  type AiLocale,
  type AppearanceConfig,
  type PersonaConfig,
  type WidgetType,
} from "~/lib/api/ai-assistants";

interface Props {
  widgetType: WidgetType;
  businessName: string;
  persona: PersonaConfig;
  appearance: AppearanceConfig;
  locale: AiLocale;
  className?: string;
}

/** Perceived luminance → white or near-black text on the accent. */
function onColor(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return l > 0.6 ? "#111111" : "#ffffff";
}

const RADIUS: Record<
  AppearanceConfig["radius"],
  { panel: number; bubble: number; field: number }
> = {
  sm: { panel: 6, bubble: 6, field: 6 },
  md: { panel: 12, bubble: 10, field: 8 },
  lg: { panel: 18, bubble: 16, field: 12 },
  pill: { panel: 24, bubble: 20, field: 999 },
};
const FONT: Record<AppearanceConfig["font"], string> = {
  system:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  inherit: "inherit",
  geist: "Geist, -apple-system, BlinkMacSystemFont, sans-serif",
};
const LAUNCHER_PX: Record<AppearanceConfig["launcher_size"], number> = {
  sm: 44,
  md: 52,
  lg: 60,
};

/**
 * The widget, re-rendered in React from the draft. Not the real embed script
 * — the point is that every keystroke in the Appearance form shows up here
 * before it is saved, which the iframe/script embed cannot do.
 */
export function WidgetPreview({
  widgetType,
  businessName,
  persona,
  appearance: rawAppearance,
  locale,
  className,
}: Props) {
  const { t } = useTranslation();
  const appearance = useMemo(
    () => withAppearanceDefaults(rawAppearance),
    [rawAppearance],
  );
  const strings = useMemo(
    () => resolveWidgetStrings(appearance, locale),
    [appearance, locale],
  );
  const accent = /^#[0-9a-f]{6}$/i.test(appearance.primary_color)
    ? appearance.primary_color
    : "#111111";
  const accentText = onColor(accent);
  const dark =
    appearance.theme === "dark" ||
    (appearance.theme === "auto" &&
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches);

  const surface = dark
    ? {
        bg: "#141416",
        fg: "#f4f4f5",
        muted: "#a1a1aa",
        line: "#27272a",
        field: "#1c1c1f",
      }
    : {
        bg: "#ffffff",
        fg: "#111111",
        muted: "#6b7280",
        line: "#e5e7eb",
        field: "#f5f5f7",
      };
  const r = RADIUS[appearance.radius];
  const compact = appearance.density === "compact";
  const fontFamily = FONT[appearance.font];
  const textSize = compact ? "text-[11px]" : "text-xs";
  const pad = compact ? "px-3 py-2" : "px-3.5 py-3";

  const greeting = persona.greeting.trim() || strings.greeting;
  const launcher = appearance.launcher_label?.trim() || strings.launcher_label;
  const subtitle =
    appearance.header_subtitle?.trim() || strings.header_subtitle;
  const initial = (persona.display_name || businessName || "A")
    .trim()
    .charAt(0)
    .toUpperCase();

  const headerBg =
    appearance.header_style === "gradient"
      ? `linear-gradient(135deg, ${accent} 0%, ${accent}bb 100%)`
      : appearance.header_style === "minimal"
        ? surface.bg
        : accent;
  const headerFg =
    appearance.header_style === "minimal" ? surface.fg : accentText;

  const avatarImg =
    appearance.avatar_mode === "image" && appearance.avatar_url ? (
      <img
        src={appearance.avatar_url}
        alt=""
        className="h-full w-full rounded-full object-cover"
      />
    ) : (
      initial
    );

  const avatar = (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold"
      style={{ background: accent, color: accentText }}
    >
      {avatarImg}
    </span>
  );

  const header = (
    <div
      className={cn("flex items-center gap-2.5", pad)}
      style={{
        background: headerBg,
        color: headerFg,
        borderBottom:
          appearance.header_style === "minimal"
            ? `1px solid ${surface.line}`
            : undefined,
      }}
    >
      <span
        aria-hidden
        className="flex size-8 items-center justify-center overflow-hidden rounded-full text-sm font-semibold"
        style={{
          background:
            appearance.header_style === "minimal"
              ? accent
              : "rgba(255,255,255,0.18)",
          color: appearance.header_style === "minimal" ? accentText : undefined,
        }}
      >
        {avatarImg}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight">
          {persona.display_name || businessName}
        </p>
        <p className="truncate text-[11px] leading-tight opacity-80">
          {subtitle}
        </p>
      </div>
    </div>
  );

  const chips =
    persona.suggested_questions.length > 0 ? (
      <div className="flex flex-wrap gap-1.5">
        {persona.suggested_questions.map((q, i) => (
          <span
            key={`${q}-${i}`}
            className={cn("border px-2.5 py-1 leading-none", textSize)}
            style={{
              borderColor: surface.line,
              color: surface.fg,
              borderRadius: r.field,
            }}
          >
            {q}
          </span>
        ))}
      </div>
    ) : null;

  const composer = (placeholder = strings.placeholder) => (
    <div
      className={cn(
        "flex items-center gap-2",
        compact ? "px-2.5 py-1.5" : "px-3 py-2",
      )}
      style={{ background: surface.field, borderRadius: r.field }}
    >
      <span
        className={cn("flex-1 truncate", textSize)}
        style={{ color: surface.muted }}
      >
        {placeholder}
      </span>
      <span
        aria-label={strings.send}
        className="flex size-6 items-center justify-center"
        style={{
          background: accent,
          color: accentText,
          borderRadius: Math.min(r.field, 8),
        }}
      >
        <Send className="h-3 w-3" />
      </span>
    </div>
  );

  const poweredBy = appearance.show_powered_by ? (
    <p className="text-center text-[10px]" style={{ color: surface.muted }}>
      {strings.powered_by}
    </p>
  ) : null;

  const assistantBubble = (
    <div className="flex items-end gap-2">
      {avatar}
      <div
        className={cn(
          "max-w-[85%] leading-relaxed",
          textSize,
          compact ? "px-2.5 py-1.5" : "px-3 py-2",
        )}
        style={{
          background: surface.field,
          color: surface.fg,
          borderRadius: r.bubble,
          borderBottomLeftRadius: Math.min(r.bubble, 6),
        }}
      >
        {greeting}
      </div>
    </div>
  );

  const frame = (children: React.ReactNode, style?: React.CSSProperties) => (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border",
        className,
      )}
      style={{ fontFamily, ...style }}
      aria-label={t("aiAssistants.appearance.previewLabel")}
    >
      {children}
    </div>
  );

  // --- bubble ---------------------------------------------------------------
  if (widgetType === "bubble") {
    const size = LAUNCHER_PX[appearance.launcher_size];
    const nudgeText = appearance.nudge.text.trim() || strings.nudge_text;
    const left = appearance.position === "left";
    const launcherIcon =
      appearance.launcher_icon === "image" && appearance.launcher_image_url ? (
        <img
          src={appearance.launcher_image_url}
          alt=""
          className="h-full w-full rounded-full object-cover"
        />
      ) : appearance.launcher_icon === "sparkle" ? (
        <Sparkles className="h-5 w-5" />
      ) : appearance.launcher_icon === "question" ? (
        <CircleHelp className="h-5 w-5" />
      ) : (
        <MessageCircle className="h-5 w-5" />
      );

    return frame(
      <div
        className="relative"
        style={{
          background: dark
            ? "linear-gradient(180deg,#0f0f11 0%,#1a1a1d 100%)"
            : "linear-gradient(180deg,#f3f4f6 0%,#e9eaee 100%)",
          minHeight: 480,
        }}
      >
        <div
          aria-hidden
          className="absolute inset-x-6 top-6 space-y-2 opacity-40"
        >
          <div
            className="h-3 w-32 rounded"
            style={{ background: surface.muted }}
          />
          <div
            className="h-2 w-64 rounded"
            style={{ background: surface.line }}
          />
          <div
            className="h-2 w-52 rounded"
            style={{ background: surface.line }}
          />
        </div>

        <div
          className={cn(
            "absolute flex w-[300px] max-w-[calc(100%-2rem)] flex-col gap-3",
            left ? "items-start" : "items-end",
          )}
          style={{
            bottom: Math.min(appearance.offset_y, 40),
            [left ? "left" : "right"]: Math.min(appearance.offset_x, 40),
          }}
        >
          <div
            className="flex w-full flex-col overflow-hidden shadow-[0_24px_48px_-20px_rgba(0,0,0,0.5)]"
            style={{
              background: surface.bg,
              border: `1px solid ${surface.line}`,
              borderRadius: r.panel,
            }}
          >
            {header}
            <div className={cn("space-y-3", pad)}>
              {assistantBubble}
              {chips}
            </div>
            <div className={cn("space-y-2 pb-3", compact ? "px-3" : "px-3.5")}>
              {composer()}
              {poweredBy}
            </div>
          </div>

          <div
            className={cn(
              "flex items-end gap-2",
              left ? "flex-row" : "flex-row-reverse",
            )}
          >
            <span
              className="flex shrink-0 items-center justify-center overflow-hidden rounded-full shadow-lg"
              style={{
                background: accent,
                color: accentText,
                width: size,
                height: size,
              }}
              title={launcher}
            >
              {launcherIcon}
            </span>
            {appearance.nudge.enabled ? (
              <span
                className={cn("max-w-[200px] px-3 py-2 shadow-md", textSize)}
                style={{
                  background: surface.bg,
                  color: surface.fg,
                  border: `1px solid ${surface.line}`,
                  borderRadius: r.bubble,
                }}
              >
                {nudgeText}
              </span>
            ) : (
              <span
                className={cn("pb-1", textSize)}
                style={{ color: surface.muted }}
              >
                {launcher}
              </span>
            )}
          </div>
        </div>
      </div>,
    );
  }

  // --- bar ------------------------------------------------------------------
  if (widgetType === "bar") {
    return frame(
      <div
        className="space-y-4 px-6 py-8"
        style={{ background: surface.bg, minHeight: 300 }}
      >
        <div aria-hidden className="space-y-2 opacity-40">
          <div
            className="h-3 w-40 rounded"
            style={{ background: surface.muted }}
          />
          <div
            className="h-2 w-full rounded"
            style={{ background: surface.line }}
          />
        </div>
        <div
          className={cn(
            "flex items-center gap-2 shadow-sm",
            compact ? "px-3 py-2" : "px-4 py-3",
          )}
          style={{
            border: `1px solid ${surface.line}`,
            borderRadius: r.field,
            background: surface.bg,
          }}
        >
          <Sparkles
            className="h-4 w-4 shrink-0"
            style={{ color: accent }}
            aria-hidden
          />
          <span
            className="flex-1 truncate text-sm"
            style={{ color: surface.muted }}
          >
            {strings.bar_placeholder}
          </span>
          <span
            className="flex size-7 items-center justify-center"
            style={{
              background: accent,
              color: accentText,
              borderRadius: Math.min(r.field, 8),
            }}
          >
            <Send className="h-3.5 w-3.5" />
          </span>
        </div>
        <div
          className="space-y-3 p-3"
          style={{
            border: `1px dashed ${surface.line}`,
            borderRadius: r.panel,
          }}
        >
          <p
            className="text-[10px] uppercase tracking-widest"
            style={{ color: surface.muted }}
          >
            {t("aiAssistants.appearance.barExpands")}
          </p>
          {assistantBubble}
          {chips}
        </div>
        {poweredBy}
      </div>,
    );
  }

  // --- section / page -------------------------------------------------------
  const page = widgetType === "page";
  return frame(
    <div style={{ background: surface.bg, minHeight: 460 }}>
      {page ? (
        <div
          className="flex items-center gap-2 px-6 py-3"
          style={{ borderBottom: `1px solid ${surface.line}` }}
        >
          {avatar}
          <span className="text-sm font-semibold" style={{ color: surface.fg }}>
            {businessName}
          </span>
        </div>
      ) : null}
      <div className="space-y-6 px-6 py-8 sm:px-8">
        <div className="space-y-2 text-center">
          {!page ? (
            <div className="mx-auto flex justify-center">{avatar}</div>
          ) : null}
          <h3
            className="text-xl font-semibold tracking-tight"
            style={{ color: surface.fg }}
          >
            {strings.section_title}
          </h3>
          <p
            className="mx-auto max-w-[40ch] text-sm"
            style={{ color: surface.muted }}
          >
            {strings.section_subtitle}
          </p>
        </div>
        <div
          className="mx-auto max-w-md space-y-3 p-4"
          style={{ border: `1px solid ${surface.line}`, borderRadius: r.panel }}
        >
          {assistantBubble}
          {chips}
          {composer()}
          {poweredBy}
        </div>
      </div>
    </div>,
  );
}
