import { apiClient, getStoredToken, getStoredWorkspaceId } from "./axios-instance";
import type { OnboardingState, PlaceCandidate } from "./onboarding-v2";

/** The AI onboarding assistant (AI_ONBOARDING_PLAN.md). Same run as the form. */

export type ChatCard =
  | { type: "choices"; id: string; field: string; multi: boolean; options: string[] }
  | { type: "places"; id: string; candidates: PlaceCandidate[] }
  | { type: "reading"; id: string; job_id: string }
  | { type: "billing"; id: string }
  | { type: "consent"; id: string };

/** The three assistants by tech level (Phase 6): Jonas · Mara · Clara by default. */
export const ASSISTANT_LEVELS = ["tech", "assisted", "simple"] as const;
export type AssistantLevel = (typeof ASSISTANT_LEVELS)[number];

export interface ChatMessage {
  id: string;
  /** "handover": the customer picked or switched assistant (a divider, no text). */
  role: "user" | "assistant" | "handover";
  /** Who wrote it (assistant) or took over (handover); null for older messages. */
  by: AssistantLevel | null;
  content: string;
  cards: ChatCard[];
  saved: string[];
  created_at: string;
}

export interface ChatProgress {
  done: number;
  total: number;
  resume_step: string;
}

export interface ChatOpen {
  available: boolean;
  persona: { name: string } | null;
  /** All three, names resolved for the customer's region. */
  assistants: Array<{ key: AssistantLevel; name: string }>;
  assistant: AssistantLevel | null;
  /** No assistant picked yet: show the three to choose from first. */
  needs_pick?: boolean;
  messages: ChatMessage[];
  progress: ChatProgress | null;
  needs_start?: boolean;
  /** Came back (e.g. from the form) to something that needs Lena to continue on her own. */
  needs_resume?: boolean;
  /** Lena is still finishing a reply from before (the customer left mid-turn). */
  busy?: boolean;
}

export type ChatEvent =
  | { type: "start" }
  | { type: "choice"; field: string; values: string[]; label: string }
  | { type: "place"; place_id: string; label: string }
  | { type: "place_none"; label: string }
  | { type: "website_read" }
  | { type: "billing_saved" }
  | { type: "resume" }
  | { type: "pick_assistant"; level: AssistantLevel };

export interface ChatHandlers {
  onMeta?: (d: { user_message_id: string }) => void;
  /** A finished message the server added (handover divider, the new assistant's welcome). */
  onMessage?: (m: ChatMessage) => void;
  onToken?: (t: string) => void;
  /** The final text, when the server cleaned it up (hidden markers removed). */
  onText?: (t: string) => void;
  onSaved?: (topics: string[]) => void;
  onCard?: (card: ChatCard) => void;
  onState?: (state: OnboardingState) => void;
  onDone?: (d: { message_id: string; saved: string[]; progress: ChatProgress; handover?: boolean }) => void;
  onError?: (d: { code: string; message?: string }) => void;
}

const tz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
};

export async function openChat(): Promise<ChatOpen> {
  return (await apiClient.get<ChatOpen>("/onboarding/v2/chat", { params: { tz: tz() } })).data;
}

/** One turn: a typed message or a tapped card. Streams server-sent events into `handlers`. */
export async function streamChatTurn(
  body: { message?: string; event?: ChatEvent; open_choice?: string },
  handlers: ChatHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "text/event-stream" };
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const ws = getStoredWorkspaceId();
  if (ws) headers["X-Workspace-Id"] = ws;

  let response: Response;
  try {
    response = await fetch(`${apiClient.defaults.baseURL ?? ""}/onboarding/v2/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...body, tz: tz() }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name !== "AbortError") handlers.onError?.({ code: "network" });
    return;
  }
  if (!response.ok || !response.body) {
    let code = response.status === 429 ? "RATE_LIMITED" : response.status === 409 ? "BUSY" : "invalid_request";
    try {
      const data = (await response.json()) as { code?: string };
      if (data?.code) code = data.code;
    } catch {
      /* not json */
    }
    handlers.onError?.({ code });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const dispatch = (event: string, raw: string) => {
    let d: unknown;
    try {
      d = JSON.parse(raw);
    } catch {
      return;
    }
    switch (event) {
      case "meta":
        return handlers.onMeta?.(d as { user_message_id: string });
      case "message":
        return handlers.onMessage?.(d as ChatMessage);
      case "token":
        return handlers.onToken?.((d as { t: string }).t ?? "");
      case "text":
        return handlers.onText?.((d as { t: string }).t ?? "");
      case "saved":
        return handlers.onSaved?.((d as { topics: string[] }).topics ?? []);
      case "card":
        return handlers.onCard?.(d as ChatCard);
      case "state":
        return handlers.onState?.(d as OnboardingState);
      case "done":
        return handlers.onDone?.(d as Parameters<NonNullable<ChatHandlers["onDone"]>>[0]);
      case "error":
        return handlers.onError?.(d as { code: string });
    }
  };
  const consume = (block: string) => {
    let event = "message";
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (!line || line.startsWith(":")) continue;
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }
    if (data.length) dispatch(event, data.join("\n"));
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let i: number;
      while ((i = buffer.indexOf("\n\n")) >= 0) {
        consume(buffer.slice(0, i));
        buffer = buffer.slice(i + 2);
      }
    }
    if (buffer.trim()) consume(buffer);
  } catch (err) {
    if ((err as Error).name !== "AbortError") handlers.onError?.({ code: "network" });
  }
}

/** Hide the assistant's [[ask:…]] markers, also a half-streamed one at the end. */
export function visibleText(text: string): string {
  return text.replace(/\s*\[\[[^\]]*\]\]/g, "").replace(/\s*\[\[[^\]]*$/, "");
}
