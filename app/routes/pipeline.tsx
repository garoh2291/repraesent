import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "~/providers/auth-provider";
import { getWorkspaceDetail } from "~/lib/api/workspaces";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { useCanEditLeads } from "~/lib/hooks/useCanEditLeads";
import {
  getDeals,
  patchDeal,
  patchDealStatus,
  type DealListItem,
  type DealStageKey,
  type PaginatedDeals,
} from "~/lib/api/deals";
import { DealsPipelineKanban } from "~/components/organism/deals-pipeline-kanban";
import { CreateDealDialog } from "~/components/organism/create-deal-dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export function meta() {
  return [
    { title: "Pipeline - Repraesent" },
    { name: "description", content: "Sales pipeline" },
  ];
}

export default function PipelinePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { currentWorkspace } = useAuthContext();
  const canEdit = useCanEditLeads();

  const search = searchParams.get("search") ?? "";
  const assignedTo = searchParams.get("assigned_to") ?? "";
  const debouncedSearch = useDebounce(search, 300);

  const [newOpen, setNewOpen] = useState(false);
  const [newDealPrefillContactId, setNewDealPrefillContactId] = useState<
    string | null
  >(null);

  const hasAccess =
    currentWorkspace?.services?.some(
      (s) => s.service_type === "lead-form" || s.service_slug === "lead-form",
    ) ?? false;

  const workspaceQuery = useQuery({
    queryKey: ["workspace-detail"],
    queryFn: () => getWorkspaceDetail(),
    enabled: hasAccess && !!currentWorkspace,
  });

  const dealsQuery = useQuery({
    queryKey: ["deals-pipeline", debouncedSearch, assignedTo || undefined],
    queryFn: () =>
      getDeals({
        page: 1,
        limit: 500,
        search: debouncedSearch || undefined,
        assigned_to: assignedTo || undefined,
      }),
    enabled: hasAccess && !!currentWorkspace,
    refetchOnMount: true,
  });

  const deals: DealListItem[] = dealsQuery.data?.data ?? [];

  const applyOptimisticDeal = (
    dealId: string,
    patch: Partial<DealListItem>,
  ) => {
    const snapshots: Array<[readonly unknown[], PaginatedDeals | undefined]> =
      [];
    const queries = queryClient.getQueriesData<PaginatedDeals>({
      queryKey: ["deals-pipeline"],
    });
    for (const [key, value] of queries) {
      snapshots.push([key, value]);
      if (!value) continue;
      const now = new Date().toISOString();
      const nextData = value.data.map((d) =>
        d.id === dealId ? { ...d, ...patch, updated_at: now } : d,
      );
      queryClient.setQueryData<PaginatedDeals>(key, { ...value, data: nextData });
    }
    return snapshots;
  };

  const rollbackSnapshots = (
    snapshots: Array<[readonly unknown[], PaginatedDeals | undefined]>,
  ) => {
    for (const [key, value] of snapshots) {
      queryClient.setQueryData(key, value);
    }
  };

  type Snapshots = Array<[readonly unknown[], PaginatedDeals | undefined]>;

  const patchStageMutation = useMutation({
    mutationFn: ({
      dealId,
      stage,
    }: {
      dealId: string;
      stage: DealStageKey;
      snapshots: Snapshots;
    }) => patchDeal(dealId, { stage }),
    onError: (_err, vars) => {
      rollbackSnapshots(vars.snapshots);
      toast.error(
        t("pipeline.errors.moveFailed", { defaultValue: "Could not move deal." }),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["deals-pipeline"] });
      void queryClient.invalidateQueries({ queryKey: ["contact-deals"] });
      void queryClient.invalidateQueries({ queryKey: ["deal"] });
    },
  });

  const terminalMutation = useMutation({
    mutationFn: ({
      dealId,
      status,
    }: {
      dealId: string;
      status: "won" | "lost";
      snapshots: Snapshots;
    }) => patchDealStatus(dealId, status),
    onError: (_err, vars) => {
      rollbackSnapshots(vars.snapshots);
      toast.error(
        t("pipeline.errors.statusFailed", {
          defaultValue: "Could not update deal outcome.",
        }),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["deals-pipeline"] });
      void queryClient.invalidateQueries({ queryKey: ["contact-deals"] });
      void queryClient.invalidateQueries({ queryKey: ["deal"] });
    },
  });

  useEffect(() => {
    if (searchParams.get("newDeal") === "1") {
      const cid = searchParams.get("contactId");
      setNewDealPrefillContactId(cid);
      setNewOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("newDeal");
      next.delete("contactId");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const setParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(searchParams);
    if (value === undefined || value === "") next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  };

  const members = workspaceQuery.data?.members ?? [];

  const onStageChange = (dealId: string, stage: DealStageKey) => {
    queryClient.cancelQueries({ queryKey: ["deals-pipeline"] });
    const snapshots = applyOptimisticDeal(dealId, { stage });
    patchStageMutation.mutate({ dealId, stage, snapshots });
  };

  const onTerminal = (dealId: string, status: "won" | "lost") => {
    queryClient.cancelQueries({ queryKey: ["deals-pipeline"] });
    const snapshots = applyOptimisticDeal(dealId, {
      stage: status,
      status,
    });
    terminalMutation.mutate({ dealId, status, snapshots });
  };

  const membersForSelect = useMemo(
    () =>
      members.map((m) => ({
        id: m.user_id,
        label:
          [m.user_first_name, m.user_last_name].filter(Boolean).join(" ") ||
          m.user_email,
      })),
    [members],
  );

  if (!hasAccess) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t("contacts.noAccess", {
          defaultValue: "This workspace does not include CRM access.",
        })}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6 app-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
          {t("nav.pipeline", { defaultValue: "Pipeline" })}
        </h1>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">
              {t("pipeline.search", { defaultValue: "Search" })}
            </Label>
            <Input
              className="h-9 w-[200px]"
              value={search}
              onChange={(e) => setParam("search", e.target.value)}
              placeholder={t("pipeline.searchPlaceholder", {
                defaultValue: "Title or contact…",
              })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">
              {t("contacts.assignedTo", { defaultValue: "Assigned to" })}
            </Label>
            <Select
              value={assignedTo || "all"}
              onValueChange={(v) =>
                setParam("assigned_to", v === "all" ? undefined : v)
              }
            >
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("pipeline.anyAssignee", { defaultValue: "Anyone" })}
                </SelectItem>
                {membersForSelect.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              className="h-9"
              onClick={() => {
                setNewDealPrefillContactId(null);
                setNewOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {t("pipeline.newDeal", { defaultValue: "New deal" })}
            </Button>
          ) : null}
        </div>
      </div>

      <p className="mt-1 text-xs text-muted-foreground shrink-0">
        {t("pipeline.capHint", {
          defaultValue: "Showing up to 500 deals. Refine search or assignee if needed.",
        })}
      </p>

      <div className="mt-4 min-h-0 flex-1 flex flex-col">
        <DealsPipelineKanban
          deals={deals}
          isLoading={dealsQuery.isLoading}
          onStageChange={onStageChange}
          onTerminal={onTerminal}
          isUpdating={false}
          canEdit={canEdit}
          onDealSelect={(id) => navigate(`/pipeline/${id}`)}
        />
      </div>

      <CreateDealDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        prefillContactId={newDealPrefillContactId}
        canCreate={canEdit}
      />
    </div>
  );
}
