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

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(t("aiAssistants.share.copied"));
  };

  if (!published) {
    return <InfoNote>{t("aiAssistants.share.publishFirst")}</InfoNote>;
  }

  // The configured type first, then the self-contained HTML block for the
  // same type; the other types are still offered — a bubble site may want the
  // section on its contact page or the hosted page in an email.
  const modes: SnippetMode[] = [
    widgetType,
    "html",
    ...WIDGET_TYPES.filter((m) => m !== widgetType),
  ];

  return (
    <div className="space-y-5">
      {hasUnpublishedChanges ? (
        <InfoNote>{t("aiAssistants.share.unpublishedWarning")}</InfoNote>
      ) : null}

      {modes.map((mode) => (
        <SnippetCard
          key={mode}
          assistantId={assistantId}
          mode={mode}
          primary={mode === widgetType}
          onCopy={copy}
        />
      ))}

      <CspCard assistantId={assistantId} onCopy={copy} />

    </div>
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
