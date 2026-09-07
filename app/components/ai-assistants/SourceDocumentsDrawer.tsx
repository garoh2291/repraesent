import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, ExternalLink, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  useSourceDocumentContent,
  useSourceDocuments,
} from "~/lib/hooks/useAiAssistants";
import type { KnowledgeSource, SourceDocument } from "~/lib/api/ai-assistants";

/** The pages a crawl produced — what the assistant actually read. */
export function SourceDocumentsDrawer({
  assistantId,
  source,
  onClose,
}: {
  assistantId: string;
  source: KnowledgeSource | null;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useSourceDocuments(assistantId, source?.id);
  const [viewing, setViewing] = useState<SourceDocument | null>(null);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  return (
    <Sheet open={!!source} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="truncate">{source?.title}</SheetTitle>
          <SheetDescription>
            {data
              ? t("aiAssistants.knowledge.pages.count", { count: data.length })
              : t("aiAssistants.knowledge.pages.title")}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          {isLoading || !data ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {t("aiAssistants.knowledge.pages.empty")}
            </p>
          ) : (
            <ul className="divide-y divide-border/70">
              {data.map((d) => (
                <li key={d.id} className="flex items-start gap-3 px-4 py-3">
                  <span
                    aria-hidden
                    className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                  >
                    <FileText className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-sm font-medium">
                      {d.title || d.url || d.id}
                    </p>
                    {d.url ? (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-full items-center gap-1 truncate font-mono text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        <span className="truncate">{d.url}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ) : null}
                    <p className="text-[11px] tabular-nums text-muted-foreground">
                      {t("aiAssistants.knowledge.chunks", {
                        count: d.chunk_count,
                      })}
                      {" · "}
                      {t("aiAssistants.knowledge.pages.chars", {
                        count: d.char_count,
                      })}
                      {" · "}
                      {formatDate(d.updated_at)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 text-xs"
                    disabled={!d.has_content}
                    onClick={() => setViewing(d)}
                    title={
                      d.has_content
                        ? undefined
                        : t("aiAssistants.knowledge.pages.noContent")
                    }
                  >
                    {t("aiAssistants.knowledge.pages.viewText")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>

      <DocumentContentDialog
        assistantId={assistantId}
        sourceId={source?.id}
        doc={viewing}
        onClose={() => setViewing(null)}
      />
    </Sheet>
  );
}

function DocumentContentDialog({
  assistantId,
  sourceId,
  doc,
  onClose,
}: {
  assistantId: string;
  sourceId: string | undefined;
  doc: SourceDocument | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = useSourceDocumentContent(
    assistantId,
    sourceId,
    doc?.id,
  );

  const copy = () => {
    if (!data?.content_md) return;
    void navigator.clipboard.writeText(data.content_md);
    toast.success(t("aiAssistants.share.copied"));
  };

  return (
    <Dialog open={!!doc} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="min-w-0">
              <DialogTitle className="truncate">
                {doc?.title || doc?.url || ""}
              </DialogTitle>
              <DialogDescription className="truncate">
                {doc?.url ? (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs hover:underline"
                  >
                    {doc.url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  t("aiAssistants.knowledge.pages.viewText")
                )}
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0"
              disabled={!data}
              onClick={copy}
            >
              <Copy className="h-3.5 w-3.5" />
              {t("aiAssistants.share.copy")}
            </Button>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4 sm:px-6">
          {isLoading || !data ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("common.loading", { defaultValue: "Loading…" })}
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">
              {data.content_md}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
