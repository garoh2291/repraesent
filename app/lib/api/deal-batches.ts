import { apiClient } from "./axios-instance";
import type { DealCurrency } from "./deals";

/**
 * Make deals in bulk from contacts (nestjs-monolith deal-batches module,
 * migration 237). Pick contacts from an import, a segment or the contacts
 * list → one shared set of deal settings → the server makes them in slices.
 */

export type BatchSource = "import" | "segment" | "selection";
export type BatchOutcome = "created" | "skipped_open" | "skipped_gone" | "failed";

/** At most this many contacts in one go (same as the server). */
export const MAX_BATCH_CONTACTS = 5000;

export interface BatchCandidate {
  contact_id: string;
  name: string;
  kind: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  open_deal: { id: string; title: string } | null;
  values: Record<string, string | null>;
}

export interface BatchCandidates {
  rows: BatchCandidate[];
  truncated: boolean;
  columns: Array<{ key: string; label: string }>;
  source_name: string | null;
}

export interface BatchCounts {
  created: number;
  skipped_open: number;
  skipped_gone: number;
  failed: number;
  tasks: number;
  removed?: number;
  kept?: number;
}

export interface BatchSettings {
  title_extra: string | null;
  value: number | null;
  currency: DealCurrency | null;
  pipeline_id: string;
  stage: string;
  assigned_to: string | null;
  task: { title: string; due_date: string | null } | null;
  run_automations: boolean;
}

export interface CreateBatchBody {
  source: BatchSource;
  source_id?: string;
  contact_ids: string[];
  include_open_ids?: string[];
  title_extra?: string | null;
  value?: number | null;
  currency?: DealCurrency;
  pipeline_id?: string | null;
  stage?: string | null;
  assigned_to?: string | null;
  task?: { title: string; due_date?: string | null } | null;
  run_automations: boolean;
}

export interface BatchRunResult {
  status: "ready" | "running" | "done" | "undone";
  counts: BatchCounts;
  total: number;
  remaining: number;
}

export interface BatchLeftOut {
  contact_id: string;
  name: string | null;
  outcome: BatchOutcome;
  reason_code: string | null;
  open_deal: { id: string; title: string } | null;
}

export interface BatchSummary extends BatchRunResult {
  id: string;
  source: BatchSource;
  source_id: string | null;
  settings: BatchSettings;
  owner: { id: string; name: string } | null;
  created_at: string;
  finished_at: string | null;
  undone_at: string | null;
  left_out: BatchLeftOut[];
  left_out_total: number;
  kept: Array<{ deal_id: string; title: string | null }>;
  kept_total: number;
}

export interface BatchUndoResult {
  removed: number;
  kept: Array<{ deal_id: string; title: string | null }>;
  kept_total: number;
}

export const dealBatchKeys = {
  candidates: (ws: string | null | undefined, source: BatchSource, id: string | null, picked: string) =>
    ["deal-batch-candidates", ws, source, id, picked] as const,
  batch: (ws: string | null | undefined, id: string) => ["deal-batch", ws, id] as const,
};

export async function getBatchCandidates(body: {
  source: BatchSource;
  source_id?: string;
  contact_ids?: string[];
}): Promise<BatchCandidates> {
  return (await apiClient.post<BatchCandidates>("/deal-batches/candidates", body, { timeout: 120_000 })).data;
}

export async function createDealBatch(body: CreateBatchBody): Promise<{ id: string; total: number }> {
  return (await apiClient.post<{ id: string; total: number }>("/deal-batches", body, { timeout: 120_000 })).data;
}

/** Runs the batch to the end, one slice per call; safe to call again after an error. */
export async function runDealBatch(id: string, onProgress?: (r: BatchRunResult) => void): Promise<BatchRunResult> {
  for (;;) {
    const r = (await apiClient.post<BatchRunResult>(`/deal-batches/${id}/run`, {}, { timeout: 120_000 })).data;
    onProgress?.(r);
    if (!r.remaining) return r;
  }
}

export async function getDealBatch(id: string): Promise<BatchSummary> {
  return (await apiClient.get<BatchSummary>(`/deal-batches/${id}`)).data;
}

export async function getDealBatchLeftOut(id: string): Promise<BatchLeftOut[]> {
  return (await apiClient.get<BatchLeftOut[]>(`/deal-batches/${id}/left-out`)).data;
}

/** Takes the batch's untouched deals back, slice by slice. */
export async function undoDealBatch(id: string, onProgress?: (remaining: number) => void): Promise<BatchUndoResult> {
  for (;;) {
    const r = (
      await apiClient.post<BatchUndoResult & { remaining: number }>(`/deal-batches/${id}/undo`, {}, { timeout: 120_000 })
    ).data;
    if (!r.remaining) return r;
    onProgress?.(r.remaining);
  }
}

// ── handing a selection over from the contacts list ─────────────────────────

const PICK_KEY = "deal-batch:selection";

/** The contacts list puts the picked ids here (this tab only) before opening the page. */
export function rememberSelection(ids: string[]): void {
  try {
    sessionStorage.setItem(PICK_KEY, JSON.stringify(ids.slice(0, MAX_BATCH_CONTACTS)));
  } catch {
    /* private mode: the page then says the selection is gone */
  }
}

export function recallSelection(): string[] {
  try {
    const raw = sessionStorage.getItem(PICK_KEY);
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
