import { useTranslation } from "react-i18next";
import {
  Code2,
  Copy,
  ExternalLink,
  FileCode2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  GhostAction,
  Panel,
  PanelBody,
  PanelHeader,
} from "~/components/forms/chrome";
import { FieldHint, InfoNote } from "~/components/wordpress/fields";
import { AdvancedSection } from "~/components/notebook/advanced-section";
import { CopyForWebPerson } from "~/components/notebook/copy-for-web-person";
import { setLocalFlag } from "~/components/notebook/setup-checklist";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { WidgetTypeIcon } from "~/components/ai-assistants/WidgetTypeIcon";
import { useAiSnippet } from "~/lib/hooks/useAiAssistants";
import {
  WIDGET_TYPES,
  type AssistantStatus,
  type SnippetMode,
  type WidgetType,
} from "~/lib/api/ai-assistants";

/** Lines of the inlined bundle shown before the preview is cut off. */
const HTML_PREVIEW_LINES = 40;

function formatKb(bytes: number): string {
  return `~${Math.max(1, Math.round(bytes / 1024))} KB`;
}

interface Props {
  assistantId: string;
  status: AssistantStatus;
  hasUnpublishedChanges: boolean;
  widgetType: WidgetType;
}

export function PublishPanel({
  assistantId,
  status,
  hasUnpublishedChanges,
  widgetType,
}: Props) {
  const { t } = useTranslation();
  const published = status === "published";
  const copiedFlag = `ai-copied:${assistantId}`;

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(t("aiAssistants.share.copied"));
  };

  // Same shape as the forms Share tab: the link we host first (it works with
  // no web person at all), then the one piece of code that matches the chosen
  // look, ready to copy or email. Everything else — the other looks, the
  // inlined HTML block, the CSP lines — is for whoever edits the site.
  const others: SnippetMode[] = [
    "html",
    ...WIDGET_TYPES.filter((m) => m !== widgetType && m !== "page"),
  ];

  return (
    <div className="space-y-5">
      {!published ? (
        <InfoNote>{t("aiAssistants.share.publishFirst")}</InfoNote>
      ) : hasUnpublishedChanges ? (
        <InfoNote>{t("aiAssistants.share.unpublishedWarning")}</InfoNote>
      ) : null}

      <HostedPageCard
        assistantId={assistantId}
        onCopy={(text) => {
          copy(text);
          // Sharing the hosted link is how a "page" assistant gets onto the
          // website, so it ticks the same checklist step as the code does.
          setLocalFlag(copiedFlag);
        }}
      />

      {widgetType !== "page" ? (
        <RecommendedSnippet
          assistantId={assistantId}
          mode={widgetType}
          copiedFlag={copiedFlag}
        />
      ) : null}

      <AdvancedSection
        storageKey="ai-publish"
        hint={t("aiAssistants.share.advancedHint")}
      >
        {others.map((mode) => (
          <SnippetCard
            key={mode}
            assistantId={assistantId}
            mode={mode}
            primary={false}
            onCopy={copy}
          />
        ))}
        <CspCard assistantId={assistantId} onCopy={copy} />
      </AdvancedSection>
    </div>
  );
}

/** The page we host: a link the owner can share themselves, today. */
function HostedPageCard({
  assistantId,
  onCopy,
}: {
  assistantId: string;
  onCopy: (text: string) => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = useAiSnippet(assistantId, "page");
  const url = data?.page_url;
  return (
    <Panel>
      <PanelHeader
        icon={<WidgetTypeIcon type="page" className="h-3.5 w-3.5" />}
        title={t("aiAssistants.share.pageTitle")}
      />
      <PanelBody>
        <FieldHint>{t("aiAssistants.share.pageHint")}</FieldHint>
        {isLoading ? (
          <Skeleton className="h-11 w-full rounded-lg" />
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1 select-text break-all rounded-lg border bg-muted/40 px-3 py-2.5 font-mono text-sm">
              {url}
            </p>
            <div className="flex shrink-0 gap-2">
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-sm transition-colors hover:bg-muted sm:h-10"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  {t("aiAssistants.share.pageUrlOpen")}
                </a>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="h-11 sm:h-10"
                disabled={!url}
                onClick={() => url && onCopy(url)}
              >
                <Copy className="h-3.5 w-3.5" aria-hidden />
                {t("aiAssistants.share.copyLink")}
              </Button>
            </div>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

/** The code for the look picked under "Look", worded for the owner. */
function RecommendedSnippet({
  assistantId,
  mode,
  copiedFlag,
}: {
  assistantId: string;
  mode: WidgetType;
  copiedFlag: string;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = useAiSnippet(assistantId, mode);
  const where = t(`aiAssistants.share.${mode}Hint`);
  return (
    <Panel>
      <PanelHeader
        icon={<WidgetTypeIcon type={mode} className="h-3.5 w-3.5" />}
        title={t("aiAssistants.share.recommendedTitle")}
        meta={
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {t(`aiAssistants.widgetType.${mode}`)}
          </span>
        }
      />
      <PanelBody>
        {isLoading || !data?.snippet ? (
          <Skeleton className="h-24 w-full rounded-lg" />
        ) : (
          <CopyForWebPerson
            code={data.snippet}
            hint={where}
            emailSubject={t("aiAssistants.share.emailSubject")}
            emailIntro={`${t("aiAssistants.share.emailIntro")}\n\n${where}`}
            copiedFlag={copiedFlag}
          />
        )}
      </PanelBody>
    </Panel>
  );
}

function SnippetCard({
  assistantId,
  mode,
  primary,
  onCopy,
}: {
  assistantId: string;
  mode: SnippetMode;
  primary: boolean;
  onCopy: (text: string) => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = useAiSnippet(assistantId, mode);
  const isPage = mode === "page";
  const isHtml = mode === "html";
  const text = isPage ? data?.page_url : data?.snippet;

  // The HTML block carries the whole widget bundle (~80 KB): copy all of it,
  // but only put the first lines in the DOM.
  const preview = (() => {
    if (!isHtml || !data?.snippet) return { text: data?.snippet, cut: false };
    const lines = data.snippet.split("\n");
    if (lines.length <= HTML_PREVIEW_LINES) return { text: data.snippet, cut: false };
    const head = lines.slice(0, HTML_PREVIEW_LINES).map((l) =>
      l.length > 400 ? `${l.slice(0, 400)}…` : l,
    );
    return { text: `${head.join("\n")}\n…`, cut: true };
  })();

  return (
    <Panel>
      <PanelHeader
        icon={
          isHtml ? (
            <FileCode2 className="h-3.5 w-3.5" />
          ) : (
            <WidgetTypeIcon type={mode} className="h-3.5 w-3.5" />
          )
        }
        title={t(`aiAssistants.share.${mode}Title`)}
        meta={
          primary ? (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {t("aiAssistants.share.configured")}
            </span>
          ) : isHtml && data?.bytes ? (
            <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {t("aiAssistants.share.htmlSize", {
                size: formatKb(data.bytes),
              })}
            </span>
          ) : null
        }
        action={
          <div className="flex gap-2">
            {isPage && data?.page_url ? (
              <a
                href={data.page_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-sm transition-colors hover:bg-muted"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t("aiAssistants.share.pageUrlOpen")}
              </a>
            ) : null}
            <GhostAction disabled={!text} onClick={() => text && onCopy(text)}>
              <Copy className="h-3.5 w-3.5" />
              {t("aiAssistants.share.copy")}
            </GhostAction>
          </div>
        }
      />
      <PanelBody>
        <FieldHint>{t(`aiAssistants.share.${mode}Hint`)}</FieldHint>
        {isHtml ? (
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
            {t("aiAssistants.share.htmlWarning")}
          </p>
        ) : null}
        {isLoading ? (
          <Skeleton className="h-24 w-full rounded-lg" />
        ) : isPage ? (
          <div className="rounded-lg border bg-muted/40 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t("aiAssistants.share.pageUrl")}
            </p>
            <p className="mt-1 select-text break-all font-mono text-sm">
              {data?.page_url}
            </p>
          </div>
        ) : (
          <>
            <pre className="max-h-64 select-text overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
              {preview.text}
            </pre>
            {preview.cut ? (
              <p className="text-[11px] text-muted-foreground">
                {t("aiAssistants.share.htmlPreviewNote", {
                  lines: HTML_PREVIEW_LINES,
                })}
              </p>
            ) : null}
          </>
        )}
      </PanelBody>
    </Panel>
  );
}

function CspCard({
  assistantId,
  onCopy,
}: {
  assistantId: string;
  onCopy: (text: string) => void;
}) {
  const { t } = useTranslation();
  const { data } = useAiSnippet(assistantId, "bubble");
  const origin = data?.api_origin;
  if (!origin) return null;

  const local = /^https?:\/\/(localhost|127\.|\[?::1)/i.test(origin);
  const directives = [
    `script-src  ${origin};`,
    `connect-src ${origin};`,
    `font-src    ${origin};`,
  ].join("\n");

  return (
    <Panel>
      <PanelHeader
        icon={<ShieldCheck className="h-3.5 w-3.5" />}
        title={t("aiAssistants.share.cspTitle")}
        action={
          <GhostAction onClick={() => onCopy(directives)}>
            <Copy className="h-3.5 w-3.5" />
            {t("aiAssistants.share.copy")}
          </GhostAction>
        }
      />
      <PanelBody>
        <FieldHint>{t("aiAssistants.share.cspHint")}</FieldHint>
        {local ? (
          <p className="text-xs font-medium text-red-600 dark:text-red-400">
            {t("aiAssistants.share.localhostWarning", { origin })}
          </p>
        ) : null}
        <pre className="overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
          {directives}
        </pre>
        <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Code2 className="h-3 w-3" aria-hidden />
          {t("aiAssistants.share.apiOrigin")}{" "}
          <span className="font-mono">{origin}</span>
        </p>
        <p className="text-[11px] text-muted-foreground">
          {t("aiAssistants.share.cspHtmlNote")}
        </p>
      </PanelBody>
    </Panel>
  );
}
