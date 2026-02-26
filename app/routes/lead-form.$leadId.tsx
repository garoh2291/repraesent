import { useEffect } from "react";
import { useParams, useNavigate } from "react-router";
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
import { Loader2 } from "lucide-react";

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
    const hasLeadFormProduct = currentWorkspace.products?.some(
      (p) => p.product_slug === "lead-form"
    );
    if (!hasLeadFormProduct) {
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
    currentWorkspace?.products?.some((p) => p.product_slug === "lead-form") ??
    false;

  if (!hasAccess) {
    return null;
  }

  if (!leadId) {
    navigate("/lead-form", { replace: true });
    return null;
  }

  if (leadLoading || !lead) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleStatusChange = (
    id: string,
    status: import("~/lib/api/leads").LeadStatus
  ) => {
    updateStatusMutation.mutate({ id, status });
  };

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 py-10">
        <div className="space-y-6">
          <LeadInfoSection
            lead={lead}
            onStatusChange={canEdit ? handleStatusChange : undefined}
            isStatusUpdating={updateStatusMutation.isPending}
            withoutLink
          />
        </div>
        <div className="space-y-6">
          <Tabs defaultValue="notes" className="w-full">
            <TabsList variant="line" className="w-full">
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <TabsContent value="notes" className="mt-4">
              <LeadNotesSection leadId={lead.id} canEdit={canEdit} />
            </TabsContent>
            <TabsContent value="history" className="mt-4">
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
