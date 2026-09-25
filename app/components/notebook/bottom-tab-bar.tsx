import { Link, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { Menu } from "lucide-react";
import { cn } from "~/lib/utils";
import { activeSection, type NavSection } from "~/lib/nav/sections";
import { useToday } from "~/lib/hooks/useToday";
import { MarkerCount } from "~/components/notebook/stat";

/**
 * Phone navigation (NOTEBOOK_UX_PLAN.md D10): the four daily jobs under the
 * thumb, plus More — which opens the full sidebar (Website, Settings,
 * workspace switcher, language, log out), so nothing is out of reach.
 */
export function BottomTabBar({
  sections,
  onMore,
  moreOpen = false,
}: {
  sections: NavSection[];
  onMore: () => void;
  /** The menu sheet is up: More is the active tab. */
  moreOpen?: boolean;
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const active = activeSection(sections, location.pathname);
  const today = useToday("me");
  const counts = today.data && today.data.supported ? today.data.counts : null;
  const needsYou = counts
    ? // People waiting — the same number the Today greeting shows.
      counts.new_leads + counts.follow_ups_due + (counts.signups ?? 0)
    : 0;
  const primary = sections.filter((s) => s.key !== "website");

  const item =
    "press relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 text-[10.5px] font-medium";

  return (
    <nav
      aria-label={t("sections.mobileNav", "Main")}
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur-md supports-[backdrop-filter]:bg-card/80 lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch">
        {primary.map((s) => {
          const Icon = s.icon;
          const isActive = active?.key === s.key;
          return (
            <Link
              key={s.key}
              to={s.to}
              aria-current={isActive ? "page" : undefined}
              className={cn(item, isActive ? "text-foreground" : "text-muted-foreground")}
            >
              <span className="relative">
                <Icon className={cn("size-[22px]", isActive && "stroke-[2.25]")} />
                {s.key === "today" && needsYou > 0 ? (
                  <MarkerCount n={needsYou} className="absolute -right-3 -top-1.5 min-w-4 px-1 text-[10px] leading-4" />
                ) : null}
              </span>
              <span className="truncate">{s.label}</span>
              {isActive ? (
                <span className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-marker" aria-hidden />
              ) : null}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          className={cn(item, moreOpen ? "text-foreground" : "text-muted-foreground")}
        >
          <Menu className={cn("size-[22px]", moreOpen && "stroke-[2.25]")} />
          <span>{t("sections.more", "More")}</span>
          {moreOpen ? <span className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-marker" aria-hidden /> : null}
        </button>
      </div>
    </nav>
  );
}
