import { useQuery } from "@tanstack/react-query";
import { CornerDownRight, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { previewTemplate, type RecentRecord } from "~/lib/api/workflows";

/**
 * Shows what a single template field actually resolves to.
 *
 * Sits under Send to and Subject. Those are the two fields where a wrong
 * variable is invisible until a run fails — a body renders in the preview pane,
 * but an unresolved `to` just quietly becomes "no recipient address", which is
 * exactly how the contact-email bug went unnoticed.
 */
export function ResolvedHint({
  workflowId,
  entity,
  record,
  template,
  tone = "default",
}: {
  workflowId: string;
  /** The builder's live entity; see EmailTemplateEditor for why it is sent. */
  entity?: string;
  record: RecentRecord | null;
  template: string;
  /** `address` adds an email-shaped sanity check on the result. */
  tone?: "default" | "address";
}) {
  const { t } = useTranslation();

  const { data, error } = useQuery({
    queryKey: ["workflow-resolve", workflowId, entity, record?.id, template],
    queryFn: () =>
      previewTemplate(workflowId, {
        entity_id: record!.id,
        template,
        escape: false,
        entity,
      }),
    enabled: !!record && !!template.trim(),
    staleTime: 2000,
    retry: false,
  });

  if (!record || !template.trim()) return null;

  // `if (!data) return null` used to swallow failures as well as loading, so a
  // broken resolve and a still-loading one were the same silent nothing.
  if (error) {
    return (
      <p className="flex items-start gap-1.5 text-xs text-destructive">
        <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
        <span>{extractErrorMessage(error)}</span>
      </p>
    );
  }
  if (!data) return null;

  const value = data.rendered.trim();
  const empty = value === "";
  const looksWrong =
    tone === "address" && !empty && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(value);

  return (
    <p
      className={`flex items-start gap-1.5 text-xs ${
        empty || looksWrong
          ? "text-amber-700 dark:text-amber-300"
          : "text-muted-foreground"
      }`}
    >
      {empty || looksWrong ? (
        <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
      ) : (
        <CornerDownRight className="mt-0.5 h-3 w-3 shrink-0" />
      )}
      <span className="min-w-0 break-all">
        {empty
          ? t("workflows.preview.resolvesEmpty", { name: record.label })
          : looksWrong
            ? t("workflows.preview.resolvesNotEmail", { value })
            : t("workflows.preview.resolvesTo", { value })}
      </span>
    </p>
  );
}
