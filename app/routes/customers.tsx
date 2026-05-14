import { useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "~/providers/auth-provider";
import {
  getCustomers,
  type CustomerListItem,
  type CustomerStatus,
} from "~/lib/api/customers";
import { getWorkspaceDetail } from "~/lib/api/workspaces";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { formatDate } from "~/lib/utils/format";

export function meta() {
  return [
    { title: "Customers - Repraesent" },
    { name: "description", content: "Customer CRM" },
  ];
}

const STATUS_OPTIONS: (CustomerStatus | "")[] = [
  "",
  "active",
  "imported",
  "completed",
  "churned",
  "lost",
];

function parsePage(v: string | null): number {
  const n = parseInt(v ?? "1", 10);
  return isNaN(n) || n < 1 ? 1 : n;
}

function parseLimit(v: string | null): number {
  const n = parseInt(v ?? "10", 10);
  return isNaN(n) || n < 1 ? 10 : Math.min(100, n);
}

function statusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active" || status === "imported") return "secondary";
  if (status === "completed") return "default";
  if (status === "churned" || status === "lost") return "destructive";
  return "outline";
}

function sourceBadgeVariant(
  source: string
): "default" | "secondary" | "destructive" | "outline" {
  if (source === "lead_conversion") return "default";
  return "outline";
}

function formatAssigneeName(row: CustomerListItem): string {
  const first = row.assignee_first_name?.trim() ?? "";
  const last = row.assignee_last_name?.trim() ?? "";
  const full = [first, last].filter(Boolean).join(" ").trim();
  return full || "—";
}

export default function CustomersPage() {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = useMemo(
    () => parsePage(searchParams.get("page")),
    [searchParams]
  );
  const limit = useMemo(
    () => parseLimit(searchParams.get("limit")),
    [searchParams]
  );
  const search = searchParams.get("search") ?? "";
  const status = (searchParams.get("status") ?? "") as CustomerStatus | "";
  const assignedTo = searchParams.get("assigned_to") ?? "";

  const debouncedSearch = useDebounce(search, 300);

  const hasAccess =
    currentWorkspace?.services?.some(
      (s) => s.service_type === "lead-form" || s.service_slug === "lead-form"
    ) ?? false;

  const workspaceQuery = useQuery({
    queryKey: ["workspace-detail"],
    queryFn: () => getWorkspaceDetail(),
    enabled: hasAccess && !!currentWorkspace,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "customers",
      page,
      limit,
      debouncedSearch,
      status || undefined,
      assignedTo || undefined,
    ],
    queryFn: () =>
      getCustomers({
        page,
        limit,
        search: debouncedSearch || undefined,
        status: status || undefined,
        assigned_to: assignedTo || undefined,
      }),
    enabled: hasAccess && !!currentWorkspace,
  });

  const setParam = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    setSearchParams(next);
  };

  if (!hasAccess) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t("customers.noAccess", {
          defaultValue: "Customers are not available for this workspace.",
        })}
      </div>
    );
  }

  const members = workspaceQuery.data?.members ?? [];

  return (
    <div className="p-4 sm:p-6 space-y-4 app-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
          {t("customers.title", { defaultValue: "Customers" })}
        </h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-2 lg:items-center lg:flex-wrap">
        <Input
          placeholder={t("customers.searchPlaceholder", {
            defaultValue: "Search…",
          })}
          value={search}
          onChange={(e) => setParam({ search: e.target.value, page: "1" })}
          className="max-w-md"
        />
        <Select
          value={status || "__all__"}
          onValueChange={(v) =>
            setParam({
              status: v === "__all__" ? undefined : v,
              page: "1",
            })
          }
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue
              placeholder={t("customers.filterStatus", {
                defaultValue: "Status",
              })}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">
              {t("customers.allStatuses", { defaultValue: "All statuses" })}
            </SelectItem>
            {STATUS_OPTIONS.filter(Boolean).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={assignedTo || "__all_assignees__"}
          onValueChange={(v) =>
            setParam({
              assigned_to: v === "__all_assignees__" ? undefined : v,
              page: "1",
            })
          }
        >
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue
              placeholder={t("customers.filterAssignee", {
                defaultValue: "Assignee",
              })}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all_assignees__">
              {t("customers.allAssignees", { defaultValue: "All assignees" })}
            </SelectItem>
            {members.map((m) => (
              <SelectItem key={m.user_id} value={m.user_id}>
                {[m.user_first_name, m.user_last_name]
                  .filter(Boolean)
                  .join(" ")
                  .trim() || m.user_email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
        </div>
      )}

      {isError && (
        <p className="text-sm text-destructive">
          {t("customers.loadError", {
            defaultValue: "Could not load customers.",
          })}
        </p>
      )}

      {data && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3">
                  {t("customers.columns.name", { defaultValue: "Name" })}
                </th>
                <th className="px-4 py-3">
                  {t("customers.columns.status", { defaultValue: "Status" })}
                </th>
                <th className="px-4 py-3">
                  {t("customers.columns.source", { defaultValue: "Source" })}
                </th>
                <th className="px-4 py-3">
                  {t("customers.columns.assignee", {
                    defaultValue: "Assignee",
                  })}
                </th>
                <th className="px-4 py-3">
                  {t("customers.columns.created", { defaultValue: "Created" })}
                </th>
                <th className="px-4 py-3 w-[100px]" />
              </tr>
            </thead>
            <tbody>
              {data.data.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    {t("customers.empty", {
                      defaultValue: "No customers yet.",
                    })}
                  </td>
                </tr>
              ) : (
                data.data.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">
                      {row.contact_full_name?.trim() || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusBadgeVariant(row.status)}>
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={sourceBadgeVariant(row.source)}>
                        {row.source}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatAssigneeName(row)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.created_at
                        ? formatDate(new Date(row.created_at), "PP")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/customers/${row.id}`}>
                          {t("common.view", { defaultValue: "View" })}
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            {t("customers.pageOf", {
              defaultValue: "Page {{page}} of {{total}}",
              page: data.page,
              total: data.totalPages,
            })}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!data.hasPrev}
              onClick={() => setParam({ page: String(data.page - 1) })}
            >
              {t("common.previous", { defaultValue: "Previous" })}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!data.hasNext}
              onClick={() => setParam({ page: String(data.page + 1) })}
            >
              {t("common.next", { defaultValue: "Next" })}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
