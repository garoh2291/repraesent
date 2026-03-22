import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import i18n from "~/i18n";
import {
  getPublicConfig,
  getAvailabilitiesPublic,
  createBooking,
  type CreateBookingDto,
  type PublicConfig,
  type BookingFieldConfig,
} from "~/lib/api/appointments";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { getLogoFullUrl } from "~/lib/config";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Calendar } from "~/components/ui/calendar";
import { ScrollArea } from "~/components/ui/scroll-area";
import TimezoneSelect from "react-timezone-select";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  CalendarDays,
  User,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "~/lib/utils";

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
  return date.toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: timeFormat === "12h",
  });
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

const STEPS = [
  { n: 1, labelKey: "booking.step1Label", icon: CalendarDays },
  { n: 2, labelKey: "booking.step2Label", icon: User },
  { n: 3, labelKey: "booking.step3Label", icon: ClipboardCheck },
];

export default function BookAppointment() {
  const { t } = useTranslation();
  const { configId } = useParams<{ configId: string }>();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [userTimezone, setUserTimezone] = useState<string>(getDefaultTimezone);
  const [formFields, setFormFields] = useState<Record<string, string>>({});
  const [booked, setBooked] = useState(false);

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["public-config", configId],
    queryFn: () => getPublicConfig(configId!),
    enabled: !!configId,
  });

  const selectedDateStr = selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`
    : "";
  const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(selectedDateStr);

  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ["availabilities-public", configId, selectedDateStr],
    queryFn: () => getAvailabilitiesPublic(configId!, selectedDateStr),
    enabled: !!configId && !!selectedDateStr && isValidDate,
  });

  const bookMutation = useMutation({
    mutationFn: (dto: CreateBookingDto) => createBooking(dto),
    onSuccess: () => {
      setBooked(true);
      queryClient.invalidateQueries({ queryKey: ["availabilities-public"] });
    },
    onError: (error) => {
      toast.error(t("booking.failedToBook"), {
        description: extractErrorMessage(error),
      });
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
  const bgColor = config?.company_color ?? "#1a1a1a";
  const textColor = config?.company_text_color ?? "#ffffff";
  const logoUrl = getLogoFullUrl(config?.company_logo_url);
  const defaultLogoUrl = "/re_praesent_logo.svg";

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
    if (!configId || !selectedSlot) return;

    const [start, end] = selectedSlot.split("--");
    const dto: CreateBookingDto = {
      configId,
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
        <BookingHeader
          config={config}
          logoUrl={logoUrl}
          defaultLogoUrl={defaultLogoUrl}
          bgColor={bgColor}
          textColor={textColor}
          step={step}
          booked
          t={t}
        />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md space-y-6 app-fade-up">
            <div
              className="inline-flex h-16 w-16 items-center justify-center rounded-full mx-auto"
              style={{
                backgroundColor: `${bgColor}15`,
                border: `1.5px solid ${bgColor}30`,
              }}
            >
              <Check className="h-7 w-7" style={{ color: bgColor }} />
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
                setStep(1);
                setSelectedDate(undefined);
                setSelectedSlot(null);
                setFormFields({});
              }}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-6 text-sm font-medium text-foreground hover:bg-stone-50 transition-colors shadow-sm"
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
    <div className="min-h-screen flex flex-col bg-stone-50">
      <BookingHeader
        config={config}
        logoUrl={logoUrl}
        defaultLogoUrl={defaultLogoUrl}
        bgColor={bgColor}
        textColor={textColor}
        step={step}
        booked={false}
        t={t}
      />

      <main className="flex-1 py-6 sm:py-10 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
          {/* Step content */}
          <div className="app-fade-up">
            {step === 1 && (
              <Step1DateAndTime
                t={t}
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
                selectedSlot={selectedSlot}
                onSlotSelect={setSelectedSlot}
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
              />
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="inline-flex items-center gap-1.5 h-10 rounded-lg border border-border bg-white px-4 text-sm font-medium text-foreground hover:bg-stone-50 transition-colors shadow-sm disabled:opacity-40 disabled:pointer-events-none"
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
                className="inline-flex items-center gap-1.5 h-10 rounded-lg px-5 text-sm font-medium transition-all shadow-sm disabled:opacity-40 disabled:pointer-events-none hover:opacity-90"
                style={{ backgroundColor: bgColor, color: textColor }}
              >
                {t("common.next")}
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ── Booking Header ──────────────────────────────────────────── */

function BookingHeader({
  config,
  logoUrl,
  defaultLogoUrl,
  bgColor,
  textColor,
  step,
  booked,
  t,
}: {
  config: PublicConfig;
  logoUrl: string | null | undefined;
  defaultLogoUrl: string;
  bgColor: string;
  textColor: string;
  step: number;
  booked: boolean;
  t: (key: string) => string;
}) {
  return (
    <header
      className="shrink-0 px-6 py-4 flex items-center justify-between"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3">
        <img
          src={logoUrl || defaultLogoUrl}
          alt="Logo"
          className="h-9 object-contain"
        />
        <div>
          <p
            className="font-semibold text-base leading-tight"
            style={{ color: textColor }}
          >
            {config.company_name || t("booking.fallbackCompany")}
          </p>
          {config.company_headline && (
            <p
              className="text-xs leading-tight"
              style={{ color: `${textColor}99` }}
            >
              {config.company_headline}
            </p>
          )}
        </div>
      </div>

      {/* Step indicators */}
      {!booked && (
        <div className="flex items-center gap-1">
          {STEPS.map((s, idx) => {
            const done = step > s.n;
            const active = step === s.n;
            return (
              <div key={s.n} className="flex items-center gap-1">
                <div
                  className={cn(
                    "flex items-center justify-center h-7 w-7 rounded-full text-xs font-semibold transition-all",
                    done
                      ? "bg-white/20"
                      : active
                        ? "bg-white/25 ring-2 ring-white/40"
                        : "bg-white/8"
                  )}
                  style={{ color: textColor }}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : s.n}
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className="w-6 h-px"
                    style={{ backgroundColor: `${textColor}30` }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </header>
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
}: {
  t: (key: string) => string;
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
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground tracking-tight">
          {t("booking.chooseDateAndTime")}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("booking.chooseDateAndTimeDesc")}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Calendar */}
        <div className="booking-cal rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
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
              className="[&_.react-select__control]:min-h-10 [&_.react-select__control]:rounded-lg [&_.react-select__control]:border-border [&_.react-select__control]:bg-white [&_.react-select__control]:text-sm"
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
                <div className="rounded-xl border border-border bg-white px-4 py-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    {t("booking.noSlotsForDate")}
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[280px] sm:h-[380px] rounded-xl border border-border bg-white">
                  <div className="flex flex-col gap-1.5 p-2">
                    {slots.map((slot) => {
                      const isSelected = selectedSlot === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => onSlotSelect(slot)}
                          className={cn(
                            "w-full h-10 rounded-lg text-sm font-medium text-left px-4 transition-all duration-150",
                            isSelected
                              ? "shadow-sm"
                              : "border border-border text-foreground hover:bg-stone-50"
                          )}
                          style={
                            isSelected
                              ? { backgroundColor: bgColor, color: textColor }
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
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground tracking-tight">
          {t("booking.yourInformation")}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("booking.yourInformationDesc")}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Required fields */}
        <div className="rounded-2xl border border-border bg-white p-5 space-y-4 shadow-sm">
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
            <p className="text-sm text-muted-foreground">{t("booking.noRequiredFields")}</p>
          )}
        </div>

        {/* Optional fields */}
        {optional.length > 0 && (
          <div className="rounded-2xl border border-border bg-white p-5 space-y-4 shadow-sm">
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
}: {
  t: (key: string) => string;
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
}) {
  const timeStr = formatSlotInTimezone(selectedSlot, userTimezone, timeFormat);
  const dateStr = selectedDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

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

      <div className="grid md:grid-cols-2 gap-6">
        {/* Appointment summary */}
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("booking.appointmentSection")}
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${bgColor}15` }}
              >
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
            {config.company_name && (
              <div className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${bgColor}15` }}
                >
                  <User className="h-4 w-4" style={{ color: bgColor }} />
                </div>
                <p className="text-sm text-foreground">{config.company_name}</p>
              </div>
            )}
          </div>
        </div>

        {/* Customer details */}
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm space-y-4">
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
          className="inline-flex items-center gap-2 h-11 rounded-lg px-8 text-sm font-semibold transition-all shadow-md hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
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
