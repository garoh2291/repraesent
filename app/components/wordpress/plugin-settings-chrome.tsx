import type { ReactNode } from "react";
import { ChevronLeft, Power } from "lucide-react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { PageShell } from "~/components/wordpress/fields";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { Switch } from "~/components/ui/switch";
import { cn } from "~/lib/utils";
import {
  useWorkspacePluginActivation,
  useWorkspaceWpPluginInstalls,
} from "~/lib/hooks/useWorkspaceWpPluginInstalls";

/**
 * Chrome shared by the ported WordPress plugin admin screens. Kept separate
 * from any one plugin so each settings page can reuse it.
 *
 * This used to also export PluginSettingsFormError / PluginSettingsFormSuccess.
 * They were never imported anywhere, and they were styled with var(--danger),
 * var(--success-soft) etc. — custom properties that only existed inside a
 * `.wpm-plugin-settings-root` class that was itself never applied, so they would
 * have rendered with no background and no colour had anyone used them. Use the
 * app's own `~/components/ui/alert` instead.
 */
export function PluginSettingsBackLink({ label }: { label: string }) {
  return (
    <Link
      to="/website"
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground no-underline hover:text-foreground"
    >
      <ChevronLeft className="size-3.5" aria-hidden />
      {label}
    </Link>
  );
}

/**
 * Active / inactive switch for a catalog service. Lives on each service page
 * (top-right of the header) rather than on a list.
 */
export function ServiceActiveToggle({
  pluginUuid,
  name,
}: {
  pluginUuid: string;
  name?: string;
}) {
  const { t } = useTranslation();
  const installsQuery = useWorkspaceWpPluginInstalls(true);
  const activation = useWorkspacePluginActivation();
  const install = installsQuery.data?.plugins.find(
    (p) => p.plugin_uuid === pluginUuid,
  );

  if (!install) return null;

  const label = name?.trim() || install.display_name;
  const busy =
    activation.isPending && activation.variables?.pluginUuid === pluginUuid;

  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "text-sm font-medium",
          install.active
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-muted-foreground",
        )}
      >
        {install.active
          ? t("wordpress.plugins.active", "Active")
          : t("wordpress.plugins.inactive", "Inactive")}
      </span>
      <Switch
        checked={install.active}
        disabled={busy}
        aria-label={
          install.active
            ? t("wordpress.plugins.turnOff", "Turn off {{name}}", {
                name: label,
              })
            : t("wordpress.plugins.turnOn", "Turn on {{name}}", {
                name: label,
              })
        }
        onCheckedChange={(on) => {
          if (on === install.active) return;
          activation.mutate({ pluginUuid, active: on, name: label });
        }}
      />
    </div>
  );
}

/**
 * When a catalog service is off, hide its settings and ask the user to turn
 * it on first. Settings pages still render their own toggle once active.
 */
export function ServiceInactiveGate({
  pluginUuid,
  name,
  children,
}: {
  pluginUuid: string;
  name?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const installsQuery = useWorkspaceWpPluginInstalls(true);
  const activation = useWorkspacePluginActivation();
  const plugins = installsQuery.data?.plugins ?? [];
  const waiting = installsQuery.isPending && !installsQuery.data;
  const activating =
    activation.isPending &&
    activation.variables?.pluginUuid === pluginUuid &&
    activation.variables?.active === true;

  if (waiting) {
    return <PluginSettingsLoadingPage />;
  }

  // No site / installs failed: let the settings page show its own empty state.
  if (installsQuery.isError) {
    return children;
  }

  const install = plugins.find((p) => p.plugin_uuid === pluginUuid);
  if (install?.active && !activating) {
    return children;
  }

  const label = name?.trim() || install?.display_name || "";
  const activateLabel = label
    ? t("wordpress.plugins.activate", "Activate {{name}}", { name: label })
    : t("wordpress.plugins.activateUnnamed", "Activate");

  return (
    <PageShell>
      <PluginSettingsBackLink
        label={t("wordpress.pluginSettings.back", "Back to website")}
      />

      {label ? (
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {label}
        </h1>
      ) : null}

      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed bg-card px-6 py-16 text-center app-fade-up">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Power className="h-6 w-6" />
        </div>
        <div>
          <p className="text-base font-semibold tracking-tight">
            {t("wordpress.plugins.inactiveTitle", "This service is inactive")}
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {t(
              "wordpress.plugins.inactiveBody",
              "Activate it to update settings and use it on your website.",
            )}
          </p>
        </div>
        <Button
          onClick={() =>
            activation.mutate({
              pluginUuid,
              active: true,
              name: label || activateLabel,
            })
          }
          disabled={activating}
        >
          {activating ? (
            <Spinner className="size-4" />
          ) : (
            <Power className="size-4" />
          )}
          {activating
            ? t("wordpress.plugins.activating", "Activating…")
            : activateLabel}
        </Button>
      </div>
    </PageShell>
  );
}

/**
 * Loading placeholder for every plugin settings screen (and the catalog-resolve
 * gate that sits above them). Mirrors the real header + stats + card layout so
 * the page doesn't jump when data arrives. Pulse bars match the WordPress hub
 * skeleton pattern (`animate-pulse` + `bg-muted`).
 */
export function PluginSettingsLoadingSkeleton() {
  return (
    <div
      className="space-y-6 sm:space-y-8"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="h-4 w-28 animate-pulse rounded bg-muted" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-7 w-56 animate-pulse rounded bg-muted sm:h-8" />
            <div className="h-5 w-12 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-9 w-32 shrink-0 animate-pulse rounded-md bg-muted" />
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 sm:p-5">
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-7 w-14 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="space-y-2 border-b p-5">
          <div className="h-5 w-36 animate-pulse rounded bg-muted" />
          <div className="h-4 w-64 max-w-full animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-4 p-5">
          <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-24 w-full animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    </div>
  );
}

/** Full-page loading shell used by settings routes and early-return loaders. */
export function PluginSettingsLoadingPage() {
  return (
    <PageShell>
      <PluginSettingsLoadingSkeleton />
    </PageShell>
  );
}
