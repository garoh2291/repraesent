import { apiClient, getStoredToken, getStoredWorkspaceId } from "./axios-instance";
import type { PromptCandidate } from "./re-visible";

/**
 * Server-sent-event readers for the two long AI Analytics operations.
 *
 * Not `EventSource`: it cannot send an Authorization header, and both of these
 * are authenticated, workspace-scoped endpoints. Raw fetch with a manual reader
 * — the same approach the assistant playground stream already uses.
 */

export interface RunProgress {
  batch_id: string;
  done: number;
  planned: number;
  failed: number;
  cost_micro_usd: number;
  finished: boolean;
  error: string | null;
  engines: { engine: string; done: number }[];
}

export interface GenerateStage {
  stage: "reading_site" | "scraping_pages" | "writing_questions" | string;
  url?: string | null;
  count?: number;
  done?: number;
  pages?: number;
}

function headers(): Record<string, string> {
  const out: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };

  const token = getStoredToken();
  if (token) out.Authorization = `Bearer ${token}`;

  const workspaceId = getStoredWorkspaceId();
  if (workspaceId) out["X-Workspace-Id"] = workspaceId;

  return out;
}

/**
 * Read an SSE response, dispatching each `event:`/`data:` pair.
 *
 * Comment lines (`: ping`) are skipped — they exist only to keep nginx from
 * closing a multi-minute connection, which is the actual reason these requests
 * used to be cancelled.
 */
async function readStream(
  response: Response,
  dispatch: (event: string, data: unknown) => void,
): Promise<void> {
  if (!response.body) throw new Error("This browser cannot read a stream.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Events are separated by a blank line; a partial trailing chunk stays in
    // the buffer until the rest arrives.
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      let event = "message";
      const data: string[] = [];

      for (const line of chunk.split("\n")) {
        if (line.startsWith(":")) continue;
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).trim());
      }

      if (!data.length) continue;

      try {
        dispatch(event, JSON.parse(data.join("\n")));
      } catch {
        /* a malformed frame is skipped rather than killing the stream */
      }
    }
  }
}

async function open(
  path: string,
  method: "GET" | "POST",
  signal?: AbortSignal,
): Promise<Response> {
  const base = apiClient.defaults.baseURL ?? "";
  const response = await fetch(`${base}${path}`, {
    method,
    headers: headers(),
    signal,
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;

    try {
      const body = (await response.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* not json */
    }

    throw new Error(message);
  }

  return response;
}

/**
 * Follow a run to completion.
 *
 * The run itself is already executing server-side, detached from any request —
 * closing this stream (or the tab) does not stop it, and reopening picks the
 * progress back up. That is the point: a batch is minutes of work and must not
 * depend on a browser staying open.
 */
export async function streamRunProgress(
  pluginUuid: string,
  batchId: string,
  handlers: {
    onProgress?: (p: RunProgress) => void;
    onDone?: (p: RunProgress) => void;
    onError?: (message: string) => void;
  },
  signal?: AbortSignal,
): Promise<void> {
  try {
    const response = await open(
      `/wordpress/site/plugins/${pluginUuid}/visibility-run/${batchId}/stream`,
      "GET",
      signal,
    );

    await readStream(response, (event, data) => {
      if (event === "progress") handlers.onProgress?.(data as RunProgress);
      else if (event === "done") handlers.onDone?.(data as RunProgress);
      else if (event === "error") {
        handlers.onError?.((data as { message?: string }).message ?? "Failed.");
      }
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;

    handlers.onError?.((err as Error).message);
  }
}

/** Generate prompt candidates, reporting each stage. */
export async function streamGeneratePrompts(
  pluginUuid: string,
  handlers: {
    onStage?: (stage: GenerateStage) => void;
    onResult?: (result: {
      candidates: PromptCandidate[];
      used_site_content: boolean;
    }) => void;
    onError?: (message: string) => void;
  },
  signal?: AbortSignal,
): Promise<void> {
  try {
    const response = await open(
      `/wordpress/site/plugins/${pluginUuid}/visibility-prompts/generate/stream`,
      "POST",
      signal,
    );

    await readStream(response, (event, data) => {
      if (event === "stage") handlers.onStage?.(data as GenerateStage);
      else if (event === "result") {
        handlers.onResult?.(
          data as { candidates: PromptCandidate[]; used_site_content: boolean },
        );
      } else if (event === "error") {
        handlers.onError?.((data as { message?: string }).message ?? "Failed.");
      }
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;

    handlers.onError?.((err as Error).message);
  }
}
