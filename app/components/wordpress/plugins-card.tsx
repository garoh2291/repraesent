import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AlertCircle,
  Blocks,
  CircleCheck,
  CircleSlash,
  Puzzle,
  RefreshCw,
  Search,
  Settings2,
  X,
} from "lucide-react";
import {
  useWorkspaceWpPluginActivation,
  useWorkspaceWpPlugins,
} from "~/lib/hooks/useWorkspaceWpPlugins";
import { StatTile } from "~/components/wordpress/fields";
import { useDebounce } from "~/lib/hooks/useDebounce";
import {
  isPortedSettingsKind,
  wordpressPluginSettingsPath,
} from "~/lib/utils/wordpress-plugin-kind";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import type { WpPlugin } from "~/lib/api/wordpress-hub";

type PluginFilter = "all" | "active" | "inactive";

/**
 * Plugin management for the workspace's own WordPress site: an at-a-glance
 * stats strip, search + segmented filter, and a soft card list where each row
 * carries a Switch to turn the plugin on or off. Enabled only once we know the
 * workspace actually has a site.
 */
export function WordPressPluginsSection({ hasSite }: { hasSite: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pluginsQuery = useWorkspaceWpPlugins(hasSite);
  const activation = useWorkspaceWpPluginActivation();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 200);
  const [filter, setFilter] = useState<PluginFilter>("all");

  const plugins = pluginsQuery.data?.plugins ?? [];
  const activeCount = plugins.filter((p) => p.active).length;
  const inactiveCount = plugins.length - activeCount;

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return plugins
      .filter((p) => {
        if (filter === "active" && !p.active) return false;
        if (filter === "inactive" && p.active) return false;
        if (!q) return true;
        return pluginLabel(p).toLowerCase().includes(q);
      })
      // Stable A–Z order so toggling active state never reshuffles the list.
      .sort((a, b) =>
        pluginLabel(a).localeCompare(pluginLabel(b), undefined, {
          sensitivity: "base",
        }),
      );
  }, [plugins, debouncedSearch, filter]);

  function handleToggle(plugin: WpPlugin, active: boolean) {
    activation.mutate(
      { pluginId: plugin.id, active },
      {
        onSuccess: () =>
          toast.success(
            active
              ? t("wordpress.plugins.activated", "{{name}} activated", {
                  name: plugin.name,
                })
              : t("wordpress.plugins.deactivated", "{{name}} deactivated", {
                  name: plugin.name,
                }),
          ),
        onError: () =>
          toast.error(
            t(
              "wordpress.plugins.toggleError",
              "Couldn't update this plugin. Please contact support.",
            ),
          ),
      },
    );
  }

  const isLoading = pluginsQuery.isLoading;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3 app-fade-up app-fade-up-d1 sm:gap-4">
        <StatTile
          size="lg"
          icon={<Blocks className="h-4 w-4" />}
          label={t("wordpress.plugins.stat.installed", "Installed")}
          value={plugins.length}
          loading={isLoading}
          tone="neutral"
        />
        <StatTile
          size="lg"
          icon={<CircleCheck className="h-4 w-4" />}
          label={t("wordpress.plugins.stat.active", "Active")}
          value={activeCount}
          loading={isLoading}
          tone="positive"
        />
        <StatTile
          size="lg"
          icon={<CircleSlash className="h-4 w-4" />}
          label={t("wordpress.plugins.stat.inactive", "Inactive")}
          value={inactiveCount}
          loading={isLoading}
          tone="muted"
        />
      </div>

      {/* Plugins panel */}
      <div className="overflow-hidden rounded-2xl border bg-card app-fade-up app-fade-up-d2">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-2">
            <Puzzle className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-tight">
              {t("wordpress.plugins.title", "Plugins")}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t(
                  "wordpress.plugins.searchPlaceholder",
                  "Search plugins…",
                )}
                className="h-9 pl-9 pr-8"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label={t("common.clear", "Clear")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
              {(["all", "active", "inactive"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    filter === f
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(`wordpress.plugins.filter.${f}`)}
                </button>
              ))}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground"
              onClick={() => pluginsQuery.refetch()}
              disabled={pluginsQuery.isFetching}
              aria-label={t("wordpress.plugins.refresh", "Refresh")}
              title={t("wordpress.plugins.refresh", "Refresh")}
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  pluginsQuery.isFetching && "animate-spin",
                )}
              />
            </Button>
          </div>
        </div>

        {pluginsQuery.isError ? (
          <div className="flex items-start gap-3 p-6 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">
                {t(
                  "wordpress.plugins.unavailable",
                  "Plugins are not available.",
                )}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {t(
                  "wordpress.plugins.unavailableHint",
                  "Please contact support.",
                )}
              </p>
            </div>
          </div>
        ) : isLoading ? (
          <ul className="divide-y">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 p-4">
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-muted" />
                <div className="h-4 w-44 animate-pulse rounded bg-muted" />
                <div className="ml-auto h-5 w-9 animate-pulse rounded-full bg-muted" />
              </li>
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Puzzle className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">
              {plugins.length === 0
                ? t("wordpress.plugins.empty", "No plugins found")
                : t("wordpress.plugins.noMatch", "No matching plugins")}
            </p>
            <p className="max-w-xs text-xs text-muted-foreground">
              {plugins.length === 0
                ? t(
                    "wordpress.plugins.emptyHint",
                    "We couldn't detect any plugins installed on this site yet.",
                  )
                : t(
                    "wordpress.plugins.noMatchHint",
                    "Try a different search term or filter.",
                  )}
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.map((plugin) => {
              const rowBusy =
                activation.isPending &&
                activation.variables?.pluginId === plugin.id;
              const settingsPath =
                plugin.plugin_uuid &&
                isPortedSettingsKind(plugin.settings_kind ?? undefined)
                  ? wordpressPluginSettingsPath(plugin.plugin_uuid)
                  : null;
              return (
                <li
                  key={plugin.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5",
                    settingsPath && "cursor-pointer",
                  )}
                  {...(settingsPath
                    ? {
                        role: "link",
                        tabIndex: 0,
                        onClick: () => navigate(settingsPath),
                        onKeyDown: (e: React.KeyboardEvent<HTMLLIElement>) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(settingsPath);
                          }
                        },
                      }
                    : {})}
                >
                  <PluginIcon plugin={plugin} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {pluginLabel(plugin)}
                      </span>
                      {plugin.version && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          v{plugin.version}
                        </span>
                      )}
                    </div>
                    {plugin.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {plugin.description}
                      </p>
                    )}
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          plugin.active
                            ? "bg-emerald-500"
                            : "bg-muted-foreground/40",
                        )}
                      />
                      <span
                        className={cn(
                          "text-xs",
                          plugin.active
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground",
                        )}
                      >
                        {plugin.active
                          ? t("wordpress.plugins.active", "Active")
                          : t("wordpress.plugins.inactive", "Inactive")}
                      </span>
                    </div>
                  </div>

                  {settingsPath && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                    >
                      <Link
                        to={settingsPath}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                        {t("wordpress.plugins.manage", "Edit Settings")}
                      </Link>
                    </Button>
                  )}

                  {/* Stop the toggle's clicks from bubbling to the row link. */}
                  <span
                    className="shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Switch
                      checked={plugin.active}
                      disabled={rowBusy}
                      aria-label={
                        plugin.active
                          ? t("wordpress.plugins.turnOff", "Turn off {{name}}", {
                              name: plugin.name,
                            })
                          : t("wordpress.plugins.turnOn", "Turn on {{name}}", {
                              name: plugin.name,
                            })
                      }
                      onCheckedChange={(on) => {
                        if (on === plugin.active) return;
                        handleToggle(plugin, on);
                      }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Prefer the catalog display name (wp_plugins), fall back to the WP slug/name. */
function pluginLabel(plugin: WpPlugin): string {
  return plugin.display_name || plugin.name;
}

/**
 * Renders the plugin's catalog icon (raw inline SVG from wp_plugins) when this
 * is a Repraesent-managed plugin; third-party plugins that aren't in the
 * catalog fall back to a generic puzzle-piece icon.
 */
function PluginIcon({ plugin }: { plugin: WpPlugin }) {
  const base = cn(
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 transition-colors",
    plugin.active
      ? "bg-primary/10 text-primary ring-primary/20"
      : "bg-muted text-muted-foreground ring-transparent",
  );

  if (plugin.icon) {
    return (
      <div
        className={cn(base, "[&_svg]:h-5 [&_svg]:w-5")}
        aria-hidden
        dangerouslySetInnerHTML={{ __html: plugin.icon }}
      />
    );
  }

  return (
    <div className={base} aria-hidden>
      <Puzzle className="h-5 w-5" />
    </div>
  );
}
