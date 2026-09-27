import { Link, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { PILOT_FEATURE_LABEL_KEY } from "~/lib/feature-flags";
import { PILOT_SETTINGS, useNavModel } from "~/lib/nav/use-nav-model";
import { cn } from "~/lib/utils";

/**
 * The settings list, grouped like iPhone Settings (REDESIGN_PLAN.md §2). Used
 * in the More sheet and as the /settings page on phones, so tapping Settings
 * always shows everything there is, not just your profile.
 */
export function SettingsGroups({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const nav = useNavModel();
  return (
    <div className="space-y-4">
      {nav.settingsGroups.map((group) => (
        <section key={group.key}>
          <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
            {t(group.labelKey, group.fallback)}
          </p>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {group.items.map(({ to, labelKey, Icon }) => (
              <ListRow
                key={to}
                to={to}
                icon={Icon}
                label={t(labelKey)}
                active={pathname.startsWith(to)}
                onNavigate={onNavigate}
                pill={
                  PILOT_SETTINGS.has(to) ? (
                    <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t(PILOT_FEATURE_LABEL_KEY, { defaultValue: "Demo" })}
                    </span>
                  ) : null
                }
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ListRow({
  to,
  icon: Icon,
  label,
  active,
  onNavigate,
  pill,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onNavigate?: () => void;
  pill?: React.ReactNode;
}) {
  return (
    <li>
      <Link
        to={to}
        prefetch="intent"
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "press flex min-h-12 items-center gap-3 px-3 py-2 text-[15px] transition-colors active:bg-muted",
          active ? "font-semibold text-foreground" : "text-foreground/85",
        )}
      >
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", active ? "bg-secondary" : "bg-muted")}>
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {pill}
        {active ? <span className="size-2 rounded-full bg-marker" aria-hidden /> : <ChevronRight className="size-4 text-muted-foreground/60" aria-hidden />}
      </Link>
    </li>
  );
}

