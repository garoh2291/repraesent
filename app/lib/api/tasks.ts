import { apiClient } from "./axios-instance";

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskUrgency = "overdue" | "due_soon" | "upcoming" | null;

export interface Task {
  id: string;
  entity_id: string;
  entity_table: string;
  lead_full_name: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  due_date: string | null;
  urgency: TaskUrgency;
  assignee_id: string | null;
  assignee_first_name: string | null;
  assignee_last_name: string | null;
  created_by: string;
  creator_first_name: string | null;
  creator_last_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedTasks {
  data: Task[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface TaskHistoryItem {
  action: string;
  details: Record<string, unknown>;
  user_id: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
  created_at: string;
}

export interface CreateTaskPayload {
  title: string;
  description?: string | null;
  due_date?: string | null;
  assignee_id?: string | null;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  due_date?: string | null;
  assignee_id?: string | null;
}

export interface GetTasksParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: TaskStatus | "";
  assignee_id?: string;
  due_date_from?: string;
  due_date_to?: string;
  lead_id?: string;
}

export async function getTasksForLead(leadId: string): Promise<Task[]> {
  const res = await apiClient.get<Task[]>(`/leads/${leadId}/tasks`);
  return res.data;
}

export async function createTask(
  leadId: string,
  payload: CreateTaskPayload,
): Promise<Task> {
  const res = await apiClient.post<Task>(`/leads/${leadId}/tasks`, payload);
  return res.data;
}

export async function getAllTasks(
  params: GetTasksParams = {},
): Promise<PaginatedTasks> {
  const searchParams = new URLSearchParams();
  if (params.page != null) searchParams.set("page", String(params.page));
  if (params.limit != null) searchParams.set("limit", String(params.limit));
  if (params.search) searchParams.set("search", params.search);
  if (params.status) searchParams.set("status", params.status);
  if (params.assignee_id) searchParams.set("assignee_id", params.assignee_id);
  if (params.due_date_from)
    searchParams.set("due_date_from", params.due_date_from);
  if (params.due_date_to) searchParams.set("due_date_to", params.due_date_to);
  if (params.lead_id) searchParams.set("lead_id", params.lead_id);

  const res = await apiClient.get<PaginatedTasks>(
    `/tasks?${searchParams.toString()}`,
  );
  return res.data;
}

export async function getTask(taskId: string): Promise<Task> {
  const res = await apiClient.get<Task>(`/tasks/${taskId}`);
  return res.data;
}

export async function updateTask(
  taskId: string,
  payload: UpdateTaskPayload,
): Promise<Task> {
  const res = await apiClient.patch<Task>(`/tasks/${taskId}`, payload);
  return res.data;
}

export async function deleteTask(taskId: string): Promise<void> {
  await apiClient.delete(`/tasks/${taskId}`);
}

export async function getTaskHistory(
  taskId: string,
): Promise<TaskHistoryItem[]> {
  const res = await apiClient.get<TaskHistoryItem[]>(`/tasks/${taskId}/history`);
  return res.data;
}
