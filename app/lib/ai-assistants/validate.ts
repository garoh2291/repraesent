/**
 * Client mirror of the assistant config zod schemas
 * (`nestjs-monolith/src/modules/ai-assistants/ai-assistant.types.ts`).
 *
 * Same idea as the forms builder's `validateDefinition` (`lib/forms/validate.ts`):
 * one issue PER offending field, in draft order, each carrying the tab that owns
 * the fix and the dotted config path the control is anchored to. The tab strip
 * turns the list into red count badges and Save reads it before it lets you
 * spend a round trip on a 400.
 *
 * The server is still the authority — a failed save merges `extractIssues(error)`
 * into this same list through `tabForPath`, so a rule only the backend knows
 * (or one added later) still lands on the right tab instead of a toast.
 */
import {
  AI_LOCALES,
  WIDGET_STRING_KEYS,
  withAppearanceDefaults,
  type AiLocale,
  type AssistantDraft,
  type WidgetStrings,
} from "~/lib/api/ai-assistants";

/** The detail route's tab ids — `TABS` in `routes/ai-assistants.$assistantId.tsx`. */
export const ASSISTANT_TABS = [
  "knowledge",
  "behaviour",
  "appearance",
  "actions",
  "tests",
  "conversations",
  "publish",
  "playground",
] as const;
export type AssistantTab = (typeof ASSISTANT_TABS)[number];

export interface AssistantIssue {
  /**
   * What is wrong. Client codes have an i18n key under
   * `aiAssistants.validation.<code>`; `"server"` carries the backend's own
   * (already human) message in `message`.
   */
  code: string;
  /** Which tab owns the fix — drives the count badge on the tab strip. */
  tab: AssistantTab;
  /** Dotted path into the config block, rooted the same way the API reports it. */
  path: string;
  /** Set for server issues (and anything with no useful i18n key). */
  message?: string;
  /** Set for per-locale string issues, so the copy can name the language. */
  locale?: string;
  /** Set for action issues — the action's stable id, for opening its editor. */
  actionId?: string;
}

/** `id` of the wrapper that anchors a config path in the DOM. */
export function fieldAnchorId(path: string): string {
  return `ai-field-${path}`;
}

// ---------------------------------------------------------------------------
// path → tab
// ---------------------------------------------------------------------------

/**
 * Where a config path is edited. Note that most of `persona` lives on the
 * APPEARANCE tab (display name, greeting, suggested questions) — only the
 * model-facing parts of the persona sit under Behaviour.
 */
export function tabForPath(path: string): AssistantTab {
  const p = path.trim();
  if (p.startsWith("persona.")) {
    const key = p.slice("persona.".length).split(".")[0];
    return key === "custom_instructions" ||
      key === "tone" ||
      key === "language_mode" ||
      key === "fixed_locale"
      ? "behaviour"
      : "appearance";
  }
  if (p.startsWith("appearance.")) return "appearance";
  if (p === "widget_type") return "appearance";
  if (p.startsWith("lead_capture") || p.startsWith("actions")) return "actions";
  if (p.startsWith("fallback_contact")) return "actions";
  if (p.startsWith("business_profile")) return "knowledge";
  return "behaviour";
}

/** Turn one API issue (`extractIssues`) into an `AssistantIssue`. */
export function issueFromServer(raw: {
  path: string;
  message: string;
}): AssistantIssue {
  const locale = raw.path.match(/^appearance\.strings\.([a-z]{2})\./)?.[1];
  return {
    code: "server",
    tab: tabForPath(raw.path),
    path: raw.path,
    message: raw.message,
    ...(locale ? { locale } : {}),
  };
}

// ---------------------------------------------------------------------------
// limits (kept in lockstep with the zod schemas)
// ---------------------------------------------------------------------------

export const MAX_SUGGESTED_QUESTIONS = 6;
export const MAX_ACTIONS = 6;
export const MAX_LEAD_FIELDS = 5;
export const MAX_PAGE_PATTERNS = 20;
export const MAX_ALLOWED_DOMAINS = 20;
export const MAX_INSTRUCTIONS = 1000;
export const MAX_BUSINESS_NAME = 120;
export const MAX_KEY_PEOPLE = 5;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
/** Mirrors the widget's origin check: bare hosts, optionally wildcarded. */
const DOMAIN = /^[a-z0-9.-]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `z.string().max(n)` per key of `widgetStringsSchema`. */
const STRING_MAX: Record<keyof WidgetStrings, number> = {
  greeting: 400,
  placeholder: 120,
  launcher_label: 60,
  header_subtitle: 120,
  send: 40,
  powered_by: 60,
  lead_intro: 400,
  lead_thanks: 400,
  lead_submit: 40,
  lead_skip: 40,
  error_generic: 200,
  section_title: 120,
  section_subtitle: 240,
  nudge_text: 120,
  bar_placeholder: 120,
  feedback_thanks: 120,
};

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// validateDraft
// ---------------------------------------------------------------------------

export function validateDraft(draft: AssistantDraft | null): AssistantIssue[] {
  if (!draft) return [];
  const out: AssistantIssue[] = [];
  const push = (i: AssistantIssue) => out.push(i);

  // --- business ------------------------------------------------------------
  const businessName = (draft.business_name ?? "").trim();
  if (!businessName) {
    push({
      code: "businessNameMissing",
      tab: "behaviour",
      path: "business_name",
    });
  } else if (businessName.length > MAX_BUSINESS_NAME) {
    push({
      code: "businessNameTooLong",
      tab: "behaviour",
      path: "business_name",
    });
  }
  const profile = draft.business_profile;
  if (profile) {
    const email = profile.email?.trim() ?? "";
    if (email && !EMAIL.test(email)) {
      push({
        code: "profileEmailInvalid",
        tab: "knowledge",
        path: "business_profile.email",
      });
    }
    if ((profile.key_people ?? []).length > MAX_KEY_PEOPLE) {
      push({
        code: "tooManyKeyPeople",
        tab: "knowledge",
        path: "business_profile.key_people",
      });
    }
  }

  // --- persona -------------------------------------------------------------
  const persona = draft.persona;
  if (!persona.display_name.trim()) {
    push({
      code: "displayNameMissing",
      tab: "appearance",
      path: "persona.display_name",
    });
  }
  const questions = persona.suggested_questions ?? [];
  if (questions.length > MAX_SUGGESTED_QUESTIONS) {
    push({
      code: "tooManyQuestions",
      tab: "appearance",
      path: "persona.suggested_questions",
    });
  }
  questions.forEach((q, i) => {
    if (!q.trim()) {
      push({
        code: "blankQuestion",
        tab: "appearance",
        path: `persona.suggested_questions.${i}`,
      });
    }
  });
  if ((persona.custom_instructions ?? "").length > MAX_INSTRUCTIONS) {
    push({
      code: "instructionsTooLong",
      tab: "behaviour",
      path: "persona.custom_instructions",
    });
  }

  // --- appearance ----------------------------------------------------------
  const ap = withAppearanceDefaults(draft.appearance ?? {});
  if (!HEX_COLOR.test(ap.primary_color ?? "")) {
    push({
      code: "invalidColor",
      tab: "appearance",
      path: "appearance.primary_color",
    });
  }
  if (ap.avatar_mode === "image") {
    const url = ap.avatar_url?.trim() ?? "";
    if (!url) {
      push({
        code: "avatarUrlMissing",
        tab: "appearance",
        path: "appearance.avatar_url",
      });
    } else if (!isHttpUrl(url)) {
      push({
        code: "avatarUrlInvalid",
        tab: "appearance",
        path: "appearance.avatar_url",
      });
    }
  }
  if (ap.launcher_icon === "image") {
    const url = ap.launcher_image_url?.trim() ?? "";
    if (!url) {
      push({
        code: "launcherImageMissing",
        tab: "appearance",
        path: "appearance.launcher_image_url",
      });
    } else if (!isHttpUrl(url)) {
      push({
        code: "launcherImageInvalid",
        tab: "appearance",
        path: "appearance.launcher_image_url",
      });
    }
  }
  for (const axis of ["offset_x", "offset_y"] as const) {
    const v = ap[axis];
    if (!Number.isInteger(v) || v < 0 || v > 200) {
      push({
        code: "offsetOutOfRange",
        tab: "appearance",
        path: `appearance.${axis}`,
      });
    }
  }
  for (const key of ["auto_open", "nudge"] as const) {
    const v = ap[key].delay_seconds;
    if (!Number.isInteger(v) || v < 0 || v > 120) {
      push({
        code: "delayOutOfRange",
        tab: "appearance",
        path: `appearance.${key}.delay_seconds`,
      });
    }
  }
  const patterns = ap.page_rules.patterns ?? [];
  if (patterns.length > MAX_PAGE_PATTERNS) {
    push({
      code: "tooManyPatterns",
      tab: "appearance",
      path: "appearance.page_rules.patterns",
    });
  }
  patterns.forEach((p, i) => {
    if (!p.trim()) {
      push({
        code: "blankPattern",
        tab: "appearance",
        path: `appearance.page_rules.patterns.${i}`,
      });
    }
  });
  for (const locale of AI_LOCALES as readonly AiLocale[]) {
    const strings = ap.strings?.[locale];
    if (!strings) continue;
    for (const key of WIDGET_STRING_KEYS) {
      const value = strings[key];
      if (typeof value === "string" && value.length > STRING_MAX[key]) {
        push({
          code: "stringTooLong",
          tab: "appearance",
          path: `appearance.strings.${locale}.${key}`,
          locale,
        });
      }
    }
  }

  // --- lead capture --------------------------------------------------------
  const lc = draft.lead_capture;
  if (lc) {
    const fields = lc.fields ?? [];
    if (fields.length > MAX_LEAD_FIELDS) {
      push({
        code: "tooManyLeadFields",
        tab: "actions",
        path: "lead_capture.fields",
      });
    }
    if (lc.enabled && fields.length === 0) {
      push({
        code: "leadFieldsEmpty",
        tab: "actions",
        path: "lead_capture.fields",
      });
    }
    const turns = lc.trigger?.after_turns;
    if (
      turns != null &&
      (!Number.isInteger(turns) || turns < 1 || turns > 20)
    ) {
      push({
        code: "afterTurnsOutOfRange",
        tab: "actions",
        path: "lead_capture.trigger.after_turns",
      });
    }
    if ((lc.intro_text ?? "").length > 400) {
      push({
        code: "introTooLong",
        tab: "actions",
        path: "lead_capture.intro_text",
      });
    }
    if ((lc.thank_you_text ?? "").length > 400) {
      push({
        code: "thanksTooLong",
        tab: "actions",
        path: "lead_capture.thank_you_text",
      });
    }
  }

  // --- actions -------------------------------------------------------------
  const actions = draft.actions ?? [];
  if (actions.length > MAX_ACTIONS) {
    push({ code: "tooManyActions", tab: "actions", path: "actions" });
  }
  actions.forEach((a, i) => {
    const at = (suffix: string) => `actions.${i}.${suffix}`;
    if (!a.label.trim()) {
      push({
        code: "actionLabelMissing",
        tab: "actions",
        path: at("label"),
        actionId: a.id,
      });
    }
    if (a.type === "link") {
      const url = a.url?.trim() ?? "";
      if (!url) {
        push({
          code: "actionUrlMissing",
          tab: "actions",
          path: at("url"),
          actionId: a.id,
        });
      } else if (!isHttpUrl(url)) {
        push({
          code: "actionUrlInvalid",
          tab: "actions",
          path: at("url"),
          actionId: a.id,
        });
      }
    } else if (a.type === "book") {
      if (!a.appointment?.targetKey?.trim()) {
        push({
          code: "actionAppointmentMissing",
          tab: "actions",
          path: at("appointment"),
          actionId: a.id,
        });
      }
    } else if (a.type === "call") {
      if (!a.phone?.trim()) {
        push({
          code: "actionPhoneMissing",
          tab: "actions",
          path: at("phone"),
          actionId: a.id,
        });
      }
    } else {
      const email = a.email?.trim() ?? "";
      if (!email) {
        push({
          code: "actionEmailMissing",
          tab: "actions",
          path: at("email"),
          actionId: a.id,
        });
      } else if (!EMAIL.test(email)) {
        push({
          code: "actionEmailInvalid",
          tab: "actions",
          path: at("email"),
          actionId: a.id,
        });
      }
    }
  });

  // --- allowed domains -----------------------------------------------------
  const domains = draft.allowed_domains ?? [];
  if (domains.length > MAX_ALLOWED_DOMAINS) {
    push({ code: "tooManyDomains", tab: "behaviour", path: "allowed_domains" });
  }
  domains.forEach((d, i) => {
    if (!DOMAIN.test(d.replace(/^\*\./, ""))) {
      push({
        code: "invalidDomain",
        tab: "behaviour",
        path: `allowed_domains.${i}`,
      });
    }
  });

  return out;
}

/** `{ behaviour: 2, appearance: 1, … }` — what the tab badges count. */
export function issuesByTab(
  issues: AssistantIssue[],
): Partial<Record<AssistantTab, number>> {
  const out: Partial<Record<AssistantTab, number>> = {};
  for (const i of issues) out[i.tab] = (out[i.tab] ?? 0) + 1;
  return out;
}

/**
 * Merge server issues into the local list, dropping the ones the client already
 * reports for the same path so a 400 does not double every badge.
 */
export function mergeIssues(
  local: AssistantIssue[],
  server: AssistantIssue[],
): AssistantIssue[] {
  const seen = new Set(local.map((i) => i.path));
  return [...local, ...server.filter((i) => !seen.has(i.path))];
}
