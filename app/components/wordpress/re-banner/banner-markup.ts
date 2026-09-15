import type { ReBannerConfig } from "~/lib/wordpress/plugin-settings-types";
import { effectiveAlign, isBlankHtml } from "~/components/wordpress/re-banner/constants";

/**
 * The plugin's frontend markup, re-drawn in TypeScript for the preview iframe.
 *
 * Mirrors `Re_Banner_Frontend::markup()` / `text_markup()` and the string
 * helpers in `Re_Banner_Text` — same class names, same element order, the
 * same "no wrapper: the blocks carry the classes" rule — so the preview loads
 * the real `banner.css` and the real override CSS against the real structure. Keep in step with the PHP; the
 * class names here are the plugin's public contract with theme authors, so
 * they change rarely.
 *
 * `body_html` is inserted unescaped, exactly as the site does: it was kses'd
 * by the plugin on write, and the iframe is sandboxed besides.
 */

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtml(s: string): string {
  return escapeAttr(s);
}

/* ── Re_Banner_Text ports ─────────────────────────────────────────────── */

const BLOCK_PATTERN = /<(?:h[1-6]|p|div|ul|ol|li|blockquote|figure|table|hr)\b/i;
const INLINE_TAGS = new Set(["a", "strong", "b", "em", "i", "u", "s", "small", "mark", "sub", "sup", "code", "span", "br"]);

export function hasBlockLevel(html: string): boolean {
  return BLOCK_PATTERN.test(html);
}

export function resolveTag(tag: string, html: string): string {
  const t = String(tag || "").trim().toLowerCase();
  const known = ["span", "div", "p", "h1", "h2", "h3", "h4", "h5", "h6"];
  if (t === "" || t === "auto" || !known.includes(t)) {
    return hasBlockLevel(html) ? "div" : "span";
  }
  return t;
}

export function allowsBlocks(tag: string): boolean {
  return tag.toLowerCase() === "div";
}

/** Narrow to phrasing content: unwrap blocks to spaces, drop non-inline tags. */
export function toInline(html: string): string {
  let out = html
    .replace(/<\/(?:p|h[1-6]|li|ul|ol|blockquote|div|figure|tr|td|th)\s*>/gi, " ")
    .replace(/<hr\b[^>]*>/gi, " ");
  out = out.replace(/<(\/?)([a-zA-Z0-9]+)([^>]*)>/g, (m, slash: string, name: string) =>
    INLINE_TAGS.has(name.toLowerCase()) ? m : "",
  );
  return out.replace(/\s+/g, " ").trim();
}

export function downgradeHeadings(html: string): string {
  return html.replace(/<(\/?)h[1-6]\b[^>]*>/gi, "<$1strong>");
}

const TOP_BLOCK_TAGS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "blockquote", "hr"]);
const VOID_TAGS = new Set(["br", "hr", "img", "wbr"]);

/**
 * `Re_Banner_Text::tag_blocks()`: put the classes on the content's own
 * top-level blocks — `<h1>Sale</h1>` → `<h1 class="rebnr-text …">Sale</h1>` —
 * so there is no wrapper and the heading the editor chose IS the banner
 * element. Returns null when the fragment is not a plain run of blocks (words
 * outside any block, a stray closing tag); the caller then falls back to a
 * wrapper.
 */
export function tagBlocks(html: string, className: string): string | null {
  if (html.trim() === "") return null;

  const tokens = html.split(/(<[^>]+>)/).filter((t) => t !== "");
  let depth = 0;
  let blocks = 0;
  let out = "";

  for (let token of tokens) {
    if (!token.startsWith("<")) {
      if (depth === 0 && token.trim() !== "") return null;
      out += token;
      continue;
    }

    const m = /^<(\/?)([a-z][a-z0-9]*)\b([^>]*?)(\/?)>$/i.exec(token);
    if (!m) return null;

    const closing = m[1] === "/";
    const name = m[2].toLowerCase();
    const isVoid = VOID_TAGS.has(name) || m[4] === "/";

    if (closing) {
      if (depth < 1) return null;
      depth--;
      out += token;
      continue;
    }

    if (depth === 0) {
      if (!TOP_BLOCK_TAGS.has(name)) return null;
      token = addClass(token, className);
      blocks++;
    }

    if (!isVoid) depth++;
    out += token;
  }

  return depth !== 0 || blocks === 0 ? null : out;
}

function addClass(tag: string, className: string): string {
  const existing = /\sclass\s*=\s*(["'])(.*?)\1/i.exec(tag);
  if (existing) {
    return tag.replace(existing[0], ` class="${`${className} ${existing[2]}`.trim()}"`);
  }
  const m = /^(.*?)\s*(\/?)>$/s.exec(tag);
  if (!m) return tag;
  return `${m[1]} class="${className}"${m[2] === "/" ? " />" : ">"}`;
}

/* ── Markup ──────────────────────────────────────────────────────────── */

export function textClasses(config: Pick<ReBannerConfig, "text_style">, id: number): string[] {
  const classes = ["rebnr-text"];
  if (id > 0) classes.push(`rebnr-text-${id}`);
  const style = (config.text_style || "plain").replace(/[^A-Za-z0-9_-]/g, "");
  if (style && style !== "plain") classes.push(`rebnr-text--${style}`);
  return classes;
}

/**
 * `Re_Banner_Frontend::text_markup()` for the preview: no inline <style>, that
 * is added by the frame. `tag` is the shortcode's `tag=` attribute — the
 * preview never sets one, so the content's own blocks carry the classes, and
 * inline words get a <span>.
 */
export function renderTextMarkup(config: ReBannerConfig, id: number, tag = ""): string {
  let body = config.body_html.trim();
  if (isBlankHtml(body)) return "";

  const className = escapeAttr(textClasses(config, id).join(" "));
  const requested = tag.trim().toLowerCase();
  const forced = requested !== "" && requested !== "auto" && /^(?:span|div|p|h[1-6])$/.test(requested) ? requested : "";

  if (forced === "") {
    const tagged = tagBlocks(body, className);
    if (tagged !== null) return tagged;
  }

  const wrapper = resolveTag(forced, body);

  if (!allowsBlocks(wrapper)) {
    if (/^h[1-6]$/.test(wrapper)) body = downgradeHeadings(body);
    body = toInline(body);
    if (body === "") return "";
  }

  return `<${wrapper} class="${className}">${body}</${wrapper}>`;
}

/** `Re_Banner_Frontend::markup()` for the four box variants. Dismissal is drawn but inert. */
export function renderBoxMarkup(
  config: ReBannerConfig,
  id: number,
  imageUrl: string | null,
): string {
  const variant = config.variant;
  const position = config.position || "top";
  const align = effectiveAlign(variant, config.align);
  const name = config.name.trim();
  const body = isBlankHtml(config.body_html) ? "" : config.body_html.trim();
  const ctaLabel = config.cta_label.trim();
  const hasCta =
    ctaLabel !== "" &&
    (config.cta_type === "url" ? config.cta_url.trim() !== "" : config.cta_post_id > 0);

  const vars =
    `--rebnr-accent:${config.accent_color || "#ffffff"};` +
    `--rebnr-fg:${config.text_color || "#ffffff"};` +
    `--rebnr-bg:${config.bg_color || "#0a0a0a"};`;

  // A dismissible banner on the site carries `data-dismissible="1"` — which
  // banner.css answers with the pinned close button and the room for it —
  // and stays `visibility:hidden` until banner.js adds `rebnr--ready`. The
  // preview has no banner.js, so it adds the class itself: same layout, no
  // flash of nothing.
  const dismissAttrs = config.dismissible
    ? ' data-dismissible="1"'
    : ' data-dismissible="0"';
  const classes = `rebnr rebnr--${escapeAttr(variant)}${config.dismissible ? " rebnr--ready" : ""}`;

  const parts: string[] = [];
  parts.push(
    `<div class="${classes}" data-variant="${escapeAttr(variant)}" ` +
      `data-position="${escapeAttr(position)}" data-align="${align}" data-banner="${id}"${dismissAttrs} ` +
      `style="${escapeAttr(vars)}" role="region" aria-label="${escapeAttr(name || "Site banner")}">`,
  );

  const media =
    imageUrl && variant !== "bar"
      ? `<div class="rebnr__media"><img class="rebnr__image" loading="lazy" alt="" src="${escapeAttr(imageUrl)}" /></div>`
      : "";

  if (variant === "hero") parts.push(media);
  parts.push('<div class="rebnr__inner">');
  if (variant !== "hero") parts.push(media);

  if (body !== "") {
    parts.push(`<div class="rebnr__body">${body}</div>`);
  }

  if (hasCta) {
    parts.push(
      `<a class="rebnr__cta" href="#" onclick="return false"${config.cta_new_tab ? ' target="_blank" rel="noopener noreferrer"' : ""}>${escapeHtml(ctaLabel)}</a>`,
    );
  }

  if (config.dismissible) {
    parts.push('<button type="button" class="rebnr__dismiss" aria-label="Dismiss banner">&times;</button>');
  }

  parts.push("</div></div>");
  return parts.join("");
}
