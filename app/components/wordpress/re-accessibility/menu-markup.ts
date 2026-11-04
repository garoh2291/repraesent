import {
  BOUNDS,
  DEFAULTS,
  FEATURE_GROUPS,
  LAUNCHER_ICONS,
  expandHex,
  isHex6,
  isLight,
  type ReAccessibilityFeature,
  type ReAccessibilityFeatureGroup,
  type ReAccessibilitySettings,
} from "./settings";
import { iconSvg } from "./icons";
import menuCss from "./menu-frontend.css?raw";

/**
 * The accessibility menu as the site draws it, for the live preview.
 *
 * A port of `Re_Accessibility_Frontend::menu_markup()`, `css_vars()` and
 * `root_classes()`, drawn with a copy of the plugin's own stylesheet
 * (`menu-frontend.css` = `assets/css/re-accessibility.css`). `menuVars()` and
 * `menuClasses()` must print what the PHP prints — the plugin's
 * `tests/fixtures/menu-vars.json` is the contract for both.
 */

export type PreviewLang = "en" | "de";

/**
 * The settings as the site will run them: what the plugin's sanitizer would
 * store for this form state. A half-typed colour previews as the default it
 * would fall back to, not as a broken style.
 */
export function resolveForPreview(s: ReAccessibilitySettings): ReAccessibilitySettings {
  const out: ReAccessibilitySettings = { ...s, features: { ...s.features } };

  for (const [key, [min, max]] of Object.entries(BOUNDS) as [
    keyof typeof BOUNDS,
    readonly [number, number],
  ][]) {
    const v = Number(s[key]);
    out[key] = Number.isFinite(v)
      ? Math.max(min, Math.min(max, Math.trunc(v)))
      : DEFAULTS[key];
  }

  for (const key of [
    "launcher_color",
    "launcher_icon_color",
    "launcher_border_color",
    "accent_color",
    "surface_color",
    "header_color",
    "card_color",
    "text_color",
    "muted_color",
    "line_color",
    "focus_color",
  ] as const) {
    const v = expandHex(String(s[key] ?? ""));
    out[key] = isHex6(v) ? v : DEFAULTS[key];
  }

  if (!LAUNCHER_ICONS.includes(out.launcher_icon)) {
    out.launcher_icon = DEFAULTS.launcher_icon;
  }
  if (out.position !== "left" && out.position !== "right") {
    out.position = DEFAULTS.position;
  }

  return out;
}

/** Mirrors `Re_Accessibility_Frontend::css_vars()`. Expects resolved settings. */
export function menuVars(s: ReAccessibilitySettings): string {
  const vars: [string, string][] = [
    ["accent", s.accent_color],
    ["x", `${s.offset_x}px`],
    ["y", `${s.offset_y}px`],
    ["size", `${s.launcher_size}px`],
    ["launcher", s.launcher_color],
    ["launcher-ink", s.launcher_icon_color],
    ["launcher-border", s.launcher_border_color],
    ["launcher-bw", `${s.launcher_border_width}px`],
    ["launcher-radius", `${s.launcher_radius}px`],
    ["launcher-icon", String(s.launcher_icon_size)],
    ["panel-w", `${s.panel_width}px`],
    ["panel-radius", `${s.panel_radius}px`],
    ["radius", `${s.card_radius}px`],
    ["control-radius", `${s.control_radius}px`],
    ["surface", s.surface_color],
    ["head", s.header_color],
    ["card", s.card_color],
    ["ink", s.text_color],
    ["muted", s.muted_color],
    ["line", s.line_color],
  ];
  return vars.map(([name, value]) => `--reacc-${name}:${value};`).join("");
}

/** Mirrors `Re_Accessibility_Frontend::root_classes()`. Expects resolved settings. */
export function menuClasses(s: ReAccessibilitySettings): string[] {
  const classes = ["reacc", `reacc--${s.position}`];
  if (s.launcher_shadow) classes.push("reacc--launcher-shadow");
  if (isLight(s.accent_color)) classes.push("reacc--accent-light");
  if (s.hide_on_mobile) classes.push("reacc--hide-mobile");
  return classes;
}

/* ── The menu's own words (from the plugin's .pot and de_DE.po) ─────────── */

type Copy = {
  launcher: string;
  title: string;
  lead: string;
  shortcut: string;
  shortcutMac: string;
  opens: string;
  close: string;
  bigger: string;
  off: string;
  undo: string;
  options: string;
  adjustments: string;
  statement: string;
  groups: Record<ReAccessibilityFeatureGroup, string>;
  features: Record<ReAccessibilityFeature, { label: string; states: string[] }>;
};

const TEXT_SIZES = ["115%", "130%", "150%", "175%"];

const COPY: Record<PreviewLang, Copy> = {
  en: {
    launcher: "Accessibility menu",
    title: "Accessibility",
    lead: "Adjust this website to suit you.",
    shortcut: "Alt+A",
    shortcutMac: "Option+A",
    opens: "%s opens this menu",
    close: "Close accessibility menu",
    bigger: "Bigger menu",
    off: "Off",
    undo: "Undo all",
    options: "Menu options",
    adjustments: "Adjustments",
    statement: "Accessibility statement",
    groups: { seeing: "Seeing", reading: "Reading", navigating: "Navigating" },
    features: {
      contrast: { label: "Contrast", states: ["Invert", "Dark", "Light"] },
      saturation: {
        label: "Color strength",
        states: ["Softer", "Stronger", "Gray"],
      },
      links: { label: "Mark links", states: ["On"] },
      images: { label: "Hide images", states: ["On"] },
      text: { label: "Text size", states: TEXT_SIZES },
      spacing: {
        label: "Letter spacing",
        states: ["Small", "Medium", "Large"],
      },
      lineheight: { label: "Line spacing", states: ["1.5×", "1.75×", "2×"] },
      align: {
        label: "Align text",
        states: ["Left", "Right", "Center", "Justify"],
      },
      dyslexia: { label: "Readable font", states: ["Dyslexia", "Legible"] },
      cursor: { label: "Reading aid", states: ["Big cursor", "Mask", "Guide"] },
      tooltips: { label: "Show labels", states: ["On"] },
      pause: { label: "Stop motion", states: ["On"] },
    },
  },
  de: {
    launcher: "Menü für Barrierefreiheit",
    title: "Barrierefreiheit",
    lead: "Passen Sie diese Website an Ihre Bedürfnisse an.",
    shortcut: "Alt+A",
    shortcutMac: "Wahltaste+A",
    opens: "%s öffnet dieses Menü",
    close: "Menü für Barrierefreiheit schließen",
    bigger: "Größeres Menü",
    off: "Aus",
    undo: "Alles zurücknehmen",
    options: "Menü-Optionen",
    adjustments: "Anpassungen",
    statement: "Erklärung zur Barrierefreiheit",
    groups: { seeing: "Sehen", reading: "Lesen", navigating: "Navigieren" },
    features: {
      contrast: { label: "Kontrast", states: ["Umkehren", "Dunkel", "Hell"] },
      saturation: {
        label: "Farbstärke",
        states: ["Sanfter", "Kräftiger", "Grau"],
      },
      links: { label: "Links markieren", states: ["An"] },
      images: { label: "Bilder ausblenden", states: ["An"] },
      text: { label: "Schriftgröße", states: TEXT_SIZES },
      spacing: { label: "Zeichenabstand", states: ["Klein", "Mittel", "Groß"] },
      lineheight: { label: "Zeilenabstand", states: ["1,5×", "1,75×", "2×"] },
      align: {
        label: "Text ausrichten",
        states: ["Links", "Rechts", "Mitte", "Block"],
      },
      dyslexia: {
        label: "Lesbare Schrift",
        states: ["Legasthenie", "Gut lesbar"],
      },
      cursor: {
        label: "Lesehilfe",
        states: ["Großer Zeiger", "Maske", "Lineal"],
      },
      tooltips: { label: "Beschriftungen zeigen", states: ["An"] },
      pause: { label: "Bewegung stoppen", states: ["An"] },
    },
  },
};

/** Adjustment names for the editor's own lists, in the preview language. */
export function featureLabel(key: ReAccessibilityFeature, lang: PreviewLang): string {
  return COPY[lang].features[key].label;
}

/* ── Markup ─────────────────────────────────────────────────────────────── */

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The launcher and dialog as `menu_markup()` prints them. `open` shows the
 * dialog (the site's script would remove `hidden`) on its first tab, with the
 * first adjustment switched on, so the main color is visible. `mac` shows the
 * shortcut as a Mac's keyboard labels it, as the site's script does.
 */
export function menuMarkup(
  raw: ReAccessibilitySettings,
  lang: PreviewLang,
  open: boolean,
  mac = false,
): string {
  const s = resolveForPreview(raw);
  const copy = COPY[lang];
  let first = true;

  const item = (key: ReAccessibilityFeature) => {
    const f = copy.features[key];
    const level = first ? 1 : 0;
    first = false;
    const control =
      f.states.length > 1
        ? ""
        : `<button type="button" class="reacc-switch" role="switch" aria-checked="${level ? "true" : "false"}"><span class="reacc-switch__knob" aria-hidden="true"></span></button>`;
    const seg =
      f.states.length > 1
        ? `<div class="reacc-seg" role="radiogroup">${[copy.off, ...f.states]
            .map(
              (label, n) =>
                `<button type="button" class="reacc-seg__opt" role="radio" aria-checked="${n === level ? "true" : "false"}" data-reacc-level="${n}">${esc(label)}</button>`,
            )
            .join("")}</div>`
        : "";
    return `<li class="reacc-item" data-feature="${key}" data-level="${level}"><div class="reacc-item__row"><div class="reacc-item__icon">${iconSvg(key)}</div><div class="reacc-item__name">${esc(f.label)}</div>${control}</div>${seg}</li>`;
  };

  const groups = FEATURE_GROUPS.map(({ id, features }) => ({
    id,
    on: features.filter((k) => s.features[k] !== false) as ReAccessibilityFeature[],
  })).filter((g) => g.on.length > 0);

  const tabs =
    groups.length > 1
      ? `<div class="reacc-tabs" role="tablist" aria-label="${esc(copy.adjustments)}">${groups
          .map(
            (g, i) =>
              `<button type="button" class="reacc-tab" role="tab" aria-selected="${i === 0 ? "true" : "false"}"${i === 0 ? ' data-count="1"' : ""}>${esc(copy.groups[g.id])}</button>`,
          )
          .join("")}</div>`
      : "";

  const panes = groups
    .map(
      (g, i) =>
        `<div class="reacc-pane${i === 0 ? " is-active" : ""}"><ul class="reacc-list" role="list">${g.on.map(item).join("")}</ul></div>`,
    )
    .join("");

  const optionsTool =
    s.show_oversized || s.show_widget_options
      ? `<button type="button" class="reacc-tool reacc-tool--disclosure" aria-expanded="false">${iconSvg("settings")}<span>${esc(copy.options)}</span></button>`
      : "";

  const kbd = s.shortcut
    ? `<p class="reacc-panel__kbd">${esc(copy.opens).replace("%s", `<kbd>${esc(mac ? copy.shortcutMac : copy.shortcut)}</kbd>`)}</p>`
    : "";

  return `<div id="reacc" class="${menuClasses(s).join(" ")}" style="${esc(menuVars(s))}">
<button type="button" class="reacc-launcher" aria-expanded="${open}">${iconSvg(s.launcher_icon)}<span class="reacc-sr">${esc(copy.launcher)}</span></button>
<div class="reacc-panel" role="dialog" aria-label="${esc(copy.title)}"${open ? "" : " hidden"}>
<div class="reacc-panel__head"><div class="reacc-panel__heading"><h2 class="reacc-panel__title">${esc(copy.title)}</h2><p class="reacc-panel__lead">${esc(copy.lead)}</p></div><button type="button" class="reacc-close" aria-label="${esc(copy.close)}">${iconSvg("close")}</button></div>
${tabs}
<div class="reacc-panel__body"><div class="reacc-panes">${panes}</div></div>
<div class="reacc-panel__foot"><div class="reacc-tools"><button type="button" class="reacc-tool">${iconSvg("reset")}<span>${esc(copy.undo)}</span></button>${optionsTool}</div><div class="reacc-panel__meta"><a class="reacc-statement-link" href="#">${esc(copy.statement)}</a>${kbd}</div></div>
</div>
</div>`;
}

/**
 * A whole page for the preview frame: a neutral stand-in for the website,
 * the plugin's stylesheet and the menu. No script runs in it.
 */
export function previewDocument(
  settings: ReAccessibilitySettings,
  lang: PreviewLang,
  open: boolean,
  mac = false,
): string {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
html,body{margin:0;height:100%;background:#fff;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
.pv-bar{height:56px;border-bottom:1px solid #eceae6;display:flex;align-items:center;gap:20px;padding:0 24px}
.pv-logo{width:96px;height:18px;margin-right:auto;border-radius:4px;background:#d4d2cd}
.pv-nav{width:48px;height:10px;border-radius:3px;background:#e7e5e1}
.pv-hero{margin:24px;height:180px;border-radius:12px;background:linear-gradient(135deg,#ecebe7,#dedcd6)}
.pv-text{margin:0 24px 12px;height:10px;border-radius:3px;background:#ecebe7}
.pv-text.short{width:55%}
</style>
<style>${menuCss}</style>
</head>
<body>
<div class="pv-bar"><span class="pv-logo"></span><span class="pv-nav"></span><span class="pv-nav"></span><span class="pv-nav"></span></div>
<div class="pv-hero"></div>
<div class="pv-text"></div><div class="pv-text"></div><div class="pv-text short"></div>
${menuMarkup(settings, lang, open, mac)}
</body>
</html>`;
}
