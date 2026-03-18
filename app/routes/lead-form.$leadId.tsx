import { useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "~/providers/auth-provider";
import {
  LeadInfoSection,
  LeadHistorySection,
} from "~/components/organism/lead-detail-sheet";
import { LeadNotesSection } from "~/components/organism/lead-notes-section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { getLead, getLeadHistory } from "~/lib/api/leads";
import { useCanEditLeads } from "~/lib/hooks/useCanEditLeads";
import { useUpdateLeadStatus } from "~/lib/hooks/useUpdateLeadStatus";
import { ArrowLeft } from "lucide-react";

export function meta() {
  return [
    { title: "Lead - Repraesent" },
    { name: "description", content: "Lead details" },
  ];
}

export default function LeadFormLeadId() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const { currentWorkspace } = useAuthContext();

  const updateStatusMutation = useUpdateLeadStatus();
  const canEdit = useCanEditLeads();

  const { data: lead, isLoading: leadLoading } = useQuery({
    queryKey: ["lead", leadId],
    queryFn: () => getLead(leadId!),
    enabled: !!leadId,
  });

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ["lead-history", leadId],
    queryFn: () => getLeadHistory(leadId!),
    enabled: !!leadId,
  });

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
          <p className="text-sm text-muted-foreground">Loading lead…</p>
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
    <div className="p-6 space-y-6 app-fade-in">
      {/* Header */}
      <div className="app-fade-up space-y-2">
        <Link
          to="/lead-form"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to leads
        </Link>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          {displayName}
        </h1>
      </div>

      <div className="border-t border-border" />

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 app-fade-up app-fade-up-d1">
        {/* Lead info panel */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <LeadInfoSection
            lead={lead}
            onStatusChange={canEdit ? handleStatusChange : undefined}
            isStatusUpdating={updateStatusMutation.isPending}
            withoutLink
          />
        </div>

        {/* Notes + history panel */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <Tabs defaultValue="notes" className="w-full">
            <TabsList variant="line" className="w-full mb-5">
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
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
    </div>
  );
}
