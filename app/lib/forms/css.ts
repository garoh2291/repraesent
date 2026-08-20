/**
 * The form stylesheet, as a pure function of the theme.
 *
 * Everything is scoped under a single generated class so a pasted snippet can
 * never leak styles into the host page, and the host page's own CSS reset has as
 * little purchase as possible on the form (hence the explicit resets below).
 *
 * MIRROR of nestjs-monolith/src/modules/forms/form-css.ts. The builder preview
 * and the hosted page render through this copy; the pasted HTML snippet renders
 * through the backend copy. They must produce identical CSS — change both.
 */

import { FORM_FONTS, type FormTheme } from "./schema";

const DENSITY: Record<
  FormTheme["density"],
  { gap: string; padY: string; padX: string; font: string; label: string }
> = {
  compact: {
    gap: "12px",
    padY: "8px",
    padX: "10px",
    font: "14px",
    label: "13px",
  },
  cozy: {
    gap: "18px",
    padY: "11px",
    padX: "13px",
    font: "15px",
    label: "14px",
  },
  comfortable: {
    gap: "24px",
    padY: "14px",
    padX: "16px",
    font: "16px",
    label: "15px",
  },
};

/** #rrggbb + alpha → rgba(). Falls back to the input when it isn't a hex colour. */
export function withAlpha(hex: string, alpha: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex?.trim() ?? "");
  if (!match) return hex;
  const int = Number.parseInt(match[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Pick black or white text for a background, by perceived luminance. */
export function onColor(hex: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex?.trim() ?? "");
  if (!match) return "#ffffff";
  const int = Number.parseInt(match[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.45 ? "#111111" : "#ffffff";
}

export function googleFontsHref(theme: FormTheme): string | null {
  const family = FORM_FONTS[theme.fontFamily]?.googleFamily;
  if (!family) return null;
  return `https://fonts.googleapis.com/css2?family=${family}`;
}

/**
 * Scope for the embedded form, which lives in a shadow root: `:host` is the
 * container div the customer pasted, and every other rule descends from it.
 * The builder preview and the hosted /f/:id page stay in the light DOM and
 * pass a generated class name instead.
 */
export const SHADOW_SCOPE = ":host";

export function buildFormCss(theme: FormTheme, scopeClass: string): string {
  const d = DENSITY[theme.density] ?? DENSITY.cozy;
  const font = FORM_FONTS[theme.fontFamily]?.stack ?? FORM_FONTS.system.stack;
  // A bare word is a class name; anything starting with `:` or `.` is already
  // a selector and is used verbatim.
  const s = /^[.:]/.test(scopeClass) ? scopeClass : `.${scopeClass}`;
  const radius = `${theme.radius}px`;
  const accentText = onColor(theme.accent);

  // The form renders in exactly ONE scheme — the one its theme defines — never
  // the visitor's OS setting. Without this, a light form on a machine set to
  // dark mode gets dark-painted native widgets: checkbox ticks, date pickers,
  // autofill highlights, spinners and the caret all flip, on top of a white
  // field. Derived from the surface colour, because that is what the native
  // controls actually sit on.
  const scheme = onColor(theme.surface) === "#ffffff" ? "dark" : "light";

  // Field chrome varies by style; everything else is shared.
  const fieldBase =
    theme.fieldStyle === "filled"
      ? `background: var(--rf-field-bg); border: 1px solid transparent; border-radius: ${radius};`
      : theme.fieldStyle === "underline"
        ? `background: transparent; border: 0; border-bottom: 1px solid var(--rf-border); border-radius: 0; padding-left: 0; padding-right: 0;`
        : `background: var(--rf-surface); border: 1px solid var(--rf-border); border-radius: ${radius};`;

  const fieldFocus =
    theme.fieldStyle === "underline"
      ? `border-bottom-color: var(--rf-accent); box-shadow: 0 1px 0 0 var(--rf-accent);`
      : `border-color: var(--rf-accent); box-shadow: 0 0 0 3px var(--rf-accent-ring);`;

  const button =
    theme.buttonStyle === "outline"
      ? `background: transparent; color: var(--rf-accent); border: 1px solid var(--rf-accent);`
      : theme.buttonStyle === "soft"
        ? `background: var(--rf-accent-soft); color: var(--rf-accent); border: 1px solid transparent;`
        : `background: var(--rf-accent); color: var(--rf-accent-on); border: 1px solid var(--rf-accent);`;

  return `
${s} {
  --rf-accent: ${theme.accent};
  --rf-accent-on: ${accentText};
  --rf-accent-ring: ${withAlpha(theme.accent, 0.18)};
  --rf-accent-soft: ${withAlpha(theme.accent, 0.12)};
  --rf-bg: ${theme.background};
  --rf-surface: ${theme.surface};
  --rf-surface-2: ${withAlpha(theme.text, 0.05)};
  --rf-field-bg: ${theme.fieldBackground ?? withAlpha(theme.text, 0.05)};
  --rf-text: ${theme.text};
  --rf-muted: ${theme.mutedText};
  --rf-border: ${theme.border};
  --rf-danger: #dc2626;
  --rf-radius: ${radius};
  --rf-gap: ${d.gap};
  color-scheme: ${scheme};
  font-family: ${font};
  font-size: ${d.font};
  line-height: 1.5;
  color: var(--rf-text);
  box-sizing: border-box;
  -webkit-font-smoothing: antialiased;
}
${s} *, ${s} *::before, ${s} *::after { box-sizing: inherit; }

${s} .rf-form {
  width: 100%;
  max-width: ${theme.width}px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--rf-gap);
  background: var(--rf-bg);
  padding: ${theme.padding ?? 16}px;
}

/* The honeypot must stay in the accessibility tree's blind spot without using
   display:none — a number of bots skip fields that are display:none. */
${s} .rf-hp {
  position: absolute !important;
  left: -9999px !important;
  top: auto !important;
  width: 1px !important;
  height: 1px !important;
  overflow: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

${s} .rf-head { display: flex; flex-direction: column; gap: 6px; }
${s} .rf-title {
  margin: 0;
  font-size: calc(${d.font} * 1.65);
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: var(--rf-text);
}
${s} .rf-desc { margin: 0; color: var(--rf-muted); font-size: ${d.font}; }

${s} .rf-section { display: flex; flex-direction: column; gap: var(--rf-gap); }
${s} .rf-section-title {
  margin: 0;
  font-size: calc(${d.font} * 1.15);
  font-weight: 600;
  color: var(--rf-text);
}
${s} .rf-section-desc { margin: 4px 0 0; color: var(--rf-muted); font-size: calc(${d.font} * 0.92); }

${s} .rf-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--rf-gap);
}
${s} .rf-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
${s} .rf-field.rf-full { grid-column: 1 / -1; }
@media (max-width: 560px) {
  ${s} .rf-row { grid-template-columns: minmax(0, 1fr); }
  ${s} .rf-field { grid-column: 1 / -1; }
}

/* Block, not inline-flex. A label used to be one text node, so a flex row with
   a gap was a tidy way to space the required star. Now that labels carry inline
   markup, every <b>/<i>/<a> the tokeniser emits becomes its own flex item and
   picks up that gap — "no**thing**" rendered as "no thing". Normal flow keeps
   the spans in the text they were written in; the star takes a margin instead. */
${s} .rf-label {
  font-size: ${d.label};
  font-weight: 500;
  color: var(--rf-text);
  display: block;
}
/* A label with no text at all is a legitimate choice — the placeholder names
   the field instead. The element still has to exist so a language switch can
   paint text into it, so collapse it rather than omitting it. */
${s} .rf-label:empty { display: none; }
${s} .rf-req { color: var(--rf-danger); margin-inline-start: 4px; }
${s} .rf-help { font-size: calc(${d.label} * 0.92); color: var(--rf-muted); margin: 0; }

/* Links inside copy. Nothing else in this file styles an anchor, which left
   link appearance up to whatever surrounded the form: Tailwind's preflight
   resets it to invisible in the app, while the embed's shadow root falls
   through to the UA's blue-and-underlined. Underline everywhere instead, in
   the inherited colour — the theme has no link token, and the accent belongs
   to the submit button. */
${s} .rf-label a, ${s} .rf-consent a, ${s} .rf-help a {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}
${s} .rf-label a:hover, ${s} .rf-consent a:hover, ${s} .rf-help a:hover {
  color: var(--rf-accent);
}

${s} .rf-input,
${s} .rf-textarea,
${s} .rf-select {
  width: 100%;
  font: inherit;
  font-size: ${d.font};
  color: var(--rf-text);
  padding: ${d.padY} ${d.padX};
  ${fieldBase}
  transition: border-color .15s ease, box-shadow .15s ease, background-color .15s ease;
  appearance: none;
  -webkit-appearance: none;
}
${s} .rf-textarea { min-height: 120px; resize: vertical; }
${s} .rf-select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23888' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right ${d.padX} center;
  padding-right: calc(${d.padX} * 2 + 12px);
}
${s} .rf-input::placeholder, ${s} .rf-textarea::placeholder { color: var(--rf-muted); opacity: .75; }
${s} .rf-input:focus, ${s} .rf-textarea:focus, ${s} .rf-select:focus {
  outline: none;
  ${fieldFocus}
}
${s} .rf-input[aria-invalid="true"],
${s} .rf-textarea[aria-invalid="true"],
${s} .rf-select[aria-invalid="true"] {
  border-color: var(--rf-danger);
}

/* Choice groups.

   Checkboxes and radios are drawn from scratch rather than left native. Two
   reasons: the native widget ignores the theme (a host page's CSS reset can
   zero its border and leave the unchecked state looking filled), and the pasted
   snippet has to survive whatever reset the customer's site already applies.
   The tick and dot are inlined as data-URI SVGs in the on-accent colour, which
   is computed here, so no CSS variable indirection is needed inside them. */
${s} .rf-choices { display: flex; flex-direction: column; gap: 8px; }
${s} .rf-choice {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  font-size: ${d.font};
  color: var(--rf-text);
  cursor: pointer;
  line-height: 1.45;
}
${s} .rf-choice input[type="checkbox"],
${s} .rf-choice input[type="radio"] {
  appearance: none;
  -webkit-appearance: none;
  margin: 2px 0 0;
  width: 17px;
  height: 17px;
  flex: none;
  cursor: pointer;
  background: var(--rf-surface);
  border: 1px solid var(--rf-border);
  background-repeat: no-repeat;
  background-position: center;
  transition: background-color .12s ease, border-color .12s ease;
}
${s} .rf-choice input[type="checkbox"] { border-radius: ${Math.min(theme.radius, 5)}px; }
${s} .rf-choice input[type="radio"] { border-radius: 50%; }
${s} .rf-choice input:focus-visible {
  outline: none;
  border-color: var(--rf-accent);
  box-shadow: 0 0 0 3px var(--rf-accent-ring);
}
${s} .rf-choice input[type="checkbox"]:checked {
  background-color: var(--rf-accent);
  border-color: var(--rf-accent);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='9' viewBox='0 0 11 9' fill='none'%3E%3Cpath d='M1 4.5L4 7.5L10 1.5' stroke='${encodeURIComponent(
    accentText,
  )}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
}
${s} .rf-choice input[type="radio"]:checked {
  background-color: var(--rf-accent);
  border-color: var(--rf-accent);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='6' viewBox='0 0 6 6'%3E%3Ccircle cx='3' cy='3' r='3' fill='${encodeURIComponent(
    accentText,
  )}'/%3E%3C/svg%3E");
}
${s} .rf-consent { align-items: flex-start; }

/* Rating + scale */
${s} .rf-rating { display: flex; gap: 4px; }
${s} .rf-star {
  background: none; border: 0; padding: 2px; cursor: pointer; line-height: 0;
  color: var(--rf-border); transition: color .12s ease, transform .12s ease;
}
${s} .rf-star svg { width: 26px; height: 26px; display: block; }
${s} .rf-star.rf-on { color: var(--rf-accent); }
${s} .rf-star:hover { transform: scale(1.08); }

${s} .rf-scale { display: flex; flex-wrap: wrap; gap: 6px; }
${s} .rf-scale-btn {
  min-width: 38px;
  padding: 8px 6px;
  font: inherit;
  font-size: calc(${d.font} * 0.94);
  color: var(--rf-text);
  background: var(--rf-surface);
  border: 1px solid var(--rf-border);
  border-radius: ${radius};
  cursor: pointer;
  transition: all .12s ease;
}
${s} .rf-scale-btn.rf-on {
  background: var(--rf-accent);
  border-color: var(--rf-accent);
  color: var(--rf-accent-on);
}

/* Appointment slot picker. Day chips and slot buttons share the scale-button
   language — bordered surface, accent when on — so a form with both reads as
   one control set. The strip scrolls rather than wraps: seven chips at compact
   density overflow a half-width column, and wrapping them makes the nav
   arrows meaningless. */
${s} .rf-appt { display: flex; flex-direction: column; gap: 10px; }
${s} .rf-appt-nav { display: flex; align-items: center; gap: 6px; }
${s} .rf-appt-days { display: flex; flex: 1; gap: 6px; min-width: 0; overflow-x: auto; }
${s} .rf-appt-day {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  min-width: 44px;
  padding: 6px 4px;
  font: inherit;
  font-size: calc(${d.font} * 0.82);
  color: var(--rf-text);
  background: var(--rf-surface);
  border: 1px solid var(--rf-border);
  border-radius: ${radius};
  cursor: pointer;
  transition: all .12s ease;
}
${s} .rf-appt-day-num { font-weight: 600; font-size: calc(${d.font} * 0.94); }
${s} .rf-appt-day.rf-on {
  background: var(--rf-accent);
  border-color: var(--rf-accent);
  color: var(--rf-accent-on);
}
${s} .rf-appt-day[disabled] {
  color: var(--rf-muted);
  text-decoration: line-through;
  cursor: not-allowed;
  opacity: .55;
}
${s} .rf-appt-prev, ${s} .rf-appt-next {
  flex: none;
  width: 26px;
  padding: 4px 0;
  font: inherit;
  font-size: ${d.font};
  line-height: 1;
  color: var(--rf-muted);
  background: transparent;
  border: 0;
  border-radius: ${radius};
  cursor: pointer;
  transition: color .12s ease;
}
${s} .rf-appt-prev:hover, ${s} .rf-appt-next:hover { color: var(--rf-accent); }
${s} .rf-appt-prev[disabled], ${s} .rf-appt-next[disabled] {
  opacity: .35;
  cursor: not-allowed;
}
${s} .rf-appt-slots {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 6px;
}
${s} .rf-appt-slot {
  padding: 8px 6px;
  font: inherit;
  font-size: calc(${d.font} * 0.94);
  color: var(--rf-text);
  background: var(--rf-surface);
  border: 1px solid var(--rf-border);
  border-radius: ${radius};
  cursor: pointer;
  transition: all .12s ease;
}
${s} .rf-appt-slot.rf-on {
  background: var(--rf-accent);
  border-color: var(--rf-accent);
  color: var(--rf-accent-on);
}
${s} .rf-appt-empty, ${s} .rf-appt-loading {
  grid-column: 1 / -1;
  color: var(--rf-muted);
  font-size: calc(${d.font} * 0.92);
}

/* Address */
${s} .rf-address { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
${s} .rf-address .rf-street { grid-column: 1 / -1; }
@media (max-width: 560px) { ${s} .rf-address { grid-template-columns: minmax(0, 1fr); } }

/* Errors */
${s} .rf-err {
  margin: 0;
  font-size: calc(${d.label} * 0.92);
  color: var(--rf-danger);
  min-height: 0;
}
${s} .rf-err:empty { display: none; }

/* Language switcher */
${s} .rf-lang { display: flex; gap: 6px; align-self: flex-end; }
${s} .rf-lang-btn {
  font: inherit;
  font-size: calc(${d.label} * 0.9);
  text-transform: uppercase;
  letter-spacing: .04em;
  padding: 5px 10px;
  /* The theme's radius, same as the submit button. A pill here next to a
     square-cornered button read as two different design systems on one form. */
  border-radius: ${radius};
  border: 1px solid var(--rf-border);
  background: transparent;
  color: var(--rf-muted);
  cursor: pointer;
  transition: all .12s ease;
}
${s} .rf-lang-btn.rf-on {
  background: var(--rf-accent);
  border-color: var(--rf-accent);
  color: var(--rf-accent-on);
}

/* Submit */
${s} .rf-actions { display: flex; }
${s} .rf-submit {
  font: inherit;
  font-size: ${d.font};
  font-weight: 500;
  padding: calc(${d.padY} + 1px) calc(${d.padX} * 1.8);
  border-radius: ${radius};
  cursor: pointer;
  ${button}
  ${theme.buttonFullWidth ? "width: 100%;" : ""}
  transition: opacity .15s ease, transform .05s ease;
}
${s} .rf-submit:hover { opacity: .9; }
${s} .rf-submit:active { transform: translateY(1px); }
${s} .rf-submit[disabled] { opacity: .55; cursor: not-allowed; }

/* In-flight spinner. Disabling alone reads as "the button broke", especially on
   a slow connection where nothing else on the page changes. currentColor, so it
   works against every button style without a second token. */
${s} .rf-submit[aria-busy="true"] {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
}
${s} .rf-spin {
  width: 1em; height: 1em; flex: none;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: rf-spin .6s linear infinite;
}
@keyframes rf-spin { to { transform: rotate(360deg); } }
/* Respect the OS setting: a spinner is decoration, and the disabled state
   already carries the meaning. */
@media (prefers-reduced-motion: reduce) {
  ${s} .rf-spin { animation-duration: 2.4s; }
}

/* Inline status */
${s} .rf-status { font-size: ${d.font}; }
${s} .rf-status:empty { display: none; }
${s} .rf-status.rf-ok {
  color: var(--rf-text);
  background: var(--rf-accent-soft);
  border: 1px solid ${withAlpha(theme.accent, 0.25)};
  border-radius: ${radius};
  padding: ${d.padY} ${d.padX};
}
${s} .rf-status.rf-bad { color: var(--rf-danger); }

/* Success modal */
${s} .rf-modal {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, .55);
}
${s} .rf-modal[hidden] { display: none; }
${s} .rf-modal-card {
  background: var(--rf-surface);
  color: var(--rf-text);
  border-radius: calc(${radius} + 4px);
  padding: 28px;
  max-width: 420px;
  width: 100%;
  text-align: center;
  box-shadow: 0 24px 60px rgba(0, 0, 0, .25);
}
${s} .rf-modal-title { margin: 0 0 8px; font-size: calc(${d.font} * 1.35); font-weight: 600; }
${s} .rf-modal-body { margin: 0 0 20px; color: var(--rf-muted); }
${s} .rf-modal-close {
  font: inherit;
  padding: ${d.padY} calc(${d.padX} * 1.6);
  border-radius: ${radius};
  cursor: pointer;
  ${button}
}
`.trim();
}
