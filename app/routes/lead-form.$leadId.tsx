import { useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "~/providers/auth-provider";
import {
  LeadInfoSection,
  LeadHistorySection,
} from "~/components/organism/lead-detail-sheet";
import { LeadNotesSection } from "~/components/organism/lead-notes-section";
import { Card, CardContent } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { getLead, getLeadHistory } from "~/lib/api/leads";
import { useCanEditLeads } from "~/lib/hooks/useCanEditLeads";
import { useUpdateLeadStatus } from "~/lib/hooks/useUpdateLeadStatus";
import { ArrowLeft, Loader2 } from "lucide-react";

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

  const displayName =
    lead.full_name ||
    [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() ||
    "Lead";

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link
          to="/lead-form"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to leads
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
      </div>

      <hr className="border-border" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardContent className="pt-6">
            <LeadInfoSection
              lead={lead}
              onStatusChange={canEdit ? handleStatusChange : undefined}
              isStatusUpdating={updateStatusMutation.isPending}
              withoutLink
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="notes" className="w-full">
              <TabsList variant="line" className="w-full mb-4">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
