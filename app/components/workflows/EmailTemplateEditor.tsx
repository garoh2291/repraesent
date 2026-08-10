import { useQuery } from "@tanstack/react-query";
import { Code2, Eye, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Segmented,
  SegmentedButton,
} from "~/components/forms/chrome";
import { Field, FieldHint } from "~/components/wordpress/fields";
import { ResolvedHint } from "./ResolvedHint";
import {
  previewTemplate,
  type LocalizedTemplate,
  type RecentRecord,
} from "~/lib/api/workflows";

/**
 * Per-locale subject + body with a variable picker.
 *
 * Same shape and same `{{variable}}` convention as the Forms confirmation
 * email, deliberately — someone who has written one already knows this. The
 * difference is the variables are dotted paths into the run context, so a
 * template can reach the record, its previous values, or an earlier step.
 */
export function EmailTemplateEditor({
  byLocale,
  locales,
  activeLocale,
  variables,
  disabled,
  workflowId,
  previewRecord,
  onChange,
  onLocaleChange,
}: {
  byLocale: LocalizedTemplate;
  locales: string[];
  activeLocale: string;
  variables: string[];
  disabled?: boolean;
  workflowId: string;
  previewRecord: RecentRecord | null;
  onChange: (next: LocalizedTemplate) => void;
  onLocaleChange: (locale: string) => void;
}) {
  const { t } = useTranslation();
  const [view, setView] = useState<"code" | "preview">("code");
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const current = byLocale[activeLocale] ?? { subject: "", html: "" };

  /**
   * Rendered by the server with the same enricher and renderer the engine
   * uses, so a preview that looks right is right. Debounced by the query key
   * plus a stale window rather than a timer — typing changes the key, and
   * react-query coalesces the bursts.
   */
  const { data: preview } = useQuery({
    queryKey: [
      "workflow-preview",
      workflowId,
      previewRecord?.id,
      current.subject,
      current.html,
    ],
    queryFn: async () => {
      const [subject, body] = await Promise.all([
        previewTemplate(workflowId, {
          entity_id: previewRecord!.id,
          template: current.subject,
          escape: false,
        }),
        previewTemplate(workflowId, {
          entity_id: previewRecord!.id,
          template: current.html,
          escape: true,
        }),
      ]);
      return {
        subject: subject.rendered,
        html: body.rendered,
        unresolved: [...new Set([...subject.unresolved, ...body.unresolved])],
      };
    },
    enabled: !!previewRecord && view === "preview",
    staleTime: 2000,
  });

  const patch = (next: Partial<{ subject: string; html: string }>) =>
    onChange({ ...byLocale, [activeLocale]: { ...current, ...next } });

  /** Insert at the caret — what makes the chips worth clicking. */
  const insert = (path: string) => {
    const token = `{{${path}}}`;
    const el = bodyRef.current;
    if (!el) {
      patch({ html: `${current.html}${token}` });
      return;
    }
    const start = el.selectionStart ?? current.html.length;
    const end = el.selectionEnd ?? start;
    patch({ html: current.html.slice(0, start) + token + current.html.slice(end) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <div className="space-y-4">
      {locales.length > 1 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {locales.map((locale) => {
            const filled = !!byLocale[locale]?.subject && !!byLocale[locale]?.html;
            return (
              <button
                key={locale}
                type="button"
                onClick={() => onLocaleChange(locale)}
                className={`inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
                  locale === activeLocale
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {locale.toUpperCase()}
                {/* A locale with no copy falls back at send time; the dot says
                    which ones are actually written. */}
                <span
                  aria-hidden
                  className={`size-1.5 rounded-full ${
                    filled ? "bg-emerald-500" : "bg-muted-foreground/40"
                  }`}
                />
              </button>
            );
          })}
        </div>
      ) : null}

      <Field>
        <Label htmlFor="wf-subject">{t("workflows.email.subject")}</Label>
        <Input
          id="wf-subject"
          disabled={disabled}
          value={current.subject}
          onChange={(e) => patch({ subject: e.target.value })}
          placeholder={t("workflows.email.subjectPlaceholder")}
        />
        <ResolvedHint
          workflowId={workflowId}
          record={previewRecord}
          template={current.subject}
        />
      </Field>

      <Field>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="wf-body">{t("workflows.email.body")}</Label>
          <Segmented>
            <SegmentedButton
              active={view === "code"}
              onClick={() => setView("code")}
            >
              <Code2 className="h-3.5 w-3.5" />
              {t("workflows.email.viewCode")}
            </SegmentedButton>
            <SegmentedButton
              active={view === "preview"}
              onClick={() => setView("preview")}
            >
              <Eye className="h-3.5 w-3.5" />
              {t("workflows.email.viewPreview")}
            </SegmentedButton>
          </Segmented>
        </div>

        {view === "code" ? (
          <Textarea
            id="wf-body"
            ref={bodyRef}
            rows={10}
            disabled={disabled}
            className="font-mono text-xs"
            value={current.html}
            onChange={(e) => patch({ html: e.target.value })}
          />
        ) : (
          <div className="space-y-2">
            {previewRecord ? (
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {t("workflows.preview.renderedAs", { name: previewRecord.label })}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("workflows.preview.pickToRender")}
              </p>
            )}

            {preview?.subject ? (
              <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-medium">
                {preview.subject}
              </p>
            ) : null}

            <div
              className="min-h-[160px] rounded-xl border border-border bg-card p-4 text-sm"
              // Author-written HTML from an editor in this workspace, shown to
              // its own author. When a record is selected this is the server's
              // rendered output, with variable values already escaped.
              dangerouslySetInnerHTML={{
                __html: preview?.html ?? current.html,
              }}
            />

            {preview?.unresolved.length ? (
              <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                {t("workflows.preview.unresolved", {
                  paths: preview.unresolved.join(", "),
                })}
              </p>
            ) : null}
          </div>
        )}
      </Field>

      {variables.length > 0 ? (
        <div className="space-y-1.5">
          <FieldHint>{t("workflows.email.variablesHint")}</FieldHint>
          <div className="flex flex-wrap gap-1.5">
            {variables.map((path) => (
              <button
                key={path}
                type="button"
                disabled={disabled || view === "preview"}
                onClick={() => insert(path)}
                className="rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                {`{{${path}}}`}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
