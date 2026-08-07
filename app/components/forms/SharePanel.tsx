import { useQuery } from "@tanstack/react-query";
import { Code2, Copy, ExternalLink, Link2, MonitorPlay } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import {
  CardBody,
  CardHeader,
  InfoNote,
  SectionCard,
} from "~/components/wordpress/fields";
import { getFormSnippet, type SnippetMode } from "~/lib/api/forms";
import { buildPublicFormUrl } from "~/lib/config";
import type { FormLocale } from "~/lib/forms/schema";

interface Props {
  formId: string;
  status: "draft" | "published";
  hasUnpublishedChanges: boolean;
  defaultLocale: FormLocale;
}

export function SharePanel({
  formId,
  status,
  hasUnpublishedChanges,
  defaultLocale,
}: Props) {
  const { t } = useTranslation();
  const published = status === "published";
  const publicUrl = buildPublicFormUrl(formId);

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(t("forms.share.copied"));
  };

  if (!published) {
    return <InfoNote>{t("forms.share.publishFirst")}</InfoNote>;
  }

  return (
    <div className="space-y-4">
      {hasUnpublishedChanges ? (
        <InfoNote>{t("forms.share.htmlWarning")}</InfoNote>
      ) : null}

      <SectionCard>
        <CardHeader
          icon={<Link2 className="h-4 w-4" />}
          title={t("forms.share.linkTitle")}
          subtitle={t("forms.share.linkHint")}
          muted
        />
        <CardBody>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              readOnly
              value={publicUrl}
              className="h-10 flex-1 font-mono text-sm"
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => copy(publicUrl)}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-sm transition-colors hover:bg-muted"
              >
                <Copy className="h-3.5 w-3.5" />
                {t("forms.share.copy")}
              </button>
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-sm transition-colors hover:bg-muted"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t("forms.share.open")}
              </a>
            </div>
          </div>
        </CardBody>
      </SectionCard>

      <SnippetCard
        formId={formId}
        mode="iframe"
        locale={defaultLocale}
        icon={<MonitorPlay className="h-4 w-4" />}
        title={t("forms.share.iframeTitle")}
        subtitle={t("forms.share.iframeHint")}
        onCopy={copy}
      />

      <SnippetCard
        formId={formId}
        mode="script"
        locale={defaultLocale}
        icon={<Code2 className="h-4 w-4" />}
        title={t("forms.share.scriptTitle")}
        subtitle={t("forms.share.scriptHint")}
        onCopy={copy}
      />

      <SnippetCard
        formId={formId}
        mode="html"
        locale={defaultLocale}
        icon={<Code2 className="h-4 w-4" />}
        title={t("forms.share.htmlTitle")}
        subtitle={t("forms.share.htmlHint")}
        warning={t("forms.share.htmlWarning")}
        onCopy={copy}
      />
    </div>
  );
}

function SnippetCard({
  formId,
  mode,
  locale,
  icon,
  title,
  subtitle,
  warning,
  onCopy,
}: {
  formId: string;
  mode: SnippetMode;
  locale: FormLocale;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  warning?: string;
  onCopy: (text: string) => void;
}) {
  const { t } = useTranslation();

  // Fetched per mode and cached: the HTML snippet in particular is large, and
  // regenerating it on every tab render would be wasteful.
  const { data: snippet, isLoading } = useQuery({
    queryKey: ["form-snippet", formId, mode, locale],
    queryFn: () => getFormSnippet(formId, mode, locale),
  });

  return (
    <SectionCard>
      <CardHeader
        icon={icon}
        title={title}
        subtitle={subtitle}
        muted
        action={
          <button
            type="button"
            disabled={!snippet}
            onClick={() => snippet && onCopy(snippet)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm transition-colors hover:bg-muted disabled:opacity-50"
          >
            <Copy className="h-3.5 w-3.5" />
            {t("forms.share.copy")}
          </button>
        }
      />
      <CardBody>
        {warning ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {warning}
          </p>
        ) : null}
        {isLoading ? (
          <Skeleton className="h-28 w-full rounded-lg" />
        ) : (
          <pre className="max-h-64 select-all overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
            {snippet}
          </pre>
        )}
      </CardBody>
    </SectionCard>
  );
}
