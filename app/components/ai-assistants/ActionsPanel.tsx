import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { toast } from "sonner";
import { Link } from "react-router";
import TimezoneSelect from "react-timezone-select";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarPlus,
  LifeBuoy,
  MousePointerClick,
  Plus,
  Trash2,
  Sparkles,
} from "lucide-react";
import { CalDavIcon } from "~/components/icons/CalDavIcon";
import { GoogleIcon } from "~/components/icons/GoogleIcon";
import { MicrosoftIcon } from "~/components/icons/MicrosoftIcon";
import {
  Cols,
  Panel,
  PanelBody,
  PanelHeader,
  PanelSection,
} from "~/components/forms/chrome";
import { Field, FieldHint } from "~/components/wordpress/fields";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  FieldAnchor,
  useRevealListener,
} from "~/components/ai-assistants/FieldAnchor";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { calendarKeyFor, listCalendarAccounts } from "~/lib/api/calendar";
import { useAssistantTranslate } from "~/lib/hooks/useAssistantTranslate";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useWorkspaceMembers, type WorkspaceMemberOption } from "~/lib/hooks/useWorkspaceMembers";
import type { TranslateAssistantRequest } from "~/lib/api/assistant-translate";
import {
  ACTION_APPOINTMENT_DEFAULTS,
  ACTION_SHOW,
  ACTION_TYPES,
  AI_LOCALES,
  EMPTY_FALLBACK_CONTACT,
  type AiLocale,
  type ActionAppointmentSettings,
  type ActionConfig,
  type ActionShow,
  type ActionType,
  type AssistantDraft,
} from "~/lib/api/ai-assistants";
import { cn } from "~/lib/utils";

interface Props {
  draft: AssistantDraft;
  canEdit: boolean;
  onChange: (patch: Partial<AssistantDraft>) => void;
}

const MAX_ACTIONS = 6;

function newAction(type: ActionType): ActionConfig {
  return {
    id: `a${Math.random().toString(36).slice(2, 10)}`,
    type,
    label: "",
    labels: {},
    show: "on_lead_intent",
  };
}

/**
 * CTA chips the widget offers next to an answer (book, call, email, link)
 * plus the contact the assistant falls back to when it cannot answer.
 */
/** Labels are authored in English and translated from there, like the widget strings. */
const LABEL_SOURCE_LOCALE: AiLocale = "en";
const LABEL_KEY = "action.label";

export function ActionsPanel({ draft, canEdit, onChange }: Props) {
  const { t } = useTranslation();
  const { assistantId } = useParams();
  const { translating, anyTranslating, run } = useAssistantTranslate(assistantId);
  const actions = draft.actions ?? [];

  // The merge happens after an await, so it must read the CURRENT actions —
  // a captured copy would drop anything typed while the request was open.
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const fallback = draft.fallback_contact ?? EMPTY_FALLBACK_CONTACT;
  const [openId, setOpenId] = useState<string | undefined>(undefined);

  // An issue on `actions.<i>.<field>` points inside a collapsed editor, so the
  // item has to open before the anchor exists to scroll to.
  useRevealListener((path) => {
    const i = Number(path.match(/^actions\.(\d+)\b/)?.[1]);
    const target = Number.isInteger(i) ? (draft.actions ?? [])[i] : undefined;
    if (target) setOpenId(target.id);
  });

  const setActions = (next: ActionConfig[]) => onChange({ actions: next });

  /**
   * Translate one action's label into every other language. One request per
   * action, keyed on a single item — the endpoint takes a flat item map, and
   * the label is the only translatable string an action has.
   */
  const translateLabels = (action: ActionConfig, overwrite: boolean) => {
    const source = action.label.trim();
    if (!source) {
      toast.info(t("aiAssistants.translate.nothingToDo"));
      return;
    }
    const targets: TranslateAssistantRequest["targets"] = [];
    for (const locale of AI_LOCALES) {
      if (locale === LABEL_SOURCE_LOCALE) continue;
      if (!overwrite && (action.labels?.[locale] ?? "").trim()) continue;
      targets.push({ locale, keys: [LABEL_KEY] });
    }
    if (targets.length === 0) {
      toast.info(t("aiAssistants.translate.nothingToDo"));
      return;
    }

    void (async () => {
      const response = await run({
        source_locale: LABEL_SOURCE_LOCALE,
        items: { [LABEL_KEY]: { value: source } },
        targets,
      });
      if (!response) return;
      const current = actionsRef.current.find((x) => x.id === action.id);
      if (!current) return; // removed while the request was open
      const labels = { ...(current.labels ?? {}) };
      for (const result of response.results) {
        // A failed locale merges nothing: pasting the source text back in
        // would look translated when it is not.
        if (!result.ok) continue;
        const value = (result.values[LABEL_KEY] ?? "").trim();
        if (value) labels[result.locale] = value;
      }
      update(action.id, { labels });
    })();
  };
  const update = (id: string, p: Partial<ActionConfig>) =>
    setActions(actions.map((a) => (a.id === id ? { ...a, ...p } : a)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= actions.length) return;
    const next = [...actions];
    [next[i], next[j]] = [next[j], next[i]];
    setActions(next);
  };
  const add = () => {
    if (actions.length >= MAX_ACTIONS) return;
    const a = newAction("link");
    setActions([...actions, a]);
    setOpenId(a.id);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel>
        <PanelHeader
          icon={<MousePointerClick className="h-3.5 w-3.5" />}
          title={t("aiAssistants.actions.title")}
          meta={
            <span className="text-[11px] tabular-nums text-muted-foreground/70">
              {actions.length}/{MAX_ACTIONS}
            </span>
          }
          action={
            canEdit ? (
              <Button
                variant="outline"
                size="sm"
                onClick={add}
                disabled={actions.length >= MAX_ACTIONS}
              >
                <Plus className="h-3.5 w-3.5" />
                {t("aiAssistants.actions.add")}
              </Button>
            ) : null
          }
        />
        <PanelBody>
          <FieldHint>{t("aiAssistants.actions.hint")}</FieldHint>
          {actions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("aiAssistants.actions.empty")}
            </p>
          ) : (
            <Accordion
              type="single"
              collapsible
              value={openId}
              onValueChange={(v) => setOpenId(v || undefined)}
              className="rounded-xl border border-border px-3"
            >
              {actions.map((a, i) => (
                <FieldAnchor key={a.id} path={`actions.${i}`}>
                  <AccordionItem value={a.id}>
                    <AccordionTrigger className="text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                          {t(`aiAssistants.actions.types.${a.type}`)}
                        </span>
                        <span
                          className={cn(
                            "truncate",
                            !a.label && "italic text-muted-foreground",
                          )}
                        >
                          {a.label || t("aiAssistants.actions.untitled")}
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pb-4">
                      <ActionEditor
                        action={a}
                        index={i}
                        canEdit={canEdit}
                        onChange={(p) => update(a.id, p)}
                        onTranslate={(overwrite) =>
                          translateLabels(a, overwrite)
                        }
                        translating={translating.size > 0}
                        translateDisabled={
                          !canEdit || anyTranslating || !a.label.trim()
                        }
                      />
                      {canEdit ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            disabled={i === 0}
                            onClick={() => move(i, -1)}
                            aria-label={t("aiAssistants.actions.moveUp")}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            disabled={i === actions.length - 1}
                            onClick={() => move(i, 1)}
                            aria-label={t("aiAssistants.actions.moveDown")}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-auto text-destructive hover:text-destructive"
                            onClick={() =>
                              setActions(actions.filter((x) => x.id !== a.id))
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t("common.remove", { defaultValue: "Remove" })}
                          </Button>
                        </div>
                      ) : null}
                    </AccordionContent>
                  </AccordionItem>
                </FieldAnchor>
              ))}
            </Accordion>
          )}
        </PanelBody>
      </Panel>

      <aside className="space-y-4 lg:sticky lg:top-[var(--ai-stick,5.5rem)] lg:self-start">
        <Panel>
          <PanelHeader
            icon={<LifeBuoy className="h-3.5 w-3.5" />}
            title={t("aiAssistants.fallback.title")}
          />
          <PanelBody>
            <FieldHint>{t("aiAssistants.fallback.hint")}</FieldHint>
            <Field>
              <Label htmlFor="fb-phone">
                {t("aiAssistants.fallback.phone")}
              </Label>
              <FieldAnchor path="fallback_contact.phone">
                <Input
                  id="fb-phone"
                  type="tel"
                  maxLength={40}
                  disabled={!canEdit}
                  value={fallback.phone}
                  onChange={(e) =>
                    onChange({
                      fallback_contact: { ...fallback, phone: e.target.value },
                    })
                  }
                />
              </FieldAnchor>
            </Field>
            <Field>
              <Label htmlFor="fb-email">
                {t("aiAssistants.fallback.email")}
              </Label>
              <FieldAnchor path="fallback_contact.email">
                <Input
                  id="fb-email"
                  type="email"
                  maxLength={200}
                  disabled={!canEdit}
                  value={fallback.email}
                  onChange={(e) =>
                    onChange({
                      fallback_contact: { ...fallback, email: e.target.value },
                    })
                  }
                />
              </FieldAnchor>
            </Field>
            <Field>
              <Label htmlFor="fb-text">{t("aiAssistants.fallback.text")}</Label>
              <Textarea
                id="fb-text"
                maxLength={200}
                disabled={!canEdit}
                value={fallback.text}
                placeholder={t("aiAssistants.fallback.textPlaceholder")}
                onChange={(e) =>
                  onChange({
                    fallback_contact: { ...fallback, text: e.target.value },
                  })
                }
                className="min-h-[72px]"
              />
            </Field>
          </PanelBody>
        </Panel>
      </aside>
    </div>
  );
}

function ActionEditor({
  action: a,
  index,
  canEdit,
  onChange,
  onTranslate,
  translating,
  translateDisabled,
}: {
  action: ActionConfig;
  /** Position in `draft.actions` — the config path the API reports issues on. */
  index: number;
  canEdit: boolean;
  onChange: (p: Partial<ActionConfig>) => void;
  onTranslate: (overwrite: boolean) => void;
  translating: boolean;
  translateDisabled: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Cols>
        <Field>
          <Label>{t("aiAssistants.actions.type")}</Label>
          <Select
            value={a.type}
            disabled={!canEdit}
            onValueChange={(v) => onChange({ type: v as ActionType })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map((ty) => (
                <SelectItem key={ty} value={ty}>
                  {t(`aiAssistants.actions.types.${ty}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <Label htmlFor={`label-${a.id}`}>
            {t("aiAssistants.actions.label")}
          </Label>
          <FieldAnchor path={`actions.${index}.label`}>
            <Input
              id={`label-${a.id}`}
              maxLength={40}
              disabled={!canEdit}
              value={a.label}
              placeholder={t(`aiAssistants.actions.labelPlaceholder.${a.type}`)}
              onChange={(e) => onChange({ label: e.target.value })}
            />
          </FieldAnchor>
        </Field>
      </Cols>

      {a.type === "link" ? (
        <Field>
          <Label htmlFor={`url-${a.id}`}>{t("aiAssistants.actions.url")}</Label>
          <FieldAnchor path={`actions.${index}.url`}>
            <Input
              id={`url-${a.id}`}
              inputMode="url"
              disabled={!canEdit}
              value={a.url ?? ""}
              placeholder="https://example.com/pricing"
              onChange={(e) => onChange({ url: e.target.value || undefined })}
            />
          </FieldAnchor>
        </Field>
      ) : a.type === "book" ? (
        <BookingRules
          action={a}
          index={index}
          disabled={!canEdit}
          onChange={(appointment) => onChange({ appointment })}
        />
      ) : a.type === "call" ? (
        <Field>
          <Label htmlFor={`phone-${a.id}`}>
            {t("aiAssistants.actions.phone")}
          </Label>
          <FieldAnchor path={`actions.${index}.phone`}>
            <Input
              id={`phone-${a.id}`}
              type="tel"
              maxLength={40}
              disabled={!canEdit}
              value={a.phone ?? ""}
              placeholder="+49 40 123456"
              onChange={(e) => onChange({ phone: e.target.value || undefined })}
            />
          </FieldAnchor>
        </Field>
      ) : (
        <Field>
          <Label htmlFor={`email-${a.id}`}>
            {t("aiAssistants.actions.email")}
          </Label>
          <FieldAnchor path={`actions.${index}.email`}>
            <Input
              id={`email-${a.id}`}
              type="email"
              maxLength={200}
              disabled={!canEdit}
              value={a.email ?? ""}
              placeholder="hello@example.com"
              onChange={(e) => onChange({ email: e.target.value || undefined })}
            />
          </FieldAnchor>
        </Field>
      )}

      <Field>
        <Label>{t("aiAssistants.actions.show")}</Label>
        <Select
          value={a.show}
          disabled={!canEdit}
          onValueChange={(v) => onChange({ show: v as ActionShow })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_SHOW.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`aiAssistants.actions.showOptions.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <PanelSection
        title={t("aiAssistants.actions.perLocale")}
        action={
          canEdit ? (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                loading={translating}
                disabled={translateDisabled}
                onClick={() => onTranslate(false)}
              >
                {translating ? null : <Sparkles className="h-3.5 w-3.5" />}
                {t("aiAssistants.translate.withAi")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={translateDisabled}
                onClick={() => onTranslate(true)}
                className="text-muted-foreground"
              >
                {t("aiAssistants.translate.retranslate")}
              </Button>
            </div>
          ) : null
        }
      >
        <FieldHint>{t("aiAssistants.actions.perLocaleHint")}</FieldHint>
        <div className="grid gap-2 @sm:grid-cols-2">
          {AI_LOCALES.map((l) => (
            <div key={l} className="flex items-center gap-2">
              <span className="w-6 font-mono text-[11px] uppercase text-muted-foreground">
                {l}
              </span>
              <Input
                maxLength={40}
                disabled={!canEdit}
                value={a.labels?.[l] ?? ""}
                placeholder={a.label}
                onChange={(e) => {
                  const labels = { ...(a.labels ?? {}) };
                  if (e.target.value.trim()) labels[l] = e.target.value;
                  else delete labels[l];
                  onChange({ labels });
                }}
                className="h-8 text-sm"
              />
            </div>
          ))}
        </div>
      </PanelSection>
    </div>
  );
}

/** Weekday keys in strip order — Monday first, like the form builder. */
const APPT_DAY_KEYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;
const APPT_DURATIONS = [15, 30, 45, 60] as const;
/**
 * Searchable member picker for the booking host.
 *
 * A plain Select could not cope: workspace emails here run to
 * `demo.sarah+819d0e5c@demo.repraesent.com`, which blew the menu past the
 * trigger and clipped every row. A popover sized to the trigger with its own
 * search box keeps the list readable and usable at twenty members, and the
 * email truncates instead of pushing the layout apart.
 */
function HostPicker({
  members,
  value,
  disabled,
  onChange,
}: {
  members: WorkspaceMemberOption[];
  value?: string;
  disabled?: boolean;
  onChange: (userId: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // Reset on close: cmdk keeps its own filter state, so without this the next
  // open still shows the last search and an empty list.
  const [query, setQuery] = useState("");
  const selected = members.find((m) => m.user_id === value);
  const label = (m: WorkspaceMemberOption): string =>
    `${m.user_first_name ?? ""} ${m.user_last_name ?? ""}`.trim() || m.user_email;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border bg-background px-3 text-sm disabled:opacity-50"
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <MemberAvatar member={selected} />
              <span className="min-w-0 truncate">{label(selected)}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">
              {t("aiAssistants.actions.hostNone")}
            </span>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={t("aiAssistants.actions.hostSearch")}
          />
          <CommandList className="max-h-64">
            <CommandEmpty>{t("aiAssistants.actions.hostEmpty")}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={t("aiAssistants.actions.hostNone")}
                onSelect={() => {
                  onChange(NO_HOST);
                  setOpen(false);
                }}
              >
                <span className="flex-1 truncate">
                  {t("aiAssistants.actions.hostNone")}
                </span>
                {!selected ? <Check className="h-3.5 w-3.5" /> : null}
              </CommandItem>
              {members.map((m) => (
                <CommandItem
                  key={m.user_id}
                  value={`${label(m)} ${m.user_email}`}
                  onSelect={() => {
                    onChange(m.user_id);
                    setOpen(false);
                  }}
                >
                  <MemberAvatar member={m} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{label(m)}</span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {m.user_email}
                    </span>
                  </span>
                  {m.user_id === value ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function MemberAvatar({ member }: { member: WorkspaceMemberOption }) {
  const src = member.user_avatar_thumb_url ?? member.user_avatar_url;
  const name =
    `${member.user_first_name ?? ""} ${member.user_last_name ?? ""}`.trim() ||
    member.user_email;
  return (
    <span
      aria-hidden
      className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[10px] font-semibold text-muted-foreground"
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
}

/** Radix Select has no empty value, so "no host" needs a sentinel. */
const NO_HOST = "__none__";

/**
 * Booking rules for a `book` action. Deliberately the same control set as the
 * form builder's appointment field (`components/forms/FieldInspector.tsx`
 * `AppointmentConfig`) — both write the identical settings shape, which the
 * backend feeds straight to `CalendarAvailabilityService`.
 *
 * A separate component rather than a `case` body: it needs the connected
 * calendars query, and hooks cannot live inside a conditional branch.
 */
function BookingRules({
  action,
  index,
  disabled,
  onChange,
}: {
  action: ActionConfig;
  /** Position in `draft.actions`, for the `actions.<i>.appointment` anchor. */
  index: number;
  disabled?: boolean;
  onChange: (settings: ActionAppointmentSettings) => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["calendar-accounts"],
    queryFn: listCalendarAccounts,
  });
  // Cache read on any CRM screen — the same query key eleven other call sites
  // already use.
  const { data: workspace } = useWorkspaceMembers();
  const members = workspace?.members ?? [];

  const ap = action.appointment ?? ACTION_APPOINTMENT_DEFAULTS;
  const patch = (p: Partial<ActionAppointmentSettings>) =>
    onChange({ ...ap, ...p });

  const accounts = data?.accounts ?? [];
  const baikalConfigs = data?.baikal_configs ?? [];

  // Only calendars we can create events in are valid targets. CalDAV is always
  // the owner's own credentials, so its whole list counts.
  const writableCalendars = (a: (typeof accounts)[number]) =>
    a.calendars.filter(
      (c) => c.accessRole === "owner" || c.accessRole === "writer",
    );

  const oauthAccounts = accounts.filter(
    (a) => a.provider === "google" || a.provider === "microsoft",
  );
  const caldavAccounts = accounts.filter((a) => a.provider === "caldav");
  const myOauth = oauthAccounts.filter((a) => a.is_own);
  const teamOauth = oauthAccounts.filter((a) => !a.is_own);

  const hasTargets =
    oauthAccounts.some((a) => writableCalendars(a).length > 0) ||
    baikalConfigs.length > 0 ||
    caldavAccounts.some((a) => a.calendars.length > 0);

  if (!isLoading && !hasTargets) {
    return (
      <div className="space-y-2 rounded-lg border border-dashed p-3">
        <p className="text-sm text-muted-foreground">
          {t("forms.inspector.appointment.noTargets")}
        </p>
        <Link
          to="/settings/calendars"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline underline-offset-2"
        >
          <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
          {t("forms.inspector.appointment.connectLink")}
        </Link>
      </div>
    );
  }

  // Resolution rule: explicit key first, else the legacy Google pair.
  const selectedTarget =
    ap.targetKey ||
    (ap.accountId && ap.calendarId
      ? `google:${ap.accountId}:${ap.calendarId}`
      : undefined);

  const setTarget = (key: string) => {
    if (key.startsWith("google:")) {
      // DUAL-WRITE the legacy pair, exactly like the form builder does.
      const rest = key.slice("google:".length);
      const sep = rest.indexOf(":");
      patch({
        targetKey: key,
        accountId: rest.slice(0, sep),
        calendarId: rest.slice(sep + 1),
      });
    } else {
      patch({ targetKey: key, accountId: "", calendarId: "" });
    }
  };

  const selectedAccountId =
    selectedTarget && !selectedTarget.startsWith("baikal:")
      ? selectedTarget.split(":")[1]
      : null;
  const account = accounts.find((a) => a.id === selectedAccountId);

  const accountCalendarItems = (list: typeof accounts) =>
    list.flatMap((a) =>
      (a.provider === "caldav" ? a.calendars : writableCalendars(a)).map(
        (c) => {
          const key = calendarKeyFor(a, c.id);
          return (
            <SelectItem key={key} value={key} disabled={a.auth_failed}>
              <span className="flex min-w-0 items-center gap-1.5">
                {a.provider === "google" && (
                  <GoogleIcon className="h-3 w-3 shrink-0" />
                )}
                {a.provider === "microsoft" && (
                  <MicrosoftIcon className="h-3 w-3 shrink-0" />
                )}
                {a.provider === "caldav" && (
                  <CalDavIcon className="h-3 w-3 shrink-0" />
                )}
                <span className="min-w-0 truncate">
                  {c.summary}
                  <span className="text-muted-foreground">
                    {" "}
                    · {a.google_email || a.user_name}
                    {a.auth_failed
                      ? ` — ${t("forms.inspector.appointment.accountNeedsReconnect")}`
                      : ""}
                  </span>
                </span>
              </span>
            </SelectItem>
          );
        },
      ),
    );

  const allBusy = ap.busyCalendarKeys === "all";
  const busyKeys = Array.isArray(ap.busyCalendarKeys)
    ? ap.busyCalendarKeys
    : [];
  const toggleBusyKey = (key: string, checked: boolean) =>
    patch({
      busyCalendarKeys: checked
        ? [...busyKeys, key]
        : busyKeys.filter((k) => k !== key),
    });

  /**
   * The host is denormalised onto the action: the public config must never
   * expose a user id, so the widget is handed the display fields directly and
   * the id only survives server-side to resolve the attendee.
   */
  const setHost = (value: string) => {
    if (value === NO_HOST) {
      patch({
        hostUserId: undefined,
        hostName: undefined,
        hostAvatarUrl: undefined,
        hostEmail: undefined,
        hostRole: undefined,
      });
      return;
    }
    const m = members.find((x) => x.user_id === value);
    if (!m) return;
    const name = `${m.user_first_name ?? ""} ${m.user_last_name ?? ""}`.trim();
    patch({
      hostUserId: m.user_id,
      hostName: name || m.user_email,
      hostAvatarUrl: m.user_avatar_thumb_url ?? m.user_avatar_url ?? undefined,
      hostEmail: m.user_email,
    });
  };

  const weekdays = ap.weekdays ?? [];
  const toggleWeekday = (day: string) =>
    patch({
      weekdays: weekdays.includes(day)
        ? weekdays.filter((d) => d !== day)
        : APPT_DAY_KEYS.filter((d) => d === day || weekdays.includes(d)),
    });

  return (
    <div className="space-y-4">
      <Field>
        <Label>{t("forms.inspector.appointment.target")}</Label>
        <FieldAnchor path={`actions.${index}.appointment`}>
          <Select
            disabled={disabled || isLoading}
            value={selectedTarget}
            onValueChange={setTarget}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={t("aiAssistants.actions.bookingPick")}
              />
            </SelectTrigger>
            <SelectContent className="max-w-[min(24rem,90vw)]">
              {myOauth.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>
                    {t("forms.inspector.appointment.targetGroupMine")}
                  </SelectLabel>
                  {accountCalendarItems(myOauth)}
                </SelectGroup>
              ) : null}
              {teamOauth.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>
                    {t("forms.inspector.appointment.targetGroupTeam")}
                  </SelectLabel>
                  {accountCalendarItems(teamOauth)}
                </SelectGroup>
              ) : null}
              {baikalConfigs.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>
                    {t("forms.inspector.appointment.targetGroupBooking")}
                  </SelectLabel>
                  {baikalConfigs.map((b) => (
                    <SelectItem key={b.id} value={`baikal:${b.id}`}>
                      <span className="flex min-w-0 items-center gap-1.5">
                        <CalDavIcon className="h-3 w-3 shrink-0" />
                        <span className="min-w-0 truncate">
                          {b.provider_name ?? b.user_name}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
              {caldavAccounts.some((a) => a.calendars.length > 0) ? (
                <SelectGroup>
                  <SelectLabel>
                    {t("forms.inspector.appointment.targetGroupCaldav")}
                  </SelectLabel>
                  {accountCalendarItems(caldavAccounts)}
                </SelectGroup>
              ) : null}
            </SelectContent>
          </Select>
        </FieldAnchor>
        <FieldHint>{t("forms.inspector.appointment.targetHelp")}</FieldHint>
      </Field>

      <Field>
        <Label>{t("aiAssistants.actions.host")}</Label>
        <HostPicker
          members={members}
          value={ap.hostUserId}
          disabled={disabled}
          onChange={setHost}
        />
        <FieldHint>{t("aiAssistants.actions.hostHint")}</FieldHint>
      </Field>

      <Field>
        <Label htmlFor={`appt-allbusy-${action.id}`}>
          {t("forms.inspector.appointment.busyCalendars")}
        </Label>
        <div className="flex h-9 items-center gap-3">
          <Switch
            id={`appt-allbusy-${action.id}`}
            disabled={disabled}
            checked={allBusy}
            onCheckedChange={(v) => patch({ busyCalendarKeys: v ? "all" : [] })}
          />
          <span className="text-sm text-muted-foreground">
            {t("forms.inspector.appointment.allCalendars")}
          </span>
        </div>
        <FieldHint>
          {t("forms.inspector.appointment.busyCalendarsHelp")}
        </FieldHint>

        {!allBusy ? (
          <div className="space-y-1.5 pt-1">
            {accounts.flatMap((a) =>
              a.calendars.map((c) => {
                const key = calendarKeyFor(a, c.id);
                return (
                  <label
                    key={key}
                    className="flex items-center gap-2 text-sm text-foreground"
                  >
                    <Checkbox
                      disabled={disabled}
                      checked={busyKeys.includes(key)}
                      onCheckedChange={(v) => toggleBusyKey(key, v === true)}
                    />
                    <span className="truncate">
                      {a.user_name} · {c.summary}
                    </span>
                  </label>
                );
              }),
            )}
            {baikalConfigs.map((b) => {
              const key = `baikal:${b.id}`;
              return (
                <label
                  key={key}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <Checkbox
                    disabled={disabled}
                    checked={busyKeys.includes(key)}
                    onCheckedChange={(v) => toggleBusyKey(key, v === true)}
                  />
                  <span className="truncate">
                    {b.provider_name ?? b.user_name}
                  </span>
                </label>
              );
            })}
          </div>
        ) : null}
      </Field>

      <Field>
        <Label>{t("forms.inspector.appointment.duration")}</Label>
        <Select
          disabled={disabled}
          value={String(ap.durationMinutes)}
          onValueChange={(v) => patch({ durationMinutes: Number(v) })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {APPT_DURATIONS.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {m} min
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <Label>{t("forms.inspector.appointment.bookableWindow")}</Label>
        <Cols>
          <Field>
            <Label
              htmlFor={`appt-ws-${action.id}`}
              className="text-xs font-normal text-muted-foreground"
            >
              {t("forms.inspector.appointment.windowStart")}
            </Label>
            <Input
              id={`appt-ws-${action.id}`}
              type="time"
              disabled={disabled}
              value={ap.window?.start ?? "09:00"}
              onChange={(e) =>
                patch({ window: { ...ap.window, start: e.target.value } })
              }
            />
          </Field>
          <Field>
            <Label
              htmlFor={`appt-we-${action.id}`}
              className="text-xs font-normal text-muted-foreground"
            >
              {t("forms.inspector.appointment.windowEnd")}
            </Label>
            <Input
              id={`appt-we-${action.id}`}
              type="time"
              disabled={disabled}
              value={ap.window?.end ?? "17:00"}
              onChange={(e) =>
                patch({ window: { ...ap.window, end: e.target.value } })
              }
            />
          </Field>
        </Cols>
      </Field>

      <Field>
        <Label>{t("forms.inspector.appointment.weekdays")}</Label>
        <div className="flex flex-wrap gap-1">
          {APPT_DAY_KEYS.map((day) => {
            const fullName = t(`appointments.businessLogic.days.${day}`);
            const on = weekdays.includes(day);
            return (
              <button
                key={day}
                type="button"
                disabled={disabled}
                title={fullName}
                aria-pressed={on}
                onClick={() => toggleWeekday(day)}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                  on
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {fullName.slice(0, 2)}
              </button>
            );
          })}
        </div>
      </Field>

      <Field>
        <Label>{t("forms.inspector.appointment.timezone")}</Label>
        <TimezoneSelect
          value={ap.timezone}
          isDisabled={disabled}
          onChange={(tz) =>
            patch({ timezone: typeof tz === "string" ? tz : tz.value })
          }
          className="[&_.react-select__control]:min-h-9 [&_.react-select__control]:rounded-lg [&_.react-select__control]:border-border [&_.react-select__control]:text-sm"
        />
      </Field>

      <Cols>
        {/* Baikal/CalDAV booking calendars carry their own scheduling rules
            server-side, so only OAuth targets expose the notice knob. */}
        {selectedTarget?.startsWith("google:") ||
        selectedTarget?.startsWith("microsoft:") ? (
          <Field>
            <Label htmlFor={`appt-notice-${action.id}`}>
              {t("forms.inspector.appointment.minNotice")}
            </Label>
            <Input
              id={`appt-notice-${action.id}`}
              type="number"
              min={0}
              disabled={disabled}
              value={ap.minNoticeHours ?? 2}
              onChange={(e) =>
                patch({
                  minNoticeHours:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </Field>
        ) : null}
        <Field>
          <Label htmlFor={`appt-ahead-${action.id}`}>
            {t("forms.inspector.appointment.maxDaysAhead")}
          </Label>
          <Input
            id={`appt-ahead-${action.id}`}
            type="number"
            min={1}
            disabled={disabled}
            value={ap.maxDaysAhead ?? 30}
            onChange={(e) =>
              patch({
                maxDaysAhead:
                  e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
          />
        </Field>
      </Cols>

      {account?.auth_failed ? (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          {t("forms.inspector.appointment.accountNeedsReconnect")}
        </p>
      ) : null}
    </div>
  );
}
