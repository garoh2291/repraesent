import { useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { CalendarClock, Plus, Settings2, X } from "lucide-react";
import i18n from "~/i18n";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { useSearchShortcut } from "~/lib/hooks/useSearchShortcut";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { useAppointmentCalendars, useAppointments } from "~/lib/hooks/useAppointmentBook";
import type { Appointment, ListAppointmentsParams } from "~/lib/api/appointment-book";
import { PageContainer, PageHeader } from "~/components/notebook/page-header";
import { Panel, PanelHeader } from "~/components/notebook/panel";
import { EmptyState } from "~/components/notebook/empty-state";
import { LoadError } from "~/components/notebook/load-error";
import { Segmented } from "~/components/notebook/segmented";
import { useQuickCreate } from "~/components/notebook/quick-create";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { AppointmentRow, CalendarDot } from "~/components/appointment-book/appointment-bits";
import { bucketOf, dayOf, longDate, type DayBucket } from "~/components/appointment-book/format";
import { useAppointmentBookGate } from "~/components/appointment-book/use-appointment-book-gate";

export function meta() {
  return [
    { title: `${i18n.t("appointmentBook.metaTitle", "Appointments")} - Repraesent` },
    { name: "description", content: i18n.t("appointmentBook.metaDescription", "Who is coming, and when.") },
  ];
}

type View = "upcoming" | "past" | "cancelled";

/**
 * The appointment book: who is coming, day by day, with the time in the
 * margin — and on top, the visits that happened and still need an answer to
 * "did they come?".
 */
export default function AppointmentsPage() {
  const allowed = useAppointmentBookGate("booking-page");
  const { t, i18n: i } = useTranslation();
  useDocumentMeta({ titleKey: "appointmentBook.metaTitle", descriptionKey: "appointmentBook.metaDescription", titleSuffix: " - Repraesent" });
  const quick = useQuickCreate();
  const [params, setParams] = useSearchParams();
  const view = (params.get("view") as View) || "upcoming";
  const calendarId = params.get("calendar") ?? "";
  const search = params.get("search") ?? "";
  const q = useDebounce(search, 300);
  const { ref: searchRef, withHint } = useSearchShortcut();

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  const calendars = useAppointmentCalendars(allowed);
  const listParams: ListAppointmentsParams = {
    status: view === "cancelled" ? "cancelled" : view,
    calendar_id: calendarId || undefined,
    search: q || undefined,
    limit: 300,
  };
  const list = useAppointments(listParams, allowed);
  const waiting = useAppointments({ needs_outcome: true, calendar_id: calendarId || undefined, limit: 50 }, allowed && view === "upcoming");

  const groups = useMemo(() => groupBook(list.data ?? [], view), [list.data, view]);
  if (!allowed) return null;

  const bucketLabel: Record<DayBucket, string> = {
    today: t("appointmentBook.book.today", "Today"),
    tomorrow: t("appointmentBook.book.tomorrow", "Tomorrow"),
    week: t("appointmentBook.book.thisWeek", "This week"),
    later: t("appointmentBook.book.later", "Later"),
  };
  const hasFilters = !!(calendarId || search);
  const waitingList = waiting.data ?? [];

  return (
    <PageContainer className="app-fade-in space-y-5">
      <PageHeader
        title={t("appointmentBook.title", "Appointments")}
        subtitle={t("appointmentBook.subtitle", "Who is coming, and when.")}
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 max-sm:h-11 max-sm:flex-1">
              <Link to="/appointments/calendars">
                <Settings2 className="size-3.5" aria-hidden />
                {t("appointmentBook.calendarsButton", "Calendars")}
              </Link>
            </Button>
            <Button size="sm" className="h-9 gap-1.5 max-sm:h-11 max-sm:flex-1" onClick={() => quick.open("appointment")}>
              <Plus className="size-3.5" aria-hidden />
              {t("appointmentBook.new", "New appointment")}
            </Button>
          </>
        }
      />

      {view === "upcoming" && waitingList.length > 0 ? (
        <Panel className="app-fade-up">
          <PanelHeader
            title={t("appointmentBook.didTheyCome", "Did they come?")}
            count={waitingList.length}
            marker
            hint={t("appointmentBook.didTheyComeHint", "Visits that already happened. One tap each.")}
          />
          <div className="divide-y divide-border px-2 py-1 sm:px-3">
            {waitingList.map((a) => (
              <AppointmentRow key={a.id} appointment={a} showDate className="py-1" />
            ))}
          </div>
        </Panel>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <Segmented
          role="tablist"
          label={t("appointmentBook.viewLabel", "Which appointments")}
          value={view}
          onChange={(v) => set({ view: v === "upcoming" ? "" : v })}
          stretch
          options={[
            { value: "upcoming", label: t("appointmentBook.views.upcoming", "Coming up") },
            { value: "past", label: t("appointmentBook.views.past", "Past") },
            { value: "cancelled", label: t("appointmentBook.views.cancelled", "Cancelled") },
          ]}
        />
        <Input
          ref={searchRef}
          value={search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder={withHint(t("appointmentBook.searchPlaceholder", "Search by name, email or phone…"))}
          className="h-9 w-full text-base max-sm:h-11 sm:w-[260px] sm:text-sm"
        />
        {(calendars.data?.length ?? 0) > 1 ? (
          <Select value={calendarId || "all"} onValueChange={(v) => set({ calendar: v === "all" ? "" : v })}>
            <SelectTrigger className="h-9 w-full text-sm max-sm:h-11 sm:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("appointmentBook.allCalendars", "All calendars")}</SelectItem>
              {(calendars.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="inline-flex items-center gap-2">
                    <CalendarDot color={c.color} />
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {hasFilters ? (
          <button
            type="button"
            onClick={() => set({ calendar: "", search: "" })}
            className="inline-flex items-center gap-1 self-start rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground max-sm:min-h-11"
          >
            {t("appointmentBook.clearFilters", "Clear filters")} <X className="size-3" />
          </button>
        ) : null}
      </div>

      {list.isError && !list.data ? (
        <LoadError what={t("appointmentBook.what", "your appointments")} onRetry={() => void list.refetch()} />
      ) : list.isLoading ? (
        <Panel className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, n) => (
            <div key={n} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </Panel>
      ) : groups.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<CalendarClock />}
            title={
              hasFilters
                ? t("appointmentBook.empty.filtered", "Nothing matches these filters.")
                : view === "upcoming"
                  ? t("appointmentBook.empty.upcoming", "No appointments coming up.")
                  : view === "past"
                    ? t("appointmentBook.empty.past", "No past appointments yet.")
                    : t("appointmentBook.empty.cancelled", "Nothing was cancelled.")
            }
            body={
              view === "upcoming" && !hasFilters
                ? t(
                    "appointmentBook.empty.upcomingBody",
                    "Book one yourself, or let people book on your website: add an appointment field to a form and pick one of your calendars.",
                  )
                : undefined
            }
            action={
              view === "upcoming" && !hasFilters ? (
                <Button size="sm" className="h-9 gap-1.5 max-sm:h-11" onClick={() => quick.open("appointment")}>
                  <Plus className="size-3.5" aria-hidden />
                  {t("appointmentBook.new", "New appointment")}
                </Button>
              ) : undefined
            }
          />
        </Panel>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`day-${g.key}`} className="app-fade-up">
              <h2 id={`day-${g.key}`} className="mb-1.5 flex items-baseline gap-2 px-1">
                {g.bucket ? (
                  <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-foreground">{bucketLabel[g.bucket]}</span>
                ) : null}
                <span className="text-[13px] text-muted-foreground">{longDate(g.items[0].starts_at, g.items[0].timezone, i.language)}</span>
              </h2>
              <Panel className="divide-y divide-border px-2 py-1 sm:px-3">
                {g.items.map((a) => (
                  <AppointmentRow key={a.id} appointment={a} showOutcome={view !== "cancelled"} className="py-1" />
                ))}
              </Panel>
            </section>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

/** Day pages of the book. Upcoming reads forwards; past and cancelled backwards. */
function groupBook(items: Appointment[], view: View) {
  const out: Array<{ key: string; bucket: DayBucket | null; items: Appointment[] }> = [];
  const seenBuckets = new Set<DayBucket>();
  for (const a of items) {
    const key = dayOf(a.starts_at, a.timezone);
    let group = out.find((g) => g.key === key);
    if (!group) {
      let bucket: DayBucket | null = null;
      if (view === "upcoming") {
        const b = bucketOf(a.starts_at, a.timezone);
        // A bucket label heads only its first day: "This week" once, not daily.
        if (!seenBuckets.has(b)) {
          seenBuckets.add(b);
          bucket = b;
        }
      }
      group = { key, bucket, items: [] };
      out.push(group);
    }
    group.items.push(a);
  }
  return out;
}
