import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Clock, Globe, Hourglass, RefreshCw, Rocket } from "lucide-react";
import type { WebsiteOverview, WorkspaceWpSite } from "~/lib/api/wordpress-hub";
import {
  useRefreshWebsitePreview,
  useWorkspaceWebsiteOverview,
} from "~/lib/hooks/useWorkspaceWebsiteOverview";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { cn } from "~/lib/utils";
import i18n from "~/i18n";

/**
 * The picture of the open site, as a visitor sees its first screen. It fills
 * its box edge to edge at 16:10 — taller if the details beside it need the
 * room — so nothing around it moves while it loads. When it was taken and
 * the button for a new one sit on the picture itself.
 */
export function WebsitePreviewImage({ site }: { site: WorkspaceWpSite }) {
  const { t } = useTranslation();
  const overview = useWorkspaceWebsiteOverview(site.id);
  const refresh = useRefreshWebsitePreview(site.id);
  // The image link is signed for an hour; one that has run out reloads the
  // overview for a fresh link instead of showing a broken image.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);

  const preview = overview.data?.preview;
  const url = preview?.url && preview.url !== failedUrl ? preview.url : null;
  const taking = preview?.state === "taking";
  const spinning = refresh.isPending || taking;

  function handleRefresh() {
    refresh.mutate(undefined, {
      onSuccess: (res) => {
        if (!res.started) {
          toast(
            t(
              "wordpress.overview.previewRecentlyAsked",
              "A new picture was asked for a few minutes ago. It shows up here once it's ready.",
            ),
          );
        }
      },
      onError: (err) => toast.error(extractErrorMessage(err)),
    });
  }

  const caption =
    url && taking
      ? t("wordpress.overview.previewUpdating", "Updating picture…")
      : preview?.taken_at
        ? t("wordpress.overview.previewTaken", {
            when: formatRelative(preview.taken_at),
            defaultValue: "Picture taken {{when}}",
          })
        : null;
  const refreshLabel = t("wordpress.overview.previewRefresh", "New picture");

  return (
    <div className="relative aspect-[16/10] w-full min-w-0 overflow-hidden bg-muted lg:h-full">
      <a
        href={site.url}
        target="_blank"
        rel="noreferrer"
        aria-label={t("wordpress.overview.previewOpen", "Open your website")}
        className="absolute inset-0 block outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        {url ? (
          <img
            key={url}
            src={url}
            alt={t("wordpress.overview.previewAlt", "Your website's homepage")}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoadedUrl(url)}
            onError={() => {
              setFailedUrl(url);
              void overview.refetch();
            }}
            className={cn(
              "absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-300",
              loadedUrl === url ? "opacity-100" : "opacity-0",
            )}
          />
        ) : null}
        {!url || loadedUrl !== url ? (
          <PreviewPlaceholder
            // A picture that couldn't be taken looks like one not taken yet:
            // the customer never sees that it failed.
            state={
              overview.isLoading || (url && loadedUrl !== url)
                ? "loading"
                : taking
                  ? "taking"
                  : "none"
            }
          />
        ) : null}
      </a>

      {/* On the picture: when it was taken, and a new one. */}
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
        {caption ? (
          <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-xs backdrop-blur-sm">
            {url && taking ? (
              <RefreshCw className="size-3 shrink-0 animate-spin motion-reduce:animate-none" />
            ) : null}
            <span className="truncate">{caption}</span>
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={handleRefresh}
          disabled={spinning || overview.isLoading}
          // Named, not just an icon, and ink on hover like the app's buttons.
          className="pointer-events-auto inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-background/95 px-3.5 text-xs font-medium text-foreground shadow-sm ring-1 ring-foreground/10 backdrop-blur-sm transition-colors enabled:hover:bg-foreground enabled:hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70 max-sm:h-11"
        >
          <RefreshCw
            className={cn("size-3.5", spinning && "animate-spin motion-reduce:animate-none")}
          />
          {refreshLabel}
        </button>
      </div>
    </div>
  );
}

function PreviewPlaceholder({ state }: { state: "loading" | "taking" | "none" }) {
  const { t } = useTranslation();
  if (state === "loading") {
    return <div className="absolute inset-0 animate-pulse bg-muted" aria-busy="true" />;
  }
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
      <Globe className={cn("size-7", state === "taking" && "animate-pulse")} />
      <p className="text-xs leading-relaxed">
        {state === "taking"
          ? t("wordpress.overview.previewTaking", "Taking a picture of your website…")
          : t("wordpress.overview.previewNone", "No picture yet. Try “New picture” in a moment.")}
      </p>
    </div>
  );
}

/**
 * When the site went up and when it last changed, plus the coming-soon note.
 * A date we couldn't read is left out, never guessed.
 */
export function WebsiteDates({ site }: { site: WorkspaceWpSite }) {
  const { t } = useTranslation();
  const overview = useWorkspaceWebsiteOverview(site.id);
  const data: WebsiteOverview | undefined = overview.data;

  if (overview.isLoading) {
    return (
      <div className="divide-y border-y" aria-busy="true">
        <div className="flex h-11 items-center justify-between">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex h-11 items-center justify-between">
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-3">
      <dl className="divide-y border-y text-sm">
        <DateRow
          icon={<Rocket className="size-3.5" />}
          label={
            site.type === "production"
              ? t("wordpress.overview.published", "Published")
              : t("wordpress.overview.created", "Created")
          }
          value={formatDate(data.published_at)}
          title={formatDateTime(data.published_at)}
        />
        {data.updated_at ? (
          <DateRow
            icon={<Clock className="size-3.5" />}
            label={t("wordpress.overview.updated", "Last updated")}
            value={formatRelative(data.updated_at)}
            title={formatDateTime(data.updated_at)}
          />
        ) : null}
      </dl>
      {data.coming_soon ? (
        <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
          <Hourglass className="mt-0.5 size-3.5 shrink-0" />
          {t(
            "wordpress.overview.comingSoon",
            "Visitors see your coming-soon page right now, so the picture shows that page.",
          )}
        </p>
      ) : null}
    </div>
  );
}

function DateRow({
  icon,
  label,
  value,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  title: string;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 py-2">
      <dt className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="text-right font-medium text-foreground" title={title}>
        {value}
      </dd>
    </div>
  );
}

function locale(): string {
  return i18n.language || "de";
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(locale(), { dateStyle: "long" }).format(new Date(iso));
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(locale(), { dateStyle: "long", timeStyle: "short" }).format(
    new Date(iso),
  );
}

/** "3 days ago", "yesterday", "just now" in the app's language. */
function formatRelative(iso: string): string {
  const diffS = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: "auto" });
  const abs = Math.abs(diffS);
  if (abs < 60) return rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.round(diffS / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(diffS / 3600), "hour");
  if (abs < 30 * 86_400) return rtf.format(Math.round(diffS / 86_400), "day");
  if (abs < 365 * 86_400) return rtf.format(Math.round(diffS / (30 * 86_400)), "month");
  return rtf.format(Math.round(diffS / (365 * 86_400)), "year");
}
