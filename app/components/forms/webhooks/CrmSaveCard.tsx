import { Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Switch } from "~/components/ui/switch";
import { Panel, PanelHeader } from "~/components/forms/chrome";
import {
  flattenFields,
  type FormDefinition,
  type FormKind,
} from "~/lib/forms/schema";
import { useFormWebhooks } from "~/lib/hooks/useFormWebhooks";

interface Props {
  formId: string;
  kind: FormKind;
  definition: FormDefinition;
  canEdit: boolean;
  onChange: (next: FormDefinition) => void;
}

/**
 * "Save answers as inquiries" — off makes the form webhook only: answers go to
 * the webhooks below and Repraesent keeps just the count. Mirrors the server's
 * isWebhookOnly: never for a payment form or a form that books appointments,
 * and with no webhook switched on the form saves inquiries as usual.
 */
export function CrmSaveCard({ formId, kind, definition, canEdit, onChange }: Props) {
  const { t } = useTranslation();
  const { data: webhooks } = useFormWebhooks(formId);

  const saves = definition.crm?.save !== false;
  const hasAppointment = flattenFields(definition).some(
    (f) => f.type === "appointment",
  );
  const hasActiveHook = (webhooks ?? []).some(
    (h) => h.is_active && h.events.includes("form.submitted"),
  );

  // Locked on: the reason is the help line. A form already switched off
  // before an appointment was added can still be switched back on.
  const locked = kind === "product" || (hasAppointment && saves);

  const help =
    kind === "product"
      ? t("forms.webhooks.crm.lockedProduct")
      : hasAppointment
        ? t("forms.webhooks.crm.lockedAppointment")
        : saves
          ? t("forms.webhooks.crm.onHelp")
          : hasActiveHook
            ? t("forms.webhooks.crm.offHelp")
            : t("forms.webhooks.crm.noWebhook");

  return (
    <Panel>
      <PanelHeader
        icon={<Inbox className="h-3.5 w-3.5" />}
        title={t("forms.webhooks.crm.title")}
      />
      <label className="flex items-start gap-3 px-4 py-3 sm:px-5">
        <Switch
          checked={saves}
          disabled={!canEdit || locked}
          onCheckedChange={(v) =>
            onChange({ ...definition, crm: { save: v } })
          }
          className="mt-0.5"
          aria-label={t("forms.webhooks.crm.label")}
        />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">
            {t("forms.webhooks.crm.label")}
          </span>
          <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">
            {help}
          </span>
        </span>
      </label>
    </Panel>
  );
}
