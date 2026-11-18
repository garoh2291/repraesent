import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Network } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import type { AuthState } from "~/lib/hooks/use-auth";
import type { WorkspaceContext } from "~/lib/api/auth";
import {
  getAgencyStatus,
  requestAgency,
  withdrawAgencyRequest,
  errorCode,
  type AgencyStatusResponse,
} from "~/lib/api/agencies";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Textarea } from "~/components/ui/textarea";

/**
 * Settings → Your business → Manage several businesses (AGENCY_MODE_PLAN.md).
 * A business's own admins ask re:praesent to turn agency mode on; once on,
 * the agency's team sees how many businesses it may have.
 */
export default function AgencySettingsPage() {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const qc = useQueryClient();
  useDocumentMeta({
    titleKey: "settings.agency.metaTitle",
    descriptionKey: "settings.agency.metaDescription",
    titleSuffix: " - Repraesent",
  });
  const isAdmin = currentWorkspace?.member_role === "admin" && !currentWorkspace?.via_agency_id;
  const key = ["agency-status", currentWorkspace?.id] as const;
  const status = useQuery({ queryKey: key, queryFn: getAgencyStatus, enabled: !!currentWorkspace?.id });
  const [note, setNote] = useState("");

  // Keep the workspace switcher in step without reloading the whole context
  // (a full reload would show the app-wide loading screen).
  const onDone = (data: AgencyStatusResponse) => {
    qc.setQueryData(key, data);
    const wsId = currentWorkspace?.id;
    qc.setQueryData<AuthState>(["auth"], (prev) => {
      if (!prev || !wsId) return prev;
      const patch = (w: WorkspaceContext): WorkspaceContext => {
        if (w.id !== wsId) return w;
        const { agency: _old, ...rest } = w;
        return data.agency
          ? {
              ...rest,
              agency: {
                status: data.agency.status,
                child_limit: data.agency.child_limit,
                child_count: data.agency.child_count,
              },
            }
          : rest;
      };
      return {
        ...prev,
        workspaces: prev.workspaces.map(patch),
        currentWorkspace: prev.currentWorkspace ? patch(prev.currentWorkspace) : prev.currentWorkspace,
      };
    });
  };
  const onFail = (err: unknown) => {
    const c = errorCode(err);
    toast.error(
      c?.startsWith("AGENCY_INELIGIBLE") || c === "AGENCY_OWN_ADMIN_ONLY"
        ? t("agency.settings.errors.notPossible")
        : c === "AGENCY_ALREADY"
          ? t("agency.settings.errors.already")
          : t("agency.settings.errors.generic"),
    );
  };
  const ask = useMutation({
    mutationFn: () => requestAgency(note.trim() || null),
    onSuccess: (d) => {
      onDone(d);
      setNote("");
      toast.success(t("agency.settings.toast.asked"));
    },
    onError: onFail,
  });
  const withdraw = useMutation({
    mutationFn: withdrawAgencyRequest,
    onSuccess: (d) => {
      onDone(d);
      toast.success(t("agency.settings.toast.withdrawn"));
    },
    onError: onFail,
  });

  if (!currentWorkspace) return null;
  if (status.isLoading) return <Skeleton className="h-48 w-full rounded-2xl" />;
  const data = status.data;
  if (!data?.available) {
    return <Note>{t("agency.settings.notAvailable")}</Note>;
  }
  const a = data.agency;

  // Agency mode is on (or paused): how many businesses, and the limit.
  if (a && (a.status === "active" || a.status === "suspended")) {
    const full = a.child_limit != null && a.child_count >= a.child_limit;
    return (
      <Card>
        <Heading>
          {a.status === "active" ? t("agency.settings.on.title") : t("agency.settings.paused.title")}
        </Heading>
        {a.status === "suspended" ? (
          <p className="text-sm text-muted-foreground">{t("agency.settings.paused.body")}</p>
        ) : null}
        <div className="space-y-2">
          <p className="text-[15px] text-foreground">
            <span className="text-3xl font-semibold tabular-nums">{a.child_count}</span>{" "}
            {a.child_limit == null
              ? t("agency.settings.on.countUnlimited", { count: a.child_count })
              : t("agency.settings.on.countOfLimit", { count: a.child_count, limit: a.child_limit })}
          </p>
          {a.child_limit != null ? (
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={a.child_limit}
              aria-valuenow={a.child_count}
              aria-label={t("agency.settings.on.meterLabel")}
            >
              <div
                className="h-full rounded-full bg-foreground"
                style={{ width: `${Math.min(100, (a.child_count / a.child_limit) * 100)}%` }}
              />
            </div>
          ) : null}
        </div>
        {full ? (
          <p className="rounded-xl border border-secondary bg-secondary/30 px-3 py-2 text-sm text-foreground">
            {t("agency.settings.on.full")}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">{t("agency.settings.on.how")}</p>
      </Card>
    );
  }

  // A request is waiting for re:praesent.
  if (a?.status === "requested") {
    return (
      <Card>
        <Heading>{t("agency.settings.requested.title")}</Heading>
        <p className="text-sm text-muted-foreground">{t("agency.settings.requested.body")}</p>
        {a.request_note ? (
          <p className="rounded-r-xl border-l-2 border-foreground/30 bg-muted/50 px-3 py-2 text-sm italic text-foreground">{a.request_note}</p>
        ) : null}
        {isAdmin ? (
          <div>
            <Button variant="outline" onClick={() => withdraw.mutate()} disabled={withdraw.isPending}>
              {t("agency.settings.requested.withdraw")}
            </Button>
          </div>
        ) : null}
      </Card>
    );
  }

  // Not possible here (under an agency, root, demo, brand-linked).
  if (!data.eligible) {
    return <Note>{t(`agency.settings.ineligible.${data.reason ?? "deleted"}`)}</Note>;
  }

  // Ask (first time, after a "no", or after agency mode ended).
  return (
    <Card>
      <Heading>{t("agency.settings.ask.title")}</Heading>
      <p className="text-sm text-muted-foreground">{t("agency.settings.ask.body")}</p>
      <ul className="space-y-1.5 text-sm text-foreground">
        {(["one", "two", "three"] as const).map((k) => (
          <li key={k} className="flex gap-2">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground" />
            <span>{t(`agency.settings.ask.points.${k}`)}</span>
          </li>
        ))}
      </ul>
      {a?.status === "rejected" ? (
        <p className="rounded-xl bg-muted/50 px-3 py-2 text-sm text-foreground">
          {t("agency.settings.ask.rejected")}
          {a.decision_note ? ` ${a.decision_note}` : ""}
        </p>
      ) : null}
      {isAdmin ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            ask.mutate();
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">{t("agency.settings.ask.noteLabel")}</span>
            <Textarea
              value={note}
              maxLength={1000}
              rows={3}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("agency.settings.ask.notePlaceholder")}
            />
          </label>
          <Button type="submit" disabled={ask.isPending}>
            {t("agency.settings.ask.submit")}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">{t("agency.settings.ask.adminsOnly")}</p>
      )}
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="max-w-xl space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6">{children}</section>;
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
      <Network className="size-5 shrink-0" aria-hidden />
      {children}
    </h2>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="max-w-xl rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{children}</p>;
}
