import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Globe } from "lucide-react";
import type { WorkspaceWpSite } from "~/lib/api/wordpress-hub";
import { getStoredWpSiteId } from "~/lib/api/axios-instance";
import { useWorkspaceWpSite } from "~/lib/hooks/useWorkspaceWpSite";
import {
  useSwitchWpSite,
  useWorkspaceWpSites,
} from "~/lib/hooks/useWorkspaceWpSites";
import { cn } from "~/lib/utils";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

type SiteType = WorkspaceWpSite["type"];

const TYPE_STYLE: Record<SiteType, string> = {
  production:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  staging: "border-border bg-muted text-muted-foreground",
  // A test copy is the one people edit by mistake, so it stands out.
  development:
    "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
};

/** Short label for a site's type: Production / Staging / Test. */
export function useSiteTypeLabel() {
  const { t } = useTranslation();
  return (type: SiteType) =>
    type === "production"
      ? t("wordpress.sitePicker.typeLive", "Production")
      : type === "staging"
        ? t("wordpress.sitePicker.typeStaging", "Staging")
        : t("wordpress.sitePicker.typeTest", "Test");
}

export function SiteTypeBadge({
  type,
  className,
}: {
  type: SiteType;
  className?: string;
}) {
  const label = useSiteTypeLabel();
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        TYPE_STYLE[type],
        className,
      )}
    >
      {label(type)}
    </span>
  );
}

export function siteHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url.replace(/^https?:\/\//i, "");
  }
}

/**
 * The open site, by the API's own rule: the one this tab chose (once the open
 * site has loaded, that one) if it is in the list, else the first — live first.
 */
function currentSite(
  sites: WorkspaceWpSite[],
  openId: string | undefined,
): WorkspaceWpSite | null {
  const wanted = openId ?? getStoredWpSiteId();
  return sites.find((s) => s.id === wanted) ?? sites[0] ?? null;
}

/**
 * Which of the workspace's websites the Website section shows — the live
 * site, or a staging or test copy (the domains staff add in shtemaran).
 * A dropdown when there is more than one; otherwise just the domain and its
 * type, so it is always clear which site the settings change.
 *
 * `dirty` asks before switching away from unsaved edits, which a switch drops.
 * `busy` locks it while a save is on its way to the open site.
 */
export function WebsiteSitePicker({
  dirty = false,
  busy = false,
  compact = false,
  types,
}: {
  dirty?: boolean;
  busy?: boolean;
  /** Next to a heading that already names the domain: badge + "Switch". */
  compact?: boolean;
  /** Only these kinds of site (Website › Production or › Staging); all by default. */
  types?: SiteType[];
}) {
  const { t } = useTranslation();
  // Drawn from the site list alone — one quick database read — so it never
  // waits for the open site's slower hosting check, and never changes shape
  // once shown. The open site's query is only followed so a switch repaints.
  const sitesQuery = useWorkspaceWpSites(true);
  const siteQuery = useWorkspaceWpSite(true);
  const switchSite = useSwitchWpSite();
  const [pending, setPending] = useState<WorkspaceWpSite | null>(null);

  if (sitesQuery.isLoading) {
    return (
      <div
        aria-hidden
        className={cn(
          "max-w-full animate-pulse rounded-lg bg-muted",
          compact ? "h-9 w-36 max-sm:h-11" : "h-10 w-64 max-sm:h-11 max-sm:w-full",
        )}
      />
    );
  }

  const sites = (sitesQuery.data ?? []).filter(
    (s) => !types || types.includes(s.type),
  );
  const current = currentSite(sites, siteQuery.data?.id);
  if (!current) return null;

  // Next to a heading that already names the domain, one site needs no switch.
  if (compact && sites.length <= 1) return <SiteTypeBadge type={current.type} />;

  function describe(site: WorkspaceWpSite) {
    if (site.type === "production")
      return t("wordpress.sitePicker.descLive", "What your visitors see");
    if (site.type === "staging")
      return t(
        "wordpress.sitePicker.descPreview",
        "A copy to check changes before they go live",
      );
    return t("wordpress.sitePicker.descTest", "A copy for trying things out");
  }

  function choose(site: WorkspaceWpSite) {
    switchSite(site);
  }

  function request(siteId: string) {
    const site = sites.find((s) => s.id === siteId);
    if (busy || !site || site.id === current?.id) return;
    if (dirty) setPending(site);
    else choose(site);
  }

  const face = compact ? (
    <>
      <SiteTypeBadge type={current.type} />
      <span className="text-sm font-medium text-muted-foreground">
        {t("wordpress.sitePicker.switch", "Switch website")}
      </span>
    </>
  ) : (
    <>
      <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 truncate text-sm font-medium">
        {siteHost(current.url)}
      </span>
      <SiteTypeBadge type={current.type} />
    </>
  );

  if (sites.length <= 1) {
    return (
      <div className="flex h-10 max-w-full items-center gap-2 rounded-lg border bg-card px-3 max-sm:h-11 max-sm:w-full">
        {face}
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={busy}
            aria-label={t("wordpress.sitePicker.label", "Which website")}
            className={cn(
              "flex max-w-full items-center gap-2 rounded-lg border bg-card text-left transition-colors hover:bg-muted/40 disabled:pointer-events-none disabled:opacity-60",
              compact ? "h-9 px-2.5 max-sm:h-11" : "h-10 px-3 max-sm:h-11 max-sm:w-full",
            )}
          >
            {face}
            <ChevronDown
              className="ml-auto size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-72 max-w-[calc(100vw-2rem)]">
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
            {t("wordpress.sitePicker.menuTitleWebsites", "Your websites")}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={current.id} onValueChange={request}>
            {sites.map((site) => (
              <DropdownMenuRadioItem
                key={site.id}
                value={site.id}
                // The check dot sits on the domain line, not above it.
                className="min-h-11 items-start py-2 [&>span:first-child]:h-[22px]"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{siteHost(site.url)}</span>
                    <SiteTypeBadge type={site.type} />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {describe(site)}
                  </span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("wordpress.sitePicker.confirmTitle", "Switch website?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "wordpress.sitePicker.confirmBody",
                "You have unsaved changes for {{host}}. They will be lost if you switch now.",
                { host: siteHost(current.url) },
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("wordpress.sitePicker.confirmStay", "Stay here")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) choose(pending);
                setPending(null);
              }}
            >
              {t("wordpress.sitePicker.confirmSwitch", "Switch anyway")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Shown instead of Website settings or a service screen when the open site is
 * one we don't host: nothing there could be read or saved, so the screen says
 * why in plain words rather than failing on every call. With more than one
 * site, the picker lets the person move to one we do host.
 */
export function NotHostedNotice({
  site,
  showPicker = true,
}: {
  site: WorkspaceWpSite;
  /** Off where the page header already has the picker. */
  showPicker?: boolean;
}) {
  const { t } = useTranslation();
  const sitesQuery = useWorkspaceWpSites(true);
  const hasOthers = showPicker && (sitesQuery.data?.length ?? 0) > 1;

  return (
    <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed bg-card px-5 py-8 sm:px-8 app-fade-up">
      <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Globe className="size-5" aria-hidden />
      </div>
      <div className="space-y-1.5">
        <p className="text-base font-semibold tracking-tight">
          {t(
            "wordpress.notHosted.title",
            "This website isn't hosted by us",
          )}
        </p>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          {t(
            "wordpress.notHosted.bodyShort",
            "Its settings and services can't be changed from Repraesent. If you'd like us to host it, contact us.",
          )}
        </p>
      </div>
      {hasOthers ? (
        <div className="w-full space-y-2 sm:w-auto">
          <p className="text-xs text-muted-foreground">
            {t(
              "wordpress.notHosted.pickOther",
              "Or switch to another of your websites:",
            )}
          </p>
          <WebsiteSitePicker />
        </div>
      ) : null}
    </div>
  );
}
