import { useMemo, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useAuthContext } from "~/providers/auth-provider";
import { DataTable } from "~/components/organism/data-table";
import { LeadDetailSheet } from "~/components/organism/lead-detail-sheet";
import { LeadsKanban } from "~/components/organism/leads-kanban";
import { LeadStatusSelect } from "~/components/molecule/lead-status-select";
import FilterComponent from "~/components/molecule/filter-component";
import { Button } from "~/components/ui/button";
import TooltipContainer from "~/components/tooltip-container";
import { getLeads, type Lead, type LeadStatus } from "~/lib/api/leads";
import { shortLeadId } from "~/lib/leads/utils";
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
    { title: "Lead Form - Repraesent" },
    { name: "description", content: "Lead form" },
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

    const hasLeadFormProduct = currentWorkspace.products?.some(
      (p) => p.product_slug === "lead-form"
    );

    if (!hasLeadFormProduct) {
      navigate("/", { replace: true });
    }
  }, [currentWorkspace, navigate]);

  const leadsQuery = useQuery({
    queryKey: [
      "leads",
      page,
      limit,
      debouncedSearch,
      statusFilter || undefined,
      sourceFilter || undefined,
      viewMode,
    ],
    queryFn: () =>
      getLeads({
        page,
        limit: viewMode === "kanban" ? 100 : limit,
        search: debouncedSearch || undefined,
        status: (statusFilter || undefined) as LeadStatus | undefined,
        source: sourceFilter || undefined,
      }),
    enabled: !!currentWorkspace,
    refetchOnMount: "always",
  });

  const hasAccess =
    currentWorkspace?.products?.some((p) => p.product_slug === "lead-form") ??
    false;

  if (!hasAccess) {
    return null;
  }

  const columns: ColumnDef<Lead>[] = [
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => {
        const id = row.original.id;
        const short = shortLeadId(id);
        return (
          <TooltipContainer tooltipContent={id} copyText={id}>
            <span className="font-mono text-xs text-muted-foreground">
              {short}
            </span>
          </TooltipContainer>
        );
      },
    },
    {
      accessorKey: "full_name",
      header: "Full Name",
      cell: ({ row }) => {
        const name = row.original.full_name ?? "—";
        return (
          <TooltipContainer tooltipContent={name}>
            <span className="truncate max-w-[180px] block">{name}</span>
          </TooltipContainer>
        );
      },
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => {
        const email = row.original.email ?? "—";
        return (
          <TooltipContainer tooltipContent={email}>
            <span className="truncate max-w-[180px] block">{email}</span>
          </TooltipContainer>
        );
      },
    },
    {
      accessorKey: "source_label",
      header: "Source",
      cell: ({ row }) => {
        const label =
          row.original.source_label ?? row.original.source_table ?? "—";
        return (
          <TooltipContainer tooltipContent={label}>
            <span className="truncate max-w-[140px] block">{label}</span>
          </TooltipContainer>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
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
      header: "Created",
      cell: ({ row }) =>
        row.original.created_at
          ? format(new Date(row.original.created_at), "PP")
          : "—",
    },
    {
      id: "go-to",
      header: "",
      cell: ({ row }) => (
        <Link
          to={`/lead-form/${row.original.id}`}
          className="text-primary hover:underline inline-flex items-center gap-1 text-sm"
        >
          Go to lead <ArrowRight className="h-4 w-4" />
        </Link>
      ),
    },
  ];

  return (
    <div
      className={cn(
        "p-6",
        viewMode === "kanban" ? "flex flex-col min-h-[calc(100vh-8rem)]" : "space-y-6"
      )}
    >
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportModalOpen(true)}
            >
              <Upload className="h-4 w-4 mr-1" />
              Import CSV
            </Button>
          )}
          <Button
            variant={viewMode === "table" ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              setViewMode("table");
              clearParams();
            }}
          >
            <Table2 className="h-4 w-4 mr-1" />
            Table
          </Button>
          <Button
            variant={viewMode === "kanban" ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              setViewMode("kanban");
              clearParams();
            }}
          >
            <LayoutGrid className="h-4 w-4 mr-1" />
            Kanban
          </Button>
        </div>
      </div>

      <hr className="border-border shrink-0" />

      {viewMode === "table" ? (
        <DataTable<Lead, unknown>
          columns={columns}
          additionalElement={
            <div className="flex flex-wrap gap-4 items-center">
              <FilterComponent optionKey="leads" />
              {(statusFilter || sourceFilter) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 py-1 px-2 rounded-[12px] border-dashed text-muted-foreground"
                  onClick={() =>
                    onSelect({ status: "", source: "", page: "1" }, true)
                  }
                >
                  Clear <X size={14} />
                </Button>
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
          searchPlaceholder="Search by email, name, phone..."
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
