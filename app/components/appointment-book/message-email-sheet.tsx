import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronDown, Loader2, Pencil, RotateCcw, Send } from "lucide-react";
import { cn } from "~/lib/utils";
import { useAuthContext } from "~/providers/auth-provider";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  appointmentKeys,
  getMessageDefaults,
  MESSAGE_LOCALES,
  previewCalendarMessage,
  sendTestCalendarMessage,
  type CustomerMessageCopy,
  type CustomerMessageCopyMap,
  type CustomerMessageKind,
  type MessageLocale,
} from "~/lib/api/appointment-book";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "~/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";
import { Segmented } from "~/components/notebook/segmented";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";

type FieldKey = keyof CustomerMessageCopy;

/** The words the owner can drop in, by the name they know them by. */
const PLACEHOLDERS: Array<{ token: string; key: string; fallback: string }> = [
  { token: "{name}", key: "appointmentBook.mail.ph.name", fallback: "Customer's first name" },
  { token: "{date}", key: "appointmentBook.mail.ph.date", fallback: "Date" },
  { token: "{time}", key: "appointmentBook.mail.ph.time", fallback: "Time" },
  { token: "{place}", key: "appointmentBook.mail.ph.place", fallback: "Place" },
  { token: "{business}", key: "appointmentBook.mail.ph.business", fallback: "Your business name" },
];

const sameCopy = (a: CustomerMessageCopy | undefined, b: CustomerMessageCopy | undefined) =>
  !!a && !!b && a.subject === b.subject && a.title === b.title && a.lead === b.lead;

/** Drop one kind+locale from the map, and any level left empty. */
function withoutLocale(copy: CustomerMessageCopyMap | undefined, kind: CustomerMessageKind, locale: MessageLocale): CustomerMessageCopyMap {
  const next: CustomerMessageCopyMap = { ...(copy ?? {}) };
  const forKind = { ...(next[kind] ?? {}) };
  delete forKind[locale];
  if (Object.keys(forKind).length === 0) delete next[kind];
  else next[kind] = forKind;
  return next;
}

/**
 * "See the email": one customer message, as the customer gets it. Preview
 * first; "Change the text" opens three plain fields. Edits go into the
 * calendar draft, so the page's own Save keeps them (or Discard drops them).
 */
export function MessageEmailSheet({
  open,
  onOpenChange,
  calendarId,
  kinds,
  title,
  copy,
  onCopyChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string;
  /** One kind, or two shown as tabs (moved / cancelled). */
  kinds: CustomerMessageKind[];
  title: string;
  copy: CustomerMessageCopyMap | undefined;
  onCopyChange: (next: CustomerMessageCopyMap) => void;
}) {
  const { t, i18n } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const uiLocale = (MESSAGE_LOCALES as readonly string[]).includes(i18n.language?.slice(0, 2))
    ? (i18n.language.slice(0, 2) as MessageLocale)
    : "en";
  const [kind, setKind] = useState<CustomerMessageKind>(kinds[0]);
  const [locale, setLocale] = useState<MessageLocale>(uiLocale);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (open) {
      setKind(kinds[0]);
      setLocale(uiLocale);
      setEditing(false);
    }
    // Reset only when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const defaults = useQuery({
    queryKey: appointmentKeys.messageDefaults(currentWorkspace?.id, calendarId),
    queryFn: () => getMessageDefaults(calendarId),
    enabled: open,
    staleTime: Infinity,
  });
  const ours = defaults.data?.copy?.[kind]?.[locale];
  const own = copy?.[kind]?.[locale];
  const current: CustomerMessageCopy | undefined = own ?? ours;

  // The preview always sends the words on screen, so an unsaved "back to our
  // text" shows our text, not what is still saved.
  const words = useDebounce(current ? JSON.stringify(current) : "", 400);
  const preview = useQuery({
    queryKey: appointmentKeys.messagePreview(currentWorkspace?.id, calendarId, kind, locale, words),
    queryFn: () => previewCalendarMessage(calendarId, { kind, locale, copy: JSON.parse(words) as CustomerMessageCopy }),
    enabled: open && !!words,
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  const test = useMutation({
    mutationFn: () => sendTestCalendarMessage(calendarId, { kind, locale, ...(current ? { copy: current } : {}) }),
    onSuccess: (r) => toast.success(t("appointmentBook.mail.testSent", "Test sent to {{email}}", { email: r.sent_to })),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });

  const setField = (field: FieldKey, value: string) => {
    if (!current) return;
    const nextWords = { ...current, [field]: value };
    // Typing our own words back in = our text again.
    if (sameCopy(nextWords, ours)) {
      onCopyChange(withoutLocale(copy, kind, locale));
      return;
    }
    onCopyChange({ ...(copy ?? {}), [kind]: { ...(copy?.[kind] ?? {}), [locale]: nextWords } });
  };

  const refs = {
    subject: useRef<HTMLInputElement | null>(null),
    title: useRef<HTMLInputElement | null>(null),
    lead: useRef<HTMLTextAreaElement | null>(null),
  };
  const lastField = useRef<FieldKey>("lead");
  const insert = (token: string) => {
    if (!current) return;
    const field = lastField.current;
    const el = refs[field].current;
    const value = current[field] ?? "";
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? start;
    setField(field, value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const kindLabel = (k: CustomerMessageKind) =>
    ({
      confirmation: t("appointmentBook.mail.kind.confirmation", "Confirmation"),
      reminder: t("appointmentBook.mail.kind.reminder", "Reminder"),
      changed: t("appointmentBook.mail.kind.changed", "When it moves"),
      cancelled: t("appointmentBook.mail.kind.cancelled", "When it's cancelled"),
    })[k];

  const ownLocales = useMemo(() => new Set(Object.keys(copy?.[kind] ?? {})), [copy, kind]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-none gap-0 bg-card p-0 sm:max-w-[640px]">
        <div className="border-b border-border px-5 pb-4 pt-5 pr-14 sm:px-6">
          <SheetTitle className="title-display text-[22px] font-semibold leading-tight text-foreground">{title}</SheetTitle>
          <SheetDescription className="mt-1 text-[13.5px] leading-snug text-muted-foreground">
            {t("appointmentBook.mail.sheetHint", "This is what your customer gets. The date, time and place are filled in for each booking.")}
          </SheetDescription>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {kinds.length > 1 ? (
              <Segmented
                label={t("appointmentBook.mail.whichEmail", "Which email")}
                role="tablist"
                value={kind}
                onChange={setKind}
                options={kinds.map((k) => ({ value: k, label: kindLabel(k) }))}
              />
            ) : null}
            <Segmented
              label={t("appointmentBook.mail.language", "Language")}
              role="tablist"
              value={locale}
              onChange={setLocale}
              options={MESSAGE_LOCALES.map((l) => ({
                value: l,
                label: (
                  <span className="inline-flex items-center gap-1">
                    {l.toUpperCase()}
                    {ownLocales.has(l) ? <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden /> : null}
                  </span>
                ),
              }))}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-[13px] text-muted-foreground">
              {own
                ? t("appointmentBook.mail.yourText", "Your own text in {{lang}}", { lang: locale.toUpperCase() })
                : t("appointmentBook.mail.ourText", "Our text in {{lang}}", { lang: locale.toUpperCase() })}
            </span>
            {own ? (
              <button
                type="button"
                onClick={() => onCopyChange(withoutLocale(copy, kind, locale))}
                className="press inline-flex min-h-11 items-center gap-1 text-[13px] font-medium text-foreground underline underline-offset-4 hover:no-underline sm:min-h-0"
              >
                <RotateCcw className="size-3.5" aria-hidden />
                {t("appointmentBook.mail.backToOurs", "Back to our text")}
              </button>
            ) : null}
            <Button
              variant={editing ? "default" : "outline"}
              className="ml-auto h-10 gap-1.5 max-sm:h-11"
              onClick={() => setEditing((v) => !v)}
              disabled={!current}
              aria-expanded={editing}
            >
              <Pencil className="size-3.5" aria-hidden />
              {editing ? t("appointmentBook.mail.doneEditing", "Done changing") : t("appointmentBook.mail.change", "Change the text")}
            </Button>
          </div>

          {defaults.isError ? (
            <p className="rounded-lg border border-border px-3 py-3 text-[13.5px] text-muted-foreground">
              {t("appointmentBook.mail.loadError", "The email couldn't be loaded. Close this and open it again.")}
            </p>
          ) : null}

          {editing && current ? (
            <div className="mb-4 space-y-3 rounded-xl border border-border bg-background/60 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12.5px] text-muted-foreground">
                  {t("appointmentBook.mail.editHint", "A new line starts a new paragraph.")}
                </p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-9 gap-1 max-sm:h-11">
                      {t("appointmentBook.mail.insert", "Insert")}
                      <ChevronDown className="size-3.5" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
                    {PLACEHOLDERS.map((p) => (
                      <DropdownMenuItem key={p.token} className="min-h-10" onSelect={() => insert(p.token)}>
                        {t(p.key, p.fallback)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <label className="block space-y-1.5">
                <span className="text-[13px] font-medium text-foreground">{t("appointmentBook.mail.subject", "Subject")}</span>
                <Input
                  ref={refs.subject}
                  value={current.subject}
                  onFocus={() => (lastField.current = "subject")}
                  onChange={(e) => setField("subject", e.target.value)}
                  className="h-10 max-sm:h-11"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[13px] font-medium text-foreground">{t("appointmentBook.mail.title", "Title")}</span>
                <Input
                  ref={refs.title}
                  value={current.title}
                  onFocus={() => (lastField.current = "title")}
                  onChange={(e) => setField("title", e.target.value)}
                  className="h-10 max-sm:h-11"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[13px] font-medium text-foreground">{t("appointmentBook.mail.message", "Message")}</span>
                <Textarea
                  ref={refs.lead}
                  value={current.lead}
                  rows={4}
                  onFocus={() => (lastField.current = "lead")}
                  onChange={(e) => setField("lead", e.target.value)}
                />
              </label>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-xl border border-border">
            <div className="flex items-center gap-2 border-b border-border bg-background/60 px-3 py-2 text-[13px]">
              <span className="shrink-0 text-muted-foreground">{t("appointmentBook.mail.subject", "Subject")}:</span>
              <span className="min-w-0 truncate font-medium text-foreground">{preview.data?.subject ?? "…"}</span>
              {preview.isFetching ? <Loader2 className="ml-auto size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden /> : null}
            </div>
            {preview.data ? (
              <FittedEmailFrame
                title={t("appointmentBook.mail.preview", "Preview of the email")}
                html={preview.data.html}
              />
            ) : (
              <div className={cn("h-[520px] w-full bg-muted/40", !preview.isError && "animate-pulse")}>
                {preview.isError ? (
                  <p className="p-4 text-[13.5px] text-muted-foreground">
                    {t("appointmentBook.mail.previewError", "The preview couldn't be made. Check the text, then try again.")}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <p className="w-full text-[12.5px] text-muted-foreground sm:w-auto sm:flex-1">
            {own ? t("appointmentBook.mail.keptOnSave", "Your text is kept when you press “Save changes” on the page.") : null}
          </p>
          <Button variant="outline" className="h-10 gap-1.5 max-sm:h-11 max-sm:flex-1" disabled={test.isPending || !current} onClick={() => test.mutate()}>
            {test.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Send className="size-3.5" aria-hidden />}
            {t("appointmentBook.mail.sendTest", "Send me a test")}
          </Button>
          <Button className="h-10 max-sm:h-11 max-sm:flex-1" onClick={() => onOpenChange(false)}>
            {t("appointmentBook.mail.close", "Done")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** The email layout is 600px wide; on a phone the preview shows it whole, scaled down, like a mail app does. */
const EMAIL_WIDTH = 640;
const FRAME_HEIGHT = 520;

function FittedEmailFrame({ title, html }: { title: string; html: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const update = () => setScale(Math.min(1, box.clientWidth / EMAIL_WIDTH));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={boxRef} className="relative w-full overflow-hidden bg-white" style={{ height: FRAME_HEIGHT }}>
      <iframe
        title={title}
        srcDoc={html}
        sandbox=""
        // Emails assume a white page — stays white in both themes.
        className="block origin-top-left bg-white"
        style={
          scale < 1
            ? { width: EMAIL_WIDTH, height: FRAME_HEIGHT / scale, transform: `scale(${scale})` }
            : { width: "100%", height: FRAME_HEIGHT }
        }
      />
    </div>
  );
}
