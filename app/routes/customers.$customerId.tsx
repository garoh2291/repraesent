import { useEffect, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ListChecks, MessagesSquare, Info } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import { getCustomer } from "~/lib/api/customers";
import { getWorkspaceDetail } from "~/lib/api/workspaces";
import { LeadNotesSection } from "~/components/organism/lead-notes-section";
import { LeadTasksSection } from "~/components/organism/tasks/lead-tasks-section";
import type { WorkspaceMemberItem } from "~/components/organism/tasks/task-form-modal";
import { useCanEditLeads } from "~/lib/hooks/useCanEditLeads";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { CustomerHero } from "~/components/organism/customer-detail/customer-hero";
import { CustomerInfoCard } from "~/components/organism/customer-detail/customer-info-card";
import {
  CustomerPipelineCard,
  CustomerMetadataCard,
} from "~/components/organism/customer-detail/customer-pipeline-card";
import {
  ContactProfileSection,
  CompanyProfileSection,
  CompanyAttachSection,
  ContactCompanyLinksSection,
} from "~/components/organism/customer-detail/customer-crm-panel";

export function meta() {
  return [
    { title: "Customer - Repraesent" },
    { name: "description", content: "Customer details" },
  ];
}

export default function CustomerDetailPage() {
  const { t } = useTranslation();
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentWorkspace } = useAuthContext();
  const canEdit = useCanEditLeads();

  const hasAccess =
    currentWorkspace?.services?.some(
      (s) => s.service_type === "lead-form" || s.service_slug === "lead-form",
    ) ?? false;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["customer", customerId],
    queryFn: () => getCustomer(customerId!),
    enabled: !!customerId && hasAccess,
  });

  const workspaceQuery = useQuery({
    queryKey: ["workspace-detail"],
    queryFn: () => getWorkspaceDetail(),
    enabled: !!currentWorkspace && hasAccess,
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

  const invalidateCustomer = () => {
    if (!customerId) return;
    void queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
  };

  if (!hasAccess) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t("customers.noAccess", {
          defaultValue: "Customers are not available for this workspace.",
        })}
      </div>
    );
  }

  if (!customerId) {
    navigate("/customers", { replace: true });
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
          {t("customers.detailNotFound", {
            defaultValue: "Customer could not be loaded.",
          })}
        </p>
        <Link
          to="/customers"
          className="text-sm font-medium text-primary hover:underline"
        >
          {t("customers.backToList", { defaultValue: "Back to customers" })}
        </Link>
      </div>
    );
  }

  const { customer, contact, company, emails, phones, addresses } = data;
  const contactId = contact?.id ? String(contact.id) : null;
  const companyId = company?.id ? String(company.id) : null;
  const leadId = customer.lead_id ? String(customer.lead_id) : null;

  const displayName =
    (contact?.full_name as string)?.trim() ||
    [contact?.first_name, contact?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    (company?.name as string) ||
    t("customers.unnamed", { defaultValue: "Customer" });

  const taskLeadId = leadId ?? undefined;
  const taskCustomerId = !leadId ? customerId : undefined;
  const taskContextLabel = displayName;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 app-fade-in">
      <CustomerHero
        displayName={displayName}
        customer={customer}
        contact={contact}
        company={company}
        emails={emails}
        phones={phones}
        addresses={addresses}
        leadId={leadId}
      />

      {leadId ? (
        <div className="app-fade-up app-fade-up-d1 flex items-start gap-2 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <p className="flex-1">
            {t("customers.activitySameAsLead", {
              defaultValue:
                "Tasks use the lead when linked; notes below show the lead timeline (shared with the lead page).",
            })}{" "}
            <Link
              to={`/lead-form/${leadId}`}
              className="font-medium text-primary hover:underline"
            >
              {t("customers.openLead", { defaultValue: "Open lead" })}
            </Link>
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="space-y-4 sm:space-y-6 lg:col-span-2">
          <CustomerInfoCard
            contactId={contactId}
            companyId={companyId}
            emails={emails}
            phones={phones}
            addresses={addresses}
            canEdit={canEdit}
            onInvalidate={invalidateCustomer}
          />

          {contact && contactId ? (
            <ContactProfileSection
              contactId={contactId}
              contact={contact}
              canEdit={canEdit}
              onSaved={invalidateCustomer}
            />
          ) : null}

          {company && companyId ? (
            <CompanyProfileSection
              companyId={companyId}
              company={company}
              canEdit={canEdit}
              onSaved={invalidateCustomer}
            />
          ) : (
            <CompanyAttachSection
              customerId={customerId}
              canEdit={canEdit}
              onAttached={invalidateCustomer}
            />
          )}

          {contactId ? (
            <ContactCompanyLinksSection
              contactId={contactId}
              canEdit={canEdit}
              onChanged={invalidateCustomer}
            />
          ) : null}

          <section className="app-fade-up app-fade-up-d2 overflow-hidden rounded-2xl border border-border bg-card shadow-(--shadow)">
            <Tabs defaultValue="tasks" className="w-full">
              <div className="border-b border-border px-3 sm:px-4">
                <TabsList variant="line" className="h-10 gap-1">
                  <TabsTrigger value="tasks" className="gap-2 px-3 text-xs">
                    <ListChecks className="h-3.5 w-3.5" />
                    {t("tasks.title", { defaultValue: "Tasks" })}
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="gap-2 px-3 text-xs">
                    <MessagesSquare className="h-3.5 w-3.5" />
                    {t("leads.detail.notes", { defaultValue: "Notes" })}
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="tasks" className="mt-0 p-4 sm:p-5">
                <LeadTasksSection
                  leadId={taskLeadId}
                  customerId={taskCustomerId}
                  linkedContextLabel={taskContextLabel}
                  canEdit={canEdit}
                  workspaceMembers={workspaceMembers}
                />
              </TabsContent>
              <TabsContent value="notes" className="mt-0 p-4 sm:p-5">
                {leadId ? (
                  <LeadNotesSection leadId={leadId} canEdit={canEdit} />
                ) : (
                  <LeadNotesSection customerId={customerId} canEdit={canEdit} />
                )}
              </TabsContent>
            </Tabs>
          </section>
        </div>

        <div className="space-y-4 sm:space-y-6 lg:col-span-1">
          <div className="lg:sticky lg:top-6">
            <div className="space-y-4 sm:space-y-6">
              <CustomerPipelineCard
                customerId={customerId}
                customer={customer}
                workspaceMembers={workspaceMembers}
                canEdit={canEdit}
              />
              <CustomerMetadataCard customer={customer} leadId={leadId} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
