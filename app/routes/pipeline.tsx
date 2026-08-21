import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "~/providers/auth-provider";
import { getWorkspaceDetail } from "~/lib/api/workspaces";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { useSearchShortcut } from "~/lib/hooks/useSearchShortcut";
import { useCanEditLeads } from "~/lib/hooks/useCanEditLeads";
import {
  getDeals,
  patchDeal,
  type DealListItem,
} from "~/lib/api/deals";
import {
  patchDealInLists,
  restoreSnapshots,
  type ListSnapshots,
} from "~/lib/deals/optimistic";
import { useDealStages } from "~/lib/hooks/usePipelineStages";
import {
  DEFAULT_DEAL_SORT,
  isDealSortMode,
  type DealSortMode,
} from "~/lib/deals/deal-sort";
import { DealsPipelineKanban } from "~/components/organism/deals-pipeline-kanban";
import { CreateDealDialog } from "~/components/organism/create-deal-dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { ArrowUpDown, Plus, X } from "lucide-react";
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
  const sortParam = searchParams.get("sort");
  const sortMode: DealSortMode = isDealSortMode(sortParam)
    ? sortParam
    : DEFAULT_DEAL_SORT;
  const debouncedSearch = useDebounce(search, 300);
  const { ref: searchInputRef, withHint } = useSearchShortcut();
  const { byKey: dealStagesByKey } = useDealStages();

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

  // Shared with the deal page and its side panels (lib/deals/optimistic).
  const applyOptimisticDeal = (dealId: string, patch: Partial<DealListItem>) =>
    patchDealInLists(queryClient, dealId, patch);
  const rollbackSnapshots = (snapshots: ListSnapshots) =>
    restoreSnapshots(queryClient, snapshots);

  type Snapshots = ListSnapshots;

  const patchStageMutation = useMutation({
    mutationFn: ({
      dealId,
      stage,
    }: {
      dealId: string;
      stage: string;
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

  const onStageChange = (dealId: string, stage: string) => {
    queryClient.cancelQueries({ queryKey: ["deals-pipeline"] });
    // Mirror the backend's category-driven status coupling in the optimistic
    // patch so terminal moves render correctly before the refetch.
    const category = dealStagesByKey.get(stage)?.category;
    // Stamp the move locally so "newest first" puts the card on top of its
    // new column immediately — the refetch returns the server-derived stamp.
    const optimistic: Partial<DealListItem> = {
      stage,
      stage_changed_at: new Date().toISOString(),
    };
    if (category === "won") optimistic.status = "won";
    else if (category === "lost") optimistic.status = "lost";
    else optimistic.status = "new";
    const snapshots = applyOptimisticDeal(dealId, optimistic);
    patchStageMutation.mutate({ dealId, stage, snapshots });
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

  const hasFilters = !!(debouncedSearch || assignedTo);

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
    <div className="flex flex-col min-h-[calc(100vh-8rem)] p-4 sm:p-6 gap-4 sm:gap-6 app-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0 app-fade-up">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
            {t("nav.pipeline", { defaultValue: "Pipeline" })}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("pipeline.capHint", {
              defaultValue:
                "Showing up to 500 deals. Refine search or assignee if needed.",
            })}
          </p>
        </div>

        {canEdit ? (
          <Button
            type="button"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={() => {
              setNewDealPrefillContactId(null);
              setNewOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("pipeline.newDeal", { defaultValue: "New deal" })}
          </Button>
        ) : null}
      </div>

      <div className="border-t border-border shrink-0" />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 shrink-0 app-fade-up app-fade-up-d1">
        <div className="relative flex-1 sm:flex-none">
          <Input
            ref={searchInputRef}
            value={search}
            onChange={(e) => setParam("search", e.target.value)}
            placeholder={withHint(
              t("pipeline.searchPlaceholder", {
                defaultValue: "Title or contact…",
              })
            )}
            className="h-9 w-full sm:w-[220px] text-sm pr-3"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={assignedTo || "all"}
            onValueChange={(v) =>
              setParam("assigned_to", v === "all" ? undefined : v)
            }
          >
            <SelectTrigger className="h-9 w-[180px] text-xs">
              <SelectValue
                placeholder={t("contacts.assignedTo", {
                  defaultValue: "Assigned to",
                })}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                {t("pipeline.anyAssignee", { defaultValue: "Anyone" })}
              </SelectItem>
              {membersForSelect.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={sortMode}
            onValueChange={(v) =>
              setParam("sort", v === DEFAULT_DEAL_SORT ? undefined : v)
            }
          >
            <SelectTrigger className="h-9 w-[180px] text-xs">
              <span className="inline-flex items-center gap-1.5">
                <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc" className="text-xs">
                {t("pipeline.sort.dateDesc", { defaultValue: "Newest first" })}
              </SelectItem>
              <SelectItem value="date_asc" className="text-xs">
                {t("pipeline.sort.dateAsc", { defaultValue: "Oldest first" })}
              </SelectItem>
              <SelectItem value="value_desc" className="text-xs">
                {t("pipeline.sort.valueDesc", {
                  defaultValue: "Highest amount",
                })}
              </SelectItem>
              <SelectItem value="value_asc" className="text-xs">
                {t("pipeline.sort.valueAsc", { defaultValue: "Lowest amount" })}
              </SelectItem>
            </SelectContent>
          </Select>

          {hasFilters && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete("search");
                next.delete("assigned_to");
                setSearchParams(next);
              }}
            >
              {t("tasks.clearFilters", { defaultValue: "Clear filters" })}{" "}
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <DealsPipelineKanban
          deals={deals}
          isLoading={dealsQuery.isLoading}
          onStageChange={onStageChange}
          sortMode={sortMode}
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
