import { apiClient } from "./axios-instance";

export interface AppointmentConfig {
  id: string;
  workspace_id: string;
  user_id: string;
  baikal_uri: string;
  baikal_username: string;
  slot_duration_minutes: number;
  working_hours?: Record<string, { start: string; end: string }> | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAppointmentConfigDto {
  baikal_uri: string;
  baikal_username: string;
  baikal_password: string;
}

export interface UpdateAppointmentConfigDto {
  baikal_uri?: string;
  baikal_username?: string;
  baikal_password?: string;
  slot_duration_minutes?: number;
  working_hours?: Record<string, { start: string; end: string }>;
}

export interface PublicConfig {
  id: string;
  slot_duration_minutes: number;
  working_hours: Record<string, { start: string; end: string }> | null;
}

export interface CreateBookingDto {
  configId: string;
  start: string;
  end: string;
  customerName: string;
  customerEmail: string;
  notes?: string;
}

export async function getAppointmentConfig(): Promise<AppointmentConfig | null> {
  const response = await apiClient.get<AppointmentConfig | null>(
    "/appointments/config"
  );
  return response.data;
}

export async function createAppointmentConfig(
  dto: CreateAppointmentConfigDto
): Promise<AppointmentConfig> {
  const response = await apiClient.post<AppointmentConfig>(
    "/appointments/config",
    dto
  );
  return response.data;
}

export async function updateAppointmentConfig(
  dto: UpdateAppointmentConfigDto
): Promise<AppointmentConfig> {
  const response = await apiClient.patch<AppointmentConfig>(
    "/appointments/config",
    dto
  );
  return response.data;
}

export async function deleteAppointmentConfig(): Promise<void> {
  await apiClient.delete("/appointments/config");
}

export async function getAppointments(): Promise<unknown[]> {
  const response = await apiClient.get<unknown[]>("/appointments/list");
  return response.data ?? [];
}

export async function getAppointmentProviderSettings(): Promise<{
  slot_duration_minutes: number;
  working_hours: Record<string, { start: string; end: string }>;
} | null> {
  const response = await apiClient.get<{
    slot_duration_minutes: number;
    working_hours: Record<string, { start: string; end: string }>;
  } | null>("/appointments/provider-settings");
  return response.data ?? null;
}

export async function updateAppointmentProviderSettings(data: {
  slot_duration_minutes?: number;
  working_hours?: Record<string, { start: string; end: string }>;
}): Promise<unknown> {
  const response = await apiClient.patch<unknown>(
    "/appointments/provider-settings",
    data
  );
  return response.data;
}

// Public API (no auth required)

export async function getPublicConfig(
  configId: string
): Promise<PublicConfig | null> {
  const response = await apiClient.get<PublicConfig | null>(
    `/appointments/public/${configId}`
  );
  return response.data ?? null;
}

export async function getAvailabilitiesPublic(
  configId: string,
  date: string
): Promise<string[]> {
  const response = await apiClient.get<string[]>(
    "/appointments/availabilities-public",
    { params: { configId, date } }
  );
  return response.data ?? [];
}

export async function createBooking(
  dto: CreateBookingDto
): Promise<{ success: boolean }> {
  const response = await apiClient.post<{ success: boolean }>(
    "/appointments/book",
    dto
  );
  return response.data;
}
