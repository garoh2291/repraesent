import { apiClient } from "./axios-instance";

export interface Note {
  id: string;
  version: number;
  content: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
}

export async function getNotes(leadId: string): Promise<Note[]> {
  const res = await apiClient.get<Note[]>(`/leads/${leadId}/notes`);
  return res.data;
}

export async function createNote(
  leadId: string,
  content: string
): Promise<Note> {
  const res = await apiClient.post<Note>(`/leads/${leadId}/notes`, {
    content,
  });
  return res.data;
}

export async function updateNote(
  noteId: string,
  content: string
): Promise<Note> {
  const res = await apiClient.patch<Note>(`/notes/${noteId}`, { content });
  return res.data;
}

export async function deleteNote(noteId: string): Promise<void> {
  await apiClient.delete(`/notes/${noteId}`);
}
