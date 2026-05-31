import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "~/providers/auth-provider";
import {
  getContacts,
  patchContactCrm,
  type ContactListItem,
  type PaginatedContacts,
} from "~/lib/api/contacts-crm";
import {
  CONTACT_TYPES,
  type ContactType,
} from "~/lib/contacts/contact-types";
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
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Search,
  Upload,
  IdCard,
  Info,
  Plus,
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
import { CreateContactDialog } from "~/components/organism/create-contact-dialog";

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

function contactInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ContactsPage() {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const navigate = useNavigate();
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
  const sourceFilter = searchParams.get("source") ?? "";
  const contactTypeRaw = searchParams.get("contact_type") ?? "";
  const contactTypeFilter =
    contactTypeRaw === "end_customer" ? "customer" : contactTypeRaw;
  const debouncedSearch = useDebounce(search, 300);

  const [importModal, setImportModal] = useState<{
    open: boolean;
    mode: "csv" | "vcard" | "xlsx";
  }>({ open: false, mode: "csv" });
  const [createOpen, setCreateOpen] = useState(false);

  const hasAccess =
    currentWorkspace?.services?.some(
      (s) => s.service_type === "lead-form" || s.service_slug === "lead-form"
    ) ?? false;

  const tableQuery = useQuery({
    queryKey: [
      "contacts",
      "table",
      page,
      limit,
      debouncedSearch,
      sourceFilter || undefined,
      contactTypeFilter || undefined,
    ],
    queryFn: () =>
      getContacts({
        page,
        limit,
        search: debouncedSearch || undefined,
        source: sourceFilter || undefined,
        contact_type: contactTypeFilter || undefined,
      }),
    enabled: hasAccess && !!currentWorkspace,
    refetchOnMount: true,
  });

  const data = tableQuery.data;
  const isLoading = tableQuery.isLoading;
  const isError = tableQuery.isError;

  const queryClient = useQueryClient();
  const contactTypeMutation = useMutation({
    mutationFn: ({ id, type }: { id: string; type: ContactType }) =>
      patchContactCrm(id, { contact_type: type }),
    onMutate: async ({ id, type }) => {
      await queryClient.cancelQueries({ queryKey: ["contacts", "table"] });
      const prev = queryClient.getQueriesData<PaginatedContacts>({
        queryKey: ["contacts", "table"],
      });
      for (const [key, value] of prev) {
        if (!value) continue;
        queryClient.setQueryData<PaginatedContacts>(key, {
          ...value,
          data: value.data.map((r) =>
            r.id === id ? { ...r, contact_type: type } : r,
          ),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.prev) return;
      for (const [key, value] of ctx.prev) {
        queryClient.setQueryData(key, value);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts", "table"] });
    },
  });


  const setParam = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    setSearchParams(next);
  };

  const contactListFilters = useMemo(
    (): Filter[] => [...CONTACT_TABLE_FILTERS_BASE],
    []
  );

  const hasTableFilters = !!sourceFilter || !!contactTypeFilter;

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
          <Button
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("contacts.newContactButton", { defaultValue: "New contact" })}
          </Button>
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
                    {t("contacts.columns.customer", {
                      defaultValue: "Contact",
                    })}
                  </TableHead>
                  <TableHead className="h-auto min-h-10 whitespace-normal px-4 py-3 text-left align-middle font-medium">
                    {t("contacts.columns.source", {
                      defaultValue: "Source",
                    })}
                  </TableHead>
                  <TableHead className="h-auto min-h-10 whitespace-normal px-4 py-3 text-left align-middle font-medium">
                    {t("contacts.columns.contactType", {
                      defaultValue: "Contact type",
                    })}
                  </TableHead>
                  <TableHead className="h-auto min-h-10 whitespace-normal px-4 py-3 text-left align-middle font-medium">
                    <div className="flex w-full justify-start items-center gap-1">
                      {t("contacts.columns.lifetimeValue", {
                        defaultValue: "LTV",
                      })}
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
                      {t("contacts.columns.pipelineValue", {
                        defaultValue: "Pipeline",
                      })}
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
                      {t("contacts.columns.lostValue", {
                        defaultValue: "Lost",
                      })}
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
                    {t("contacts.columns.lastContacted", {
                      defaultValue: "Last contacted",
                    })}
                  </TableHead>
                  <TableHead className="h-auto min-h-10 whitespace-normal px-4 py-3 text-left align-middle font-medium">
                    {t("contacts.columns.created", {
                      defaultValue: "Created",
                    })}
                  </TableHead>
                  <TableHead className="h-auto min-h-10 w-[80px] whitespace-normal px-4 py-3 text-left align-middle font-medium">
                    <div className="flex w-full justify-start items-center" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                      {t("common.loading")}
                    </TableCell>
                  </TableRow>
                ) : !data ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                      {t("common.loading")}
                    </TableCell>
                  </TableRow>
                ) : data.data.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {t("contacts.empty", {
                        defaultValue: "No contacts yet.",
                      })}
                    </TableCell>
                  </TableRow>
                ) : (
                  (data?.data ?? []).map((row) => {
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
                    return (
                      <TableRow
                        key={row.id}
                        onClick={() => navigate(`/contacts/${row.id}`)}
                        className="cursor-pointer"
                      >
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
                        <TableCell
                          className="whitespace-normal px-4 py-3 align-middle text-left"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="group inline-flex items-center rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                aria-label={t("contacts.columns.contactType", {
                                  defaultValue: "Contact type",
                                })}
                              >
                                <ContactTypeBadge
                                  contactType={row.contact_type}
                                  trailing={
                                    <ChevronDown className="h-3 w-3 -mr-0.5 opacity-70 transition-transform group-data-[state=open]:rotate-180" />
                                  }
                                />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="start"
                              className="w-48 p-1"
                            >
                              {CONTACT_TYPES.map((ct) => {
                                const isActive = row.contact_type === ct;
                                return (
                                  <DropdownMenuItem
                                    key={ct}
                                    onSelect={() => {
                                      if (isActive) return;
                                      contactTypeMutation.mutate({
                                        id: row.id,
                                        type: ct,
                                      });
                                    }}
                                    className="flex items-center justify-between gap-2 py-1.5 px-2"
                                  >
                                    <ContactTypeBadge contactType={ct} />
                                    {isActive ? (
                                      <Check className="h-3.5 w-3.5 text-muted-foreground" />
                                    ) : null}
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
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
      <CreateContactDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
