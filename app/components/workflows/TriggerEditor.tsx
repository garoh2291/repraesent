import { TriangleAlert } from "lucide-react";
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
import { Field, FieldHint } from "~/components/wordpress/fields";
import {
  WORKFLOW_ENTITIES,
  type CatalogField,
  type TriggerConfig,
  type TriggerType,
  type WorkflowEntity,
} from "~/lib/api/workflows";
import { filterWarnings } from "~/lib/workflows/graph";
import { ConditionBuilder } from "./ConditionBuilder";

const TRIGGER_TYPES: TriggerType[] = [
  "record_created",
  "record_updated",
  "field_changed_to",
  "no_change_for",
  "date_field_relative",
];

/**
 * When the workflow starts.
 *
 * The extra inputs are driven by the trigger type rather than all being shown
 * at once — "no change for N days" and "status changed to X" need entirely
 * different questions answered.
 */
export function TriggerEditor({
  config,
  fields,
  dateFields,
  disabled,
  onChange,
}: {
  config: TriggerConfig;
  fields: CatalogField[];
  dateFields: string[];
  disabled?: boolean;
  onChange: (next: TriggerConfig) => void;
}) {
  const { t } = useTranslation();
  const patch = (next: Partial<TriggerConfig>) => onChange({ ...config, ...next });

  const enumFields = fields.filter((f) => f.kind === "enum");
  const selected = fields.find((f) => f.path === config.path);
  const days = Math.round((config.offsetMinutes ?? 0) / 1440);

  // Built from a one-node graph: this editor only ever sees its own trigger,
  // and that is all the check needs.
  const warnings = filterWarnings(
    { nodes: [{ id: "t", type: "trigger", config }], edges: [] },
    t,
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field>
          <Label>{t("workflows.trigger.entity")}</Label>
          <Select
            value={config.entity}
            disabled={disabled}
            onValueChange={(v) =>
              // Fields are entity-specific, so anything referencing the old
              // entity's columns must go rather than silently never matching.
              onChange({
                ...config,
                entity: v as WorkflowEntity,
                path: undefined,
                value: undefined,
                columns: undefined,
                dateField: undefined,
                filter: { match: "all", conditions: [] },
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORKFLOW_ENTITIES.map((e) => (
                <SelectItem key={e} value={e}>
                  {t(`workflows.entity.${e}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <Label>{t("workflows.trigger.when")}</Label>
          <Select
            value={config.type}
            disabled={disabled}
            onValueChange={(v) => patch({ type: v as TriggerType })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRIGGER_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`workflows.trigger.type_${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldHint>{t(`workflows.trigger.hint_${config.type}`)}</FieldHint>
        </Field>
      </div>

      {config.type === "field_changed_to" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <Label>{t("workflows.trigger.field")}</Label>
            <Select
              value={config.path ?? ""}
              disabled={disabled}
              onValueChange={(path) => patch({ path, value: undefined })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("workflows.condition.pickField")} />
              </SelectTrigger>
              <SelectContent>
                {enumFields.map((f) => (
                  <SelectItem key={f.path} value={f.path}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <Label>{t("workflows.trigger.newValue")}</Label>
            <Select
              value={config.value ?? ""}
              disabled={disabled || !selected}
              onValueChange={(value) => patch({ value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("workflows.condition.pickValue")} />
              </SelectTrigger>
              <SelectContent>
                {(selected?.options ?? []).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      ) : null}

      {config.type === "no_change_for" ? (
        <Field>
          <Label>{t("workflows.trigger.untouchedFor")}</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              className="max-w-[120px]"
              disabled={disabled}
              value={days || 7}
              onChange={(e) =>
                patch({ offsetMinutes: Math.max(1, e.target.valueAsNumber || 1) * 1440 })
              }
            />
            <span className="text-sm text-muted-foreground">
              {t("workflows.delay.days")}
            </span>
          </div>
        </Field>
      ) : null}

      {config.type === "date_field_relative" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <Label>{t("workflows.trigger.dateField")}</Label>
            <Select
              value={config.dateField ?? dateFields[0] ?? ""}
              disabled={disabled}
              onValueChange={(dateField) => patch({ dateField })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateFields.map((d) => (
                  <SelectItem key={d} value={d}>
                    {fields.find((f) => f.path === d)?.label ?? d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <Label>{t("workflows.trigger.offsetDays")}</Label>
            <Input
              type="number"
              disabled={disabled}
              value={days}
              onChange={(e) =>
                patch({ offsetMinutes: (e.target.valueAsNumber || 0) * 1440 })
              }
            />
            <FieldHint>{t("workflows.trigger.offsetHint")}</FieldHint>
          </Field>
        </div>
      ) : null}

      <div className="space-y-2 border-t border-border pt-4">
        <Label>{t("workflows.trigger.onlyIf")}</Label>
        <FieldHint>{t("workflows.trigger.onlyIfHint")}</FieldHint>

        {warnings.length > 0 ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{warnings.join(" ")}</span>
          </div>
        ) : null}
        <ConditionBuilder
          group={config.filter ?? { match: "all", conditions: [] }}
          fields={fields}
          disabled={disabled}
          onChange={(filter) => patch({ filter })}
        />
      </div>
    </div>
  );
}
