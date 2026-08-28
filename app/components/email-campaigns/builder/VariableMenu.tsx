import { useQuery } from "@tanstack/react-query";
import { Braces, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { getFieldCatalog } from "~/lib/api/workflows";

/**
 * Insert-variable menu for the template builder.
 *
 * The person fields are offered as `recipient.*`, NOT `contact.*`. A template
 * is used by campaigns, workflows, form confirmations and appointment
 * confirmations, and in three of those the person being emailed is very often
 * a LEAD rather than a contact. `recipient.*` is the one namespace the render
 * context normalizes across both, so a template written here behaves the same
 * wherever it is used.
 *
 * `contact.*` still resolves (it is kept as an alias) and the contact-only
 * columns below still use it — but offering it as the default was misleading:
 * it made the whole variable system look contact-only when it is not.
 */

/**
 * The fields `recipient.*` guarantees for a lead and a contact alike. Kept in
 * step with `RecipientView` in the backend's render-context.ts.
 */
const RECIPIENT_PATHS = [
  "first_name",
  "last_name",
  "full_name",
  "email",
  "phone",
] as const;
export function VariableMenu({
  onInsert,
  disabled,
}: {
  onInsert: (snippet: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  const { data: catalog } = useQuery({
    queryKey: ["workflow-field-catalog"],
    queryFn: getFieldCatalog,
    staleTime: 5 * 60_000,
  });

  const contactCatalog = catalog?.find(
    (entity) => entity.entity === "contacts",
  );
  const allFields = contactCatalog?.fields ?? [];
  const labelFor = (path: string) =>
    allFields.find((field) => field.path === path)?.label ?? path;

  // Person fields the recipient namespace normalizes across leads and contacts.
  const recipientFields = RECIPIENT_PATHS.map((path) => ({
    path,
    label: labelFor(path),
  }));

  // Everything else the contacts table offers. These have no lead equivalent,
  // so they render blank when the recipient is a lead — which is honest, and
  // better than pretending the basics are contact-only too.
  const contactOnlyFields = allFields.filter(
    (field) =>
      !field.path.startsWith("metadata.") &&
      !RECIPIENT_PATHS.includes(field.path as (typeof RECIPIENT_PATHS)[number]),
  );
  const metadataFields = allFields.filter((field) =>
    field.path.startsWith("metadata."),
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
        >
          <Braces className="h-3.5 w-3.5" />
          {t("emailCampaigns.templates.variables.insert", {
            defaultValue: "Variable",
          })}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-80 w-64 overflow-y-auto"
      >
        <DropdownMenuLabel className="flex flex-col items-start gap-0.5">
          <span>
            {t("emailCampaigns.templates.variables.recipient", {
              defaultValue: "Recipient",
            })}
          </span>
          <span className="text-[10px] font-normal text-muted-foreground">
            {t("emailCampaigns.templates.variables.recipientHint", {
              defaultValue: "Works for leads and contacts",
            })}
          </span>
        </DropdownMenuLabel>
        {recipientFields.map((field) => (
          <DropdownMenuItem
            key={field.path}
            onSelect={() => onInsert(`{{recipient.${field.path}}}`)}
          >
            <span className="min-w-0 flex-1 truncate">{field.label}</span>
            <span className="ml-2 shrink-0 font-mono text-[10px] text-muted-foreground">
              {field.path}
            </span>
          </DropdownMenuItem>
        ))}
        {contactOnlyFields.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex flex-col items-start gap-0.5">
              <span>
                {t("emailCampaigns.templates.variables.contact", {
                  defaultValue: "Contact",
                })}
              </span>
              <span className="text-[10px] font-normal text-muted-foreground">
                {t("emailCampaigns.templates.variables.contactHint", {
                  defaultValue: "Blank when the recipient is a lead",
                })}
              </span>
            </DropdownMenuLabel>
            {contactOnlyFields.map((field) => (
              <DropdownMenuItem
                key={field.path}
                onSelect={() => onInsert(`{{contact.${field.path}}}`)}
              >
                <span className="min-w-0 flex-1 truncate">{field.label}</span>
                <span className="ml-2 shrink-0 font-mono text-[10px] text-muted-foreground">
                  {field.path}
                </span>
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
        {metadataFields.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>
              {t("emailCampaigns.templates.variables.custom", {
                defaultValue: "Custom fields",
              })}
            </DropdownMenuLabel>
            {metadataFields.map((field) => (
              <DropdownMenuItem
                key={field.path}
                onSelect={() => onInsert(`{{contact.${field.path}}}`)}
              >
                <span className="min-w-0 flex-1 truncate">{field.label}</span>
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>
          {t("emailCampaigns.templates.variables.other", {
            defaultValue: "Campaign",
          })}
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onInsert("{{workspace.name}}")}>
          {t("emailCampaigns.templates.variables.workspaceName", {
            defaultValue: "Workspace name",
          })}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onInsert("{{unsubscribe_url}}")}>
          {t("emailCampaigns.templates.variables.unsubscribeUrl", {
            defaultValue: "Unsubscribe link",
          })}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            onInsert('{{recipient.first_name | default: "there"}}')
          }
        >
          {t("emailCampaigns.templates.variables.firstNameFallback", {
            defaultValue: "First name with fallback",
          })}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
