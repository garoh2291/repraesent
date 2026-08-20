import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarPlus,
  Heading,
  MousePointerClick,
  SendHorizontal,
  Sliders,
} from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import TimezoneSelect from "react-timezone-select";
import { calendarKeyFor, listCalendarAccounts } from "~/lib/api/calendar";
import { Checkbox } from "~/components/ui/checkbox";
import { CalDavIcon } from "~/components/icons/CalDavIcon";
import { GoogleIcon } from "~/components/icons/GoogleIcon";
import {
  Cols,
  EmptyPanelState,
  Panel,
  PanelBody,
  PanelHeader,
  PanelSection,
} from "~/components/forms/chrome";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
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
import { LabelEditor } from "~/components/forms/LabelEditor";
import { Field, FieldHint } from "~/components/wordpress/fields";
import {
  FIELD_TYPE_META,
  isFieldDeletable,
  snakeKeyRaw,
} from "~/lib/forms/field-types";
import type { InspectorTarget } from "~/lib/forms/selection";
import {
  FORM_FIELD_MAPPINGS,
  contentKey,
  hasOptions,
  isPresentational,
  type FormField,
  type FormFieldMapping,
} from "~/lib/forms/schema";
import { OptionsEditor } from "./OptionsEditor";

const NO_MAPPING = "__none__";

/**
 * Field types for which `TypeSpecific` renders something. Kept in step with its
 * switch by hand — the alternative is rendering the element and testing it for
 * null, which JSX makes impossible (an element is always truthy), and an empty
 * "Rules" section reads as a bug.
 */
const HAS_TYPE_RULES = new Set<FormField["type"]>([
  "short_text",
  "long_text",
  "number",
  "date",
  "checkbox_group",
  "rating",
  "scale",
  "address",
  "hidden",
  "appointment",
]);

interface Props {
  /** What is selected on the canvas: a field, the form header, or the submit button. */
  target: InspectorTarget | null;
  /** Keys used by every OTHER field, for the uniqueness check. Field mode only. */
  otherKeys?: Set<string>;
  /** Mappings claimed by every OTHER field. Field mode only. */
  otherMappings?: Set<string>;
  disabled?: boolean;
  /** Read a content string for the locale being edited (no fallback). */
  getText: (key: string) => string;
  setText: (key: string, value: string) => void;
  onChange?: (patch: Partial<FormField>) => void;
}

export function FieldInspector({
  target,
  otherKeys,
  otherMappings,
  disabled,
  getText,
  setText,
  onChange,
}: Props) {
  const { t } = useTranslation();

  /**
   * The e-mail address is the reply channel, so it is never optional.
   *
   * This has to sit ABOVE the early returns below. Three of the four branches
   * of this component return before reaching the field editor, so a hook placed
   * down there runs on some renders and not others — which is exactly the
   * "rendered more hooks than during the previous render" crash you get by
   * selecting the header and then a field.
   *
   * So it reads `target` defensively and no-ops for every non-field selection.
   */
  const emailField =
    target?.kind === "field" &&
    (target.field.type === "email" || target.field.mapping === "email")
      ? target.field
      : null;

  // Correct the stored value as well as the control: a definition saved before
  // this rule existed can carry required:false, and a switch that shows "on"
  // while the form still accepts a blank e-mail would be a lie.
  useEffect(() => {
    if (!emailField || disabled || !onChange) return;
    if (emailField.validation?.required === true) return;
    onChange({
      validation: { ...(emailField.validation ?? {}), required: true },
    });
  }, [emailField, disabled, onChange]);

  if (!target) {
    return (
      <Panel>
        <PanelHeader
          icon={<Sliders className="h-3.5 w-3.5" />}
          title={t("forms.inspector.title")}
        />
        <EmptyPanelState
          icon={<MousePointerClick className="h-5 w-5" />}
          title={t("forms.inspector.none")}
          hint={t("forms.inspector.noneHint")}
        />
      </Panel>
    );
  }

  // The form header and the submit button live at form.* content keys, so the
  // getText/setText closures the route already passes (which carry the active
  // locale) cover them with no extra plumbing. This component stays
  // locale-agnostic.
  if (target.kind === "header") {
    return (
      <Panel>
        <PanelHeader
          icon={<Heading className="h-3.5 w-3.5" />}
          title={t("forms.inspector.header")}
        />
        <PanelBody>
          <Field>
            <Label htmlFor="fi-form-title">
              {t("forms.inspector.formTitle")}
            </Label>
            <Input
              id="fi-form-title"
              disabled={disabled}
              value={getText(contentKey.formTitle())}
              onChange={(e) => setText(contentKey.formTitle(), e.target.value)}
            />
          </Field>

          <Field>
            <Label htmlFor="fi-form-desc">
              {t("forms.inspector.formDescription")}
            </Label>
            <Textarea
              id="fi-form-desc"
              rows={3}
              disabled={disabled}
              value={getText(contentKey.formDescription())}
              onChange={(e) =>
                setText(contentKey.formDescription(), e.target.value)
              }
            />
          </Field>

          {!target.showFormTitle ? (
            <FieldHint>{t("forms.inspector.titleHiddenHint")}</FieldHint>
          ) : (
            <FieldHint>{t("forms.inspector.headerHint")}</FieldHint>
          )}
        </PanelBody>
      </Panel>
    );
  }

  if (target.kind === "submit") {
    const caption = getText(contentKey.formSubmit());
    return (
      <Panel>
        <PanelHeader
          icon={<SendHorizontal className="h-3.5 w-3.5" />}
          title={t("forms.inspector.submit")}
        />
        <PanelBody>
          <Field>
            <Label htmlFor="fi-submit">
              {t("forms.inspector.submitCaption")}
            </Label>
            <Input
              id="fi-submit"
              disabled={disabled}
              value={caption}
              aria-invalid={caption.trim() === "" || undefined}
              onChange={(e) => setText(contentKey.formSubmit(), e.target.value)}
            />
            <FieldHint>{t("forms.inspector.submitHint")}</FieldHint>
          </Field>
        </PanelBody>
      </Panel>
    );
  }

  const field = target.field;

  const patchField = onChange ?? (() => undefined);
  const validation = field.validation ?? {};
  const patchValidation = (patch: Partial<FormField["validation"]>) =>
    patchField({ validation: { ...validation, ...patch } });

  const keyCollides = otherKeys?.has(field.key) ?? false;
  const keyBlank = field.key.trim() === "";
  const presentational = isPresentational(field.type);
  /**
   * Same rule as the delete guard: a field carrying the only `email` or name
   * mapping is holding the publish requirement up, so it may be renamed and
   * reordered but not repointed. `siblings` is reconstructed from otherKeys
   * only for the mapping check, so isFieldDeletable sees the whole picture.
   */
  const mappingLocked =
    !!field.mapping &&
    !isFieldDeletable(field, [
      field,
      ...[...(otherMappings ?? [])].map(
        (m) => ({ id: `other:${m}`, mapping: m }) as FormField,
      ),
    ]);

  const FieldIcon = FIELD_TYPE_META[field.type].icon;
  const mappable = !presentational && field.type !== "hidden";
  /** Enforced by the effect at the top of the component; see the note there. */
  const requiredLocked = emailField != null;

  // For an appointment field the Rules section IS the field — target calendar,
  // duration, window — while Data (key, label) is secondary. Everywhere else
  // Rules stays last, in its historical place.
  const rulesSection = HAS_TYPE_RULES.has(field.type) ? (
    <PanelSection title={t("forms.inspector.sectionRules")}>
      <TypeSpecific
        field={field}
        disabled={disabled}
        onChange={patchField}
        patchValidation={patchValidation}
        getText={getText}
        setText={setText}
      />
    </PanelSection>
  ) : null;
  const rulesFirst = field.type === "appointment";

  return (
    <Panel>
      <PanelHeader
        icon={<FieldIcon className="h-3.5 w-3.5" />}
        title={t("forms.inspector.title")}
        action={
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            {t(`forms.palette.${field.type}`)}
          </span>
        }
      />
      <PanelBody>
        {rulesFirst ? rulesSection : null}
        <PanelSection title={t("forms.inspector.sectionData")}>
          {/* Save-to first: it is the decision, and the key is its consequence
              — a field pointed at a lead column has its key largely settled. */}
          {mappable ? (
            <Field>
              <Label>{t("forms.inspector.mapping")}</Label>
              <Select
                disabled={disabled || mappingLocked}
                value={field.mapping ?? NO_MAPPING}
                onValueChange={(v) =>
                  patchField({
                    mapping: v === NO_MAPPING ? null : (v as FormFieldMapping),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MAPPING}>
                    {t("forms.inspector.mappingNone")}
                  </SelectItem>
                  {FORM_FIELD_MAPPINGS.map((mapping) => (
                    <SelectItem
                      key={mapping}
                      value={mapping}
                      // A lead column can only be filled once.
                      disabled={otherMappings?.has(mapping) ?? false}
                    >
                      {t(`forms.mapping.${mapping}`, {
                        defaultValue: mapping.replace(/_/g, " "),
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Locked while this field is the only thing satisfying the
                  e-mail or name requirement. Repointing it elsewhere would make
                  the form unpublishable, discovered later and somewhere else —
                  the same reasoning that disables its delete button. */}
              <FieldHint>
                {mappingLocked
                  ? t("forms.inspector.mappingLocked")
                  : t("forms.inspector.mappingHint")}
              </FieldHint>
            </Field>
          ) : null}

          <Field>
            <Label htmlFor="fi-key">{t("forms.inspector.key")}</Label>
            <Input
              id="fi-key"
              disabled={disabled}
              value={field.key}
              aria-invalid={keyCollides || keyBlank || undefined}
              // snakeKeyRaw, not snakeKey: the fallback version substituted
              // "field" for an empty box, so deleting the last character of a
              // key silently renamed it and it could never be cleared.
              onChange={(e) => patchField({ key: snakeKeyRaw(e.target.value) })}
              className="font-mono text-sm"
            />
            {keyBlank ? (
              <p className="text-xs text-destructive">
                {t("forms.inspector.keyRequired")}
              </p>
            ) : keyCollides ? (
              <p className="text-xs text-destructive">
                {t("forms.inspector.keyInUse")}
              </p>
            ) : (
              <FieldHint>{t("forms.inspector.keyHint")}</FieldHint>
            )}
          </Field>
        </PanelSection>

        <PanelSection title={t("forms.inspector.sectionContent")}>
          {/* First, and outside the two-column grid: whether an answer is
              mandatory changes what the label means, so it is read before the
              wording rather than after it. */}
          {mappable ? (
            <Field>
              <Label htmlFor="fi-required">
                {t("forms.inspector.required")}
              </Label>
              <div className="flex h-9 items-center">
                <Switch
                  id="fi-required"
                  disabled={disabled || requiredLocked}
                  checked={requiredLocked || validation.required === true}
                  onCheckedChange={(v) => patchValidation({ required: v })}
                />
              </div>
              {/* The address is the only way to answer a submission, and a lead
                  with none is a dead record. Shown rather than silently forced,
                  so an optional-looking switch that ignores you does not read
                  as a bug. */}
              {requiredLocked ? (
                <FieldHint>{t("forms.inspector.requiredLocked")}</FieldHint>
              ) : null}
            </Field>
          ) : null}

          {presentational ? (
            <Field>
              <Label htmlFor="fi-text">{t("forms.inspector.text")}</Label>
              <Textarea
                id="fi-text"
                rows={3}
                disabled={disabled}
                value={getText(contentKey.fieldText(field.id))}
                onChange={(e) =>
                  setText(contentKey.fieldText(field.id), e.target.value)
                }
              />
            </Field>
          ) : (
            <>
              <Field>
                <Label htmlFor="fi-label">{t("forms.inspector.label")}</Label>
                <LabelEditor
                  id="fi-label"
                  disabled={disabled}
                  // Only the consent checkbox carries copy long enough to need
                  // the room; every other label is a couple of words.
                  multiline={field.type === "checkbox"}
                  value={getText(contentKey.fieldLabel(field.id))}
                  onChange={(value) =>
                    setText(contentKey.fieldLabel(field.id), value)
                  }
                />
                <FieldHint>{t("forms.inspector.labelHint")}</FieldHint>
              </Field>

              {field.type !== "checkbox" ? (
                <Field>
                  <Label htmlFor="fi-ph">
                    {t("forms.inspector.placeholder")}
                  </Label>
                  <Input
                    id="fi-ph"
                    disabled={disabled}
                    value={getText(contentKey.fieldPlaceholder(field.id))}
                    onChange={(e) =>
                      setText(
                        contentKey.fieldPlaceholder(field.id),
                        e.target.value,
                      )
                    }
                  />
                </Field>
              ) : null}

              <Field>
                <Label htmlFor="fi-help">{t("forms.inspector.help")}</Label>
                <Input
                  id="fi-help"
                  disabled={disabled}
                  value={getText(contentKey.fieldHelp(field.id))}
                  onChange={(e) =>
                    setText(contentKey.fieldHelp(field.id), e.target.value)
                  }
                />
              </Field>
            </>
          )}

          {hasOptions(field.type) ? (
            <Field>
              <Label>{t("forms.inspector.options")}</Label>
              <OptionsEditor
                options={field.options ?? []}
                disabled={disabled}
                labelFor={(optionId) =>
                  getText(contentKey.fieldOption(field.id, optionId))
                }
                onLabelChange={(optionId, label) =>
                  setText(contentKey.fieldOption(field.id, optionId), label)
                }
                onChange={(options) => patchField({ options })}
              />
            </Field>
          ) : null}
        </PanelSection>

        <PanelSection title={t("forms.inspector.sectionLayout")}>
          <Field>
            <Label>{t("forms.inspector.width")}</Label>
            <Select
              disabled={disabled}
              value={field.width}
              onValueChange={(v) =>
                patchField({ width: v as FormField["width"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">
                  {t("forms.inspector.widthFull")}
                </SelectItem>
                <SelectItem value="half">
                  {t("forms.inspector.widthHalf")}
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </PanelSection>

        {rulesFirst ? null : rulesSection}
      </PanelBody>
    </Panel>
  );
}

function TypeSpecific({
  field,
  disabled,
  onChange,
  patchValidation,
  getText,
  setText,
}: {
  field: FormField;
  disabled?: boolean;
  onChange: (patch: Partial<FormField>) => void;
  patchValidation: (patch: Partial<FormField["validation"]>) => void;
  getText: (key: string) => string;
  setText: (key: string, value: string) => void;
}) {
  const { t } = useTranslation();
  const v = field.validation ?? {};

  const numberInput = (
    id: string,
    label: string,
    value: number | undefined,
    onValue: (n: number | undefined) => void,
  ) => (
    <Field>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        disabled={disabled}
        value={value ?? ""}
        onChange={(e) =>
          onValue(e.target.value === "" ? undefined : Number(e.target.value))
        }
      />
    </Field>
  );

  switch (field.type) {
    case "short_text":
    case "long_text":
      return (
        <Cols>
          {numberInput(
            "fi-minl",
            t("forms.inspector.minLength"),
            v.minLength,
            (n) => patchValidation({ minLength: n }),
          )}
          {numberInput(
            "fi-maxl",
            t("forms.inspector.maxLength"),
            v.maxLength,
            (n) => patchValidation({ maxLength: n }),
          )}
        </Cols>
      );

    case "number":
      return (
        <Cols>
          {numberInput("fi-min", t("forms.inspector.min"), v.min, (n) =>
            patchValidation({ min: n }),
          )}
          {numberInput("fi-max", t("forms.inspector.max"), v.max, (n) =>
            patchValidation({ max: n }),
          )}
        </Cols>
      );

    case "date":
      return (
        <Cols>
          <Field>
            <Label htmlFor="fi-mind">{t("forms.inspector.minDate")}</Label>
            <Input
              id="fi-mind"
              type="date"
              disabled={disabled}
              value={v.minDate ?? ""}
              onChange={(e) =>
                patchValidation({ minDate: e.target.value || undefined })
              }
            />
          </Field>
          <Field>
            <Label htmlFor="fi-maxd">{t("forms.inspector.maxDate")}</Label>
            <Input
              id="fi-maxd"
              type="date"
              disabled={disabled}
              value={v.maxDate ?? ""}
              onChange={(e) =>
                patchValidation({ maxDate: e.target.value || undefined })
              }
            />
          </Field>
        </Cols>
      );

    case "checkbox_group":
      return (
        <Cols>
          {numberInput(
            "fi-mins",
            t("forms.inspector.minSelected"),
            v.minSelected,
            (n) => patchValidation({ minSelected: n }),
          )}
          {numberInput(
            "fi-maxs",
            t("forms.inspector.maxSelected"),
            v.maxSelected,
            (n) => patchValidation({ maxSelected: n }),
          )}
        </Cols>
      );

    case "rating":
      return numberInput(
        "fi-rmax",
        t("forms.inspector.ratingMax"),
        field.ratingMax ?? 5,
        (n) => onChange({ ratingMax: n ?? 5 }),
      );

    case "scale":
      return (
        <Cols>
          {numberInput(
            "fi-smin",
            t("forms.inspector.scaleMin"),
            field.scale?.min ?? 1,
            (n) =>
              onChange({ scale: { min: n ?? 1, max: field.scale?.max ?? 10 } }),
          )}
          {numberInput(
            "fi-smax",
            t("forms.inspector.scaleMax"),
            field.scale?.max ?? 10,
            (n) =>
              onChange({ scale: { min: field.scale?.min ?? 1, max: n ?? 10 } }),
          )}
        </Cols>
      );

    case "address": {
      const parts = field.addressParts ?? {
        street: true,
        city: true,
        zip: true,
        country: false,
      };
      return (
        <Field>
          <Label>{t("forms.inspector.addressParts")}</Label>
          <FieldHint>{t("forms.inspector.addressPartsHint")}</FieldHint>

          {/* One block per part rather than one cramped row. The label input
              used to be a 10rem box wedged beside the switch, which is where
              "address is bugged" came from: it was too narrow to read what you
              had typed, and it vanished the moment the part was switched off,
              taking the text with it visually even though the content key kept
              it. Each part now gets a full-width input under its own toggle. */}
          <div className="space-y-2">
            {(["street", "zip", "city", "country"] as const).map((part) => (
              <div
                key={part}
                className={`rounded-lg border p-2.5 transition-colors ${
                  parts[part] ? "bg-muted/20" : "bg-transparent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Switch
                    id={`fi-addr-${part}`}
                    size="sm"
                    disabled={disabled}
                    checked={parts[part]}
                    onCheckedChange={(checked) =>
                      onChange({ addressParts: { ...parts, [part]: checked } })
                    }
                  />
                  <Label
                    htmlFor={`fi-addr-${part}`}
                    className="flex-1 font-normal"
                  >
                    {t(`forms.inspector.${part}`)}
                  </Label>
                </div>

                {parts[part] ? (
                  <Input
                    className="mt-2 h-8 w-full text-sm"
                    disabled={disabled}
                    aria-label={t("forms.inspector.addressPartLabel", {
                      part: t(`forms.inspector.${part}`),
                    })}
                    value={getText(contentKey.fieldAddressPart(field.id, part))}
                    placeholder={t(`forms.inspector.${part}`)}
                    onChange={(e) =>
                      setText(
                        contentKey.fieldAddressPart(field.id, part),
                        e.target.value,
                      )
                    }
                  />
                ) : null}
              </div>
            ))}
          </div>
        </Field>
      );
    }

    case "hidden":
      return (
        <Field>
          <Label htmlFor="fi-hidden">{t("forms.inspector.hiddenValue")}</Label>
          <Input
            id="fi-hidden"
            disabled={disabled}
            value={field.hiddenValue ?? ""}
            onChange={(e) => onChange({ hiddenValue: e.target.value })}
            className="font-mono text-sm"
          />
          <FieldHint>{t("forms.inspector.hiddenValueHint")}</FieldHint>
        </Field>
      );

    case "appointment":
      return (
        <AppointmentConfig field={field} disabled={disabled} onChange={onChange} />
      );

    default:
      return null;
  }
}

/** Weekday keys in strip order — Monday first, like the Business hours tab. */
const APPT_DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const APPT_DURATIONS = [15, 30, 45, 60] as const;

/**
 * The slot-picker configuration: which calendar receives the booking, which
 * calendars block slots, and the bookable window. A separate component rather
 * than a `case` body because it needs a query (the workspace's connected
 * calendars) and hooks cannot live inside a switch.
 */
function AppointmentConfig({
  field,
  disabled,
  onChange,
}: {
  field: FormField;
  disabled?: boolean;
  onChange: (patch: Partial<FormField>) => void;
}) {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ["calendar-accounts"],
    queryFn: listCalendarAccounts,
  });

  const ap = field.appointment ?? {
    accountId: "",
    calendarId: "",
    busyCalendarKeys: "all" as const,
    durationMinutes: 30,
    window: { start: "09:00", end: "17:00" },
    weekdays: ["mon", "tue", "wed", "thu", "fri"],
    timezone: "Europe/Berlin",
    minNoticeHours: 2,
    maxDaysAhead: 30,
  };

  const patch = (p: Partial<NonNullable<FormField["appointment"]>>) =>
    onChange({ appointment: { ...ap, ...p } });

  const accounts = data?.accounts ?? [];
  const baikalConfigs = data?.baikal_configs ?? [];

  // Only calendars we can create events in are valid booking targets. CalDAV
  // calendars are always "owner" — Basic-auth credentials are the owner's own.
  const writableCalendars = (a: (typeof accounts)[number]) =>
    a.calendars.filter(
      (c) => c.accessRole === "owner" || c.accessRole === "writer",
    );

  const googleAccounts = accounts.filter((a) => a.provider === "google");
  const caldavAccounts = accounts.filter((a) => a.provider === "caldav");
  const myGoogle = googleAccounts.filter((a) => a.is_own);
  const teamGoogle = googleAccounts.filter((a) => !a.is_own);

  // Empty state only when NOTHING can receive a booking — a workspace with a
  // Baikal config or a CalDAV calendar but no Google account still has targets.
  const hasTargets =
    googleAccounts.some((a) => writableCalendars(a).length > 0) ||
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

  // The selected target via the resolution rule: explicit key first, else the
  // legacy Google pair every pre-targetKey definition stored.
  const selectedTarget =
    ap.targetKey ||
    (ap.accountId && ap.calendarId
      ? `google:${ap.accountId}:${ap.calendarId}`
      : undefined);

  const setTarget = (key: string) => {
    if (key.startsWith("google:")) {
      // DUAL-WRITE the legacy pair: a backend rolled back to before targetKey
      // existed still books Google targets from accountId/calendarId.
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

  // The account behind the selected target, for the reconnect warning below.
  // Both `google:` and `caldav:` keys carry the account id as segment two.
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
                {/* Provider marker: a calendar name + colour alone can't
                    tell a Google calendar from a CalDAV one. */}
                {a.provider === "google" && (
                  <GoogleIcon className="h-3 w-3 shrink-0" />
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

  const weekdays = ap.weekdays ?? [];
  const toggleWeekday = (day: string) =>
    patch({
      weekdays: weekdays.includes(day)
        ? weekdays.filter((d) => d !== day)
        : APPT_DAY_KEYS.filter((d) => d === day || weekdays.includes(d)),
    });

  return (
    <>
      <Field>
        <Label>{t("forms.inspector.appointment.target")}</Label>
        <Select
          disabled={disabled || isLoading}
          value={selectedTarget}
          onValueChange={setTarget}
        >
          {/* The base trigger is w-fit + nowrap, so a long
              "calendar · email" label would push past the panel edge.
              Full width + the trigger's own line-clamp keeps it inside. */}
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          {/* popper + align=end: the inspector sits at the right screen edge,
              so a dropdown wider than its trigger must grow LEFT — the
              default item-aligned position pins it to the right and clips. */}
          <SelectContent
            position="popper"
            align="end"
            className="max-w-[min(24rem,90vw)]"
          >
            {myGoogle.length > 0 ? (
              <SelectGroup>
                <SelectLabel>
                  {t("forms.inspector.appointment.targetGroupMine")}
                </SelectLabel>
                {accountCalendarItems(myGoogle)}
              </SelectGroup>
            ) : null}
            {teamGoogle.length > 0 ? (
              <SelectGroup>
                <SelectLabel>
                  {t("forms.inspector.appointment.targetGroupTeam")}
                </SelectLabel>
                {accountCalendarItems(teamGoogle)}
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
                      {/* Baikal is CalDAV under the hood — same mark. */}
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
        <FieldHint>{t("forms.inspector.appointment.targetHelp")}</FieldHint>
      </Field>

      <Field>
        <Label htmlFor="fi-appt-allbusy">
          {t("forms.inspector.appointment.busyCalendars")}
        </Label>
        <div className="flex h-9 items-center gap-3">
          <Switch
            id="fi-appt-allbusy"
            disabled={disabled}
            checked={allBusy}
            onCheckedChange={(v) =>
              patch({ busyCalendarKeys: v ? "all" : [] })
            }
          />
          <span className="text-sm text-muted-foreground">
            {t("forms.inspector.appointment.allCalendars")}
          </span>
        </div>
        <FieldHint>{t("forms.inspector.appointment.busyCalendarsHelp")}</FieldHint>

        {!allBusy ? (
          <div className="space-y-1.5 pt-1">
            {accounts.flatMap((a) =>
              a.calendars.map((c) => {
                // calendarKeyFor percent-encodes caldav calendar URLs — these
                // keys are stored in the form definition and parsed serverside.
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
              htmlFor="fi-appt-ws"
              className="text-xs font-normal text-muted-foreground"
            >
              {t("forms.inspector.appointment.windowStart")}
            </Label>
            <Input
              id="fi-appt-ws"
              type="time"
              disabled={disabled}
              value={ap.window?.start ?? "09:00"}
              onChange={(e) =>
                patch({
                  window: { ...ap.window, start: e.target.value },
                })
              }
            />
          </Field>
          <Field>
            <Label
              htmlFor="fi-appt-we"
              className="text-xs font-normal text-muted-foreground"
            >
              {t("forms.inspector.appointment.windowEnd")}
            </Label>
            <Input
              id="fi-appt-we"
              type="time"
              disabled={disabled}
              value={ap.window?.end ?? "17:00"}
              onChange={(e) =>
                patch({
                  window: { ...ap.window, end: e.target.value },
                })
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
                className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                  on
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-transparent text-muted-foreground hover:text-foreground"
                }`}
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
        {/* Only Google targets expose the notice setting: Baikal/CalDAV
            booking calendars carry their own scheduling rules on the server
            side, so a second knob here would just fight them. The default
            (2h) still applies to slot computation. */}
        {selectedTarget?.startsWith("google:") ? (
          <Field>
            <Label htmlFor="fi-appt-notice">
              {t("forms.inspector.appointment.minNotice")}
            </Label>
            <Input
              id="fi-appt-notice"
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
          <Label htmlFor="fi-appt-ahead">
            {t("forms.inspector.appointment.maxDaysAhead")}
          </Label>
          <Input
            id="fi-appt-ahead"
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
    </>
  );
}
