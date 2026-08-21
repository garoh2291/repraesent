import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import moment from "moment-timezone";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  calendarKeyFor,
  createCalendarEvent,
  type BaikalConfig,
  type CalendarAccount,
} from "~/lib/api/calendar";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { CalDavIcon } from "~/components/icons/CalDavIcon";
import { GoogleIcon } from "~/components/icons/GoogleIcon";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";

/**
 * Good enough for a client-side hint — the server (and Google) re-validate,
 * so this only needs to catch obvious typos, not parse RFC 5322.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "a@b.com, c@d.com" → ["a@b.com", "c@d.com"], ignoring stray commas. */
function parseGuests(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function createEventSchema(t: (key: string) => string) {
  return z
    .object({
      targetKey: z.string().min(1, t("calendar.create.required")),
      title: z
        .string()
        .trim()
        .min(1, t("calendar.create.required"))
        .max(300, t("calendar.create.required")),
      date: z.string().min(1, t("calendar.create.required")),
      startTime: z.string().min(1, t("calendar.create.required")),
      endTime: z.string().min(1, t("calendar.create.required")),
      guests: z.string(),
      withMeet: z.boolean(),
      description: z.string().optional(),
    })
    .superRefine((values, ctx) => {
      // "HH:mm" compares correctly as a string — no date math needed here
      if (values.startTime && values.endTime && values.endTime <= values.startTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endTime"],
          message: t("calendar.create.invalidTimes"),
        });
      }
      if (!parseGuests(values.guests).every((g) => EMAIL_RE.test(g))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["guests"],
          message: t("calendar.create.invalidGuests"),
        });
      }
    });
}

type CreateEventFormValues = z.infer<ReturnType<typeof createEventSchema>>;

/** A calendar the current user can actually create events on. */
interface WritableCalendarOption {
  key: string;
  summary: string;
  accountEmail: string;
}

/**
 * Owns its form and mutation so the calendar page only wires open state and a
 * refetch callback. Guests and the meeting-link switch only exist for Google
 * and Microsoft targets — the server rejects both on Baikal and CalDAV, so the
 * form hides them rather than letting the user fill in fields that would 400.
 */
export function CreateEventDialog({
  open,
  onOpenChange,
  accounts,
  baikalConfigs,
  timezone,
  defaultDate,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: CalendarAccount[];
  baikalConfigs: BaikalConfig[];
  /** The page's display timezone — entered times are wall clock in this zone. */
  timezone: string;
  /** The date the calendar is currently showing; seeds the date field. */
  defaultDate?: Date;
  onCreated: () => void;
}) {
  const { t } = useTranslation();

  // Server rule: google targets = own accounts, writable calendars only
  const googleOptions = useMemo<WritableCalendarOption[]>(() => {
    const options: WritableCalendarOption[] = [];
    for (const account of accounts) {
      if (account.provider !== "google" || !account.is_own) continue;
      for (const cal of account.calendars) {
        if (cal.accessRole !== "owner" && cal.accessRole !== "writer") continue;
        options.push({
          key: calendarKeyFor(account, cal.id),
          summary: cal.summary,
          accountEmail: account.google_email,
        });
      }
    }
    return options;
  }, [accounts]);

  // CalDAV targets: own accounts too — Basic auth credentials are personal.
  // No accessRole filter; the credentials expose only the owner's calendars.
  const caldavOptions = useMemo<WritableCalendarOption[]>(() => {
    const options: WritableCalendarOption[] = [];
    for (const account of accounts) {
      if (account.provider !== "caldav" || !account.is_own) continue;
      for (const cal of account.calendars) {
        options.push({
          key: calendarKeyFor(account, cal.id),
          summary: cal.summary,
          // For caldav rows google_email carries the username.
          accountEmail: account.display_name || account.google_email,
        });
      }
    }
    return options;
  }, [accounts]);

  const schema = useMemo(() => createEventSchema(t), [t]);

  const defaultValues = useMemo<CreateEventFormValues>(
    () => ({
      targetKey:
        googleOptions[0]?.key ??
        caldavOptions[0]?.key ??
        (baikalConfigs[0] ? `baikal:${baikalConfigs[0].id}` : ""),
      title: "",
      date: moment.tz(defaultDate ?? new Date(), timezone).format("YYYY-MM-DD"),
      startTime: "",
      endTime: "",
      guests: "",
      withMeet: true,
      description: "",
    }),
    [googleOptions, caldavOptions, baikalConfigs, defaultDate, timezone],
  );

  const form = useForm<CreateEventFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  // Re-seed each time the dialog opens: the calendar date or the connected
  // sources may have changed since the last visit.
  useEffect(() => {
    if (open) form.reset(defaultValues);
  }, [open, defaultValues, form]);

  const targetKey = form.watch("targetKey");
  const isMicrosoftTarget = targetKey.startsWith("microsoft:");
  const supportsGuestsAndMeeting =
    targetKey.startsWith("google:") || isMicrosoftTarget;

  const mutation = useMutation({
    mutationFn: createCalendarEvent,
    onSuccess: () => {
      toast.success(t("calendar.create.created"));
      onOpenChange(false);
      form.reset(defaultValues);
      onCreated();
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error));
    },
  });
  const pending = mutation.isPending;

  const onSubmit = (values: CreateEventFormValues) => {
    const supportsExtras =
      values.targetKey.startsWith("google:") ||
      values.targetKey.startsWith("microsoft:");
    const guests = supportsExtras ? parseGuests(values.guests) : [];
    mutation.mutate({
      targetKey: values.targetKey,
      title: values.title.trim(),
      description: values.description?.trim() || undefined,
      startISO: moment
        .tz(`${values.date} ${values.startTime}`, "YYYY-MM-DD HH:mm", timezone)
        .toISOString(),
      endISO: moment
        .tz(`${values.date} ${values.endTime}`, "YYYY-MM-DD HH:mm", timezone)
        .toISOString(),
      timezone,
      guests: guests.length > 0 ? guests : undefined,
      // Wire field stays `withMeet` for both providers; the server creates a
      // Teams meeting for microsoft: targets.
      withMeet: supportsExtras ? values.withMeet : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Same cap-and-scroll as the SMTP dialog: on a phone the fields would
          push the footer below the fold with no way to reach Create. */}
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-4 w-4" />
            {t("calendar.create.title")}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            id="create-event-form"
          >
            <FormField
              control={form.control}
              name="targetKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("calendar.create.target")}</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={pending}
                  >
                    <FormControl>
                      {/* The base trigger is `w-fit`, which would leave this
                          select narrower than every other field. */}
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {googleOptions.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>
                            {t("calendar.create.myCalendarsGroup")}
                          </SelectLabel>
                          {googleOptions.map((option) => (
                            <SelectItem key={option.key} value={option.key}>
                              {/* Provider marker — colours alone can't tell a
                                  Google calendar from a same-coloured CalDAV
                                  one. */}
                              <GoogleIcon className="h-3 w-3 shrink-0" />
                              <span className="truncate">{option.summary}</span>
                              <span className="truncate text-xs text-muted-foreground">
                                {option.accountEmail}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {caldavOptions.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>
                            {t("calendar.targetGroup.caldav")}
                          </SelectLabel>
                          {caldavOptions.map((option) => (
                            <SelectItem key={option.key} value={option.key}>
                              <CalDavIcon className="h-3 w-3 shrink-0" />
                              <span className="truncate">{option.summary}</span>
                              <span className="truncate text-xs text-muted-foreground">
                                {option.accountEmail}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {baikalConfigs.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>
                            {t("calendar.create.bookingGroup")}
                          </SelectLabel>
                          {baikalConfigs.map((config) => (
                            <SelectItem
                              key={config.id}
                              value={`baikal:${config.id}`}
                            >
                              {/* Baikal is CalDAV under the hood. */}
                              <CalDavIcon className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {config.provider_name ?? config.user_name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("calendar.create.eventTitle")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      maxLength={300}
                      autoComplete="off"
                      disabled={pending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("calendar.create.date")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" disabled={pending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("calendar.create.startTime")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="time"
                        step={900}
                        disabled={pending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("calendar.create.endTime")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="time"
                        step={900}
                        disabled={pending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {supportsGuestsAndMeeting && (
              <>
                <FormField
                  control={form.control}
                  name="guests"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("calendar.create.guests")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="anna@company.com, ben@company.com"
                          autoComplete="off"
                          disabled={pending}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        {t("calendar.create.guestsHint")}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="withMeet"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border px-3 py-2.5">
                      <FormLabel className="font-normal">
                        {t(
                          isMicrosoftTarget
                            ? "calendar.create.addTeams"
                            : "calendar.create.addMeet",
                        )}
                      </FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={pending}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </>
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("calendar.create.description")}</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} disabled={pending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="create-event-form"
            disabled={pending}
            className="bg-foreground text-background hover:bg-foreground/90 hover:text-background"
          >
            {pending
              ? t("calendar.create.creating")
              : t("calendar.create.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
