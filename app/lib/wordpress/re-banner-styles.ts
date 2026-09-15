/**
 * re:banner per-element style overrides — the schema, its normaliser, and the
 * CSS it turns into.
 *
 * This is a line-for-line twin of `Re_Banner_Styles` in
 * `plugins/re-banner/includes/class-styles.php`, and the SAME file lives in
 * `api.repraesent.com/src/modules/wordpress-hub/re-banner-styles.ts`. All three
 * must agree: the plugin is what a site actually emits, the API's is what it
 * accepts and returns, this one is what the live preview draws.
 * `stylesToCss()` must be byte-identical to the PHP `css()` — a preview that
 * draws something the site will not is worse than no preview.
 *
 * They are kept honest by one fixture list, `plugins/re-banner/tests/fixtures/
 * styles.json`, which the PHP tests, this module's spec and the dashboard's
 * test all run. Change the schema here → change it there → run all three.
 *
 * No framework imports on purpose, so the file can be copied verbatim.
 */

export const REBNR_STYLE_ELEMENTS = [
  "container",
  "body",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "a",
  "cta",
  "image",
] as const;
export type ReBannerStyleElement = (typeof REBNR_STYLE_ELEMENTS)[number];

/** Emit order inside a rule — part of the contract with the PHP generator. */
export const REBNR_STYLE_PROP_ORDER = [
  "font_family",
  "font_size",
  "font_weight",
  "line_height",
  "letter_spacing",
  "text_transform",
  "text_align",
  "text_decoration",
  "color",
  "width",
  "height",
  "max_width",
  "border_radius",
  "margin",
  "padding",
  "align",
] as const;
export type ReBannerStyleProp = (typeof REBNR_STYLE_PROP_ORDER)[number];

export const REBNR_FONT_WEIGHTS = [300, 400, 500, 600, 700, 800] as const;
export const REBNR_TEXT_TRANSFORMS = [
  "none",
  "uppercase",
  "lowercase",
  "capitalize",
] as const;
export const REBNR_ALIGNS = ["left", "center", "right"] as const;
export const REBNR_DECORATIONS = ["none", "underline"] as const;
export const REBNR_SIDES = ["top", "right", "bottom", "left"] as const;

/** Font presets: key stored, stack emitted. No "inherit" — not choosing IS inherit. */
export const REBNR_FONT_STACKS = {
  system:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
  sans: '"Helvetica Neue",Helvetica,Arial,sans-serif',
  serif: 'Georgia,"Times New Roman",Times,serif',
  mono: "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
} as const;
export type ReBannerFontKey = keyof typeof REBNR_FONT_STACKS;

/** property → [min, max, decimals] */
export const REBNR_STYLE_RANGES = {
  font_size: [8, 120, 0],
  line_height: [0.8, 3, 2],
  letter_spacing: [-0.1, 0.5, 2],
  width: [16, 1200, 0],
  height: [16, 1200, 0],
  max_width: [120, 1600, 0],
  border_radius: [0, 100, 0],
  side: [0, 200, 0],
} as const satisfies Record<string, readonly [number, number, number]>;

const TEXT_PROPS: readonly ReBannerStyleProp[] = [
  "font_family",
  "font_size",
  "font_weight",
  "line_height",
  "letter_spacing",
  "text_transform",
  "text_align",
  "color",
  "margin",
  "padding",
];

/** Which properties each element accepts. Anything else is dropped. */
export const REBNR_ELEMENT_PROPS: Record<
  ReBannerStyleElement,
  readonly ReBannerStyleProp[]
> = {
  container: [
    "font_family",
    "font_size",
    "line_height",
    "text_align",
    "color",
    "padding",
    "margin",
    "max_width",
    "border_radius",
    "align",
  ],
  body: [...TEXT_PROPS, "max_width", "align"],
  p: TEXT_PROPS,
  h1: TEXT_PROPS,
  h2: TEXT_PROPS,
  h3: TEXT_PROPS,
  h4: TEXT_PROPS,
  h5: TEXT_PROPS,
  h6: TEXT_PROPS,
  li: TEXT_PROPS,
  a: [...TEXT_PROPS, "text_decoration"],
  cta: [
    "font_family",
    "font_size",
    "font_weight",
    "line_height",
    "letter_spacing",
    "text_transform",
    "color",
    "padding",
    "margin",
    "border_radius",
    "width",
    "align",
  ],
  image: ["width", "height", "border_radius", "margin", "align"],
};

export type ReBannerSide = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

export type ReBannerElementStyle = {
  font_family?: ReBannerFontKey;
  font_size?: number;
  font_weight?: (typeof REBNR_FONT_WEIGHTS)[number];
  line_height?: number;
  letter_spacing?: number;
  text_transform?: (typeof REBNR_TEXT_TRANSFORMS)[number];
  text_align?: (typeof REBNR_ALIGNS)[number];
  text_decoration?: (typeof REBNR_DECORATIONS)[number];
  color?: string;
  width?: number;
  height?: number;
  max_width?: number;
  border_radius?: number;
  margin?: ReBannerSide;
  padding?: ReBannerSide;
  align?: (typeof REBNR_ALIGNS)[number];
};

export type ReBannerStyles = Partial<
  Record<ReBannerStyleElement, ReBannerElementStyle>
>;

/* ── Normalising ──────────────────────────────────────────────────────── */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Clamp + round to the range's precision; whole values come back as ints. */
function number(
  value: unknown,
  range: readonly [number, number, number],
): number | null {
  if (typeof value === "boolean" || value === null || value === "") return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;

  const [min, max, decimals] = range;
  const clamped = Math.max(min, Math.min(max, n));
  const factor = 10 ** decimals;
  // Matches PHP round(): half away from zero.
  const rounded =
    Math.sign(clamped) * Math.round(Math.abs(clamped) * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** Strict `#rrggbb`, lower-cased. */
function hex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(v) ? v : null;
}

function oneOf<T extends string | number>(
  value: unknown,
  list: readonly T[],
): T | null {
  return (list as readonly unknown[]).includes(value) ? (value as T) : null;
}

function sides(value: unknown): ReBannerSide | null {
  if (!isRecord(value)) return null;
  const out: ReBannerSide = {};
  for (const side of REBNR_SIDES) {
    if (!(side in value)) continue;
    const n = number(value[side], REBNR_STYLE_RANGES.side);
    if (n !== null) out[side] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function prop(name: ReBannerStyleProp, value: unknown): unknown {
  switch (name) {
    case "font_family":
      return typeof value === "string" && value in REBNR_FONT_STACKS
        ? value
        : null;
    case "font_weight": {
      if (typeof value !== "number" && typeof value !== "string") return null;
      const n = Number(value);
      if (!Number.isFinite(n)) return null;
      return oneOf(Math.trunc(n), REBNR_FONT_WEIGHTS);
    }
    case "text_transform":
      return oneOf(value, REBNR_TEXT_TRANSFORMS);
    case "text_align":
    case "align":
      return oneOf(value, REBNR_ALIGNS);
    case "text_decoration":
      return oneOf(value, REBNR_DECORATIONS);
    case "color":
      return hex(value);
    case "margin":
    case "padding":
      return sides(value);
    default:
      return number(value, REBNR_STYLE_RANGES[name]);
  }
}

/**
 * Normalise authored overrides to exactly the shape `stylesToCss()` reads —
 * the same rules as `Re_Banner_Styles::sanitize()`: unknown elements and
 * properties dropped, numbers clamped, bad enums/colours dropped, empty
 * elements pruned. Accepts an object, a JSON string, or garbage (→ `{}`).
 */
export function normalizeStyles(raw: unknown): ReBannerStyles {
  let input: unknown = raw;
  if (typeof input === "string") {
    try {
      input = JSON.parse(input);
    } catch {
      input = null;
    }
  }
  if (!isRecord(input)) return {};

  const clean: ReBannerStyles = {};
  for (const element of REBNR_STYLE_ELEMENTS) {
    const authored = input[element];
    if (!isRecord(authored)) continue;

    const style: Record<string, unknown> = {};
    for (const name of REBNR_STYLE_PROP_ORDER) {
      if (!REBNR_ELEMENT_PROPS[element].includes(name)) continue;
      if (!(name in authored)) continue;
      const v = prop(name, authored[name]);
      if (v !== null) style[name] = v;
    }

    if (Object.keys(style).length > 0) {
      clean[element] = style as ReBannerElementStyle;
    }
  }
  return clean;
}

export function isEmptyStyles(styles: ReBannerStyles | null | undefined): boolean {
  return !styles || Object.keys(styles).length === 0;
}

/** Number of set properties across all elements (a side box counts once). */
export function countOverrides(styles: ReBannerStyles): number {
  let n = 0;
  for (const element of REBNR_STYLE_ELEMENTS) {
    n += Object.keys(styles[element] ?? {}).length;
  }
  return n;
}

/* ── CSS ─────────────────────────────────────────────────────────────── */

/** `1.4` not `1.40`, `1` not `1.00` — matches PHP `format_number()`. */
function formatNumber(v: number): string {
  const s = Number(v.toFixed(2)).toString();
  return s === "-0" ? "0" : s;
}

function alignDeclarations(
  value: string,
  element: ReBannerStyleElement,
  variant: string,
): string[] {
  if (element === "cta") {
    const map = { left: "flex-start", center: "center", right: "flex-end" };
    return [`align-self:${map[value as keyof typeof map]}`];
  }
  if (element === "container" && variant === "floating") {
    switch (value) {
      case "left":
        return ["left:20px", "right:auto"];
      case "center":
        return ["left:50%", "right:auto", "transform:translateX(-50%)"];
      default:
        return ["left:auto", "right:20px"];
    }
  }
  switch (value) {
    case "left":
      return ["margin-left:0", "margin-right:auto"];
    case "center":
      return ["margin-left:auto", "margin-right:auto"];
    default:
      return ["margin-left:auto", "margin-right:0"];
  }
}

function declarations(
  style: ReBannerElementStyle,
  element: ReBannerStyleElement,
  variant: string,
): string {
  const parts: string[] = [];
  for (const name of REBNR_STYLE_PROP_ORDER) {
    if (!(name in style)) continue;
    const value = style[name] as never;
    switch (name) {
      case "font_family":
        parts.push(`font-family:${REBNR_FONT_STACKS[value as ReBannerFontKey]}`);
        break;
      case "font_size":
        parts.push(`font-size:${value as number}px`);
        break;
      case "font_weight":
        parts.push(`font-weight:${value as number}`);
        break;
      case "line_height":
        parts.push(`line-height:${formatNumber(value as number)}`);
        break;
      case "letter_spacing":
        parts.push(`letter-spacing:${formatNumber(value as number)}em`);
        break;
      case "text_transform":
        parts.push(`text-transform:${value as string}`);
        break;
      case "text_align":
        parts.push(`text-align:${value as string}`);
        break;
      case "text_decoration":
        parts.push(`text-decoration:${value as string}`);
        break;
      case "color":
        parts.push(`color:${value as string}`);
        break;
      case "width":
        parts.push(`width:${value as number}px`);
        break;
      case "height":
        parts.push(`height:${value as number}px`);
        break;
      case "max_width":
        parts.push(`max-width:${value as number}px`);
        break;
      case "border_radius":
        parts.push(`border-radius:${value as number}px`);
        break;
      case "margin":
      case "padding": {
        const box = value as ReBannerSide;
        for (const side of REBNR_SIDES) {
          if (side in box) parts.push(`${name}-${side}:${box[side]}px`);
        }
        break;
      }
      case "align":
        parts.push(...alignDeclarations(value as string, element, variant));
        break;
    }
  }
  return parts.join(";");
}

function rulesFor(
  element: ReBannerStyleElement,
  style: ReBannerElementStyle,
  root: string,
  variant: string,
): [string, string][] {
  if (variant === "text") {
    // No box: the blocks carry the classes themselves, so container/body
    // mean every top-level block, and p/h1–h6 name the block itself
    // (`h1.rebnr-text.rebnr-text-3`) plus a descendant for a forced
    // `tag="div"` wrapper. li and a are only ever inside a block.
    if (element === "cta" || element === "image") return [];
    const selector =
      element === "container" || element === "body"
        ? root
        : element === "a" || element === "li"
          ? `${root} ${element}`
          : `${element}${root},${root} ${element}`;
    return [[selector, declarations(style, element, variant)]];
  }

  switch (element) {
    case "container": {
      const innerProps: ReBannerStyleProp[] = ["padding"];
      if (variant === "bar" || variant === "hero") innerProps.push("max_width");
      const inner: ReBannerElementStyle = {};
      const outer: ReBannerElementStyle = {};
      for (const key of Object.keys(style) as ReBannerStyleProp[]) {
        (innerProps.includes(key) ? inner : outer)[key] = style[key] as never;
      }
      return [
        [root, declarations(outer, element, variant)],
        [`${root} .rebnr__inner`, declarations(inner, element, variant)],
      ];
    }
    case "body":
      return [[`${root} .rebnr__body`, declarations(style, element, variant)]];
    case "cta":
      return [[`${root} .rebnr__cta`, declarations(style, element, variant)]];
    case "image":
      return [[`${root} .rebnr__image`, declarations(style, element, variant)]];
    default:
      return [
        [`${root} .rebnr__body ${element}`, declarations(style, element, variant)],
      ];
  }
}

/**
 * Banner-level alignment for the text variant. `max-width:none` is part of
 * "fills the column": themes cap `p` at a reading measure, and `width:100%`
 * alone loses to that. A per-banner max width still wins — it is emitted
 * after this rule at the same specificity.
 */
function textLayoutCss(root: string, align: unknown): string {
  if (align !== "left" && align !== "center" && align !== "right") return "";
  const tags = ["p", "h1", "h2", "h3", "h4", "h5", "h6", "li"];
  const desc = tags.map((tag) => `${root} ${tag}`).join(",");
  return `${root}{display:block;width:100%;max-width:none;text-align:${align}}${desc}{text-align:${align}}`;
}

/**
 * The stylesheet for one banner, or "" when it has no overrides. Byte-identical
 * to `Re_Banner_Styles::css()` for the same input.
 */
export function stylesToCss(config: {
  id: number;
  variant: string;
  styles: ReBannerStyles | unknown;
  align?: string;
}): string {
  const styles = normalizeStyles(config.styles);
  const id = Math.abs(Math.trunc(Number(config.id) || 0));
  const root =
    config.variant === "text"
      ? `.rebnr-text.rebnr-text-${id}`
      : `.rebnr[data-banner="${id}"]`;

  let out = config.variant === "text" ? textLayoutCss(root, config.align) : "";
  if (isEmptyStyles(styles)) return out;

  for (const element of REBNR_STYLE_ELEMENTS) {
    const style = styles[element];
    if (!style) continue;
    for (const [selector, decl] of rulesFor(element, style, root, config.variant)) {
      if (decl === "") continue;
      out += `${selector}{${decl}}`;
    }
  }
  return out;
}
