/**
 * The appointment field: what to book (when the field offers services), then
 * when — as a day strip, a month calendar or a list of the soonest times.
 *
 * The same DOM shape and the same `.rf-appt*` classes the backend runtime
 * builds (`wireAppointment` in nestjs-monolith forms/form-render.service.ts),
 * styled by the same generated CSS — so the builder preview, the hosted page
 * and the pasted snippet all look identical. This file is a twin BY
 * CONVENTION, not pinned by a spec: change one, change the other.
 *
 * Preview mode renders placeholders: a draft has no published availability to
 * ask for. Live mode asks the public endpoints, always by field id and service
 * id — a visitor's copy of the form carries no calendar.
 *
 * NO i18next in this file. Everything a visitor reads is form content.
 */

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getAppointmentAvailability,
  getAppointmentDays,
  getAppointmentNext,
} from "~/lib/api/forms";
import { visibleHosts } from "~/lib/forms/appointment-hosts";
import {
  contentKey,
  fillTemplate,
  type AppointmentHost,
  type AppointmentService,
  type FormField,
} from "~/lib/forms/schema";

/**
 * Which service each appointment field is for, owned by whoever submits the
 * form (the hosted page). Without a provider — the builder canvas — the control
 * keeps its own pick, which nobody ever submits.
 */
export interface AppointmentPicks {
  picks: Record<string, string>;
  setPick: (fieldKey: string, serviceId: string | null) => void;
}
export const AppointmentPicksContext = createContext<AppointmentPicks | null>(
  null,
);

/** Query-key root of everything this control fetches, for invalidation. */
export const APPOINTMENT_QUERY_ROOT = "form-appt";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const APPT_PER_PAGE = 7;
/** How many times of one day the list view shows before "More times". */
const NEXT_SHOWN = 8;

interface Rules {
  weekdays: string[];
  windowStart: string;
  durationMinutes: number;
  timezone: string;
  maxDaysAhead: number;
  wholeDay: boolean;
  hosts: AppointmentHost[] | undefined;
}

/** The picker rules in force: the chosen service's, else the field's. */
function rulesOf(field: FormField, service: AppointmentService | null): Rules {
  const ap = field.appointment;
  const r = service?.rules;
  return {
    weekdays: r?.weekdays ?? ap?.weekdays ?? ["mon", "tue", "wed", "thu", "fri"],
    windowStart: r?.window.start ?? ap?.window?.start ?? "09:00",
    durationMinutes: r?.durationMinutes ?? ap?.durationMinutes ?? 30,
    timezone: r?.timezone ?? ap?.timezone ?? "UTC",
    maxDaysAhead: r?.maxDaysAhead ?? ap?.maxDaysAhead ?? 30,
    wholeDay: r?.wholeDay === true,
    hosts: service ? service.hosts : ap?.hosts,
  };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** YYYY-MM-DD by hand — toISOString would shift the day near midnight. */
function dayString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

/** A calendar date as a UTC-noon Date: safe to format with timeZone UTC. */
function dateOf(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function addDays(str: string, n: number): string {
  const d = dateOf(str);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** YYYY-MM-DD of an instant in a zone, or "" where Intl cannot say. */
function dateIn(date: Date, timeZone: string): string {
  try {
    const out = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : "";
  } catch {
    return "";
  }
}

function fmtDate(
  locale: string | undefined,
  str: string,
  opts: Intl.DateTimeFormatOptions,
): string {
  try {
    return new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" }).format(
      dateOf(str),
    );
  } catch {
    return str;
  }
}

function fmtTime(
  locale: string | undefined,
  iso: string,
  timeZone: string | undefined,
): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
}

/** "Asia/Yerevan" → "Yerevan": the city is what people recognise. */
function zoneCity(timeZone: string): string {
  const parts = timeZone.split("/");
  return parts[parts.length - 1].split("_").join(" ");
}

/** "Yerevan · GMT+4" — the city and how far it is from UTC right now. */
function zoneName(timeZone: string): string {
  const city = zoneCity(timeZone);
  try {
    const part = new Intl.DateTimeFormat("en", {
      timeZone,
      timeZoneName: "shortOffset",
    })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName");
    return part ? `${city} · ${part.value}` : city;
  } catch {
    return city;
  }
}

interface ZoneOption {
  value: string;
  label: string;
  /** A rule between the two zones that matter and the long list. */
  divider?: boolean;
}

/**
 * The calendar's zone first, then the visitor's own, then every other. Only
 * the first two carry their offset (see fillZones in the embed runtime).
 */
function zoneOptions(home: string): ZoneOption[] {
  const out: ZoneOption[] = [];
  const seen = new Set<string>();
  const add = (tz: string, label: string) => {
    if (!tz || seen.has(tz)) return;
    seen.add(tz);
    out.push({ value: tz, label });
  };
  add(home, zoneName(home));
  let mine = "";
  try {
    mine = new Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    mine = "";
  }
  add(mine, zoneName(mine));
  let all: string[] = [];
  try {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf;
    if (typeof supported === "function") all = supported("timeZone");
  } catch {
    all = [];
  }
  const head = out.length;
  for (const tz of all) add(tz, tz.split("_").join(" ").split("/").join(" / "));
  if (out.length > head) out.splice(head, 0, { value: "", label: "", divider: true });
  return out;
}

/** Fallback avatar for a host with no picture. Mirrors the embed runtime's. */
function initialsOf(name: string): string {
  const parts = String(name || "").split(/\s+/);
  let out = "";
  for (const part of parts) {
    if (out.length > 1) break;
    if (part) out += part.charAt(0).toUpperCase();
  }
  return out || "?";
}

interface ControlProps {
  field: FormField;
  inputId: string;
  value: unknown;
  disabled?: boolean;
  t: (key: string) => string;
  onChange: (value: unknown) => void;
  live: boolean;
  formId?: string;
  locale?: string;
}

export function AppointmentControl(props: ControlProps) {
  const { field, inputId, value, disabled, t, onChange, live } = props;
  const ap = field.appointment;
  const services = ap?.services ?? [];
  const view = ap?.display && ap.display !== "strip" ? ap.display : "strip";

  const shared = useContext(AppointmentPicksContext);
  const [localPick, setLocalPick] = useState<string | null>(null);
  const pickedId = shared ? (shared.picks[field.key] ?? null) : localPick;
  const setPick = (id: string | null) => {
    if (shared) shared.setPick(field.key, id);
    else setLocalPick(id);
  };

  // One service is never asked about: it is simply what the field books.
  useEffect(() => {
    if (services.length === 1 && pickedId !== services[0].id) {
      setPick(services[0].id);
    }
    // A service removed from the form while it was picked: ask again.
    if (
      services.length > 1 &&
      pickedId &&
      !services.some((s) => s.id === pickedId)
    ) {
      setPick(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services.length, pickedId]);

  // The builder shows the cards AND the picker (for the first service), so
  // both looks can be judged at once; a visitor sees one, then the other.
  const service =
    services.find((s) => s.id === pickedId) ??
    (services.length === 1 || (!live && services.length > 0)
      ? services[0]
      : null);
  const asking = live && services.length > 1 && !service;
  const rules = rulesOf(field, service);
  const selected = String(value ?? "");

  const lengthOf = (svc: AppointmentService) => {
    const r = rulesOf(field, svc);
    return r.wholeDay
      ? t(contentKey.appointment("wholeDay")) || "Whole day"
      : fillTemplate(t(contentKey.appointment("minutes")) || "{{n}} min", {
          n: r.durationMinutes,
        });
  };

  const cards =
    services.length > 1 && (asking || !live) ? (
      <div className="rf-appt-svcs">
        <div className="rf-appt-svcs-ttl">
          {t(contentKey.appointment("chooseService"))}
        </div>
        {services.map((svc) => (
          <button
            key={svc.id}
            type="button"
            className="rf-appt-svc"
            disabled={disabled}
            onClick={() => {
              if (!live) return;
              onChange("");
              setPick(svc.id);
            }}
          >
            <span className="rf-appt-svc-hd">
              <span className="rf-appt-svc-nm">
                {t(contentKey.fieldServiceName(field.id, svc.id))}
              </span>
              <span className="rf-appt-svc-dur">{lengthOf(svc)}</span>
            </span>
            <span className="rf-appt-svc-ds">
              {t(contentKey.fieldServiceDescription(field.id, svc.id))}
            </span>
          </button>
        ))}
      </div>
    ) : null;

  const chip =
    live && services.length > 1 && service ? (
      <div className="rf-appt-chip">
        <span className="rf-appt-chip-nm">
          {t(contentKey.fieldServiceName(field.id, service.id))}
        </span>
        <span className="rf-appt-chip-dur">{lengthOf(service)}</span>
        <button
          type="button"
          className="rf-appt-chip-btn"
          disabled={disabled}
          onClick={() => {
            // Whatever time was picked belonged to the old service.
            onChange("");
            setPick(null);
          }}
        >
          {t(contentKey.appointment("change")) || "Change"}
        </button>
      </div>
    ) : null;

  const faces = visibleHosts(rules.hosts);
  const hosts =
    faces.length > 0 ? (
      <div className="rf-appt-hosts">
        {faces.map((host, index) => (
          // Index, not the calendar key: a visitor's copy of the form no
          // longer carries the keys (publicDefinition on the server).
          <div key={index} className="rf-appt-host">
            {host.avatarUrl ? (
              <img
                className="rf-appt-host-av"
                src={host.avatarUrl}
                alt=""
                loading="lazy"
              />
            ) : (
              <span className="rf-appt-host-av rf-appt-host-ini">
                {initialsOf(host.label ?? "")}
              </span>
            )}
            <span className="rf-appt-host-nm">{host.label}</span>
          </div>
        ))}
      </div>
    ) : null;

  const inner = { ...props, rules, serviceId: service?.id, selected };
  // Remounted per service: its days, page and zone are that calendar's.
  const pickerKey = service?.id ?? "field";

  return (
    <div
      className="rf-appt"
      role="group"
      aria-labelledby={inputId}
      {...(view !== "strip" ? { "data-rf-view": view } : {})}
      {...(asking ? { "data-rf-step": "service" } : {})}
    >
      {cards}
      {chip}
      {hosts}
      {asking ? null : view === "month" ? (
        <ApptMonth key={pickerKey} {...inner} />
      ) : view === "list" ? (
        <ApptList key={pickerKey} {...inner} />
      ) : (
        <ApptStrip key={pickerKey} {...inner} />
      )}
      <input type="hidden" id={inputId} value={selected} readOnly />
    </div>
  );
}

interface PickerProps extends ControlProps {
  rules: Rules;
  serviceId: string | undefined;
  selected: string;
}

/** Loading / failed / unreadable / empty, in the words the form has for them. */
function stateNote(
  t: (key: string) => string,
  q: { isPending: boolean; isError: boolean },
  unavailable: boolean | undefined,
  empty: boolean,
  emptyKey: string,
): ReactNode | null {
  if (q.isPending) {
    return (
      <div className="rf-appt-loading">
        {t(contentKey.appointment("loading")) || "Loading times..."}
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="rf-appt-empty">
        {t(contentKey.errorGeneric()) || "Something went wrong."}
      </div>
    );
  }
  if (unavailable) {
    // A calendar could not be read. Saying "no free times" would be a guess.
    return (
      <div className="rf-appt-empty">
        {t(contentKey.appointment("unavailable")) ||
          "Times cannot be checked right now."}
      </div>
    );
  }
  if (empty) {
    return <div className="rf-appt-empty">{t(contentKey.appointment(emptyKey))}</div>;
  }
  return null;
}

/** The time they picked, read back in full so nothing is left to guess. */
function Picked({
  selected,
  timeZone,
  wholeDay,
  locale,
  t,
}: {
  selected: string;
  timeZone: string;
  wholeDay: boolean;
  locale?: string;
  t: (key: string) => string;
}) {
  let text = "";
  if (selected) {
    const iso = selected.split("--")[0];
    try {
      text = new Intl.DateTimeFormat(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone,
        ...(wholeDay
          ? {}
          : { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }),
      }).format(new Date(iso));
    } catch {
      text = iso;
    }
  }
  return (
    <div className="rf-appt-picked" aria-live="polite">
      {text ? (
        <>
          <span className="rf-appt-picked-lbl">
            {t(contentKey.appointment("yourTime"))}
          </span>
          <span className="rf-appt-picked-val">{text}</span>
        </>
      ) : null}
    </div>
  );
}

/** Placeholder times for the preview: window start + n × duration. */
function previewTime(
  locale: string | undefined,
  rules: Rules,
  n: number,
): string {
  const [h, m] = rules.windowStart.split(":").map(Number);
  const step = rules.durationMinutes >= 1440 ? 60 : rules.durationMinutes;
  const minutes = (h || 9) * 60 + (m || 0) + n * step;
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2000, 0, 1, 0, minutes)));
  } catch {
    return `${pad2(Math.floor(minutes / 60) % 24)}:${pad2(minutes % 60)}`;
  }
}

// ---------------------------------------------------------------------------
// Day strip — the look every form had before the other two existed
// ---------------------------------------------------------------------------

function ApptStrip({
  field,
  disabled,
  t,
  onChange,
  live,
  formId,
  locale,
  rules,
  serviceId,
  selected,
}: PickerProps) {
  const services = field.appointment?.services ?? [];
  const [page, setPage] = useState(0);
  const [pickedDay, setPickedDay] = useState("");

  const canFetch = live && !!formId && pickedDay !== "";
  const slotsQuery = useQuery({
    queryKey: [
      APPOINTMENT_QUERY_ROOT,
      "slots",
      formId,
      field.id,
      serviceId ?? "",
      pickedDay,
    ],
    queryFn: () =>
      getAppointmentAvailability(formId!, field.id, pickedDay, serviceId),
    enabled: canFetch,
    retry: false,
    // Short: another visitor can book a slot away at any moment, and a stale
    // list only turns into slot_unavailable at submit.
    staleTime: 30_000,
  });

  const today = new Date();
  const days = Array.from({ length: APPT_PER_PAGE }, (_, i) => {
    const offset = page * APPT_PER_PAGE + i;
    const d = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + offset,
    );
    // The weekday is read in the visitor's local calendar, exactly like the
    // embed runtime; the server re-derives it in the form's timezone and simply
    // returns [] for a day that only looks open from here.
    const open =
      rules.weekdays.includes(DAY_KEYS[d.getDay()]) &&
      offset <= rules.maxDaysAhead;
    return { date: d, str: dayString(d), open };
  });

  // Preview: the first bookable day reads as selected, so the control shows its
  // working state rather than an untouched skeleton.
  const selectedDay = live ? pickedDay : (days.find((d) => d.open)?.str ?? "");

  const weekdayLabel = (d: Date) => {
    try {
      return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d);
    } catch {
      return DAY_KEYS[d.getDay()];
    }
  };

  /**
   * The slot's OWN timezone, not the visitor's: the bookable window was
   * configured as wall-clock time there, and that is what whoever set the form
   * up expects the visitor to read back.
   */
  const timeLabel = (iso: string) =>
    rules.wholeDay
      ? t(contentKey.appointment("wholeDay")) || "Whole day"
      : fmtTime(locale, iso, rules.timezone);

  let slotGrid: ReactNode;
  if (!live) {
    slotGrid = Array.from({ length: 4 }, (_, n) => (
      <button
        key={n}
        type="button"
        disabled={disabled}
        className={`rf-appt-slot${n === 0 ? " rf-on" : ""}`}
      >
        {previewTime(locale, rules, n)}
      </button>
    ));
  } else if (pickedDay === "") {
    slotGrid = null;
  } else {
    slotGrid =
      stateNote(
        t,
        slotsQuery,
        slotsQuery.data?.unavailable,
        (slotsQuery.data?.slots.length ?? 0) === 0,
        "empty",
      ) ??
      slotsQuery.data!.slots.map((slot) => (
        <button
          key={slot}
          type="button"
          disabled={disabled}
          className={`rf-appt-slot${slot === selected ? " rf-on" : ""}`}
          aria-pressed={slot === selected}
          onClick={() => onChange(slot)}
        >
          {timeLabel(slot.split("--")[0])}
        </button>
      ));
  }

  return (
    <>
      <div className="rf-appt-nav">
        <button
          type="button"
          className="rf-appt-prev"
          aria-label="Previous days"
          disabled={disabled || page === 0}
          onClick={() => live && setPage((p) => Math.max(0, p - 1))}
        >
          ‹
        </button>
        <div className="rf-appt-days">
          {days.map((d) => (
            <button
              key={d.str}
              type="button"
              className={`rf-appt-day${d.str === selectedDay ? " rf-on" : ""}`}
              disabled={disabled || !d.open}
              onClick={() => live && setPickedDay(d.str)}
            >
              <span className="rf-appt-day-wk">{weekdayLabel(d.date)}</span>
              <span className="rf-appt-day-num">{d.date.getDate()}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="rf-appt-next"
          aria-label="Next days"
          disabled={
            disabled || (page + 1) * APPT_PER_PAGE > rules.maxDaysAhead
          }
          onClick={() => live && setPage((p) => p + 1)}
        >
          ›
        </button>
      </div>
      <div className="rf-appt-slots">{slotGrid}</div>
      {/* Only where the runtime adds it too: a field with services. */}
      {services.length > 0 && live ? (
        <Picked
          selected={selected}
          timeZone={rules.timezone}
          wholeDay={rules.wholeDay}
          locale={locale}
          t={t}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Month calendar + time list
// ---------------------------------------------------------------------------

function ApptMonth({
  field,
  disabled,
  t,
  onChange,
  live,
  formId,
  locale,
  rules,
  serviceId,
  selected,
}: PickerProps) {
  const tzId = useId();
  // The grid shows the CALENDAR's days: a visitor in another zone still books
  // one of the business's days. Only the clock times are re-read elsewhere.
  const today = useMemo(
    () => dateIn(new Date(), rules.timezone) || dayString(new Date()),
    [rules.timezone],
  );
  const horizon = addDays(today, rules.maxDaysAhead);

  const [cal, setCal] = useState(() => ({
    y: Number(today.slice(0, 4)),
    m: Number(today.slice(5, 7)) - 1,
  }));
  const [pickedDay, setPickedDay] = useState("");
  const [zone, setZone] = useState(rules.timezone);
  const [advanced, setAdvanced] = useState(false);
  const zones = useMemo(() => zoneOptions(rules.timezone), [rules.timezone]);

  const last = new Date(Date.UTC(cal.y, cal.m + 1, 0, 12)).getUTCDate();
  const monthFirst = ymd(cal.y, cal.m, 1);
  const monthLast = ymd(cal.y, cal.m, last);

  const daysQuery = useQuery({
    queryKey: [
      APPOINTMENT_QUERY_ROOT,
      "days",
      formId,
      field.id,
      serviceId ?? "",
      monthFirst,
    ],
    queryFn: () =>
      getAppointmentDays(
        formId!,
        field.id,
        { from: monthFirst, to: monthLast },
        { serviceId },
      ),
    enabled: live && !!formId,
    retry: false,
    staleTime: 30_000,
  });

  const slotsQuery = useQuery({
    queryKey: [
      APPOINTMENT_QUERY_ROOT,
      "slots",
      formId,
      field.id,
      serviceId ?? "",
      pickedDay,
    ],
    queryFn: () =>
      getAppointmentAvailability(formId!, field.id, pickedDay, serviceId),
    enabled: live && !!formId && pickedDay !== "",
    retry: false,
    staleTime: 30_000,
  });

  /** Preview: open weekdays inside the horizon read as free. */
  const previewFree = (str: string) =>
    str >= today &&
    str <= horizon &&
    rules.weekdays.includes(DAY_KEYS[dateOf(str).getUTCDay()]);

  const freeDays = useMemo(() => {
    const set = new Set<string>();
    if (!live) {
      for (let d = 1; d <= last; d++) {
        const str = ymd(cal.y, cal.m, d);
        if (previewFree(str)) set.add(str);
      }
      return set;
    }
    for (const day of daysQuery.data?.days ?? []) {
      if (day.state === "open" && day.free > 0) set.add(day.date);
    }
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, daysQuery.data, cal.y, cal.m, last, today, horizon, rules.weekdays]);

  /**
   * With a month loaded: keep the picked day when it is on this page, else
   * open the first day that still has a time. A month with none steps on to
   * the next one, once — a visitor landing on the 29th should not have to
   * discover that the times are on the next page.
   */
  useEffect(() => {
    if (!live || !daysQuery.data || daysQuery.data.unavailable) return;
    if (pickedDay.slice(0, 7) === monthFirst.slice(0, 7)) return;
    const first = [...freeDays].sort()[0];
    if (first) {
      if (!selected) setPickedDay(first);
      return;
    }
    if (!advanced && monthLast < horizon) {
      setAdvanced(true);
      setCal((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }));
    } else if (!advanced) {
      setAdvanced(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, daysQuery.data, monthFirst]);

  const shownDay = live
    ? pickedDay
    : ([...freeDays].sort()[0] ?? "");

  // Monday first: getUTCDay() counts from Sunday.
  const lead = (new Date(Date.UTC(cal.y, cal.m, 1, 12)).getUTCDay() + 6) % 7;

  const slotLabel = (slot: string) => {
    const iso = slot.split("--")[0];
    if (rules.wholeDay) return t(contentKey.appointment("wholeDay")) || "Whole day";
    const text = fmtTime(locale, iso, zone);
    // A time that falls on another date in the zone it is read in says so.
    const shown = dateIn(new Date(iso), zone);
    return shown && pickedDay && shown !== pickedDay
      ? `${fmtDate(locale, shown, { weekday: "short", day: "numeric" })} · ${text}`
      : text;
  };

  let times: ReactNode;
  if (!live) {
    times = Array.from({ length: 4 }, (_, n) => (
      <button
        key={n}
        type="button"
        disabled={disabled}
        className={`rf-appt-time${n === 0 ? " rf-on" : ""}`}
      >
        {rules.wholeDay
          ? t(contentKey.appointment("wholeDay")) || "Whole day"
          : previewTime(locale, rules, n)}
      </button>
    )).slice(0, rules.wholeDay ? 1 : 4);
  } else if (daysQuery.isPending || daysQuery.isError || daysQuery.data?.unavailable) {
    times = stateNote(t, daysQuery, daysQuery.data?.unavailable, false, "empty");
  } else if (pickedDay === "") {
    times = (
      <div className="rf-appt-empty">
        {t(
          contentKey.appointment(
            advanced && freeDays.size === 0 ? "noTimes" : "pickDay",
          ),
        )}
      </div>
    );
  } else {
    times =
      stateNote(
        t,
        slotsQuery,
        slotsQuery.data?.unavailable,
        (slotsQuery.data?.slots.length ?? 0) === 0,
        "empty",
      ) ??
      slotsQuery.data!.slots.map((slot) => (
        <button
          key={slot}
          type="button"
          disabled={disabled}
          className={`rf-appt-time${slot === selected ? " rf-on" : ""}`}
          aria-pressed={slot === selected}
          onClick={() => onChange(slot)}
        >
          {slotLabel(slot)}
        </button>
      ));
  }

  const move = (step: number) => {
    if (!live) return;
    setCal((c) => {
      const m = c.m + step;
      if (m > 11) return { y: c.y + 1, m: 0 };
      if (m < 0) return { y: c.y - 1, m: 11 };
      return { y: c.y, m };
    });
  };

  return (
    <>
      <div className="rf-appt-month">
        <div className="rf-appt-cal">
          <div className="rf-appt-cal-hd">
            <button
              type="button"
              className="rf-appt-cal-prev"
              aria-label={t(contentKey.appointment("prevMonth")) || "Previous month"}
              disabled={disabled || monthFirst <= today}
              onClick={() => move(-1)}
            >
              ‹
            </button>
            <div className="rf-appt-cal-ttl" aria-live="polite">
              {fmtDate(locale, monthFirst, { month: "long", year: "numeric" })}
            </div>
            <button
              type="button"
              className="rf-appt-cal-next"
              aria-label={t(contentKey.appointment("nextMonth")) || "Next month"}
              disabled={disabled || monthLast >= horizon}
              onClick={() => move(1)}
            >
              ›
            </button>
          </div>
          <div className="rf-appt-cal-wk" aria-hidden="true">
            {/* 1 January 2024 was a Monday: seven days from it name the week. */}
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i}>
                {fmtDate(locale, ymd(2024, 0, i + 1), { weekday: "short" })}
              </span>
            ))}
          </div>
          <div className="rf-appt-cal-grid">
            {Array.from({ length: lead }, (_, i) => (
              <span key={`pad-${i}`} className="rf-appt-cal-pad" />
            ))}
            {Array.from({ length: last }, (_, i) => {
              const str = ymd(cal.y, cal.m, i + 1);
              const free = freeDays.has(str);
              const cls = [
                "rf-appt-cal-day",
                free ? "rf-free" : "",
                str === today ? "rf-today" : "",
                str === shownDay ? "rf-on" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={str}
                  type="button"
                  className={cls}
                  disabled={disabled || !free}
                  aria-label={fmtDate(locale, str, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                  aria-pressed={str === shownDay}
                  onClick={() => live && setPickedDay(str)}
                >
                  {i + 1}
                </button>
              );
            })}
            {/* Always six weeks, so the card is the same height every month
                and the times beside it never jump. */}
            {Array.from({ length: Math.max(0, 42 - lead - last) }, (_, i) => (
              <span key={`tail-${i}`} className="rf-appt-cal-pad" />
            ))}
          </div>
        </div>
        <div className="rf-appt-side">
          {/* A whole day has no clock time to read in another zone. */}
          <div className="rf-appt-tzwrap" hidden={rules.wholeDay}>
            <label className="rf-appt-lbl" htmlFor={tzId}>
              {t(contentKey.appointment("timezone"))}
            </label>
            <select
              id={tzId}
              className="rf-select rf-appt-tz"
              value={zone}
              disabled={disabled}
              onChange={(e) => setZone(e.target.value)}
            >
              {zones.map((z) =>
                z.divider ? (
                  <option key="divider" disabled>
                    ──────────
                  </option>
                ) : (
                  <option key={z.value} value={z.value}>
                    {z.label}
                  </option>
                ),
              )}
            </select>
          </div>
          <div className="rf-appt-timeswrap">
            <div className="rf-appt-lbl">
              {t(contentKey.appointment("availableTimes"))}
            </div>
            <div className="rf-appt-times">{times}</div>
          </div>
        </div>
      </div>
      {live ? (
        <Picked
          selected={selected}
          timeZone={zone}
          wholeDay={rules.wholeDay}
          locale={locale}
          t={t}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Next free times
// ---------------------------------------------------------------------------

function ApptList({
  field,
  disabled,
  t,
  onChange,
  live,
  formId,
  locale,
  rules,
  serviceId,
  selected,
}: PickerProps) {
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});

  const query = useInfiniteQuery({
    queryKey: [
      APPOINTMENT_QUERY_ROOT,
      "next",
      formId,
      field.id,
      serviceId ?? "",
    ],
    queryFn: ({ pageParam }) =>
      getAppointmentNext(formId!, field.id, {
        serviceId,
        after: pageParam || undefined,
      }),
    initialPageParam: "",
    getNextPageParam: (lastPage) =>
      lastPage.more && lastPage.groups.length > 0
        ? lastPage.groups[lastPage.groups.length - 1].date
        : undefined,
    enabled: live && !!formId,
    retry: false,
    staleTime: 30_000,
  });

  const groups = useMemo(() => {
    if (live) return (query.data?.pages ?? []).flatMap((p) => p.groups);
    // Preview: the next two open days, four times each.
    const today = dateIn(new Date(), rules.timezone) || dayString(new Date());
    const out: Array<{ date: string; slots: string[] }> = [];
    for (let i = 0; i <= rules.maxDaysAhead && out.length < 2; i++) {
      const str = addDays(today, i);
      if (rules.weekdays.includes(DAY_KEYS[dateOf(str).getUTCDay()])) {
        out.push({ date: str, slots: ["0", "1", "2", "3"] });
      }
    }
    return out;
  }, [live, query.data, rules.timezone, rules.maxDaysAhead, rules.weekdays]);

  const unavailable = (query.data?.pages ?? []).some((p) => p.unavailable);
  const timeLabel = (slot: string) =>
    rules.wholeDay
      ? t(contentKey.appointment("wholeDay")) || "Whole day"
      : live
        ? fmtTime(locale, slot.split("--")[0], rules.timezone)
        : previewTime(locale, rules, Number(slot));

  const note = live
    ? stateNote(t, query, unavailable, groups.length === 0, "noTimes")
    : null;

  return (
    <>
      <div className="rf-appt-soon">
        {note ?? (
          <>
            <div className="rf-appt-lbl">
              {t(contentKey.appointment("nextTimes"))}
            </div>
            {groups.map((group, gi) => {
              const open = openDays[group.date] === true;
              const shown = group.slots.filter(
                (slot, j) => open || j < NEXT_SHOWN || slot === selected,
              );
              return (
                <div key={group.date} className="rf-appt-next-grp">
                  <div className="rf-appt-next-day">
                    {fmtDate(locale, group.date, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </div>
                  <div className="rf-appt-next-times">
                    {shown.map((slot, j) => {
                      const on = live ? slot === selected : gi === 0 && j === 0;
                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={disabled}
                          className={`rf-appt-slot${on ? " rf-on" : ""}`}
                          aria-pressed={on}
                          onClick={() => live && onChange(slot)}
                        >
                          {timeLabel(slot)}
                        </button>
                      );
                    })}
                  </div>
                  {!open && group.slots.length > NEXT_SHOWN ? (
                    <button
                      type="button"
                      className="rf-appt-more"
                      disabled={disabled}
                      onClick={() =>
                        setOpenDays((d) => ({ ...d, [group.date]: true }))
                      }
                    >
                      {t(contentKey.appointment("moreTimes")) || "More times"}
                    </button>
                  ) : null}
                </div>
              );
            })}
            {live && query.hasNextPage ? (
              <button
                type="button"
                className="rf-appt-more"
                disabled={disabled || query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                {t(contentKey.appointment("nextDays")) || "Next days"}
              </button>
            ) : null}
          </>
        )}
      </div>
      {live ? (
        <Picked
          selected={selected}
          timeZone={rules.timezone}
          wholeDay={rules.wholeDay}
          locale={locale}
          t={t}
        />
      ) : null}
    </>
  );
}
