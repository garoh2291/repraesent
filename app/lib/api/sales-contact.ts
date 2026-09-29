import { apiClient } from "./axios-instance";

/** Sidebar "Contact re:praesent" (every workspace except the root one). */

export interface ContactBooking {
  start: string;
  end: string;
  host_label: string | null;
  meet_link: string | null;
}

export interface SalesContactConfig {
  mode: "booking" | "message";
  hosts: Array<{ label: string | null; avatar_url: string | null }>;
  duration_minutes: number;
  timezone: string;
  max_days_ahead: number;
  upcoming: ContactBooking | null;
  requester: { email: string; name: string | null };
}

export const salesContactKey = (workspaceId: string | null | undefined) => ["sales-contact", workspaceId ?? "none"] as const;

export async function getSalesContactConfig() {
  return (await apiClient.get<SalesContactConfig>("/sales-contact/config")).data;
}

export async function getContactDays(from: string, to: string) {
  return (
    await apiClient.get<{ days: Array<{ date: string; state: string; free: number }>; unavailable: boolean }>("/sales-contact/days", {
      params: { from, to },
    })
  ).data;
}

export async function getContactSlots(date: string) {
  return (await apiClient.get<{ slots: string[]; unavailable: boolean }>("/sales-contact/slots", { params: { date } })).data;
}

export async function bookContactCall(slot: string, note?: string) {
  return (await apiClient.post<{ booking: ContactBooking }>("/sales-contact/book", { slot, ...(note?.trim() ? { note: note.trim() } : {}) })).data;
}

export async function sendContactMessage(message: string, phone?: string) {
  return (await apiClient.post<{ ok: true }>("/sales-contact/message", { message, ...(phone?.trim() ? { phone: phone.trim() } : {}) })).data;
}
