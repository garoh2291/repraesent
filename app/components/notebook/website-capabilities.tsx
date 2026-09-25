import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { cn } from "~/lib/utils";
import { useWorkspaceWpPluginInstalls } from "~/lib/hooks/useWorkspaceWpPluginInstalls";
import {
  pluginKindIcon,
  wordpressPluginSettingsPath,
} from "~/lib/utils/wordpress-plugin-kind";

/**
 * What the website does for you, as quiet cards (NOTEBOOK_UX_PLAN.md §7):
 * translations, cookie banner, SEO, visibility… Setup work, so it lives here —
 * one level down — and never competes with the daily loop.
 */
export function WebsiteCapabilities() {
  const { t } = useTranslation();
  const q = useWorkspaceWpPluginInstalls(true);
  const plugins = [...(q.data?.plugins ?? [])].sort((a, b) =>
    a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" }),
  );
  if (!plugins.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {t("websiteCaps.title", "What your website does")}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {plugins.map((p) => {
          const Icon = pluginKindIcon(p.name);
          return (
            <Link
              key={p.plugin_uuid}
              to={wordpressPluginSettingsPath(p.plugin_uuid)}
              className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-xs transition-colors hover:border-foreground/25"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                <Icon className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[14.5px] font-semibold text-foreground">{p.display_name}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-px text-[10.5px] font-medium",
                      p.active ? "bg-earned-soft text-earned" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {p.active ? t("websiteCaps.on", "On") : t("websiteCaps.off", "Off")}
                  </span>
                </span>
                {p.description ? (
                  <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-muted-foreground">
                    {p.description}
                  </span>
                ) : null}
              </span>
              <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
