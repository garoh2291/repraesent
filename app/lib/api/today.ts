import { apiClient } from "./axios-instance";

export interface TodayLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  source_table: string;
  form_name: string | null;
  source_label: string | null;
  source_platform: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  attempts: number;
  last_attempt_at: string | null;
}

export interface TodayTask {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  urgency: "overdue" | "due_soon" | "upcoming" | null;
  entity_table: string;
  entity_id: string;
  entity_label: string | null;
  assignee_id: string | null;
  /** Deal tasks: open tasks left on that deal (this one included). */
  deal_open_tasks?: number;
  /** Deal tasks: the deal is still open (not won / lost). */
  deal_is_open?: boolean;
}

export interface TodayDeal {
  id: string;
  title: string | null;
  stage: string;
  pipeline_id: string;
  value: string | null;
  currency?: string;
  contact_name: string | null;
  /** The company the deal's contact works at. */
  contact_company?: string | null;
  assigned_to: string | null;
  updated_at: string;
}

export type SetupItemKey =
  | "email"
  | "form"
  | "website"
  | "assistant"
  | "teammate"
  | "calendar"
  | "profile";

export interface SetupState {
  items: { key: SetupItemKey; done: boolean }[];
  dismissed_items: string[];
  dismissed_at: string | null;
}

export interface TodayCounts {
  new_leads: number;
  /** Root workspace only: platform signups waiting for a call. */
  signups?: number;
  follow_ups_due: number;
  tasks_overdue: number;
  tasks_due_today: number;
  deals_no_next_step: number;
  unanswered_questions: number;
}

export type TodayResponse =
  | { supported: false }
  | {
      supported: true;
      is_root: boolean;
      scope: "me" | "all";
      generated_at: string;
      end_of_day: string;
      counts: TodayCounts;
      new_leads: TodayLead[] | null;
      signups: TodayLead[] | null;
      follow_ups: { lead: TodayLead; task: TodayTask }[] | null;
      tasks: TodayTask[] | null;
      deals_no_next_step: TodayDeal[] | null;
      unanswered:
        | { assistant_id: string; name: string; total_unanswered: number }[]
        | null;
      setup: SetupState | null;
      /** Only when AI visibility needs the owner. Older API: absent. */
      ai_visibility?: TodayAiAlert | null;
    };

export interface TodayAiAlert {
  reason: "wrong_fact" | "dropped" | "cap" | "key";
  named: number;
  answers: number;
  prev_named: number;
  prev_answers: number;
  /** Tracked competitor named more often, if any. */
  ahead: string | null;
  /** Answers this week that said something wrong about the business. */
  wrong_facts?: number;
}

export function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

export async function getToday(params: {
  assignee: "me" | "all";
  /** Rows per list (server default 20, max 50). The call queue asks for 50. */
  limit?: number;
}): Promise<TodayResponse> {
  const { data } = await apiClient.get("/today", {
    params: { assignee: params.assignee, tz: browserTimeZone(), ...(params.limit ? { limit: params.limit } : {}) },
  });
  return data;
}

export async function updateSetup(input: {
  dismiss_all?: boolean;
  restore_all?: boolean;
  dismiss?: SetupItemKey[];
  restore?: SetupItemKey[];
}): Promise<SetupState> {
  const { data } = await apiClient.patch("/today/setup", input);
  return data;
}
