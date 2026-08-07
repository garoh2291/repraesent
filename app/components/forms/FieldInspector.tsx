import { useTranslation } from "react-i18next";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { Field, FieldHint, TwoCol } from "~/components/wordpress/fields";
import { snakeKey } from "~/lib/forms/field-types";
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

  if (!target) {
    return (
      <p className="p-1 text-sm text-muted-foreground">
        {t("forms.inspector.none")}
      </p>
    );
  }

  // The form header and the submit button live at form.* content keys, so the
  // getText/setText closures the route already passes (which carry the active
  // locale) cover them with no extra plumbing. This component stays
  // locale-agnostic.
  if (target.kind === "header") {
    return (
      <div className="space-y-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("forms.inspector.header")}
        </h2>

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
      </div>
    );
  }

  if (target.kind === "submit") {
    const caption = getText(contentKey.formSubmit());
    return (
      <div className="space-y-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("forms.inspector.submit")}
        </h2>

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
      </div>
    );
  }

  const field = target.field;

  const patchField = onChange ?? (() => undefined);
  const validation = field.validation ?? {};
  const patchValidation = (patch: Partial<FormField["validation"]>) =>
    patchField({ validation: { ...validation, ...patch } });

  const keyCollides = otherKeys?.has(field.key) ?? false;
  const presentational = isPresentational(field.type);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("forms.inspector.title")}
        </h2>
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          {t(`forms.palette.${field.type}`)}
        </span>
      </div>

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
            <Input
              id="fi-label"
              disabled={disabled}
              value={getText(contentKey.fieldLabel(field.id))}
              onChange={(e) =>
                setText(contentKey.fieldLabel(field.id), e.target.value)
              }
            />
          </Field>

          {field.type !== "checkbox" ? (
            <Field>
              <Label htmlFor="fi-ph">{t("forms.inspector.placeholder")}</Label>
              <Input
                id="fi-ph"
                disabled={disabled}
                value={getText(contentKey.fieldPlaceholder(field.id))}
                onChange={(e) =>
                  setText(contentKey.fieldPlaceholder(field.id), e.target.value)
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

      <div className="border-t" />

      <Field>
        <Label htmlFor="fi-key">{t("forms.inspector.key")}</Label>
        <Input
          id="fi-key"
          disabled={disabled}
          value={field.key}
          aria-invalid={keyCollides || undefined}
          onChange={(e) => patchField({ key: snakeKey(e.target.value) })}
          className="font-mono text-sm"
        />
        {keyCollides ? (
          <p className="text-xs text-destructive">
            {t("forms.inspector.keyInUse")}
          </p>
        ) : (
          <FieldHint>{t("forms.inspector.keyHint")}</FieldHint>
        )}
      </Field>

      <TwoCol>
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

        {!presentational && field.type !== "hidden" ? (
          <Field>
            <Label htmlFor="fi-required">{t("forms.inspector.required")}</Label>
            <div className="flex h-9 items-center">
              <Switch
                id="fi-required"
                disabled={disabled}
                checked={validation.required === true}
                onCheckedChange={(v) => patchValidation({ required: v })}
              />
            </div>
          </Field>
        ) : null}
      </TwoCol>

      {!presentational && field.type !== "hidden" ? (
        <Field>
          <Label>{t("forms.inspector.mapping")}</Label>
          <Select
            disabled={disabled}
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
          <FieldHint>{t("forms.inspector.mappingHint")}</FieldHint>
        </Field>
      ) : null}

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

      <TypeSpecific
        field={field}
        disabled={disabled}
        onChange={patchField}
        patchValidation={patchValidation}
        getText={getText}
        setText={setText}
      />
    </div>
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
        <TwoCol>
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
        </TwoCol>
      );

    case "number":
      return (
        <TwoCol>
          {numberInput("fi-min", t("forms.inspector.min"), v.min, (n) =>
            patchValidation({ min: n }),
          )}
          {numberInput("fi-max", t("forms.inspector.max"), v.max, (n) =>
            patchValidation({ max: n }),
          )}
        </TwoCol>
      );

    case "date":
      return (
        <TwoCol>
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
        </TwoCol>
      );

    case "checkbox_group":
      return (
        <TwoCol>
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
        </TwoCol>
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
        <TwoCol>
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
        </TwoCol>
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
          <div className="space-y-2">
            {(["street", "zip", "city", "country"] as const).map((part) => (
              <div key={part} className="flex items-center gap-3">
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
                {parts[part] ? (
                  <Input
                    className="h-8 w-40 text-sm"
                    disabled={disabled}
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

    default:
      return null;
  }
}
