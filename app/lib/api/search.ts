import { apiClient } from "./axios-instance";

export interface SearchHit {
  id: string;
  title: string;
  subtitle: string | null;
  status?: string | null;
  entity_table?: string | null;
  entity_id?: string | null;
}

export interface SearchResults {
  leads: SearchHit[];
  contacts: SearchHit[];
  deals: SearchHit[];
  forms: SearchHit[];
  tasks: SearchHit[];
}

export async function globalSearch(
  q: string,
  signal?: AbortSignal,
): Promise<SearchResults> {
  const { data } = await apiClient.get("/search", {
    params: { q, limit: 5 },
    signal,
  });
  return data;
}
