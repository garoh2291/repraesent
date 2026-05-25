import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "~/providers/auth-provider";
import {
  getContacts,
  type ContactListItem,
  type PaginatedContacts,
} from "~/lib/api/contacts-crm";
import { getWorkspaceDetail } from "~/lib/api/workspaces";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { CONTACT_TABLE_FILTERS_BASE } from "~/lib/contacts/filter-presets";
import type { Filter } from "~/components/molecule/filter-component/types";
import FilterComponent from "~/components/molecule/filter-component";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  ContactSourceBadge,
  ContactTypeBadge,
} from "~/components/molecule/contact-badges";
import { formatCurrency, formatDate } from "~/lib/utils/format";
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Mail,
  Phone,
  Search,
  Upload,
  IdCard,
  Info,
  X,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { ContactImportModal } from "~/components/organism/contact-import-modal";

export function meta() {
  return [
    { title: "Contacts - Repraesent" },
    { name: "description", content: "Contact CRM" },
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

function formatAssigneeName(row: ContactListItem): string {
  const first = row.assignee_first_name?.trim() ?? "";
  const last = row.assignee_last_name?.trim() ?? "";
  const full = [first, last].filter(Boolean).join(" ").trim();
  return full || "—";
}

function assigneeInitials(row: ContactListItem): string {
  const first = row.assignee_first_name?.trim() ?? "";
  const last = row.assignee_last_name?.trim() ?? "";
  const a = first ? first[0] : "";
  const b = last ? last[0] : "";
  return (a + b).toUpperCase() || "?";
}

function contactInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type SortKey =
  | "name"
  | "source"
  | "contact_type"
  | "ltv"
  | "pipeline"
  | "lost"
  | "assignee"
  | "last_contacted"
  | "created";
type SortDir = "asc" | "desc";
type SortState = { key: SortKey; dir: SortDir };

const NUMERIC_SORT_KEYS: SortKey[] = ["ltv", "pipeline", "lost"];
const DATE_SORT_KEYS: SortKey[] = ["last_contacted", "created"];

/** Numeric/date value for a numeric or date column, or null when unset. */
function rowSortNumber(row: ContactListItem, key: SortKey): number | null {
  switch (key) {
    case "ltv":
      return row.lifetime_value != null ? Number(row.lifetime_value) : null;
    case "pipeline":
      return row.pipeline_value != null ? Number(row.pipeline_value) : null;
    case "lost":
      return row.lost_value != null ? Number(row.lost_value) : null;
    case "last_contacted":
      return row.last_contacted_at
        ? new Date(row.last_contacted_at).getTime()
        : null;
    case "created":
      return row.created_at ? new Date(row.created_at).getTime() : null;
    default:
      return null;
  }
}

/** Lowercased string value for a text column. */
function rowSortText(row: ContactListItem, key: SortKey): string {
  switch (key) {
    case "name":
      return (row.contact_full_name ?? "").trim().toLowerCase();
    case "source":
      return (row.source ?? "").toLowerCase();
    case "contact_type":
      return (row.contact_type ?? "").toLowerCase();
    case "assignee":
      return [row.assignee_first_name, row.assignee_last_name]
        .filter(Boolean)
        .join(" ")
        .trim()
        .toLowerCase();
    default:
      return "";
  }
}

/** Compare two rows for a column. Empty/null values always sort last. */
function compareRows(
  a: ContactListItem,
  b: ContactListItem,
  sort: SortState,
): number {
  const mul = sort.dir === "asc" ? 1 : -1;
  if (
    NUMERIC_SORT_KEYS.includes(sort.key) ||
    DATE_SORT_KEYS.includes(sort.key)
  ) {
    const av = rowSortNumber(a, sort.key);
    const bv = rowSortNumber(b, sort.key);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return (av - bv) * mul;
  }
  const av = rowSortText(a, sort.key);
  const bv = rowSortText(b, sort.key);
  if (!av && !bv) return 0;
  if (!av) return 1;
  if (!bv) return -1;
  return av.localeCompare(bv) * mul;
}

/** Sortable header label: click cycles asc → desc → unsorted, like the leads table. */
function SortButton({
  sortKey,
  sort,
  onToggle,
  children,
}: {
  sortKey: SortKey;
  sort: SortState | null;
  onToggle: (key: SortKey) => void;
  children: React.ReactNode;
}) {
  const active = sort?.key === sortKey;
  const Icon = !active
    ? ChevronsUpDown
    : sort!.dir === "asc"
      ? ChevronUp
      : ChevronDown;
  return (
    <button
      type="button"
      onClick={() => onToggle(sortKey)}
      className="inline-flex select-none items-center gap-1 hover:text-foreground transition-colors"
    >
      {children}
      <Icon
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          active ? "text-foreground" : "text-muted-foreground/50",
        )}
      />
    </button>
  );
}

export default function ContactsPage() {
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
  const assignedTo = searchParams.get("assigned_to") ?? "";
  const sourceFilter = searchParams.get("source") ?? "";
  const contactTypeRaw = searchParams.get("contact_type") ?? "";
  const contactTypeFilter =
    contactTypeRaw === "end_customer" ? "customer" : contactTypeRaw;
  const debouncedSearch = useDebounce(search, 300);

  const [importModal, setImportModal] = useState<{
    open: boolean;
    mode: "csv" | "vcard" | "xlsx";
  }>({ open: false, mode: "csv" });

  const hasAccess =
    currentWorkspace?.services?.some(
      (s) => s.service_type === "lead-form" || s.service_slug === "lead-form"
    ) ?? false;

  const workspaceQuery = useQuery({
    queryKey: ["workspace-detail"],
    queryFn: () => getWorkspaceDetail(),
    enabled: hasAccess && !!currentWorkspace,
  });

  const tableQuery = useQuery({
    queryKey: [
      "contacts",
      "table",
      page,
      limit,
      debouncedSearch,
      assignedTo || undefined,
      sourceFilter || undefined,
      contactTypeFilter || undefined,
    ],
    queryFn: () =>
      getContacts({
        page,
        limit,
        search: debouncedSearch || undefined,
        assigned_to: assignedTo || undefined,
        source: sourceFilter || undefined,
        contact_type: contactTypeFilter || undefined,
      }),
    enabled: hasAccess && !!currentWorkspace,
    refetchOnMount: true,
  });

  const data = tableQuery.data;
  const isLoading = tableQuery.isLoading;
  const isError = tableQuery.isError;

  const [sort, setSort] = useState<SortState | null>(null);
  const toggleSort = (key: SortKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };
  const sortedRows = useMemo(() => {
    const rows = data?.data ?? [];
    if (!sort) return rows;
    return [...rows].sort((a, b) => compareRows(a, b, sort));
  }, [data, sort]);

  const setParam = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    setSearchParams(next);
  };

  const members = workspaceQuery.data?.members ?? [];

  const contactListFilters = useMemo((): Filter[] => {
    const assigneeOptions = members.map((m) => {
      const name = [m.user_first_name, m.user_last_name]
        .filter(Boolean)
        .join(" ")
        .trim();
      return {
        key: m.user_id,
        label: name || m.user_email || m.user_id,
      };
    });
    return [
      ...CONTACT_TABLE_FILTERS_BASE,
      {
        name: "assignee",
        paramKey: "assigned_to",
        options: assigneeOptions,
        single: true,
      },
    ];
  }, [members]);

  const hasTableFilters =
    !!sourceFilter || !!contactTypeFilter || !!assignedTo;

  if (!hasAccess) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t("contacts.noAccess", {
          defaultValue: "Contacts are not available for this workspace.",
        })}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 app-fade-in">
      {/* Header — same pattern as Leads */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0 app-fade-up">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
            {t("contacts.contactsTitle")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("contacts.contactsManageHint")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-xs"
              >
                <Upload className="h-3.5 w-3.5" />
                {t("contacts.import.menuButton", {
                  defaultValue: "Import",
                })}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onSelect={() => setImportModal({ open: true, mode: "vcard" })}
              >
                <IdCard className="h-3.5 w-3.5 mr-2" />
                {t("contacts.import.vcardButton")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setImportModal({ open: true, mode: "csv" })}
              >
                <Upload className="h-3.5 w-3.5 mr-2" />
                {t("contacts.import.button", { defaultValue: "Import CSV" })}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setImportModal({ open: true, mode: "xlsx" })}
              >
                <Upload className="h-3.5 w-3.5 mr-2" />
                {t("contacts.import.xlsxButton", {
                  defaultValue: "Import Excel",
                })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="border-t border-border shrink-0" />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={t("contacts.searchPlaceholder", {
              defaultValue: "Search…",
            })}
            value={search}
            onChange={(e) => setParam({ search: e.target.value, page: "1" })}
            className="pl-9 pr-9"
          />
          {search ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setParam({ search: undefined, page: "1" })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground h-6 w-6"
              aria-label={t("common.clearSearch")}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3 items-center shrink-0 sm:justify-end">
          <FilterComponent filters={contactListFilters} />
          {hasTableFilters && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
              onClick={() =>
                setParam({
                  source: undefined,
                  contact_type: undefined,
                  assigned_to: undefined,
                  page: "1",
                })
              }
            >
              {t("contacts.clearFilters")}
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {isError && (
        <p className="text-sm text-destructive">
          {t("contacts.loadError", {
            defaultValue: "Could not load contacts.",
          })}
        </p>
      )}

      {!isError && (
        <TooltipProvider delayDuration={150}>
          <div className="rounded-md border border-border bg-card shadow-(--shadow) overflow-hidden overflow-x-auto">
            <Table className="min-w-[1040px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="h-auto min-h-10 whitespace-normal px-4 py-3 text-left align-middle font-medium">
                    <div className="flex w-full justify-start items-center">
                      <SortButton sortKey="name" sort={sort} onToggle={toggleSort}>
                        {t("contacts.columns.customer", {
                          defaultValue: "Contact",
                        })}
                      </SortButton>
                    </div>
                  </TableHead>
                  <TableHead className="h-auto min-h-10 whitespace-normal px-4 py-3 text-left align-middle font-medium">
                    <div className="flex w-full justify-start items-center">
                      <SortButton
                        sortKey="source"
                        sort={sort}
                        onToggle={toggleSort}
                      >
                        {t("contacts.columns.source", {
                          defaultValue: "Source",
                        })}
                      </SortButton>
                    </div>
                  </TableHead>
                  <TableHead className="h-auto min-h-10 whitespace-normal px-4 py-3 text-left align-middle font-medium">
                    <div className="flex w-full justify-start items-center">
                      <SortButton
                        sortKey="contact_type"
                        sort={sort}
                        onToggle={toggleSort}
                      >
                        {t("contacts.columns.contactType", {
                          defaultValue: "Contact type",
                        })}
                      </SortButton>
                    </div>
                  </TableHead>
                  <TableHead className="h-auto min-h-10 whitespace-normal px-4 py-3 text-left align-middle font-medium">
                    <div className="flex w-full justify-start items-center gap-1">
                      <SortButton sortKey="ltv" sort={sort} onToggle={toggleSort}>
                        {t("contacts.columns.lifetimeValue", {
                          defaultValue: "LTV",
                        })}
                      </SortButton>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground/70 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[240px]">
                          {t("contacts.columns.lifetimeValueHint", {
                            defaultValue:
                              "Total value of all won deals.",
                          })}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableHead>
                  <TableHead className="h-auto min-h-10 whitespace-normal px-4 py-3 text-left align-middle font-medium">
                    <div className="flex w-full justify-start items-center gap-1">
                      <SortButton
                        sortKey="pipeline"
                        sort={sort}
                        onToggle={toggleSort}
                      >
                        {t("contacts.columns.pipelineValue", {
                          defaultValue: "Pipeline",
                        })}
                      </SortButton>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground/70 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[240px]">
                          {t("contacts.columns.pipelineValueHint", {
                            defaultValue:
                              "Total value of in-progress deals not yet won or lost.",
                          })}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableHead>
                  <TableHead className="h-auto min-h-10 whitespace-normal px-4 py-3 text-left align-middle font-medium">
                    <div className="flex w-full justify-start items-center gap-1">
                      <SortButton sortKey="lost" sort={sort} onToggle={toggleSort}>
                        {t("contacts.columns.lostValue", {
                          defaultValue: "Lost",
                        })}
                      </SortButton>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground/70 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[240px]">
                          {t("contacts.columns.lostValueHint", {
                            defaultValue:
                              "Total value of deals marked as lost.",
                          })}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableHead>
                  <TableHead className="h-auto min-h-10 whitespace-normal px-4 py-3 text-left align-middle font-medium">
                    <div className="flex w-full justify-start items-center">
                      <SortButton
                        sortKey="assignee"
                        sort={sort}
                        onToggle={toggleSort}
                      >
                        {t("contacts.columns.assignee", {
                          defaultValue: "Assignee",
                        })}
                      </SortButton>
                    </div>
                  </TableHead>
                  <TableHead className="h-auto min-h-10 whitespace-normal px-4 py-3 text-left align-middle font-medium">
                    <div className="flex w-full justify-start items-center">
                      <SortButton
                        sortKey="last_contacted"
                        sort={sort}
                        onToggle={toggleSort}
                      >
                        {t("contacts.columns.lastContacted", {
                          defaultValue: "Last contacted",
                        })}
                      </SortButton>
                    </div>
                  </TableHead>
                  <TableHead className="h-auto min-h-10 whitespace-normal px-4 py-3 text-left align-middle font-medium">
                    <div className="flex w-full justify-start items-center">
                      <SortButton
                        sortKey="created"
                        sort={sort}
                        onToggle={toggleSort}
                      >
                        {t("contacts.columns.created", {
                          defaultValue: "Created",
                        })}
                      </SortButton>
                    </div>
                  </TableHead>
                  <TableHead className="h-auto min-h-10 w-[80px] whitespace-normal px-4 py-3 text-left align-middle font-medium">
                    <div className="flex w-full justify-start items-center" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center">
                      {t("common.loading")}
                    </TableCell>
                  </TableRow>
                ) : !data ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center">
                      {t("common.loading")}
                    </TableCell>
                  </TableRow>
                ) : data.data.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {t("contacts.empty", {
                        defaultValue: "No contacts yet.",
                      })}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedRows.map((row) => {
                    const name = row.contact_full_name?.trim() || "—";
                    const email = row.primary_email?.trim() ?? "";
                    const phone = row.primary_phone?.trim() ?? "";
                    const ltvNum =
                      row.lifetime_value != null
                        ? Number(row.lifetime_value)
                        : null;
                    const pipelineNum =
                      row.pipeline_value != null
                        ? Number(row.pipeline_value)
                        : null;
                    const lostNum =
                      row.lost_value != null
                        ? Number(row.lost_value)
                        : null;
                    const hasAssignee = !!(
                      row.assignee_first_name || row.assignee_last_name
                    );
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-normal px-4 py-3 align-middle text-left">
                          <Link
                            to={`/contacts/${row.id}`}
                            className="flex items-center gap-3 group"
                          >
                            <Avatar className="size-9 shrink-0">
                              <AvatarFallback className="bg-linear-to-br from-secondary/30 to-primary/10 text-[11px] font-semibold text-foreground">
                                {contactInitials(name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 text-left">
                              <div className="truncate font-medium text-foreground group-hover:underline">
                                {name}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                                {email ? (
                                  <span
                                    className="inline-flex items-center gap-1 truncate max-w-[220px]"
                                    title={email}
                                  >
                                    <Mail className="h-3 w-3 shrink-0 opacity-70" />
                                    <span className="truncate">{email}</span>
                                  </span>
                                ) : null}
                                {phone ? (
                                  <span className="inline-flex items-center gap-1 truncate">
                                    <Phone className="h-3 w-3 shrink-0 opacity-70" />
                                    <span className="truncate">{phone}</span>
                                  </span>
                                ) : null}
                                {!email && !phone ? (
                                  <span className="italic">
                                    {t("contacts.noContactInfo", {
                                      defaultValue: "No contact info",
                                    })}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="whitespace-normal px-4 py-3 align-middle text-left">
                          <ContactSourceBadge source={row.source} />
                        </TableCell>
                        <TableCell className="whitespace-normal px-4 py-3 align-middle text-left">
                          <ContactTypeBadge contactType={row.contact_type} />
                        </TableCell>
                        <TableCell className="whitespace-normal px-4 py-3 align-middle text-left tabular-nums">
                          {ltvNum != null && Number.isFinite(ltvNum) ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-600/10 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:text-emerald-400">
                              {formatCurrency(ltvNum)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-normal px-4 py-3 align-middle text-left tabular-nums">
                          {pipelineNum != null && Number.isFinite(pipelineNum) ? (
                            <span className="inline-flex items-center rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-inset ring-sky-500/20 dark:text-sky-400">
                              {formatCurrency(pipelineNum)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-normal px-4 py-3 align-middle text-left tabular-nums">
                          {lostNum != null && Number.isFinite(lostNum) ? (
                            <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-500/20 dark:text-red-400">
                              {formatCurrency(lostNum)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-normal px-4 py-3 align-middle text-left">
                          {hasAssignee ? (
                            <span className="inline-flex items-center gap-2">
                              <Avatar className="size-6 shrink-0">
                                <AvatarFallback className="bg-muted text-[9px] font-semibold text-foreground">
                                  {assigneeInitials(row)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate text-foreground">
                                {formatAssigneeName(row)}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "whitespace-normal px-4 py-3 align-middle text-left",
                            row.last_contacted_at
                              ? "text-foreground"
                              : "text-muted-foreground/60",
                          )}
                        >
                          {row.last_contacted_at
                            ? formatDate(new Date(row.last_contacted_at), "PP")
                            : "—"}
                        </TableCell>
                        <TableCell className="whitespace-normal px-4 py-3 align-middle text-left text-muted-foreground">
                          {row.created_at
                            ? formatDate(new Date(row.created_at), "PP")
                            : "—"}
                        </TableCell>
                        <TableCell className="whitespace-normal px-4 py-3 align-middle text-left">
                          <Link
                            to={`/contacts/${row.id}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline"
                          >
                            {t("leads.openLead")}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {!isLoading && data ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <p className="text-sm text-muted-foreground order-2 sm:order-1">
                {t("common.showingResults", {
                  from:
                    data.total > 0 ? (data.page - 1) * data.limit + 1 : 0,
                  to: Math.min(data.page * data.limit, data.total),
                  total: data.total,
                })}
              </p>
              <div className="flex items-center gap-2 order-1 sm:order-2">
                <Select
                  value={String(data.limit)}
                  onValueChange={(value) =>
                    setParam({
                      page: "1",
                      limit: Number(value) === 10 ? undefined : value,
                    })
                  }
                >
                  <SelectTrigger className="w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 50, 100].map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setParam({ page: String(data.page - 1) })}
                    disabled={!data.hasPrev}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="hidden sm:flex items-center gap-1">
                    {Array.from(
                      { length: Math.min(5, data.totalPages) },
                      (_, i) => {
                        let pageNum: number;
                        const totalPages = data.totalPages;
                        const currentPage = data.page;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={
                              currentPage === pageNum ? "default" : "outline"
                            }
                            size="sm"
                            onClick={() => setParam({ page: String(pageNum) })}
                          >
                            {pageNum}
                          </Button>
                        );
                      },
                    )}
                  </div>
                  <span className="flex sm:hidden text-sm text-muted-foreground px-2">
                    {data.page} / {data.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setParam({ page: String(data.page + 1) })}
                    disabled={!data.hasNext}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </TooltipProvider>
      )}

      <ContactImportModal
        open={importModal.open}
        importMode={importModal.mode}
        onOpenChange={(o) => setImportModal((s) => ({ ...s, open: o }))}
      />
    </div>
  );
}
