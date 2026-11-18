import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Link2, Plus } from "lucide-react";
import { cn } from "~/lib/utils";
import { buildPublicFormUrl } from "~/lib/config";
import { useAuthContext } from "~/providers/auth-provider";
import { createBookingPage, getBookingPages, type FormRecord } from "~/lib/api/forms";
import type { AppointmentCalendar } from "~/lib/api/appointment-book";
import { FORM_LOCALES, type FormLocale } from "~/lib/forms/schema";
import { Panel } from "~/components/notebook/panel";
import { BottomSheet } from "~/components/notebook/bottom-sheet";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { CalendarDot } from "./appointment-bits";

/**
 * A booking page is a link the owner sends to customers: what to book, when,
 * and who they are. Underneath it is an ordinary form, so an inquiry from it
 * says "Form · <name>" and everything about it can be changed in the form
 * builder later. This file only makes one and lists the ones that exist.
 */

function bookingPagesKey(workspaceId: string | undefined, calendarId: string) {
  return ["booking-pages", workspaceId, calendarId] as const;
}

function lengthOf(c: AppointmentCalendar, t: (k: string, d: string, o?: Record<string, unknown>) => string) {
  return c.booking_unit === "day"
    ? t("appointmentBook.wholeDay", "Whole day")
    : t("appointmentBook.settings.minutes", "{{count}} min", { count: c.duration_minutes });
}

/** The link, with the one thing people do with it. */
function CopyLink({ url }: { url: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        toast.success(t("appointmentBook.bookingPage.copied", "Link copied"));
        window.setTimeout(() => setCopied(false), 2000);
      },
      () => undefined,
    );
  };
  return (
    <div className="flex items-stretch gap-2">
      <Input
        readOnly
        value={url}
        aria-label={t("appointmentBook.bookingPage.copyLink", "Copy link")}
        className="min-w-0 flex-1 font-mono text-[13px] max-sm:h-11"
        onFocus={(e) => e.currentTarget.select()}
      />
      <Button type="button" className="shrink-0 gap-1.5 max-sm:h-11" onClick={copy}>
        {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        <span className="max-sm:sr-only">
          {copied
            ? t("appointmentBook.bookingPage.copied", "Link copied")
            : t("appointmentBook.bookingPage.copyLink", "Copy link")}
        </span>
      </Button>
    </div>
  );
}

export function BookingPageSheet({
  calendars,
  preselectId,
  onOpenChange,
}: {
  calendars: AppointmentCalendar[];
  /** The calendar the sheet was opened from, ticked to start with. */
  preselectId?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const usable = calendars.filter((c) => c.status === "active" || c.id === preselectId);
  const first = usable.find((c) => c.id === preselectId) ?? (usable.length === 1 ? usable[0] : undefined);
  // In the order ticked: that is the order customers see.
  const [picked, setPicked] = useState<string[]>(first ? [first.id] : []);
  const [name, setName] = useState("");
  const appLocale = i18n.language?.slice(0, 2) as FormLocale;
  const [locale, setLocale] = useState<FormLocale>(
    first?.default_locale ?? (FORM_LOCALES.includes(appLocale) ? appLocale : "de"),
  );
  const [made, setMade] = useState<FormRecord | null>(null);

  const create = useMutation({
    mutationFn: () =>
      createBookingPage({
        calendar_ids: picked,
        ...(name.trim() ? { name: name.trim() } : {}),
        default_locale: locale,
      }),
    onSuccess: (form) => {
      setMade(form);
      void queryClient.invalidateQueries({ queryKey: ["forms"] });
      void queryClient.invalidateQueries({ queryKey: ["booking-pages"] });
    },
    onError: () => toast.error(t("appointmentBook.bookingPage.failed", "The page could not be created. Try again in a moment.")),
  });

  if (made) {
    const live = made.status === "published";
    return (
      <BottomSheet
        open
        onOpenChange={onOpenChange}
        title={
          live
            ? t("appointmentBook.bookingPage.readyTitle", "Your booking page is live")
            : t("appointmentBook.bookingPage.draftTitle", "The page is created, but not live yet")
        }
        description={
          live
            ? t("appointmentBook.bookingPage.readyBody", "Send this link to your customers. Every booking arrives as an inquiry with its appointment.")
            : t("appointmentBook.bookingPage.draftBody", "Something is still missing. Open it to see what, then put it online.")
        }
        footer={
          <Button className="w-full sm:w-auto max-sm:h-11" onClick={() => onOpenChange(false)}>
            {t("appointmentBook.bookingPage.done", "Done")}
          </Button>
        }
      >
        <div className="space-y-4">
          {live ? <CopyLink url={buildPublicFormUrl(made.id)} /> : null}
          <div className="flex flex-wrap gap-2">
            {live ? (
              <Button asChild variant="outline" className="gap-1.5 max-sm:h-11 max-sm:flex-1">
                <a href={buildPublicFormUrl(made.id)} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" aria-hidden />
                  {t("appointmentBook.bookingPage.open", "Open page")}
                </a>
              </Button>
            ) : null}
            <Button asChild variant={live ? "ghost" : "default"} className="max-sm:h-11 max-sm:flex-1">
              <Link to={`/forms/${made.id}`}>
                {t("appointmentBook.bookingPage.edit", "Change questions, wording or look")}
              </Link>
            </Button>
          </div>
        </div>
      </BottomSheet>
    );
  }

  const toggle = (id: string) =>
    setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  return (
    <BottomSheet
      open
      onOpenChange={onOpenChange}
      title={t("appointmentBook.bookingPage.title", "A page your customers book on")}
      description={t(
        "appointmentBook.bookingPage.intro",
        "Pick what people can book. You get a link to send by email, WhatsApp or text message.",
      )}
      footer={
        <Button
          className="w-full sm:w-auto max-sm:h-11"
          disabled={picked.length === 0 || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending
            ? t("appointmentBook.bookingPage.creating", "Creating…")
            : t("appointmentBook.bookingPage.createButton", "Create page")}
        </Button>
      }
    >
      {usable.length === 0 ? (
        <p className="text-[14px] leading-relaxed text-muted-foreground">
          {t("appointmentBook.bookingPage.noCalendars", "Set up a calendar first. Then you can create its booking page here.")}
        </p>
      ) : (
        <div className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">
              {t("appointmentBook.bookingPage.pickCalendars", "What can people book?")}
            </legend>
            <div className="space-y-1.5">
              {usable.map((c) => {
                const on = picked.includes(c.id);
                const order = picked.indexOf(c.id) + 1;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(c.id)}
                    className={cn(
                      "press flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25",
                      on ? "border-foreground bg-card" : "border-border hover:border-foreground/40",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "num flex size-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold",
                        on ? "border-foreground bg-foreground text-background" : "border-border",
                      )}
                    >
                      {on ? (picked.length > 1 ? order : <Check className="size-3.5" />) : null}
                    </span>
                    <CalendarDot color={c.color} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-foreground">{c.name}</span>
                      <span className="block text-[12.5px] text-muted-foreground">
                        {lengthOf(c, t as never)}
                        {c.status === "disabled" ? ` · ${t("appointmentBook.calendars.off", "Turned off")}` : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {picked.length === 0
                ? t("appointmentBook.bookingPage.needCalendar", "Pick at least one calendar.")
                : picked.length > 1
                  ? t("appointmentBook.bookingPage.pickHint", "With more than one, people first choose what they want.")
                  : null}
            </p>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="bp-name">{t("appointmentBook.bookingPage.nameLabel", "Name of the page")}</Label>
            <Input
              id="bp-name"
              value={name}
              maxLength={120}
              className="max-sm:h-11"
              placeholder={t("appointmentBook.bookingPage.namePlaceholder", "e.g. Book an appointment")}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("appointmentBook.bookingPage.nameHint", "Inquiries from this page show this name as where they came from.")}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bp-locale">{t("appointmentBook.bookingPage.language", "Language of the page")}</Label>
            <Select value={locale} onValueChange={(v) => setLocale(v as FormLocale)}>
              <SelectTrigger id="bp-locale" className="w-full max-sm:h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORM_LOCALES.map((l) => (
                  <SelectItem key={l} value={l}>
                    {t(`settings.language.${l}`, l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("appointmentBook.bookingPage.languageHint", "You can add more languages later.")}
            </p>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

/** On a calendar's page: where people can book into it, and the way to add one. */
export function BookingPagesPanel({
  calendar,
  calendars,
}: {
  calendar: AppointmentCalendar;
  calendars: AppointmentCalendar[];
}) {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const [creating, setCreating] = useState(false);
  const pages = useQuery({
    queryKey: bookingPagesKey(currentWorkspace?.id, calendar.id),
    queryFn: () => getBookingPages(calendar.id),
    enabled: !!currentWorkspace,
  });
  const list = pages.data ?? [];

  return (
    <Panel className="space-y-3 px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-[16px] font-semibold text-foreground">
            {t("appointmentBook.bookingPage.listTitle", "Booking pages")}
          </h2>
          <p className="text-[13px] text-muted-foreground">
            {t("appointmentBook.bookingPage.listHint", "Pages and forms on which people can book into this calendar.")}
          </p>
        </div>
        <Button size="sm" variant="outline" className="h-9 gap-1.5 max-sm:h-11 max-sm:w-full" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" aria-hidden />
          {t("appointmentBook.bookingPage.create", "Create booking page")}
        </Button>
      </div>

      {calendar.status === "disabled" && list.length > 0 ? (
        <p className="text-[13px] text-overdue">
          {t("appointmentBook.bookingPage.calendarOff", "Turned off: its times are not offered.")}
        </p>
      ) : null}

      {pages.isLoading ? (
        <div className="h-14 animate-pulse rounded-lg bg-muted" />
      ) : list.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          {t("appointmentBook.bookingPage.listEmpty", "No page books into this calendar yet.")}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {list.map((form) => {
            const live = form.status === "published";
            return (
              <li key={form.id} className="space-y-2 px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <Link
                    to={`/forms/${form.id}`}
                    className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {form.name}
                  </Link>
                  {live ? null : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11.5px] font-medium text-muted-foreground">
                      {t("appointmentBook.bookingPage.notLive", "Not online")}
                    </span>
                  )}
                </div>
                {live ? <CopyLink url={buildPublicFormUrl(form.id)} /> : null}
              </li>
            );
          })}
        </ul>
      )}

      {creating ? (
        <BookingPageSheet calendars={calendars} preselectId={calendar.id} onOpenChange={setCreating} />
      ) : null}
    </Panel>
  );
}
