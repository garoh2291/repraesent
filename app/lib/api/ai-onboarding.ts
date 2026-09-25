import type { AssistantLevel } from "./onboarding-chat";
import { apiClient } from "./axios-instance";

/** Root Settings → Onboarding → AI assistant (AI_ONBOARDING_PLAN.md, Phase 2). Mirrors ai-onboarding.types.ts. */

export const AI_LOCALES = ["en", "de", "fr", "nl"] as const;
export type AiLocale = (typeof AI_LOCALES)[number];
export type LocalizedText = Partial<Record<AiLocale, string>>;

/** Regions that can override the default (Europe) wording. */
export const OVERRIDE_REGIONS = ["us", "canada", "australia"] as const;
export type OverrideRegion = (typeof OVERRIDE_REGIONS)[number];
/** "default" = Europe and every region without its own text. */
export type WordingRegion = "default" | OverrideRegion;

export interface Regional<T> {
  default: T;
  regions: Partial<Record<OverrideRegion, T>>;
}

/** Built-in names until the root admin renames them (mirrors onboarding-v2/ai-chat/assistants.ts). */
export const DEFAULT_ASSISTANT_NAMES: Record<AssistantLevel, string> = { tech: "Jonas", assisted: "Mara", simple: "Clara" };

export interface Persona {
  name: string;
  style: string;
}

/** Mirrors CHAT_MODELS (nestjs workspace-ai/chat-models.ts); runs on the root workspace's OpenRouter key. */
export const ASSISTANT_MODELS = [
  { id: "openai/gpt-4.1-mini", label: "GPT-4.1 mini", cost: "≈ €0.03–0.08" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o mini", cost: "≈ €0.01–0.03" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", cost: "≈ €0.04–0.10" },
  { id: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5", cost: "≈ €0.15–0.35" },
] as const;

export interface AiOnboardingSettings {
  enabled: boolean;
  model: string;
  /** The three assistants by tech level (Phase 6), each nameable per region. */
  assistants: Record<AssistantLevel, Regional<Persona>>;
  welcome: Regional<LocalizedText>;
  intro: Regional<{ headline: LocalizedText; sub: LocalizedText }>;
}

export type RuleWhen = { kind: "always" } | { kind: "option"; values: string[] } | { kind: "text"; text: string };
export type RuleAction = "say" | "skip" | "flag" | "instruct";
export interface QuestionRule {
  id: string;
  when: RuleWhen;
  action: RuleAction;
  value: string;
  target_key?: string;
}

export interface QuestionField {
  path: string;
  type: string;
  options?: string[];
}

export interface AiQuestion {
  key: string;
  kind: "builtin" | "custom";
  enabled: boolean;
  name: string;
  texts: Regional<LocalizedText>;
  rules: QuestionRule[];
  locked: boolean;
  pinned: "first" | "last" | null;
  step: string | null;
  fields: QuestionField[];
  default_texts: Record<AiLocale, string> | null;
  default_name: string | null;
}

export interface AiOnboardingState {
  settings: AiOnboardingSettings;
  questions: AiQuestion[];
  /** The root workspace has a working OpenRouter key (Settings → AI); without it the assistant isn't offered. */
  ai_key_ready?: boolean;
}

export async function getAiOnboarding(): Promise<AiOnboardingState> {
  return (await apiClient.get<AiOnboardingState>("/root-onboarding/ai")).data;
}

export async function saveAiOnboarding(state: AiOnboardingState): Promise<AiOnboardingState> {
  const questions = state.questions.map(({ key, enabled, name, texts, rules }) => ({ key, enabled, name, texts, rules }));
  return (await apiClient.put<AiOnboardingState>("/root-onboarding/ai", { settings: state.settings, questions })).data;
}

export async function translateAiTexts(body: {
  source_locale: AiLocale;
  items: Record<string, string>;
  targets: AiLocale[];
}): Promise<{ values: Partial<Record<AiLocale, Record<string, string>>>; failed: AiLocale[] }> {
  return (await apiClient.post("/root-onboarding/ai/translate", body)).data;
}
