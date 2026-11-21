import { useEffect, useMemo, useState } from "react";
import { useOpenFromParam } from "~/lib/hooks/useOpenFromParam";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { contactPath } from "~/lib/contacts/contact-path";
import { useTranslation } from "react-i18next";
import { LoadError } from "~/components/notebook/load-error";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "~/providers/auth-provider";
import {
  getContacts,
  patchContactCrm,
  type ContactListItem,
  type PaginatedContacts,
} from "~/lib/api/contacts-crm";
import { CONTACT_TYPES, type ContactType } from "~/lib/contacts/contact-types";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { useSearchShortcut } from "~/lib/hooks/useSearchShortcut";
import { CONTACT_TABLE_FILTERS_BASE } from "~/lib/contacts/filter-presets";
import type { Filter } from "~/components/molecule/filter-component/types";
import FilterComponent from "~/components/molecule/filter-component";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
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
import { formatContactValue, formatDate } from "~/lib/utils/format";
import { useWorkspaceCurrency } from "~/lib/hooks/useWorkspaceCurrency";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Building2,
  Users,
  Mail,
  Phone,
  Search,
  Upload,
  IdCard,
  Info,
  Plus,
  PenLine,
  Smartphone,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { personName } from "~/lib/contacts/display-name";
import { ContactImportModal } from "~/components/organism/contact-import-modal";
import { CreateContactDialog } from "~/components/organism/create-contact-dialog";
import { ContactActions } from "~/components/notebook/contact-actions";
import { EmptyState } from "~/components/notebook/empty-state";
import { Checkbox } from "~/components/ui/checkbox";
import { useCanEditLeads } from "~/lib/hooks/useCanEditLeads";
import { useTabBarHeight } from "~/components/notebook/deal-action-bar";
import { rememberSelection, MAX_BATCH_CONTACTS } from "~/lib/api/deal-batches";

export function meta({ location }: { location: { pathname: string } }) {
  return [
    {
      title: location.pathname.startsWith("/companies")
        ? "Companies - Repraesent"
        : "Contacts - Repraesent",
    },
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
  const { currency: workspaceCurrency } = useWorkspaceCurrency();
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = useMemo(
    () => parsePage(searchParams.get("page")),
    [searchParams],
  );
  const limit = useMemo(
    () => parseLimit(searchParams.get("limit")),
    [searchParams],
  );
  const search = searchParams.get("search") ?? "";
  const sourceFilter = searchParams.get("source") ?? "";
  const contactTypeRaw = searchParams.get("contact_type") ?? "";
  const contactTypeFilter =
    contactTypeRaw === "end_customer" ? "customer" : contactTypeRaw;
  // One page, two places: People (/contacts) and Companies (/companies).
  const isCompanies = useLocation().pathname.startsWith("/companies");
  const kindFilter = isCompanies ? "company" : "person";
  const companyStart = useMemo(() => ({ kind: "company" as const }), []);
  const debouncedSearch = useDebounce(search, 300);
  const { ref: searchInputRef, withHint } = useSearchShortcut();

  // Picking contacts to make deals for. Survives paging; a new search, filter,
  // tab or business starts it again (what's ticked must be what you see).
  const canEdit = useCanEditLeads();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  useEffect(() => {
    setSelected(new Set());
    setSelectMode(false);
  }, [debouncedSearch, sourceFilter, contactTypeFilter, kindFilter, currentWorkspace?.id]);
  const toggleSelected = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) {
        if (next.size >= MAX_BATCH_CONTACTS) return prev;
        next.add(id);
      } else next.delete(id);
      return next;
    });
  const makeDealsFromSelection = () => {
    rememberSelection([...selected]);
    navigate("/pipeline/make?from=selection");
  };

  const [importModal, setImportModal] = useState<{
    open: boolean;
    mode: "csv" | "vcard" | "xlsx";
  }>({ open: false, mode: "csv" });
  const [createOpen, setCreateOpen] = useState(false);
  // Phones pick how first (New contact menu); desktop opens the form directly.
  const [createStart, setCreateStart] = useState<"phone" | "manual" | undefined>(undefined);
  const openCreate = (start?: "phone" | "manual") => {
    setCreateStart(start);
    setCreateOpen(true);
  };
  useOpenFromParam(() => openCreate());

  const tableQuery = useQuery({
    queryKey: [
      "contacts",
      "table",
      page,
      limit,
      debouncedSearch,
      sourceFilter || undefined,
      contactTypeFilter || undefined,
      kindFilter,
    ],
    queryFn: () =>
      getContacts({
        page,
        limit,
        search: debouncedSearch || undefined,
        source: sourceFilter || undefined,
        contact_type: contactTypeFilter || undefined,
        kind: kindFilter,
      }),
    enabled: !!currentWorkspace,
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
    [],
  );

  const hasTableFilters = !!sourceFilter || !!contactTypeFilter;

  // Every word that differs between the two places, in one spot.
  const copy = isCompanies
    ? {
        title: t("contacts.companies.title", "Companies"),
        hint: t(
          "contacts.companies.hint",
          "The companies you work with, and who you talk to there.",
        ),
        add: t("contacts.company.newTitle", "New company"),
        search: t(
          "contacts.companies.searchPlaceholder",
          "Search by company, email or phone…",
        ),
        empty: t("contacts.companies.empty", "No companies yet."),
        emptyBody: t(
          "contacts.companies.emptyBody",
          "Add the first company you work with. The people there come next.",
        ),
        noMatch: t("contacts.companies.noMatch", "No company matches that."),
        noMatchBody: t(
          "contacts.companies.noMatchBody",
          "Try another name, or clear the search and filters.",
        ),
        showAll: t("contacts.companies.showAll", "Show all companies"),
        loadWhat: t("errors.what.companies", "your companies"),
      }
    : {
        title: t("contacts.contactsTitle"),
        hint: t("contacts.peopleHint", "Everyone you work with, in one place."),
        add: t("contacts.newContactButton", { defaultValue: "New contact" }),
        search: t("contacts.searchPlaceholderCompany", {
          defaultValue: "Search by name, company, email or phone…",
        }),
        empty: t("contacts.empty", { defaultValue: "No contacts yet." }),
        emptyBody: t(
          "contacts.emptyBody",
          "Add the people you work with — from your phone, typed in, or from a file.",
        ),
        noMatch: t("contacts.emptySearch.title", "Nobody matches that."),
        noMatchBody: t(
          "contacts.emptySearch.body",
          "Try another name, or clear the search and filters.",
        ),
        showAll: t("contacts.emptySearch.clear", "Show everyone"),
        loadWhat: t("errors.what.people", "your people"),
      };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 app-fade-in">
      {/* Header — same pattern as Leads */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0 app-fade-up">
        <div>
          <h1 className="title-display text-[26px] font-semibold text-foreground sm:text-[30px]">
            {copy.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 max-sm:hidden">
            {isCompanies ? copy.hint : t("contacts.contactsManageHint")}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5 sm:hidden">
            {copy.hint}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isCompanies ? (
            // A company is typed in, or brought in with a file (no phone book).
            <>
            <Button
              variant="outline"
              className="h-9 gap-1.5 text-xs max-sm:h-11 max-sm:text-sm"
              onClick={() => navigate("/contacts/import")}
            >
              <Upload className="size-3.5 max-sm:size-4" />
              {t("contacts.importV2.menu", "CSV or Excel file")}
            </Button>
            <Button
              className="h-9 gap-1.5 text-xs max-sm:h-11 max-sm:flex-1 max-sm:text-sm"
              onClick={() => openCreate("manual")}
            >
              <Plus className="size-3.5 max-sm:size-4" />
              {copy.add}
            </Button>
            </>
          ) : (
          <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-xs max-sm:hidden"
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
                onSelect={() => navigate("/contacts/import")}
              >
                <Upload className="h-3.5 w-3.5 mr-2" />
                {t("contacts.importV2.menu", "CSV or Excel file")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            className="h-9 gap-1.5 text-xs max-sm:hidden"
            onClick={() => openCreate()}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("contacts.newContactButton", { defaultValue: "New contact" })}
          </Button>
          {/* Phones: New contact first asks how — from the phone, typed, or a file. */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button className="h-11 flex-1 gap-1.5 text-sm sm:hidden">
                <Plus className="size-4" />
                {t("contacts.newContactButton", { defaultValue: "New contact" })}
                <ChevronDown className="size-4 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} className="w-[min(18rem,calc(100vw-2rem))] p-1.5">
              <DropdownMenuItem className="min-h-11 gap-3 text-[15px]" onSelect={() => openCreate("phone")}>
                <Smartphone className="size-5" />
                {t("contacts.newMenu.fromPhone", "From your phone")}
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-11 gap-3 text-[15px]" onSelect={() => openCreate("manual")}>
                <PenLine className="size-5" />
                {t("contacts.newMenu.typeIn", "Type it in")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="px-2 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {t("contacts.newMenu.importLabel", "Import a file")}
              </DropdownMenuLabel>
              <DropdownMenuItem className="min-h-11 gap-3 text-[15px]" onSelect={() => setImportModal({ open: true, mode: "vcard" })}>
                <IdCard className="size-5" />
                {t("contacts.import.vcardButton")}
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-11 gap-3 text-[15px]" onSelect={() => navigate("/contacts/import")}>
                <Upload className="size-5" />
                {t("contacts.importV2.menu", "CSV or Excel file")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </>
          )}
        </div>
      </div>

      <div className="border-t border-border shrink-0" />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            placeholder={withHint(
              copy.search
            )}
            value={search}
            onChange={(e) => setParam({ search: e.target.value, page: "1" })}
            className="pl-9 pr-9 max-sm:pr-11"
          />
          {search ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setParam({ search: undefined, page: "1" })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground h-6 w-6 max-sm:right-0 max-sm:size-11"
              aria-label={t("common.clearSearch")}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3 items-center shrink-0 sm:justify-end">
          {canEdit ? (
            <Button
              type="button"
              variant={selectMode ? "default" : "outline"}
              className="h-11 text-sm sm:hidden"
              aria-pressed={selectMode}
              onClick={() => {
                if (selectMode) setSelected(new Set());
                setSelectMode((v) => !v);
              }}
            >
              {selectMode ? t("contacts.select.done", "Done picking") : t("contacts.select.start", "Pick to make deals")}
            </Button>
          ) : null}
          <FilterComponent filters={contactListFilters} />
          {hasTableFilters && (
            <button
              type="button"
              className="press inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors max-sm:min-h-11 max-sm:px-4 max-sm:text-sm"
              onClick={() =>
                setParam({
                  source: undefined,
                  contact_type: undefined,
                  kind: undefined,
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
        <LoadError what={copy.loadWhat} onRetry={() => void tableQuery.refetch()} />
      )}

      {!isError && (
        <TooltipProvider delayDuration={150}>
          {/* Phones: one card per person instead of the wide table
              (MOBILE_PACKAGE_PLAN.md B2). Same query, same row link. */}
          <ul className="space-y-2 sm:hidden">
            {isLoading || !data ? (
              <li className="rounded-xl border border-border bg-card">
                <EmptyState compact title={t("common.loading")} />
              </li>
            ) : data.data.length === 0 ? (
              <li className="rounded-xl border border-border bg-card">
                {search || hasTableFilters ? (
                  <EmptyState
                    icon={<Search />}
                    title={copy.noMatch}
                    body={copy.noMatchBody}
                    action={
                      <Button
                        variant="outline"
                        className="h-11 text-sm"
                        onClick={() =>
                          setParam({
                            search: undefined,
                            source: undefined,
                            contact_type: undefined,
                  kind: undefined,
                            page: "1",
                          })
                        }
                      >
                        <X className="size-4" />
                        {copy.showAll}
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={isCompanies ? <Building2 /> : <IdCard />}
                    title={copy.empty}
                    body={copy.emptyBody}
                    action={
                      <Button className="h-11 gap-1.5 text-sm" onClick={() => openCreate(isCompanies ? "manual" : undefined)}>
                        <Plus className="size-4" />
                        {copy.add}
                      </Button>
                    }
                  />
                )}
              </li>
            ) : (
              data.data.map((row) => {
                const email = row.primary_email?.trim() ?? "";
                const name = personName({ full_name: row.contact_full_name, email }) ?? "—";
                const phone = row.primary_phone?.trim() ?? "";
                const company = row.parent_full_name?.trim() ?? "";
                const ltvNum = row.lifetime_value != null ? Number(row.lifetime_value) : null;
                return (
                  <li
                    key={row.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 shadow-xs",
                      selected.has(row.id) ? "border-foreground/40" : "border-border",
                    )}
                  >
                    {selectMode ? (
                      <label className="-my-2.5 -ml-3 flex min-h-14 min-w-12 shrink-0 cursor-pointer items-center justify-center self-stretch">
                        <Checkbox
                          checked={selected.has(row.id)}
                          onCheckedChange={(v) => toggleSelected(row.id, v === true)}
                          aria-label={t("contacts.select.one", { defaultValue: "Pick {{name}}", name })}
                        />
                      </label>
                    ) : null}
                    <Link
                      to={contactPath(row)}
                      // Picking: a tap on the card ticks it instead of opening it.
                      onClick={(e) => {
                        if (!selectMode) return;
                        e.preventDefault();
                        toggleSelected(row.id, !selected.has(row.id));
                      }}
                      aria-pressed={selectMode ? selected.has(row.id) : undefined}
                      className="press flex min-h-11 min-w-0 flex-1 items-center gap-3"
                    >
                      <Avatar className="size-10 shrink-0">
                        {(row.avatar_thumb_url ?? row.avatar_url) ? (
                          <AvatarImage
                            src={(row.avatar_thumb_url ?? row.avatar_url)!}
                            className="object-cover"
                          />
                        ) : null}
                        <AvatarFallback className="bg-muted text-[12px] font-semibold text-foreground">
                          {row.kind === "company" ? (
                            <Building2 className="size-4" aria-hidden />
                          ) : (
                            contactInitials(name)
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-foreground">{name}</p>
                        <p className="truncate text-[12.5px] text-muted-foreground">
                          {isCompanies
                            ? [
                                t("contacts.companies.peopleCount", "{{count}} people", { count: row.people_count ?? 0 }),
                                company ? t("contacts.companies.partOf", "Part of {{name}}", { name: company }) : email || phone,
                              ]
                                .filter(Boolean)
                                .join(" · ")
                            : [row.job_title?.trim(), company].filter(Boolean).join(" · ") ||
                              email ||
                              phone ||
                              t("contacts.noContactInfo", { defaultValue: "No contact info" })}
                        </p>
                        {ltvNum != null && Number.isFinite(ltvNum) && ltvNum > 0 ? (
                          <p className="num mt-0.5 text-[12.5px] font-medium text-earned">
                            {t("mobile.people.earned", "Earned {{value}}", {
                              value: formatContactValue(row, "won", ltvNum, workspaceCurrency),
                            })}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                    {selectMode ? null : (
                      <ContactActions iconOnly target={{ phone }} className="shrink-0 flex-nowrap" />
                    )}
                  </li>
                );
              })
            )}
          </ul>
          <div className="rounded-md border border-border bg-card shadow-(--shadow) overflow-hidden overflow-x-auto max-sm:hidden">
            <Table className="min-w-[1040px]">
              <TableHeader>
                <TableRow>
                  {canEdit ? (
                    <TableHead className="w-10 px-0 pl-4 align-middle">
                      {(() => {
                        const ids = (data?.data ?? []).map((r) => r.id);
                        const n = ids.filter((id) => selected.has(id)).length;
                        return (
                          <Checkbox
                            checked={ids.length > 0 && n === ids.length ? true : n > 0 ? "indeterminate" : false}
                            disabled={!ids.length}
                            onCheckedChange={(v) => {
                              for (const id of ids) toggleSelected(id, v === true);
                            }}
                            aria-label={t("contacts.select.page", "Pick everyone on this page")}
                          />
                        );
                      })()}
                    </TableHead>
                  ) : null}
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
                            defaultValue: "Total value of all won deals.",
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
                    <TableCell colSpan={canEdit ? 10 : 9} className="h-24 text-center">
                      {t("common.loading")}
                    </TableCell>
                  </TableRow>
                ) : !data ? (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 10 : 9} className="h-24 text-center">
                      {t("common.loading")}
                    </TableCell>
                  </TableRow>
                ) : data.data.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={canEdit ? 10 : 9}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {search || hasTableFilters
                        ? copy.noMatch
                        : isCompanies
                          ? copy.empty
                          : t("contacts.empty", {
                        defaultValue: "No contacts yet.",
                      })}
                    </TableCell>
                  </TableRow>
                ) : (
                  (data?.data ?? []).map((row) => {
                    const email = row.primary_email?.trim() ?? "";
                    // The address before the dash: a column of em-dashes (and
                    // avatars containing one) is what a workspace full of
                    // newsletter contacts used to look like.
                    const name =
                      personName({
                        full_name: row.contact_full_name,
                        email,
                      }) ?? "—";
                    const phone = row.primary_phone?.trim() ?? "";
                    const company = row.parent_full_name?.trim() ?? "";
                    const ltvNum =
                      row.lifetime_value != null
                        ? Number(row.lifetime_value)
                        : null;
                    const pipelineNum =
                      row.pipeline_value != null
                        ? Number(row.pipeline_value)
                        : null;
                    const lostNum =
                      row.lost_value != null ? Number(row.lost_value) : null;
                    return (
                      <TableRow
                        key={row.id}
                        onClick={() => navigate(contactPath(row))}
                        className="cursor-pointer"
                        data-state={selected.has(row.id) ? "selected" : undefined}
                      >
                        {canEdit ? (
                          <TableCell className="w-10 px-0 pl-4 align-middle" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selected.has(row.id)}
                              onCheckedChange={(v) => toggleSelected(row.id, v === true)}
                              aria-label={t("contacts.select.one", { defaultValue: "Pick {{name}}", name })}
                            />
                          </TableCell>
                        ) : null}
                        <TableCell className="whitespace-normal px-4 py-3 align-middle text-left">
                          <Link
                            to={contactPath(row)}
                            className="flex items-center gap-3 group"
                          >
                            <Avatar className="size-9 shrink-0">
                              {(row.avatar_thumb_url ?? row.avatar_url) ? (
                                <AvatarImage
                                  src={(row.avatar_thumb_url ?? row.avatar_url)!}
                                  className="object-cover"
                                />
                              ) : null}
                              <AvatarFallback className="bg-muted text-[11px] font-semibold text-foreground">
                                {row.kind === "company" ? (
                                  <Building2 className="size-4" aria-hidden />
                                ) : (
                                  contactInitials(name)
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 text-left">
                              <div className="truncate font-medium text-foreground group-hover:underline">
                                {name}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                                {isCompanies ? (
                                  <span className="num inline-flex items-center gap-1 text-foreground/80">
                                    <Users className="h-3 w-3 shrink-0 opacity-70" />
                                    {t("contacts.companies.peopleCount", "{{count}} people", { count: row.people_count ?? 0 })}
                                  </span>
                                ) : null}
                                {company || row.job_title ? (
                                  <span
                                    className="inline-flex items-center gap-1 truncate max-w-[220px] text-foreground/80"
                                    title={company}
                                  >
                                    <Building2 className="h-3 w-3 shrink-0 opacity-70" />
                                    <span className="truncate">
                                      {isCompanies
                                        ? t("contacts.companies.partOf", "Part of {{name}}", { name: company })
                                        : [row.job_title?.trim(), company].filter(Boolean).join(" · ")}
                                    </span>
                                  </span>
                                ) : null}
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
                                {!email && !phone && !company ? (
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
                              {formatContactValue(row, "won", ltvNum, workspaceCurrency)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-normal px-4 py-3 align-middle text-left tabular-nums">
                          {pipelineNum != null &&
                          Number.isFinite(pipelineNum) ? (
                            <span className="inline-flex items-center rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-inset ring-sky-500/20 dark:text-sky-400">
                              {formatContactValue(row, "pipeline", pipelineNum, workspaceCurrency)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-normal px-4 py-3 align-middle text-left tabular-nums">
                          {lostNum != null && Number.isFinite(lostNum) ? (
                            <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-500/20 dark:text-red-400">
                              {formatContactValue(row, "lost", lostNum, workspaceCurrency)}
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
                            to={contactPath(row)}
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
                  from: data.total > 0 ? (data.page - 1) * data.limit + 1 : 0,
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
                  <SelectTrigger className="w-[70px] max-sm:w-[76px]">
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
                    className="max-sm:size-11"
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
                    className="max-sm:size-11"
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

      {canEdit && selected.size > 0 ? (
        <SelectionBar
          count={selected.size}
          onMake={makeDealsFromSelection}
          onClear={() => {
            setSelected(new Set());
            setSelectMode(false);
          }}
        />
      ) : null}

      <ContactImportModal
        open={importModal.open}
        onOpenChange={(o) => setImportModal((s) => ({ ...s, open: o }))}
      />
      <CreateContactDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        start={createStart}
        initialValues={isCompanies ? companyStart : undefined}
      />
    </div>
  );
}

/**
 * What's picked and what to do with it. Phones: pinned above the tab bar in
 * the thumb zone (a spacer keeps the last card reachable). Desktop: a small
 * floating bar at the bottom of the list.
 */
function SelectionBar({ count, onMake, onClear }: { count: number; onMake: () => void; onClear: () => void }) {
  const { t } = useTranslation();
  const bottom = useTabBarHeight();
  return (
    <>
      <div className="h-24 sm:hidden" aria-hidden />
      <div
        role="region"
        aria-label={t("contacts.select.bar", "Picked contacts")}
        className="fixed inset-x-0 z-30 border-t border-border bg-card/95 px-4 pt-2.5 backdrop-blur-md sm:inset-x-auto sm:bottom-6! sm:left-1/2 sm:-translate-x-1/2 sm:rounded-full sm:border sm:px-2 sm:py-2 sm:shadow-lg"
        style={{
          bottom: bottom == null ? "calc(4rem + env(safe-area-inset-bottom, 0px))" : bottom,
          paddingBottom: bottom ? "0.625rem" : "calc(0.625rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="num min-w-0 flex-1 text-[14px] font-medium text-foreground sm:flex-none sm:pl-3" aria-live="polite">
            {t("contacts.select.count", { defaultValue: "{{count}} picked", count })}
          </span>
          <Button variant="ghost" className="h-12 px-3 text-[15px] sm:h-9 sm:text-[13px]" onClick={onClear}>
            {t("contacts.select.clear", "Clear")}
          </Button>
          <Button className="h-12 px-5 text-[15px] sm:h-9 sm:rounded-full sm:text-[13px]" onClick={onMake}>
            {t("contacts.select.makeDeals", "Make deals")}
          </Button>
        </div>
      </div>
    </>
  );
}
