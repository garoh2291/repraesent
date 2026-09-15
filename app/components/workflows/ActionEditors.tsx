import { Check, ChevronDown, Plus, X } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
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
import { cn } from "~/lib/utils";
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

  // A contacts trigger has one possible answer, so there is nothing to choose.
  // It still has to SAY the answer: a step that files something somewhere
  // should never leave you guessing where.
  if (entity === "contacts") {
    return (
      <Field>
        <Label>{t("workflows.action.targetLabel")}</Label>
        <p className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-foreground">
          {t("workflows.action.target_contacts")}
        </p>
        <FieldHint>{t("workflows.action.targetTriggerHint")}</FieldHint>
      </Field>
    );
  }

  const options: { key: ActionTarget; label: string }[] = [
    { key: "trigger", label: t(`workflows.action.target_${entity}`) },
    { key: "contact", label: t("workflows.action.target_contact") },
  ];

  return (
    <Field>
      <Label>{t("workflows.action.targetLabel")}</Label>
      {/* The selected card carries a border, the accent colour and a tick.
          It used to be a lighter background on a muted strip, which on a card
          that is already near-white is a difference you have to hunt for —
          people could not tell which of the two was chosen. */}
      <div
        role="radiogroup"
        aria-label={t("workflows.action.targetLabel")}
        className="grid grid-cols-2 gap-2"
      >
        {options.map((option) => {
          const active = value === option.key;
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              disabled={disabled}
              aria-checked={active}
              onClick={() => onChange(option.key)}
              className={cn(
                "flex select-none items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors disabled:opacity-50",
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground",
              )}
            >
              <span className="min-w-0 truncate">{option.label}</span>
              {active ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              ) : null}
            </button>
          );
        })}
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
  fields,
  disabled,
  onChange,
}: {
  config: AddNoteConfig;
  entity: WorkflowEntity;
  fields: CatalogField[];
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
        fields={fields}
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
  fields,
  disabled,
  onChange,
}: {
  config: CreateTaskConfig;
  entity: WorkflowEntity;
  members: WorkspaceMemberOption[];
  fields: CatalogField[];
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
        fields={fields}
        disabled={disabled}
        onChange={(title) => onChange({ ...config, title })}
      />

      <TemplateField
        id="wf-task-description"
        label={t("workflows.task.description")}
        hint={t("workflows.task.descriptionHint")}
        value={config.description ?? ""}
        fields={[]}
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
  fields,
  disabled,
  onChange,
}: {
  config: NotifyTeamConfig;
  fields: CatalogField[];
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
        fields={fields}
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
  loading,
  disabled,
  onChange,
}: {
  config: UpdateRecordConfig;
  entity: WorkflowEntity;
  fields: CatalogField[];
  members: WorkspaceMemberOption[];
  /** A pipeline id, when the trigger names one — narrows the stage list. */
  pipelineScope?: string;
  /**
   * The field catalogue and the member list are still in flight.
   *
   * It matters because without it an enum field whose options have not arrived
   * falls through to a free-text box, and whatever gets typed there is stored
   * as a literal — a stage set to the words somebody typed while waiting.
   */
  loading?: boolean;
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
        /* This step does nothing until a field is picked, and it used to say so
           in the same muted grey as the hint above it — two dim lines and a
           select styled like a placeholder, which reads as an empty panel
           rather than as "your move". A bordered prompt that names the choice
           is the difference between blank and waiting. */
        <div className="rounded-xl border border-dashed border-border p-4 text-center">
          <p className="text-sm font-medium text-foreground">
            {t("workflows.update.noFields")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("workflows.update.noFieldsHint", {
              defaultValue:
                "Pick a field below and give it a value. Nothing is changed until you do.",
            })}
          </p>
        </div>
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
                loading={loading}
                disabled={disabled}
                onChange={(v) => setField(field, v)}
              />
            </div>
          ))}
        </div>
      )}

      {remaining.length > 0 ? (
        /*
         * A menu, not a Select.
         *
         * This was a Radix `Select` held permanently at `value=""` and used as
         * a button that adds a row — a select that never selects anything. It
         * reported as working here and did nothing in the author's browser,
         * and rather than keep guessing at why, this is the component the job
         * actually calls for: "Add step" in the left panel is a DropdownMenu
         * and has never had a problem. Same look, same outcome, a primitive
         * whose whole contract is "click me, pick an action".
         */
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className="flex w-full cursor-pointer select-none items-center justify-between gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                {t("workflows.update.addField")}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width]">
            {remaining.map((field) => (
              <DropdownMenuItem
                key={field}
                onSelect={() => setField(field, "")}
              >
                {t(`workflows.update.field_${field}`, { defaultValue: field })}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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
  loading,
  disabled,
  onChange,
}: {
  field: string;
  value: string;
  fields: CatalogField[];
  members: WorkspaceMemberOption[];
  pipelineScope?: string;
  loading?: boolean;
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  const { t } = useTranslation();
  const catalogField = fields.find((f) => f.path === field);

  // Wait rather than guess. Before this, a `stage` whose options had not
  // arrived rendered as a text box and accepted anything typed into it.
  if (loading && !catalogField) {
    return (
      <div className="flex h-9 items-center rounded-lg border border-border bg-muted/30 px-3 text-xs text-muted-foreground">
        {t("common.loading", { defaultValue: "Loading…" })}
      </div>
    );
  }

  if (field === "assigned_to") {
    return (
      <Select disabled={disabled} value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t("workflows.update.pickValue")} />
        </SelectTrigger>
        <SelectContent>
          {members.length > 0 ? (
            members.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                {m.label}
              </SelectItem>
            ))
          ) : (
            /* An empty popover with no explanation is the worst answer. */
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {t("workflows.update.noMembers", {
                defaultValue: "No members to assign to.",
              })}
            </div>
          )}
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
      fields={fields}
      disabled={disabled}
      onChange={onChange}
    />
  );
}
