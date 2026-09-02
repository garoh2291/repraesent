import { CircleHelp, Eye, EyeOff, Loader2, RefreshCw } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
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
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import {
  PanelSection,
  Segmented,
  SegmentedButton,
} from "~/components/forms/chrome";
import { Field, FieldHint } from "~/components/wordpress/fields";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  CHECKOUT_WEBHOOK_EVENTS,
  EMPTY_FIELD_MAP,
  FORM_WEBHOOK_EVENTS,
  WEBHOOK_URL_UNCHANGED,
  revealFormWebhookSecret,
  type FormWebhook,
  type FormWebhookEvent,
  type FormWebhookFieldMap,
  type PayloadKeysResponse,
} from "~/lib/api/form-webhooks";
import type { FormKind } from "~/lib/forms/schema";
import { TARGET_KEY_RE, collidingTargets } from "~/lib/forms/webhook-preview";
import {
  useCreateWebhook,
  useRotateSecret,
  useUpdateWebhook,
} from "~/lib/hooks/useFormWebhooks";
import { PayloadMappingTable } from "./PayloadMappingTable";
import { PayloadPreview } from "./PayloadPreview";
import { SignatureSnippet } from "./SignatureSnippet";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string;
  kind: FormKind;
  /** null = create */
  webhook: FormWebhook | null;
  payloadKeys: PayloadKeysResponse | undefined;
  isAdmin: boolean;
  disabled?: boolean;
  /** Called with the created/updated record; `secret` is set on create. */
  onSaved?: (webhook: FormWebhook) => void;
}

const HOST_HINT_RE =
  /^(https?:\/\/)?(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i;

/**
 * One sheet, one draft, one save. Sections: endpoint, events, payload
 * (mapping table + live preview side by side), and — for an existing hook —
 * the signing secret. The preview is the contract: what it shows is what the
 * server POSTs, because both sides build `data` from the same key list.
 */
export function WebhookEditorSheet({
  open,
  onOpenChange,
  formId,
  kind,
  webhook,
  payloadKeys,
  isAdmin,
  disabled,
  onSaved,
}: Props) {
  const { t } = useTranslation();
  const create = useCreateWebhook(formId);
  const update = useUpdateWebhook(formId);
  const rotate = useRotateSecret(formId);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<FormWebhookEvent[]>(["form.submitted"]);
  const [map, setMap] = useState<FormWebhookFieldMap>(EMPTY_FIELD_MAP);
  const [previewEvent, setPreviewEvent] =
    useState<FormWebhookEvent>("form.submitted");
  const [pane, setPane] = useState<"keys" | "preview">("keys");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [revealLeft, setRevealLeft] = useState(0);
  const [rotateOpen, setRotateOpen] = useState(false);

  // Hydrate the draft each time the sheet opens on a (different) webhook.
  useEffect(() => {
    if (!open) return;
    setName(webhook?.name ?? "");
    setUrl(webhook ? WEBHOOK_URL_UNCHANGED : "");
    setEvents(webhook?.events ?? ["form.submitted"]);
    setMap(webhook?.field_map ?? EMPTY_FIELD_MAP);
    setPreviewEvent(webhook?.events[0] ?? "form.submitted");
    setRevealed(null);
    setRevealLeft(0);
    setPane("keys");
  }, [open, webhook]);

  // The revealed secret hides itself after 30 seconds.
  useEffect(() => {
    if (!revealed) return;
    setRevealLeft(30);
    const id = window.setInterval(() => {
      setRevealLeft((n) => {
        if (n <= 1) {
          window.clearInterval(id);
          setRevealed(null);
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [revealed]);

  const availableEvents: FormWebhookEvent[] =
    kind === "product" ? [...FORM_WEBHOOK_EVENTS] : ["form.submitted"];
  // The same group list feeds the table, the preview and the collision check,
  // so a key the editor cannot see can never block Save.
  const groups = useMemo(
    () =>
      (payloadKeys?.groups ?? []).filter(
        (g) => g.group !== "checkout" || kind === "product",
      ),
    [payloadKeys, kind],
  );
  const allKeys = useMemo(
    () => groups.flatMap((g) => g.keys.map((k) => k.key)),
    [groups],
  );
  const collisions = useMemo(
    () => collidingTargets(map, allKeys),
    [map, allKeys],
  );
  const badNames = useMemo(
    () =>
      Object.values(map.keys).some(
        (r) => r.include && r.as && !TARGET_KEY_RE.test(r.as.trim()),
      ),
    [map],
  );

  const urlLooksLocal = url !== WEBHOOK_URL_UNCHANGED && HOST_HINT_RE.test(url);
  const urlOk =
    url === WEBHOOK_URL_UNCHANGED ||
    /^https:\/\/[^\s]+\.[^\s]+/i.test(url.trim());
  const canSave =
    !disabled &&
    name.trim().length > 0 &&
    urlOk &&
    events.length > 0 &&
    collisions.size === 0 &&
    !badNames &&
    !create.isPending &&
    !update.isPending;

  const save = async () => {
    if (!canSave) return;
    try {
      if (webhook) {
        const saved = await update.mutateAsync({
          id: webhook.id,
          body: {
            name: name.trim(),
            url: url === WEBHOOK_URL_UNCHANGED ? undefined : url.trim(),
            events,
            field_map: map,
          },
        });
        toast.success(t("forms.webhooks.saved"));
        onSaved?.(saved);
      } else {
        const saved = await create.mutateAsync({
          name: name.trim(),
          url: url.trim(),
          events,
          field_map: map,
        });
        toast.success(t("forms.webhooks.created"));
        onSaved?.(saved);
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        t("common.failedToSave", { defaultValue: "Could not save" }),
        {
          description: extractErrorMessage(error),
        },
      );
    }
  };

  const reveal = async () => {
    if (!webhook) return;
    try {
      setRevealed(await revealFormWebhookSecret(formId, webhook.id));
    } catch (error) {
      toast.error(extractErrorMessage(error));
    }
  };

  const doRotate = async () => {
    if (!webhook) return;
    try {
      const rotated = await rotate.mutateAsync(webhook.id);
      setRotateOpen(false);
      if (rotated.secret) setRevealed(rotated.secret);
      toast.success(t("forms.webhooks.rotated"));
    } catch (error) {
      toast.error(extractErrorMessage(error));
    }
  };

  const toggleEvent = (event: FormWebhookEvent, on: boolean) => {
    setEvents((prev) => {
      const next = on
        ? [...new Set([...prev, event])]
        : prev.filter((e) => e !== event);
      if (!next.includes(previewEvent))
        setPreviewEvent(next[0] ?? "form.submitted");
      return next;
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[820px]"
      >
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>
            {webhook ? t("forms.webhooks.editTitle") : t("forms.webhooks.add")}
          </SheetTitle>
          <SheetDescription>{t("forms.webhooks.sheetHint")}</SheetDescription>
        </SheetHeader>

        <div className="@container flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <PanelSection
            title={t("forms.webhooks.endpoint")}
            action={<ReceiverHelp />}
          >
            <div className="grid gap-4 @md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
              <Field>
                <Label htmlFor="wh-name">{t("forms.webhooks.name")}</Label>
                <Input
                  id="wh-name"
                  value={name}
                  disabled={disabled}
                  placeholder="Zapier — new leads"
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field>
                <Label htmlFor="wh-url">{t("forms.webhooks.url")}</Label>
                <Input
                  id="wh-url"
                  value={url === WEBHOOK_URL_UNCHANGED ? "" : url}
                  disabled={disabled}
                  placeholder={
                    url === WEBHOOK_URL_UNCHANGED && webhook
                      ? webhook.url_masked
                      : "https://hooks.example.com/…"
                  }
                  onChange={(e) => setUrl(e.target.value)}
                  onFocus={() => {
                    if (url === WEBHOOK_URL_UNCHANGED) setUrl("");
                  }}
                  onBlur={() => {
                    if (webhook && url.trim() === "")
                      setUrl(WEBHOOK_URL_UNCHANGED);
                  }}
                  aria-invalid={!urlOk && url !== "" ? true : undefined}
                  className="font-mono text-[13px]"
                />
                <FieldHint>
                  {urlLooksLocal
                    ? t("forms.webhooks.urlLocal")
                    : t("forms.webhooks.urlHint")}
                </FieldHint>
              </Field>
            </div>
          </PanelSection>

          <PanelSection title={t("forms.webhooks.events")}>
            <div className="grid gap-2 @md:grid-cols-2">
              {availableEvents.map((event) => {
                const checked = events.includes(event);
                return (
                  <label
                    key={event}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                      checked
                        ? "border-primary/40 bg-primary/5"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={(v) => toggleEvent(event, v === true)}
                      className="mt-0.5"
                    />
                    <span className="space-y-0.5">
                      <span className="block font-mono text-[12px]">
                        {event}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t(`forms.webhooks.event.${event.replace(".", "_")}`)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            {kind !== "product" ? (
              <FieldHint>{t("forms.webhooks.eventsStandardHint")}</FieldHint>
            ) : null}
          </PanelSection>

          <PanelSection
            title={t("forms.webhooks.payload")}
            action={
              <Segmented className="@lg:hidden">
                <SegmentedButton
                  active={pane === "keys"}
                  onClick={() => setPane("keys")}
                >
                  {t("forms.webhooks.paneKeys")}
                </SegmentedButton>
                <SegmentedButton
                  active={pane === "preview"}
                  onClick={() => setPane("preview")}
                >
                  {t("forms.webhooks.panePreview")}
                </SegmentedButton>
              </Segmented>
            }
          >
            <FieldHint>{t("forms.webhooks.payloadHint")}</FieldHint>
            {!payloadKeys ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("common.loading", { defaultValue: "Loading…" })}
              </div>
            ) : (
              <div className="grid gap-4 @lg:grid-cols-2">
                <div className={pane === "keys" ? "" : "hidden @lg:block"}>
                  <PayloadMappingTable
                    groups={groups}
                    map={map}
                    onChange={setMap}
                    disabled={disabled}
                  />
                </div>
                <div
                  className={`@lg:sticky @lg:top-0 @lg:self-start ${
                    pane === "preview" ? "" : "hidden @lg:block"
                  }`}
                >
                  <PayloadPreview
                    envelope={payloadKeys.envelope_example}
                    groups={groups}
                    map={map}
                    events={events.length ? events : ["form.submitted"]}
                    event={previewEvent}
                    onEventChange={setPreviewEvent}
                  />
                  <div className="mt-3">
                    <SignatureSnippet />
                  </div>
                </div>
              </div>
            )}
          </PanelSection>

          {webhook ? (
            <PanelSection title={t("forms.webhooks.secret")}>
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-lg border bg-muted/40 px-2.5 py-1.5 font-mono text-[12px]">
                  {revealed ?? webhook.secret_masked}
                </code>
                {isAdmin ? (
                  <>
                    {revealed ? (
                      <button
                        type="button"
                        onClick={() => setRevealed(null)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                        {t("forms.webhooks.hideIn", { s: revealLeft })}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={reveal}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {t("forms.webhooks.reveal")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setRotateOpen(true)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {t("forms.webhooks.rotate")}
                    </button>
                  </>
                ) : null}
              </div>
              <FieldHint>
                {isAdmin
                  ? t("forms.webhooks.secretHint")
                  : t("forms.webhooks.adminOnly")}
              </FieldHint>
            </PanelSection>
          ) : null}
        </div>

        <SheetFooter className="border-t px-5 py-4 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button disabled={!canSave} onClick={save}>
            {create.isPending || update.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {webhook ? t("forms.webhooks.save") : t("forms.webhooks.add")}
          </Button>
        </SheetFooter>
      </SheetContent>

      <AlertDialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("forms.webhooks.rotateTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("forms.webhooks.rotateBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction onClick={doRotate}>
              {t("forms.webhooks.rotate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

export { CHECKOUT_WEBHOOK_EVENTS };

/**
 * "What does my endpoint have to do?" — the one question every first-time
 * webhook user asks. A popover (not a tooltip) so it opens on tap as well.
 */
function ReceiverHelp() {
  const { t } = useTranslation();
  const points = [
    "receive",
    "nothingElse",
    "https",
    "signature",
    "retries",
  ] as const;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t("forms.webhooks.receiverHelp.title")}
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-2.5 p-4 text-[13px]">
        <p className="font-semibold text-foreground">
          {t("forms.webhooks.receiverHelp.title")}
        </p>
        <ul className="space-y-1.5 text-muted-foreground">
          {points.map((key) => (
            <li key={key} className="flex gap-2">
              <span
                aria-hidden="true"
                className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60"
              />
              <span>{t(`forms.webhooks.receiverHelp.${key}`)}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
