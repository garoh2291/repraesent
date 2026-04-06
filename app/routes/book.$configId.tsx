import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import i18n from "~/i18n";
import {
  getPublicConfig,
  getAvailabilitiesPublic,
  getWorkspaceProvidersPublic,
  createBooking,
  type CreateBookingDto,
  type PublicConfig,
  type BookingFieldConfig,
  type AppointmentService,
  type ProviderPublic,
} from "~/lib/api/appointments";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Calendar } from "~/components/ui/calendar";
import { ScrollArea } from "~/components/ui/scroll-area";
import TimezoneSelect from "react-timezone-select";
import axios from "axios";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  CalendarDays,
  User,
  Layers,
  Clock,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { formatDateLong, formatTime } from "~/lib/utils/format";

export function meta() {
  return [
    { title: i18n.t("booking.metaTitle") },
    { name: "description", content: i18n.t("booking.metaDescription") },
  ];
}

const BOOKING_FIELD_KEYS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "address",
  "city",
  "zip_code",
  "notes",
] as const;

const DEFAULT_BOOKING_FIELDS: Record<string, BookingFieldConfig> = {
  first_name: { display: true, require: true },
  last_name: { display: true, require: true },
  email: { display: true, require: true },
  phone: { display: true, require: false },
  address: { display: false, require: false },
  city: { display: false, require: false },
  zip_code: { display: false, require: false },
  notes: { display: true, require: false },
};

function formatSlotInTimezone(
  slot: string,
  timezone: string,
  timeFormat: string
): string {
  const [start] = slot.split("--");
  const date = new Date(start);
  return formatTime(date, { hour12: timeFormat === "12h", timeZone: timezone });
}

function getDefaultTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && tz.length > 0 ? tz : "Europe/Berlin";
  } catch {
    return "Europe/Berlin";
  }
}

function getNextWorkingDay(
  from: Date,
  disabledDayOfWeek: number[],
  maxDays = 14
): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  for (let i = 0; i < maxDays; i++) {
    if (!disabledDayOfWeek.includes(d.getDay())) return d;
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/** Showroom-style neutrals (aligned with light contact-form pages) */
const BOOKING_RADIUS_CARD = "rounded-lg";

export default function BookAppointment() {
  const { t } = useTranslation();
  const { configId } = useParams<{ configId: string }>();
  const queryClient = useQueryClient();
  const [activeConfigId, setActiveConfigId] = useState<string | null>(
    configId ?? null
  );
  const [selectedProvider, setSelectedProvider] =
    useState<ProviderPublic | null>(null);
  const [selectedService, setSelectedService] =
    useState<AppointmentService | null>(null);
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [userTimezone, setUserTimezone] = useState<string>(getDefaultTimezone);
  const [formFields, setFormFields] = useState<Record<string, string>>({});
  const [booked, setBooked] = useState(false);
  const [slotConflictError, setSlotConflictError] = useState(false);

  const { data: providers } = useQuery({
    queryKey: ["workspace-providers", configId],
    queryFn: () => getWorkspaceProvidersPublic(configId!),
    enabled: !!configId,
  });

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["public-config", activeConfigId],
    queryFn: () => getPublicConfig(activeConfigId!),
    enabled: !!activeConfigId,
  });

  const selectedDateStr = selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`
    : "";
  const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(selectedDateStr);

  const serviceDuration = selectedService?.duration_minutes;

  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: [
      "availabilities-public",
      activeConfigId,
      selectedDateStr,
      serviceDuration,
    ],
    queryFn: () =>
      getAvailabilitiesPublic(
        activeConfigId!,
        selectedDateStr,
        serviceDuration
      ),
    enabled: !!activeConfigId && !!selectedDateStr && isValidDate,
  });

  const bookMutation = useMutation({
    mutationFn: (dto: CreateBookingDto) => createBooking(dto),
    onSuccess: () => {
      setBooked(true);
      queryClient.invalidateQueries({ queryKey: ["availabilities-public"] });
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        setSlotConflictError(true);
        setSelectedSlot(null);
        setStep(1);
        queryClient.invalidateQueries({ queryKey: ["availabilities-public"] });
      } else {
        toast.error(t("booking.failedToBook"), {
          description: extractErrorMessage(error),
        });
      }
    },
  });

  const disabledBefore = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const WEEKDAY_KEYS = [
    "sun",
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
    "sat",
  ] as const;
  const disabledDayOfWeek = useMemo(() => {
    const wh = config?.working_hours;
    if (!wh) return [];
    const indices: number[] = [];
    for (let i = 0; i < 7; i++) {
      const dayConfig = wh[WEEKDAY_KEYS[i]];
      if (!dayConfig || dayConfig.enabled === false) {
        indices.push(i);
      }
    }
    return indices;
  }, [config?.working_hours]);

  const firstWeekday = config?.first_weekday === "sunday" ? 0 : 1;
  const timeFormat = config?.time_format ?? "24h";
  const bgColor = config?.company_color ?? "#262626";
  const textColor = config?.company_text_color ?? "#ffffff";

  const hasMultipleProviders = providers && providers.length > 1;

  // Auto-select provider: if only one provider, skip provider selection
  useEffect(() => {
    if (providers && !selectedProvider) {
      if (providers.length === 1) {
        setSelectedProvider(providers[0]!);
        setActiveConfigId(providers[0]!.id);
        // step will be set by service effect below
      } else if (providers.length > 1) {
        setStep(-1);
      }
    }
  }, [providers, selectedProvider]);

  // Auto-select service: if only one service exists, skip service selection step
  const services = config?.services ?? null;
  const hasMultipleServices = services && services.length > 1;

  useEffect(() => {
    if (config && services && selectedProvider) {
      if (services.length === 1 && !selectedService) {
        setSelectedService(services[0]!);
        setStep(1);
      } else if (services.length > 1 && !selectedService) {
        setStep(0);
      }
    }
  }, [config, services, selectedService, selectedProvider]);

  const bookingFields = config?.booking_fields ?? DEFAULT_BOOKING_FIELDS;
  const displayedFields = BOOKING_FIELD_KEYS.filter(
    (key) => bookingFields[key]?.display !== false
  ).map((key) => ({ key, label: t(`booking.fields.${key}`) }));

  useEffect(() => {
    if (config && selectedDate === undefined) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setSelectedDate(today);
    }
  }, [config, selectedDate]);

  useEffect(() => {
    if (
      config &&
      !slotsLoading &&
      selectedDateStr &&
      slots.length === 0 &&
      selectedDate
    ) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sel = new Date(selectedDate);
      sel.setHours(0, 0, 0, 0);
      const isToday = sel.getTime() === today.getTime();
      if (isToday) {
        const next = getNextWorkingDay(selectedDate, disabledDayOfWeek);
        if (next.getTime() !== selectedDate.getTime()) {
          setSelectedDate(next);
        }
      }
    }
  }, [
    config,
    slotsLoading,
    selectedDateStr,
    slots.length,
    selectedDate,
    disabledDayOfWeek,
  ]);

  function handleDateSelect(date: Date | undefined) {
    setSelectedDate(date);
    setSelectedSlot(null);
  }

  function handleConfirm() {
    if (!activeConfigId || !selectedSlot) return;

    const [start, end] = selectedSlot.split("--");
    const dto: CreateBookingDto = {
      configId: activeConfigId,
      start,
      end,
      ...formFields,
      customerName:
        formFields.first_name || formFields.last_name
          ? [formFields.first_name, formFields.last_name]
              .filter(Boolean)
              .join(" ")
          : undefined,
      customerEmail: formFields.email || undefined,
      service_id: selectedService?.id,
      service_name: selectedService?.name,
    };

    bookMutation.mutate(dto);
  }

  function setField(key: string, value: string) {
    setFormFields((prev) => ({ ...prev, [key]: value }));
  }

  const canProceedStep1 = !!selectedDate && !!selectedSlot;
  const canProceedStep2 = displayedFields
    .filter((f) => bookingFields[f.key]?.require)
    .every((f) => (formFields[f.key] ?? "").trim());

  if (!configId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-stone-50">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-foreground">
            {t("booking.invalidLink")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("booking.invalidLinkDesc")}
          </p>
        </div>
      </div>
    );
  }

  if (configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-stone-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 rounded-full border-2 border-stone-200 border-t-stone-500 animate-spin" />
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-stone-50">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-foreground">
            {t("booking.bookingNotFound")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("booking.bookingNotFoundDesc")}
          </p>
        </div>
      </div>
    );
  }

  /* ── Confirmed state ─────────────────────────────────────── */
  if (booked) {
    return (
      <div className="min-h-screen flex flex-col bg-stone-50">
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md space-y-6 app-fade-up w-full">
            <div
              className={cn(
                "inline-flex h-16 w-16 items-center justify-center mx-auto border-2 bg-white",
                BOOKING_RADIUS_CARD
              )}
              style={{ borderColor: bgColor, color: bgColor }}
            >
              <Check className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-foreground tracking-tight">
                {t("booking.confirmedTitle")}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("booking.confirmedDesc")}
              </p>
            </div>
            <button
              onClick={() => {
                setBooked(false);
                setSelectedDate(undefined);
                setSelectedSlot(null);
                setFormFields({});
                if (hasMultipleProviders) {
                  setSelectedProvider(null);
                  setSelectedService(null);
                  setActiveConfigId(configId ?? null);
                  setStep(-1);
                } else if (hasMultipleServices) {
                  setSelectedService(null);
                  setStep(0);
                } else {
                  setStep(1);
                }
              }}
              className={cn(
                "inline-flex h-10 items-center justify-center border border-stone-300 bg-white px-6 text-sm font-medium text-foreground hover:bg-stone-50 transition-colors",
                BOOKING_RADIUS_CARD
              )}
            >
              {t("booking.bookAnother")}
            </button>
          </div>
        </main>
      </div>
    );
  }

  /* ── Main booking flow ───────────────────────────────────── */
  return (
    <div className="min-h-screen flex flex-col bg-[#eeeeee] text-foreground">
      <main className="flex-1 py-6 sm:py-10 px-4 sm:px-6">
        <div
          className={cn(
            "mx-auto w-full space-y-6 sm:space-y-8",
            step === 1 ? "max-w-4xl" : "max-w-2xl"
          )}
        >
          {/* Step content */}
          <div className="app-fade-up">
            {step === -1 && providers && (
              <StepNegative1ProviderSelection
                t={t}
                providers={providers}
                selectedProvider={selectedProvider}
                onSelect={(provider) => {
                  setSelectedProvider(provider);
                  setActiveConfigId(provider.id);
                  setSelectedService(null);
                  setStep(0);
                }}
                accentColor={bgColor}
              />
            )}
            {step === 0 && services && (
              <Step0ServiceSelection
                t={t}
                services={services}
                selectedService={selectedService}
                onSelect={(svc) => {
                  setSelectedService(svc);
                  setStep(1);
                }}
                accentColor={bgColor}
              />
            )}
            {step === 1 && (
              <Step1DateAndTime
                t={t}
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
                selectedSlot={selectedSlot}
                onSlotSelect={(slot) => {
                  setSlotConflictError(false);
                  setSelectedSlot(slot);
                }}
                slots={slots}
                slotsLoading={slotsLoading}
                userTimezone={userTimezone}
                onTimezoneChange={setUserTimezone}
                timeFormat={timeFormat}
                disabledBefore={disabledBefore}
                disabledDayOfWeek={disabledDayOfWeek}
                firstWeekday={firstWeekday}
                bgColor={bgColor}
                textColor={textColor}
                selectedService={selectedService}
                slotConflictError={slotConflictError}
                onDismissConflict={() => setSlotConflictError(false)}
              />
            )}
            {step === 2 && (
              <Step2CustomerInfo
                t={t}
                fields={displayedFields}
                bookingFields={bookingFields}
                formFields={formFields}
                onFieldChange={setField}
              />
            )}
            {step === 3 && selectedSlot && (
              <Step3Confirmation
                t={t}
                config={config}
                selectedDate={selectedDate!}
                selectedSlot={selectedSlot}
                userTimezone={userTimezone}
                timeFormat={timeFormat}
                formFields={formFields}
                displayedFields={displayedFields}
                onConfirm={handleConfirm}
                isPending={bookMutation.isPending}
                bgColor={bgColor}
                textColor={textColor}
                selectedService={selectedService}
              />
            )}
          </div>

          {/* Navigation */}
          {(step > 0 || (step === 0 && !!hasMultipleProviders)) && (
            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => {
                  if (step === 1 && hasMultipleServices) {
                    setSelectedService(null);
                    setStep(0);
                  } else if (step === 0 && hasMultipleProviders) {
                    setSelectedProvider(null);
                    setSelectedService(null);
                    setActiveConfigId(configId ?? null);
                    setStep(-1);
                  } else {
                    setStep((s) => Math.max(1, s - 1));
                  }
                }}
                disabled={
                  step === 1 && !hasMultipleServices && !hasMultipleProviders
                }
                className={cn(
                  "inline-flex items-center gap-1.5 h-10 border border-stone-300 bg-white px-4 text-sm font-medium text-foreground hover:bg-stone-50 transition-colors disabled:opacity-40 disabled:pointer-events-none",
                  BOOKING_RADIUS_CARD
                )}
              >
                <ChevronLeft className="h-4 w-4" />
                {t("booking.back")}
              </button>
              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                  disabled={
                    (step === 1 && !canProceedStep1) ||
                    (step === 2 && !canProceedStep2)
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 h-10 px-5 text-sm font-medium transition-opacity disabled:opacity-40 disabled:pointer-events-none hover:opacity-90 border border-transparent",
                    BOOKING_RADIUS_CARD
                  )}
                  style={{ backgroundColor: bgColor, color: textColor }}
                >
                  {t("common.next")}
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ── Step -1: Provider Selection ────────────────────────────── */

function StepNegative1ProviderSelection({
  t,
  providers,
  selectedProvider,
  onSelect,
  accentColor,
}: {
  t: (key: string, opts?: Record<string, unknown>) => string;
  providers: ProviderPublic[];
  selectedProvider: ProviderPublic | null;
  onSelect: (provider: ProviderPublic) => void;
  accentColor: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground tracking-tight">
          {t("booking.chooseProvider")}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("booking.chooseProviderDesc")}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {providers.map((provider) => {
          const isSelected = selectedProvider?.id === provider.id;
          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => onSelect(provider)}
              className={cn(
                "text-left border bg-white p-4 transition-colors duration-150 hover:border-stone-400",
                BOOKING_RADIUS_CARD,
                isSelected ? "border-2 shadow-sm" : "border-stone-200"
              )}
              style={isSelected ? { borderColor: accentColor } : undefined}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-stone-50 text-sm font-semibold text-foreground"
                  style={{ color: isSelected ? accentColor : undefined }}
                >
                  {(provider.provider_name ?? "?").charAt(0).toUpperCase()}
                </div>
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {provider.provider_name ?? t("booking.unknownProvider")}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Step 0: Service Selection ───────────────────────────────── */

function Step0ServiceSelection({
  t,
  services,
  selectedService,
  onSelect,
  accentColor,
}: {
  t: (key: string, opts?: Record<string, unknown>) => string;
  services: AppointmentService[];
  selectedService: AppointmentService | null;
  onSelect: (svc: AppointmentService) => void;
  accentColor: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground tracking-tight">
          {t("booking.chooseService")}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("booking.chooseServiceDesc")}
        </p>
      </div>

      <div className="flex w-full flex-col gap-4">
        {services.map((svc) => {
          const isSelected = selectedService?.id === svc.id;
          return (
            <button
              key={svc.id}
              type="button"
              onClick={() => onSelect(svc)}
              className={cn(
                "w-full text-left border bg-white px-5 py-5 transition-colors duration-150 sm:px-6 sm:py-6 space-y-3 hover:border-stone-400",
                BOOKING_RADIUS_CARD,
                isSelected ? "border-2 shadow-sm" : "border-stone-200"
              )}
              style={isSelected ? { borderColor: accentColor } : undefined}
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-base font-semibold text-foreground leading-snug sm:text-lg">
                  {svc.name}
                </p>
                <span
                  className="shrink-0 rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1 text-sm font-medium text-foreground"
                  style={
                    isSelected
                      ? { borderColor: accentColor, color: accentColor }
                      : undefined
                  }
                >
                  {t("appointments.businessLogic.minutesSuffix", {
                    count: svc.duration_minutes,
                  })}
                </span>
              </div>
              {svc.description && (
                <p className="text-sm text-muted-foreground leading-relaxed sm:text-[15px]">
                  {svc.description}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Step 1: Date & Time ─────────────────────────────────────── */

function Step1DateAndTime({
  t,
  selectedDate,
  onDateSelect,
  selectedSlot,
  onSlotSelect,
  slots,
  slotsLoading,
  userTimezone,
  onTimezoneChange,
  timeFormat,
  disabledBefore,
  disabledDayOfWeek,
  firstWeekday,
  bgColor,
  textColor,
  selectedService,
  slotConflictError,
  onDismissConflict,
}: {
  t: (key: string, opts?: Record<string, unknown>) => string;
  selectedDate: Date | undefined;
  onDateSelect: (d: Date | undefined) => void;
  selectedSlot: string | null;
  onSlotSelect: (s: string) => void;
  slots: string[];
  slotsLoading: boolean;
  userTimezone: string;
  onTimezoneChange: (tz: string) => void;
  timeFormat: string;
  disabledBefore: Date;
  disabledDayOfWeek: number[];
  firstWeekday: number;
  bgColor: string;
  textColor: string;
  selectedService: AppointmentService | null;
  slotConflictError?: boolean;
  onDismissConflict?: () => void;
}) {
  return (
    <div className="space-y-6">
      {slotConflictError && (
        <style>{`
          @keyframes slot-conflict-in {
            from { opacity: 0; transform: translateY(-8px) scale(0.98); }
            to   { opacity: 1; transform: translateY(0)    scale(1);    }
          }
          .slot-conflict-banner { animation: slot-conflict-in 0.25s cubic-bezier(0.16,1,0.3,1) both; }
        `}</style>
      )}
      {slotConflictError && (
        <div className="slot-conflict-banner border border-amber-200 bg-amber-50 p-4 flex items-start gap-3 rounded-lg">
          <div className="shrink-0 mt-0.5 h-8 w-8 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center">
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">
              {t("booking.slotTaken")}
            </p>
            <p className="text-sm text-amber-700 mt-0.5 leading-snug">
              {t("booking.slotTakenDesc")}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismissConflict}
            className="shrink-0 h-6 w-6 rounded-md hover:bg-amber-100 flex items-center justify-center transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5 text-amber-500" />
          </button>
        </div>
      )}
      <div>
        <h2 className="text-xl font-semibold text-foreground tracking-tight">
          {t("booking.chooseDateAndTime")}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("booking.chooseDateAndTimeDesc")}
        </p>
        {selectedService && (
          <div className="mt-2 inline-flex items-center gap-2 border border-stone-200 bg-white px-3 py-1.5 text-sm rounded-md">
            <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium text-foreground">
              {selectedService.name}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              {t("appointments.businessLogic.minutesSuffix", {
                count: selectedService.duration_minutes,
              })}
            </span>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Calendar */}
        <div
          className={cn(
            "booking-cal overflow-hidden border bg-[#f5f4f1]",
            BOOKING_RADIUS_CARD,
            "border-stone-200"
          )}
        >
          <style>{`
            .booking-cal [data-selected-single="true"] {
              background-color: ${bgColor} !important;
              color: ${textColor} !important;
            }
            .booking-cal td.rdp-day_today,
            .booking-cal [data-today="true"] {
              background-color: #f5f4f1 !important;
            }
            .booking-cal [data-today="true"] button:not([data-selected-single="true"]) {
              font-weight: 700;
              color: ${bgColor} !important;
              background-color: #f5f4f1 !important;
            }
            .booking-cal [data-today="true"] button:not([data-selected-single="true"]):hover {
              background-color: #ece9e5 !important;
            }
            .booking-cal button:not([data-selected-single="true"]):not([disabled]):hover {
              background-color: rgba(0,0,0,0.06) !important;
            }
          `}</style>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={onDateSelect}
            disabled={(date) => {
              const d = new Date(date);
              d.setHours(0, 0, 0, 0);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              if (d.getTime() < today.getTime()) return true;
              if (disabledDayOfWeek.includes(d.getDay())) return true;
              return false;
            }}
            startMonth={disabledBefore}
            defaultMonth={selectedDate ?? new Date()}
            weekStartsOn={firstWeekday as 0 | 1}
            className="border-0 w-full"
            classNames={{
              today:
                "rounded-md bg-[#f5f4f1] text-foreground data-[selected=true]:rounded-none",
            }}
          />
        </div>

        {/* Time slots */}
        <div className="space-y-4">
          {/* Timezone */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t("booking.timezone")}
            </label>
            <TimezoneSelect
              value={userTimezone}
              onChange={(tz) =>
                onTimezoneChange(typeof tz === "string" ? tz : tz.value)
              }
              className="[&_.react-select__control]:min-h-10 [&_.react-select__control]:rounded-md [&_.react-select__control]:border-stone-200 [&_.react-select__control]:bg-white [&_.react-select__control]:text-sm"
            />
          </div>

          {selectedDate && (
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {t("booking.availableTimes")}
              </label>
              {slotsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="h-10 bg-muted rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <div className="border border-stone-200 bg-white px-4 py-6 text-center rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    {t("booking.noSlotsForDate")}
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[280px] sm:h-[380px] border border-stone-200 bg-white rounded-lg">
                  <div className="flex flex-col gap-1.5 p-2">
                    {slots.map((slot) => {
                      const isSelected = selectedSlot === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => onSlotSelect(slot)}
                          className={cn(
                            "w-full h-10 rounded-md text-sm font-medium text-left px-4 transition-colors duration-150 border",
                            isSelected
                              ? "border-2 bg-white"
                              : "border-stone-200 text-foreground hover:bg-stone-50"
                          )}
                          style={
                            isSelected
                              ? { borderColor: bgColor, color: bgColor }
                              : undefined
                          }
                        >
                          {formatSlotInTimezone(slot, userTimezone, timeFormat)}
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Step 2: Customer Info ───────────────────────────────────── */

function Step2CustomerInfo({
  t,
  fields,
  bookingFields,
  formFields,
  onFieldChange,
}: {
  t: (key: string) => string;
  fields: { key: string; label: string }[];
  bookingFields: Record<string, BookingFieldConfig>;
  formFields: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
}) {
  const required = fields.filter((f) => bookingFields[f.key]?.require);
  const optional = fields.filter((f) => !bookingFields[f.key]?.require);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground tracking-tight">
          {t("booking.yourInformation")}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("booking.yourInformationDesc")}
        </p>
      </div>

      <div className="space-y-6">
        {/* Required fields */}
        <div
          className={cn(
            "border border-stone-200 bg-white p-5 space-y-4",
            BOOKING_RADIUS_CARD
          )}
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("booking.requiredSection")}
          </p>
          {required.map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <Label
                htmlFor={key}
                className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
              >
                {label}
              </Label>
              {key === "notes" ? (
                <Textarea
                  id={key}
                  value={formFields[key] ?? ""}
                  onChange={(e) => onFieldChange(key, e.target.value)}
                  rows={3}
                  className="resize-none text-sm"
                />
              ) : (
                <Input
                  id={key}
                  type={key === "email" ? "email" : "text"}
                  value={formFields[key] ?? ""}
                  onChange={(e) => onFieldChange(key, e.target.value)}
                  className="h-10 text-sm"
                />
              )}
            </div>
          ))}
          {required.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("booking.noRequiredFields")}
            </p>
          )}
        </div>

        {/* Optional fields */}
        {optional.length > 0 && (
          <div
            className={cn(
              "border border-stone-200 bg-white p-5 space-y-4",
              BOOKING_RADIUS_CARD
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t("booking.optionalSection")}
            </p>
            {optional.map(({ key, label }) => (
              <div key={key} className="space-y-1.5">
                <Label
                  htmlFor={key}
                  className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  {label}
                </Label>
                {key === "notes" ? (
                  <Textarea
                    id={key}
                    value={formFields[key] ?? ""}
                    onChange={(e) => onFieldChange(key, e.target.value)}
                    rows={3}
                    className="resize-none text-sm"
                  />
                ) : (
                  <Input
                    id={key}
                    type={key === "email" ? "email" : "text"}
                    value={formFields[key] ?? ""}
                    onChange={(e) => onFieldChange(key, e.target.value)}
                    className="h-10 text-sm"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Step 3: Confirmation ────────────────────────────────────── */

function Step3Confirmation({
  t,
  config,
  selectedDate,
  selectedSlot,
  userTimezone,
  timeFormat,
  formFields,
  displayedFields,
  onConfirm,
  isPending,
  bgColor,
  textColor,
  selectedService,
}: {
  t: (key: string, opts?: Record<string, unknown>) => string;
  config: PublicConfig;
  selectedDate: Date;
  selectedSlot: string;
  userTimezone: string;
  timeFormat: string;
  formFields: Record<string, string>;
  displayedFields: { key: string; label: string }[];
  onConfirm: () => void;
  isPending: boolean;
  bgColor: string;
  textColor: string;
  selectedService: AppointmentService | null;
}) {
  const timeStr = formatSlotInTimezone(selectedSlot, userTimezone, timeFormat);
  const dateStr = formatDateLong(selectedDate);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground tracking-tight">
          {t("booking.reviewAndConfirm")}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("booking.reviewAndConfirmDesc")}
        </p>
      </div>

      <div className="space-y-6">
        {/* Appointment summary */}
        <div
          className={cn(
            "border border-stone-200 bg-white p-5 space-y-4",
            BOOKING_RADIUS_CARD
          )}
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("booking.appointmentSection")}
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-stone-200 bg-stone-50">
                <CalendarDays className="h-4 w-4" style={{ color: bgColor }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {dateStr}
                </p>
                <p className="text-sm text-muted-foreground">
                  {timeStr} · {userTimezone}
                </p>
              </div>
            </div>
            {selectedService && (
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-stone-200 bg-stone-50">
                  <Layers className="h-4 w-4" style={{ color: bgColor }} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {selectedService.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("appointments.businessLogic.minutesSuffix", {
                      count: selectedService.duration_minutes,
                    })}
                  </p>
                </div>
              </div>
            )}
            {config.company_name && (
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-stone-200 bg-stone-50">
                  <User className="h-4 w-4" style={{ color: bgColor }} />
                </div>
                <p className="text-sm text-foreground">{config.company_name}</p>
              </div>
            )}
          </div>
        </div>

        {/* Customer details */}
        <div
          className={cn(
            "border border-stone-200 bg-white p-5 space-y-4",
            BOOKING_RADIUS_CARD
          )}
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("booking.yourDetails")}
          </p>
          <dl className="space-y-2.5">
            {displayedFields
              .filter((f) => formFields[f.key])
              .map(({ key, label }) => (
                <div key={key} className="grid grid-cols-[100px_1fr] gap-2">
                  <dt className="text-xs text-muted-foreground pt-0.5">
                    {label}
                  </dt>
                  <dd className="text-sm font-medium text-foreground">
                    {formFields[key]}
                  </dd>
                </div>
              ))}
          </dl>
        </div>
      </div>

      {/* Confirm CTA */}
      <div className="flex justify-center pt-2">
        <button
          onClick={onConfirm}
          disabled={isPending}
          className={cn(
            "inline-flex h-11 items-center gap-2 border border-transparent px-8 text-sm font-semibold transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50",
            BOOKING_RADIUS_CARD
          )}
          style={{ backgroundColor: bgColor, color: textColor }}
        >
          {isPending ? (
            <>
              <div className="h-4 w-4 rounded-full border-2 border-current/30 border-t-current animate-spin" />
              {t("booking.confirming")}
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              {t("booking.confirmAppointment")}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
