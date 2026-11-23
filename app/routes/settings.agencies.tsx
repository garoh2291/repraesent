import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRight, Loader2, Search } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { useDebounce } from "~/lib/hooks/useDebounce";
import {
  approveAgency,
  attachToAgency,
  detachFromAgency,
  endAgency,
  errorCode,
  getAgency,
  listAgencies,
  rejectAgency,
  resumeAgency,
  rootAgencyKeys,
  searchAttachCandidates,
  setAgencyLimit,
  suspendAgency,
  type RootAgencyDetail,
  type RootAgencyRow,
} from "~/lib/api/agencies";
import type { AgencyStatus } from "~/lib/api/auth";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { Textarea } from "~/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { cn } from "~/lib/utils";

type Tab = "waiting" | "active" | "paused" | "earlier";
const TAB_STATUSES: Record<Tab, AgencyStatus[]> = {
  waiting: ["requested"],
  active: ["active"],
  paused: ["suspended"],
  earlier: ["rejected", "ended"],
};
/** Presets the owner asked for; any other whole number works too. */
const PRESETS = [5, 10, 30, 100] as const;

/**
 * Root Settings → re:praesent → Agencies (AGENCY_MODE_PLAN.md §2): requests
 * to decide, business limits, pause / end, and attaching existing workspaces.
 */
export default function AgenciesSettingsPage() {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const allowed = currentWorkspace?.is_root === true && currentWorkspace.member_role === "admin";
  useDocumentMeta({
    titleKey: "settings.agencies.metaTitle",
    descriptionKey: "settings.agencies.metaDescription",
    titleSuffix: " - Repraesent",
  });
  const list = useQuery({ queryKey: rootAgencyKeys.all, queryFn: listAgencies, enabled: allowed });
  const [tab, setTab] = useState<Tab>("waiting");
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = list.data ?? [];
  const counts = Object.fromEntries(
    (Object.keys(TAB_STATUSES) as Tab[]).map((k) => [k, rows.filter((r) => TAB_STATUSES[k].includes(r.status)).length]),
  ) as Record<Tab, number>;
  // Land on the first tab with something in it.
  useEffect(() => {
    if (!list.data) return;
    if (counts[tab] === 0) {
      const first = (Object.keys(TAB_STATUSES) as Tab[]).find((k) => counts[k] > 0);
      if (first) setTab(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.data]);

  if (!currentWorkspace) return null;
  if (!allowed) return <Navigate to="/settings/profile" replace />;

  const shown = rows.filter((r) => TAB_STATUSES[tab].includes(r.status));

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label={t("agency.root.tabsLabel")}
        className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border border-border bg-muted/40 p-1"
      >
        {(Object.keys(TAB_STATUSES) as Tab[]).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn(
              "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
              tab === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`agency.root.tabs.${k}`)}
            {counts[k] > 0 ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] tabular-nums",
                  k === "waiting" ? "bg-secondary text-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {counts[k]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          {t(`agency.root.empty.${tab}`)}
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {shown.map((r) => (
            <li key={r.workspace_id}>
              <button
                type="button"
                onClick={() => setOpenId(r.workspace_id)}
                className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{r.name}</span>
                  <span className="block truncate text-[12.5px] text-muted-foreground">{rowHint(r, t)}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <AgencyDialog id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function rowHint(r: RootAgencyRow, t: (k: string, o?: Record<string, unknown>) => string): string {
  const date = new Date(r.requested_at).toLocaleDateString();
  if (r.status === "requested") {
    return r.requested_by_name
      ? t("agency.root.row.askedBy", { name: r.requested_by_name, date })
      : t("agency.root.row.asked", { date });
  }
  if (r.status === "active" || r.status === "suspended") {
    return r.child_limit == null
      ? t("agency.picker.agencyUnlimited", { count: r.child_count })
      : t("agency.picker.agencyOfLimit", { count: r.child_count, limit: r.child_limit });
  }
  return t(`agency.root.status.${r.status}`);
}

function LimitPicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const { t } = useTranslation();
  const isPreset = value == null || (PRESETS as readonly number[]).includes(value);
  const [custom, setCustom] = useState(isPreset ? "" : String(value));
  const chip = (active: boolean) =>
    cn(
      "inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors",
      active ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:bg-muted",
    );
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">{t("agency.root.limit.label")}</legend>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((n) => (
          <button key={n} type="button" className={chip(value === n)} aria-pressed={value === n} onClick={() => { setCustom(""); onChange(n); }}>
            {n}
          </button>
        ))}
        <button type="button" className={chip(value == null)} aria-pressed={value == null} onClick={() => { setCustom(""); onChange(null); }}>
          {t("agency.root.limit.unlimited")}
        </button>
        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          {t("agency.root.limit.other")}
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={10000}
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 1 && n <= 10000) onChange(n);
            }}
            className="h-10 w-24"
          />
        </label>
      </div>
    </fieldset>
  );
}

function AgencyDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: rootAgencyKeys.detail(id ?? ""), queryFn: () => getAgency(id!), enabled: !!id });
  const [limit, setLimit] = useState<number | null>(10);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState<null | { kind: "end" } | { kind: "detach"; childId: string; name: string }>(null);

  useEffect(() => {
    if (detail.data) {
      const d = detail.data;
      setLimit(d.status === "requested" || d.status === "rejected" ? 10 : d.child_limit);
      setNote("");
    }
  }, [detail.data?.workspace_id, detail.data?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = (d: RootAgencyDetail, msg: string) => {
    qc.setQueryData(rootAgencyKeys.detail(d.workspace_id), d);
    // The list, and any open "add a business" search (its "Add" buttons change).
    void qc.invalidateQueries({ queryKey: rootAgencyKeys.all, exact: true });
    void qc.invalidateQueries({ queryKey: ["root-agencies", "candidates"] });
    toast.success(msg);
  };
  const fail = (err: unknown) => {
    const c = errorCode(err);
    toast.error(
      c === "AGENCY_ALREADY_MANAGED"
        ? t("agency.root.errors.alreadyManaged")
        : c === "AGENCY_ONE_LEVEL"
          ? t("agency.root.errors.oneLevel")
          : c === "AGENCY_CHILD_INELIGIBLE"
            ? t("agency.root.errors.childIneligible")
            : c?.startsWith("AGENCY_INELIGIBLE")
              ? t("agency.root.errors.ineligible")
              : t("agency.root.errors.generic"),
    );
  };
  const m = useMutation({
    mutationFn: async (action: { kind: string; childId?: string }): Promise<[RootAgencyDetail, string]> => {
      const aid = id!;
      switch (action.kind) {
        case "approve":
          return [await approveAgency(aid, limit, note.trim() || undefined), t("agency.root.toast.approved")];
        case "reject":
          return [await rejectAgency(aid, note.trim() || undefined), t("agency.root.toast.rejected")];
        case "limit":
          return [await setAgencyLimit(aid, limit), t("agency.root.toast.limit")];
        case "suspend":
          return [await suspendAgency(aid), t("agency.root.toast.suspended")];
        case "resume":
          return [await resumeAgency(aid), t("agency.root.toast.resumed")];
        case "end":
          return [await endAgency(aid), t("agency.root.toast.ended")];
        case "attach": {
          const d = await attachToAgency(aid, action.childId!);
          return [d, d.over_limit ? t("agency.root.toast.attachedOver") : t("agency.root.toast.attached")];
        }
        case "detach":
          return [await detachFromAgency(aid, action.childId!), t("agency.root.toast.detached")];
        default:
          throw new Error("unknown action");
      }
    },
    onSuccess: ([d, msg]) => done(d, msg),
    onError: fail,
  });

  const d = detail.data;
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6 text-left">
          <DialogTitle className="pr-8">{d?.name ?? "…"}</DialogTitle>
          <DialogDescription>{d ? t(`agency.root.status.${d.status}`) : " "}</DialogDescription>
        </DialogHeader>
        {!d ? (
          <div className="p-6">
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="min-h-0 space-y-6 overflow-y-auto overscroll-contain px-6 py-5">
            {d.request_note ? (
              <p className="rounded-r-xl border-l-2 border-foreground/30 bg-muted/50 px-3 py-2 text-sm italic text-foreground">{d.request_note}</p>
            ) : null}

            {d.status === "requested" || d.status === "rejected" ? (
              <section className="space-y-4">
                <LimitPicker value={limit} onChange={setLimit} />
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-foreground">{t("agency.root.noteLabel")}</span>
                  <Textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => m.mutate({ kind: "approve" })} disabled={m.isPending}>
                    {t("agency.root.actions.approve")}
                  </Button>
                  {d.status === "requested" ? (
                    <Button variant="outline" onClick={() => m.mutate({ kind: "reject" })} disabled={m.isPending}>
                      {t("agency.root.actions.reject")}
                    </Button>
                  ) : null}
                </div>
              </section>
            ) : null}

            {d.status === "active" || d.status === "suspended" ? (
              <>
                <section className="space-y-3">
                  <LimitPicker value={limit} onChange={setLimit} />
                  <Button
                    variant="outline"
                    onClick={() => m.mutate({ kind: "limit" })}
                    disabled={m.isPending || limit === d.child_limit}
                  >
                    {t("agency.root.actions.saveLimit")}
                  </Button>
                </section>
                <ChildrenSection
                  detail={d}
                  pendingChildId={
                    m.isPending && (m.variables?.kind === "attach" || m.variables?.kind === "detach")
                      ? (m.variables.childId ?? null)
                      : null
                  }
                  onAttach={(childId) => m.mutate({ kind: "attach", childId })}
                  onDetach={(childId, name) => setConfirm({ kind: "detach", childId, name })}
                />
                <section className="flex flex-wrap gap-2 border-t border-border pt-4">
                  {d.status === "active" ? (
                    <Button variant="outline" onClick={() => m.mutate({ kind: "suspend" })} disabled={m.isPending}>
                      {t("agency.root.actions.suspend")}
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => m.mutate({ kind: "resume" })} disabled={m.isPending}>
                      {t("agency.root.actions.resume")}
                    </Button>
                  )}
                  <Button variant="ghost" className="text-overdue" onClick={() => setConfirm({ kind: "end" })} disabled={m.isPending}>
                    {t("agency.root.actions.end")}
                  </Button>
                </section>
              </>
            ) : null}
          </div>
        )}
      </DialogContent>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "end"
                ? t("agency.root.confirm.endTitle", { agency: d?.name ?? "" })
                : t("agency.root.confirm.detachTitle", { business: confirm?.kind === "detach" ? confirm.name : "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "end" ? t("agency.root.confirm.endBody") : t("agency.root.confirm.detachBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm?.kind === "end") m.mutate({ kind: "end" });
                if (confirm?.kind === "detach") m.mutate({ kind: "detach", childId: confirm.childId });
                setConfirm(null);
              }}
            >
              {confirm?.kind === "end" ? t("agency.root.actions.end") : t("agency.root.actions.detach")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function ChildrenSection({
  detail,
  pendingChildId,
  onAttach,
  onDetach,
}: {
  detail: RootAgencyDetail;
  /** The one business being attached / detached right now: only its button waits. */
  pendingChildId: string | null;
  onAttach: (id: string) => void;
  onDetach: (id: string, name: string) => void;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const debounced = useDebounce(q, 250);
  const found = useQuery({
    queryKey: rootAgencyKeys.candidates(debounced.trim()),
    queryFn: () => searchAttachCandidates(debounced.trim()),
    enabled: debounced.trim().length >= 2,
  });
  const over = detail.child_limit != null && detail.child_count > detail.child_limit;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">
        {detail.child_limit == null
          ? t("agency.picker.agencyUnlimited", { count: detail.child_count })
          : t("agency.picker.agencyOfLimit", { count: detail.child_count, limit: detail.child_limit })}
      </h3>
      {over ? (
        <p className="rounded-xl border border-secondary bg-secondary/30 px-3 py-2 text-sm">{t("agency.root.overLimit")}</p>
      ) : null}
      {detail.children.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {detail.children.map((c) => (
            <li key={c.id} className="flex min-h-12 items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{c.name}</span>
                <span className="block truncate text-[12px] text-muted-foreground">
                  {t(`agency.root.origin.${c.origin}`)} · {t(`agency.root.website.${c.website_state}`)}
                </span>
              </span>
              <Button variant="ghost" size="sm" disabled={pendingChildId === c.id} onClick={() => onDetach(c.id, c.name)}>
                {pendingChildId === c.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {t("agency.root.actions.detach")}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("agency.root.noChildren")}</p>
      )}

      <div className="space-y-2">
        <label className="relative block">
          <span className="sr-only">{t("agency.root.attachSearch")}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("agency.root.attachSearch")}
            className="h-10 pl-9"
          />
        </label>
        {found.data && found.data.length > 0 ? (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {found.data.map((c) => (
              <li key={c.id} className="flex min-h-12 items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  {c.blocked ? (
                    <span className="block truncate text-[12px] text-muted-foreground">
                      {c.blocked === "managed" && c.managed_by
                        ? t("agency.picker.managedBy", { agency: c.managed_by })
                        : t(`agency.root.blocked.${c.blocked}`)}
                    </span>
                  ) : null}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!c.blocked || pendingChildId === c.id}
                  aria-busy={pendingChildId === c.id}
                  onClick={() => onAttach(c.id)}
                >
                  {pendingChildId === c.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  {t("agency.root.actions.attach")}
                </Button>
              </li>
            ))}
          </ul>
        ) : found.data && debounced.trim().length >= 2 ? (
          <p className="text-sm text-muted-foreground">{t("agency.picker.noMatch")}</p>
        ) : null}
      </div>
    </section>
  );
}
