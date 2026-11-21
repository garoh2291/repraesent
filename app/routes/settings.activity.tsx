import { useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router";
import { WorkspaceFilter } from "~/components/audit/workspace-filter";
import { resolveStageLabelByKey } from "~/lib/pipeline-stages/labels";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import {
  AUDIT_AREAS,
  auditKeys,
  getAudit,
  getAuditScope,
  type AuditFilters,
  type AuditRow,
} from "~/lib/api/audit";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";

const PERIODS = { "7d": 7, "30d": 30, "90d": 90, "12m": 365 } as const;
type Period = keyof typeof PERIODS;

/**
 * Settings → Activity log (AGENCY_MODE_PLAN.md §5): who changed what, and
 * when. Admins only. An agency's admins can look at one of their businesses
 * or all of them; re:praesent admins at any workspace.
 */
export default function ActivitySettingsPage() {
  const { t, i18n } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  useDocumentMeta({ titleKey: "settings.activity.metaTitle", descriptionKey: "settings.activity.metaDescription", titleSuffix: " - Repraesent" });
  const isAdmin = currentWorkspace?.member_role === "admin";
  const wsId = currentWorkspace?.id;

  // Every filter lives in the URL: refresh, Back and a shared link keep it.
  const [params, setParams] = useSearchParams();
  const UUID = /^[0-9a-f-]{36}$/i;
  // Not "ws": that is the app-wide deep-link switch (use-workspace-from-param), which removes it.
  const target = UUID.test(params.get("business") ?? "") ? params.get("business")! : "";
  const actor = UUID.test(params.get("person") ?? "") ? params.get("person")! : "";
  const area = (AUDIT_AREAS as readonly string[]).includes(params.get("area") ?? "") ? params.get("area")! : "";
  const period: Period = (params.get("period") ?? "") in PERIODS ? (params.get("period") as Period) : "30d";
  const setParam = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);

  const scope = useQuery({
    queryKey: auditKeys.scope(wsId, target || undefined),
    queryFn: () => getAuditScope(target || undefined),
    enabled: isAdmin,
    staleTime: 60_000,
  });
  // A person who isn't in the chosen business's people list: drop that filter.
  const people = scope.data?.people;
  useEffect(() => {
    if (actor && people && !people.some((p) => p.id === actor)) setParam({ person: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor, people]);

  const filters: AuditFilters = useMemo(
    () => ({
      workspace_id: target || undefined,
      actor: actor || undefined,
      area: area || undefined,
      from: new Date(Date.now() - PERIODS[period] * 86_400_000).toISOString(),
    }),
    // The "from" moment only needs to move when the period does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [target, actor, area, period],
  );
  const list = useInfiniteQuery({
    queryKey: auditKeys.list(wsId, filters),
    queryFn: ({ pageParam }) => getAudit(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: isAdmin,
  });

  if (!currentWorkspace) return null;
  if (!isAdmin) return <Navigate to="/settings/profile" replace />;

  const rows = list.data?.pages.flatMap((p) => p.data) ?? [];
  const showWorkspace = scope.data?.kind !== "workspace" && !target;
  const groups = groupByDay(rows, i18n.language);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        {scope.data?.kind === "agency" || scope.data?.kind === "all" ? (
          <Filter label={scope.data.kind === "agency" ? t("audit.filters.business") : t("audit.filters.workspace")}>
            <WorkspaceFilter
              value={target}
              valueName={target ? (picked?.id === target ? picked.name : (scope.data.target?.name ?? null)) : null}
              local={scope.data.kind === "agency" ? scope.data.workspaces : undefined}
              scopeKey={wsId}
              label={scope.data.kind === "agency" ? t("audit.filters.business") : t("audit.filters.workspace")}
              allLabel={scope.data.kind === "agency" ? t("audit.filters.allBusinesses") : t("audit.filters.everyone")}
              onChange={(id, name) => {
                setPicked(id && name ? { id, name } : null);
                setParam({ business: id || undefined });
              }}
            />
          </Filter>
        ) : null}
        <Filter label={t("audit.filters.person")}>
          <NativeSelect value={actor} onChange={(e) => setParam({ person: e.target.value || undefined })}>
            <NativeSelectOption value="">{t("audit.filters.anyone")}</NativeSelectOption>
            {(scope.data?.people ?? []).map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>{p.name || p.email || "—"}</NativeSelectOption>
            ))}
          </NativeSelect>
        </Filter>
        <Filter label={t("audit.filters.area")}>
          <NativeSelect value={area} onChange={(e) => setParam({ area: e.target.value || undefined })}>
            <NativeSelectOption value="">{t("audit.filters.everything")}</NativeSelectOption>
            {AUDIT_AREAS.map((a) => (
              <NativeSelectOption key={a} value={a}>{t(`audit.areas.${a}`)}</NativeSelectOption>
            ))}
          </NativeSelect>
        </Filter>
        <Filter label={t("audit.filters.period")}>
          <NativeSelect value={period} onChange={(e) => setParam({ period: e.target.value === "30d" ? undefined : e.target.value })}>
            {(Object.keys(PERIODS) as Period[]).map((p) => (
              <NativeSelectOption key={p} value={p}>{t(`audit.periods.${p}`)}</NativeSelectOption>
            ))}
          </NativeSelect>
        </Filter>
      </div>

      {list.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : list.isError ? (
        <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{t("audit.loadError")}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">{t("audit.empty")}</p>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.day}>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{g.label}</h3>
              <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {g.rows.map((r) => (
                  <Entry key={r.id} r={r} showWorkspace={showWorkspace} />
                ))}
              </ol>
            </section>
          ))}
          {list.hasNextPage ? (
            <div>
              <Button variant="outline" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>
                {t("audit.more")}
              </Button>
            </div>
          ) : (
            <p className="text-[12.5px] text-muted-foreground">{t("audit.kept")}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="block text-[12px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Entry({ r, showWorkspace }: { r: AuditRow; showWorkspace: boolean }) {
  const { t, i18n } = useTranslation();
  const time = new Date(r.occurred_at).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" });
  const diff = r.diff ? Object.entries(r.diff) : [];
  return (
    <li className="grid grid-cols-[3.25rem_1fr] gap-3 px-4 py-3">
      <time dateTime={r.occurred_at} className="pt-0.5 text-[12.5px] tabular-nums text-muted-foreground">{time}</time>
      <div className="min-w-0 space-y-1">
        <p className="text-[14px] leading-snug text-foreground">{sentence(r, t)}</p>
        {diff.length ? (
          <ul className="space-y-0.5 text-[12.5px] text-muted-foreground">
            {diff.map(([field, [from, to]]) => (
              <li key={field} className="flex flex-wrap items-center gap-1.5">
                <span>{t(`audit.fields.${field}`, { defaultValue: field })}:</span>
                <span className="line-through decoration-muted-foreground/60">{show(from, t, field, r.entity_type)}</span>
                <ArrowRight className="size-3" aria-label={t("audit.changedTo")} />
                <span className="font-medium text-foreground">{show(to, t, field, r.entity_type)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="flex flex-wrap gap-x-2 text-[12px] text-muted-foreground">
          {showWorkspace && r.workspace_name ? <span>{r.workspace_name}</span> : null}
          {r.via_agency_name ? <span>{t("audit.via", { agency: r.via_agency_name })}</span> : null}
          {r.status != null && r.status >= 400 ? <span className="text-overdue">{t("audit.didNotGoThrough")}</span> : null}
        </p>
      </div>
    </li>
  );
}

function show(v: unknown, t: TFunction, field?: string, entity?: string | null): string {
  if (v === null || v === undefined || v === "") return t("audit.empty_value");
  // Deal / inquiry stages: a stage nobody renamed is stored as its key
  // ("in_progress"); show it in the same words as the pipeline.
  const stageOf = field === "stage" && entity === "deal" ? "deal" : field === "status" && entity === "lead" ? "lead" : null;
  if (stageOf && typeof v === "string" && /^[a-z0-9_]+$/.test(v)) return resolveStageLabelByKey(stageOf, v, t);
  // Stored keys (task status, role) in the reader's words.
  if (typeof v === "string" && field && (field === "status" || field === "role")) {
    return t(`audit.values.${field}.${v}`, { defaultValue: v });
  }
  if (typeof v === "boolean") return v ? t("audit.yes") : t("audit.no");
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return new Date(v).toLocaleDateString();
  return String(v);
}

/** "Ada Agency updated the deal “Kitchen”" — in the reader's language. */
export function sentence(r: AuditRow, t: TFunction): string {
  const actor =
    r.actor_kind === "system"
      ? t("audit.actors.system")
      : r.actor_kind === "staff"
        ? t("audit.actors.staff")
        : r.actor_name || r.actor_email || t("audit.actors.someone");
  const label = r.entity_label ?? "";
  const p = r.params ?? {};
  const extra: Record<string, unknown> = {
    actor,
    label,
    emails: Array.isArray(p.emails) ? (p.emails as string[]).join(", ") : "",
    limit: p.child_limit == null ? t("audit.unlimited") : String(p.child_limit),
    method: p.method === "code" ? t("audit.signInCode") : t("audit.signInLink"),
    url: typeof p.url === "string" ? p.url.replace(/^https?:\/\//, "") : "",
    items: Array.isArray(p.items) ? (p.items as string[]).map((k) => t(`agency.businesses.kinds.${k}`)).join(", ") : "",
  };
  const key = `audit.actions.${r.action.replace(".", "_")}`;
  if (i18nHas(t, key)) return t(key, extra);
  const [area, verb] = r.action.split(".");
  return t(`audit.generic.${verb === "create" || verb === "delete" ? verb : "update"}`, {
    ...extra,
    area: t(`audit.areas.${area}`, { defaultValue: area }),
  });
}

function i18nHas(t: TFunction, key: string): boolean {
  return t(key, { defaultValue: "\u0000" }) !== "\u0000";
}

function groupByDay(rows: AuditRow[], lang: string) {
  const out: Array<{ day: string; label: string; rows: AuditRow[] }> = [];
  for (const r of rows) {
    const d = new Date(r.occurred_at);
    const day = d.toDateString();
    let g = out[out.length - 1];
    if (!g || g.day !== day) {
      g = { day, label: d.toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" }), rows: [] };
      out.push(g);
    }
    g.rows.push(r);
  }
  return out;
}

