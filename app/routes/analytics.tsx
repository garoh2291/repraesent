import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import i18n from "~/i18n";
import { useAuthContext } from "~/providers/auth-provider";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { workspaceScope } from "~/lib/api/website-stats";
import { PageContainer, PageHeader } from "~/components/notebook/page-header";
import { Panel } from "~/components/notebook/panel";
import { EmptyState } from "~/components/notebook/empty-state";
import { Button } from "~/components/ui/button";
import { WebsiteStatsExplorer } from "~/components/analytics/website-stats-explorer";

export function meta() {
  return [
    { title: i18n.t("analytics.metaTitle") },
    { name: "description", content: i18n.t("analytics.metaDescription") },
  ];
}

/** Website visitors: Plausible-level stats from pa-002, drawn in our own style. */
export default function Analytics() {
  const { t } = useTranslation();
  useDocumentMeta({ titleKey: "analytics.metaTitle", descriptionKey: "analytics.metaDescription" });
  const { currentWorkspace } = useAuthContext();
  const tracked = currentWorkspace?.has_plausible_analytics ?? false;

  if (!tracked) {
    return (
      <PageContainer className="space-y-6">
        <PageHeader
          eyebrow={t("sections.results", "Results")}
          title={t("analytics.title")}
          subtitle={t("analytics.subtitle")}
        />
        <Panel className="p-5 sm:p-6">
          <EmptyState
            icon={<Globe className="size-5" aria-hidden />}
            title={t("analytics.notTrackedTitle")}
            body={t("analytics.notTrackedBody")}
            action={
              <Button asChild variant="outline">
                <Link to="/website">{t("analytics.notTrackedAction")}</Link>
              </Button>
            }
          />
        </Panel>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-5">
      <WebsiteStatsExplorer
        scope={workspaceScope(currentWorkspace?.id)}
        header={({ site, live }) => (
          <PageHeader
            eyebrow={t("sections.results", "Results")}
            title={t("analytics.title")}
            subtitle={site ?? t("analytics.subtitle")}
            actions={live}
          />
        )}
      />
    </PageContainer>
  );
}
