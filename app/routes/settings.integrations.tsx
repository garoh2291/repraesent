import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  Link2Off,
  Plug,
  TriangleAlert,
  X,
} from "lucide-react";
import i18n from "~/i18n";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  disconnectIntegration,
  getIntegrationAuthorizeUrl,
  type WorkspaceIntegration,
} from "~/lib/api/integrations";
import { useWorkspaceIntegrations } from "~/lib/hooks/useWorkspaceIntegrations";
import { useCanManageIntegrations } from "~/lib/hooks/useCanManageIntegrations";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
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

export function meta() {
  return [
    { title: `${i18n.t("settings.integrations.metaTitle")} - Repraesent` },
    {
      name: "description",
      content: i18n.t("settings.integrations.metaDescription"),
    },
  ];
}

/** Matches the eyebrow used by every other settings page. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </h2>
  );
}

function SettingsSection({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
        <SectionLabel>{label}</SectionLabel>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

type Outcome = "connected" | "denied" | "expired" | "error" | "failed";
const OUTCOMES: Outcome[] = [
  "connected",
  "denied",
  "expired",
  "error",
  "failed",
];

export default function SettingsIntegrations() {
  const { t } = useTranslation();
  useDocumentMeta({
    titleKey: "settings.integrations.metaTitle",
    descriptionKey: "settings.integrations.metaDescription",
    titleSuffix: " - Repraesent",
  });

  const queryClient = useQueryClient();
  const canManage = useCanManageIntegrations();
  const { data: integrations, isPending } = useWorkspaceIntegrations();

  const [startingKey, setStartingKey] = useState<string | null>(null);
  const [pendingDisconnect, setPendingDisconnect] =
    useState<WorkspaceIntegration | null>(null);
  const [result, setResult] = useState<{
    outcome: Outcome;
    account?: string;
    reason?: string;
  } | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["workspace-integrations"] });

  // The provider sends the user back to this page with the result in the query
  // string, because the callback is a plain browser redirect with nowhere else
  // to put it. Read it once into state, then strip it from the address bar so a
  // refresh doesn't resurrect a stale "connected!" the user has moved past.
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("stripe");
    if (!raw) return;

    const outcome = (OUTCOMES as string[]).includes(raw)
      ? (raw as Outcome)
      : "error";

    setResult({
      outcome,
      account: params.get("account") ?? undefined,
      reason: params.get("reason") ?? undefined,
    });

    if (outcome === "connected") {
      // The connection was written server-side, so every cached view of it —
      // this list and the catalogue behind it — is stale.
      void invalidate();
      void queryClient.invalidateQueries({ queryKey: ["stripe-account"] });
      void queryClient.invalidateQueries({ queryKey: ["stripe-products"] });
    }

    const url = new URL(window.location.href);
    for (const key of ["stripe", "account", "reason"]) {
      url.searchParams.delete(key);
    }
    window.history.replaceState(window.history.state, "", url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  async function handleConnect(app: WorkspaceIntegration) {
    setStartingKey(app.key);
    try {
      // Full-page navigation, not a popup: the consent screen is a multi-step
      // flow the provider may re-host on its own domains.
      window.location.href = await getIntegrationAuthorizeUrl(app.key);
    } catch (error) {
      toast.error(extractErrorMessage(error));
      setStartingKey(null);
    }
  }

  const disconnectMutation = useMutation({
    mutationFn: (key: string) => disconnectIntegration(key),
    onSuccess: async () => {
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ["stripe-account"] });
      await queryClient.invalidateQueries({ queryKey: ["stripe-products"] });
      setPendingDisconnect(null);
      toast.success(
        t("settings.integrations.disconnected", {
          defaultValue: "Account disconnected",
        }),
      );
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error));
    },
  });

  return (
    <div className="space-y-6 sm:space-y-8 app-fade-up app-fade-up-d2">
      {result ? (
        <OutcomeBanner result={result} onDismiss={() => setResult(null)} />
      ) : null}

      <SettingsSection
        label={t("settings.integrations.sectionLabel", {
          defaultValue: "Connected apps",
        })}
        description={t("settings.integrations.sectionDescription", {
          defaultValue:
            "Connect a third-party account to this workspace. One account per app.",
        })}
      >
        {isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-[104px] w-full rounded-2xl" />
            <Skeleton className="h-[104px] w-full rounded-2xl" />
          </div>
        ) : !integrations?.length ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <Plug className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              {t("settings.integrations.empty", {
                defaultValue: "No integrations are available yet.",
              })}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {integrations.map((app) => (
              <IntegrationCard
                key={app.app_id}
                app={app}
                canManage={canManage}
                isStarting={startingKey === app.key}
                onConnect={() => handleConnect(app)}
                onDisconnect={() => setPendingDisconnect(app)}
              />
            ))}
          </div>
        )}
      </SettingsSection>

      <AlertDialog
        open={!!pendingDisconnect}
        onOpenChange={(open) => !open && setPendingDisconnect(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.integrations.disconnectTitle", {
                defaultValue: "Disconnect account?",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.integrations.disconnectBody", {
                defaultValue:
                  "Your products will stay in {{name}} — this workspace just loses access to them. Products already attached to deals keep their saved name and price. You can reconnect at any time.",
                name: pendingDisconnect?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnectMutation.isPending}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={disconnectMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (pendingDisconnect) {
                  disconnectMutation.mutate(pendingDisconnect.key);
                }
              }}
            >
              {disconnectMutation.isPending
                ? t("common.loading", { defaultValue: "Loading…" })
                : t("settings.integrations.disconnect", {
                    defaultValue: "Disconnect",
                  })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function IntegrationCard({
  app,
  canManage,
  isStarting,
  onConnect,
  onDisconnect,
}: {
  app: WorkspaceIntegration;
  canManage: boolean;
  isStarting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const { t } = useTranslation();
  const needsReconnect = !!app.auth_failed_at || app.status === "revoked";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-background">
            {app.logo_url ? (
              <img
                src={app.logo_url}
                alt=""
                className="h-7 w-7 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.visibility = "hidden";
                }}
              />
            ) : (
              <Plug className="h-5 w-5 text-muted-foreground" />
            )}
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {app.name}
              </h3>
              {app.connected ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  {t("settings.integrations.connected", {
                    defaultValue: "Connected",
                  })}
                </span>
              ) : null}
              {app.connected && app.livemode === false ? (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  {t("settings.integrations.testMode", {
                    defaultValue: "Test mode",
                  })}
                </span>
              ) : null}
              {needsReconnect ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                  <TriangleAlert className="h-3 w-3" />
                  {t("settings.integrations.needsReconnect", {
                    defaultValue: "Reconnect needed",
                  })}
                </span>
              ) : null}
            </div>

            {app.description ? (
              <p className="text-sm text-muted-foreground">{app.description}</p>
            ) : null}

            {app.connected ? (
              <p className="truncate text-xs text-muted-foreground">
                {[
                  app.account_name,
                  app.account_email,
                  app.external_account_id,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}

            {!app.configured ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t("settings.integrations.notConfigured", {
                  defaultValue:
                    "This integration is not fully set up yet. Contact support.",
                })}
              </p>
            ) : null}
          </div>
        </div>

        <div className="sm:shrink-0">
          {app.connected ? (
            <Button
              variant="outline"
              size="sm"
              disabled={!canManage}
              onClick={onDisconnect}
            >
              <Link2Off className="mr-1.5 h-4 w-4" />
              {t("settings.integrations.disconnect", {
                defaultValue: "Disconnect",
              })}
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={!canManage || !app.configured || isStarting}
              onClick={onConnect}
            >
              {isStarting
                ? t("common.loading", { defaultValue: "Loading…" })
                : t("settings.integrations.connect", {
                    defaultValue: "Connect",
                  })}
            </Button>
          )}
        </div>
      </div>

      {!canManage ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("settings.integrations.adminOnly", {
            defaultValue: "Only workspace admins can change this.",
          })}
        </p>
      ) : null}
    </div>
  );
}

function OutcomeBanner({
  result,
  onDismiss,
}: {
  result: { outcome: Outcome; account?: string; reason?: string };
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const ok = result.outcome === "connected";

  const message = ok
    ? t("settings.integrations.outcome.connected", {
        defaultValue: "Connected {{account}}.",
        account: result.account ?? "",
      })
    : result.outcome === "denied"
      ? t("settings.integrations.outcome.denied", {
          defaultValue: "You cancelled the connection.",
        })
      : result.outcome === "expired"
        ? t("settings.integrations.outcome.expired", {
            defaultValue: "That link expired. Please try connecting again.",
          })
        : t("settings.integrations.outcome.failed", {
            defaultValue: "Connection failed{{reason}}",
            reason: result.reason ? `: ${result.reason}` : ".",
          });

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${
        ok
          ? "border-emerald-500/30 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300"
          : "border-destructive/30 bg-destructive/8 text-destructive"
      }`}
    >
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <p className="flex-1">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 opacity-60 transition hover:opacity-100"
        aria-label={t("common.close", { defaultValue: "Close" })}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
