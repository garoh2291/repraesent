import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleHelp, MessageCircle, Send, Sparkles } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  HEIGHT_PX,
  defaultMaxWidth,
  readPageColors,
  resolvePalette,
  resolveRadii,
  resolveShadow,
  type PageColors,
} from "~/lib/ai-assistants/palette";
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
  /**
   * "empty" is what a visitor lands on; "conversation" is after the first
   * exchange — the only state in which section/page/bar have a header at all.
   */
  state?: "empty" | "conversation";
  className?: string;
}

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
 *
 * Colours come from the SAME resolver the widget uses
 * (`lib/ai-assistants/palette.ts`), so `theme: "page"` really does follow the
 * surface this preview is sitting on rather than a hardcoded white/near-black
 * pair that used to disagree with the embed on every site.
 */
export function WidgetPreview({
  widgetType,
  businessName,
  persona,
  appearance: rawAppearance,
  locale,
  state = "empty",
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

  // `theme: "page"` reads the surrounding surface, exactly like the widget
  // reads the host page. Re-read when the app flips light/dark.
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [pageColors, setPageColors] = useState<PageColors | null>(null);
  useEffect(() => {
    const read = () => setPageColors(readPageColors(hostRef.current));
    read();
    if (typeof MutationObserver === "undefined") return;
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
    return () => mo.disconnect();
  }, [appearance.theme]);

  const p = useMemo(
    () => resolvePalette(appearance, pageColors),
    [appearance, pageColors],
  );
  const r = resolveRadii(appearance);
  const compact = appearance.density === "compact";
  const fontFamily = FONT[appearance.font];
  const textSize = compact ? "text-[11px]" : "text-xs";
  const pad = compact ? "px-3 py-2" : "px-3.5 py-3";
  const border =
    appearance.border_width > 0
      ? `${appearance.border_width}px solid ${p.line}`
      : "none";
  const boxShadow = resolveShadow(appearance.shadow, p.dark);
  const conversation = state === "conversation";

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
      ? `linear-gradient(135deg, ${p.accent} 0%, ${p.accent}bb 100%)`
      : appearance.header_style === "minimal"
        ? p.bg
        : p.accent;
  const headerFg = appearance.header_style === "minimal" ? p.fg : p.accentText;

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
      style={{ background: p.accent, color: p.accentText }}
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
            ? `${Math.max(1, appearance.border_width)}px solid ${p.line}`
            : undefined,
      }}
    >
      <span
        aria-hidden
        className="flex size-8 items-center justify-center overflow-hidden rounded-full text-sm font-semibold"
        style={{
          background:
            appearance.header_style === "minimal"
              ? p.accent
              : "rgba(255,255,255,0.18)",
          color: appearance.header_style === "minimal" ? p.accentText : undefined,
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
            className={cn("px-2.5 py-1 leading-none", textSize)}
            style={{
              border: border === "none" ? `1px solid ${p.line}` : border,
              color: p.fg,
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
      style={{ background: p.bg2, borderRadius: r.field }}
    >
      <span className={cn("flex-1 truncate", textSize)} style={{ color: p.fg2 }}>
        {placeholder}
      </span>
      <span
        aria-label={strings.send}
        className="flex size-6 items-center justify-center"
        style={{
          background: p.accent,
          color: p.accentText,
          borderRadius: Math.min(r.field, 8),
        }}
      >
        <Send className="h-3 w-3" />
      </span>
    </div>
  );

  const poweredBy = appearance.show_powered_by ? (
    <p className="text-center text-[10px]" style={{ color: p.fg2 }}>
      {strings.powered_by}
    </p>
  ) : null;

  const assistantBubble = (text: string) => (
    <div className="flex items-end gap-2">
      {avatar}
      <div
        className={cn(
          "max-w-[85%] leading-relaxed",
          textSize,
          compact ? "px-2.5 py-1.5" : "px-3 py-2",
        )}
        style={{
          background: p.assistantBubble,
          color: p.fg,
          borderRadius: r.bubble,
          borderBottomLeftRadius: Math.min(r.bubble, 6),
        }}
      >
        {text}
      </div>
    </div>
  );

  const userBubble = (
    <div className="flex justify-end">
      <div
        className={cn(
          "max-w-[80%] leading-relaxed",
          textSize,
          compact ? "px-2.5 py-1.5" : "px-3 py-2",
        )}
        style={{
          background: p.userBubble,
          color: p.userBubbleText,
          borderRadius: r.bubble,
          borderBottomRightRadius: Math.min(r.bubble, 6),
        }}
      >
        {t("aiAssistants.appearance.previewUserMessage")}
      </div>
    </div>
  );

  /** Messages for the "in conversation" state. */
  const thread = (
    <>
      {userBubble}
      {assistantBubble(t("aiAssistants.appearance.previewAssistantMessage"))}
    </>
  );

  const frame = (children: React.ReactNode, style?: React.CSSProperties) => (
    <div
      ref={hostRef}
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
          background: p.dark
            ? "linear-gradient(180deg,#0f0f11 0%,#1a1a1d 100%)"
            : "linear-gradient(180deg,#f3f4f6 0%,#e9eaee 100%)",
          minHeight: 480,
        }}
      >
        <div
          aria-hidden
          className="absolute inset-x-6 top-6 space-y-2 opacity-40"
        >
          <div className="h-3 w-32 rounded" style={{ background: p.fg2 }} />
          <div className="h-2 w-64 rounded" style={{ background: p.line }} />
          <div className="h-2 w-52 rounded" style={{ background: p.line }} />
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
            className="flex w-full flex-col overflow-hidden"
            style={{
              background: p.bg,
              border,
              borderRadius: r.panel,
              boxShadow,
            }}
          >
            {header}
            <div className={cn("space-y-3", pad)}>
              {/* The greeting is the bubble's welcome; embedded types use the
                  hero instead and never render it. */}
              {conversation ? thread : assistantBubble(greeting)}
              {conversation ? null : chips}
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
              className="flex shrink-0 items-center justify-center overflow-hidden rounded-full"
              style={{
                background: p.accent,
                color: p.accentText,
                width: size,
                height: size,
                boxShadow,
              }}
              title={launcher}
            >
              {launcherIcon}
            </span>
            {appearance.nudge.enabled ? (
              <span
                className={cn("max-w-[200px] px-3 py-2", textSize)}
                style={{
                  background: p.bg,
                  color: p.fg,
                  border: border === "none" ? `1px solid ${p.line}` : border,
                  borderRadius: r.bubble,
                  boxShadow,
                }}
              >
                {nudgeText}
              </span>
            ) : (
              <span className={cn("pb-1", textSize)} style={{ color: p.fg2 }}>
                {launcher}
              </span>
            )}
          </div>
        </div>
      </div>,
    );
  }

  // --- embedded (section / page / bar) --------------------------------------
  //
  // The page mock keeps the surrounding page's own colour so `margin_y` and a
  // mismatched theme are both visible: the widget card is drawn ON the page,
  // not instead of it.
  const pageBg = pageColors?.background ?? p.bg;
  const pageFg = pageColors?.text ?? p.fg;
  const maxWidth = appearance.max_width ?? defaultMaxWidth(widgetType);
  const bodyHeight = HEIGHT_PX[appearance.height];

  const pageHeader = (
    <div
      className="flex items-center justify-between px-5 py-3"
      style={{ borderBottom: `1px solid ${p.line}`, color: pageFg }}
      aria-hidden
    >
      <span className="text-xs font-semibold tracking-tight opacity-70">
        {businessName || t("aiAssistants.appearance.previewSiteHeader")}
      </span>
      <span className="flex gap-3 text-[10px] opacity-40">
        <span className="h-2 w-10 rounded-full bg-current" />
        <span className="h-2 w-8 rounded-full bg-current" />
        <span className="h-2 w-12 rounded-full bg-current" />
      </span>
    </div>
  );

  const hero = (
    <div className="space-y-2 text-center">
      <div className="mx-auto flex justify-center">{avatar}</div>
      <h3
        className="text-xl font-semibold tracking-tight"
        style={{ color: p.fg }}
      >
        {strings.section_title}
      </h3>
      <p className="mx-auto max-w-[40ch] text-sm" style={{ color: p.fg2 }}>
        {strings.section_subtitle}
      </p>
    </div>
  );

  if (widgetType === "bar") {
    return frame(
      <div style={{ background: pageBg, minHeight: 340 }}>
        {pageHeader}
        <div
          className="mx-auto px-5"
          style={{
            maxWidth,
            marginTop: appearance.margin_y,
            marginBottom: appearance.margin_y,
          }}
        >
          <div
            className={cn(
              "flex items-center gap-2",
              compact ? "px-3 py-2" : "px-4 py-3",
            )}
            style={{
              border,
              borderRadius: r.field,
              background: p.bg,
              boxShadow,
            }}
          >
            <Sparkles
              className="h-4 w-4 shrink-0"
              style={{ color: p.accent }}
              aria-hidden
            />
            <span className="flex-1 truncate text-sm" style={{ color: p.fg2 }}>
              {strings.bar_placeholder}
            </span>
            <span
              className="flex size-7 items-center justify-center"
              style={{
                background: p.accent,
                color: p.accentText,
                borderRadius: Math.min(r.field, 8),
              }}
            >
              <Send className="h-3.5 w-3.5" />
            </span>
          </div>
          <div
            className="mt-2 overflow-hidden"
            style={{ border, borderRadius: r.panel, background: p.bg, boxShadow }}
          >
            {conversation ? header : null}
            <div
              className="space-y-3 p-3"
              style={{ minHeight: Math.round(bodyHeight * 0.5) }}
            >
              {conversation ? (
                thread
              ) : (
                <>
                  <p
                    className="text-[10px] uppercase tracking-widest"
                    style={{ color: p.fg2 }}
                  >
                    {t("aiAssistants.appearance.barExpands")}
                  </p>
                  {hero}
                  {chips}
                </>
              )}
            </div>
            <div className="px-3 pb-3">{poweredBy}</div>
          </div>
        </div>
      </div>,
    );
  }

  // section / page
  return frame(
    <div style={{ background: pageBg, minHeight: 480 }}>
      {pageHeader}
      <div
        className="mx-auto px-5"
        style={{
          maxWidth,
          marginTop: appearance.margin_y,
          marginBottom: appearance.margin_y,
        }}
      >
        <div
          className="overflow-hidden"
          style={{ background: p.bg, border, borderRadius: r.panel, boxShadow }}
        >
          {conversation ? header : null}
          <div
            className="space-y-6 px-6 py-8 sm:px-8"
            style={{ minHeight: bodyHeight }}
          >
            {/* In section/page/bar the hero IS the welcome — no greeting
                bubble is rendered, so nothing appears retroactively above the
                first answer. */}
            {conversation ? thread : hero}
            <div className="space-y-3">
              {conversation ? null : chips}
              {composer()}
              {poweredBy}
            </div>
          </div>
        </div>
      </div>
    </div>,
  );
}
