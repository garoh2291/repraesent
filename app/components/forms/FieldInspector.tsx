import { useQuery } from "@tanstack/react-query";
import { calendarLabel } from "~/lib/calendar/calendar-label";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Heading,
  ListOrdered,
  MousePointerClick,
  SendHorizontal,
  Sliders,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PHONE_COUNTRIES, phoneCountry, presetPhoneCountry } from "~/lib/forms/phone";
import { CountryPicker } from "~/components/ui/country-picker";

const PHONE_CODES = PHONE_COUNTRIES.map((c) => c.iso);
const phoneDialLabel = (iso: string) => {
  const c = phoneCountry(iso);
  return c ? `+${c.dial}` : "";
};
import { cn } from "~/lib/utils";
import { Link } from "react-router";
import { TimezonePicker } from "~/components/ui/timezone-picker";
import { calendarKeyFor, listCalendarAccounts } from "~/lib/api/calendar";
import { usePilotFeatures } from "~/lib/feature-flags";
import {
  NativeCalendarPicker,
  TargetKindSwitch,
  isNativeKey,
  nativeTargetPatch,
} from "~/components/appointment-book/native-target";
import { CalDavIcon } from "~/components/icons/CalDavIcon";
import { GoogleIcon } from "~/components/icons/GoogleIcon";
import { MicrosoftIcon } from "~/components/icons/MicrosoftIcon";
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
import { AdvancedSection } from "~/components/notebook/advanced-section";
import {
  appointmentDefaults,
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
  type AppointmentHost,
  type FormCommerce,
  type FormField,
  type FormFieldMapping,
} from "~/lib/forms/schema";
import {
  derivedHosts,
  hostsPatch,
  primaryTargetKeyOf,
} from "~/lib/forms/appointment-hosts";
import { useWorkspaceMembers } from "~/lib/hooks/useWorkspaceMembers";
import {
  fieldForService,
  pickSharedRules,
  serviceFromField,
  servicesPatch,
  withServiceTarget,
} from "~/lib/forms/appointment-services";
import { useAppointmentCalendars } from "~/lib/hooks/useAppointmentBook";
import { AppointmentServiceList } from "./AppointmentServiceList";
import { BusyCalendarPicker } from "./BusyCalendarPicker";
import { AppointmentHostList } from "./AppointmentHostList";
import { OptionsEditor } from "./OptionsEditor";
import { ProductFieldInspector } from "./products/ProductFieldInspector";

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
  "phone",
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
  /** Multi-step: move the selected field into another step. */
  onMoveToStep?: (stepId: string) => void;
  /** Step target: reorder / delete the step. */
  onMoveStep?: (direction: -1 | 1) => void;
  onDeleteStep?: () => void;
  /** Product field: the bundle + checkout options it edits (definition.commerce). */
  commerce?: FormCommerce;
  onCommerceChange?: (patch: Partial<FormCommerce>) => void;
  /** Price ids the server reports as archived in Stripe. */
  archivedPriceIds?: ReadonlySet<string>;
  /** Delete the selected field (product inspector's header action). */
  onDeleteField?: () => void;
}

const EMPTY_IDS: ReadonlySet<string> = new Set();

export function FieldInspector({
  target,
  otherKeys,
  otherMappings,
  disabled,
  getText,
  setText,
  onChange,
  onMoveToStep,
  onMoveStep,
  onDeleteStep,
  commerce,
  onCommerceChange,
  archivedPriceIds,
  onDeleteField,
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

  // A step is a section with a title and a description — the same content keys
  // sections always had, now with somewhere to edit them.
  if (target.kind === "step") {
    const { section, index, total } = target;
    return (
      <Panel>
        <PanelHeader
          icon={<ListOrdered className="h-3.5 w-3.5" />}
          title={t("forms.inspector.step")}
          meta={
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
              {index + 1}/{total}
            </span>
          }
        />
        <PanelBody>
          <PanelSection title={t("forms.inspector.sectionContent")}>
            <Field>
              <Label htmlFor="fi-step-title">
                {t("forms.inspector.stepTitle")}
              </Label>
              <Input
                id="fi-step-title"
                disabled={disabled}
                value={getText(contentKey.sectionTitle(section.id))}
                onChange={(e) =>
                  setText(contentKey.sectionTitle(section.id), e.target.value)
                }
              />
            </Field>
            <Field>
              <Label htmlFor="fi-step-desc">
                {t("forms.inspector.stepDescription")}
              </Label>
              <Textarea
                id="fi-step-desc"
                rows={3}
                disabled={disabled}
                value={getText(contentKey.sectionDescription(section.id))}
                onChange={(e) =>
                  setText(
                    contentKey.sectionDescription(section.id),
                    e.target.value,
                  )
                }
              />
            </Field>
            <FieldHint>{t("forms.inspector.stepHint")}</FieldHint>
          </PanelSection>

          <PanelSection title={t("forms.inspector.sectionLayout")}>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={disabled || index === 0 || !onMoveStep}
                onClick={() => onMoveStep?.(-1)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {t("forms.steps.moveLeft")}
              </button>
              <button
                type="button"
                disabled={disabled || index === total - 1 || !onMoveStep}
                onClick={() => onMoveStep?.(1)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("forms.steps.moveRight")}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={disabled || total <= 1 || !onDeleteStep}
                onClick={() => onDeleteStep?.()}
                title={
                  total <= 1
                    ? t("forms.steps.deleteLast")
                    : t("forms.steps.delete")
                }
                className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("forms.steps.delete")}
              </button>
            </div>
            <FieldHint>{t("forms.inspector.stepLayoutHint")}</FieldHint>
          </PanelSection>
        </PanelBody>
      </Panel>
    );
  }

  // The product field carries the whole bundle + checkout configuration, the
  // way an appointment field carries its calendar. Its own component.
  if (target.kind === "field" && target.field.type === "product") {
    return (
      <ProductFieldInspector
        commerce={commerce}
        onChange={(patch) => onCommerceChange?.(patch)}
        archivedPriceIds={archivedPriceIds ?? EMPTY_IDS}
        disabled={disabled}
        getText={getText}
        setText={setText}
        onDelete={onDeleteField}
      />
    );
  }

  const field = target.field;
  const steps = target.steps ?? [];

  const patchField = onChange ?? (() => undefined);
  const validation = field.validation ?? {};
  const patchValidation = (patch: Partial<FormField["validation"]>) =>
    patchField({ validation: { ...validation, ...patch } });

  const keyCollides = otherKeys?.has(field.key) ?? false;
  const keyBlank = field.key.trim() === "";
  /**
   * keyMissing / duplicateKey / duplicateMapping all live in the Advanced box.
   * otherMappings excludes this field, so a hit means two fields share a
   * column — possible in a definition saved before the Select disabled it.
   */
  const mappingCollides =
    !!field.mapping && (otherMappings?.has(field.mapping) ?? false);
  const dataProblem = keyBlank || keyCollides || mappingCollides;
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
  // duration, window — so it leads. Everywhere else Rules follows Layout. The
  // Data settings (save to, internal name) always close the panel, behind
  // Advanced.
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

          {/* Multi-step only: which step this field lives on. Dragging the row
              onto a step pill does the same; this is the keyboard-friendly way. */}
          {steps.length > 1 && onMoveToStep ? (
            <Field>
              <Label>{t("forms.steps.moveTo")}</Label>
              <Select
                disabled={disabled}
                value={target.stepId ?? steps[0]?.id}
                onValueChange={(v) => onMoveToStep(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {steps.map((section, i) => {
                    const title = getText(contentKey.sectionTitle(section.id));
                    return (
                      <SelectItem key={section.id} value={section.id}>
                        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                          {i + 1}
                        </span>{" "}
                        {title || t("forms.steps.stepN", { n: i + 1 })}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
        </PanelSection>

        {rulesFirst ? null : rulesSection}

        {/* Where the answer lands and what it is called internally. Both are
            set automatically, so they wait behind Advanced — and open by
            themselves when one of them blocks publishing, so tucking them
            away never hides the error. */}
        <AdvancedSection
          storageKey="forms-field-data"
          hint={t("forms.inspector.dataHint")}
          forceOpen={dataProblem}
        >
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
        </AdvancedSection>
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

    case "phone": {
      // Which country the phone box starts on. Automatic = the visitor's own
      // country (device time zone, browser region), then the form's language.
      return (
        <Field>
          <Label>{t("forms.inspector.phoneCountry")}</Label>
          <CountryPicker
            label={t("forms.inspector.phoneCountry")}
            value={presetPhoneCountry(field.phoneCountry) ?? ""}
            onChange={(code) => onChange({ phoneCountry: code || undefined })}
            disabled={disabled}
            codes={PHONE_CODES}
            detail={phoneDialLabel}
            emptyOption={t("forms.inspector.phoneCountryAuto")}
          />
          <FieldHint>{t("forms.inspector.phoneCountryHint")}</FieldHint>
        </Field>
      );
    }

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
        <AppointmentSettings
          field={field}
          disabled={disabled}
          onChange={onChange}
          getText={getText}
          setText={setText}
        />
      );

    default:
      return null;
  }
}

/** Weekday keys in strip order — Monday first, like the Business hours tab. */
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

const APPT_DISPLAYS = ["strip", "month", "list"] as const;

/**
 * Everything about an appointment field: how the visitor picks a time, whether
 * they first choose WHAT to book, and where each booking goes.
 */
function AppointmentSettings({
  field,
  disabled,
  onChange,
  getText,
  setText,
}: {
  field: FormField;
  disabled?: boolean;
  onChange: (patch: Partial<FormField>) => void;
  getText: (key: string) => string;
  setText: (key: string, value: string) => void;
}) {
  const { t } = useTranslation();
  const ap = field.appointment ?? appointmentDefaults();
  const services = ap.services ?? [];
  const display = ap.display ?? "strip";
  const calendars = useAppointmentCalendars(services.length > 0).data ?? [];

  const patch = (p: Partial<NonNullable<FormField["appointment"]>>) =>
    onChange({ appointment: { ...ap, ...p } });

  // A service whose name is still blank takes its calendar's name. Written one
  // at a time, a render apart: the builder's text and field edits each replace
  // the whole draft, so two in one tick would lose one.
  const [seeds, setSeeds] = useState<Array<{ key: string; value: string }>>([]);
  useEffect(() => {
    if (seeds.length === 0) return;
    const [next, ...rest] = seeds;
    if (!getText(next.key).trim()) setText(next.key, next.value);
    setSeeds(rest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeds]);
  const seedName = (serviceId: string, targetKey: string | undefined) => {
    const calendar = calendars.find((c) => c.key === targetKey);
    if (!calendar) return;
    const key = contentKey.fieldServiceName(field.id, serviceId);
    if (getText(key).trim()) return;
    setSeeds((list) => [...list, { key, value: calendar.name }]);
  };

  const firstConnected = services.find(
    (s) => !!s.targetKey && !isNativeKey(s.targetKey),
  );

  return (
    <div className="space-y-5">
      <Field>
        <Label>{t("forms.inspector.appointment.display.label")}</Label>
        <div
          role="radiogroup"
          aria-label={t("forms.inspector.appointment.display.label")}
          className="space-y-1.5"
        >
          {APPT_DISPLAYS.map((value) => {
            const on = display === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={disabled}
                onClick={() =>
                  patch({ display: value === "strip" ? undefined : value })
                }
                className={cn(
                  "press flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors max-sm:min-h-11",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25",
                  on
                    ? "border-foreground bg-card"
                    : "border-border bg-transparent hover:border-foreground/40",
                )}
              >
                <DisplayGlyph kind={value} on={on} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">
                    {t(`forms.inspector.appointment.display.${value}`)}
                  </span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">
                    {t(`forms.inspector.appointment.display.${value}Hint`)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      <Field>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="fi-appt-services">
            {t("forms.inspector.appointment.services.toggle")}
          </Label>
          <Switch
            id="fi-appt-services"
            disabled={disabled}
            checked={services.length > 0}
            onCheckedChange={(on) => {
              if (!on) {
                patch(servicesPatch([]));
                return;
              }
              // What the field books today becomes the first service.
              const first = serviceFromField(ap);
              patch(servicesPatch([first]));
              seedName(first.id, first.targetKey);
            }}
          />
        </div>
        <FieldHint>
          {t("forms.inspector.appointment.services.toggleHint")}
        </FieldHint>
      </Field>

      {services.length === 0 ? (
        <AppointmentConfig
          field={field}
          disabled={disabled}
          onChange={onChange}
        />
      ) : (
        <>
          <AppointmentServiceList
            fieldId={field.id}
            services={services}
            disabled={disabled}
            getText={getText}
            setText={setText}
            onChange={(next) => patch(servicesPatch(next))}
            renderTarget={(service, index) => (
              <AppointmentConfig
                // Its own instance per service: the "Repraesent or connected"
                // choice is remembered per service, not per field.
                key={service.id}
                part="target"
                field={fieldForService(field, ap, service)}
                disabled={disabled}
                onChange={(edit) => {
                  const edited = edit.appointment;
                  if (!edited) return;
                  const updated = withServiceTarget(service, edited);
                  const next = services.map((s, i) =>
                    i === index ? updated : s,
                  );
                  patch({
                    // A Repraesent calendar brings its own hours; they are
                    // copied onto the field only for the first service, whose
                    // calendar the field mirrors. Connected calendars share
                    // the field's settings, wherever they sit in the list.
                    ...(index === 0 || !isNativeKey(updated.targetKey)
                      ? pickSharedRules(edited)
                      : {}),
                    ...servicesPatch(next),
                  });
                  if (updated.targetKey !== service.targetKey) {
                    seedName(service.id, updated.targetKey);
                  }
                }}
              />
            )}
          />
          {firstConnected ? (
            <div className="space-y-4 rounded-lg border border-dashed border-border p-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("forms.inspector.appointment.services.connectedHoursHint")}
              </p>
              <AppointmentConfig
                part="rules"
                field={fieldForService(field, ap, firstConnected)}
                disabled={disabled}
                onChange={(edit) =>
                  edit.appointment
                    ? patch(pickSharedRules(edit.appointment))
                    : undefined
                }
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/** A thumbnail of each look, drawn in ink so it takes the theme. */
function DisplayGlyph({
  kind,
  on,
}: {
  kind: (typeof APPT_DISPLAYS)[number];
  on: boolean;
}) {
  const ink = on ? "bg-foreground" : "bg-muted-foreground/50";
  const faint = "bg-muted-foreground/25";
  return (
    <span
      aria-hidden
      className="mt-0.5 flex h-9 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-background p-1"
    >
      {kind === "strip" ? (
        <span className="flex w-full flex-col gap-1">
          <span className="flex gap-0.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={cn("h-2 flex-1 rounded-[2px]", i === 1 ? ink : faint)}
              />
            ))}
          </span>
          <span className="flex gap-0.5">
            <span className={cn("h-1.5 flex-1 rounded-[2px]", faint)} />
            <span className={cn("h-1.5 flex-1 rounded-[2px]", faint)} />
            <span className={cn("h-1.5 flex-1 rounded-[2px]", faint)} />
          </span>
        </span>
      ) : kind === "month" ? (
        <span className="flex w-full gap-1">
          <span className="grid flex-1 grid-cols-4 gap-0.5">
            {Array.from({ length: 12 }, (_, i) => (
              <span
                key={i}
                className={cn("h-1.5 rounded-[1px]", i === 6 ? ink : faint)}
              />
            ))}
          </span>
          <span className="flex w-3 flex-col gap-0.5">
            <span className={cn("h-1.5 rounded-[1px]", faint)} />
            <span className={cn("h-1.5 rounded-[1px]", ink)} />
            <span className={cn("h-1.5 rounded-[1px]", faint)} />
          </span>
        </span>
      ) : (
        <span className="flex w-full flex-col gap-1">
          {[0, 1].map((row) => (
            <span key={row} className="flex flex-col gap-0.5">
              <span className={cn("h-1 w-5 rounded-[1px]", ink)} />
              <span className="flex gap-0.5">
                <span className={cn("h-1.5 flex-1 rounded-[2px]", faint)} />
                <span className={cn("h-1.5 flex-1 rounded-[2px]", faint)} />
                <span className={cn("h-1.5 flex-1 rounded-[2px]", faint)} />
              </span>
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

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
  part = "all",
}: {
  field: FormField;
  disabled?: boolean;
  onChange: (patch: Partial<FormField>) => void;
  /**
   * A field with services splits this panel: each service shows only WHERE it
   * books ("target"), and the settings connected calendars share are shown
   * once below the list ("rules").
   */
  part?: "all" | "target" | "rules";
}) {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ["calendar-accounts"],
    queryFn: listCalendarAccounts,
  });
  // Cache read on any CRM screen — same query key the rest of the app uses.
  const members = useWorkspaceMembers().data?.members ?? [];

  // Shared with createField so the two cannot disagree. Static timezone on
  // purpose: this is a render path, and resolving the browser zone here would
  // hydrate differently on server and client.
  const ap = field.appointment ?? appointmentDefaults();

  const patch = (p: Partial<NonNullable<FormField["appointment"]>>) =>
    onChange({ appointment: { ...ap, ...p } });

  // Repraesent calendars (pilot `appointmentBook`): the field books one of
  // your own calendars, whose hours and rules then apply instead of the
  // window below. Chosen explicitly, else inferred from the stored key.
  const pilot = usePilotFeatures();
  const [kindChoice, setKindChoice] = useState<"native" | "connected" | null>(null);

  const accounts = data?.accounts ?? [];
  const baikalConfigs = data?.baikal_configs ?? [];

  // Only calendars we can create events in are valid booking targets. CalDAV
  // calendars are always "owner" — Basic-auth credentials are the owner's own.
  const writableCalendars = (a: (typeof accounts)[number]) =>
    a.calendars.filter(
      (c) => c.accessRole === "owner" || c.accessRole === "writer",
    );

  // Google and Microsoft behave identically here (OAuth account, writable
  // calendar list) — they share the Mine/Team groups, told apart by the
  // per-item provider marker.
  const oauthAccounts = accounts.filter(
    (a) => a.provider === "google" || a.provider === "microsoft",
  );
  const caldavAccounts = accounts.filter((a) => a.provider === "caldav");
  const myOauth = oauthAccounts.filter((a) => a.is_own);
  const teamOauth = oauthAccounts.filter((a) => !a.is_own);

  // Empty state only when NOTHING can receive a booking — a workspace with a
  // Baikal config or a CalDAV calendar but no OAuth account still has targets.
  const hasTargets =
    oauthAccounts.some((a) => writableCalendars(a).length > 0) ||
    baikalConfigs.length > 0 ||
    caldavAccounts.some((a) => a.calendars.length > 0);

  const currentKey = primaryTargetKeyOf(ap);
  const nativeOn = pilot.appointmentBook;
  const native =
    part !== "rules" &&
    nativeOn &&
    (kindChoice
      ? kindChoice === "native"
      : isNativeKey(currentKey) || (!currentKey && !isLoading && !hasTargets));
  const kindSwitch = nativeOn ? (
    <TargetKindSwitch
      fill
      native={native}
      disabled={disabled}
      onChange={(n) => {
        setKindChoice(n ? "native" : "connected");
        // Leaving a Repraesent calendar: its key means nothing to the
        // connected-calendar pickers below.
        if (!n && isNativeKey(currentKey)) patch(hostsPatch([]));
      }}
    />
  ) : null;

  if (native) {
    return (
      <div className="space-y-4">
        {kindSwitch}
        <Field>
          <Label>{t("appointmentBook.target.calendar", "Calendar")}</Label>
          <NativeCalendarPicker
            targetKey={currentKey}
            disabled={disabled}
            onPick={(c) => patch(nativeTargetPatch(c))}
          />
        </Field>
      </div>
    );
  }

  if (!isLoading && !hasTargets) {
    if (part === "rules") return null;
    return (
      <div className="space-y-4">
        {kindSwitch}
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
      </div>
    );
  }

  const hosts = derivedHosts(ap);
  const primaryTargetKey = primaryTargetKeyOf(ap);
  /** THE only way to write hosts — see lib/forms/appointment-hosts.ts. */
  const patchHosts = (next: AppointmentHost[]) => patch(hostsPatch(next));

  const accountCalendarItems = (
    list: typeof accounts,
    takenKeys: Set<string>,
  ) =>
    list.flatMap((a) =>
      (a.provider === "caldav" ? a.calendars : writableCalendars(a)).map(
        (c) => {
          const key = calendarKeyFor(a, c.id);
          // A calendar another host row already uses is greyed out rather than
          // silently ignored on click.
          const taken = takenKeys.has(key);
          return (
            <SelectItem
              key={key}
              value={key}
              disabled={a.auth_failed || taken}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                {/* Provider marker: a calendar name + colour alone can't
                    tell a Google calendar from a CalDAV one. */}
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
                  {calendarLabel(a, c).name}
                  <span className="text-muted-foreground">
                    {calendarLabel(a, c).detail ? ` · ${calendarLabel(a, c).detail}` : ""}
                    {a.auth_failed
                      ? ` — ${t("forms.inspector.appointment.accountNeedsReconnect")}`
                      : taken
                        ? ` — ${t("forms.inspector.appointment.alreadyAHost")}`
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
  // The calendars this field BOOKS. Always busy — the engine unions them into
  // the busy sources itself — so they are shown ticked and locked rather than
  // written into busyCalendarKeys, where they would go stale on a host swap.
  const lockedBusyKeys = new Set(hosts.map((h) => h.targetKey));
  const toggleBusyKey = (key: string, checked: boolean) =>
    patch({
      busyCalendarKeys: checked
        ? [...new Set([...busyKeys, key])]
        : busyKeys.filter((k) => k !== key),
    });

  // One list of calendars for every host row, so a change to the grouping
  // cannot apply to only some of the pickers. A function because each row hides
  // the calendars the others already use.
  const calendarGroups = (takenKeys: Set<string>) => (
    <>
            {myOauth.length > 0 ? (
              <SelectGroup>
                <SelectLabel>
                  {t("forms.inspector.appointment.targetGroupMine")}
                </SelectLabel>
                {accountCalendarItems(myOauth, takenKeys)}
              </SelectGroup>
            ) : null}
            {teamOauth.length > 0 ? (
              <SelectGroup>
                <SelectLabel>
                  {t("forms.inspector.appointment.targetGroupTeam")}
                </SelectLabel>
                {accountCalendarItems(teamOauth, takenKeys)}
              </SelectGroup>
            ) : null}
            {baikalConfigs.length > 0 ? (
              <SelectGroup>
                <SelectLabel>
                  {t("forms.inspector.appointment.targetGroupBooking")}
                </SelectLabel>
                {baikalConfigs.map((b) => (
                  <SelectItem
                    key={b.id}
                    value={`baikal:${b.id}`}
                    disabled={takenKeys.has(`baikal:${b.id}`)}
                  >
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
                {accountCalendarItems(caldavAccounts, takenKeys)}
              </SelectGroup>
            ) : null}
    </>
  );

  const weekdays = ap.weekdays ?? [];
  const toggleWeekday = (day: string) =>
    patch({
      weekdays: weekdays.includes(day)
        ? weekdays.filter((d) => d !== day)
        : APPT_DAY_KEYS.filter((d) => d === day || weekdays.includes(d)),
    });

  const targetPart = (
    <>
      {kindSwitch}
      <Field>
        <Label>{t("forms.inspector.appointment.hosts")}</Label>
        <AppointmentHostList
          hosts={hosts}
          accounts={accounts}
          baikalConfigs={baikalConfigs}
          members={members}
          calendarItems={calendarGroups}
          disabled={disabled || isLoading}
          onChange={patchHosts}
        />
        <FieldHint>
          {hosts.length > 1
            ? t("forms.inspector.appointment.hostsHelpMulti")
            : t("forms.inspector.appointment.targetHelp")}
        </FieldHint>
      </Field>
    </>
  );
  if (part === "target") return targetPart;

  return (
    <>
      {part === "rules" ? null : targetPart}

      <Field>
        <Label htmlFor="fi-appt-allbusy">
          {t("forms.inspector.appointment.busyCalendars")}
        </Label>
        <div className="flex h-9 items-center gap-3">
          <Switch
            id="fi-appt-allbusy"
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
          <BusyCalendarPicker
            accounts={accounts}
            baikalConfigs={baikalConfigs}
            busyKeys={busyKeys}
            lockedKeys={lockedBusyKeys}
            disabled={disabled}
            onToggle={toggleBusyKey}
          />
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
        <TimezonePicker compact value={ap.timezone} disabled={disabled} onChange={(timezone) => patch({ timezone })} />
      </Field>

      <Cols>
        {/* Only Google/Microsoft targets expose the notice setting:
            Baikal/CalDAV booking calendars carry their own scheduling rules on
            the server side, so a second knob here would just fight them. The
            default (2h) still applies to slot computation. */}
        {primaryTargetKey?.startsWith("google:") ||
        primaryTargetKey?.startsWith("microsoft:") ? (
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

    </>
  );
}
