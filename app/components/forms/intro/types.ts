import type { FormDefinition, FormLocale } from "~/lib/forms/schema";
import type { BuilderSelection } from "~/lib/forms/selection";

/**
 * Which surface the demo is showing. Chapters 1-2 are the list, 3-7 the
 * builder, and "done" is the celebration that closes the walkthrough.
 */
export type DemoScreen = "list" | "dialog" | "builder" | "done";

export type DemoTab = "build" | "design" | "share";

export interface DemoState {
  screen: DemoScreen;
  /** Typed into the create dialog, then shown in the command bar. */
  name: string;
  definition: FormDefinition;
  /** Separate from the definition — exactly how the real route holds it. */
  locales: FormLocale[];
  defaultLocale: FormLocale;
  activeLocale: FormLocale;
  tab: DemoTab;
  selection: BuilderSelection | null;
  live: boolean;
  /** Drives the "Copied" toast replica on the Share chapter. */
  copied: boolean;
}

/**
 * A CSS selector resolved against the stage's inner container at the moment the
 * step runs. Never cached: adding a field moves everything below it, so a rect
 * measured one step earlier is already wrong.
 */
export type Sel = string;

export type Step =
  /**
   * Slide the view so `at` is centred vertically. Omit `at` to return to the
   * top. There is no zoom: the builder is always shown at full width.
   */
  | { kind: "camera"; at?: Sel; ms?: number }
  /** Glide the cursor to the centre of `at`. */
  | { kind: "move"; at: Sel; ms?: number }
  /** Ripple where the cursor already is, then apply `run`. */
  | { kind: "click"; run?: (s: DemoState) => DemoState; ms?: number }
  /** Type into demo state, character by character. */
  | { kind: "type"; text: string; run: (s: DemoState, typed: string) => DemoState; msPerChar?: number }
  /** Silent state change — no cursor, no ripple. */
  | { kind: "act"; run: (s: DemoState) => DemoState }
  | { kind: "wait"; ms: number };

export interface Chapter {
  id: string;
  /** i18n key suffix under `forms.intro.chapter.` */
  key: string;
  steps: Step[];
  /**
   * The cumulative state this chapter leaves behind.
   *
   * Chapters build on each other — chapter 3 only makes sense once chapter 2
   * has opened the builder. Jumping straight to chapter N therefore replays
   * `outcome` for chapters 0..N-1 against the seed, instantly and with no
   * animation, so the demo starts from the right place instead of showing the
   * empty Forms list under a caption that says "Give it a name".
   */
  outcome: (s: DemoState) => DemoState;
}
