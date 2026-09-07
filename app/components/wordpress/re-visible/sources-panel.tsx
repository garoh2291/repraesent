import { useTranslation } from "react-i18next";
import { ExternalLink, Globe, Link2 } from "lucide-react";
import {
  CardBody,
  CardHeader,
  InfoNote,
  SectionCard,
} from "~/components/wordpress/fields";
import type { SourcesResponse } from "~/lib/api/re-visible";

/**
 * Where the answers came from.
 *
 * The third-party table is the highest-value thing in the whole feature and the
 * one thing a WordPress plugin can do nothing about: it names the pages the
 * engines trust for these questions. Getting mentioned there is the work.
 * Presented as a to-do list rather than as analytics, for that reason.
 */
export function SourcesPanel({
  data,
  loading,
}: {
  data: SourcesResponse | undefined;
  loading: boolean;
}) {
  const { t } = useTranslation();

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;
  }

  const thirdParty = data?.third_party ?? [];
  const ownPages = data?.own_pages ?? [];
  const max = thirdParty[0]?.count ?? 1;

  return (
    <div className="space-y-6">
      <SectionCard>
        <CardHeader
          icon={<Globe className="size-4" aria-hidden />}
          title={t(
            "wordpress.reVisible.sourcesTitle",
            "Where the engines get their answers",
          )}
          subtitle={t(
            "wordpress.reVisible.sourcesSubtitle",
            "Other people's pages, cited while answering your questions. Being present on these is what moves the numbers.",
          )}
        />
        <CardBody>
          {thirdParty.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t(
                "wordpress.reVisible.sourcesEmpty",
                "Run a check to see which sources the engines used.",
              )}
            </p>
          ) : (
            <ul className="space-y-2">
              {thirdParty.slice(0, 30).map((source) => (
                <li key={source.domain} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <a
                      href={`https://${source.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-sm hover:underline"
                    >
                      {source.domain}
                    </a>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {t("wordpress.reVisible.citedTimes", "{{count}}x", {
                        count: source.count,
                      })}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/60"
                      style={{
                        width: `${Math.round((source.count / max) * 100)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </SectionCard>

      <SectionCard>
        <CardHeader
          icon={<Link2 className="size-4" aria-hidden />}
          title={t("wordpress.reVisible.ownPagesTitle", "Your pages that got cited")}
          subtitle={t(
            "wordpress.reVisible.ownPagesSubtitle",
            "These are working. They are the model for the rest of the site.",
          )}
        />
        <CardBody>
          {ownPages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t(
                "wordpress.reVisible.ownPagesEmpty",
                "No page of yours has been cited yet. The Site tab lists what is holding that back.",
              )}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {ownPages.slice(0, 30).map((page) => (
                <li key={page.url} className="flex items-baseline gap-2">
                  <a
                    href={page.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-w-0 items-center gap-1.5 text-sm hover:underline"
                  >
                    <ExternalLink className="size-3 shrink-0" aria-hidden />
                    <span className="truncate">{pathOf(page.url)}</span>
                  </a>
                  <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                    {page.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </SectionCard>

      <InfoNote>
        {t(
          "wordpress.reVisible.sourcesAdvice",
          "Third-party mentions correlate with AI citations about three times more strongly than backlinks do. A profile on the review sites and forums above, or a mention in the publications listed, does more than any on-page change.",
        )}
      </InfoNote>
    </div>
  );
}

/** Path only: the domain is the client's own and repeats on every row. */
function pathOf(url: string): string {
  try {
    const parsed = new URL(url);

    return parsed.pathname === "/" ? url : parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}
