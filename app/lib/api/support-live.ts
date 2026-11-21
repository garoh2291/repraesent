import { useEffect, useSyncExternalStore } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiClient, getStoredToken, getStoredWorkspaceId } from "./axios-instance";
import { helpKeys, queueKeys, type QueueBase } from "./support-tickets";

/**
 * Live updates for Help & changes and the support queues (server-sent events).
 *
 * The server sends only `changed {ids}`; we refetch those through the normal,
 * guarded endpoints. Raw fetch, not EventSource: it cannot send the
 * Authorization header. The stream only counts as up after its first event
 * arrives, so a buffering proxy can never slow the pages' polling down. The stream closes while the tab is hidden and opens
 * again when it is visible; a dropped stream reconnects with backoff. While a
 * stream is up the pages' own polling slows down (`useSupportLiveUp`).
 */

export type LiveScope = "help" | QueueBase;

const PATH: Record<LiveScope, string> = {
  help: "/help/live",
  "root-support": "/root-support/live",
  "agency-support": "/agency-support/live",
};

// ── "is a stream up" (for slowing the fallback polling) ─────────────────────

const up = new Set<LiveScope>();
const listeners = new Set<() => void>();
function setUp(scope: LiveScope, on: boolean) {
  const had = up.has(scope);
  if (on) up.add(scope);
  else up.delete(scope);
  if (had !== on) for (const l of listeners) l();
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** True while the live stream for this scope is connected. */
export function useSupportLiveUp(scope: LiveScope | null): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (scope ? up.has(scope) : false),
    () => false,
  );
}

/** Polling interval: slow while live updates arrive, `fallback` when they don't. */
export function usePollEvery(scope: LiveScope | null, fallback: number): number {
  return useSupportLiveUp(scope) ? Math.max(fallback, 5 * 60_000) : fallback;
}

// ── the stream ──────────────────────────────────────────────────────────────

class AuthLost extends Error {}

export async function readOnce(scope: LiveScope, signal: AbortSignal, onChanged: (ids: string[]) => void, onOpen: () => void): Promise<void> {
  const headers: Record<string, string> = { Accept: "text/event-stream" };
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const ws = getStoredWorkspaceId();
  if (ws) headers["X-Workspace-Id"] = ws;
  const base = (apiClient.defaults.baseURL ?? "").replace(/\/$/, "");
  const res = await fetch(`${base}${PATH[scope]}`, { headers, signal, cache: "no-store" });
  if (res.status === 401) throw new AuthLost();
  if (!res.ok || !res.body) throw new Error(`live ${res.status}`);
  // Live only once a real message got through: a proxy that buffers the
  // stream still answers 200 at once, but then nothing ever arrives. Until
  // the server's "ready" shows up, the pages keep their normal polling.
  let opened = false;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      let event = "message";
      let data = "";
      for (const line of chunk.split("\n")) {
        if (line.startsWith(":")) continue;
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!opened && (event === "ready" || event === "changed")) {
        opened = true;
        onOpen();
      }
      if (event !== "changed" || !data) continue;
      try {
        const ids = (JSON.parse(data) as { ids?: unknown }).ids;
        if (Array.isArray(ids)) onChanged(ids.filter((x): x is string => typeof x === "string"));
      } catch {
        /* a malformed event is skipped */
      }
    }
  }
}

function refetchFor(qc: QueryClient, scope: LiveScope, workspaceId: string, ids: string[]) {
  if (scope === "help") {
    void qc.invalidateQueries({ queryKey: helpKeys.list(workspaceId) });
    void qc.invalidateQueries({ queryKey: helpKeys.websites(workspaceId) });
    for (const id of ids) void qc.invalidateQueries({ queryKey: helpKeys.ticket(workspaceId, id) });
    return;
  }
  void qc.invalidateQueries({ queryKey: queueKeys.counts(scope) });
  void qc.invalidateQueries({ queryKey: queueKeys.lists(scope) });
  for (const id of ids) void qc.invalidateQueries({ queryKey: queueKeys.ticket(scope, id) });
  if (scope === "root-support") void qc.invalidateQueries({ queryKey: ["root-deal-support"] });
}

/**
 * Keep one live stream open for `scope` while the tab is visible and the
 * workspace is `workspaceId`. A 401 goes through the app's own refresh (one
 * cheap guarded call) and reconnects; if that fails too, the stream stops and
 * polling carries on.
 */
export function useSupportLive(scope: LiveScope | null, workspaceId: string | null | undefined): void {
  const qc = useQueryClient();
  useEffect(() => {
    if (!scope || !workspaceId || typeof window === "undefined" || typeof fetch === "undefined") return;
    let stopped = false;
    let ctrl: AbortController | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;

    const refreshSession = async (): Promise<boolean> => {
      try {
        // Any guarded call runs the shared single-flight token refresh.
        await apiClient.get(scope === "help" ? "/help/websites" : `/${scope}/tickets/counts`);
        return true;
      } catch {
        return false;
      }
    };

    const connect = async () => {
      if (stopped || document.visibilityState === "hidden") return;
      ctrl?.abort();
      const mine = new AbortController();
      ctrl = mine;
      try {
        await readOnce(
          scope,
          mine.signal,
          (ids) => refetchFor(qc, scope, workspaceId, ids),
          () => {
            failures = 0;
            setUp(scope, true);
            // Catch up on whatever changed while we were away.
            refetchFor(qc, scope, workspaceId, []);
          },
        );
      } catch (err) {
        if (mine.signal.aborted || stopped) return;
        if (err instanceof AuthLost && !(await refreshSession())) {
          setUp(scope, false);
          return;
        }
      } finally {
        if (ctrl === mine) setUp(scope, false);
      }
      if (stopped || mine.signal.aborted) return;
      failures += 1;
      const wait = Math.min(60_000, 1_000 * 2 ** Math.min(failures, 6)) + Math.random() * 1_000;
      retry = setTimeout(() => void connect(), wait);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (retry) clearTimeout(retry);
        ctrl?.abort();
        ctrl = null;
        setUp(scope, false);
      } else if (!ctrl) {
        failures = 0;
        void connect();
      }
    };

    void connect();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onVisibility);
    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      ctrl?.abort();
      setUp(scope, false);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onVisibility);
    };
  }, [scope, workspaceId, qc]);
}
