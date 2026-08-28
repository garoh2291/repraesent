import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { TemplateBuilder } from "~/components/email-campaigns/builder/TemplateBuilder";
import { Skeleton } from "~/components/ui/skeleton";
import { getEmailTemplate } from "~/lib/api/email-templates";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";

export default function EmailTemplateBuilderRoute() {
  const { t } = useTranslation();
  const { templateId } = useParams<{ templateId: string }>();

  const { data: template, isPending } = useQuery({
    queryKey: ["email-template", templateId],
    queryFn: () => getEmailTemplate(templateId!),
    enabled: !!templateId,
  });

  useDocumentMeta({
    titleKey: "emailCampaigns.templates.metaTitle",
    titleSuffix: " - Repraesent",
  });

  if (isPending || !template) {
    return (
      <div className="mx-auto w-full max-w-[1280px] space-y-5 p-4 pb-10! pt-4! sm:p-6 sm:pt-6!">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-9 w-72 rounded-lg" />
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_340px]">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="hidden h-64 rounded-2xl xl:block" />
        </div>
      </div>
    );
  }

  return <TemplateBuilder template={template} />;
}
