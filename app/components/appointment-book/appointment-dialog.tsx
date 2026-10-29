import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { addDays, format } from "date-fns";
import { isAxiosError } from "axios";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { BottomSheet } from "~/components/notebook/bottom-sheet";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { createContact, getContact } from "~/lib/api/contacts-crm";
import { LANGUAGE_NAMES } from "~/i18n/language-names";
import type { FormLocale } from "~/lib/forms/schema";
import { CustomerLanguageSelect, announceCardLanguage, isCustomerLocale } from "./customer-language-select";
import { SenderNotice } from "./email-sender";
import { createAppointment, getCalendarDays, type Appointment } from "~/lib/api/appointment-book";
import { useAppointmentCalendars, useInvalidateAppointments } from "~/lib/hooks/useAppointmentBook";
import { CalendarDot } from "./appointment-bits";
import { EntityPicker, type PickedEntity } from "./entity-picker";
import { SlotPicker, type PickedTime } from "./slot-picker";
import { dayOf, longDate, timeOf } from "./format";

/** What the page you are on already knows: open the dialog with it filled in. */
export interface AppointmentPrefill {
  calendarId?: string;
  /** An instant: the day (and, from the calendar view, the time) to start on. */
  startsAt?: string;
  /** Only the day of `startsAt` counts (a click in the month grid). */
  dayOnly?: boolean;
  contact?: PickedEntity | null;
  deal?: PickedEntity | null;
  leadId?: string | null;
  /** Shown as "With …" when there is a lead but no contact yet. */
  leadLabel?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  /** Someone with no contact yet (book again after a visit): starts as "someone new", filled in. */
  customerName?: string | null;
  /** The inquiry's form language, when the dialog opens from one. */
  customerLocale?: string | null;
}

/**
 * New appointment, opened over whatever page you are on (create in place).
 * Calendar → day → free time → who → (deal) → note → confirmation. One
 * question per block, the free times are the calendar's own.
 */
export function AppointmentDialog({
  open,
  onOpenChange,
  prefill,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: AppointmentPrefill;
  onCreated?: (appointment: Appointment) => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidateAppointments();
  const calendarsQuery = useAppointmentCalendars(open);
  const calendars = useMemo(
    () => (calendarsQuery.data ?? []).filter((c) => c.status === "active" || c.id === prefill?.calendarId),
    [calendarsQuery.data, prefill?.calendarId],
  );
  const [calendarId, setCalendarId] = useState(prefill?.calendarId ?? "");
  useEffect(() => {
    if (calendarId || calendars.length === 0) return;
    setCalendarId((calendars.find((c) => c.is_default) ?? calendars[0]).id);
  }, [calendars, calendarId]);
  const calendar = calendars.find((c) => c.id === calendarId) ?? null;

  const [day, setDay] = useState(() =>
    prefill?.startsAt ? format(new Date(prefill.startsAt), "yyyy-MM-dd") : format(addDays(new Date(), 1), "yyyy-MM-dd"),
  );
  const [time, setTime] = useState<PickedTime | null>(null);
  // Open on the first day that has a free time, not on a closed Sunday —
  // until the person picks a day themselves.
  const [dayPicked, setDayPicked] = useState(!!prefill?.startsAt);
  useEffect(() => {
    if (!open || dayPicked || !calendar) return;
    let cancelled = false;
    const from = format(new Date(), "yyyy-MM-dd");
    const to = format(addDays(new Date(), 30), "yyyy-MM-dd");
    getCalendarDays(calendar.id, from, to)
      .then((res) => {
        const first = res.days.find((d) => d.state === "open" && d.free > 0);
        if (!cancelled && first) setDay(first.date);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, dayPicked, calendar?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // From the calendar grid: the clicked time is the pick, on or off the grid.
  useEffect(() => {
    if (!prefill?.startsAt || !calendar || time) return;
    const start = new Date(prefill.startsAt);
    if (prefill.dayOnly) {
      setDay(format(start, "yyyy-MM-dd"));
      return;
    }
    setDay(dayOf(prefill.startsAt, calendar.timezone));
    setTime({
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + calendar.duration_minutes * 60_000).toISOString(),
      override: true,
    });
  }, [prefill?.startsAt, calendar]); // eslint-disable-line react-hooks/exhaustive-deps

  const lockedPerson = !!prefill?.contact || !!prefill?.leadId;
  const [contact, setContact] = useState<PickedEntity | null>(prefill?.contact ?? null);
  const [newPerson, setNewPerson] = useState(!lockedPerson && !!prefill?.customerName);
  const [name, setName] = useState(prefill?.customerName ?? "");
  const [email, setEmail] = useState(prefill?.customerEmail ?? "");
  const [phone, setPhone] = useState(prefill?.customerPhone ?? "");
  const [deal, setDeal] = useState<PickedEntity | null>(prefill?.deal ?? null);
  const [notes, setNotes] = useState("");
  const [notify, setNotify] = useState(true);
  const [confirmOverride, setConfirmOverride] = useState(false);

  const recipient = (newPerson || !contact ? email : contact?.email ?? email).trim();
  const canNotify = !!calendar?.customer_messages.confirmation && !!recipient;

  // The customer's language. Known from their card (or the inquiry's form)
  // it is shown and can be changed; unknown, the calendar's language is
  // offered to check; with neither, it has to be picked before an email goes.
  const contactLocaleQuery = useQuery({
    queryKey: ["contact-locale", contact?.id],
    queryFn: async () => {
      const detail = await getContact(contact!.id);
      return (detail.contact?.locale as string | null | undefined) ?? null;
    },
    enabled: open && !!contact && contact.locale === undefined,
    staleTime: 60_000,
  });
  const contactLocale = contact ? (contact.locale !== undefined ? contact.locale : contactLocaleQuery.data) : undefined;
  const knownLocale: FormLocale | null = isCustomerLocale(contactLocale)
    ? contactLocale
    : !contact && isCustomerLocale(prefill?.customerLocale)
      ? prefill.customerLocale
      : null;
  const calendarLocale = calendar?.default_locale ?? null;
  const [pickedLocale, setPickedLocale] = useState<FormLocale | null | undefined>(undefined);
  useEffect(() => setPickedLocale(undefined), [contact?.id]);
  const locale = pickedLocale !== undefined ? pickedLocale : (knownLocale ?? calendarLocale);
  const localeFrom: "picked" | "known" | "calendar" | "none" =
    pickedLocale !== undefined ? "picked" : knownLocale ? "known" : calendarLocale ? "calendar" : "none";
  const willEmail = canNotify && notify;
  const localeMissing = willEmail && !locale;

  const create = useMutation({
    mutationFn: async (override: boolean) => {
      if (!calendar || !time) throw new Error(t("appointmentBook.form.pickTime", "Pick a time first."));
      let contactId = contact?.kind === "company" ? null : contact?.id ?? null;
      const companyId = contact?.kind === "company" ? contact.id : null;
      // A person typed in for the first time joins your customers, so the
      // visit shows on their page and the next one is one tap away.
      if (!contactId && !companyId && newPerson && name.trim()) {
        const [first, ...rest] = name.trim().split(/\s+/);
        try {
          const created = await createContact({
            first_name: first,
            last_name: rest.join(" ") || null,
            email: email.trim() || null,
            phone: phone.trim() || null,
            locale: locale ?? null,
          });
          contactId = created.id;
        } catch {
          // Already a customer with that address, or no right to add one: the
          // appointment still keeps the name and address it was booked with.
        }
      }
      return createAppointment({
        calendar_id: calendar.id,
        starts_at: time.starts_at,
        ends_at: time.ends_at,
        override: override || time.override,
        contact_id: contactId,
        company_id: companyId,
        deal_id: deal?.id ?? null,
        lead_id: prefill?.leadId ?? null,
        customer_name: newPerson ? name.trim() || null : null,
        customer_email: (newPerson || !contact) && email.trim() ? email.trim() : null,
        customer_phone: (newPerson || !contact) && phone.trim() ? phone.trim() : null,
        customer_locale: locale ?? null,
        notes: notes.trim() || null,
        notify_customer: canNotify && notify,
      });
    },
    onSuccess: (appt) => {
      invalidate();
      toast.success(t("appointmentBook.toast.booked", "Appointment booked"), {
        description: `${longDate(appt.starts_at, appt.timezone, i18n.language)}${appt.all_day ? "" : `, ${timeOf(appt.starts_at, appt.timezone, i18n.language)}`}`,
        action: { label: t("common.view", "View"), onClick: () => navigate(`/appointments/${appt.id}`) },
      });
      onCreated?.(appt);
      onOpenChange(false);
    },
    onError: (e) => {
      if (isAxiosError(e) && e.response?.status === 409 && (e.response.data as { code?: string })?.code === "SLOT_TAKEN") {
        setConfirmOverride(true);
        return;
      }
      toast.error(extractErrorMessage(e));
    },
  });

  const hasWho = !!contact || !!prefill?.leadId || (newPerson && !!name.trim()) || !!email.trim();
  const ready = !!calendar && !!time && hasWho && !localeMissing;
  const pickedPerson = !newPerson ? (contact ?? prefill?.contact ?? null) : null;
  const infoEmail = pickedPerson?.email ?? (lockedPerson ? prefill?.customerEmail : null) ?? null;
  const infoPhone = pickedPerson?.phone ?? (lockedPerson ? prefill?.customerPhone : null) ?? null;

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("appointmentBook.form.title", "New appointment")}
      footer={
        confirmOverride ? (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <p className="text-[13px] text-muted-foreground sm:mr-auto">
              {t("appointmentBook.form.notFree", "That time is not free in this calendar.")}
            </p>
            <Button variant="outline" onClick={() => setConfirmOverride(false)} className="max-sm:h-11">
              {t("appointmentBook.form.pickAnother", "Pick another time")}
            </Button>
            <Button onClick={() => create.mutate(true)} disabled={create.isPending} className="max-sm:h-11">
              {t("appointmentBook.form.bookAnyway", "Book anyway")}
            </Button>
          </div>
        ) : (
          <Button
            className="w-full sm:w-auto max-sm:h-11"
            disabled={!ready || create.isPending}
            onClick={() => create.mutate(false)}
          >
            {create.isPending ? t("common.saving", "Saving…") : t("appointmentBook.form.book", "Book appointment")}
          </Button>
        )
      }
    >
      <div className="space-y-5">
        {calendars.length > 1 ? (
          <div className="space-y-1.5">
            <p className="text-[12.5px] font-medium text-muted-foreground">{t("appointmentBook.form.calendar", "Calendar")}</p>
            <Select
              value={calendarId}
              onValueChange={(v) => {
                setCalendarId(v);
                setTime(null);
              }}
            >
              <SelectTrigger className="h-10 w-full max-sm:h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {calendars.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="inline-flex items-center gap-2">
                      <CalendarDot color={c.color} />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {calendar ? (
          <SlotPicker
            calendar={calendar}
            day={day}
            onDayChange={(next) => {
              setDayPicked(true);
              setDay(next);
            }}
            value={time}
            onChange={setTime}
          />
        ) : (
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        )}

        <div className="space-y-1.5">
          <p className="text-[12.5px] font-medium text-muted-foreground">{t("appointmentBook.form.with", "With")}</p>
          {lockedPerson ? (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-[14px] font-medium text-foreground">
              {prefill?.contact?.label ?? prefill?.leadLabel ?? t("appointmentBook.someone", "Someone")}
            </p>
          ) : null}
          {lockedPerson ? null : newPerson ? (
            <div className="space-y-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("appointmentBook.form.name", "Name")}
                className="h-10 max-sm:h-11"
                autoComplete="off"
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("appointmentBook.form.email", "Email")}
                  className="h-10 max-sm:h-11"
                  autoComplete="off"
                />
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("appointmentBook.form.phone", "Phone")}
                  className="h-10 max-sm:h-11"
                  autoComplete="off"
                />
              </div>
              <button
                type="button"
                onClick={() => setNewPerson(false)}
                className="text-[13px] font-medium underline underline-offset-4 hover:no-underline"
              >
                {t("appointmentBook.form.pickExisting", "Pick from your customers")}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <EntityPicker
                type="contact"
                value={contact}
                onChange={setContact}
                placeholder={t("appointmentBook.form.searchCustomer", "Search your customers…")}
              />
              <button
                type="button"
                onClick={() => {
                  setNewPerson(true);
                  setContact(null);
                }}
                className="text-[13px] font-medium underline underline-offset-4 hover:no-underline"
              >
                {t("appointmentBook.form.someoneNew", "Someone new")}
              </button>
            </div>
          )}
          {(lockedPerson || contact) && (infoEmail || infoPhone || knownLocale) ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-muted/40 px-3 py-2 text-[13px]">
              {infoEmail ? (
                <>
                  <dt className="text-muted-foreground">{t("appointmentBook.form.email", "Email")}</dt>
                  <dd className="truncate">{infoEmail}</dd>
                </>
              ) : null}
              {infoPhone ? (
                <>
                  <dt className="text-muted-foreground">{t("appointmentBook.form.phone", "Phone")}</dt>
                  <dd className="truncate">{infoPhone}</dd>
                </>
              ) : null}
              {knownLocale ? (
                <>
                  <dt className="text-muted-foreground">{t("appointmentBook.language.short", "Language")}</dt>
                  <dd>{LANGUAGE_NAMES[knownLocale]}</dd>
                </>
              ) : null}
            </dl>
          ) : null}
        </div>

        {hasWho ? (
          <div className="space-y-1.5">
            <label htmlFor="appt-customer-language" className="block text-[12.5px] font-medium text-muted-foreground">
              {t("appointmentBook.language.label", "Language for their emails")}
            </label>
            <CustomerLanguageSelect
              id="appt-customer-language"
              value={locale}
              onChange={(v) => {
                setPickedLocale(v);
                // Only a customer with a card gets it written there.
                const cardOwner = !newPerson ? (contact ?? prefill?.contact ?? null) : null;
                const cardLocale = isCustomerLocale(contactLocale) ? contactLocale : null;
                if (v && cardOwner && v !== cardLocale) announceCardLanguage(t, cardOwner.label, v);
              }}
              invalid={localeMissing}
            />
            {localeFrom === "calendar" ? (
              <p className="rounded-md bg-secondary/25 px-2 py-1 text-[12.5px] text-foreground">
                {t(
                  "appointmentBook.language.fromCalendar",
                  "We don't know this customer's language yet, so it's set to the calendar's. Change it if they speak another one.",
                )}
              </p>
            ) : localeMissing ? (
              <p className="rounded-md bg-secondary/25 px-2 py-1 text-[12.5px] text-foreground">
                {t("appointmentBook.language.required", "Pick the language this customer should get their emails in.")}
              </p>
            ) : localeFrom === "picked" && contact && locale !== (isCustomerLocale(contactLocale) ? contactLocale : null) ? (
              <p className="text-[12.5px] text-muted-foreground">
                {t("appointmentBook.language.savedOnCard2", "We'll update it on their customer card.")}
              </p>
            ) : null}
          </div>
        ) : null}

        {!prefill?.deal ? (
          <div className="space-y-1.5">
            <p className="text-[12.5px] font-medium text-muted-foreground">
              {t("appointmentBook.form.dealOptional", "Deal (optional)")}
            </p>
            <EntityPicker
              type="deal"
              value={deal}
              onChange={setDeal}
              placeholder={t("appointmentBook.form.searchDeal", "Search deals…")}
            />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <p className="text-[12.5px] font-medium text-muted-foreground">{t("appointmentBook.form.note", "Note")}</p>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder={t("appointmentBook.form.notePlaceholder", "What is it about?")}
          />
        </div>

        {canNotify ? (
          <div className="space-y-2">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px]">
              <Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} />
              <span>
                {t("appointmentBook.form.sendConfirmation", "Send a confirmation to {{email}}", { email: recipient })}
              </span>
            </label>
            {notify && calendar?.sender ? <SenderNotice sender={calendar.sender} compact /> : null}
          </div>
        ) : null}
      </div>
    </BottomSheet>
  );
}
