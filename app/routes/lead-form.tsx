import { useMemo, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useAuthContext } from "~/providers/auth-provider";
import { DataTable } from "~/components/organism/data-table";
import { LeadDetailSheet } from "~/components/organism/lead-detail-sheet";
import { LeadsKanban } from "~/components/organism/leads-kanban";
import { LeadStatusSelect } from "~/components/molecule/lead-status-select";
import FilterComponent from "~/components/molecule/filter-component";
import { LEAD_FILTER_STATUS_OPTIONS, LEAD_FILTER_SOURCE_OPTIONS } from "~/lib/leads/filter-presets";
import { Button } from "~/components/ui/button";
import TooltipContainer from "~/components/tooltip-container";
import { getLeads, getLeadFormNames, type Lead, type LeadStatus } from "~/lib/api/leads";
import { LeadTasksSummaryCell } from "~/components/organism/tasks/lead-tasks-summary-cell";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { useSearchParamsSelect } from "~/lib/hooks/useQueryParams";
import { useLeadsViewMode } from "~/lib/hooks/useLocalStorage";
import { useCanEditLeads } from "~/lib/hooks/useCanEditLeads";
import { useUpdateLeadStatus } from "~/lib/hooks/useUpdateLeadStatus";
import { format } from "date-fns";
import { ArrowRight, LayoutGrid, Table2, Upload, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { LeadImportModal } from "~/components/organism/lead-import-modal";

export function meta() {
  return [
    { title: "Leads - Repraesent" },
    { name: "description", content: "Leads management" },
  ];
}

function parsePage(v: string | null): number {
  const n = parseInt(v ?? "1", 10);
  return isNaN(n) || n < 1 ? 1 : n;
}

function parseLimit(v: string | null): number {
  const n = parseInt(v ?? "10", 10);
  return isNaN(n) || n < 1 ? 10 : Math.min(100, n);
}

export default function LeadForm() {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [onSelect, clearParams] = useSearchParamsSelect();

  const page = useMemo(
    () => parsePage(searchParams.get("page")),
    [searchParams]
  );
  const limit = useMemo(
    () => parseLimit(searchParams.get("limit")),
    [searchParams]
  );
  const search = searchParams.get("search") ?? "";
  const statusFilter = searchParams.get("status") ?? "";
  const sourceFilter = (searchParams.get("source") ?? "") as "" | "website";
  const formNameFilter = searchParams.get("form_name") ?? "";

  const [viewMode, setViewMode] = useLeadsViewMode();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const debouncedSearch = useDebounce(search, 300);
  const canEdit = useCanEditLeads();

  const updateStatusMutation = useUpdateLeadStatus({
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["leads"] });
      const prev = queryClient.getQueryData([
        "leads",
        page,
        limit,
        debouncedSearch,
        statusFilter || undefined,
        sourceFilter || undefined,
        formNameFilter || undefined,
        viewMode,
      ]);
      queryClient.setQueryData(
        [
          "leads",
          page,
          limit,
          debouncedSearch,
          statusFilter || undefined,
          sourceFilter || undefined,
          viewMode,
        ],
        (old: Awaited<ReturnType<typeof getLeads>> | undefined) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((l) => (l.id === id ? { ...l, status } : l)),
          };
        }
      );
      return { prev } as { prev: unknown };
    },
    onError: (_err, _vars, ctx) => {
      const prev =
        ctx && typeof ctx === "object" && "prev" in ctx
          ? (ctx as { prev: unknown }).prev
          : undefined;
      if (prev !== undefined) {
        queryClient.setQueryData(
          [
            "leads",
            page,
            limit,
            debouncedSearch,
            statusFilter || undefined,
            sourceFilter || undefined,
            viewMode,
          ],
          prev
        );
      }
    },
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

  const formNamesQuery = useQuery({
    queryKey: ["lead-form-names"],
    queryFn: getLeadFormNames,
    enabled: !!currentWorkspace,
    staleTime: 60_000,
  });

  const formNameFilterOptions = useMemo(
    () =>
      (formNamesQuery.data ?? []).map((name) => ({
        key: name,
        label: name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      })),
    [formNamesQuery.data]
  );

  const leadsQuery = useQuery({
    queryKey: [
      "leads",
      page,
      limit,
      debouncedSearch,
      statusFilter || undefined,
      sourceFilter || undefined,
      formNameFilter || undefined,
      viewMode,
    ],
    queryFn: () =>
      getLeads({
        page,
        limit: viewMode === "kanban" ? 100 : limit,
        search: debouncedSearch || undefined,
        status: (statusFilter || undefined) as LeadStatus | undefined,
        source: sourceFilter || undefined,
        form_name: formNameFilter || undefined,
      }),
    enabled: !!currentWorkspace,
    refetchOnMount: "always",
  });

  const leadsFilters = useMemo(
    () => [
      {
        name: "status",
        paramKey: "status",
        options: LEAD_FILTER_STATUS_OPTIONS,
        single: true,
      },
      {
        name: "source",
        paramKey: "source",
        options: LEAD_FILTER_SOURCE_OPTIONS,
        single: true,
      },
      {
        name: "form_name",
        paramKey: "form_name",
        options: formNameFilterOptions,
        single: true,
      },
    ],
    [formNameFilterOptions]
  );

  const hasAccess =
    currentWorkspace?.services?.some((s) => s.service_type === "lead-form") ??
    false;

  if (!hasAccess) {
    return null;
  }

  const columns: ColumnDef<Lead>[] = [
    {
      id: "tasks_summary",
      header: t("tasks.leadRow.columnHeader"),
      cell: ({ row }) => (
        <LeadTasksSummaryCell
          lead={row.original}
          onClick={() => setSelectedLeadId(row.original.id)}
        />
      ),
    },
    {
      accessorKey: "full_name",
      header: t("leads.columns.fullName"),
      cell: ({ row }) => {
        const name = row.original.full_name ?? "—";
        return (
          <TooltipContainer tooltipContent={name}>
            <span className="truncate max-w-[180px] block font-medium text-foreground">
              {name}
            </span>
          </TooltipContainer>
        );
      },
    },
    {
      accessorKey: "email",
      header: t("leads.columns.email"),
      cell: ({ row }) => {
        const email = row.original.email ?? "—";
        return (
          <TooltipContainer tooltipContent={email}>
            <span className="truncate max-w-[180px] block text-muted-foreground">
              {email}
            </span>
          </TooltipContainer>
        );
      },
    },
    {
      accessorKey: "source_label",
      header: t("leads.columns.source"),
      cell: ({ row }) => {
        const label =
          row.original.source_label ?? row.original.source_table ?? "—";
        return (
          <TooltipContainer tooltipContent={label}>
            <span className="truncate max-w-[140px] block text-muted-foreground">
              {label}
            </span>
          </TooltipContainer>
        );
      },
    },
    {
      accessorKey: "form_name",
      header: t("leads.columns.formName"),
      cell: ({ row }) => {
        const formName = row.original.form_name ?? "—";
        const displayName = formName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        return (
          <span className="truncate max-w-[140px] block text-muted-foreground text-sm">
            {displayName}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: t("leads.columns.status"),
      cell: ({ row }) => {
        const lead = row.original;
        return (
          <LeadStatusSelect
            value={lead.status}
            onValueChange={(status) =>
              updateStatusMutation.mutate({ id: lead.id, status })
            }
            disabled={!canEdit || updateStatusMutation.isPending}
            className="w-[140px]"
          />
        );
      },
    },
    {
      accessorKey: "created_at",
      header: t("leads.columns.createdAt"),
      cell: ({ row }) =>
        row.original.created_at ? (
          <span className="text-muted-foreground text-sm">
            {format(new Date(row.original.created_at), "PP")}
          </span>
        ) : (
          "—"
        ),
    },
    {
      id: "go-to",
      header: "",
      cell: ({ row }) => (
        <Link
          onClick={(event) => {
            event.stopPropagation();
          }}
          to={`/lead-form/${row.original.id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline"
        >
          {t("leads.openLead")} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ),
    },
  ];

  return (
    <div
      className={cn(
        "app-fade-in",
        viewMode === "kanban"
          ? "flex flex-col min-h-[calc(100vh-8rem)] p-4 sm:p-6"
          : "p-4 sm:p-6 space-y-4 sm:space-y-6"
      )}
    >
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0 app-fade-up">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
            {t("leads.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("leads.manageHint")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportModalOpen(true)}
              className="h-9 gap-1.5 text-xs"
            >
              <Upload className="h-3.5 w-3.5" />
              {t("leads.importLeads")}
            </Button>
          )}
          <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
            <button
              onClick={() => {
                setViewMode("table");
                clearParams();
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150",
                viewMode === "table"
                  ? "bg-white shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Table2 className="h-3.5 w-3.5" />
              {t("leads.tableView")}
            </button>
            <button
              onClick={() => {
                setViewMode("kanban");
                clearParams();
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150",
                viewMode === "kanban"
                  ? "bg-white shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              {t("leads.kanbanView")}
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-border shrink-0" />

      {viewMode === "table" ? (
        <DataTable<Lead, unknown>
          columns={columns}
          additionalElement={
            <div className="flex flex-wrap gap-3 items-center">
              <FilterComponent filters={leadsFilters} />
              {(statusFilter || sourceFilter || formNameFilter) && (
                <button
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
                  onClick={() =>
                    onSelect({ status: "", source: "", form_name: "", page: "1" }, true)
                  }
                >
                  {t("leads.clearFilters")} <X size={12} />
                </button>
              )}
            </div>
          }
          data={leadsQuery.data?.data ?? []}
          isLoading={leadsQuery.isLoading}
          pagination={
            leadsQuery.data
              ? {
                  page: leadsQuery.data.page,
                  limit: leadsQuery.data.limit,
                  total: leadsQuery.data.total,
                  totalPages: leadsQuery.data.totalPages,
                  hasNext: leadsQuery.data.hasNext,
                  hasPrev: leadsQuery.data.hasPrev,
                }
              : undefined
          }
          onPaginationChange={(p, l) => {
            const updates: Record<string, string> = { page: String(p) };
            if (Number(l) !== 10) updates.limit = String(l);
            onSelect(updates, true);
          }}
          onSearchChange={(value) => {
            onSelect({ search: value, page: "1" }, true);
          }}
          searchValue={search}
          searchPlaceholder={t("leads.searchPlaceholder")}
          onRowClick={(row) => setSelectedLeadId(row.id)}
        />
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <LeadsKanban
            leads={leadsQuery.data?.data ?? []}
            isLoading={leadsQuery.isLoading}
            onStatusChange={(id, status) =>
              updateStatusMutation.mutate({ id, status })
            }
            onLeadSelect={setSelectedLeadId}
            isUpdating={updateStatusMutation.isPending}
            canEdit={canEdit}
          />
        </div>
      )}

      <LeadDetailSheet
        leadId={selectedLeadId}
        open={!!selectedLeadId}
        onOpenChange={(open) => !open && setSelectedLeadId(null)}
        onStatusChange={
          canEdit
            ? (id, status) => updateStatusMutation.mutate({ id, status })
            : undefined
        }
        isStatusUpdating={updateStatusMutation.isPending}
        canEdit={canEdit}
      />

      <LeadImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
      />
    </div>
  );
}
