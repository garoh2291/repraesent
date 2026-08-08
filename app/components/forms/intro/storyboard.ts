import type { TFunction } from "i18next";
import { copyFromDefault } from "~/lib/forms/content";
import { createField, emptyDefinition } from "~/lib/forms/field-types";
import {
  contentKey,
  flattenFields,
  type FormDefinition,
  type FormFieldMapping,
  type FormFieldType,
  type FormLocale,
} from "~/lib/forms/schema";
import type { Chapter, DemoState } from "./types";

/** The language the demo adds in chapter 4 — anything but the viewer's own. */
export function secondLocale(primary: FormLocale): FormLocale {
  return primary === "fr" ? "de" : "fr";
}

export function initialState(locale: FormLocale, t: TFunction): DemoState {
  const base = emptyDefinition(locale);
  return {
    screen: "list",
    name: "",
    definition: {
      ...base,
      // A real form arrives with a title and a submit caption already set, so
      // seed them — otherwise the canvas shows its "Untitled form" ghost for
      // the whole demo, which is not what a new form actually looks like.
      content: {
        ...base.content,
        [locale]: {
          ...(base.content?.[locale] ?? {}),
          [contentKey.formTitle()]: t("forms.intro.demo.formTitle"),
          [contentKey.formSubmit()]: t("forms.intro.demo.submit"),
        },
      },
    },
    locales: [locale],
    defaultLocale: locale,
    activeLocale: locale,
    tab: "build",
    selection: null,
    live: false,
    copied: false,
  };
}

/** Append a field the way the real route's `addField` does, then label it. */
function addField(
  state: DemoState,
  type: FormFieldType,
  label: string,
  mapping?: FormFieldMapping,
): DemoState {
  const taken = new Set(flattenFields(state.definition).map((f) => f.key));
  const base = createField(type, taken);
  // createField already maps e-mail and phone; a plain short_text has no way to
  // know it is the name field, and "Save to: Custom field" on a Name input is
  // exactly the mistake the demo should not be teaching.
  const field = mapping ? { ...base, mapping } : base;
  const lastIndex = state.definition.sections.length - 1;

  const definition: FormDefinition = {
    ...state.definition,
    sections: state.definition.sections.map((section, i) =>
      i === lastIndex
        ? { ...section, fields: [...section.fields, field] }
        : section,
    ),
    content: {
      ...state.definition.content,
      [state.activeLocale]: {
        ...(state.definition.content?.[state.activeLocale] ?? {}),
        [contentKey.fieldLabel(field.id)]: label,
      },
    },
  };

  return {
    ...state,
    definition,
    selection: { kind: "field", fieldId: field.id },
  };
}

const PALETTE = (type: FormFieldType) => `[data-field-type="${type}"]`;
/** Unique inside the canvas, and it tracks the bottom of the growing form. */
const SUBMIT_ROW = ".rf-canvas .rf-actions";
/** The accent the Design chapter picks — shared by the step and the outcome. */
const ACCENT = "#5265f3";
const TAB = (value: string) =>
  `[data-slot="tabs-trigger"][id$="-trigger-${value}"]`;

/**
 * The script. Every `at` is a CSS selector the director measures live, so the
 * cursor lands on the real control rather than on a coordinate someone guessed.
 *
 * Note the demo never dispatches real clicks — the cursor is decorative and the
 * state changes come from `run`. That is deliberate: a real click on the palette
 * or the language strip would open a Radix dropdown in a portal at
 * `document.body`, outside the camera's coordinate space, where it could be
 * neither framed nor pointed at.
 */
export function buildStoryboard(
  t: TFunction,
  locale: FormLocale,
): Chapter[] {
  const second = secondLocale(locale);
  const formName = t("forms.intro.demo.formName");

  const fieldPlan: {
    type: FormFieldType;
    label: string;
    mapping?: FormFieldMapping;
  }[] = [
    { type: "short_text", label: t("forms.intro.demo.name"), mapping: "full_name" },
    { type: "email", label: t("forms.intro.demo.email") },
    { type: "phone", label: t("forms.intro.demo.phone") },
    { type: "long_text", label: t("forms.intro.demo.message") },
  ];

  return [
    {
      id: "create",
      key: "create",
      outcome: (s) => ({ ...s, screen: "dialog" }),
      steps: [
        { kind: "camera" },
        { kind: "wait", ms: 500 },
        { kind: "move", at: '[data-demo="new-form"]' },
        { kind: "wait", ms: 200 },
        { kind: "click", run: (s) => ({ ...s, screen: "dialog" }) },
        { kind: "wait", ms: 500 },
      ],
    },
    {
      id: "name",
      key: "name",
      outcome: (s) => ({ ...s, name: formName, screen: "builder" }),
      steps: [
        { kind: "camera", at: '[data-demo="dialog-name"]' },
        { kind: "move", at: '[data-demo="dialog-name"]' },
        { kind: "click" },
        {
          kind: "type",
          text: formName,
          run: (s, typed) => ({ ...s, name: typed }),
        },
        { kind: "move", at: '[data-demo="dialog-create"]' },
        {
          kind: "click",
          run: (s) => ({ ...s, screen: "builder" }),
        },
        { kind: "wait", ms: 600 },
      ],
    },
    {
      id: "fields",
      key: "fields",
      outcome: (s) =>
        fieldPlan.reduce(
          (acc, f) => addField(acc, f.type, f.label, f.mapping),
          s,
        ),
      steps: [
        { kind: "camera" },
        { kind: "wait", ms: 400 },
        ...fieldPlan.flatMap(({ type, label, mapping }) => [
          { kind: "move" as const, at: PALETTE(type) },
          {
            kind: "click" as const,
            run: (s: DemoState) => addField(s, type, label, mapping),
          },
          // Follow the form's submit row: it sits at the bottom of the form and
          // slides down as fields are added, so the field that just landed is
          // always the one in view. Without this the 3rd and 4th fields
          // appeared below the fold and you never saw them arrive.
          { kind: "camera" as const, at: SUBMIT_ROW, ms: 420 },
          { kind: "wait" as const, ms: 420 },
        ]),
        { kind: "camera" },
        { kind: "wait", ms: 900 },
      ],
    },
    {
      id: "language",
      key: "language",
      outcome: (s) => ({
        ...s,
        locales: s.locales.includes(second) ? s.locales : [...s.locales, second],
        definition: copyFromDefault(s.definition, second, s.defaultLocale),
      }),
      steps: [
        {
          kind: "camera",
          at: '[data-demo="strip"]',
        },
        { kind: "move", at: '[data-demo="strip"] [class*="border-dashed"]' },
        { kind: "wait", ms: 250 },
        {
          kind: "click",
          run: (s) => ({
            ...s,
            locales: [...s.locales, second],
            activeLocale: second,
            definition: copyFromDefault(s.definition, second, s.defaultLocale),
          }),
        },
        { kind: "wait", ms: 1100 },
        // Back to the default language so the rest of the demo reads normally.
        {
          kind: "act",
          run: (s) => ({ ...s, activeLocale: s.defaultLocale }),
        },
        { kind: "wait", ms: 400 },
      ],
    },
    {
      id: "design",
      key: "design",
      outcome: (s) => ({
        ...s,
        tab: "design",
        selection: null,
        definition: {
          ...s.definition,
          theme: { ...s.definition.theme, accent: ACCENT },
        },
      }),
      steps: [
        { kind: "camera", at: TAB("design") },
        { kind: "move", at: TAB("design") },
        {
          kind: "click",
          run: (s) => ({ ...s, tab: "design", selection: null }),
        },
        { kind: "wait", ms: 700 },
        { kind: "camera", at: "#theme-accent-picker" },
        { kind: "move", at: "#theme-accent-picker" },
        {
          kind: "click",
          run: (s) => ({
            ...s,
            definition: {
              ...s.definition,
              theme: { ...s.definition.theme, accent: ACCENT },
            },
          }),
        },
        { kind: "wait", ms: 500 },
        { kind: "camera" },
        { kind: "wait", ms: 1100 },
      ],
    },
    {
      id: "share",
      key: "share",
      outcome: (s) => ({ ...s, tab: "share" }),
      steps: [
        { kind: "camera", at: TAB("share") },
        { kind: "move", at: TAB("share") },
        { kind: "click", run: (s) => ({ ...s, tab: "share" }) },
        { kind: "wait", ms: 800 },
        // Frame the exact element the cursor is going to touch. Framing the
        // whole (tall) Share panel instead pushed this input above the viewport
        // once the camera clamped to the panel's centre.
        { kind: "camera", at: '[data-demo="share"] input[readonly]' },
        { kind: "move", at: '[data-demo="share"] input[readonly]' },
        { kind: "click", run: (s) => ({ ...s, copied: true }) },
        { kind: "wait", ms: 1400 },
        { kind: "act", run: (s) => ({ ...s, copied: false }) },
      ],
    },
    {
      id: "publish",
      key: "publish",
      outcome: (s) => ({ ...s, live: true }),
      steps: [
        { kind: "camera", at: '[data-demo="live"]' },
        { kind: "move", at: '[data-demo="live"]' },
        { kind: "wait", ms: 250 },
        { kind: "click", run: (s) => ({ ...s, live: true }) },
        { kind: "wait", ms: 1200 },
        { kind: "camera" },
        { kind: "wait", ms: 1200 },
      ],
    },
  ];
}

/** Fold the outcome of every chapter before `index` into the seed. */
export function stateAtChapter(
  chapters: Chapter[],
  index: number,
  seed: DemoState,
): DemoState {
  return chapters.slice(0, index).reduce((acc, c) => c.outcome(acc), seed);
}
