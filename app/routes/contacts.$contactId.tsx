import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthContext } from "~/providers/auth-provider";
import { getContact, getContactHistory } from "~/lib/api/contacts-crm";
import { getWorkspaceDetail } from "~/lib/api/workspaces";
import { LeadHistorySection } from "~/components/organism/lead-detail-sheet";
import { LeadNotesSection } from "~/components/organism/lead-notes-section";
import { LeadTasksSection } from "~/components/organism/tasks/lead-tasks-section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type { WorkspaceMemberItem } from "~/components/organism/tasks/task-form-modal";
import { useCanEditLeads } from "~/lib/hooks/useCanEditLeads";
import { ContactHero } from "~/components/organism/contact-detail/contact-hero";
import { ContactInfoCard } from "~/components/organism/contact-detail/contact-info-card";
import { ContactDealsSection } from "~/components/organism/contact-deals-section";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
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

export function meta() {
  return [
    { title: "Contact - Repraesent" },
    { name: "description", content: "Contact details" },
  ];
}

export default function ContactDetailPage() {
  const { t } = useTranslation();
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

  const hasAccess =
    currentWorkspace?.services?.some(
      (s) => s.service_type === "lead-form" || s.service_slug === "lead-form"
    ) ?? false;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["contact", contactRouteId],
    queryFn: () => getContact(contactRouteId!),
    enabled: !!contactRouteId && hasAccess,
  });

  const { data: contactHistory = [], isLoading: contactHistoryLoading } =
    useQuery({
      queryKey: ["contact-history", contactRouteId],
      queryFn: () => getContactHistory(contactRouteId!),
      enabled: !!contactRouteId && hasAccess && !!data,
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
    [workspaceQuery.data]
  );

  useEffect(() => {
    if (!currentWorkspace) {
      navigate("/", { replace: true });
    }
  }, [currentWorkspace, navigate]);

  const invalidateContact = () => {
    if (!contactRouteId) return;
    void queryClient.invalidateQueries({
      queryKey: ["contact", contactRouteId],
    });
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
      toast.success(
        t("contacts.deleteContactSuccess", {
          defaultValue: "Contact removed.",
        })
      );
      navigate("/contacts", { replace: true });
    },
    onError: () => {
      toast.error(
        t("contacts.deleteContactError", {
          defaultValue: "Could not delete contact.",
        })
      );
    },
  });

  if (!hasAccess) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t("contacts.noAccess", {
          defaultValue: "Contacts are not available for this workspace.",
        })}
      </div>
    );
  }

  if (!contactRouteId) {
    navigate("/contacts", { replace: true });
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
          to="/contacts"
          className="text-sm font-medium text-primary hover:underline"
        >
          {t("contacts.backToList", { defaultValue: "Back to contacts" })}
        </Link>
      </div>
    );
  }

  const { crm, contact, emails, phones, addresses } = data;
  const resolvedContactId = contact?.id ? String(contact.id) : contactRouteId;
  const leadId = crm.lead_id ? String(crm.lead_id) : null;

  const displayName =
    (contact?.full_name as string)?.trim() ||
    [contact?.first_name, contact?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    t("contacts.unnamed", { defaultValue: "Contact" });

  const taskLeadId = leadId ?? undefined;
  const taskContactId = !leadId ? resolvedContactId : undefined;
  const taskContextLabel = displayName;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 app-fade-in">
      <Link
        to={cameFromLead ? `/lead-form/${cameFromLead}` : "/contacts"}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {cameFromLead
          ? t("leads.detail.backToLead", { defaultValue: "Back to lead" })
          : t("contacts.backToList", { defaultValue: "Back to contacts" })}
      </Link>

      <div className="relative">
        <ContactHero
          displayName={displayName}
          crm={crm}
          contact={contact}
          emails={emails}
          phones={phones}
          addresses={addresses}
          leadId={leadId}
        />

        {canEdit ? (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("contacts.deleteContact", {
                    defaultValue: "Delete contact",
                  })}
                  className="absolute right-2 top-2 h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {t("contacts.deleteContact", {
                  defaultValue: "Delete contact",
                })}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("contacts.deleteContactConfirmTitle", {
                defaultValue: "Delete this contact?",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("contacts.deleteContactConfirmDescription", {
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

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-5">
        <div className="space-y-4 sm:space-y-6 lg:col-span-3">
          <ContactInfoCard
            contactId={resolvedContactId}
            contact={contact}
            crm={crm}
            emails={emails}
            phones={phones}
            addresses={addresses}
            canEdit={canEdit}
            onInvalidate={invalidateContact}
          />
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
            <Tabs defaultValue="tasks" className="w-full">
              <TabsList variant="line" className="w-full mb-4 sm:mb-5">
                <TabsTrigger value="tasks">{t("tasks.title")}</TabsTrigger>
                <TabsTrigger value="notes">
                  {t("leads.detail.notes")}
                </TabsTrigger>
                <TabsTrigger value="history">
                  {t("leads.detail.history")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="tasks" className="mt-0">
                <LeadTasksSection
                  leadId={taskLeadId}
                  contactId={taskContactId}
                  linkedContextLabel={taskContextLabel}
                  historyContactId={resolvedContactId}
                  canEdit={canEdit}
                  workspaceMembers={workspaceMembers}
                />
              </TabsContent>
              <TabsContent value="notes" className="mt-0">
                <LeadNotesSection
                  leadId={leadId ?? undefined}
                  contactId={!leadId ? resolvedContactId : undefined}
                  linkedContactId={leadId ? resolvedContactId : undefined}
                  canEdit={canEdit}
                />
              </TabsContent>
              <TabsContent value="history" className="mt-0">
                <LeadHistorySection
                  history={contactHistory}
                  isLoading={contactHistoryLoading}
                  withoutLink
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-6 lg:col-span-2">
          <div className="lg:sticky lg:top-6">
            <ContactDealsSection
              contactRouteId={contactRouteId}
              contactDisplayName={displayName}
              canEdit={canEdit}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
