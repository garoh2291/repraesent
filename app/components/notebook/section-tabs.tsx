import { Link, useLocation } from "react-router";
import { usePendingPathname } from "~/lib/nav/use-pending-nav";
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { PipelineDialog } from "~/components/organism/pipeline-dialog";
import { DropdownMenuSeparator } from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";
import { PILOT_FEATURE_LABEL_KEY } from "~/lib/feature-flags";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  tabIsActive,
  type NavSection,
  type SectionTab,
} from "~/lib/nav/sections";

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-foreground/[0.07] px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  );
}

function tabClass(active: boolean) {
  return cn(
    "relative inline-flex h-11 shrink-0 items-center gap-1.5 px-1 text-[13.5px] font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 rounded-sm",
    active
      ? "text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:rounded-full after:bg-marker"
      : "text-muted-foreground hover:text-foreground",
  );
}

function TabLink({ tab, pathname }: { tab: SectionTab; pathname: string }) {
  const { t } = useTranslation();
  const location = useLocation();
  const active = tabIsActive(tab, pathname);
  const Icon = tab.icon;
  const [newPipelineOpen, setNewPipelineOpen] = useState(false);
  // The strip scrolls sideways with no scrollbar: on a phone the open tab can
  // sit past the edge, so bring it into view (sideways only, never the page).
  const activeRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const el = activeRef.current;
    const strip = el?.parentElement;
    if (!active || !el || !strip) return;
    const left = el.offsetLeft - strip.offsetLeft;
    const hidden =
      left < strip.scrollLeft ||
      left + el.offsetWidth > strip.scrollLeft + strip.clientWidth;
    if (hidden) strip.scrollTo({ left: Math.max(0, left - 16) });
  }, [active]);

  const pills = (
    <>
      {tab.pilot ? <Pill>{t(PILOT_FEATURE_LABEL_KEY, { defaultValue: "Demo" })}</Pill> : null}
      {tab.isNew ? <Pill>{t("nav.newBadge", "New")}</Pill> : null}
    </>
  );

  if (tab.items?.length || tab.createPipeline) {
    const current = `${location.pathname}${location.search}`;
    return (
      <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button type="button" className={tabClass(active)}>
            <Icon className="size-4" />
            {tab.label}
            {pills}
            <ChevronDown className="size-3.5 opacity-60" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-52">
          {(tab.items ?? []).map((it) => (
            <DropdownMenuItem key={it.key} asChild>
              <Link
                to={it.to}
                prefetch="intent"
                className={cn(
                  "flex w-full items-center justify-between gap-3",
                  current === it.to && "font-semibold",
                )}
              >
                <span className="truncate">{it.label}</span>
                {it.meta ? (
                  <span className="num text-[11px] text-muted-foreground">{it.meta}</span>
                ) : null}
              </Link>
            </DropdownMenuItem>
          ))}
          {tab.createPipeline ? (
            <>
              {tab.items?.length ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem onSelect={() => setNewPipelineOpen(true)}>
                <Plus className="size-3.5" />
                {t("nav.newPipeline", "New pipeline")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {tab.createPipeline ? (
        <PipelineDialog open={newPipelineOpen} onOpenChange={setNewPipelineOpen} />
      ) : null}
      </>
    );
  }

  return (
    <Link ref={activeRef} to={tab.to} prefetch="intent" className={tabClass(active)} aria-current={active ? "page" : undefined}>
      <Icon className="size-4" />
      {tab.label}
      {pills}
    </Link>
  );
}

/**
 * The active section's destinations, as a quiet tab strip at the top of the
 * content (NOTEBOOK_UX_PLAN.md §2). It is how a page one level down stays one
 * tap away on every width — the sidebar lists only the five jobs.
 */
export function SectionTabs({ section }: { section: NavSection }) {
  const location = useLocation();
  // The tab being opened lights up on tap (slow connections).
  const navPath = usePendingPathname().pathname;
  if (section.tabs.length < 2) return null;
  return (
    <nav
      aria-label={section.label}
      className="sticky top-[var(--safe-top)] z-20 shrink-0 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70"
    >
      <div className="scrollbar-hide flex items-center gap-5 overflow-x-auto px-4 sm:px-6">
        {section.tabs.map((tab) => (
          <TabLink key={tab.key} tab={tab} pathname={navPath} />
        ))}
      </div>
    </nav>
  );
}
