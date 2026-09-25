import { apiClient } from "./axios-instance";
import type { Lead, LeadContactState } from "./leads";

export type ContactChannel = "call" | "whatsapp" | "email";
export type LeadOutcome = "reached" | "no_answer" | "not_interested" | "fake";

export async function recordContactAttempt(
  leadId: string,
  channel: ContactChannel,
): Promise<LeadContactState & { is_first: boolean }> {
  const { data } = await apiClient.post(`/leads/${leadId}/contact-attempts`, {
    channel,
  });
  return data;
}

export interface RecordOutcomeInput {
  outcome: LeadOutcome;
  note?: string;
  /** no_answer: when to call again (ISO). */
  follow_up_due_at?: string;
  /** no_answer: follow-up task title, already translated. */
  follow_up_title?: string;
  from_status?: string;
}

export interface RecordOutcomeResult {
  outcome: LeadOutcome;
  from_status: string;
  to_status: string | null;
  task_id: string | null;
  lead: Lead;
  contact_state: LeadContactState | null;
}

export async function recordLeadOutcome(
  leadId: string,
  input: RecordOutcomeInput,
): Promise<RecordOutcomeResult> {
  const { data } = await apiClient.post(`/leads/${leadId}/outcome`, input);
  return data;
}

export interface MakeDealInput {
  title?: string;
  value?: number | null;
  currency?: "EUR" | "USD" | "CAD";
  pipeline_id?: string;
  assigned_to?: string | null;
  first_task?: { title: string; due_date?: string };
}

export async function makeDealFromLead(
  leadId: string,
  input: MakeDealInput,
): Promise<{
  deal_id: string;
  contact_id: string;
  task_id: string | null;
  /** True when the lead already had a deal and that one was returned. */
  existing?: boolean;
}> {
  const { data } = await apiClient.post(`/leads/${leadId}/deal`, input);
  return data;
}
