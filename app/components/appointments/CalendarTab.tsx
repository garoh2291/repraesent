import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment-timezone";
import {
  getAppointmentsByConfigId,
  getAvailabilitiesPublic,
  createBooking,
  deleteAppointmentEvent,
} from "~/lib/api/appointments";
import type { AppointmentConfig } from "~/lib/api/appointments";
import type { Event, View } from "react-big-calendar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "~/components/ui/hover-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Calendar as DatePickerCalendar } from "~/components/ui/calendar";
import { toast } from "sonner";
import { format, startOfDay } from "date-fns";
import { Plus, Clock, Loader2, CalendarIcon, Trash2, List, CalendarDays, CalendarRange } from "lucide-react";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { ScheduleView } from "./ScheduleView";
import type { ScheduleEvent } from "./ScheduleView";
// ScheduleEvent type used for delete handler typing

const localizer = momentLocalizer(moment);

function formatInTimezone(
  date: Date,
  timezone: string,
  timeFormat: string,
): string {
  return date.toLocaleString(undefined, {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
    hour12: timeFormat === "12h",
  });
}

/** Generic key-value pairs parsed from notes (e.g. "Key: value" lines) */
type ParsedBookingInfo = Record<string, string>;

const NEWLINE_REGEX = /\\n|\r?\n/;

function parseBookingNotes(notes: string): ParsedBookingInfo {
  if (!notes?.trim()) return {};
  const lines = notes
    .split(NEWLINE_REGEX)
    .map((s) => s.trim())
    .filter(Boolean);
  const result: ParsedBookingInfo = {};
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key && value) result[key] = value;
  }
  return result;
}

type CalendarEvent = Event & { notes?: string; eventId?: string; eventUrl?: string };

function AppointmentEventWrapper({
  event,
  children,
  timezone,
  timeFormat,
  onDelete,
}: {
  event: CalendarEvent;
  children?: React.ReactNode;
  timezone: string;
  timeFormat: string;
  onDelete?: (event: CalendarEvent) => void;
}) {
  const { t } = useTranslation();
  const title = event.title ?? t("appointments.calendar.appointment");
  const rawNotes = event.notes ?? "";
  const parsed = parseBookingNotes(rawNotes);
  const start =
    event.start instanceof Date
      ? event.start
      : new Date(event.start ?? Date.now());
  const end =
    event.end instanceof Date ? event.end : new Date(event.end ?? Date.now());

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="top" className="w-80">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">{title}</p>
            {event.eventUrl && onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(event);
                }}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title={t("appointments.calendar.deleteAppointment", "Delete appointment")}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {formatInTimezone(start, timezone, timeFormat)} –{" "}
            {formatInTimezone(end, timezone, timeFormat)}
          </p>
          {Object.keys(parsed).length > 0 ? (
            <div className="space-y-1.5 border-t pt-3 text-sm">
              {Object.entries(parsed).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <span className="text-muted-foreground shrink-0">{key}:</span>
                  {key.toLowerCase() === "email" ? (
                    <a
                      href={`mailto:${value}`}
                      className="text-primary hover:underline truncate"
                    >
                      {value}
                    </a>
                  ) : (
                    <span className="wrap-break-word">{value}</span>
                  )}
                </div>
              ))}
            </div>
          ) : rawNotes ? (
            <p className="text-sm text-muted-foreground border-t pt-3">
              {rawNotes}
            </p>
          ) : null}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

/** Show summary in the event content area (time label rendered by RBC above it) */
function AppointmentEvent({
  title,
  event,
}: {
  event: CalendarEvent;
  title?: string;
}) {
  const displayTitle = title ?? (event.title as string) ?? "";
  if (!displayTitle) return null;
  return (
    <span className="rbc-event-summary leading-tight text-[0.7rem] font-medium opacity-90 block mt-0.5 wrap-break-word whitespace-normal">
      {displayTitle}
    </span>
  );
}

// --- Add Appointment Dialog ---

function formatDateForInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Slots are returned as "startISO--endISO" strings */
function formatSlotTime(slot: string, timezone: string, timeFormat: string): string {
  const [start] = slot.split("--");
  const date = new Date(start);
  return date.toLocaleTimeString(undefined, {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: timeFormat === "12h",
  });
}

interface AddAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: AppointmentConfig;
  onSuccess: () => void;
}

function AddAppointmentDialog({
  open,
  onOpenChange,
  config,
  onSuccess,
}: AddAppointmentDialogProps) {
  const { t } = useTranslation();
  const timezone = config.timezone ?? "UTC";
  const timeFormat = config.time_format ?? "24h";
  const services = config.services ?? [];
  const hasServices = services.length > 0;

  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    hasServices ? services[0].id : "__no_service__",
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    formatDateForInput(new Date()),
  );
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const selectedService = hasServices
    ? services.find((s) => s.id === selectedServiceId)
    : null;

  const duration =
    selectedService?.duration_minutes ?? config.slot_duration_minutes ?? 30;

  // Reset slot when date or service changes
  useEffect(() => {
    setSelectedSlot(null);
  }, [selectedDate, selectedServiceId]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setCalendarOpen(false);
      setSelectedSlot(null);
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setNotes("");
    }
  }, [open]);

  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ["availabilities-public", config.id, selectedDate, duration],
    queryFn: () => getAvailabilitiesPublic(config.id, selectedDate, duration),
    enabled: open && !!selectedDate,
  });

  const createMutation = useMutation({
    mutationFn: createBooking,
    onSuccess: () => {
      toast.success(t("appointments.addDialog.successToast", "Appointment created"));
      onSuccess();
      onOpenChange(false);
    },
    onError: () => {
      toast.error(t("appointments.addDialog.errorToast", "Failed to create appointment"));
    },
  });

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedSlot) return;

    const [startISO, endISO] = selectedSlot.split("--");
    const startDate = new Date(startISO);
    const endDate = endISO
      ? new Date(endISO)
      : new Date(startDate.getTime() + duration * 60 * 1000);

    createMutation.mutate({
      configId: config.id,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      first_name: firstName || undefined,
      last_name: lastName || undefined,
      email: email || undefined,
      phone: phone || undefined,
      notes: notes || undefined,
      service_id: selectedService?.id,
      service_name: selectedService?.name,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t("appointments.addDialog.title", "Add Appointment")}
          </DialogTitle>
          {(config.provider_name || config.company_name) && (
            <p className="text-sm text-muted-foreground mt-1">
              {t("appointments.addDialog.withProvider", "With")}{" "}
              <span className="font-medium text-foreground">
                {config.provider_name || config.company_name}
              </span>
            </p>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Service selector */}
          {hasServices && (
            <div className="space-y-1.5">
              <Label>{t("appointments.addDialog.service", "Service")}</Label>
              <Select
                value={selectedServiceId}
                onValueChange={setSelectedServiceId}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span>{s.name}</span>
                      <span className="ml-2 text-muted-foreground text-xs">
                        ({s.duration_minutes} min)
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedService?.description && (
                <p className="text-xs text-muted-foreground">
                  {selectedService.description}
                </p>
              )}
            </div>
          )}

          {/* Date */}
          <div className="space-y-1.5">
            <Label>{t("appointments.addDialog.date", "Date")}</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate
                    ? format(new Date(selectedDate + "T12:00:00"), "PPP")
                    : t("appointments.addDialog.pickDate", "Pick a date")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <DatePickerCalendar
                  mode="single"
                  selected={
                    selectedDate
                      ? new Date(selectedDate + "T12:00:00")
                      : undefined
                  }
                  onSelect={(date: Date | undefined) => {
                    if (date) {
                      setSelectedDate(formatDateForInput(date));
                      setCalendarOpen(false);
                    }
                  }}
                  disabled={(date: Date) => date < startOfDay(new Date())}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time slots */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {t("appointments.addDialog.time", "Time")}
              {!hasServices && (
                <span className="text-muted-foreground font-normal text-xs">
                  ({duration} min)
                </span>
              )}
            </Label>
            {slotsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t(
                  "appointments.addDialog.loadingSlots",
                  "Loading available slots...",
                )}
              </div>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                {t(
                  "appointments.addDialog.noSlots",
                  "No available slots for this date.",
                )}
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-44 overflow-y-auto pr-1">
                {slots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    className={`text-xs font-medium rounded-lg px-2 py-2 border transition-colors ${
                      selectedSlot === slot
                        ? "bg-foreground text-background border-foreground"
                        : "bg-transparent text-foreground border-border hover:border-foreground/40 hover:bg-muted"
                    }`}
                  >
                    {formatSlotTime(slot, timezone, timeFormat)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Customer info */}
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium text-foreground">
              {t("appointments.addDialog.customerInfo", "Customer Info")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">
                  {t("appointments.addDialog.firstName", "First Name")}
                </Label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  {t("appointments.addDialog.lastName", "Last Name")}
                </Label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className="h-9"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                {t("appointments.addDialog.email", "Email")}
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                {t("appointments.addDialog.phone", "Phone")}
              </Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 234 567 8900"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                {t("appointments.addDialog.notes", "Notes")}
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t(
                  "appointments.addDialog.notesPlaceholder",
                  "Additional notes...",
                )}
                rows={2}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!selectedSlot || createMutation.isPending}
            >
              {createMutation.isPending && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              {t("appointments.addDialog.submit", "Create Appointment")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Week/day time grid in config timezone (react-big-calendar uses clock from template Date). */
const DAY_VIEW_START_HOUR = 7;
const DAY_VIEW_END_HOUR = 20;

function padHour(h: number): string {
  return String(h).padStart(2, "0");
}

function calendarMinMaxDates(tz: string): { min: Date; max: Date } {
  if (moment.tz) {
    return {
      min: moment
        .tz(`2000-01-01 ${padHour(DAY_VIEW_START_HOUR)}:00:00`, tz)
        .toDate(),
      max: moment
        .tz(`2000-01-01 ${padHour(DAY_VIEW_END_HOUR)}:00:00`, tz)
        .toDate(),
    };
  }
  return {
    min: new Date(2000, 0, 1, DAY_VIEW_START_HOUR, 0, 0),
    max: new Date(2000, 0, 1, DAY_VIEW_END_HOUR, 0, 0),
  };
}

/** RBC uses only the clock portion; anchor matches min/max. Clamped to visible range. */
function buildScrollToTimeForTimezone(
  tz: string,
  startHour: number,
  endHour: number,
): Date {
  const m = moment.tz ? moment.tz(tz) : moment();
  let h = m.hour();
  let mins = m.minute();
  if (h < startHour) {
    return new Date(2000, 0, 1, startHour, 0, 0);
  }
  if (h > endHour || (h === endHour && mins > 0)) {
    return new Date(2000, 0, 1, endHour, 0, 0);
  }
  return new Date(2000, 0, 1, h, mins, 0);
}

interface CalendarTabProps {
  config: AppointmentConfig;
}

type CalendarViewMode = "schedule" | "month" | "week" | "day";

const VIEW_MODE_ICONS: Record<CalendarViewMode, React.ReactNode> = {
  schedule: <List className="w-3.5 h-3.5" />,
  month: <CalendarDays className="w-3.5 h-3.5" />,
  week: <CalendarRange className="w-3.5 h-3.5" />,
  day: <CalendarIcon className="w-3.5 h-3.5" />,
};

export function CalendarTab({ config }: CalendarTabProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<CalendarViewMode>("schedule");
  const [rbcView, setRbcView] = useState<View>("week");
  const [date, setDate] = useState(new Date());
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const timezone = config.timezone ?? "UTC";
  const timeFormat = config.time_format ?? "24h";
  const firstWeekday = config.first_weekday ?? "monday";
  const queryClient = useQueryClient();

  // Monday (1) or Sunday (0) as start of week
  useEffect(() => {
    const dow = firstWeekday === "sunday" ? 0 : 1;
    moment.updateLocale("en", { week: { dow } });
  }, [firstWeekday]);

  // Use config timezone for calendar display so appointments show on correct days
  useEffect(() => {
    if (!moment.tz) return;
    moment.tz.setDefault(timezone);
    return () => {
      moment.tz.setDefault();
    };
  }, [timezone]);

  const formats = useMemo(
    () => ({
      timeGutterFormat: timeFormat === "12h" ? "h:mm A" : "HH:mm",
      agendaTimeFormat: timeFormat === "12h" ? "h:mm A" : "HH:mm",
      agendaTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
        `${moment(start).format(timeFormat === "12h" ? "h:mm A" : "HH:mm")} – ${moment(end).format(timeFormat === "12h" ? "h:mm A" : "HH:mm")}`,
    }),
    [timeFormat],
  );

  // Compute visible date range for the current RBC view
  const { rangeStart, rangeEnd } = useMemo(() => {
    const d = date;
    let start: Date;
    let end: Date;

    if (rbcView === "month") {
      // Month view shows partial weeks at edges — pad by 7 days
      start = new Date(d.getFullYear(), d.getMonth(), -6);
      end = new Date(d.getFullYear(), d.getMonth() + 1, 7, 23, 59, 59);
    } else if (rbcView === "week") {
      const dow = firstWeekday === "sunday" ? 0 : 1;
      const dayOfWeek = d.getDay();
      const diff = (dayOfWeek - dow + 7) % 7;
      start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
      end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59);
    } else {
      // day view
      start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
    }

    return { rangeStart: start.toISOString(), rangeEnd: end.toISOString() };
  }, [date, rbcView, firstWeekday]);

  const { data: appointments = [], isLoading, isFetching } = useQuery({
    queryKey: ["appointments-list", config.id, rangeStart, rangeEnd],
    queryFn: () => getAppointmentsByConfigId(config.id, rangeStart, rangeEnd),
    enabled: viewMode !== "schedule",
    placeholderData: (prev) => prev,
  });

  const events: CalendarEvent[] = appointments.map((apt: unknown) => {
    const a = apt as Record<string, unknown>;
    const start = a.start as string;
    const end = a.end as string;
    const summary = (a.summary ?? a.notes ?? "Appointment") as string;
    const notes = (a.notes ?? a.description ?? "") as string;
    return {
      start: new Date(start),
      end: new Date(end),
      title: summary,
      notes: notes || undefined,
      eventId: (a.id as string) || undefined,
      eventUrl: (a.url as string) || undefined,
    };
  });

  const [deleteTarget, setDeleteTarget] = useState<CalendarEvent | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (eventUrl: string) =>
      deleteAppointmentEvent(config.id, eventUrl),
    onSuccess: () => {
      toast.success(t("appointments.calendar.deleteSuccess", "Appointment deleted"));
      // Invalidate both calendar and schedule queries
      queryClient.invalidateQueries({ queryKey: ["appointments-list", config.id] });
      queryClient.invalidateQueries({ queryKey: ["schedule-appointments", config.id] });
      setDeleteTarget(null);
    },
    onError: () => {
      toast.error(t("appointments.calendar.deleteError", "Failed to delete appointment"));
    },
  });

  const handleDeleteRequest = useCallback((event: CalendarEvent) => {
    setDeleteTarget(event);
  }, []);

  const handleScheduleDelete = useCallback((event: ScheduleEvent) => {
    setDeleteTarget(event as CalendarEvent);
  }, []);

  const onNavigate = useCallback((newDate: Date) => {
    setDate(newDate);
  }, []);

  const onView = useCallback((newView: View) => {
    setRbcView(newView);
  }, []);

  const handleViewModeChange = useCallback((mode: CalendarViewMode) => {
    setViewMode(mode);
    if (mode !== "schedule") {
      setRbcView(mode as View);
    }
  }, []);

  const { min: calendarMin, max: calendarMax, scrollToTime } = useMemo(() => {
    const { min, max } = calendarMinMaxDates(timezone);
    return {
      min,
      max,
      scrollToTime: buildScrollToTimeForTimezone(
        timezone,
        DAY_VIEW_START_HOUR,
        DAY_VIEW_END_HOUR,
      ),
    };
  }, [timezone, rbcView]);

  const getNow = useCallback(() => {
    return moment.tz ? moment.tz(timezone).toDate() : new Date();
  }, [timezone]);

  function handleAppointmentAdded() {
    queryClient.invalidateQueries({ queryKey: ["appointments-list", config.id] });
    queryClient.invalidateQueries({ queryKey: ["schedule-appointments", config.id] });
  }

  const viewModes: CalendarViewMode[] = ["schedule", "month", "week", "day"];

  return (
    <div className="space-y-3">
      {/* Top bar: view switcher + add button */}
      <div className="flex items-center justify-between gap-2">
        {/* View mode switcher */}
        <div className="inline-flex items-center rounded-lg border border-border bg-card p-0.5 gap-0.5">
          {viewModes.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => handleViewModeChange(mode)}
              className={`
                inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium
                transition-colors duration-100
                ${
                  viewMode === mode
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }
              `}
            >
              {VIEW_MODE_ICONS[mode]}
              <span className="hidden sm:inline">
                {t(`appointments.viewMode.${mode}`, mode.charAt(0).toUpperCase() + mode.slice(1))}
              </span>
            </button>
          ))}
        </div>

        <Button
          size="sm"
          onClick={() => setAddDialogOpen(true)}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">
            {t("appointments.addAppointment", "Add Appointment")}
          </span>
          <span className="sm:hidden">
            {t("appointments.addShort", "Add")}
          </span>
        </Button>
      </div>

      {/* Schedule View */}
      {viewMode === "schedule" && (
        <ScheduleView
          configId={config.id}
          timezone={timezone}
          timeFormat={timeFormat}
          onDelete={handleScheduleDelete}
        />
      )}

      {/* Calendar Views (month / week / day) */}
      {viewMode !== "schedule" && (
        <div className="relative">
          {/* Subtle loading bar at top during fetch */}
          {isFetching && (
            <div className="absolute top-0 left-0 right-0 z-20 h-0.5 overflow-hidden rounded-t-2xl">
              <div className="h-full w-full bg-primary/40 animate-pulse" />
            </div>
          )}
          <div className={`appointments-calendar h-[560px] sm:h-[700px] rounded-2xl border border-border overflow-hidden transition-opacity duration-150 ${isFetching ? "opacity-70" : "opacity-100"}`}>
            <Calendar
              localizer={localizer}
              formats={formats}
              events={events}
              startAccessor="start"
              endAccessor="end"
              titleAccessor="title"
              views={["month", "week", "day"]}
              view={rbcView}
              date={date}
              onView={onView}
              onNavigate={onNavigate}
              min={calendarMin}
              max={calendarMax}
              scrollToTime={scrollToTime}
              getNow={getNow}
              popup
              toolbar={true}
              components={{
                event: AppointmentEvent,
                eventWrapper: (props) => (
                  <AppointmentEventWrapper
                    {...props}
                    timezone={timezone}
                    timeFormat={timeFormat}
                    onDelete={handleDeleteRequest}
                  />
                ),
              }}
            />
          </div>
        </div>
      )}

      <AddAppointmentDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        config={config}
        onSuccess={handleAppointmentAdded}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("appointments.calendar.deleteTitle", "Delete appointment")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "appointments.calendar.deleteDescription",
                "This appointment will be permanently deleted from your calendar. This action cannot be undone.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget?.eventUrl) {
                  deleteMutation.mutate(deleteTarget.eventUrl);
                }
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              {t("appointments.calendar.deleteConfirm", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
