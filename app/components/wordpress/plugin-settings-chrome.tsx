import { Globe, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageShell } from "~/components/wordpress/fields";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { useWorkspacePluginPause } from "~/lib/hooks/useWorkspacePluginPause";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { flash } from "~/components/wordpress/re-translate/constants";

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

/**
 * "Live" switch for a service page (top-right of the header), the same pill the
 * form builder uses. Turning it off PAUSES the service — visitors see the site
 * as if it were not installed, and nothing is deleted. It never deactivates the
 * plugin; that stays on the website list.
 */
export function ServiceLiveToggle({
  live,
  onChange,
  busy = false,
  id = "service-live-toggle",
  pauseHint,
  resumeHint,
  label,
  tone = "live",
  icon: Icon = Globe,
}: {
  live: boolean;
  onChange: (live: boolean) => void;
  busy?: boolean;
  id?: string;
  /** What pausing does for this service, shown on hover while it is live. */
  pauseHint?: string;
  /** Shown on hover while it is off. */
  resumeHint?: string;
  /** Defaults to "Live". re:maintenance says "Maintenance page" instead. */
  label?: string;
  /** `warning` paints "on" amber — for a switch whose on-state hides the site. */
  tone?: "live" | "warning";
  icon?: LucideIcon;
}) {
  const { t } = useTranslation();
  const text = label ?? t("wordpress.plugins.live", "Live");
  const tip = live
    ? (pauseHint ??
      t("wordpress.plugins.liveTipPause", "Switch off to pause. Nothing is deleted."))
    : (resumeHint ??
      t("wordpress.plugins.liveTipResume", "Paused. Switch on to go live again."));

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3"
          >
            <Icon
              className={cn(
                "h-3.5 w-3.5",
                !live
                  ? "text-muted-foreground/50"
                  : tone === "warning"
                    ? "text-amber-500"
                    : "text-emerald-500",
              )}
              aria-hidden="true"
            />
            <Label
              htmlFor={id}
              className="cursor-pointer text-sm font-medium text-muted-foreground"
            >
              {text}
            </Label>
            <Switch
              id={id}
              checked={live}
              disabled={busy}
              onCheckedChange={(next) => {
                if (next !== live) onChange(next);
              }}
              aria-label={text}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent>{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * The Live switch for plugins with no pause setting of their own in the page's
 * data (cookie, index, review, banner, appointment): it reads and writes the
 * plugin's pause flag on the site, and saves on its own.
 */
export function ServicePauseToggle({
  pluginUuid,
  pauseHint,
}: {
  pluginUuid: string;
  pauseHint?: string;
}) {
  const { t } = useTranslation();
  const { query, mutation } = useWorkspacePluginPause(pluginUuid);

  // Until the flag is read, showing "live" would be a guess.
  if (!query.data) return null;

  return (
    <ServiceLiveToggle
      id={`live-${pluginUuid}`}
      live={!query.data.paused}
      busy={mutation.isPending}
      pauseHint={pauseHint}
      onChange={(live) =>
        mutation.mutate(!live, {
          onSuccess: () =>
            flash(
              live
                ? t("wordpress.plugins.resumedFlash", "Live again.")
                : t(
                    "wordpress.plugins.pausedFlash",
                    "Paused. Visitors no longer see it. Nothing was deleted.",
                  ),
            ),
          onError: (err) => flash(extractErrorMessage(err), "error"),
        })
      }
    />
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
