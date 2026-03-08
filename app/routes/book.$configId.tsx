import { useState, useMemo } from "react";
import { useParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Calendar } from "~/components/ui/calendar";
import TimezoneSelect from "react-timezone-select";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function meta() {
  return [
    { title: "Book an Appointment" },
    { name: "description", content: "Schedule your appointment" },
  ];
}

const BOOKING_FIELDS: { key: string; label: string }[] = [
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone Number" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "zip_code", label: "Zip Code" },
  { key: "notes", label: "Notes" },
];

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

export default function BookAppointment() {
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
      toast.error("Failed to book", {
        description: extractErrorMessage(error),
      });
    },
  });

  const disabledBefore = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
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
  const displayedFields = BOOKING_FIELDS.filter(
    (f) => bookingFields[f.key]?.display !== false
  );

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
          ? [formFields.first_name, formFields.last_name].filter(Boolean).join(" ")
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
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center text-muted-foreground">
          Invalid booking link.
        </div>
      </div>
    );
  }

  if (configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="animate-pulse space-y-4 w-full max-w-md">
          <div className="h-8 w-48 bg-muted rounded mx-auto" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center text-muted-foreground">
          Appointment config not found.
        </div>
      </div>
    );
  }

  if (booked) {
    return (
      <div className="min-h-screen flex flex-col">
        <header
          className="px-6 py-4 flex items-center justify-between"
          style={{ backgroundColor: bgColor, color: textColor }}
        >
          <div className="flex items-center gap-4">
            <img
              src={logoUrl || defaultLogoUrl}
              alt="Logo"
              className="h-10 object-contain"
            />
            <div>
              <h1 className="font-semibold text-lg">
                {config.company_name || "Booking"}
              </h1>
              {config.company_headline && (
                <p className="text-sm opacity-90">{config.company_headline}</p>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-8 bg-background">
          <div className="text-center max-w-md space-y-4">
            <h2 className="text-2xl font-bold">Appointment Confirmed</h2>
            <p className="text-muted-foreground">
              Your appointment has been successfully booked. You will receive a
              confirmation email shortly.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="px-6 py-4 flex items-center justify-between shrink-0"
        style={{ backgroundColor: bgColor, color: textColor }}
      >
        <div className="flex items-center gap-4">
          <img
            src={logoUrl || defaultLogoUrl}
            alt="Logo"
            className="h-10 object-contain"
          />
          <div>
            <h1 className="font-semibold text-lg">
              {config.company_name || "Booking"}
            </h1>
            {config.company_headline && (
              <p className="text-sm opacity-90">{config.company_headline}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s
                  ? "bg-white/20"
                  : "border border-white/40 text-white/80"
              }`}
            >
              {s}
            </div>
          ))}
        </div>
      </header>

      <main className="flex-1 p-8 bg-background">
        <div className="max-w-4xl mx-auto">
          {step === 1 && (
            <Step1DateAndTime
              config={config}
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
            />
          )}
          {step === 2 && (
            <Step2CustomerInfo
              fields={displayedFields}
              bookingFields={bookingFields}
              formFields={formFields}
              onFieldChange={setField}
            />
          )}
          {step === 3 && selectedSlot && (
            <Step3Confirmation
              config={config}
              selectedDate={selectedDate!}
              selectedSlot={selectedSlot}
              userTimezone={userTimezone}
              timeFormat={timeFormat}
              formFields={formFields}
              displayedFields={displayedFields}
              onConfirm={handleConfirm}
              isPending={bookMutation.isPending}
            />
          )}

          <div className="flex justify-between mt-8">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            {step < 3 ? (
              <Button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={
                  (step === 1 && !canProceedStep1) ||
                  (step === 2 && !canProceedStep2)
                }
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

function Step1DateAndTime({
  config,
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
}: {
  config: PublicConfig;
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
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-medium text-muted-foreground uppercase tracking-wide">
        Appointment Date & Time
      </h2>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={onDateSelect}
            disabled={{
              before: disabledBefore,
              ...(disabledDayOfWeek.length > 0 && {
                dayOfWeek: disabledDayOfWeek,
              }),
            }}
            defaultMonth={selectedDate ?? new Date()}
            weekStartsOn={firstWeekday as 0 | 1}
            className="rounded-md border"
            classNames={{
              nav: "[&_button]:rounded",
              month_caption: "justify-center",
              caption_label: "text-sm font-medium",
            }}
          />
        </div>

        <div className="space-y-4 w-full min-w-0">
          <div className="space-y-2 w-full">
            <Label>Timezone</Label>
            <div className="w-full">
              <TimezoneSelect
                value={userTimezone}
                onChange={(tz) =>
                  onTimezoneChange(typeof tz === "string" ? tz : tz.value)
                }
                className="[&_.react-select__control]:min-h-10 [&_.react-select__control]:rounded-md [&_.react-select__control]:border-input"
              />
            </div>
          </div>

          {selectedDate && (
            <div className="space-y-2 w-full">
              <Label>Available times</Label>
              {slotsLoading ? (
                <div className="flex flex-col gap-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="h-10 bg-muted rounded animate-pulse"
                    />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No slots available for this date.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {slots.map((slot) => (
                    <Button
                      key={slot}
                      type="button"
                      variant={selectedSlot === slot ? "default" : "outline"}
                      className="justify-start"
                      onClick={() => onSlotSelect(slot)}
                      style={
                        selectedSlot === slot
                          ? { backgroundColor: bgColor, color: "#fff" }
                          : undefined
                      }
                    >
                      {formatSlotInTimezone(slot, userTimezone, timeFormat)}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Step2CustomerInfo({
  fields,
  bookingFields,
  formFields,
  onFieldChange,
}: {
  fields: { key: string; label: string }[];
  bookingFields: Record<string, BookingFieldConfig>;
  formFields: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
}) {
  const required = fields.filter((f) => bookingFields[f.key]?.require);
  const optional = fields.filter((f) => !bookingFields[f.key]?.require);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-medium text-muted-foreground uppercase tracking-wide">
        Customer Information
      </h2>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-4">
          {required.map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>
                {label} *
              </Label>
              {key === "notes" ? (
                <Textarea
                  id={key}
                  value={formFields[key] ?? ""}
                  onChange={(e) => onFieldChange(key, e.target.value)}
                  rows={3}
                />
              ) : (
                <Input
                  id={key}
                  type={key === "email" ? "email" : "text"}
                  value={formFields[key] ?? ""}
                  onChange={(e) => onFieldChange(key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {optional.map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>{label}</Label>
              {key === "notes" ? (
                <Textarea
                  id={key}
                  value={formFields[key] ?? ""}
                  onChange={(e) => onFieldChange(key, e.target.value)}
                  rows={3}
                />
              ) : (
                <Input
                  id={key}
                  type={key === "email" ? "email" : "text"}
                  value={formFields[key] ?? ""}
                  onChange={(e) => onFieldChange(key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Step3Confirmation({
  config,
  selectedDate,
  selectedSlot,
  userTimezone,
  timeFormat,
  formFields,
  displayedFields,
  onConfirm,
  isPending,
}: {
  config: PublicConfig;
  selectedDate: Date;
  selectedSlot: string;
  userTimezone: string;
  timeFormat: string;
  formFields: Record<string, string>;
  displayedFields: { key: string; label: string }[];
  onConfirm: () => void;
  isPending: boolean;
}) {
  const [start] = selectedSlot.split("--");
  const timeStr = formatSlotInTimezone(
    selectedSlot,
    userTimezone,
    timeFormat
  );
  const dateStr = selectedDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-medium text-muted-foreground uppercase tracking-wide">
        Appointment Confirmation
      </h2>

      <div className="rounded-lg border p-6 space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Date & Time</p>
          <p className="font-medium">
            {dateStr} at {timeStr}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Customer Details</p>
          <div className="mt-2 space-y-1">
            {displayedFields
              .filter((f) => formFields[f.key])
              .map(({ key, label }) => (
                <p key={key}>
                  <span className="text-muted-foreground">{label}:</span>{" "}
                  {formFields[key]}
                </p>
              ))}
          </div>
        </div>
      </div>

      <Button
        onClick={onConfirm}
        disabled={isPending}
        style={{
          backgroundColor: config.company_color ?? "#1a1a1a",
          color: config.company_text_color ?? "#ffffff",
        }}
      >
        {isPending ? "Confirming..." : "Confirm"}
      </Button>
    </div>
  );
}
