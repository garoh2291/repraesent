"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarCheck2, Loader2 } from "lucide-react";
import {
  bookSalesCall,
  errorCodeOf,
  getSalesDays,
  getSalesSlots,
  type SalesConfig,
} from "~/lib/api/onboarding-v2";
import { cn } from "~/lib/utils";

/** YYYY-MM-DD for today + n days in a timezone. */
function dateIn(tz: string, addDays = 0): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
      new Date(Date.now() + addDays * 86_400_000),
    );
  } catch {
    return new Date(Date.now() + addDays * 86_400_000).toISOString().slice(0, 10);
  }
}

/** Where the panel reads free time and books. Onboarding by default. */
export interface BookingApi {
  key: string;
  days: (from: string, to: string) => Promise<{ days: Array<{ date: string; state: string; free: number }> }>;
  slots: (date: string) => Promise<{ slots: string[] }>;
  book: (slot: string) => Promise<{ booking: BookedCall }>;
}

const onboardingApi: BookingApi = {
  key: "onboarding-v2",
  days: getSalesDays,
  slots: getSalesSlots,
  book: bookSalesCall,
};

export interface BookedCall {
  start: string;
  end: string;
  host_label: string | null;
  meet_link: string | null;
}

/**
 * Pick a day, pick a time, confirm. Days come from the merged availability of
 * the sales team; the customer never sees who is free — only that someone is.
 * Times are shown in the visitor's own timezone.
 */
export function BookingPanel({
  config,
  onBooked,
  api = onboardingApi,
  beforeConfirm,
  empty,
}: {
  config: Pick<SalesConfig, "timezone" | "max_days_ahead" | "duration_minutes">;
  onBooked: (b: BookedCall) => void;
  api?: BookingApi;
  /** Extra fields shown above the confirm button (e.g. a note). */
  beforeConfirm?: React.ReactNode;
  /** Shown instead of the default text when nobody has free time. */
  empty?: React.ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const reduce = useReducedMotion();
  const tz = config.timezone ?? "Europe/Berlin";
  const horizon = Math.min(21, config.max_days_ahead ?? 21);
  const from = dateIn(tz, 0);
  const to = dateIn(tz, horizon - 1);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = useQuery({ queryKey: [api.key, "sales-days", from, to], queryFn: () => api.days(from, to), staleTime: 60_000 });
  const open = (days.data?.days ?? []).filter((d) => d.state === "open" && d.free > 0);
  const activeDate = date ?? open[0]?.date ?? null;
  const slots = useQuery({
    queryKey: [api.key, "sales-slots", activeDate],
    queryFn: () => api.slots(activeDate!),
    enabled: !!activeDate,
    staleTime: 30_000,
  });

  const dayFmt = useMemo(() => new Intl.DateTimeFormat(i18n.language, { weekday: "short", timeZone: "UTC" }), [i18n.language]);
  const numFmt = useMemo(() => new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short", timeZone: "UTC" }), [i18n.language]);
  const timeFmt = useMemo(() => new Intl.DateTimeFormat(i18n.language, { hour: "numeric", minute: "2-digit" }), [i18n.language]);
  const localTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "";
    }
  }, []);

  const confirm = async () => {
    if (!slot) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.book(slot);
      onBooked(res.booking);
    } catch (err) {
      const code = errorCodeOf(err);
      if (code === "SLOT_UNAVAILABLE" || code === "BOOKING_FAILED") {
        setError(t("onb.book.taken"));
        setSlot(null);
        void slots.refetch();
        void days.refetch();
      } else if (code === "NOT_READY") setError(t("onb.book.notReady"));
      else if (code === "ALREADY_BOOKED") setError(t("onb.book.alreadyBooked"));
      else setError(t("onb.errors.generic"));
    } finally {
      setBusy(false);
    }
  };

  if (days.isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> {t("onb.book.loading")}
      </div>
    );
  }
  if (!open.length) {
    if (empty) return <>{empty}</>;
    return <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">{t("onb.book.noTimes")}</p>;
  }

  return (
    <div className="space-y-5">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="listbox" aria-label={t("onb.book.pickDay")}>
        {open.map((d) => {
          const noon = new Date(`${d.date}T12:00:00Z`);
          const active = d.date === activeDate;
          return (
            <button
              key={d.date}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => {
                setDate(d.date);
                setSlot(null);
              }}
              className={cn(
                "flex w-[4.5rem] shrink-0 flex-col items-center gap-0.5 rounded-xl border py-2.5 transition-[transform,background-color,border-color] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25",
                active ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:border-foreground/30",
              )}
            >
              <span className="text-[11px] font-medium uppercase tracking-wide opacity-70">{dayFmt.format(noon)}</span>
              <span className="text-[15px] font-semibold">{numFmt.format(noon)}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeDate ?? "none"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.1 : 0.15 }}
        >
          {slots.isLoading ? (
            <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : (slots.data?.slots.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">{t("onb.book.dayFull")}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="listbox" aria-label={t("onb.book.pickTime")}>
              {slots.data!.slots.map((s) => {
                const start = new Date(s.split("--")[0]);
                const active = slot === s;
                return (
                  <button
                    key={s}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => setSlot(s)}
                    className={cn(
                      "h-10 rounded-lg border text-sm font-medium tabular-nums transition-[transform,background-color,border-color] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25",
                      active ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:border-foreground/30",
                    )}
                  >
                    {timeFmt.format(start)}
                  </button>
                );
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      <p className="text-[12px] text-muted-foreground">{t("onb.book.timesIn", { tz: localTz.replace(/_/g, " "), minutes: config.duration_minutes ?? 30 })}</p>

      {beforeConfirm}

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void confirm()}
        disabled={!slot || busy}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-foreground px-5 text-sm font-semibold text-background transition-[transform,opacity] hover:opacity-90 active:scale-[0.97] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 sm:h-10 sm:w-auto"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <CalendarCheck2 className="size-4" />}
        {slot
          ? t("onb.book.confirm", {
              day: new Intl.DateTimeFormat(i18n.language, { weekday: "long", day: "numeric", month: "long" }).format(new Date(slot.split("--")[0])),
              time: timeFmt.format(new Date(slot.split("--")[0])),
            })
          : t("onb.book.pickTime")}
      </button>
    </div>
  );
}
