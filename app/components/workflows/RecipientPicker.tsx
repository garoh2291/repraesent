import { useQuery } from "@tanstack/react-query";
import { CornerDownRight, TriangleAlert, Users } from "lucide-react";
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
  AUDIENCES_BY_ENTITY,
  resolveRecipients,
  type CatalogField,
  type EmailAudience,
  type RecentRecord,
  type WorkflowEntity,
} from "~/lib/api/workflows";
import { VariablePicker } from "./VariablePicker";

/**
 * Who this email goes to.
 *
 * This replaces a free-text monospace box holding `{{trigger.record.email}}` —
 * a string that every single saved step in the database contained, unchanged,
 * because it was unreadable and there was nothing else to type. It also could
 * not say the one thing people needed: a deal has several contacts, and only
 * the main one was reachable.
 *
 * The options are named outcomes, and they change with the trigger entity, so
 * a lead workflow never offers "everyone on this deal". Underneath, the live
 * resolution shows the actual people — by name — for the record being previewed.
 */
export function RecipientPicker({
  audience,
  entity,
  fields,
  workflowId,
  previewRecord,
  disabled,
  onChange,
}: {
  audience: EmailAudience;
  entity: WorkflowEntity;
  fields: CatalogField[];
  workflowId: string;
  previewRecord: RecentRecord | null;
  disabled?: boolean;
  onChange: (next: EmailAudience) => void;
}) {
  const { t } = useTranslation();
  const kinds = AUDIENCES_BY_ENTITY[entity] ?? ["primary", "address", "path"];

  return (
    <Field>
      <Label htmlFor="wf-audience">
        {t("workflows.audience.label", { defaultValue: "Send to" })}
      </Label>

      <Select
        disabled={disabled}
        value={audience.kind}
        onValueChange={(kind) => onChange(blankAudience(kind, audience))}
      >
        <SelectTrigger id="wf-audience" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {kinds.map((kind) => (
            <SelectItem key={kind} value={kind}>
              {t(`workflows.audience.${entity}_${kind}`, {
                defaultValue: t(`workflows.audience.${kind}`, {
                  defaultValue: kind,
                }),
              })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Only the two that need more input reveal anything further — the
          common choices are one click and done. */}
      {audience.kind === "address" ? (
        <Input
          type="email"
          disabled={disabled}
          value={audience.email}
          placeholder="name@example.com"
          onChange={(e) => onChange({ kind: "address", email: e.target.value })}
        />
      ) : null}

      {audience.kind === "path" ? (
        <div className="space-y-1.5">
          <Input
            disabled={disabled}
            value={audience.path}
            placeholder="{{trigger.record.metadata.billing_email}}"
            className="font-mono text-xs"
            onChange={(e) => onChange({ kind: "path", path: e.target.value })}
          />
          <VariablePicker
            fields={fields}
            disabled={disabled}
            // A previous value is never an address you want to mail today.
            includePrevious={false}
            onInsert={(path) => onChange({ kind: "path", path: `{{${path}}}` })}
          />
        </div>
      ) : null}

      <ResolvedRecipients
        workflowId={workflowId}
        audience={audience}
        record={previewRecord}
      />

      {audience.kind === "all_contacts" ? (
        <FieldHint>
          {t("workflows.audience.allContactsHint", {
            defaultValue:
              "One separate email each, so nobody sees anyone else's address.",
          })}
        </FieldHint>
      ) : null}
    </Field>
  );
}

/** Reset the extra field when switching kinds, keeping it when switching back. */
function blankAudience(kind: string, previous: EmailAudience): EmailAudience {
  if (kind === "address") {
    return {
      kind: "address",
      email: previous.kind === "address" ? previous.email : "",
    };
  }
  if (kind === "path") {
    return { kind: "path", path: previous.kind === "path" ? previous.path : "" };
  }
  return { kind: kind as "primary" };
}

/**
 * The actual people, by name.
 *
 * The old hint rendered the template and ran a client-side email regex over the
 * result — a duplicate of the server's, and blind to the fact that an audience
 * can be more than one person. This asks the server who it would really mail,
 * through the same resolver the send step uses, so the builder cannot promise
 * something the run does not do.
 */
function ResolvedRecipients({
  workflowId,
  audience,
  record,
}: {
  workflowId: string;
  audience: EmailAudience;
  record: RecentRecord | null;
}) {
  const { t } = useTranslation();

  const incomplete =
    (audience.kind === "address" && !audience.email.trim()) ||
    (audience.kind === "path" && !audience.path.trim());

  const { data, isError } = useQuery({
    queryKey: ["workflow-recipients", workflowId, record?.id, audience],
    queryFn: () =>
      resolveRecipients(workflowId, {
        entity_id: record!.id,
        audience,
      }),
    enabled: !!record && !incomplete,
    retry: false,
    staleTime: 2000,
  });

  if (!record) {
    return (
      <FieldHint>
        {t("workflows.audience.pickPreview", {
          defaultValue: "Choose a record above to see who this reaches.",
        })}
      </FieldHint>
    );
  }
  if (incomplete || !data) return null;

  const people = data.recipients;

  if (isError || people.length === 0) {
    return (
      <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
        <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        <span>
          {t("workflows.audience.nobody", {
            name: record.label,
            defaultValue: "Nobody to email for {{name}} — this step would skip.",
          })}
        </span>
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        {people.length > 1 ? (
          <Users className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        ) : (
          <CornerDownRight className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        )}
        <span>
          {t("workflows.audience.reaches", {
            count: people.length,
            defaultValue_one: "Reaches {{count}} person",
            defaultValue_other: "Reaches {{count}} people",
          })}
        </span>
      </p>
      <ul className="space-y-0.5 pl-[1.125rem]">
        {people.map((person) => (
          <li
            key={person.email}
            className="flex flex-wrap items-baseline gap-x-1.5 text-xs"
          >
            <span className="font-medium text-foreground">
              {person.name ?? person.email}
            </span>
            {person.name ? (
              <span className="min-w-0 break-all text-muted-foreground">
                {person.email}
              </span>
            ) : null}
            <span className="text-muted-foreground/70">
              {t(`workflows.audience.why_${person.why}`, {
                defaultValue: "",
              })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
