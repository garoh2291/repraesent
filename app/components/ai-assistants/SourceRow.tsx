import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  List,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { SourceStatusChip } from "~/components/ai-assistants/SourceStatusChip";
import type { KnowledgeSource, RecrawlInterval } from "~/lib/api/ai-assistants";
import { cn } from "~/lib/utils";

/** "3 days ago" — Intl-based, no dependency. */
export function relativeTime(iso: string, lang: string): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return rtf.format(Math.round(diff / (86400 * 30)), "month");
}

const RECRAWL: Array<{
  value: "off" | "weekly" | "monthly";
  interval: RecrawlInterval;
}> = [
  { value: "off", interval: null },
  { value: "weekly", interval: "weekly" },
  { value: "monthly", interval: "monthly" },
];

/** One knowledge source in the Knowledge panel list. */
export function SourceRow({
  source,
  icon,
  canEdit,
  formatDate,
  formatRelative,
  onResync,
  onDelete,
  onEdit,
  onToggle,
  onRecrawl,
  onViewPages,
}: {
  source: KnowledgeSource;
  icon: React.ReactNode;
  canEdit: boolean;
  formatDate: (iso: string | null) => string | null;
  formatRelative: (iso: string) => string;
  onResync: () => void;
  onDelete: () => void;
  onEdit?: () => void;
  onToggle: (enabled: boolean) => void;
  onRecrawl: (interval: RecrawlInterval) => void;
  onViewPages?: () => void;
}) {
  const { t } = useTranslation();
  const p = source.progress;
  const enabled = source.enabled !== false;
  const isWebsite = source.type === "website";
  const detail: string[] = [];
  if (p?.pages_total != null) {
    detail.push(
      t("aiAssistants.knowledge.progressPages", {
        done: p.pages_done ?? 0,
        total: p.pages_total,
      }),
    );
  } else if (source.page_count != null && source.type !== "text") {
    detail.push(
      t("aiAssistants.knowledge.pages", { count: source.page_count }),
    );
  }
  if (source.status === "embedding" && p?.chunks_done != null) {
    detail.push(
      t("aiAssistants.knowledge.progressChunks", { done: p.chunks_done }),
    );
  } else if (source.chunk_count != null) {
    detail.push(
      t("aiAssistants.knowledge.chunks", { count: source.chunk_count }),
    );
  }
  if (source.size_bytes != null && source.type === "document") {
    detail.push(`${(source.size_bytes / 1024 / 1024).toFixed(1)} MB`);
  }
  const synced = formatDate(source.last_synced_at);
  if (synced && !isWebsite)
    detail.push(t("aiAssistants.knowledge.synced", { when: synced }));

  return (
    <li
      className={cn(
        "flex items-start gap-3 px-3 py-2.5 transition-opacity",
        !enabled && "opacity-55",
      )}
    >
      <span
        aria-hidden
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{source.title}</span>
          <SourceStatusChip status={source.status} />
          {!enabled ? (
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {t("aiAssistants.knowledge.disabled")}
            </span>
          ) : null}
        </div>
        {isWebsite ? (
          <p className="text-[11px] text-muted-foreground">
            {t("aiAssistants.knowledge.lastCrawled")}{" "}
            <span className="text-foreground/80" title={synced ?? undefined}>
              {source.last_synced_at
                ? formatRelative(source.last_synced_at)
                : t("aiAssistants.knowledge.never")}
            </span>
            {source.page_count != null ? (
              <>
                {" "}
                ·{" "}
                {t("aiAssistants.knowledge.pages", {
                  count: source.page_count,
                })}
              </>
            ) : null}
            {source.recrawl_interval && source.next_sync_at ? (
              <>
                {" "}
                ·{" "}
                {t("aiAssistants.knowledge.recrawl.next", {
                  when: formatDate(source.next_sync_at),
                })}
              </>
            ) : null}
          </p>
        ) : null}
        {source.url ? (
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {source.url}
          </p>
        ) : source.original_filename ? (
          <p className="truncate text-[11px] text-muted-foreground">
            {source.original_filename}
          </p>
        ) : null}
        {detail.length > 0 ? (
          <p className="text-[11px] text-muted-foreground">
            {detail.join(" · ")}
          </p>
        ) : null}
        {source.status === "failed" && source.last_error ? (
          <p className="flex items-start gap-1 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span className="min-w-0 break-words">{source.last_error}</span>
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {isWebsite && canEdit ? (
          <Select
            value={
              RECRAWL.find(
                (r) => r.interval === (source.recrawl_interval ?? null),
              )?.value ?? "off"
            }
            onValueChange={(v) =>
              onRecrawl(RECRAWL.find((r) => r.value === v)?.interval ?? null)
            }
          >
            <SelectTrigger
              className="h-7 w-auto gap-1 px-2 text-[11px]"
              aria-label={t("aiAssistants.knowledge.recrawl.label")}
            >
              <RefreshCw className="h-3 w-3" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {RECRAWL.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {t(`aiAssistants.knowledge.recrawl.${r.value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Switch
          checked={enabled}
          disabled={!canEdit}
          onCheckedChange={onToggle}
          aria-label={
            enabled
              ? t("aiAssistants.knowledge.enabled")
              : t("aiAssistants.knowledge.disabled")
          }
          className="scale-90"
        />
        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={source.title}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit ? (
                <DropdownMenuItem onSelect={onEdit}>
                  <Pencil className="h-4 w-4" />
                  {t("common.edit", { defaultValue: "Edit" })}
                </DropdownMenuItem>
              ) : null}
              {onViewPages ? (
                <DropdownMenuItem onSelect={onViewPages}>
                  <List className="h-4 w-4" />
                  {t("aiAssistants.knowledge.pages.view")}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={onResync}>
                <RefreshCw className="h-4 w-4" />
                {t("aiAssistants.knowledge.resync")}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <Trash2 className="h-4 w-4" />
                {t("common.delete", { defaultValue: "Delete" })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </li>
  );
}
