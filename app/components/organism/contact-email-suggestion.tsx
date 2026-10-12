import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Users, ArrowUpRight } from "lucide-react";
import type {
  ContactCompanyMatch,
  ContactEmailMatch,
} from "~/lib/api/contacts-crm";

/**
 * Shown on the lead page / detail sheet when a lead has no linked contact but a
 * contact with the SAME email already exists in the workspace. We keep the DB
 * rule of one contact per lead, so we don't auto-link — we point the user at the
 * existing contact instead. Amber = "heads up", not an error.
 *
 * With `company` it says the same about an inquiry that names a company that
 * is already saved: one contact per company, so open it and add the person.
 */
export function ContactEmailSuggestion(
  props:
    | { contact: ContactEmailMatch; email: string; company?: undefined }
    | { company: ContactCompanyMatch; contact?: undefined; email?: undefined },
) {
  const { t } = useTranslation();
  const contact = props.company ?? props.contact;
  const email = props.email ?? "";

  const name =
    contact.full_name?.trim() ||
    props.contact?.primary_email?.trim() ||
    email ||
    t("contacts.suggestion.unnamed", { defaultValue: "Existing contact" });

  return (
    <div className="app-fade-up rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400">
          <Users className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            {props.company
              ? t("contacts.suggestion.companyTitle", {
                  defaultValue: "This company is already in your contacts",
                })
              : t("contacts.suggestion.title", {
                  defaultValue: "A contact with this email already exists",
                })}
          </p>
          <p className="text-xs leading-relaxed text-amber-800/80 dark:text-amber-300/80">
            {props.company
              ? t("contacts.suggestion.companyBody", {
                  name,
                  defaultValue:
                    "{{name}} is already saved. Open it and add the person you talk to there.",
                })
              : t("contacts.suggestion.body", {
              email: props.contact?.primary_email || email,
              defaultValue:
                "{{email}} is already used by another contact. A lead can only link to one contact, so it can't be connected here — open the existing contact instead.",
            })}
          </p>
          <Link
            to={`/contacts/${contact.id}`}
            className="inline-flex items-center gap-1 rounded-md text-xs font-semibold text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-100"
          >
            <span className="truncate">
              {t("contacts.suggestion.view", {
                name,
                defaultValue: "View {{name}}",
              })}
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
          </Link>
        </div>
      </div>
    </div>
  );
}
