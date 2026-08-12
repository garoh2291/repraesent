import { useCallback, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import moment from "moment-timezone";
import { toast } from "sonner";
import {
  ExternalLink,
  Globe,
  SlidersHorizontal,
  TriangleAlert,
  X,
} from "lucide-react";
import TimezoneSelect from "react-timezone-select";
import type { View } from "react-big-calendar";
import { useAuthContext } from "~/providers/auth-provider";
import { useCalendarSummary } from "~/lib/hooks/useCalendarSummary";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import {
  listCalendarAccounts,
  getCalendarEvents,
  getCalendarPreferences,
  updateCalendarPreferences,
  type CalendarPreferences,
  type UnifiedCalendarEvent,
} from "~/lib/api/calendar";
import { CalendarSourcesPanel } from "~/components/calendar/CalendarSourcesPanel";
import { CalendarView } from "~/components/calendar/CalendarView";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { formatDateIntl } from "~/lib/utils/format";
import i18n from "~/i18n";

export function meta() {
  return [
    { title: i18n.t("calendar.metaTitle") + " - Repraesent" },
    { name: "description", content: i18n.t("calendar.metaDescription") },
  ];
}

const TIMEZONE_STORAGE_KEY = "calendar_display_tz";

/**
 * The viewer's display timezone: their last choice, else the browser zone.
 * Events are absolute instants — this only decides which wall clock the grid
 * is drawn against, so an Australian teammate sees a GMT+4 booking at the
 * hour it actually happens for THEM.
 */
function initialTimezone(): string {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(TIMEZONE_STORAGE_KEY);
    if (stored && moment.tz.zone(stored)) return stored;
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/**
 * Visible date range for the current view, padded like CalendarTab does.
 * Computed in the DISPLAY timezone so the fetched window matches the week or
 * day boundaries the viewer is actually looking at.
 */
function computeRange(
  date: Date,
  view: View,
  timezone: string,
): { start: string; end: string } {
  const m = moment.tz(date, timezone);
  let start: moment.Moment;
  let end: moment.Moment;

  if (view === "month") {
    // Month view shows partial weeks at the edges — pad by a week each side
    start = m.clone().startOf("month").subtract(7, "days").startOf("day");
    end = m.clone().endOf("month").add(7, "days").endOf("day");
  } else if (view === "week") {
    start = m.clone().startOf("week");
    end = m.clone().endOf("week");
  } else if (view === "agenda") {
    // RBC's agenda view lists 30 days starting at the current date
    start = m.clone().startOf("day");
    end = m.clone().add(30, "days").endOf("day");
  } else {
    start = m.clone().startOf("day");
    end = m.clone().endOf("day");
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

export default function CalendarPage() {
  useDocumentMeta({
    titleKey: "calendar.metaTitle",
    descriptionKey: "calendar.metaDescription",
    titleSuffix: " - Repraesent",
  });
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const queryClient = useQueryClient();

  const { data: summary, isLoading: summaryLoading } = useCalendarSummary(
    !!currentWorkspace?.id,
  );
  const totalSources =
    (summary?.google_account_count ?? 0) + (summary?.baikal_config_count ?? 0);

  const { data: accountsData } = useQuery({
    queryKey: ["calendar-accounts"],
    queryFn: listCalendarAccounts,
    enabled: !!currentWorkspace?.id,
  });

  const { data: prefs } = useQuery({
    queryKey: ["calendar-prefs"],
    queryFn: getCalendarPreferences,
    enabled: !!currentWorkspace?.id,
  });

  const accounts = accountsData?.accounts ?? [];
  const baikalConfigs = accountsData?.baikal_configs ?? [];

  const hiddenKeys = useMemo(
    () => new Set(prefs?.hidden_calendar_keys ?? []),
    [prefs],
  );

  const allKeys = useMemo(() => {
    const keys: string[] = [];
    for (const account of accounts) {
      for (const cal of account.calendars) {
        keys.push(`google:${account.id}:${cal.id}`);
      }
    }
    for (const config of baikalConfigs) {
      keys.push(`baikal:${config.id}`);
    }
    return keys;
  }, [accounts, baikalConfigs]);

  const visibleKeys = useMemo(
    () => allKeys.filter((key) => !hiddenKeys.has(key)),
    [allKeys, hiddenKeys],
  );

  // Colors and names keyed the same way events reference their source
  const { colorByKey, nameByKey } = useMemo(() => {
    const colors: Record<string, string> = {};
    const names: Record<string, string> = {};
    for (const account of accounts) {
      for (const cal of account.calendars) {
        const key = `google:${account.id}:${cal.id}`;
        if (cal.backgroundColor) colors[key] = cal.backgroundColor;
        names[key] = account.is_own
          ? cal.summary
          : `${account.user_name} · ${cal.summary}`;
      }
    }
    for (const config of baikalConfigs) {
      const key = `baikal:${config.id}`;
      colors[key] = config.company_color;
      names[key] = config.provider_name ?? config.user_name;
    }
    return { colorByKey: colors, nameByKey: names };
  }, [accounts, baikalConfigs]);

  const [date, setDate] = useState(() => new Date());
  const [view, setView] = useState<View>("week");
  const [timezone, setTimezone] = useState<string>(initialTimezone);

  const handleTimezoneChange = useCallback((tz: string) => {
    setTimezone(tz);
    try {
      window.localStorage.setItem(TIMEZONE_STORAGE_KEY, tz);
    } catch {
      // Storage full or blocked — the choice still applies for this visit.
    }
  }, []);

  const { start: startISO, end: endISO } = useMemo(
    () => computeRange(date, view, timezone),
    [date, view, timezone],
  );

  const joinedVisibleKeys = useMemo(
    () => [...visibleKeys].sort().join(","),
    [visibleKeys],
  );

  const { data: eventsData, isFetching: eventsFetching } = useQuery({
    queryKey: ["calendar-events", startISO, endISO, joinedVisibleKeys],
    queryFn: () => getCalendarEvents(startISO, endISO, visibleKeys),
    enabled: !!currentWorkspace?.id && !!accountsData && !!prefs,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const events = eventsData?.events ?? [];
  const sourceErrors = eventsData?.errors ?? [];
  const errorKeys = useMemo(
    () => new Set(sourceErrors.map((e) => e.calendarKey)),
    [sourceErrors],
  );

  // The banner stays dismissed until a different set of sources fails
  const errorSignature = [...errorKeys].sort().join(",");
  const [dismissedSignature, setDismissedSignature] = useState<string | null>(
    null,
  );
  const showErrorBanner =
    sourceErrors.length > 0 && dismissedSignature !== errorSignature;

  // Optimistic toggle: flip the cache now, persist after a 500ms lull
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleToggle = useCallback(
    (key: string) => {
      const previous = queryClient.getQueryData<CalendarPreferences>([
        "calendar-prefs",
      ]);
      const nextHidden = new Set(previous?.hidden_calendar_keys ?? []);
      if (nextHidden.has(key)) {
        nextHidden.delete(key);
      } else {
        nextHidden.add(key);
      }
      const nextKeys = [...nextHidden];
      queryClient.setQueryData<CalendarPreferences>(["calendar-prefs"], {
        hidden_calendar_keys: nextKeys,
      });

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateCalendarPreferences(nextKeys).catch(() => {
          toast.error(t("common.failedToSave"));
          // Roll back to whatever the server actually has
          queryClient.invalidateQueries({ queryKey: ["calendar-prefs"] });
        });
      }, 500);
    },
    [queryClient, t],
  );

  const [selectedEvent, setSelectedEvent] =
    useState<UnifiedCalendarEvent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // No sources connected: this page has nothing to show
  if (!summaryLoading && summary && totalSources === 0) {
    return <Navigate to="/" replace />;
  }

  if (summaryLoading || !summary) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-1.5">
          <div className="h-7 w-44 bg-muted rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-muted/60 rounded animate-pulse" />
        </div>
        <div className="h-px bg-border" />
        <div className="h-[520px] bg-muted rounded-2xl animate-pulse" />
      </div>
    );
  }

  const panel = (
    <CalendarSourcesPanel
      accounts={accounts}
      baikalConfigs={baikalConfigs}
      hiddenKeys={hiddenKeys}
      errorKeys={errorKeys}
      onToggle={handleToggle}
    />
  );

  return (
    <div className="w-full p-4 sm:p-6 py-10! space-y-4 sm:space-y-6 app-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 app-fade-up">
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
          {t("calendar.title")}
        </h1>

        <div className="flex items-center gap-2">
          {/* Display timezone: which wall clock the grid is drawn against */}
          <div className="flex items-center gap-1.5">
            <Globe className="hidden sm:block w-3.5 h-3.5 text-muted-foreground" />
            <div className="w-56 sm:w-72">
              <TimezoneSelect
                value={timezone}
                onChange={(tz) =>
                  handleTimezoneChange(typeof tz === "string" ? tz : tz.value)
                }
                aria-label={t("calendar.timezone")}
                className="text-sm [&_.react-select__control]:min-h-9 [&_.react-select__control]:rounded-lg [&_.react-select__control]:border-border [&_.react-select__control]:text-sm"
              />
            </div>
          </div>

          {/* Mobile: sources panel lives in a sheet */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 lg:hidden">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {t("calendar.calendars")}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{t("calendar.calendars")}</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-6">{panel}</div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Failed sources banner */}
      {showErrorBanner && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 app-fade-up">
          <TriangleAlert className="h-4 w-4 shrink-0 text-amber-500" />
          <span className="flex-1">
            {t("calendar.sourceErrorBanner", { count: sourceErrors.length })}
          </span>
          <button
            type="button"
            onClick={() => setDismissedSignature(errorSignature)}
            className="shrink-0 rounded-md p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-100 transition-colors"
            aria-label={t("common.close")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex gap-6 app-fade-up app-fade-up-d1">
        {/* Desktop: fixed left panel */}
        <div className="hidden lg:block w-64 shrink-0">{panel}</div>

        {/* Calendar */}
        <div className="min-w-0 flex-1 relative">
          {eventsFetching && (
            <div className="absolute top-0 left-0 right-0 z-20 h-0.5 overflow-hidden rounded-t-2xl">
              <div className="h-full w-full bg-primary/40 animate-pulse" />
            </div>
          )}
          <div
            className={`appointments-calendar team-calendar h-[560px] sm:h-[700px] rounded-2xl border border-border overflow-hidden transition-opacity duration-150 ${eventsFetching ? "opacity-70" : "opacity-100"}`}
          >
            <CalendarView
              events={events}
              colorByKey={colorByKey}
              date={date}
              view={view}
              timezone={timezone}
              onNavigate={setDate}
              onView={setView}
              onSelectEvent={setSelectedEvent}
            />
          </div>
        </div>
      </div>

      {/* Event details */}
      <Dialog
        open={!!selectedEvent}
        onOpenChange={(open) => {
          if (!open) setSelectedEvent(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        colorByKey[selectedEvent.calendarKey] ?? "#64748b",
                    }}
                  />
                  <span className="min-w-0 break-words">
                    {selectedEvent.title}
                  </span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                {/* Same display timezone as the grid, or the dialog would
                    contradict the slot the user just clicked. */}
                <p className="text-muted-foreground">
                  {selectedEvent.allDay
                    ? `${formatDateIntl(new Date(selectedEvent.start), { dateStyle: "full", timeZone: timezone })} · ${t("calendar.allDay")}`
                    : `${formatDateIntl(new Date(selectedEvent.start), { dateStyle: "medium", timeStyle: "short", timeZone: timezone })} – ${formatDateIntl(new Date(selectedEvent.end), { timeStyle: "short", timeZone: timezone })}`}
                </p>
                {nameByKey[selectedEvent.calendarKey] && (
                  <p className="text-muted-foreground">
                    {nameByKey[selectedEvent.calendarKey]}
                  </p>
                )}
                {selectedEvent.meetLink && (
                  <Button asChild size="sm" className="gap-2">
                    <a
                      href={selectedEvent.meetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {t("calendar.joinMeet")}
                    </a>
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
