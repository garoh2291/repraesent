import {
  apiClient,
  getStoredToken,
  getStoredWorkspaceId,
} from "./axios-instance";

// ---------------------------------------------------------------------------
// Types — mirror nestjs-monolith/src/modules/ai-assistants/ai-assistant.types.ts
// ---------------------------------------------------------------------------

export const AI_LOCALES = ["en", "de", "fr", "nl"] as const;
export type AiLocale = (typeof AI_LOCALES)[number];

export type AssistantStatus = "draft" | "published";
export const WIDGET_TYPES = ["bubble", "section", "page", "bar"] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];
export type SourceType = "website" | "document" | "text" | "description";
export type SourceStatus =
  | "pending"
  | "uploading"
  | "queued"
  | "crawling"
  | "parsing"
  | "embedding"
  | "ready"
  | "failed";

export const LEAD_FIELD_KEYS = [
  "name",
  "email",
  "phone",
  "company",
  "message",
] as const;
export type LeadFieldKey = (typeof LEAD_FIELD_KEYS)[number];

export interface WidgetStrings {
  greeting?: string;
  placeholder?: string;
  launcher_label?: string;
  header_subtitle?: string;
  send?: string;
  powered_by?: string;
  lead_intro?: string;
  lead_thanks?: string;
  lead_submit?: string;
  lead_skip?: string;
  error_generic?: string;
  section_title?: string;
  section_subtitle?: string;
  nudge_text?: string;
  bar_placeholder?: string;
  feedback_thanks?: string;
}
export const WIDGET_STRING_KEYS = [
  "greeting",
  "placeholder",
  "launcher_label",
  "header_subtitle",
  "send",
  "powered_by",
  "lead_intro",
  "lead_thanks",
  "lead_submit",
  "lead_skip",
  "error_generic",
  "section_title",
  "section_subtitle",
  "nudge_text",
  "bar_placeholder",
  "feedback_thanks",
] as const satisfies ReadonlyArray<keyof WidgetStrings>;

export type PersonaTone = "friendly" | "formal" | "concise";

export interface PersonaConfig {
  display_name: string;
  tone: PersonaTone;
  greeting: string;
  suggested_questions: string[];
  language_mode: "visitor" | "fixed";
  fixed_locale?: AiLocale;
  custom_instructions: string;
}

export type WidgetFont = "system" | "inherit" | "geist";
export type WidgetRadius = "sm" | "md" | "lg" | "pill";
export type WidgetDensity = "compact" | "comfortable";
export type WidgetHeaderStyle = "solid" | "gradient" | "minimal";
export type LauncherIcon = "chat" | "sparkle" | "question" | "image";
export type LauncherSize = "sm" | "md" | "lg";
export type PageRulesMode = "all" | "include" | "exclude";

/**
 * `page` derives the whole palette from the host page's own background and
 * text colour; `auto` is the old behaviour and follows the *visitor's* OS,
 * which is why a dark-mode visitor used to get a black slab on a cream site.
 */
export const WIDGET_THEMES = ["page", "auto", "light", "dark"] as const;
export type WidgetTheme = (typeof WIDGET_THEMES)[number];

export const WIDGET_SHADOWS = ["none", "soft", "strong"] as const;
export type WidgetShadow = (typeof WIDGET_SHADOWS)[number];

export const WIDGET_HEIGHTS = ["compact", "standard", "tall"] as const;
export type WidgetHeight = (typeof WIDGET_HEIGHTS)[number];

/** Optional hex overrides applied ON TOP of the resolved base palette. */
export interface WidgetColors {
  background?: string;
  surface?: string;
  text?: string;
  muted?: string;
  border?: string;
  user_bubble?: string;
  assistant_bubble?: string;
}
export const WIDGET_COLOR_KEYS = [
  "background",
  "surface",
  "text",
  "muted",
  "border",
  "user_bubble",
  "assistant_bubble",
] as const satisfies ReadonlyArray<keyof WidgetColors>;

/** Shape/space limits — kept in lockstep with the zod schema. */
export const RADIUS_PX_MIN = 0;
export const RADIUS_PX_MAX = 32;
export const BORDER_WIDTH_MAX = 3;
export const MAX_WIDTH_MIN = 320;
export const MAX_WIDTH_MAX = 1200;
export const MARGIN_Y_MAX = 96;

export interface AppearanceConfig {
  primary_color: string;
  /** Icons/text drawn ON the accent colour. "auto" picks by luminance. */
  accent_foreground: "auto" | "light" | "dark";
  theme: WidgetTheme;
  /** Empty = follow the page (or the light/dark base for a fixed theme). */
  colors: WidgetColors;
  /** null = use the `radius` preset. 0 gives genuinely square corners. */
  radius_px: number | null;
  border_width: number;
  shadow: WidgetShadow;
  /** Embedded types only. null = the built-in per-type width. */
  max_width: number | null;
  /** Embedded types only — the fix for sitting flush against the page header. */
  margin_y: number;
  height: WidgetHeight;
  position: "right" | "left";
  avatar_mode: "initial" | "image";
  avatar_url?: string;
  launcher_label?: string;
  header_subtitle?: string;
  show_powered_by: boolean;
  font: WidgetFont;
  radius: WidgetRadius;
  density: WidgetDensity;
  header_style: WidgetHeaderStyle;
  launcher_icon: LauncherIcon;
  launcher_image_url?: string;
  launcher_size: LauncherSize;
  offset_x: number;
  offset_y: number;
  auto_open: {
    enabled: boolean;
    delay_seconds: number;
    once_per_visitor: boolean;
  };
  nudge: { enabled: boolean; text: string; delay_seconds: number };
  hide_on_mobile: boolean;
  page_rules: { mode: PageRulesMode; patterns: string[] };
  strings: Partial<Record<AiLocale, WidgetStrings>>;
}

/** Fills v1 rows that predate the style/launcher/page fields. */
export const APPEARANCE_DEFAULTS: Omit<
  AppearanceConfig,
  | "primary_color"
  | "accent_foreground"
  | "theme"
  | "colors"
  | "position"
  | "avatar_mode"
  | "show_powered_by"
  | "strings"
> = {
  radius_px: null,
  border_width: 1,
  shadow: "soft",
  max_width: null,
  margin_y: 24,
  height: "standard",
  font: "system",
  radius: "lg",
  density: "comfortable",
  header_style: "solid",
  launcher_icon: "chat",
  launcher_size: "md",
  offset_x: 20,
  offset_y: 20,
  auto_open: { enabled: false, delay_seconds: 5, once_per_visitor: true },
  nudge: { enabled: false, text: "", delay_seconds: 8 },
  hide_on_mobile: false,
  page_rules: { mode: "all", patterns: [] },
};

export function withAppearanceDefaults(
  ap: Partial<AppearanceConfig>,
): AppearanceConfig {
  return {
    primary_color: "#111111",
    accent_foreground: "auto",
    // "page" is the recommended default: it matches the site the widget is
    // embedded in instead of the visitor's operating system.
    theme: "page",
    position: "right",
    avatar_mode: "initial",
    show_powered_by: true,
    strings: {},
    ...APPEARANCE_DEFAULTS,
    ...ap,
    // Nullable/numeric shape fields: an older row omits them entirely, and a
    // partial server answer can carry an explicit undefined. Both fall back.
    colors: { ...(ap.colors ?? {}) },
    radius_px: ap.radius_px ?? null,
    max_width: ap.max_width ?? null,
    border_width: ap.border_width ?? APPEARANCE_DEFAULTS.border_width,
    margin_y: ap.margin_y ?? APPEARANCE_DEFAULTS.margin_y,
    shadow: ap.shadow ?? APPEARANCE_DEFAULTS.shadow,
    height: ap.height ?? APPEARANCE_DEFAULTS.height,
    auto_open: { ...APPEARANCE_DEFAULTS.auto_open, ...(ap.auto_open ?? {}) },
    nudge: { ...APPEARANCE_DEFAULTS.nudge, ...(ap.nudge ?? {}) },
    page_rules: { ...APPEARANCE_DEFAULTS.page_rules, ...(ap.page_rules ?? {}) },
  };
}

// Actions / fallback / answer length -----------------------------------------

export const ACTION_TYPES = ["link", "book", "call", "email"] as const;
export type ActionType = (typeof ACTION_TYPES)[number];
export const ACTION_SHOW = [
  "on_lead_intent",
  "always",
  "after_first_answer",
] as const;
export type ActionShow = (typeof ACTION_SHOW)[number];

/**
 * Booking rules on a `book` action — structurally identical to the forms
 * appointment field (`lib/forms/schema.ts`), because both are served by the
 * same backend availability/booking service.
 */
export interface ActionAppointmentSettings {
  /** Cross-source booking target: `google:<acc>:<cal>` / `microsoft:` / `caldav:` / `baikal:<configId>`. */
  targetKey?: string;
  /** Legacy Google pair, dual-written alongside a `google:` targetKey. */
  accountId?: string;
  calendarId?: string;
  /** Calendars that block slots, or "all" (resolved at request time). */
  busyCalendarKeys: string[] | "all";
  durationMinutes: number;
  /** Wall-clock bookable window in `timezone`, "HH:mm". */
  window: { start: string; end: string };
  weekdays: string[];
  timezone: string;
  minNoticeHours?: number;
  maxDaysAhead?: number;
  /**
   * The person the visitor is booking with — shown on the booking card and
   * added as an attendee on the created event. Denormalised on purpose: the
   * public config must never expose a user id, so the backend strips
   * `hostUserId` and forwards only the display fields.
   */
  hostUserId?: string;
  hostName?: string;
  hostAvatarUrl?: string;
  hostEmail?: string;
  hostRole?: string;
}

export const ACTION_APPOINTMENT_DEFAULTS: ActionAppointmentSettings = {
  busyCalendarKeys: "all",
  durationMinutes: 30,
  window: { start: "09:00", end: "17:00" },
  weekdays: ["mon", "tue", "wed", "thu", "fri"],
  timezone: "Europe/Berlin",
  minNoticeHours: 2,
  maxDaysAhead: 30,
};

export interface ActionConfig {
  id: string;
  type: ActionType;
  label: string;
  labels: Partial<Record<AiLocale, string>>;
  url?: string;
  /**
   * Legacy: the Baikal booking page a book action used to link out to. The
   * backend migrates it to `appointment.targetKey` on read; nothing writes it.
   */
  config_id?: string;
  appointment?: ActionAppointmentSettings;
  phone?: string;
  email?: string;
  show: ActionShow;
}

/**
 * Resolved CTA as the widget (and the SSE `actions` event) receives it.
 * `mode: "link"` navigates to `href`; `mode: "inline_booking"` opens the slot
 * picker inside the chat and carries only display metadata.
 */
export interface ActionItem {
  id: string;
  type: ActionType;
  label: string;
  mode?: "link" | "inline_booking";
  href?: string;
  action_id?: string;
  timezone?: string;
  duration_minutes?: number;
}

export interface FallbackContact {
  phone: string;
  email: string;
  text: string;
}
export const EMPTY_FALLBACK_CONTACT: FallbackContact = {
  phone: "",
  email: "",
  text: "",
};

export const ANSWER_LENGTHS = ["short", "medium", "long"] as const;
export type AnswerLength = (typeof ANSWER_LENGTHS)[number];
export const ANSWER_LENGTH_TOKENS: Record<AnswerLength, number> = {
  short: 220,
  medium: 600,
  long: 1100,
};

export interface LeadCaptureField {
  key: LeadFieldKey;
  required: boolean;
}

export interface LeadCaptureConfig {
  enabled: boolean;
  fields: LeadCaptureField[];
  trigger: {
    on_intent: boolean;
    /**
     * "thanks, bye" ends the conversation with the contact form. Optional
     * because snapshots written before it exists have no value; every read
     * defaults it to `true`.
     */
    on_farewell?: boolean;
    after_turns: number | null;
  };
  intro_text: string;
  thank_you_text: string;
}

export interface AssistantSummary {
  id: string;
  name: string;
  slug: string;
  status: AssistantStatus;
  widget_type: WidgetType;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  conversations_30d: number;
  leads_30d: number;
  sources_total: number;
  sources_ready: number;
}

export interface AssistantUsageToday {
  messages: number;
  tokens_in: number;
  tokens_out: number;
  blocked: number;
  leads: number;
  cost_micro_usd: number;
}

/** Facts the assistant may state as authoritative (`<business_facts>`). */
export interface BusinessProfile {
  legal_name: string;
  brand_name: string;
  tagline: string;
  address: string;
  registration: { court: string; number: string; vat_id: string; ein: string };
  phone: string;
  email: string;
  opening_hours: string;
  languages: string[];
  locations: string[];
  services: string[];
  pricing: string[];
  key_people: Array<{ name: string; role: string }>;
  founded: string;
  notes: string;
}

export const EMPTY_BUSINESS_PROFILE: BusinessProfile = {
  legal_name: "",
  brand_name: "",
  tagline: "",
  address: "",
  registration: { court: "", number: "", vat_id: "", ein: "" },
  phone: "",
  email: "",
  opening_hours: "",
  languages: [],
  locations: [],
  services: [],
  pricing: [],
  key_people: [],
  founded: "",
  notes: "",
};

/** Fill in whatever an older record (or a partial server answer) left out. */
export function withProfileDefaults(
  p: Partial<BusinessProfile> | null | undefined,
): BusinessProfile {
  const base = p ?? {};
  return {
    ...EMPTY_BUSINESS_PROFILE,
    ...base,
    registration: {
      ...EMPTY_BUSINESS_PROFILE.registration,
      ...(base.registration ?? {}),
    },
    languages: base.languages ?? [],
    locations: base.locations ?? [],
    services: base.services ?? [],
    pricing: base.pricing ?? [],
    key_people: base.key_people ?? [],
  };
}

/** `auto` = filled by the crawler; `edited` = hand-edited, recrawls leave it alone. */
export type BusinessProfileMode = "auto" | "edited";

export interface RetrievalConfig {
  /** Listwise re-rank of the top hits — slower, more precise. Default off. */
  rerank: boolean;
}

/** What visitors may attach in the public chat. */
export interface AttachmentsConfig {
  enabled: boolean;
  images: boolean;
  documents: boolean;
}

export const DEFAULT_ATTACHMENTS: AttachmentsConfig = {
  enabled: true,
  images: true,
  documents: true,
};

export interface AssistantRecord {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  status: AssistantStatus;
  widget_type: WidgetType;
  business_name: string;
  business_description: string;
  business_profile: BusinessProfile;
  business_profile_mode: BusinessProfileMode;
  business_profile_updated_at: string | null;
  retrieval: RetrievalConfig;
  attachments: AttachmentsConfig;
  chat_model: string;
  temperature: number;
  max_output_tokens: number;
  daily_token_budget: number | null;
  allowed_domains: string[];
  persona: PersonaConfig;
  appearance: AppearanceConfig;
  lead_capture: LeadCaptureConfig;
  actions: ActionConfig[];
  answer_length: AnswerLength;
  fallback_contact: FallbackContact;
  published_at: string | null;
  has_unpublished_changes: boolean;
  created_at: string;
  updated_at: string;
  usage_today: AssistantUsageToday;
}

/** The editable slice of an AssistantRecord. */
export type AssistantDraft = Pick<
  AssistantRecord,
  | "name"
  | "widget_type"
  | "business_name"
  | "business_description"
  | "business_profile"
  | "retrieval"
  | "attachments"
  | "chat_model"
  | "temperature"
  | "max_output_tokens"
  | "daily_token_budget"
  | "allowed_domains"
  | "persona"
  | "appearance"
  | "lead_capture"
  | "actions"
  | "answer_length"
  | "fallback_contact"
>;
export type UpdateAssistantDto = Partial<AssistantDraft>;

export interface ChatModelOption {
  id: string;
  label: string;
}

export interface SourceProgress {
  pages_done?: number;
  pages_total?: number;
  chunks_done?: number;
}

export type RecrawlInterval = "weekly" | "monthly" | null;

export type CrawlLanguages = "primary" | "all";
export interface CrawlOptions {
  /** `primary` skips /de/, /fr/ … mirrors of pages already taken. */
  languages: CrawlLanguages;
  /** Path prefixes never crawled, e.g. `/blog/`. */
  exclude_paths: string[];
}
export const CRAWL_LIMIT_MIN = 10;
export const CRAWL_LIMIT_MAX = 300;
export const CRAWL_LIMIT_DEFAULT = 50;
export const DEFAULT_CRAWL_OPTIONS: CrawlOptions = {
  languages: "primary",
  exclude_paths: [],
};

export interface KnowledgeSource {
  id: string;
  type: SourceType;
  status: SourceStatus;
  enabled: boolean;
  recrawl_interval: RecrawlInterval;
  next_sync_at: string | null;
  title: string;
  url: string | null;
  crawl_limit: number | null;
  crawl_options: CrawlOptions | null;
  /** URLs the crawler discovered before ranking; null for non-website sources. */
  discovered_count: number | null;
  /** Discovered pages left out (other languages / excluded paths). */
  skipped_count: number | null;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  page_count: number | null;
  chunk_count: number | null;
  last_error: string | null;
  last_synced_at: string | null;
  progress: SourceProgress | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSourceDto {
  type: "website" | "text";
  title: string;
  url?: string;
  crawl_limit?: number;
  crawl_options?: CrawlOptions;
  raw_text?: string;
}

export interface SourceDocument {
  id: string;
  url: string | null;
  title: string;
  char_count: number;
  updated_at: string;
  chunk_count: number;
  has_content: boolean;
}

export interface SourceDocumentContent {
  id: string;
  url: string | null;
  title: string;
  content_md: string;
  updated_at: string;
}

export interface TestResult {
  passed: boolean;
  decision: GuardDecision | string;
  best_similarity: number | null;
  classifier: string | null;
  answer?: string;
  missing_keywords: string[];
  ran_at: string;
  with_llm: boolean;
}

export interface AssistantTest {
  id: string;
  question: string;
  expected_keywords: string[];
  last_result: TestResult | null;
  last_run_at: string | null;
}

export interface RunTestsResult {
  items: AssistantTest[];
  passed: number;
  failed: number;
}

export interface GapItem {
  normalized: string;
  question: string;
  count: number;
  last_at: string;
  gate: number;
  off_topic: number;
  dont_know: number;
  conversation_ids: string[];
}

export interface GapsResponse {
  items: GapItem[];
  total_unanswered: number;
}

export interface PresignResponse {
  source_id: string;
  upload_url: string;
  headers: Record<string, string>;
}

export interface ConversationSummary {
  id: string;
  channel: string;
  visitor_id: string | null;
  page_url: string | null;
  locale: string | null;
  lead_id: string | null;
  message_count: number;
  assistant_turns: number;
  first_message: string | null;
  last_message_at: string | null;
  created_at: string;
}

export interface ConversationPage {
  items: ConversationSummary[];
  total: number;
  page: number;
  limit: number;
}

export type GuardDecision =
  | "canned_greeting"
  | "canned_thanks"
  | "canned_goodbye"
  | "heuristic_block"
  | "retrieval_gate"
  | "classifier_off_topic"
  | "classifier_smalltalk"
  | "budget"
  | "rate_limited"
  | "llm"
  | "lead_form";

export interface SourceRef {
  title: string;
  url: string | null;
}

/** A file the visitor sent with a message. `available` is false once the
 *  30-day sweeper removed the object; the row keeps name and size. */
export interface MessageAttachment {
  id: string;
  kind: "image" | "document";
  mime: string;
  size_bytes: number;
  filename: string;
  available: boolean;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: MessageAttachment[];
  sources: SourceRef[] | null;
  guard_decision: GuardDecision | null;
  tool_calls: unknown;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  latency_ms: number | null;
  feedback: "up" | "down" | null;
  unanswered: boolean;
  reply_to_id: string | null;
  created_at: string;
}

/** Pulls the CTA chips the widget rendered out of a stored `tool_calls` blob. */
export function actionsFromToolCalls(toolCalls: unknown): ActionItem[] {
  if (!Array.isArray(toolCalls)) return [];
  for (const call of toolCalls) {
    const c = call as { name?: string; args?: { items?: ActionItem[] } };
    if (c?.name === "show_actions" && Array.isArray(c.args?.items)) {
      return c.args.items;
    }
  }
  return [];
}

export interface ConversationDetail {
  conversation: ConversationSummary;
  messages: ConversationMessage[];
}

export interface UsageDay {
  day: string;
  messages: number;
  tokens_in: number;
  tokens_out: number;
  embed_tokens: number;
  cost_micro_usd: number;
  blocked: number;
  leads: number;
  feedback_up: number;
  feedback_down: number;
  unanswered: number;
}

export interface UsageModelRow {
  model: string;
  messages: number;
  tokens_in: number;
  tokens_out: number;
  cost_micro_usd: number;
}

export interface UsageResponse {
  days: UsageDay[];
  models: UsageModelRow[];
}

/** Widget types plus "html": the bundle inlined into one self-contained block. */
export type SnippetMode = WidgetType | "html";

export interface SnippetResponse {
  mode: SnippetMode;
  snippet: string;
  api_origin: string;
  /** mode=page only — the hosted /a/:id URL. */
  page_url?: string;
  /** mode=html only — size of the block in bytes. */
  bytes?: number;
}

// SSE ------------------------------------------------------------------------

export type SseErrorCode =
  | "rate_limited"
  | "origin_not_allowed"
  | "render_token_invalid"
  | "budget_exhausted"
  | "upstream_failed"
  | "not_published"
  | "workspace_ai_not_configured"
  | "invalid_request";

export interface RetrievalDebug {
  best_similarity: number | null;
  fts_hits: number;
  classifier: string | null;
  /** The standalone/English query retrieval actually ran, when rewritten. */
  retrieval_query?: string | null;
  reranked?: boolean;
  chunks: Array<{
    title: string;
    heading_path: string;
    similarity: number | null;
    rrf: number;
    fts_rank: number | null;
  }>;
}

export interface SseLeadForm {
  reason: "intent" | "fallback";
  prefill: Partial<Record<LeadFieldKey, string>>;
  fields: LeadCaptureField[];
  intro_text: string;
}

export interface SseActions {
  reason: "lead_intent" | "always" | "after_first_answer" | "fallback";
  items: ActionItem[];
}

export interface SseDone {
  guard_decision: GuardDecision;
  tokens_in: number;
  tokens_out: number;
  /** Assistant message id — what playground feedback is posted against. */
  message_id: string;
  unanswered: boolean;
  debug?: RetrievalDebug;
}

export interface StreamHandlers {
  onMeta?: (e: { conversation_id: string; message_id: string }) => void;
  onToken?: (t: string) => void;
  onSources?: (items: SourceRef[]) => void;
  onLeadForm?: (form: SseLeadForm) => void;
  onActions?: (actions: SseActions) => void;
  onDone?: (done: SseDone) => void;
  onError?: (e: { code: SseErrorCode | "network"; message: string }) => void;
}

export interface PlaygroundChatBody {
  conversation_id?: string;
  message: string;
  locale?: AiLocale;
  debug?: boolean;
}

/** Widget default strings per locale — mirrors DEFAULT_STRINGS on the server. */
export const DEFAULT_STRINGS: Record<AiLocale, Required<WidgetStrings>> = {
  en: {
    greeting: "Hi! How can I help you today?",
    placeholder: "Ask a question…",
    launcher_label: "Chat with us",
    header_subtitle: "Usually replies instantly",
    send: "Send",
    powered_by: "Powered by re:praesent",
    lead_intro:
      "Happy to help further — leave your details and we’ll get back to you.",
    lead_thanks: "Thank you! We’ll be in touch shortly.",
    lead_submit: "Send details",
    lead_skip: "Not now",
    error_generic: "Something went wrong. Please try again.",
    section_title: "Ask us anything",
    section_subtitle:
      "Get instant answers about our services, prices and availability.",
    nudge_text: "Ask us anything…",
    bar_placeholder: "Ask us anything…",
    feedback_thanks: "Thanks for the feedback!",
  },
  de: {
    greeting: "Hallo! Wie kann ich Ihnen helfen?",
    placeholder: "Frage stellen…",
    launcher_label: "Chatten Sie mit uns",
    header_subtitle: "Antwortet meist sofort",
    send: "Senden",
    powered_by: "Bereitgestellt von re:praesent",
    lead_intro:
      "Gerne helfen wir weiter — hinterlassen Sie Ihre Kontaktdaten und wir melden uns.",
    lead_thanks: "Vielen Dank! Wir melden uns in Kürze.",
    lead_submit: "Absenden",
    lead_skip: "Jetzt nicht",
    error_generic: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
    section_title: "Fragen Sie uns",
    section_subtitle:
      "Sofortige Antworten zu Leistungen, Preisen und Verfügbarkeit.",
    nudge_text: "Fragen Sie uns…",
    bar_placeholder: "Fragen Sie uns…",
    feedback_thanks: "Danke für Ihr Feedback!",
  },
  fr: {
    greeting: "Bonjour ! Comment puis-je vous aider ?",
    placeholder: "Posez une question…",
    launcher_label: "Discutez avec nous",
    header_subtitle: "Répond généralement instantanément",
    send: "Envoyer",
    powered_by: "Propulsé par re:praesent",
    lead_intro:
      "Laissez vos coordonnées et nous reviendrons vers vous rapidement.",
    lead_thanks: "Merci ! Nous vous recontactons très vite.",
    lead_submit: "Envoyer",
    lead_skip: "Pas maintenant",
    error_generic: "Une erreur est survenue. Veuillez réessayer.",
    section_title: "Posez-nous vos questions",
    section_subtitle:
      "Des réponses immédiates sur nos services, tarifs et disponibilités.",
    nudge_text: "Posez-nous une question…",
    bar_placeholder: "Posez-nous une question…",
    feedback_thanks: "Merci pour votre retour !",
  },
  nl: {
    greeting: "Hallo! Waarmee kan ik u helpen?",
    placeholder: "Stel een vraag…",
    launcher_label: "Chat met ons",
    header_subtitle: "Antwoordt meestal direct",
    send: "Versturen",
    powered_by: "Mogelijk gemaakt door re:praesent",
    lead_intro: "Laat uw gegevens achter en we nemen snel contact met u op.",
    lead_thanks: "Bedankt! We nemen binnenkort contact op.",
    lead_submit: "Versturen",
    lead_skip: "Niet nu",
    error_generic: "Er ging iets mis. Probeer het opnieuw.",
    section_title: "Stel ons een vraag",
    section_subtitle:
      "Direct antwoord over diensten, prijzen en beschikbaarheid.",
    nudge_text: "Stel ons een vraag…",
    bar_placeholder: "Stel ons een vraag…",
    feedback_thanks: "Bedankt voor uw feedback!",
  },
};

export function resolveWidgetStrings(
  appearance: AppearanceConfig,
  locale: AiLocale,
): Required<WidgetStrings> {
  const base = DEFAULT_STRINGS[locale] ?? DEFAULT_STRINGS.en;
  const override = appearance.strings?.[locale] ?? {};
  const out: Record<string, string> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (typeof v === "string" && v.trim()) out[k] = v;
  }
  return out as Required<WidgetStrings>;
}

// ---------------------------------------------------------------------------
// Assistants
// ---------------------------------------------------------------------------

const BASE = "/ai-assistants";

export async function getAssistants(): Promise<AssistantSummary[]> {
  const r = await apiClient.get<AssistantSummary[]>(BASE);
  return r.data ?? [];
}

export async function getAssistant(id: string): Promise<AssistantRecord> {
  const r = await apiClient.get<AssistantRecord>(`${BASE}/${id}`);
  return r.data;
}

export async function getChatModels(): Promise<ChatModelOption[]> {
  const r = await apiClient.get<{ models: ChatModelOption[] }>(
    `${BASE}/models`,
  );
  return r.data?.models ?? [];
}

export async function createAssistant(payload: {
  name: string;
  widget_type?: WidgetType;
}): Promise<AssistantRecord> {
  const r = await apiClient.post<AssistantRecord>(BASE, payload);
  return r.data;
}

export async function updateAssistant(
  id: string,
  dto: UpdateAssistantDto,
): Promise<AssistantRecord> {
  const r = await apiClient.patch<AssistantRecord>(`${BASE}/${id}`, dto);
  return r.data;
}

/**
 * Re-extract the business profile from the crawled website. 409
 * `workspace_ai_not_configured` without a key; 422 `no_knowledge` when
 * nothing has been crawled yet.
 */
export async function regenerateBusinessProfile(
  id: string,
): Promise<AssistantRecord> {
  const r = await apiClient.post<AssistantRecord>(
    `${BASE}/${id}/business-profile/regenerate`,
  );
  return r.data;
}

export function isNoKnowledgeError(error: unknown): boolean {
  const e = error as { response?: { data?: { code?: string } } } | null;
  return e?.response?.data?.code === "no_knowledge";
}

export async function deleteAssistant(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}

export async function publishAssistant(id: string): Promise<AssistantRecord> {
  const r = await apiClient.post<AssistantRecord>(`${BASE}/${id}/publish`);
  return r.data;
}

export async function unpublishAssistant(id: string): Promise<AssistantRecord> {
  const r = await apiClient.post<AssistantRecord>(`${BASE}/${id}/unpublish`);
  return r.data;
}

export async function getAssistantSnippet(
  id: string,
  mode: SnippetMode,
): Promise<SnippetResponse> {
  const r = await apiClient.get<SnippetResponse>(
    `${BASE}/${id}/snippet?mode=${mode}`,
  );
  return r.data;
}

// Sources --------------------------------------------------------------------

export async function getSources(id: string): Promise<KnowledgeSource[]> {
  const r = await apiClient.get<KnowledgeSource[]>(`${BASE}/${id}/sources`);
  return r.data ?? [];
}

export async function createSource(
  id: string,
  dto: CreateSourceDto,
): Promise<KnowledgeSource> {
  const r = await apiClient.post<KnowledgeSource>(`${BASE}/${id}/sources`, dto);
  return r.data;
}

export async function presignSourceUpload(
  id: string,
  file: { filename: string; mime_type: string; size_bytes: number },
): Promise<PresignResponse> {
  const r = await apiClient.post<PresignResponse>(
    `${BASE}/${id}/sources/presign`,
    file,
  );
  return r.data;
}

export async function confirmSourceUpload(
  id: string,
  sourceId: string,
): Promise<KnowledgeSource> {
  const r = await apiClient.post<KnowledgeSource>(
    `${BASE}/${id}/sources/${sourceId}/confirm`,
  );
  return r.data;
}

/**
 * Browser → object storage PUT with progress. XHR rather than fetch because
 * fetch has no upload progress events.
 */
export function putToPresignedUrl(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(file);
  });
}

export async function getSourceText(
  id: string,
  sourceId: string,
): Promise<{ id: string; title: string; raw_text: string }> {
  const { data } = await apiClient.get(
    `/ai-assistants/${id}/sources/${sourceId}/text`,
  );
  return data;
}

export interface UpdateSourceDto {
  title?: string;
  raw_text?: string;
  enabled?: boolean;
  recrawl_interval?: RecrawlInterval;
  crawl_options?: CrawlOptions;
}

export async function updateSource(
  id: string,
  sourceId: string,
  dto: UpdateSourceDto,
): Promise<KnowledgeSource> {
  const r = await apiClient.patch<KnowledgeSource>(
    `${BASE}/${id}/sources/${sourceId}`,
    dto,
  );
  return r.data;
}

export async function getSourceDocuments(
  id: string,
  sourceId: string,
): Promise<SourceDocument[]> {
  const r = await apiClient.get<SourceDocument[]>(
    `${BASE}/${id}/sources/${sourceId}/documents`,
  );
  return r.data ?? [];
}

export async function getSourceDocumentContent(
  id: string,
  sourceId: string,
  documentId: string,
): Promise<SourceDocumentContent> {
  const r = await apiClient.get<SourceDocumentContent>(
    `${BASE}/${id}/sources/${sourceId}/documents/${documentId}/content`,
  );
  return r.data;
}

// Tests ----------------------------------------------------------------------

export async function getTests(id: string): Promise<AssistantTest[]> {
  const r = await apiClient.get<AssistantTest[]>(`${BASE}/${id}/tests`);
  return r.data ?? [];
}

export async function createTest(
  id: string,
  dto: { question: string; expected_keywords: string[] },
): Promise<AssistantTest> {
  const r = await apiClient.post<AssistantTest>(`${BASE}/${id}/tests`, dto);
  return r.data;
}

export async function updateTest(
  id: string,
  testId: string,
  dto: { question?: string; expected_keywords?: string[] },
): Promise<AssistantTest> {
  const r = await apiClient.patch<AssistantTest>(
    `${BASE}/${id}/tests/${testId}`,
    dto,
  );
  return r.data;
}

export async function deleteTest(id: string, testId: string): Promise<void> {
  await apiClient.delete(`${BASE}/${id}/tests/${testId}`);
}

export async function runTests(
  id: string,
  body: { with_llm?: boolean; ids?: string[] } = {},
): Promise<RunTestsResult> {
  const r = await apiClient.post<RunTestsResult>(
    `${BASE}/${id}/tests/run`,
    body,
  );
  return r.data;
}

// Gaps -----------------------------------------------------------------------

export async function getGaps(
  id: string,
  days = 30,
  limit = 100,
): Promise<GapsResponse> {
  const r = await apiClient.get<GapsResponse>(
    `${BASE}/${id}/gaps?days=${days}&limit=${limit}`,
  );
  return r.data ?? { items: [], total_unanswered: 0 };
}

export async function postPlaygroundFeedback(
  id: string,
  messageId: string,
  rating: "up" | "down",
): Promise<void> {
  await apiClient.post(`${BASE}/${id}/messages/${messageId}/feedback`, {
    rating,
  });
}

export async function resyncSource(
  id: string,
  sourceId: string,
): Promise<KnowledgeSource> {
  const r = await apiClient.post<KnowledgeSource>(
    `${BASE}/${id}/sources/${sourceId}/resync`,
  );
  return r.data;
}

export async function deleteSource(
  id: string,
  sourceId: string,
): Promise<void> {
  await apiClient.delete(`${BASE}/${id}/sources/${sourceId}`);
}

// Conversations --------------------------------------------------------------

export interface ListConversationsParams {
  page?: number;
  limit?: number;
  lead_only?: boolean;
  search?: string;
}

export async function getConversations(
  id: string,
  params: ListConversationsParams = {},
): Promise<ConversationPage> {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.limit) q.set("limit", String(params.limit));
  if (params.lead_only) q.set("lead_only", "true");
  if (params.search) q.set("search", params.search);
  const qs = q.toString();
  const r = await apiClient.get<ConversationPage>(
    `${BASE}/${id}/conversations${qs ? `?${qs}` : ""}`,
  );
  return r.data;
}

export async function getConversation(
  id: string,
  conversationId: string,
): Promise<ConversationDetail> {
  const r = await apiClient.get<ConversationDetail>(
    `${BASE}/${id}/conversations/${conversationId}`,
  );
  return r.data;
}

// Usage ----------------------------------------------------------------------

export async function getUsage(id: string, days = 30): Promise<UsageResponse> {
  const r = await apiClient.get<UsageResponse>(
    `${BASE}/${id}/usage?days=${days}`,
  );
  return { days: r.data?.days ?? [], models: r.data?.models ?? [] };
}

// Playground -----------------------------------------------------------------

export async function submitPlaygroundLead(
  id: string,
  body: { conversation_id: string; fields: Record<string, string> },
): Promise<{ ok: boolean }> {
  const r = await apiClient.post<{ ok: boolean }>(
    `${BASE}/${id}/playground/lead`,
    body,
  );
  return r.data;
}

/**
 * Streams a playground turn. Axios cannot consume a ReadableStream, so this
 * is raw fetch with the same auth headers the axios instance attaches.
 * Resolves when the stream closes; rejects only on setup failure.
 */
export async function streamAssistantChat(
  assistantId: string,
  body: PlaygroundChatBody,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const base = apiClient.defaults.baseURL ?? "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const workspaceId = getStoredWorkspaceId();
  if (workspaceId) headers["X-Workspace-Id"] = workspaceId;

  let response: Response;
  try {
    response = await fetch(`${base}${BASE}/${assistantId}/playground/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    handlers.onError?.({ code: "network", message: (err as Error).message });
    return;
  }

  if (!response.ok || !response.body) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const data = (await response.json()) as { message?: string };
      if (data?.message) message = data.message;
    } catch {
      /* not json */
    }
    handlers.onError?.({ code: "invalid_request", message });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatch = (event: string, data: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }
    switch (event) {
      case "meta":
        handlers.onMeta?.(
          parsed as { conversation_id: string; message_id: string },
        );
        break;
      case "token":
        handlers.onToken?.((parsed as { t: string }).t ?? "");
        break;
      case "sources":
        handlers.onSources?.((parsed as { items: SourceRef[] }).items ?? []);
        break;
      case "lead_form":
        handlers.onLeadForm?.(parsed as SseLeadForm);
        break;
      case "actions":
        handlers.onActions?.(parsed as SseActions);
        break;
      case "done":
        handlers.onDone?.(parsed as SseDone);
        break;
      case "error":
        handlers.onError?.(parsed as { code: SseErrorCode; message: string });
        break;
    }
  };

  const consume = (block: string) => {
    let event = "message";
    const dataLines: string[] = [];
    for (const raw of block.split("\n")) {
      const line = raw.replace(/\r$/, "");
      if (!line || line.startsWith(":")) continue;
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:"))
        dataLines.push(line.slice(5).trimStart());
    }
    if (dataLines.length) dispatch(event, dataLines.join("\n"));
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        consume(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 2);
      }
    }
    if (buffer.trim()) consume(buffer);
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      handlers.onError?.({ code: "network", message: (err as Error).message });
    }
  }
}

/**
 * Streams a visitor attachment through the auth'd route and hands it to the
 * browser as a download — the object itself is private, so there is no URL
 * to link to.
 */
export async function downloadMessageAttachment(
  assistantId: string,
  attachment: Pick<MessageAttachment, "id" | "mime" | "filename">,
): Promise<void> {
  const res = await apiClient.get(
    `${BASE}/${assistantId}/attachments/${attachment.id}`,
    { responseType: "blob" },
  );
  const url = URL.createObjectURL(
    new Blob([res.data], { type: attachment.mime || "application/octet-stream" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = attachment.filename || attachment.id;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
