import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReTranslateSwitcher, ReTranslateSwitcherShow } from "~/lib/api/re-translate";
import { cn } from "~/lib/utils";
import { flagSrc } from "./flags";
import { px } from "./logic";

/** One language as the plugin's menu shows it (Switcher::links()). */
export interface MenuLanguage {
  key: string;
  name: string;
  code: string;
  flag?: string;
  current: boolean;
}

/** The preview page is a fraction of a real one, so offsets are drawn to scale. */
const SCALE = 0.3;

/** The plugin's stylesheet defaults (switcher.css), in px at a 14px font. */
const DEFAULTS = { radius: 6, pad_y: 5, pad_x: 10 };

export function FlagImage({ country, className }: { country?: string; className?: string }) {
  const src = flagSrc(country);
  if (!src) return null;
  return <img src={src} alt="" aria-hidden className={cn("inline-block h-[0.9em] w-[1.35em] shrink-0 rounded-[2px] object-cover ring-1 ring-black/10", className)} />;
}

/** Mirrors Switcher::content(): flag, name or code, and a code when a flag is missing. */
function Content({ language, show }: { language: MenuLanguage; show: ReTranslateSwitcherShow }) {
  const flag = show.startsWith("flag") ? flagSrc(language.flag) : null;
  const text = show === "flag" ? (flag ? "" : language.code) : show === "code" || show === "flag_code" ? language.code : language.name;
  return (
    <>
      {flag ? <FlagImage country={language.flag} /> : null}
      {text ? <span className="leading-none">{text}</span> : null}
    </>
  );
}


function itemStyle(s: ReTranslateSwitcher, current: boolean): React.CSSProperties {
  const style: React.CSSProperties = {
    borderRadius: px(s.radius, DEFAULTS.radius),
    padding: `${px(s.pad_y, DEFAULTS.pad_y)}px ${px(s.pad_x, DEFAULTS.pad_x)}px`,
    borderColor: s.colors.border || "transparent",
  };
  if (s.colors.bg) style.background = s.colors.bg;
  if (s.colors.text) style.color = s.colors.text;
  if (current) {
    if (s.colors.active_bg) style.background = s.colors.active_bg;
    if (s.colors.active_text) style.color = s.colors.active_text;
  }
  return style;
}

function Menu({ switcher, languages, floating }: { switcher: ReTranslateSwitcher; languages: MenuLanguage[]; floating: boolean }) {
  const active = languages.find((l) => l.current) ?? languages[0];
  const list = switcher.hide_current ? languages.filter((l) => !l.current) : languages;
  if (!active) return null;
  const item = "inline-flex items-center gap-1.5 whitespace-nowrap border text-[11px]";

  if (switcher.layout === "inline") {
    return (
      <span className={cn("inline-flex flex-wrap items-center gap-1", floating && "rounded-lg bg-white p-1 text-neutral-900 shadow-md")}>
        {list.map((l) => (
          <span key={l.key} className={cn(item, l.current && "font-semibold")} style={itemStyle(switcher, l.current)}>
            <Content language={l} show={switcher.show} />
          </span>
        ))}
      </span>
    );
  }

  // Shown open. A corner menu at the bottom opens upwards, as it does on the site.
  const up = floating && switcher.position.startsWith("bottom");
  return (
    <span className={cn("inline-flex items-stretch gap-1", up ? "flex-col-reverse" : "flex-col", switcher.position.endsWith("right") ? "items-end" : "items-start")}>
      <span className={cn("rounded-lg", floating && "bg-white p-1 text-neutral-900 shadow-md")}>
        <span className={item} style={itemStyle(switcher, false)}>
          <Content language={active} show={switcher.show} />
          <span aria-hidden className="ml-0.5 text-[8px] leading-none opacity-60">
            {up ? "▴" : "▾"}
          </span>
        </span>
      </span>
      <span className="flex min-w-full flex-col rounded-lg bg-white p-1 text-neutral-900 shadow-lg ring-1 ring-black/5" style={{ borderRadius: px(switcher.radius, DEFAULTS.radius) + 4 }}>
        {list.map((l) => (
          <span key={l.key} className={cn("flex items-center gap-1.5 whitespace-nowrap text-[11px]", l.current && "bg-black/[0.06] font-semibold")} style={{ ...itemStyle(switcher, l.current), borderColor: undefined, border: 0 }}>
            <Content language={l} show={switcher.show} />
          </span>
        ))}
      </span>
    </span>
  );
}

/** Our menu as a visitor meets it: the same choices, on a light and a dark page. */
export function MenuPreview({ switcher, languages }: { switcher: ReTranslateSwitcher; languages: MenuLanguage[] }) {
  const { t } = useTranslation();
  const [scheme, setScheme] = useState<"light" | "dark">("light");
  const manual = switcher.position === "manual";
  const bottom = switcher.position.startsWith("bottom");
  const right = switcher.position.endsWith("right");
  const offY = Math.round(px(switcher.offset_y, 0) * SCALE) + 12;
  const offX = Math.round(px(switcher.offset_x, 0) * SCALE) + 12;
  const bar = (strong?: boolean) => (scheme === "light" ? (strong ? "bg-neutral-300" : "bg-neutral-200") : strong ? "bg-neutral-600" : "bg-neutral-700");

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <span className="text-xs font-semibold tracking-tight">{t("wordpress.reTranslate.menu.preview", "Live preview")}</span>
        <div role="group" aria-label={t("wordpress.reTranslate.menu.previewBackground", "Preview background")} className="inline-flex rounded-lg border p-0.5">
          {(["light", "dark"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={scheme === value}
              onClick={() => setScheme(value)}
              className={cn("rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors", scheme === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {value === "light" ? t("wordpress.reTranslate.menu.light", "Light") : t("wordpress.reTranslate.menu.dark", "Dark")}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        <div className={cn("relative h-72 overflow-hidden rounded-xl border", scheme === "light" ? "border-neutral-200 bg-white text-neutral-800" : "border-neutral-700 bg-neutral-900 text-neutral-100")}>
          <div className={cn("flex items-center justify-between gap-3 border-b px-4 py-3", scheme === "light" ? "border-neutral-100" : "border-neutral-800")}>
            <span className={cn("block h-2.5 w-16 rounded-full", bar(true))} />
            <span className="flex items-center gap-2">
              {[0, 1, 2].map((i) => (
                <span key={i} className={cn("block h-1.5 w-8 rounded-full", bar())} />
              ))}
              {manual ? (
                <span className="relative z-10 ml-1 self-start">
                  <Menu switcher={switcher} languages={languages} floating={false} />
                </span>
              ) : null}
            </span>
          </div>
          <div className="space-y-2.5 px-4 py-5">
            <span className={cn("block h-3.5 w-2/3 rounded-full", bar(true))} />
            <span className={cn("block h-1.5 w-full rounded-full", bar())} />
            <span className={cn("block h-1.5 w-full rounded-full", bar())} />
            <span className={cn("block h-1.5 w-1/2 rounded-full", bar())} />
          </div>
          {manual ? null : (
            <div className="absolute" style={{ top: bottom ? undefined : offY, bottom: bottom ? offY : undefined, left: right ? undefined : offX, right: right ? offX : undefined }}>
              <Menu switcher={switcher} languages={languages} floating />
            </div>
          )}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          {manual
            ? t("wordpress.reTranslate.menu.previewManual", "Shown where you place it — here, in a header.")
            : t("wordpress.reTranslate.menu.previewCorner", "Fixed to the corner, over the page.")}{" "}
          {switcher.layout === "dropdown" ? t("wordpress.reTranslate.menu.previewOpen", "The list opens on a click; it is shown open here.") : null}
        </p>
      </div>
    </div>
  );
}
