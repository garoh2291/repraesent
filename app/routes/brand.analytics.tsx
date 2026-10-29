import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Globe, Search } from "lucide-react";
import i18n from "~/i18n";
import { cn } from "~/lib/utils";
import { formatNumber } from "~/lib/utils/format";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { useClientTypeWording } from "~/lib/hooks/useClientTypeWording";
import { useIsPhone } from "~/lib/hooks/use-is-phone";
import {
  getBrandAnalyticsWorkspaces,
  getBrandPlausibleAnalytics,
  type BrandAnalyticsWorkspace,
} from "~/lib/api/brand";
import { brandScope } from "~/lib/api/website-stats";
import { PageContainer, PageHeader } from "~/components/notebook/page-header";
import { Panel } from "~/components/notebook/panel";
import { EmptyState } from "~/components/notebook/empty-state";
import { BottomSheet } from "~/components/notebook/bottom-sheet";
import { Skeleton } from "~/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { WebsiteStatsExplorer } from "~/components/analytics/website-stats-explorer";

export function meta() {
  return [{ title: i18n.t("brand.analyticsTitle", "Analytics") + " – Repraesent" }];
}

type House = BrandAnalyticsWorkspace & { people: number | null };

function HouseList({
  houses,
  selectedId,
  onPick,
}: {
  houses: House[];
  selectedId: string | null;
  onPick: (id: string) => void;
}) {
  const { t } = useTranslation();
  const ctw = useClientTypeWording();
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const match = (h: House) =>
    !needle || h.name.toLowerCase().includes(needle) || (h.site ?? "").toLowerCase().includes(needle);
  const tracked = houses.filter((h) => h.has_analytics && match(h));
  const untracked = houses.filter((h) => !h.has_analytics && match(h));

  return (
    <div className="flex max-h-[70vh] flex-col sm:max-h-[460px]">
      <div className="border-b border-border p-3">
        <label className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-card px-3">
          <Search className="size-4 text-muted-foreground" aria-hidden />
          <span className="sr-only">{t("brand.analyticsSearch", { ...ctw, defaultValue: "Find a {{type}}…" })}</span>
          <input
            type="search"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("brand.analyticsSearch", { ...ctw, defaultValue: "Find a {{type}}…" })}
            className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground outline-none max-sm:text-[16px]"
          />
        </label>
      </div>
      <div className="overflow-y-auto p-1.5">
        {tracked.length > 0 ? (
          <p className="px-2.5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("brand.analyticsTrackedGroup", "Visitors counted · last 30 days")}
          </p>
        ) : null}
        {tracked.map((h) => {
          const on = h.id === selectedId;
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => onPick(h.id)}
              aria-current={on}
              className={cn(
                "flex min-h-[52px] w-full items-center gap-3 rounded-lg px-2.5 text-left transition-colors",
                on ? "bg-foreground text-background" : "text-foreground hover:bg-muted",
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[14px] font-semibold">{h.name}</span>
                {h.site ? <span className={cn("truncate text-[12px]", on ? "text-background/70" : "text-muted-foreground")}>{h.site}</span> : null}
              </span>
              {h.people !== null ? (
                <span className="num text-[14px] font-semibold">{formatNumber(h.people)}</span>
              ) : null}
              {on ? <Check className="size-4 shrink-0" aria-hidden /> : null}
            </button>
          );
        })}
        {untracked.length > 0 ? (
          <>
            <p className="px-2.5 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t("brand.analyticsUntrackedGroup", "No visitors counted yet")}
            </p>
            {untracked.map((h) => (
              <div key={h.id} className="flex min-h-11 items-center gap-3 px-2.5 text-[14px] text-muted-foreground">
                <span className="min-w-0 flex-1 truncate">{h.name}</span>
                <span className="shrink-0 text-[11.5px]">{t("brand.analyticsUntrackedReason", "Website not connected")}</span>
              </div>
            ))}
          </>
        ) : null}
        {tracked.length + untracked.length === 0 ? (
          <p className="px-3 py-5 text-[14px] text-muted-foreground">
            {t("brand.analyticsNoMatch", { ...ctw, q, defaultValue: "No {{type}} matches “{{q}}”." })}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function HousePicker({
  houses,
  selected,
  onPick,
}: {
  houses: House[];
  selected: House | null;
  onPick: (id: string) => void;
}) {
  const { t } = useTranslation();
  const ctw = useClientTypeWording();
  const phone = useIsPhone();
  const [open, setOpen] = useState(false);
  const pick = (id: string) => {
    setOpen(false);
    onPick(id);
  };
  const trigger = (
    <button
      type="button"
      onClick={phone ? () => setOpen(true) : undefined}
      aria-haspopup="dialog"
      className="-mx-1.5 inline-flex max-w-full items-center gap-2 rounded-lg px-1.5 text-left transition-colors hover:bg-muted/60"
    >
      <span className="title-display min-w-0 text-[26px] font-semibold text-foreground max-sm:break-words sm:whitespace-nowrap sm:text-[32px]">
        {selected?.name ?? t("brand.analyticsPickHouse", { ...ctw, defaultValue: "Choose a {{type}}" })}
      </span>
      <ChevronDown className={cn("size-5 shrink-0 transition-transform sm:size-6", open && "rotate-180")} aria-hidden />
    </button>
  );
  const list = <HouseList houses={houses} selectedId={selected?.id ?? null} onPick={pick} />;

  if (phone) {
    return (
      <>
        {trigger}
        <BottomSheet open={open} onOpenChange={setOpen} title={ctw.Types}>
          {list}
        </BottomSheet>
      </>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-[400px] overflow-hidden rounded-xl border-border p-0 shadow-xl">
        {open ? list : null}
      </PopoverContent>
    </Popover>
  );
}

/** Website visitors of one partner house, for its brand — same explorer as /analytics. */
export default function BrandAnalytics() {
  const { t } = useTranslation();
  const ctw = useClientTypeWording();
  useDocumentMeta({ titleKey: "brand.analyticsTitle", titleSuffix: " – Repraesent" });
  const [sp, setSp] = useSearchParams();

  const { data: workspaces, isLoading } = useQuery({
    queryKey: ["brand-analytics-workspaces"],
    queryFn: getBrandAnalyticsWorkspaces,
    staleTime: 5 * 60_000,
  });
  // Same query as the brand dashboard's visitors chart, so it is usually cached.
  const { data: counts } = useQuery({
    queryKey: ["brand-analytics", "plausible", "30d"],
    queryFn: () => getBrandPlausibleAnalytics("30d"),
    staleTime: 5 * 60_000,
  });

  const houses: House[] = useMemo(() => {
    const people = new Map((counts?.workspaces ?? []).map((w) => [w.workspace_id, w.visitors]));
    return (workspaces ?? []).map((w) => ({ ...w, people: people.get(w.id) ?? null }));
  }, [workspaces, counts]);

  const trackedHouses = houses.filter((h) => h.has_analytics);
  const wanted = sp.get("workspace");
  const selected =
    trackedHouses.find((h) => h.id === wanted) ?? (wanted ? null : trackedHouses[0]) ?? null;

  // Put the default house in the URL so the page can be shared and reloaded.
  useEffect(() => {
    if (!wanted && trackedHouses[0]) {
      const next = new URLSearchParams(sp);
      next.set("workspace", trackedHouses[0].id);
      setSp(next, { replace: true });
    }
  }, [wanted, trackedHouses, sp, setSp]);

  const pick = (id: string) => {
    const next = new URLSearchParams(sp);
    next.set("workspace", id);
    // Filters belong to one website (its pages, campaigns); dates and comparison carry over.
    next.delete("f");
    setSp(next);
  };

  const countedLine = t("brand.analyticsCounted", {
    ...ctw,
    n: trackedHouses.length,
    total: houses.length,
    defaultValue: "{{n}} of {{total}} {{types}} counted",
  });

  if (isLoading) {
    return (
      <PageContainer className="space-y-5">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </PageContainer>
    );
  }

  if (trackedHouses.length === 0 || (wanted && !selected)) {
    const unknown = !!wanted && trackedHouses.length > 0;
    return (
      <PageContainer className="space-y-6">
        <PageHeader
          eyebrow={t("brand.analyticsTitle", "Analytics")}
          title={
            trackedHouses.length > 0 ? (
              <HousePicker houses={houses} selected={null} onPick={pick} />
            ) : (
              t("brand.analyticsTitle", "Analytics")
            )
          }
          subtitle={houses.length ? countedLine : undefined}
        />
        <Panel className="p-5 sm:p-6">
          <EmptyState
            icon={<Globe className="size-5" aria-hidden />}
            title={
              unknown
                ? t("brand.analyticsUnknownTitle", { ...ctw, defaultValue: "We don't count visitors for this {{type}} yet" })
                : t("brand.analyticsNoneTitle", { ...ctw, defaultValue: "No visitors counted for your {{types}} yet" })
            }
            body={t("brand.analyticsNoneBody", {
              ...ctw,
              defaultValue: "Visitors are counted once a {{type}}'s website is connected. Write to us and we'll connect it.",
            })}
          />
        </Panel>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-5">
      <WebsiteStatsExplorer
        key={selected!.id}
        scope={brandScope(selected!.id)}
        header={({ site, live }) => (
          <PageHeader
            eyebrow={t("brand.analyticsTitle", "Analytics")}
            title={<HousePicker houses={houses} selected={selected} onPick={pick} />}
            subtitle={`${site ?? selected!.site ?? ""}${site || selected!.site ? " · " : ""}${countedLine}`}
            actions={live}
          />
        )}
      />
    </PageContainer>
  );
}
