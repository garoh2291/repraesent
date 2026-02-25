import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useAuthContext } from "~/providers/auth-provider";
import { DataTable } from "~/components/organism/data-table";
import { LeadDetailSheet } from "~/components/organism/lead-detail-sheet";
import { LeadsKanban } from "~/components/organism/leads-kanban";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import TooltipContainer from "~/components/tooltip-container";
import { getLeads, type Lead, type LeadStatus } from "~/lib/api/leads";
import {
  LEAD_STATUSES,
  LEAD_SOURCES,
  LEAD_STATUS_COLORS,
  LEAD_STATUS_LABELS,
  type LeadStatus as LeadStatusType,
} from "~/lib/leads/constants";
import { shortLeadId } from "~/lib/leads/utils";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { useLeadFormQueryParams } from "~/lib/hooks/useQueryParams";
import { useLeadsViewMode } from "~/lib/hooks/useLocalStorage";
import { useUpdateLeadStatus } from "~/lib/hooks/useUpdateLeadStatus";
import { format } from "date-fns";
import { ArrowRight, LayoutGrid, Table2 } from "lucide-react";
import { cn } from "~/lib/utils";

export function meta() {
  return [
    { title: "Lead Form - Repraesent" },
    { name: "description", content: "Lead form" },
  ];
}

export default function LeadForm() {
  const { currentWorkspace } = useAuthContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    page,
    limit,
    search,
    statusFilter,
    sourceFilter,
    setPage,
    setLimit,
    setSearch,
    setStatusFilter,
    setSourceFilter,
  } = useLeadFormQueryParams();

  const [viewMode, setViewMode] = useLeadsViewMode();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 300);

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
      const prev = ctx && typeof ctx === "object" && "prev" in ctx
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
        const currentStatus = lead.status as LeadStatusType;

        return (
          <Select
            value={lead.status}
            onValueChange={(value) =>
              updateStatusMutation.mutate({
                id: lead.id,
                status: value as LeadStatus,
              })
            }
            disabled={updateStatusMutation.isPending}
          >
            <SelectTrigger
              className={cn("w-[140px] border-l-4 border-l-transparent", {
                "border-l-blue-500": currentStatus === "new_lead",
                "border-l-amber-500": currentStatus === "pending",
                "border-l-violet-500": currentStatus === "in_progress",
                "border-l-red-500": currentStatus === "rejected",
                "border-l-orange-500": currentStatus === "on_hold",
                "border-l-gray-500": currentStatus === "stale",
                "border-l-emerald-500": currentStatus === "success",
                "border-l-muted": currentStatus === "hidden",
              })}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        LEAD_STATUS_COLORS[s]
                      )}
                    />
                    {LEAD_STATUS_LABELS[s]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "table" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("table")}
          >
            <Table2 className="h-4 w-4 mr-1" />
            Table
          </Button>
          <Button
            variant={viewMode === "kanban" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("kanban")}
          >
            <LayoutGrid className="h-4 w-4 mr-1" />
            Kanban
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <Select
          value={statusFilter || "all"}
          onValueChange={(v) => {
            setStatusFilter((v === "all" ? "" : v) as LeadStatus | "");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sourceFilter || "all"}
          onValueChange={(v) => {
            setSourceFilter((v === "all" ? "" : v) as "website" | "");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {Object.values(LEAD_SOURCES).map((src) => (
              <SelectItem key={src.value} value={src.value}>
                {src.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {viewMode === "table" ? (
        <DataTable<Lead, unknown>
          columns={columns}
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
            setPage(p);
            setLimit(l);
          }}
          onSearchChange={setSearch}
          searchValue={search}
          searchPlaceholder="Search by email, name, phone..."
          onRowClick={(row) => setSelectedLeadId(row.id)}
        />
      ) : (
        <LeadsKanban
          leads={leadsQuery.data?.data ?? []}
          isLoading={leadsQuery.isLoading}
          onStatusChange={(id, status) =>
            updateStatusMutation.mutate({ id, status })
          }
          onLeadSelect={setSelectedLeadId}
          isUpdating={updateStatusMutation.isPending}
        />
      )}

      <LeadDetailSheet
        leadId={selectedLeadId}
        open={!!selectedLeadId}
        onOpenChange={(open) => !open && setSelectedLeadId(null)}
        onStatusChange={(id, status) =>
          updateStatusMutation.mutate({ id, status })
        }
        isStatusUpdating={updateStatusMutation.isPending}
      />
    </div>
  );
}
