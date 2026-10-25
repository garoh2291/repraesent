import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BackLink } from "~/components/notebook/back-link";
import { personNameOr } from "~/lib/contacts/display-name";
import { contactListPath, contactPath } from "~/lib/contacts/contact-path";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthContext } from "~/providers/auth-provider";
import { getContact, getContactHistory } from "~/lib/api/contacts-crm";
import { getWorkspaceDetail } from "~/lib/api/workspaces";
import { ActivityPanel } from "~/components/organism/activity-panel";
import { useComposeEmail } from "~/components/organism/compose-email/use-compose-email";
import { composeInvalidateKeys } from "~/components/organism/activity-panel/shared";
import type { WorkspaceMemberItem } from "~/components/organism/tasks/task-form-modal";
import { useCanEditLeads } from "~/lib/hooks/useCanEditLeads";
import { ContactHero } from "~/components/organism/contact-detail/contact-hero";
import { ContactInfoCard } from "~/components/organism/contact-detail/contact-info-card";
import { ContactDealsSection } from "~/components/organism/contact-deals-section";
import { ContactCompanySection } from "~/components/organism/contact-company-section";
import { PhotoStrip } from "~/components/notebook/photo-strip";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { deleteContact } from "~/lib/api/contacts";
import { AppointmentsCard } from "~/components/appointment-book/appointments-card";

export function meta({ location }: { location: { pathname: string } }) {
  return [
    {
      title: location.pathname.startsWith("/companies")
        ? "Company - Repraesent"
        : "Contact - Repraesent",
    },
    { name: "description", content: "Contact details" },
  ];
}

export default function ContactDetailPage() {
  const { t } = useTranslation();
  const { openCompose } = useComposeEmail();
  const { contactId: contactRouteId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const navState = (location.state ?? null) as {
    from?: string;
    leadId?: string;
  } | null;
  const cameFromLead =
    navState?.from === "lead" && typeof navState?.leadId === "string"
      ? navState.leadId
      : null;
  const { currentWorkspace } = useAuthContext();
  const canEdit = useCanEditLeads();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["contact", contactRouteId],
    queryFn: () => getContact(contactRouteId!),
    enabled: !!contactRouteId,
  });

  const { data: contactHistory = [], isLoading: contactHistoryLoading } =
    useQuery({
      queryKey: ["contact-history", contactRouteId],
      queryFn: () => getContactHistory(contactRouteId!),
      enabled: !!contactRouteId && !!data,
    });

  const workspaceQuery = useQuery({
    queryKey: ["workspace-detail"],
    queryFn: () => getWorkspaceDetail(),
    enabled: !!currentWorkspace,
  });

  const workspaceMembers: WorkspaceMemberItem[] = useMemo(
    () =>
      (workspaceQuery.data?.members ?? []).map((m) => ({
        user_id: m.user_id,
        user_first_name: m.user_first_name,
        user_last_name: m.user_last_name,
        user_email: m.user_email,
        role: m.role,
      })),
    [workspaceQuery.data],
  );

  useEffect(() => {
    if (!currentWorkspace) {
      navigate("/", { replace: true });
    }
  }, [currentWorkspace, navigate]);

  // A company lives under Companies, a person under People. A link that did
  // not know which it was pointing at lands here and is moved to the right
  // place, so the right tab is lit and Back goes to the right list.
  const loadedKind = data?.contact?.kind as string | undefined;
  const loadedId = data?.contact?.id ? String(data.contact.id) : null;
  useEffect(() => {
    if (!loadedId || !loadedKind) return;
    const want = contactPath({ id: loadedId, kind: loadedKind });
    if (location.pathname !== want) {
      navigate(want, { replace: true, state: location.state });
    }
  }, [loadedId, loadedKind, location.pathname, location.state, navigate]);

  // Before the contact has loaded, the address itself says where we are.
  const listPath = contactListPath(
    loadedKind ??
      (location.pathname.startsWith("/companies") ? "company" : "person"),
  );
  const isCompany = listPath === "/companies";

  const invalidateContact = () => {
    if (!contactRouteId) return;
    // Every open contact page, not only this one: linking a person to a
    // company also changes the company's page ("People here"), and a company's
    // deals list includes its people's deals.
    void queryClient.invalidateQueries({ queryKey: ["contact"] });
    void queryClient.invalidateQueries({ queryKey: ["contact-deals"] });
    void queryClient.invalidateQueries({
      queryKey: ["contact-history", contactRouteId],
    });
    void queryClient.invalidateQueries({ queryKey: ["contacts"] });
  };

  const deleteContactMutation = useMutation({
    mutationFn: () => deleteContact(contactRouteId!),
    onSuccess: () => {
      setDeleteConfirmOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      void queryClient.removeQueries({ queryKey: ["contact", contactRouteId] });
      // A company that lost this person, or people who lost this company.
      void queryClient.invalidateQueries({ queryKey: ["contact"] });
      void queryClient.invalidateQueries({ queryKey: ["contact-deals"] });
      toast.success(
        isCompany
          ? t("contacts.companies.deleted", "Company removed.")
          : t("contacts.deleteContactSuccess", {
              defaultValue: "Contact removed.",
            }),
      );
      navigate(listPath, { replace: true });
    },
    onError: () => {
      toast.error(
        t("contacts.deleteContactError", {
          defaultValue: "Could not delete contact.",
        }),
      );
    },
  });

  if (!contactRouteId) {
    navigate(listPath, { replace: true });
    return null;
  }

  if (isLoading || !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="app-spin h-6 w-6 rounded-full border-2 border-primary/20 border-t-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-destructive">
          {t("contacts.detailNotFound", {
            defaultValue: "Contact could not be loaded.",
          })}
        </p>
        <Link
          to={listPath}
          className="text-sm font-medium text-primary hover:underline"
        >
          {isCompany
            ? t("contacts.companies.backToList", "Back to companies")
            : t("contacts.backToList", { defaultValue: "Back to contacts" })}
        </Link>
      </div>
    );
  }

  const { crm, contact, emails, phones, addresses } = data;
  const websites = data.websites ?? [];
  const resolvedContactId = contact?.id ? String(contact.id) : contactRouteId;
  const leadId = crm.lead_id ? String(crm.lead_id) : null;

  // Prefilled recipient for a new email. Removable in the composer, so this is
  // a starting point rather than a constraint. Resolved before the name,
  // because the name falls back to it.
  const primaryEmail = emails.find((e) => e.is_primary) ?? emails[0];

  // The address before the generic word — "Contact" as a page title names the
  // type of thing you are looking at, not the person. A newsletter contact has
  // no name at all, and the address is what they actually gave you.
  const displayName = personNameOr(
    {
      full_name: contact?.full_name as string | null | undefined,
      first_name: contact?.first_name as string | null | undefined,
      last_name: contact?.last_name as string | null | undefined,
      company_name: contact?.company_name as string | null | undefined,
      email: primaryEmail?.address ? String(primaryEmail.address) : null,
    },
    t("contacts.unnamed", { defaultValue: "Contact" }),
  );

  const taskLeadId = leadId ?? undefined;
  const taskContactId = !leadId ? resolvedContactId : undefined;
  const taskContextLabel = displayName;

  const composeRecipients = primaryEmail?.address
    ? [{ email: String(primaryEmail.address), name: displayName }]
    : [];

  const openComposer = () =>
    openCompose({
      to: composeRecipients,
      contactId: resolvedContactId,
      contextLabel: t("compose.contextContact", {
        defaultValue: "To {{name}}",
        name: displayName,
      }),
      invalidateKeys: composeInvalidateKeys(
        { emailContactId: resolvedContactId },
        "contact",
      ),
    });

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 app-fade-in">
      <BackLink to={cameFromLead ? `/lead-form/${cameFromLead}` : listPath}>
        {cameFromLead
          ? t("leads.detail.backToLead", { defaultValue: "Back to lead" })
          : isCompany
            ? t("contacts.companies.backToList", "Back to companies")
            : t("contacts.backToList", { defaultValue: "Back to contacts" })}
      </BackLink>

      <ContactHero
        displayName={displayName}
        crm={crm}
        contact={contact}
        emails={emails}
        phones={phones}
        addresses={addresses}
        websites={websites}
        leadId={leadId}
        company={data.company ?? null}
        canEdit={canEdit}
        onCompose={
          canEdit && composeRecipients.length > 0 ? openComposer : undefined
        }
        onInvalidate={invalidateContact}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isCompany
                ? t(
                    "contacts.companies.deleteConfirmTitle",
                    "Delete this company?",
                  )
                : t("contacts.deleteContactConfirmTitle", {
                    defaultValue: "Delete this contact?",
                  })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isCompany
                ? t("contacts.companies.deleteConfirmDescription", {
                    name: displayName,
                    defaultValue:
                      "{{name}} will be removed. The people who work there stay in your contacts, without a company.",
                  })
                : t("contacts.deleteContactConfirmDescription", {
                    name: displayName,
                    defaultValue:
                      "{{name}} will be removed from your contacts. This does not delete a linked lead.",
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteContactMutation.isPending}
              onClick={() => deleteContactMutation.mutate()}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Below lg the two columns dissolve (`contents`) and every block takes
          its own place: who they work with and their deals come before the
          long activity list, not under it. Desktop keeps the two columns. */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-5">
        <div className="max-lg:contents lg:col-span-3 lg:space-y-6">
          <div className="max-lg:order-3">
          <ContactInfoCard
            contactId={resolvedContactId}
            contact={contact}
            crm={crm}
            emails={emails}
            phones={phones}
            addresses={addresses}
            websites={websites}
            canEdit={canEdit}
            onInvalidate={invalidateContact}
          />
          </div>
          {/* Team-only photos, right after the info card. */}
          {resolvedContactId ? (
            <div className="max-lg:order-4">
              <PhotoStrip entity="contacts" entityId={resolvedContactId} canEdit={canEdit} />
            </div>
          ) : null}
          <div className="max-lg:order-5">
          <ActivityPanel
            variant="contact"
            leadId={taskLeadId}
            contactId={taskContactId}
            linkedContactId={leadId ? resolvedContactId : undefined}
            historyContactId={resolvedContactId}
            emailContactId={resolvedContactId}
            contextLabel={taskContextLabel}
            composeRecipients={composeRecipients}
            canEdit={canEdit}
            workspaceMembers={workspaceMembers}
            history={contactHistory}
            historyLoading={contactHistoryLoading}
          />
          </div>
        </div>

        <div className="max-lg:contents lg:col-span-2">
          <div className="max-lg:contents lg:sticky lg:top-6 lg:space-y-6">
            <div className="max-lg:order-1">
            <ContactCompanySection
              contactId={resolvedContactId}
              displayName={displayName}
              isCompany={contact?.kind === "company"}
              company={data.company ?? null}
              people={data.people ?? []}
              includes={data.includes ?? []}
              canEdit={canEdit}
              onInvalidate={invalidateContact}
            />
            </div>
            <div className="max-lg:order-2">
            <AppointmentsCard
              className="mb-4 sm:mb-6"
              target={{ contactId: resolvedContactId }}
              prefill={{
                contact: {
                  id: resolvedContactId,
                  label: displayName,
                  kind: contact?.kind === "company" ? "company" : "person",
                },
              }}
            />
            <ContactDealsSection
              contactRouteId={contactRouteId}
              contactDisplayName={displayName}
              canEdit={canEdit}
              showEarnedTotal={contact?.kind === "company"}
            />
            </div>
          </div>
        </div>
      </div>

      {canEdit ? (
        <div className="flex justify-end max-sm:border-t max-sm:border-border max-sm:pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive max-sm:h-11 max-sm:w-full max-sm:justify-center max-sm:rounded-xl max-sm:border max-sm:border-border max-sm:text-sm max-sm:text-destructive"
            onClick={() => setDeleteConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            {t("common.delete", { defaultValue: "Delete" })}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
