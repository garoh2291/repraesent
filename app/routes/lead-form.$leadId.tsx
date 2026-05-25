import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuthContext } from "~/providers/auth-provider";
import {
  LeadInfoSection,
  LeadHistorySection,
} from "~/components/organism/lead-detail-sheet";
import { LeadNotesSection } from "~/components/organism/lead-notes-section";
import { LeadTasksSection } from "~/components/organism/tasks/lead-tasks-section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { getLead, getLeadHistory } from "~/lib/api/leads";
import { getWorkspaceDetail } from "~/lib/api/workspaces";
import type { WorkspaceMemberItem } from "~/components/organism/tasks/task-form-modal";
import { useCanEditLeads } from "~/lib/hooks/useCanEditLeads";
import { useUpdateLeadStatus } from "~/lib/hooks/useUpdateLeadStatus";
import { ArrowLeft, UserPlus, UserCheck } from "lucide-react";
import { toast } from "sonner";
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
import {
  getContactIdByLead,
  convertLeadToContact,
  getContact,
} from "~/lib/api/contacts-crm";
import { LeadContactConversionSuccessModal } from "~/components/organism/lead-contact-conversion-success-modal";
import { ContactHero } from "~/components/organism/contact-detail/contact-hero";
import { CreateDealDialog } from "~/components/organism/create-deal-dialog";
import i18n from "~/i18n";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";

export function meta() {
  return [
    { title: i18n.t("leads.detail.metaTitle") + " - Repraesent" },
    { name: "description", content: i18n.t("leads.detail.metaDescription") },
  ];
}

export default function LeadFormLeadId() {
  const { t } = useTranslation();
  useDocumentMeta({
    titleKey: "leads.detail.metaTitle",
    descriptionKey: "leads.detail.metaDescription",
    titleSuffix: " - Repraesent",
  });
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentWorkspace } = useAuthContext();
  const [conversionSuccessRouteId, setConversionSuccessRouteId] = useState<
    string | null
  >(null);
  const [convertConfirmOpen, setConvertConfirmOpen] = useState(false);
  const [createDealOpen, setCreateDealOpen] = useState(false);
  const [createDealPrefillContactId, setCreateDealPrefillContactId] = useState<
    string | null
  >(null);
  const [dealModalPrefillContactLabel, setDealModalPrefillContactLabel] =
    useState<string | null>(null);

  const updateStatusMutation = useUpdateLeadStatus();
  const canEdit = useCanEditLeads();

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
    [workspaceQuery.data]
  );

  const { data: lead, isLoading: leadLoading } = useQuery({
    queryKey: ["lead", leadId],
    queryFn: () => getLead(leadId!),
    enabled: !!leadId,
  });

  const { data: linkedContactId = null, isLoading: linkedContactLoading } =
    useQuery({
      queryKey: ["contact-by-lead", leadId],
      queryFn: () => getContactIdByLead(leadId!),
      enabled: !!leadId,
    });

  const { data: linkedContactData } = useQuery({
    queryKey: ["contact", linkedContactId],
    queryFn: () => getContact(linkedContactId!),
    enabled: !!linkedContactId,
  });

  const convertMutation = useMutation({
    mutationFn: () => convertLeadToContact(leadId!),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({
        queryKey: ["contact-by-lead", leadId],
      });
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      void queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      setConvertConfirmOpen(false);
      setConversionSuccessRouteId(res.id);
      toast.success(
        t("leads.detail.convertToContactSuccess", {
          defaultValue: "Contact created.",
        })
      );
    },
    onError: () => {
      toast.error(
        t("leads.detail.convertToContactError", {
          defaultValue: "Could not create contact.",
        })
      );
    },
  });

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ["lead-history", leadId],
    queryFn: () => getLeadHistory(leadId!),
    enabled: !!leadId,
  });

  const createDealDialogPrefillLabel = useMemo(() => {
    if (dealModalPrefillContactLabel?.trim()) {
      return dealModalPrefillContactLabel.trim();
    }
    const pid = createDealPrefillContactId ?? linkedContactId;
    if (!pid) return undefined;
    if (linkedContactData && pid === linkedContactId) {
      const c = linkedContactData.contact;
      const fromContact =
        (c?.full_name as string | undefined)?.trim() ||
        [c?.first_name, c?.last_name].filter(Boolean).join(" ").trim();
      if (fromContact) return fromContact;
    }
    if (pid === linkedContactId && lead) {
      return (
        lead.full_name?.trim() ||
        [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() ||
        undefined
      );
    }
    return undefined;
  }, [
    dealModalPrefillContactLabel,
    createDealPrefillContactId,
    linkedContactId,
    linkedContactData,
    lead,
  ]);

  useEffect(() => {
    if (!currentWorkspace) {
      navigate("/", { replace: true });
      return;
    }
    const hasLeadFormService = currentWorkspace.services?.some(
      (s) => s.service_type === "lead-form"
    );
    if (!hasLeadFormService) {
      navigate("/", { replace: true });
    }
  }, [currentWorkspace, navigate]);

  useEffect(() => {
    if (lead) {
      const name =
        lead.full_name ||
        [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() ||
        "Lead";
      document.title = `${name} - Repraesent`;
    }
  }, [lead]);

  const hasAccess =
    currentWorkspace?.services?.some((s) => s.service_type === "lead-form") ??
    false;

  if (!hasAccess) return null;

  if (!leadId) {
    navigate("/lead-form", { replace: true });
    return null;
  }

  if (leadLoading || !lead) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
          <p className="text-sm text-muted-foreground">
            {t("leads.detail.loading")}
          </p>
        </div>
      </div>
    );
  }

  const handleStatusChange = (
    id: string,
    status: import("~/lib/api/leads").LeadStatus
  ) => {
    updateStatusMutation.mutate({ id, status });
  };

  const displayName =
    lead.full_name ||
    [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() ||
    "Lead";

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 app-fade-in">
      {/* Header */}
      <div className="app-fade-up space-y-2">
        <Link
          to="/lead-form"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("leads.detail.backToLeads")}
        </Link>
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
          {displayName}
        </h1>
      </div>

      <div className="border-t border-border" />

      {linkedContactId && linkedContactData ? (
        <div className="app-fade-up space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            <UserCheck className="h-3 w-3" />
            {t("leads.detail.hasContact", {
              defaultValue: "This lead is linked to a contact.",
            })}
          </span>
          <ContactHero
            displayName={
              (linkedContactData.contact?.full_name as string)?.trim() ||
              [
                linkedContactData.contact?.first_name,
                linkedContactData.contact?.last_name,
              ]
                .filter(Boolean)
                .join(" ")
                .trim() ||
              displayName
            }
            crm={linkedContactData.crm}
            contact={linkedContactData.contact}
            emails={linkedContactData.emails}
            phones={linkedContactData.phones}
            addresses={linkedContactData.addresses}
            leadId={leadId ?? null}
            viewContactId={linkedContactId}
            onOpenCreateDeal={
              canEdit && linkedContactId
                ? () => {
                    setCreateDealPrefillContactId(null);
                    setDealModalPrefillContactLabel(null);
                    setCreateDealOpen(true);
                  }
                : undefined
            }
          />
        </div>
      ) : (
        <div className="app-fade-up rounded-xl border border-border bg-muted/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {linkedContactLoading ? (
              <span>{t("common.loading")}</span>
            ) : (
              <span>
                {t("leads.detail.convertHint", {
                  defaultValue: "Convert this lead to a contact",
                })}
              </span>
            )}
          </div>
          {!linkedContactId && canEdit && !linkedContactLoading ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="shrink-0"
              onClick={() => setConvertConfirmOpen(true)}
            >
              <UserPlus className="mr-1.5 h-4 w-4" />
              {t("leads.detail.convertToContact", {
                defaultValue: "Create as contact",
              })}
            </Button>
          ) : null}
        </div>
      )}

      <AlertDialog
        open={convertConfirmOpen}
        onOpenChange={setConvertConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("leads.detail.convertConfirmTitle", {
                defaultValue: "Create contact from this lead?",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("leads.detail.convertConfirmDescription", {
                defaultValue:
                  "A contact record will be created and linked to this lead. You can add pipeline deals afterward.",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                convertMutation.mutate();
              }}
              disabled={convertMutation.isPending}
            >
              {convertMutation.isPending
                ? t("common.loading")
                : t("leads.detail.convertConfirmAction", {
                    defaultValue: "Create contact",
                  })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 app-fade-up app-fade-up-d1">
        {/* Lead info panel */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <LeadInfoSection
            lead={lead}
            onStatusChange={canEdit ? handleStatusChange : undefined}
            isStatusUpdating={updateStatusMutation.isPending}
            withoutLink
          />
        </div>

        {/* Tasks + Notes + History panel */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <Tabs defaultValue="tasks" className="w-full">
            <TabsList variant="line" className="w-full mb-4 sm:mb-5">
              <TabsTrigger value="tasks">{t("tasks.title")}</TabsTrigger>
              <TabsTrigger value="notes">{t("leads.detail.notes")}</TabsTrigger>
              <TabsTrigger value="history">
                {t("leads.detail.history")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="tasks" className="mt-0">
              <LeadTasksSection
                leadId={lead.id}
                canEdit={canEdit}
                workspaceMembers={workspaceMembers}
              />
            </TabsContent>
            <TabsContent value="notes" className="mt-0">
              <LeadNotesSection leadId={lead.id} canEdit={canEdit} />
            </TabsContent>
            <TabsContent value="history" className="mt-0">
              <LeadHistorySection
                history={history}
                isLoading={historyLoading}
                withoutLink
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <CreateDealDialog
        open={createDealOpen}
        onOpenChange={(open) => {
          setCreateDealOpen(open);
          if (!open) {
            setCreateDealPrefillContactId(null);
            setDealModalPrefillContactLabel(null);
          }
        }}
        prefillContactId={
          createDealPrefillContactId ?? linkedContactId ?? undefined
        }
        prefillContactLabel={createDealDialogPrefillLabel}
        canCreate={canEdit}
      />

      <LeadContactConversionSuccessModal
        open={conversionSuccessRouteId !== null}
        onOpenChange={(open) => {
          if (!open) setConversionSuccessRouteId(null);
        }}
        routeContactId={conversionSuccessRouteId}
        onViewContact={(id) => {
          navigate(`/contacts/${id}`);
          setConversionSuccessRouteId(null);
        }}
        onCreateDeal={(id) => {
          setConversionSuccessRouteId(null);
          setCreateDealPrefillContactId(id);
          if (lead) {
            const name =
              lead.full_name?.trim() ||
              [lead.first_name, lead.last_name]
                .filter(Boolean)
                .join(" ")
                .trim() ||
              "";
            setDealModalPrefillContactLabel(name || null);
          }
          setCreateDealOpen(true);
        }}
      />
    </div>
  );
}
