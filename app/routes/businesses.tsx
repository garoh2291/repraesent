import { useMemo, useState } from "react";
import { Navigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Plus, Search } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { useSearchShortcut } from "~/lib/hooks/useSearchShortcut";
import { businessKeys, getBusinessesOverview, type BusinessOverviewRow } from "~/lib/api/agencies";
import { AddBusinessDialog } from "~/components/agency/add-business-dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

const SEARCH_FROM = 9;

/**
 * Your businesses (AGENCY_MODE_PLAN.md §4): what needs the agency in each of
 * its businesses, how they are doing, and the door into each one.
 */
export default function BusinessesPage() {
  const { t } = useTranslation();
  const { currentWorkspace, setCurrentWorkspace } = useAuthContext();
  useDocumentMeta({ titleKey: "agency.businesses.metaTitle", descriptionKey: "agency.businesses.metaDescription", titleSuffix: " - Repraesent" });
  const isAgency = currentWorkspace?.agency?.status === "active" && !currentWorkspace.via_agency_id;
  const isAdmin = currentWorkspace?.member_role === "admin";
  const q = useQuery({
    queryKey: businessKeys.overview(currentWorkspace?.id),
    queryFn: getBusinessesOverview,
    enabled: isAgency,
    // A business that is still being set up: check again shortly.
    refetchInterval: (query) => (query.state.data?.businesses.some((b) => b.setup_state === "setting_up") ? 10_000 : false),
    staleTime: 60_000,
  });
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const { ref: searchRef, withHint } = useSearchShortcut();

  const rows = q.data?.businesses ?? [];
  const needle = search.trim().toLowerCase();
  const shown = useMemo(() => (needle ? rows.filter((r) => r.name.toLowerCase().includes(needle)) : rows), [rows, needle]);

  if (!currentWorkspace) return null;
  if (!isAgency) return <Navigate to="/" replace />;

  const limit = q.data?.child_limit ?? currentWorkspace.agency?.child_limit ?? null;
  const count = q.data?.count ?? currentWorkspace.agency?.child_count ?? 0;
  const full = limit != null && count >= limit;
  const waitingTotal = rows.reduce((s, r) => s + r.waiting, 0);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 app-fade-in">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("agency.businesses.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {limit == null
              ? t("agency.businesses.countUnlimited", { count })
              : t("agency.businesses.countOfLimit", { count, limit })}
            {waitingTotal > 0 ? (
              <>
                {" · "}
                <span className="rounded bg-secondary px-1.5 py-0.5 font-medium text-foreground">
                  {t("agency.businesses.waitingTotal", { count: waitingTotal })}
                </span>
              </>
            ) : null}
          </p>
        </div>
        {isAdmin ? (
          <Button onClick={() => setAdding(true)} disabled={full} className="self-start sm:self-auto">
            <Plus className="size-4" aria-hidden /> {t("agency.businesses.add")}
          </Button>
        ) : null}
      </header>

      {full && isAdmin ? (
        <p className="rounded-xl border border-secondary bg-secondary/30 px-4 py-3 text-sm text-foreground">
          {t("agency.settings.on.full")}
        </p>
      ) : null}

      {rows.length >= SEARCH_FROM ? (
        <label className="relative block">
          <span className="sr-only">{t("agency.picker.search")}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={withHint(t("agency.picker.search"))} className="h-10 pl-9" />
        </label>
      ) : null}

      {q.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : rows.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-base font-medium text-foreground">{t("agency.businesses.emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("agency.businesses.emptyBody")}</p>
          {isAdmin && !full ? (
            <Button className="mt-4" onClick={() => setAdding(true)}>
              <Plus className="size-4" aria-hidden /> {t("agency.businesses.addFirst")}
            </Button>
          ) : null}
        </section>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {shown.map((b) => (
            <BusinessRow key={b.id} b={b} onOpen={() => setCurrentWorkspace(b.id)} />
          ))}
          {shown.length === 0 ? <li className="px-4 py-6 text-sm text-muted-foreground">{t("agency.picker.noMatch")}</li> : null}
        </ul>
      )}

      <p className="text-[12.5px] text-muted-foreground">{t("agency.businesses.numbersNote")}</p>

      <AddBusinessDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}

function BusinessRow({ b, onOpen }: { b: BusinessOverviewRow; onOpen: () => void }) {
  const { t } = useTranslation();
  const status: string[] = [];
  if (b.setup_state === "setting_up") status.push(t("agency.businesses.settingUp", "Setting up · inviting the team"));
  if (b.setup_state === "needs_look") status.push(t("agency.businesses.setupNeedsLook", "Set-up needs a look · write to re:praesent"));
  if (b.website_state === "live") status.push(t("agency.root.website.live"));
  if (b.website_state === "building") status.push(t("agency.picker.websiteBuilding"));
  const otherSetup = b.open_setup.filter((k) => k !== "website");
  if (b.open_reports) status.push(t("agency.businesses.reportsOpen", { count: b.open_reports }));
  if (otherSetup.length) status.push(t("agency.businesses.setupOpen", { items: otherSetup.map((k) => t(`agency.businesses.kinds.${k}`)).join(", ") }));

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group grid w-full grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[2.5rem_1fr_repeat(3,5.5rem)_1.5rem]"
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-foreground text-sm font-semibold text-background" aria-hidden>
          {b.name.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium text-foreground">{b.name}</span>
          <span className="block truncate text-[12.5px] text-muted-foreground">
            {status.length ? status.join(" · ") : t("agency.root.website.none")}
          </span>
          {/* Phone: the numbers sit under the name. */}
          <span className="mt-1 flex flex-wrap gap-x-3 text-[12.5px] text-muted-foreground sm:hidden">
            <Num n={b.waiting} label={t("agency.businesses.cols.waiting")} mark />
            <Num n={b.inquiries_30d} label={t("agency.businesses.cols.inquiries")} />
            <Num n={b.new_customers_30d} label={t("agency.businesses.cols.customers")} />
          </span>
        </span>
        <Stat n={b.waiting} label={t("agency.businesses.cols.waiting")} mark />
        <Stat n={b.inquiries_30d} label={t("agency.businesses.cols.inquiries")} />
        <Stat n={b.new_customers_30d} label={t("agency.businesses.cols.customers")} />
        <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
      </button>
    </li>
  );
}

/** Desktop column: number over a small label. Marker yellow only when someone is waiting. */
function Stat({ n, label, mark }: { n: number; label: string; mark?: boolean }) {
  return (
    <span className="hidden text-right sm:block">
      <span className={cn("inline-block min-w-6 rounded px-1 text-lg font-semibold tabular-nums", mark && n > 0 ? "bg-secondary text-foreground" : "text-foreground")}>
        {n}
      </span>
      <span className="block text-[11px] leading-tight text-muted-foreground">{label}</span>
    </span>
  );
}

function Num({ n, label, mark }: { n: number; label: string; mark?: boolean }) {
  return (
    <span>
      <span className={cn("font-semibold tabular-nums text-foreground", mark && n > 0 && "rounded bg-secondary px-1")}>{n}</span> {label}
    </span>
  );
}
