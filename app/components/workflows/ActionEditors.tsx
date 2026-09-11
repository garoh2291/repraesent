import { Plus, X } from "lucide-react";
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
  UPDATABLE_FIELDS,
  type ActionTarget,
  type AddNoteConfig,
  type CatalogField,
  type CreateTaskConfig,
  type NotifyTeamConfig,
  type UpdateRecordConfig,
  type WorkflowEntity,
} from "~/lib/api/workflows";
import { TemplateField } from "./TemplateField";
import type { WorkspaceMemberOption } from "./NodeInspector";

/**
 * Where a note or a task is filed.
 *
 * Two buttons rather than a dropdown: there are exactly two answers, and the
 * choice changes what the step means, so it should be readable without
 * opening anything. Hidden entirely when the trigger record IS a contact —
 * "attach it to the contact" and "attach it to the trigger" are then the same
 * sentence, and offering both invites the reader to look for a difference.
 */
function TargetPicker({
  entity,
  value,
  disabled,
  onChange,
}: {
  entity: WorkflowEntity;
  value: ActionTarget;
  disabled?: boolean;
  onChange: (next: ActionTarget) => void;
}) {
  const { t } = useTranslation();
  if (entity === "contacts") return null;

  const options: { key: ActionTarget; label: string }[] = [
    { key: "trigger", label: t(`workflows.action.target_${entity}`) },
    { key: "contact", label: t("workflows.action.target_contact") },
  ];

  return (
    <Field>
      <Label>{t("workflows.action.targetLabel")}</Label>
      <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-muted/50 p-1">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            disabled={disabled}
            aria-pressed={value === option.key}
            onClick={() => onChange(option.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
              value === option.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <FieldHint>
        {value === "contact"
          ? t("workflows.action.targetContactHint")
          : t("workflows.action.targetTriggerHint")}
      </FieldHint>
    </Field>
  );
}

// ---------------------------------------------------------------------------

export function AddNoteEditor({
  config,
  entity,
  variables,
  disabled,
  onChange,
}: {
  config: AddNoteConfig;
  entity: WorkflowEntity;
  variables: string[];
  disabled?: boolean;
  onChange: (next: AddNoteConfig) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      <FieldHint>{t("workflows.inspector.noteHint")}</FieldHint>
      <TargetPicker
        entity={entity}
        value={config.target ?? "trigger"}
        disabled={disabled}
        onChange={(target) => onChange({ ...config, target })}
      />
      <TemplateField
        id="wf-note-body"
        label={t("workflows.note.body")}
        value={config.body ?? ""}
        variables={variables}
        multiline
        rows={4}
        disabled={disabled}
        onChange={(body) => onChange({ ...config, body })}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Offered due dates. Anything finer is a delay step followed by a task. */
const DUE_PRESETS = [0, 1, 2, 3, 7, 14, 30];

export function CreateTaskEditor({
  config,
  entity,
  members,
  variables,
  disabled,
  onChange,
}: {
  config: CreateTaskConfig;
  entity: WorkflowEntity;
  members: WorkspaceMemberOption[];
  variables: string[];
  disabled?: boolean;
  onChange: (next: CreateTaskConfig) => void;
}) {
  const { t } = useTranslation();

  const assignee = config.assignee;
  const assigneeValue =
    assignee?.kind === "owner"
      ? "__owner__"
      : assignee?.kind === "member"
        ? `member:${assignee.userId}`
        : "__none__";

  return (
    <div className="space-y-5">
      <FieldHint>{t("workflows.inspector.taskHint")}</FieldHint>

      <TargetPicker
        entity={entity}
        value={config.target ?? "trigger"}
        disabled={disabled}
        onChange={(target) => onChange({ ...config, target })}
      />

      <TemplateField
        id="wf-task-title"
        label={t("workflows.task.title")}
        value={config.title ?? ""}
        variables={variables}
        disabled={disabled}
        onChange={(title) => onChange({ ...config, title })}
      />

      <TemplateField
        id="wf-task-description"
        label={t("workflows.task.description")}
        hint={t("workflows.task.descriptionHint")}
        value={config.description ?? ""}
        variables={[]}
        multiline
        disabled={disabled}
        onChange={(description) => onChange({ ...config, description })}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field>
          <Label>{t("workflows.task.due")}</Label>
          <Select
            disabled={disabled}
            value={
              config.dueInDays === undefined || config.dueInDays === null
                ? "__none__"
                : String(config.dueInDays)
            }
            onValueChange={(v) =>
              onChange({
                ...config,
                dueInDays: v === "__none__" ? undefined : Number(v),
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">
                {t("workflows.task.dueNone")}
              </SelectItem>
              {DUE_PRESETS.map((days) => (
                <SelectItem key={days} value={String(days)}>
                  {days === 0
                    ? t("workflows.task.dueToday")
                    : t("workflows.task.dueInDays", { count: days })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <Label>{t("workflows.task.assignee")}</Label>
          <Select
            disabled={disabled}
            value={assigneeValue}
            onValueChange={(v) =>
              onChange({
                ...config,
                assignee:
                  v === "__none__"
                    ? undefined
                    : v === "__owner__"
                      ? { kind: "owner" }
                      : { kind: "member", userId: v.slice("member:".length) },
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">
                {t("workflows.task.assigneeNone")}
              </SelectItem>
              {/* Follows the record, so the task lands on whoever holds it
                  rather than on whoever wrote the rule. */}
              <SelectItem value="__owner__">
                {t("workflows.task.assigneeOwner")}
              </SelectItem>
              {members.map((m) => (
                <SelectItem key={m.userId} value={`member:${m.userId}`}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function NotifyTeamEditor({
  config,
  variables,
  disabled,
  onChange,
}: {
  config: NotifyTeamConfig;
  variables: string[];
  disabled?: boolean;
  onChange: (next: NotifyTeamConfig) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      <FieldHint>{t("workflows.inspector.notifyHint")}</FieldHint>
      <TemplateField
        id="wf-notify-message"
        label={t("workflows.notify.message")}
        hint={t("workflows.notify.messageHint")}
        value={config.message ?? ""}
        variables={variables}
        multiline
        rows={3}
        disabled={disabled}
        onChange={(message) => onChange({ ...config, message })}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

export function UpdateRecordEditor({
  config,
  entity,
  fields,
  members,
  pipelineScope,
  variables,
  disabled,
  onChange,
}: {
  config: UpdateRecordConfig;
  entity: WorkflowEntity;
  fields: CatalogField[];
  members: WorkspaceMemberOption[];
  /** A pipeline id, when the trigger names one — narrows the stage list. */
  pipelineScope?: string;
  variables: string[];
  disabled?: boolean;
  onChange: (next: UpdateRecordConfig) => void;
}) {
  const { t } = useTranslation();

  const settable = UPDATABLE_FIELDS[entity] ?? [];
  const set = config.set ?? {};
  const chosen = Object.keys(set);
  const remaining = settable.filter((f) => !chosen.includes(f));

  const patch = (next: Record<string, string>) => onChange({ ...config, set: next });

  const setField = (field: string, value: string) =>
    patch({ ...set, [field]: value });

  const removeField = (field: string) => {
    const next = { ...set };
    delete next[field];
    patch(next);
  };

  if (settable.length === 0) {
    return (
      <div className="space-y-3">
        <FieldHint>{t("workflows.inspector.updateHint")}</FieldHint>
        <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-xs text-amber-900 dark:text-amber-200">
          {t("workflows.update.unsupportedEntity", {
            entity: t(`workflows.entity.${entity}`),
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <FieldHint>{t("workflows.inspector.updateHint")}</FieldHint>

      {chosen.length === 0 ? (
        <FieldHint>{t("workflows.update.noFields")}</FieldHint>
      ) : (
        <div className="space-y-4">
          {chosen.map((field) => (
            <div
              key={field}
              className="space-y-2 rounded-xl border border-border bg-muted/20 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-medium">
                  {t(`workflows.update.field_${field}`, { defaultValue: field })}
                </Label>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeField(field)}
                  aria-label={t("workflows.update.removeField")}
                  className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <ValueEditor
                field={field}
                value={set[field] ?? ""}
                fields={fields}
                members={members}
                pipelineScope={pipelineScope}
                variables={variables}
                disabled={disabled}
                onChange={(v) => setField(field, v)}
              />
            </div>
          ))}
        </div>
      )}

      {remaining.length > 0 ? (
        <Select
          disabled={disabled}
          value=""
          onValueChange={(field) => setField(field, "")}
        >
          <SelectTrigger className="w-full">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Plus className="h-3.5 w-3.5" />
              {t("workflows.update.addField")}
            </span>
          </SelectTrigger>
          <SelectContent>
            {remaining.map((field) => (
              <SelectItem key={field} value={field}>
                {t(`workflows.update.field_${field}`, { defaultValue: field })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}

/**
 * The right input for the field being set.
 *
 * A stage or a status is a fixed vocabulary — typing it by hand is how a run
 * fails with "Invalid stage key" an hour later. Anything free-form stays a
 * template so it can carry a variable.
 */
function ValueEditor({
  field,
  value,
  fields,
  members,
  pipelineScope,
  variables,
  disabled,
  onChange,
}: {
  field: string;
  value: string;
  fields: CatalogField[];
  members: WorkspaceMemberOption[];
  pipelineScope?: string;
  variables: string[];
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  const { t } = useTranslation();
  const catalogField = fields.find((f) => f.path === field);

  if (field === "assigned_to") {
    return (
      <Select disabled={disabled} value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t("workflows.update.pickValue")} />
        </SelectTrigger>
        <SelectContent>
          {members.map((m) => (
            <SelectItem key={m.userId} value={m.userId}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (catalogField?.kind === "enum" && catalogField.options?.length) {
    // Same narrowing as the condition builder: a stage KEY can exist in more
    // than one pipeline, so once the rule names a pipeline the list shows only
    // that board's stages.
    const options = pipelineScope
      ? catalogField.options.filter(
          (o) => !o.scopes || o.scopes.includes(pipelineScope),
        )
      : catalogField.options;

    return (
      <Select disabled={disabled} value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t("workflows.update.pickValue")} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (catalogField?.kind === "date") {
    return (
      <Input
        type="date"
        disabled={disabled}
        value={value.slice(0, 10)}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (catalogField?.kind === "number") {
    return (
      <Input
        type="number"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <TemplateField
      id={`wf-update-${field}`}
      label=""
      value={value}
      variables={variables}
      disabled={disabled}
      onChange={onChange}
    />
  );
}
