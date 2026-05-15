import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { Boxes } from "lucide-react";
import { DataTable } from "~/components/organism/data-table";
import {
  listBrandRetailers,
  type BrandRetailer,
} from "~/lib/api/doorboost-brand";
import { useAuthContext } from "~/providers/auth-provider";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { useSearchParamsSelect } from "~/lib/hooks/useQueryParams";
import i18n from "~/i18n";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";

export function meta() {
  return [{ title: i18n.t("db_brand.page_titles.brand_retailers") }];
}

const lastIdSegment = (id: string) => id.split("-").pop() ?? id;

function parsePage(v: string | null): number {
  const n = parseInt(v ?? "1", 10);
  return isNaN(n) || n < 1 ? 1 : n;
}
function parseLimit(v: string | null): number {
  const n = parseInt(v ?? "10", 10);
  return isNaN(n) || n < 1 ? 10 : Math.min(100, n);
}

export default function BrandRetailers() {
  useDocumentMeta({ titleKey: "db_brand.page_titles.brand_retailers" });
  const { currentWorkspace } = useAuthContext();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [onSelect] = useSearchParamsSelect();
  const isBrandWs = currentWorkspace?.type === "doorboost_brand";

  const page = useMemo(
    () => parsePage(searchParams.get("page")),
    [searchParams],
  );
  const limit = useMemo(
    () => parseLimit(searchParams.get("limit")),
    [searchParams],
  );
  const urlSearch = searchParams.get("search") ?? "";

  // Local input state stays snappy; URL is updated after debounce.
  const [search, setSearch] = useState(urlSearch);
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    if (debouncedSearch === urlSearch) return;
    onSelect({ search: debouncedSearch, page: "1" }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const { data: retailers = [], isLoading } = useQuery<BrandRetailer[]>({
    queryKey: ["db-brand-retailers", currentWorkspace?.id],
    queryFn: listBrandRetailers,
    enabled: isBrandWs,
    staleTime: 60_000,
  });

  // Brand retailer list is fully cached client-side (typical brand holds
  // <200 retailers), so we filter + paginate in-memory and avoid a second
  // backend roundtrip.
  const filtered = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    if (!needle) return retailers;
    return retailers.filter(
      (r) =>
        (r.retailer_name || "").toLowerCase().includes(needle) ||
        r.retailer_id.toLowerCase().includes(needle),
    );
  }, [retailers, debouncedSearch]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  // Snap back to the last page when filtering shrinks the result set below
  // the current page number.
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const offset = (safePage - 1) * limit;
    return filtered.slice(offset, offset + limit);
  }, [filtered, safePage, limit]);

  const columns: ColumnDef<BrandRetailer>[] = [
    {
      accessorKey: "retailer_name",
      header: t("db_brand.retailers.columns.name", "Retailer"),
      cell: ({ row }) => {
        const tag = lastIdSegment(row.original.retailer_id);
        return (
          <span className="font-medium text-foreground">
            {row.original.retailer_name || tag}
          </span>
        );
      },
    },
    {
      accessorKey: "retailer_id",
      header: t("db_brand.retailers.columns.id", "ID"),
      cell: ({ row }) => (
        <span className="text-[11px] font-mono text-muted-foreground/70">
          #{lastIdSegment(row.original.retailer_id)}
        </span>
      ),
    },
  ];

  if (!isBrandWs) return null;

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid place-items-center w-12 h-12 rounded-xl bg-amber-400/10 text-amber-400">
          <Boxes className="w-6 h-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("nav.brand_retailers", "Retailers")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "db_brand.retailers.subtitle",
              "Every retailer attached to {{brand}}. Click a row to open its social ads.",
              { brand: currentWorkspace.name },
            )}
          </p>
        </div>
      </div>

      <DataTable<BrandRetailer, unknown>
        columns={columns}
        data={pageRows}
        isLoading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t(
          "db_brand.retailers.search_placeholder",
          "Search retailers…",
        )}
        onRowClick={(row) =>
          navigate(`/db-brand/retailers/${row.retailer_id}/social-ads`)
        }
        pagination={{
          page: safePage,
          limit,
          total,
          totalPages,
          hasNext: safePage < totalPages,
          hasPrev: safePage > 1,
        }}
        onPaginationChange={(p, l) => {
          const updates: Record<string, string> = { page: String(p) };
          if (Number(l) !== 10) updates.limit = String(l);
          onSelect(updates, true);
        }}
        emptyMessage={t(
          "db_brand.retailers.empty",
          "No retailers attached to this brand yet.",
        )}
      />
    </div>
  );
}
