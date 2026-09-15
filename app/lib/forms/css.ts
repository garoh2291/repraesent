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

  // The paint actually behind an input, whichever style is in play. Only the
  // filled style has a token for it, and Chrome's autofill rule below has to
  // repaint the real one.
  const fieldFill =
    theme.fieldStyle === "filled"
      ? "var(--rf-field-bg)"
      : theme.fieldStyle === "underline"
        ? "var(--rf-bg)"
        : "var(--rf-surface)";

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
  --rf-field-text: ${theme.fieldText ?? theme.text};
  --rf-text: ${theme.text};
  --rf-muted: ${theme.mutedText};
  --rf-border: ${theme.border};
  --rf-danger: #dc2626;
  --rf-radius: ${radius};
  --rf-gap: ${d.gap};
  /* One spring for every piece of motion on the form: step changes, the
     progress fill, the money tick. A damped spring (~1.7% overshoot, settles in
     about 420ms) encoded as a CSS linear() easing; browsers without linear()
     get a plain ease-out below. */
  --rf-spring: linear(0, 0.009, 0.035 2.1%, 0.141 4.4%, 0.723 12.9%, 0.938 16.7%, 1.017 20.6%, 1.043 24.7%, 1.037 28.9%, 1.001 40.4%, 0.994 49.3%, 1);
  --rf-dur: 420ms;
  /* Step travel: direction (1 forward, -1 back) and distance. */
  --rf-dir: 1;
  --rf-shift: 28px;
  color-scheme: ${scheme};
  font-family: ${font};
  font-size: ${d.font};
  line-height: 1.5;
  color: var(--rf-text);
  box-sizing: border-box;
  -webkit-font-smoothing: antialiased;
}
${s} *, ${s} *::before, ${s} *::after { box-sizing: inherit; }
@supports not (animation-timing-function: linear(0, 1)) {
  ${s} { --rf-spring: cubic-bezier(0.16, 1, 0.3, 1); }
}

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

/* Inline submit: one input, one button, one row.

   The button is a grid child of .rf-row rather than a block underneath, so the
   row becomes "everything, then the button" and the auto column takes exactly
   the button's width. align-items: end lines the button's bottom up with the
   input's, whether or not the field carries a label above it.

   Below the breakpoint it stacks like everything else — a full-width input and
   a full-width button read better than two squeezed halves on a phone. */
${s} .rf-inline .rf-row {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
}
${s} .rf-inline .rf-field.rf-full { grid-column: auto; }
${s} .rf-inline .rf-submit-cell { justify-content: flex-end; }
@media (max-width: 560px) {
  ${s} .rf-inline .rf-row { grid-template-columns: minmax(0, 1fr); }
  ${s} .rf-inline .rf-field.rf-full { grid-column: 1 / -1; }
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
${s} .rf-title:empty, ${s} .rf-desc:empty { display: none; }
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
  color: var(--rf-field-text);
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
/* Autofill. Chrome paints its own fill and text on an autofilled field, which
   undoes the theme and can hide the value exactly the way a light input text on
   a light field does. background-color is ignored there, so the fill is faked
   with an inset shadow and the text forced with -webkit-text-fill-color; the
   absurd transition delay keeps Chrome's own fade from painting over it. */
${s} .rf-input:-webkit-autofill,
${s} .rf-textarea:-webkit-autofill,
${s} .rf-select:-webkit-autofill {
  -webkit-text-fill-color: var(--rf-field-text);
  caret-color: var(--rf-field-text);
  box-shadow: 0 0 0 1000px ${fieldFill} inset;
  transition: background-color 5000s ease-in-out 0s;
}
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
/* Co-hosts. Wraps rather than scrolls: this sits above the day strip, and a
   second horizontal scroller next to that one is a trap on a phone. */
${s} .rf-appt-hosts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
}
${s} .rf-appt-hosts:empty { display: none; }
${s} .rf-appt-host {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
${s} .rf-appt-host-av {
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  border-radius: 50%;
  object-fit: cover;
  background: var(--rf-surface);
  border: 1px solid var(--rf-border);
}
${s} .rf-appt-host-ini {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--rf-muted);
  font-size: calc(${d.font} * 0.78);
  line-height: 1;
}
${s} .rf-appt-host-nm {
  min-width: 0;
  font-size: calc(${d.font} * 0.92);
  color: var(--rf-text);
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

/* Screen-reader only. */
${s} .rf-sr {
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap;
}

/* ── Multi-step ─────────────────────────────────────────────────────────── */
/* Progress: bar */
${s} .rf-progress {
  height: 4px;
  border-radius: 999px;
  background: var(--rf-surface-2);
  overflow: hidden;
}
${s} .rf-progress-bar {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--rf-accent);
  transition: width var(--rf-dur) var(--rf-spring);
}

/* Progress: steps — thin segments with a name, not numbered circles. The
   segment is the ::before; the row underneath carries the number and title. */
${s} .rf-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 8px;
}
${s} .rf-step-dot {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--rf-muted);
  font-size: calc(${d.label} * 0.9);
}
${s} .rf-step-dot::before {
  content: "";
  display: block;
  height: 4px;
  border-radius: 999px;
  background: var(--rf-surface-2);
  transition: background-color .25s ease;
}
${s} .rf-step-dot.rf-on::before, ${s} .rf-step-dot.rf-done::before { background: var(--rf-accent); }
${s} .rf-step-dot.rf-on { color: var(--rf-text); }
${s} .rf-step-dot.rf-done { cursor: pointer; }
${s} .rf-step-dot.rf-done:hover { color: var(--rf-text); }
${s} .rf-step-num {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  margin-inline-end: 6px;
}
${s} .rf-step-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 560px) { ${s} .rf-step-title { display: none; } }

/* Steps: only the active one is in flow. The one being left animates out
   absolutely positioned, so the form's height follows the incoming step alone
   — the iframe's height reporter never sees two steps stacked. */
${s} .rf-steps-wrap { position: relative; }
${s} .rf-step[hidden] { display: none; }
${s} .rf-step.rf-step-enter { animation: rf-step-in var(--rf-dur) var(--rf-spring) both; }
${s} .rf-step.rf-step-exit {
  position: absolute;
  top: 0; left: 0; width: 100%;
  pointer-events: none;
  animation: rf-step-out .2s ease both;
}
@keyframes rf-step-in {
  from { opacity: 0; transform: translateX(calc(var(--rf-shift) * var(--rf-dir))); }
  to { opacity: 1; transform: none; }
}
@keyframes rf-step-out {
  from { opacity: 1; transform: none; }
  to { opacity: 0; transform: translateX(calc(var(--rf-shift) * var(--rf-dir) * -1)); }
}

/* Navigation row */
${s} .rf-nav { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
${s} .rf-step-of {
  color: var(--rf-muted);
  font-size: calc(${d.label} * 0.9);
  font-variant-numeric: tabular-nums;
  margin-inline-end: auto;
  order: 1;
}
${s} .rf-back { order: 0; }
${s} .rf-next, ${s} .rf-nav .rf-submit { order: 2; }
${s} .rf-back, ${s} .rf-next {
  font: inherit;
  font-size: ${d.font};
  font-weight: 500;
  padding: calc(${d.padY} + 1px) calc(${d.padX} * 1.8);
  border-radius: ${radius};
  cursor: pointer;
  transition: opacity .15s ease, transform .08s ease, background-color .15s ease;
}
${s} .rf-next { ${button} }
${s} .rf-next:hover { opacity: .9; }
${s} .rf-back {
  background: transparent;
  color: var(--rf-muted);
  border: 1px solid var(--rf-border);
}
${s} .rf-back:hover { color: var(--rf-text); background: var(--rf-surface-2); }
${s} .rf-back[hidden], ${s} .rf-next[hidden], ${s} .rf-nav .rf-submit[hidden] { display: none; }
${
  theme.buttonFullWidth
    ? `${s} .rf-back, ${s} .rf-next, ${s} .rf-nav .rf-submit { width: 100%; }
${s} .rf-step-of { width: 100%; text-align: center; order: 3; margin-inline-end: 0; }`
    : ""
}

/* ── Product forms ──────────────────────────────────────────────────────── */
${s} .rf-notice {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  color: var(--rf-text);
  background: var(--rf-accent-soft);
  border: 1px solid ${withAlpha(theme.accent, 0.25)};
  border-radius: ${radius};
  padding: ${d.padY} ${d.padX};
  font-size: calc(${d.font} * 0.94);
}
${s} .rf-notice[hidden], ${s} .rf-notice:empty { display: none; }
${s} .rf-notice-close {
  font: inherit;
  line-height: 1;
  border: 0;
  background: transparent;
  color: var(--rf-muted);
  cursor: pointer;
  padding: 0 2px;
}
${s} .rf-notice-close:hover { color: var(--rf-text); }

${s} .rf-commerce {
  /* Lives among the fields (the product field's slot) and always spans the row. */
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: ${d.padX};
  border: 1px solid var(--rf-border);
  border-radius: calc(${radius} + 2px);
  background: var(--rf-surface);
}
${s} .rf-commerce-title {
  margin: 0;
  font-size: calc(${d.font} * 1.05);
  font-weight: 600;
  color: var(--rf-text);
}
${s} .rf-commerce-lines { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
${s} .rf-commerce-line { display: flex; align-items: center; gap: 12px; min-width: 0; transition: opacity .15s ease; }
/* The buyer picks lines: a native checkbox first, and an unticked line steps
   back so the total reads as "what you chose", not "what exists". */
${s} .rf-commerce-check {
  flex: none;
  width: 18px; height: 18px; margin: 0;
  accent-color: var(--rf-accent);
  cursor: pointer;
}
${s} .rf-commerce-line[data-rf-off] .rf-commerce-info,
${s} .rf-commerce-line[data-rf-off] .rf-commerce-img,
${s} .rf-commerce-line[data-rf-off] .rf-commerce-line-total,
${s} .rf-commerce-line[data-rf-off] .rf-qty { opacity: .45; }
${s} .rf-commerce-line[data-rf-off] .rf-qty-btn { cursor: default; }
${s} .rf-commerce > .rf-err { margin-top: -4px; }
${s} .rf-commerce-img {
  flex: none;
  width: 48px; height: 48px;
  object-fit: cover;
  border-radius: ${Math.min(theme.radius, 8)}px;
  background: var(--rf-surface-2);
}
${s} .rf-commerce-img.rf-empty { display: inline-flex; align-items: center; justify-content: center; color: var(--rf-muted); }
${s} .rf-commerce-info { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
${s} .rf-commerce-name { font-weight: 500; color: var(--rf-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
${s} .rf-commerce-price { display: flex; align-items: center; gap: 6px; color: var(--rf-muted); font-size: calc(${d.font} * 0.92); font-variant-numeric: tabular-nums; }
${s} .rf-commerce-badge {
  font-size: calc(${d.label} * 0.8);
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--rf-accent-soft);
  color: var(--rf-accent);
  white-space: nowrap;
}
${s} .rf-commerce-badge[hidden], ${s} .rf-commerce-badge:empty { display: none; }
${s} .rf-money { font-variant-numeric: tabular-nums; }
${s} .rf-money[data-tick] { display: inline-block; animation: rf-pop .28s var(--rf-spring); }
@keyframes rf-pop { from { transform: scale(1.06); } to { transform: none; } }
${s} .rf-commerce-line-total { flex: none; font-weight: 600; color: var(--rf-text); min-width: 5ch; text-align: right; font-variant-numeric: tabular-nums; }

/* Quantity stepper — borrows the field tokens so it reads as one control set. */
${s} .rf-qty {
  display: inline-flex;
  align-items: stretch;
  flex: none;
  border: 1px solid var(--rf-border);
  border-radius: ${radius};
  background: var(--rf-surface);
  overflow: hidden;
}
${s} .rf-qty-btn {
  font: inherit;
  font-size: ${d.font};
  width: 32px;
  border: 0;
  background: transparent;
  color: var(--rf-text);
  cursor: pointer;
  transition: background-color .12s ease, transform .08s ease;
}
${s} .rf-qty-btn:hover { background: var(--rf-surface-2); }
${s} .rf-qty-btn:active { transform: scale(.9); }
${s} .rf-qty-btn[disabled] { opacity: .35; cursor: not-allowed; transform: none; }
${s} .rf-qty-input {
  width: 3.2em;
  text-align: center;
  font: inherit;
  font-size: calc(${d.font} * 0.94);
  font-variant-numeric: tabular-nums;
  color: var(--rf-field-text);
  border: 0;
  border-left: 1px solid var(--rf-border);
  border-right: 1px solid var(--rf-border);
  background: transparent;
  -moz-appearance: textfield;
  appearance: textfield;
}
${s} .rf-qty-input:focus { outline: none; box-shadow: inset 0 0 0 2px var(--rf-accent-ring); }
${s} .rf-qty-input::-webkit-outer-spin-button, ${s} .rf-qty-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
${s} .rf-qty-fixed { flex: none; color: var(--rf-muted); font-size: calc(${d.font} * 0.92); font-variant-numeric: tabular-nums; }

${s} .rf-commerce-total {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: baseline;
  gap: 2px 12px;
  padding-top: 12px;
  border-top: 1px solid var(--rf-border);
  font-size: calc(${d.font} * 1.05);
}
${s} .rf-commerce-total strong { font-weight: 600; color: var(--rf-text); font-size: calc(${d.font} * 1.15); font-variant-numeric: tabular-nums; }
${s} .rf-commerce-then { grid-column: 1 / -1; color: var(--rf-muted); font-size: calc(${d.font} * 0.88); text-align: right; }
${s} .rf-commerce-then[hidden], ${s} .rf-commerce-then:empty { display: none; }
${s} .rf-commerce-secure {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--rf-muted);
  font-size: calc(${d.label} * 0.85);
}
${s} .rf-commerce-secure svg { width: 12px; height: 12px; flex: none; }
@media (max-width: 560px) {
  ${s} .rf-commerce-line { flex-wrap: wrap; }
  ${s} .rf-commerce-line-total { margin-inline-start: auto; }
}

/* Checkout outcome (hosted thank-you page) */
${s} .rf-outcome { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: calc(${d.padX} * 1.5) 0; }
${s} .rf-outcome-icon {
  width: 44px; height: 44px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: var(--rf-accent-soft);
  color: var(--rf-accent);
  animation: rf-pop var(--rf-dur) var(--rf-spring);
}
${s} .rf-outcome-icon svg { width: 22px; height: 22px; }
${s} .rf-outcome-title { margin: 0; font-size: calc(${d.font} * 1.35); font-weight: 600; color: var(--rf-text); }
${s} .rf-outcome-body { margin: 0; color: var(--rf-muted); max-width: 42ch; }
${s} .rf-outcome-amount { font-variant-numeric: tabular-nums; color: var(--rf-text); font-weight: 500; }
${s} .rf-outcome-cta { margin-top: 6px; }

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
/* Press feedback on pointer-down, shared with Back / Next: one press language. */
${s} .rf-submit:active, ${s} .rf-next:active, ${s} .rf-back:active { transform: scale(.985); }
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
  /* Motion becomes a short crossfade: no travel, no overshoot, no press scale. */
  ${s} { --rf-shift: 0px; --rf-dur: 180ms; --rf-spring: ease; }
  ${s} .rf-step.rf-step-exit { animation-duration: .12s; }
  ${s} .rf-progress-bar { transition-duration: .15s; transition-timing-function: linear; }
  ${s} .rf-submit:active, ${s} .rf-next:active, ${s} .rf-back:active, ${s} .rf-qty-btn:active { transform: none; }
  ${s} .rf-money[data-tick], ${s} .rf-outcome-icon { animation: none; }
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
