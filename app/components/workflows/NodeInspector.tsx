import { Lock, MousePointerClick, Plus, TriangleAlert, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { EmptyPanelState } from "~/components/forms/chrome";
import { Field, FieldHint } from "~/components/wordpress/fields";
import type {
  CatalogField,
  ConditionGroup,
  DelayConfig,
  EmailRecipient,
  OutboundCapability,
  RecentRecord,
  SendCustomerEmailConfig,
  SendInternalEmailConfig,
  TriggerConfig,
  WorkflowNode,
} from "~/lib/api/workflows";
import { sortAccountsWithAliases } from "~/lib/api/email-accounts";
import { ConditionBuilder } from "./ConditionBuilder";
import { ResolvedHint } from "./ResolvedHint";
import { EmailTemplateEditor } from "./EmailTemplateEditor";
import { TriggerEditor } from "./TriggerEditor";

export interface WorkspaceMemberOption {
  userId: string;
  label: string;
}

/**
 * Edits whichever node is selected.
 *
 * One component rather than one per type because they share the same framing,
 * and a node type is a handful of fields — splitting further would mean five
 * files that each render two inputs.
 */
export function NodeInspector({
  node,
  fields,
  dateFields,
  locales,
  activeLocale,
  variables,
  members,
  capability,
  disabled,
  workflowId,
  previewRecord,
  onChange,
  onLocaleChange,
}: {
  node: WorkflowNode | null;
  fields: CatalogField[];
  dateFields: string[];
  locales: string[];
  activeLocale: string;
  variables: string[];
  members: WorkspaceMemberOption[];
  capability: OutboundCapability | undefined;
  disabled?: boolean;
  workflowId: string;
  previewRecord: RecentRecord | null;
  onChange: (config: WorkflowNode["config"]) => void;
  onLocaleChange: (locale: string) => void;
}) {
  const { t } = useTranslation();

  if (!node) {
    return (
      <EmptyPanelState
        icon={<MousePointerClick className="h-5 w-5" />}
        title={t("workflows.inspector.emptyTitle")}
        hint={t("workflows.inspector.emptyHint")}
      />
    );
  }

  switch (node.type) {
    case "trigger":
      return (
        <TriggerEditor
          config={node.config as TriggerConfig}
          fields={fields}
          dateFields={dateFields}
          disabled={disabled}
          onChange={onChange}
        />
      );

    case "condition": {
      const cfg = node.config as { group: ConditionGroup };
      return (
        <div className="space-y-3">
          <FieldHint>{t("workflows.inspector.conditionHint")}</FieldHint>
          <ConditionBuilder
            group={cfg.group ?? { match: "all", conditions: [] }}
            fields={fields}
            disabled={disabled}
            onChange={(group) => onChange({ group })}
          />
        </div>
      );
    }

    case "delay": {
      const cfg = node.config as DelayConfig;
      return <DelayEditor config={cfg} disabled={disabled} onChange={onChange} />;
    }

    case "send_internal_email": {
      const cfg = node.config as SendInternalEmailConfig;
      return (
        <div className="space-y-5">
          <FieldHint>{t("workflows.inspector.internalHint")}</FieldHint>
          <RecipientPicker
            recipients={cfg.recipients ?? []}
            members={members}
            disabled={disabled}
            onChange={(recipients) => onChange({ ...cfg, recipients })}
          />
          <EmailTemplateEditor
            byLocale={cfg.by_locale ?? {}}
            locales={locales}
            activeLocale={activeLocale}
            variables={variables}
            disabled={disabled}
            workflowId={workflowId}
            previewRecord={previewRecord}
            onChange={(by_locale) => onChange({ ...cfg, by_locale })}
            onLocaleChange={onLocaleChange}
          />
        </div>
      );
    }

    case "send_customer_email": {
      const cfg = node.config as SendCustomerEmailConfig;
      const blocked = capability && !capability.available;

      return (
        <div className="space-y-5">
          {blocked ? <OutboundBlockedNotice capability={capability} /> : null}

          <Field>
            <Label htmlFor="wf-to">{t("workflows.email.toPath")}</Label>
            <Input
              id="wf-to"
              disabled={disabled}
              value={cfg.to_path ?? ""}
              onChange={(e) => onChange({ ...cfg, to_path: e.target.value })}
              placeholder="{{trigger.record.email}}"
              className="font-mono text-xs"
            />
            <FieldHint>{t("workflows.email.toPathHint")}</FieldHint>
            <ResolvedHint
              workflowId={workflowId}
              record={previewRecord}
              template={cfg.to_path ?? ""}
              tone="address"
            />
          </Field>

          {capability && capability.accounts.length > 0 ? (
            <Field>
              <Label>{t("workflows.email.sendFrom")}</Label>
              <Select
                disabled={disabled}
                value={cfg.email_account_id ?? "__default__"}
                onValueChange={(v) =>
                  onChange({
                    ...cfg,
                    email_account_id: v === "__default__" ? null : v,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">
                    {t("workflows.email.sendFromDefault")}
                  </SelectItem>
                  {sortAccountsWithAliases(capability.accounts).map((a) => (
                    <SelectItem
                      key={a.id}
                      value={a.id}
                      disabled={!!a.auth_failed_at}
                    >
                      {/* An alias sends through the mailbox above it. */}
                      {a.parent_account_id ? "↳ " : ""}
                      {a.email}
                      {a.auth_failed_at
                        ? ` — ${t("workflows.email.accountBroken")}`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <EmailTemplateEditor
            byLocale={cfg.by_locale ?? {}}
            locales={locales}
            activeLocale={activeLocale}
            variables={variables}
            disabled={disabled}
            workflowId={workflowId}
            previewRecord={previewRecord}
            onChange={(by_locale) => onChange({ ...cfg, by_locale })}
            onLocaleChange={onLocaleChange}
          />
        </div>
      );
    }

    default:
      return null;
  }
}

/**
 * Why outbound email cannot run, and what to do about it.
 *
 * Deliberately not a hard block on editing: the workflow can still be built and
 * published, and the step records itself as skipped until a mailbox exists. A
 * half-configured automation the user can finish later beats a dead end.
 */
function OutboundBlockedNotice({
  capability,
}: {
  capability: OutboundCapability;
}) {
  const { t } = useTranslation();
  const needsReconnect = capability.reason === "account_needs_reconnect";

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-amber-900 dark:text-amber-200">
      {needsReconnect ? (
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium">
          {needsReconnect
            ? t("workflows.outbound.reconnectTitle")
            : t("workflows.outbound.blockedTitle")}
        </p>
        <p className="text-xs opacity-90">
          {needsReconnect
            ? t("workflows.outbound.reconnectBody")
            : t("workflows.outbound.blockedBody")}
        </p>
        <Link
          to="/settings/email-accounts"
          className="inline-block text-xs font-medium underline underline-offset-2"
        >
          {t("workflows.outbound.blockedCta")}
        </Link>
      </div>
    </div>
  );
}

function DelayEditor({
  config,
  disabled,
  onChange,
}: {
  config: DelayConfig;
  disabled?: boolean;
  onChange: (config: DelayConfig) => void;
}) {
  const { t } = useTranslation();
  const minutes = Number(config.minutes ?? 0);

  // Stored as minutes; edited in whichever unit divides cleanly, so "7 days"
  // reads as 7 days rather than 10080 minutes.
  const unit = minutes % 1440 === 0 ? "days" : minutes % 60 === 0 ? "hours" : "minutes";
  const divisor = unit === "days" ? 1440 : unit === "hours" ? 60 : 1;

  return (
    <div className="space-y-3">
      <FieldHint>{t("workflows.inspector.delayHint")}</FieldHint>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,140px)] gap-2">
        <Input
          type="number"
          min={0}
          disabled={disabled}
          value={Math.round(minutes / divisor)}
          onChange={(e) =>
            onChange({ minutes: Math.max(0, e.target.valueAsNumber || 0) * divisor })
          }
        />
        <Select
          value={unit}
          disabled={disabled}
          onValueChange={(next) => {
            const amount = Math.round(minutes / divisor);
            const factor = next === "days" ? 1440 : next === "hours" ? 60 : 1;
            onChange({ minutes: amount * factor });
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minutes">{t("workflows.delay.minutes")}</SelectItem>
            <SelectItem value="hours">{t("workflows.delay.hours")}</SelectItem>
            <SelectItem value="days">{t("workflows.delay.days")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function RecipientPicker({
  recipients,
  members,
  disabled,
  onChange,
}: {
  recipients: EmailRecipient[];
  members: WorkspaceMemberOption[];
  disabled?: boolean;
  onChange: (next: EmailRecipient[]) => void;
}) {
  const { t } = useTranslation();

  const describe = (r: EmailRecipient) =>
    r.kind === "member"
      ? (members.find((m) => m.userId === r.userId)?.label ?? r.userId)
      : r.kind === "role"
        ? t(`workflows.recipients.role_${r.role}`)
        : r.email;

  return (
    <Field>
      <Label>{t("workflows.recipients.label")}</Label>

      {recipients.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {recipients.map((r, i) => (
            <span
              key={`${r.kind}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs"
            >
              {describe(r)}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(recipients.filter((_, j) => j !== i))}
                aria-label={t("workflows.recipients.remove")}
                className="text-muted-foreground hover:text-destructive disabled:opacity-50"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <FieldHint>{t("workflows.recipients.none")}</FieldHint>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Select
          disabled={disabled}
          value=""
          onValueChange={(v) => {
            const [kind, rest] = v.split(":");
            if (kind === "member") onChange([...recipients, { kind: "member", userId: rest }]);
            if (kind === "role") {
              onChange([
                ...recipients,
                { kind: "role", role: rest as "admin" | "editor" | "viewer" },
              ]);
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("workflows.recipients.add")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="role:admin">
              {t("workflows.recipients.role_admin")}
            </SelectItem>
            <SelectItem value="role:editor">
              {t("workflows.recipients.role_editor")}
            </SelectItem>
            {members.map((m) => (
              <SelectItem key={m.userId} value={`member:${m.userId}`}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <AddressAdder
          disabled={disabled}
          onAdd={(email) => onChange([...recipients, { kind: "address", email }])}
        />
      </div>
    </Field>
  );
}

function AddressAdder({
  disabled,
  onAdd,
}: {
  disabled?: boolean;
  onAdd: (email: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem(
          "wf-address",
        ) as HTMLInputElement | null;
        const value = input?.value.trim();
        if (!value) return;
        onAdd(value);
        if (input) input.value = "";
      }}
    >
      <Input
        name="wf-address"
        type="email"
        disabled={disabled}
        placeholder={t("workflows.recipients.addressPlaceholder")}
      />
      <button
        type="submit"
        disabled={disabled}
        aria-label={t("workflows.recipients.addAddress")}
        className="shrink-0 rounded-lg border border-border px-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
      </button>
    </form>
  );
}
