/**
 * The customer's own appointment: /booking/:token
 *
 * Reached from the confirmation or reminder email, by someone with no account,
 * almost always on a phone. One column, one appointment: see it, say "I'll be
 * there", pick another free time, or cancel. Written in the customer's
 * language (the one they booked in), formal register.
 *
 * Client-only data on purpose, like /t/:token: the token is a credential and
 * nothing here should pass through SSR or an index.
 */

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { I18nextProvider } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, MapPin, Video } from "lucide-react";
import { isAxiosError } from "axios";
import i18n from "~/i18n";
import { PUBLIC_BOOKING_HY } from "~/lib/appointment-book/public-hy";
import { DocumentScheme } from "~/components/forms/PublicShell";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import {
  cancelPublicAppointment,
  confirmPublicAppointment,
  getPublicAppointment,
  getPublicSlots,
  movePublicAppointment,
  type AppointmentCalendar,
  type PublicAppointment,
} from "~/lib/api/appointment-book";
import { SlotPicker, type PickedTime } from "~/components/appointment-book/slot-picker";
import { dayOf, longDateYear, timeOf } from "~/components/appointment-book/format";
import { cn } from "~/lib/utils";

export function meta() {
  return [
    { title: i18n.t("appointmentBook.public.metaTitle", { defaultValue: "Your appointment" }) },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

const PAPER = "#f5f4f1";

// Armenian for this page only (the app UI stays EN/DE/FR/NL): a customer who
// booked in Armenian reads their appointment in Armenian.
if (!i18n.hasResourceBundle("hy", "translation")) {
  i18n.addResourceBundle("hy", "translation", PUBLIC_BOOKING_HY, true, false);
}

export default function PublicAppointmentRoute() {
  const { token = "" } = useParams<{ token: string }>();
  const q = useQuery({
    queryKey: ["public-appointment", token],
    queryFn: () => getPublicAppointment(token),
    enabled: !!token,
    retry: false,
  });
  const t = i18n.getFixedT(q.data?.locale ?? i18n.language);
  // The tab title in the customer's language, like the page itself.
  const title = t("appointmentBook.public.metaTitle", { defaultValue: "Your appointment" });
  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <>
      <DocumentScheme background={PAPER} />
      <main className="min-h-dvh w-full px-4 py-8 sm:px-6 sm:py-14" style={{ backgroundColor: PAPER }}>
        <div className="mx-auto w-full max-w-xl">
          {q.isLoading ? (
            <div className="h-72 animate-pulse rounded-2xl bg-white/70" />
          ) : q.isError || !q.data ? (
            <div className="rounded-2xl border border-[#e2e1dc] bg-white p-6 sm:p-8">
              <h1 className="text-[22px] font-semibold text-[#141516]">{t("appointmentBook.public.invalidTitle", { defaultValue: "This link no longer works" })}</h1>
              <p className="mt-2 text-[15px] leading-relaxed text-[#6b6866]">
                {t("appointmentBook.public.invalidBody", {
                  defaultValue: "It may have expired after the appointment. Please contact the business directly to change anything.",
                })}
              </p>
            </div>
          ) : (
            <AppointmentCard token={token} view={q.data} />
          )}
          <p className="mt-8 text-center text-[11px] text-[#9a9893]">{t("tracking.footer", { defaultValue: "Powered by Repraesent" })}</p>
        </div>
      </main>
    </>
  );
}

function AppointmentCard({ token, view }: { token: string; view: PublicAppointment }) {
  const t = i18n.getFixedT(view.locale);
  // The language the customer booked in, its own clock: 12-hour for English,
  // 24-hour elsewhere — the same as the time buttons below.
  const intl = { en: "en-US", de: "de-DE", fr: "fr-FR", nl: "nl-NL", hy: "hy-AM" }[view.locale];
  // The time picker is shared with the app and reads the app's language; give
  // it the customer's instead, so the whole page speaks one language.
  const pickerI18n = useMemo(() => i18n.cloneInstance({ lng: view.locale }), [view.locale]);
  const qc = useQueryClient();
  // The email's "Cancel" / "Choose another time" buttons open straight on that step.
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"view" | "move" | "cancel">(() => {
    const action = searchParams.get("action");
    return view.can_change && (action === "move" || action === "cancel") ? action : "view";
  });
  const [day, setDay] = useState(dayOf(view.starts_at, view.timezone));
  const [time, setTime] = useState<PickedTime | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const refresh = (next: PublicAppointment) => qc.setQueryData(["public-appointment", token], next);

  const when = view.all_day
    ? longDateYear(view.starts_at, view.timezone, intl)
    : `${longDateYear(view.starts_at, view.timezone, intl)}, ${timeOf(view.starts_at, view.timezone, intl)}–${timeOf(view.ends_at, view.timezone, intl)}`;

  // A calendar-shaped stand-in: the picker only needs the zone, the length and the unit.
  const pickerCalendar = useMemo(
    () =>
      ({
        id: `public-${token.slice(0, 12)}`,
        timezone: view.timezone,
        duration_minutes: view.duration_minutes,
        booking_unit: view.booking_unit,
      }) as AppointmentCalendar,
    [token, view.timezone, view.duration_minutes, view.booking_unit],
  );

  const failed = (e: unknown) => {
    const code = isAxiosError(e) ? (e.response?.data as { code?: string })?.code : null;
    setError(
      code === "SLOT_TAKEN"
        ? t("appointmentBook.public.taken", { defaultValue: "That time was just taken. Please pick another one." })
        : code === "RATE_LIMITED"
          ? t("appointmentBook.public.tooMany", { defaultValue: "Too many changes in a short time. Please try again in a few minutes." })
          : t("appointmentBook.public.failed", { defaultValue: "That did not work. Please try again, or contact the business directly." }),
    );
  };
  const confirm = useMutation({ mutationFn: () => confirmPublicAppointment(token), onSuccess: refresh, onError: failed });
  const move = useMutation({
    mutationFn: () => movePublicAppointment(token, time!.starts_at, time!.ends_at),
    onSuccess: (next) => {
      refresh(next);
      setMode("view");
      setTime(null);
    },
    onError: failed,
  });
  const cancel = useMutation({
    mutationFn: () => cancelPublicAppointment(token, reason.trim() || null),
    onSuccess: (next) => {
      refresh(next);
      setMode("view");
    },
    onError: failed,
  });

  const cancelled = view.status === "cancelled";
  const blocked =
    view.change_blocked === "too_late"
      ? t("appointmentBook.public.tooLate", {
          defaultValue: "It is too close to the appointment to change it here. Please contact {{business}} directly.",
          business: view.business_name,
        })
      : view.change_blocked === "not_allowed"
        ? t("appointmentBook.public.notAllowed", {
            defaultValue: "To change this appointment, please contact {{business}} directly.",
            business: view.business_name,
          })
        : null;

  const btn = "h-12 w-full rounded-xl text-[15px] sm:h-11 sm:w-auto";

  return (
    <article className="overflow-hidden rounded-2xl border border-[#e2e1dc] bg-white">
      <div className="h-[3px] bg-[#f5d74f]" aria-hidden />
      <div className="space-y-5 p-6 sm:p-8">
        <header className="space-y-1">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6b6866]">{view.business_name}</p>
          <h1 className="text-[24px] font-semibold leading-tight text-[#141516] sm:text-[28px]">
            {cancelled
              ? t("appointmentBook.public.cancelledTitle", { defaultValue: "Your appointment is cancelled" })
              : t("appointmentBook.public.title", { defaultValue: "Your appointment" })}
          </h1>
          {view.calendar_name ? <p className="text-[14px] text-[#6b6866]">{view.calendar_name}</p> : null}
        </header>

        <div className={cn("rounded-xl border border-[#e2e1dc] p-4", cancelled && "opacity-60")}>
          <p className={cn("text-[18px] font-semibold text-[#141516]", cancelled && "line-through")}>{when}</p>
          {!cancelled && view.mode === "in_person" && view.location ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(view.location)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex items-start gap-2 text-[15px] text-[#141516] underline-offset-4 hover:underline"
            >
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
              {view.location}
            </a>
          ) : null}
          {!cancelled && view.mode === "online" && view.meeting_url ? (
            <a href={view.meeting_url} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 text-[15px] font-medium text-[#141516] underline underline-offset-4">
              <Video className="size-4" aria-hidden />
              {t("appointmentBook.public.join", { defaultValue: "Join online" })}
            </a>
          ) : null}
          {view.confirmed && !cancelled ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#e3f2ea] px-2.5 py-1 text-[13px] font-medium text-[#2e7d55]">
              <Check className="size-3.5" aria-hidden />
              {t("appointmentBook.public.confirmed", { defaultValue: "You said you'll be there" })}
            </p>
          ) : null}
        </div>

        {error ? <p className="rounded-lg bg-[#fbe7e9] px-3 py-2 text-[14px] text-[#c8414f]">{error}</p> : null}

        {cancelled || view.change_blocked === "past" ? null : mode === "move" ? (
          <div className="space-y-4">
            <h2 className="text-[16px] font-semibold text-[#141516]">{t("appointmentBook.public.pickNew", { defaultValue: "Pick a new time" })}</h2>
            <I18nextProvider i18n={pickerI18n}>
              <SlotPicker
                calendar={pickerCalendar}
                day={day}
                onDayChange={setDay}
                value={time}
                onChange={(v) => {
                  setError(null);
                  setTime(v);
                }}
                fetchSlots={(d) => getPublicSlots(token, d)}
              />
            </I18nextProvider>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" className={btn} onClick={() => setMode("view")}>
                {t("appointmentBook.public.back", { defaultValue: "Back" })}
              </Button>
              <Button className={btn} disabled={!time || move.isPending} onClick={() => move.mutate()}>
                {t("appointmentBook.public.moveConfirm", { defaultValue: "Move my appointment" })}
              </Button>
            </div>
          </div>
        ) : mode === "cancel" ? (
          <div className="space-y-3">
            <h2 className="text-[16px] font-semibold text-[#141516]">{t("appointmentBook.public.cancelTitle", { defaultValue: "Cancel this appointment?" })}</h2>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder={t("appointmentBook.public.reason", { defaultValue: "Would you like to tell us why? (optional)" })}
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" className={btn} onClick={() => setMode("view")}>
                {t("appointmentBook.public.keep", { defaultValue: "Keep it" })}
              </Button>
              <Button variant="destructive" className={btn} disabled={cancel.isPending} onClick={() => cancel.mutate()}>
                {t("appointmentBook.public.cancelConfirm", { defaultValue: "Yes, cancel it" })}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {!view.confirmed ? (
              <Button className={cn(btn, "sm:w-full")} disabled={confirm.isPending} onClick={() => confirm.mutate()}>
                {t("appointmentBook.public.willCome", { defaultValue: "Yes, I'll be there" })}
              </Button>
            ) : null}
            {view.can_change ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" className={cn(btn, "sm:flex-1")} onClick={() => setMode("move")}>
                  {t("appointmentBook.public.move", { defaultValue: "Choose another time" })}
                </Button>
                <Button variant="outline" className={cn(btn, "sm:flex-1")} onClick={() => setMode("cancel")}>
                  {t("appointmentBook.public.cancel", { defaultValue: "Cancel appointment" })}
                </Button>
              </div>
            ) : blocked ? (
              <p className="text-[14px] text-[#6b6866]">{blocked}</p>
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
}
