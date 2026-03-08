import { apiClient } from "./axios-instance";

export type WorkingHoursDay = {
  enabled?: boolean;
  start: string;
  end: string;
};

export type BookingFieldConfig = {
  display: boolean;
  require: boolean;
};

export type BreakConfig = {
  day: string;
  start: string;
  end: string;
};

export interface AppointmentConfig {
  id: string;
  workspace_id: string;
  user_id: string;
  baikal_uri: string;
  baikal_username: string;
  slot_duration_minutes: number;
  working_hours?: Record<string, WorkingHoursDay> | null;
  company_name?: string;
  company_email?: string;
  company_link?: string;
  company_headline?: string | null;
  company_logo_url?: string | null;
  company_color?: string;
  company_text_color?: string;
  timezone?: string;
  date_format?: string;
  time_format?: string;
  first_weekday?: string;
  booking_fields?: Record<string, BookingFieldConfig> | null;
  breaks?: BreakConfig[] | null;
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
  working_hours?: Record<string, WorkingHoursDay>;
  company_name?: string;
  company_email?: string;
  company_link?: string;
  company_headline?: string;
  company_logo_url?: string;
  company_color?: string;
  company_text_color?: string;
  timezone?: string;
  date_format?: string;
  time_format?: string;
  first_weekday?: string;
  booking_fields?: Record<string, BookingFieldConfig>;
  breaks?: BreakConfig[];
}

export interface PublicConfig {
  id: string;
  slot_duration_minutes: number;
  working_hours: Record<
    string,
    { start: string; end: string; enabled?: boolean }
  > | null;
  company_name?: string;
  company_headline?: string | null;
  company_logo_url?: string | null;
  company_color?: string;
  company_text_color?: string;
  timezone?: string;
  time_format?: string;
  first_weekday?: string;
  booking_fields?: Record<string, BookingFieldConfig> | null;
}

export interface CreateBookingDto {
  configId: string;
  start: string;
  end: string;
  customerName?: string;
  customerEmail?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  zip_code?: string;
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
  working_hours: Record<string, WorkingHoursDay>;
  breaks: BreakConfig[];
} | null> {
  const response = await apiClient.get<{
    slot_duration_minutes: number;
    working_hours: Record<string, WorkingHoursDay>;
    breaks: BreakConfig[];
  } | null>("/appointments/provider-settings");
  return response.data ?? null;
}

export async function updateAppointmentProviderSettings(data: {
  slot_duration_minutes?: number;
  working_hours?: Record<string, WorkingHoursDay>;
  breaks?: BreakConfig[];
}): Promise<unknown> {
  const response = await apiClient.patch<unknown>(
    "/appointments/provider-settings",
    data
  );
  return response.data;
}

export async function uploadAppointmentLogo(
  file: File
): Promise<{ company_logo_url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.post<{ company_logo_url: string }>(
    "/appointments/config/logo",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
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
