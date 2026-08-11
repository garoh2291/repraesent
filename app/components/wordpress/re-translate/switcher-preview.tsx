import { useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  ReTranslateSwitcher,
  ReTranslateSwitcherShow,
} from "~/lib/wordpress/plugin-settings-types";
import { cn } from "~/lib/utils";
import {
  languageDisplayCode,
  offsetFallback,
  type PreviewLanguage,
} from "./constants";

/**
 * The switcher as a visitor would meet it.
 *
 * Not a screenshot of the theme — no plugin can take one — but the same markup
 * the front end renders, on the two grounds every theme is one of, pinned in the
 * corner the switcher is actually heading for. Every control on the left redraws
 * it, so the choices are made by looking rather than by reading.
 */

/** The preview page is a fraction of a real one, so offsets are drawn to scale. */
const PREVIEW_SCALE = 0.3;

function offsetPixels(value: string, fallback: number): number {
  const parsed = Number.parseInt(value === "" ? String(fallback) : value, 10);
  return Number.isNaN(parsed) ? 0 : Math.round(parsed * PREVIEW_SCALE);
}

/** The visible bits of one language, mirroring `Switcher::link_content()`. */
function LanguageContent({
  language,
  show,
}: {
  language: PreviewLanguage;
  show: ReTranslateSwitcherShow;
}) {
  const code = languageDisplayCode(language.code);
  const flag = language.flag;
  const label = language.label || code;

  const text =
    show === "flag" ? (flag ? "" : code) : show.includes("code") ? code : label;

  return (
    <>
      {show.includes("flag") && flag ? (
        <span aria-hidden className="text-[11px] leading-none">
          {flag}
        </span>
      ) : null}
      {text ? <span className="leading-none">{text}</span> : null}
    </>
  );
}

/** Inline styles standing in for the custom properties the front end is handed. */
function itemStyle(
  switcher: ReTranslateSwitcher,
  current: boolean,
): React.CSSProperties {
  const style: React.CSSProperties = {
    borderRadius: switcher.radius === "" ? 4 : Number(switcher.radius),
    paddingTop: switcher.pad_y === "" ? 6 : Number(switcher.pad_y),
    paddingBottom: switcher.pad_y === "" ? 6 : Number(switcher.pad_y),
    paddingLeft: switcher.pad_x === "" ? 11 : Number(switcher.pad_x),
    paddingRight: switcher.pad_x === "" ? 11 : Number(switcher.pad_x),
  };

  const { colors } = switcher;
  if (current) {
    if (colors.active_text) style.color = colors.active_text;
    if (colors.active_bg) style.background = colors.active_bg;
  } else {
    if (colors.text) style.color = colors.text;
    if (colors.bg) style.background = colors.bg;
  }
  if (colors.border) style.borderColor = colors.border;

  return style;
}

function SwitcherMock({
  switcher,
  entries,
}: {
  switcher: ReTranslateSwitcher;
  entries: PreviewLanguage[];
}) {
  const active = entries.find((e) => e.current) ?? entries[0];
  // hide_current removes a language from the list, never from the dropdown
  // toggle — the same rule `Switcher::render()` follows on the front end.
  const list = switcher.hide_current
    ? entries.filter((e) => !e.current)
    : entries;

  if (!active) return null;
  if (switcher.layout !== "dropdown" && list.length === 0) return null;

  const base =
    "inline-flex items-center gap-1 border border-current/15 bg-white/90 text-[10px] font-medium text-neutral-800 shadow-sm";

  if (switcher.layout === "dropdown") {
    const others = list.filter((e) => e.code !== active.code);
    const radius =
      switcher.radius === "" ? 4 : Number(switcher.radius);
    // List above the toggle — the switcher sits in a corner, so the menu
    // opens toward the page rather than off the edge.
    return (
      <span className="inline-flex flex-col-reverse items-stretch gap-1">
        <span className={base} style={itemStyle(switcher, true)}>
          <LanguageContent language={active} show={switcher.show} />
          <span aria-hidden className="ml-0.5 text-[8px] leading-none opacity-60">
            ▴
          </span>
        </span>
        {others.length > 0 ? (
          <span
            className="inline-flex flex-col gap-0.5 border border-current/10 bg-white/95 p-0.5 shadow-sm"
            style={{ borderRadius: radius }}
          >
            {others.map((entry) => (
              <span
                key={entry.code}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-neutral-800"
                style={itemStyle(switcher, false)}
              >
                <LanguageContent language={entry} show={switcher.show} />
              </span>
            ))}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      {list.map((entry) => (
        <span
          key={entry.code}
          className={cn(base, entry.current && "bg-neutral-900 text-white")}
          style={itemStyle(switcher, entry.current)}
        >
          <LanguageContent language={entry} show={switcher.show} />
        </span>
      ))}
    </span>
  );
}

/** Which way a stack of languages grows, so a dropdown opens off the edge it is
 *  pinned to rather than through it. */
const CORNER_CLASS: Record<string, string> = {
  "bottom-right": "items-end",
  "bottom-left": "items-start",
  "top-right": "items-end",
  "top-left": "items-start",
};

export function SwitcherPreview({
  switcher,
  languages,
}: {
  switcher: ReTranslateSwitcher;
  languages: PreviewLanguage[];
}) {
  const { t } = useTranslation();
  const [scheme, setScheme] = useState<"light" | "dark">("light");

  const position = switcher.position;
  const atBottom = position.startsWith("bottom");
  const atRight = position.endsWith("right");

  // 12px of inset so the pill is not flush against the mock page's own border,
  // plus the site owner's offset drawn to the same scale as the page.
  const offY = offsetPixels(switcher.offset_y, offsetFallback(position)) + 12;
  const offX = offsetPixels(switcher.offset_x, 0) + 12;

  const floatStyle: React.CSSProperties = {
    top: atBottom ? undefined : offY,
    bottom: atBottom ? offY : undefined,
    left: atRight ? undefined : offX,
    right: atRight ? offX : undefined,
  };

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <span className="text-xs font-semibold tracking-tight">
          {t("wordpress.reTranslate.preview", "Live preview")}
        </span>
        <div
          role="group"
          aria-label={t(
            "wordpress.reTranslate.previewBackground",
            "Preview background",
          )}
          className="inline-flex rounded-lg border p-0.5"
        >
          {(["light", "dark"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={scheme === value}
              onClick={() => setScheme(value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                scheme === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "light"
                ? t("wordpress.reTranslate.light", "Light")
                : t("wordpress.reTranslate.dark", "Dark")}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        <div
          className={cn(
            "relative h-64 overflow-hidden rounded-xl border",
            scheme === "light"
              ? "border-neutral-200 bg-white"
              : "border-neutral-700 bg-neutral-900",
          )}
        >
          {/* A page, roughly: nav, some prose, a footer rule. */}
          <div
            className={cn(
              "flex items-center justify-between border-b px-4 py-3",
              scheme === "light" ? "border-neutral-100" : "border-neutral-800",
            )}
          >
            <span className={cn("block h-2.5 w-16 rounded-full", barTone(scheme, true))} />
            <span className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={cn("block h-1.5 w-8 rounded-full", barTone(scheme))}
                />
              ))}
            </span>
          </div>

          <div className="space-y-2.5 px-4 py-5">
            <span className={cn("block h-3.5 w-2/3 rounded-full", barTone(scheme, true))} />
            <span className={cn("block h-1.5 w-full rounded-full", barTone(scheme))} />
            <span className={cn("block h-1.5 w-full rounded-full", barTone(scheme))} />
            <span className={cn("block h-1.5 w-1/2 rounded-full", barTone(scheme))} />
          </div>

          <div
            className={cn(
              "absolute inset-x-0 bottom-0 border-t px-4 py-3",
              scheme === "light" ? "border-neutral-100" : "border-neutral-800",
            )}
          >
            <span className={cn("block h-1.5 w-20 rounded-full", barTone(scheme))} />
          </div>

          <div
            className={cn("absolute flex", CORNER_CLASS[position])}
            style={floatStyle}
          >
            <SwitcherMock switcher={switcher} entries={languages} />
          </div>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          {t(
            "wordpress.reTranslate.previewCaption",
            "Fixed to the corner, over the page.",
          )}{" "}
          {switcher.layout === "dropdown"
            ? t(
                "wordpress.reTranslate.previewDropdown",
                "On the site the list opens on hover; it is shown open here.",
              )
            : null}
        </p>
      </div>
    </div>
  );
}

function barTone(scheme: "light" | "dark", strong = false): string {
  if (scheme === "light") return strong ? "bg-neutral-300" : "bg-neutral-200";
  return strong ? "bg-neutral-600" : "bg-neutral-700";
}
