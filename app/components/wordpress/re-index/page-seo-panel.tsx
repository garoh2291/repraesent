import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ExternalLink, FileText, Loader2, Search } from "lucide-react";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { requestWpSsoLogin } from "~/lib/api/wordpress-hub";
import { useWorkspaceReIndexPageSeo } from "~/lib/hooks/useWorkspaceReIndexSettings";
import type { ReIndexPageSeoRow } from "~/lib/wordpress/plugin-settings-types";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  CardHeader,
  InfoNote,
  SectionCard,
  StatTile,
} from "~/components/wordpress/fields";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "Pending Review",
  private: "Private",
  future: "Scheduled",
};

function trimWords(text: string, count: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= count) return text.trim();
  return `${words.slice(0, count).join(" ")}…`;
}

/**
 * Open the post editor in a new tab. The editor is the gateway's own landing
 * target (`redirect`), so the tab makes a single navigation: an existing
 * WordPress session redirects straight there, and a signed-out one authenticates
 * during that same request. Either way wp-admin is never rendered.
 */
async function openEditSeoViaSso(editUrl: string): Promise<void> {
  const ssoUrl = await requestWpSsoLogin({ redirect: editUrl });
  const tab = window.open(ssoUrl, "_blank");
  // Popup blocked — hand this tab over to the gateway instead.
  if (!tab) window.location.href = ssoUrl;
}

function PageRow({
  row,
  showType,
  opening,
  onEdit,
}: {
  row: ReIndexPageSeoRow;
  showType: boolean;
  opening: boolean;
  onEdit: (editUrl: string) => void;
}) {
  const { t } = useTranslation();
  const title =
    row.title.trim() ||
    t("wordpress.reIndex.pageSeo.untitled", "(no title)");
  const statusLabel =
    row.post_status !== "publish"
      ? STATUS_LABELS[row.post_status] ?? row.post_status
      : null;

  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="py-3 pr-3 align-top">
        <div className="flex flex-col gap-1">
          {row.view_url ? (
            <a
              href={row.view_url}
              target="_blank"
              rel="noreferrer"
              className="text-left font-medium text-foreground hover:underline"
            >
              {title}
            </a>
          ) : (
            <span className="font-medium text-foreground">{title}</span>
          )}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {row.slug ? (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                /{row.slug}/
              </code>
            ) : null}
            {showType ? (
              <Badge variant="outline" className="font-normal">
                {row.post_type}
              </Badge>
            ) : null}
            {statusLabel ? (
              <Badge variant="secondary" className="font-normal">
                {statusLabel}
              </Badge>
            ) : null}
            {row.noindex ? (
              <Badge
                variant="outline"
                className="border-destructive/30 bg-destructive/5 font-normal text-destructive"
              >
                {t("wordpress.reIndex.pageSeo.noindex", "Hidden")}
              </Badge>
            ) : null}
          </div>
        </div>
      </td>
      <td className="py-3 pr-3 align-top">
        {row.effective_title ? (
          <span
            className={
              row.title_source === "override"
                ? "text-sm text-foreground"
                : "text-sm text-muted-foreground"
            }
          >
            {row.effective_title}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            {t("wordpress.reIndex.pageSeo.defaultTitle", "Default")}
          </span>
        )}
      </td>
      <td className="py-3 pr-3 align-top">
        {row.meta_description ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-foreground">
              {trimWords(row.meta_description, 14)}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {row.meta_description.length}
            </span>
          </div>
        ) : (
          <span className="text-sm text-amber-700 dark:text-amber-400">
            {t("wordpress.reIndex.pageSeo.notSet", "Not set")}
          </span>
        )}
      </td>
      <td className="py-3 align-top">
        {row.edit_url ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={opening}
            onClick={() => onEdit(row.edit_url!)}
          >
            {opening ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ExternalLink className="h-3.5 w-3.5" />
            )}
            {t("wordpress.reIndex.pageSeo.edit", "Edit SEO")}
          </Button>
        ) : null}
      </td>
    </tr>
  );
}

export function PageSeoPanel({
  pluginUuid,
  active,
}: {
  pluginUuid: string;
  active: boolean;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [openingId, setOpeningId] = useState<number | null>(null);
  const { data, isLoading, isError, error } = useWorkspaceReIndexPageSeo(
    pluginUuid,
    active,
  );

  const showType = useMemo(() => {
    if (!data?.pages.length) return false;
    const types = new Set(data.pages.map((p) => p.post_type));
    return types.size > 1;
  }, [data?.pages]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !data?.pages) return data?.pages ?? [];
    return data.pages.filter((p) => {
      const hay = `${p.title} ${p.slug}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data?.pages, search]);

  async function handleEdit(rowId: number, editUrl: string) {
    setOpeningId(rowId);
    try {
      await openEditSeoViaSso(editUrl);
    } catch (err) {
      toast.error(
        extractErrorMessage(err) ||
          t(
            "wordpress.reIndex.pageSeo.ssoFailed",
            "Couldn't sign in to WordPress admin. Connect SSO for this site first.",
          ),
      );
    } finally {
      setOpeningId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 sm:p-5">
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              <div className="mt-3 h-7 w-14 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="space-y-3 p-5">
            <div className="h-10 w-full max-w-sm animate-pulse rounded-md bg-muted" />
            <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
            <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
            <div className="h-10 w-3/4 animate-pulse rounded-md bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
      >
        {extractErrorMessage(error)}
      </div>
    );
  }

  const summary = data?.summary;
  const pages = data?.pages ?? [];

  return (
    <SectionCard>
      <CardHeader
        title={t("wordpress.reIndex.pageSeo.title", "Per-page SEO")}
        subtitle={t(
          "wordpress.reIndex.pageSeo.subtitle",
          "Overrides for individual posts and pages",
        )}
      />
      <div className="space-y-4 p-5 sm:p-6">
        {pages.length === 0 ? (
          <InfoNote>
            {t(
              "wordpress.reIndex.pageSeo.empty",
              "No pages or posts yet. Once you create one, it will show up here.",
            )}
          </InfoNote>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                icon={<FileText className="h-3.5 w-3.5" />}
                label={t("wordpress.reIndex.pageSeo.total", "Total")}
                value={
                  <span className="tabular-nums">{summary?.total ?? 0}</span>
                }
                tone="neutral"
              />
              <StatTile
                icon={<FileText className="h-3.5 w-3.5" />}
                label={t(
                  "wordpress.reIndex.pageSeo.customTitle",
                  "Custom title",
                )}
                value={
                  <span className="tabular-nums">
                    {summary?.with_title ?? 0}
                  </span>
                }
                tone="neutral"
              />
              <StatTile
                icon={<FileText className="h-3.5 w-3.5" />}
                label={t(
                  "wordpress.reIndex.pageSeo.noDescription",
                  "No description",
                )}
                value={
                  <span className="tabular-nums text-amber-700 dark:text-amber-400">
                    {summary?.no_description ?? 0}
                  </span>
                }
                tone="muted"
              />
              <StatTile
                icon={<FileText className="h-3.5 w-3.5" />}
                label={t(
                  "wordpress.reIndex.pageSeo.hiddenFromSearch",
                  "Hidden from search",
                )}
                value={
                  <span
                    className={`tabular-nums${
                      summary?.hidden ? " text-destructive" : ""
                    }`}
                  >
                    {summary?.hidden ?? 0}
                  </span>
                }
                tone={summary?.hidden ? "muted" : "neutral"}
              />
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t(
                  "wordpress.reIndex.pageSeo.search",
                  "Search by title or slug…",
                )}
                className="pl-9"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-160 text-left">
                <thead>
                  <tr className="border-b border-border text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    <th className="pb-2 pr-3 font-semibold">
                      {t("wordpress.reIndex.pageSeo.colPage", "Page")}
                    </th>
                    <th className="pb-2 pr-3 font-semibold">
                      {t("wordpress.reIndex.pageSeo.colTitle", "SEO title")}
                    </th>
                    <th className="pb-2 pr-3 font-semibold">
                      {t(
                        "wordpress.reIndex.pageSeo.colDesc",
                        "Meta description",
                      )}
                    </th>
                    <th className="pb-2 font-semibold">
                      <span className="sr-only">
                        {t("wordpress.reIndex.pageSeo.colActions", "Actions")}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <PageRow
                      key={row.id}
                      row={row}
                      showType={showType}
                      opening={openingId === row.id}
                      onEdit={(url) => void handleEdit(row.id, url)}
                    />
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t(
                    "wordpress.reIndex.pageSeo.noResults",
                    "No pages match that search.",
                  )}
                </p>
              ) : null}
            </div>

            <InfoNote>
              {t(
                "wordpress.reIndex.pageSeo.note",
                'Values are edited in the "SEO — re:index" panel in the WordPress editor sidebar. Greyed titles are not set on the page itself — they are what your sitewide format or WordPress produces for it.',
              )}
            </InfoNote>
          </>
        )}
      </div>
    </SectionCard>
  );
}
