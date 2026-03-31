import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { ChevronDown, LineChart, AlertCircle } from "lucide-react";
import {
  getBrandAnalyticsWorkspaces,
  type BrandAnalyticsWorkspace,
} from "~/lib/api/brand";
import { cn } from "~/lib/utils";
import i18n from "~/i18n";

export function meta() {
  return [
    { title: i18n.t("brand.analyticsTitle", "Analytics") + " – Repraesent" },
  ];
}

const PLAUSIBLE_SCRIPT = "https://plausible0.gagadomains.com/js/embed.host.js";

export default function BrandAnalytics() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ["brand-analytics-workspaces"],
    queryFn: getBrandAnalyticsWorkspaces,
    staleTime: 5 * 60_000,
  });

  // Auto-select from ?workspace= query param, or first available
  useEffect(() => {
    if (workspaces.length > 0 && !initializedRef.current) {
      initializedRef.current = true;
      const wsParam = searchParams.get("workspace");
      if (wsParam) {
        const match = workspaces.find((w) => w.id === wsParam && w.has_analytics);
        if (match) {
          setSelectedId(match.id);
          return;
        }
      }
      const first = workspaces.find((w) => w.has_analytics);
      if (first) {
        setSelectedId(first.id);
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set("workspace", first.id);
          return next;
        }, { replace: true });
      }
    }
  }, [workspaces, searchParams, setSearchParams]);

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Inject Plausible embed script once
  useEffect(() => {
    if (document.querySelector(`script[src="${PLAUSIBLE_SCRIPT}"]`)) return;
    const script = document.createElement("script");
    script.src = PLAUSIBLE_SCRIPT;
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.querySelector(`script[src="${PLAUSIBLE_SCRIPT}"]`)?.remove();
    };
  }, []);

  // Mark iframe for Plausible whenever it remounts
  useEffect(() => {
    iframeRef.current?.setAttribute("plausible-embed", "");
  }, [selectedId]);

  const selected = workspaces.find((w) => w.id === selectedId) ?? null;

  const handleSelect = (ws: BrandAnalyticsWorkspace) => {
    if (!ws.has_analytics) return;
    if (ws.id !== selectedId) {
      setSelectedId(ws.id);
      setIsIframeLoading(true);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("workspace", ws.id);
        return next;
      }, { replace: true });
    }
    setDropdownOpen(false);
  };

  const embedSrc = selected?.shared_link
    ? `${selected.shared_link}&embed=true&theme=light&background=%23f5f4f1`
    : null;

  const connectedCount = workspaces.filter((w) => w.has_analytics).length;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="mx-auto w-full max-w-[1280px] shrink-0 px-4  sm:px-6 pt-10! pb-5 ">
        {/* Workspace picker as title */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            disabled={isLoading || workspaces.length === 0}
            className={cn(
              "group flex items-center gap-1.5 -mx-1.5 px-1.5 py-1 rounded-lg text-left",
              "hover:bg-muted/60 transition-colors duration-150",
              "disabled:opacity-50 disabled:pointer-events-none"
            )}
          >
            <h1 className="text-xl font-semibold text-foreground tracking-tight truncate max-w-[480px]">
              {isLoading
                ? t("common.loading")
                : selected
                  ? selected.name
                  : t("brand.analyticsTitle")}
            </h1>
            <ChevronDown
              className={cn(
                "h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-200 mt-0.5",
                "group-hover:text-foreground",
                dropdownOpen && "rotate-180"
              )}
            />
          </button>

          <p className="text-xs text-muted-foreground mt-0.5 px-1.5">
            {selected
              ? t("brand.analyticsViewingSubtitle")
              : isLoading
                ? t("common.loading")
                : `${connectedCount} / ${workspaces.length} connected`}
          </p>

          {dropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 z-50 min-w-[280px] rounded-xl border border-border bg-card shadow-xl overflow-hidden">
              {connectedCount > 0 && (
                <div className="px-3 pt-2.5 pb-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Connected
                  </span>
                </div>
              )}
              <div className="max-h-64 overflow-y-auto">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => handleSelect(ws)}
                    disabled={!ws.has_analytics}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm text-left transition-colors",
                      ws.id === selectedId
                        ? "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300"
                        : ws.has_analytics
                          ? "text-foreground hover:bg-muted"
                          : "text-muted-foreground/50 cursor-not-allowed"
                    )}
                  >
                    <span className="truncate font-medium">{ws.name}</span>
                    <span className="shrink-0 flex items-center gap-1.5">
                      {ws.id === selectedId && (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      )}
                      {!ws.has_analytics && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40 bg-muted rounded px-1.5 py-0.5">
                          {t("brand.analyticsNotConnected")}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="flex-1 relative overflow-hidden">
        {/* Global loading */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <p className="text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          </div>
        )}

        {/* No selection yet */}
        {!isLoading && !selected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-6">
            <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center">
              <LineChart className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {t("brand.analyticsSelectPrompt")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("brand.analyticsSelectHint")}
              </p>
            </div>
          </div>
        )}

        {/* Selected but no shared_link */}
        {!isLoading && selected && !embedSrc && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-6">
            <AlertCircle className="h-10 w-10 text-muted-foreground/30" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {t("brand.analyticsNotConfigured")}
              </p>
              <p className="text-xs text-muted-foreground">{selected.name}</p>
            </div>
          </div>
        )}

        {/* Iframe */}
        {embedSrc && (
          <div className="w-full h-full overflow-auto">
            {isIframeLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background z-10">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
                <p className="text-sm text-muted-foreground">
                  {t("brand.analyticsLoading")}
                </p>
              </div>
            )}
            <iframe
              key={selectedId}
              ref={iframeRef}
              src={embedSrc}
              scrolling="no"
              frameBorder="0"
              loading="lazy"
              style={{
                width: "1px",
                minWidth: "100%",
                height: "1600px",
                opacity: isIframeLoading ? 0 : 1,
                transition: "opacity 0.3s ease",
              }}
              title={selected?.name ?? "Analytics"}
              onLoad={() => setIsIframeLoading(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
