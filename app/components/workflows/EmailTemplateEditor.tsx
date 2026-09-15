import { useQuery } from "@tanstack/react-query";
import { Code2, Eye, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Segmented, SegmentedButton } from "~/components/forms/chrome";
import { EmailHtmlFrame } from "~/components/email-campaigns/EmailHtmlFrame";
import { UseTemplatePicker } from "~/components/email-campaigns/UseTemplatePicker";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { Field, FieldHint } from "~/components/wordpress/fields";
import { ResolvedHint } from "./ResolvedHint";
import { VariablePicker } from "./VariablePicker";
import {
  previewTemplate,
  type CatalogField,
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
  fields,
  disabled,
  workflowId,
  entity,
  previewRecord,
  onChange,
  onLocaleChange,
}: {
  byLocale: LocalizedTemplate;
  locales: string[];
  activeLocale: string;
  fields: CatalogField[];
  disabled?: boolean;
  workflowId: string;
  /**
   * The record type the builder is showing right now, which is not always the
   * one the saved draft names. Sent with the preview so switching the trigger
   * does not break previews until you remember to save.
   */
  entity: string;
  previewRecord: RecentRecord | null;
  onChange: (next: LocalizedTemplate) => void;
  onLocaleChange: (locale: string) => void;
}) {
  const { t } = useTranslation();
  const [view, setView] = useState<"code" | "preview">("code");
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const subjectRef = useRef<HTMLInputElement | null>(null);
  /**
   * Which box the author was last typing in.
   *
   * The picker used to splice into the body unconditionally, so clicking a
   * variable while the caret sat in the Subject silently appended it to the
   * body instead — the value went somewhere the author was not looking.
   */
  const [focused, setFocused] = useState<"subject" | "html">("html");

  const current = byLocale[activeLocale] ?? { subject: "", html: "" };

  /**
   * Rendered by the server with the same enricher and renderer the engine
   * uses, so a preview that looks right is right. Debounced by the query key
   * plus a stale window rather than a timer — typing changes the key, and
   * react-query coalesces the bursts.
   */
  const {
    data: preview,
    isFetching: previewLoading,
    error: previewError,
  } = useQuery({
    queryKey: [
      "workflow-preview",
      workflowId,
      entity,
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
          entity,
        }),
        previewTemplate(workflowId, {
          entity_id: previewRecord!.id,
          template: current.html,
          escape: true,
          entity,
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
    // A preview that failed must say so, not retry three times in silence.
    retry: false,
  });

  const patch = (next: Partial<{ subject: string; html: string }>) =>
    onChange({ ...byLocale, [activeLocale]: { ...current, ...next } });

  /** Insert at the caret, into whichever field the author was last in. */
  const spliceAtCaret = (token: string) => {
    const field = focused;
    const el = field === "subject" ? subjectRef.current : bodyRef.current;
    const value = field === "subject" ? current.subject : current.html;

    if (!el) {
      patch({ [field]: `${value}${token}` } as Partial<typeof current>);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? start;
    patch({
      [field]: value.slice(0, start) + token + value.slice(end),
    } as Partial<typeof current>);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const insert = (path: string) => spliceAtCaret(`{{${path}}}`);

  return (
    <div className="space-y-4">
      {locales.length > 1 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {locales.map((locale) => {
            const filled =
              !!byLocale[locale]?.subject && !!byLocale[locale]?.html;
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
          ref={subjectRef}
          disabled={disabled}
          value={current.subject}
          onFocus={() => setFocused("subject")}
          onChange={(e) => patch({ subject: e.target.value })}
          placeholder={t("workflows.email.subjectPlaceholder")}
        />
        <ResolvedHint
          workflowId={workflowId}
          entity={entity}
          record={previewRecord}
          template={current.subject}
        />
      </Field>

      <Field>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="wf-body">{t("workflows.email.body")}</Label>
          <div className="flex items-center gap-2">
            {/* Fills subject + body of the ACTIVE locale from the shared
                template library. Additive — the editor stays the editor. */}
            <UseTemplatePicker
              locale={activeLocale}
              locales={locales}
              disabled={disabled}
              onInsert={({ subject, html }) => patch({ subject, html })}
              onInsertLocales={(byLocaleCopy) =>
                onChange({ ...byLocale, ...byLocaleCopy })
              }
              templateHref={(id) => `/email-templates/${id}`}
              buttonClassName={
                "inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              }
            />
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
        </div>

        {view === "code" ? (
          <Textarea
            id="wf-body"
            ref={bodyRef}
            rows={10}
            disabled={disabled}
            onFocus={() => setFocused("html")}
            className="font-mono text-xs"
            value={current.html}
            onChange={(e) => patch({ html: e.target.value })}
          />
        ) : (
          <div className="space-y-2">
            {previewRecord ? (
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {t("workflows.preview.renderedAs", {
                  name: previewRecord.label,
                })}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("workflows.preview.pickToRender")}
              </p>
            )}

            {previewError ? (
              /* This is the whole reason "previews don't work" was the report
                 rather than an error message: every failure used to fall
                 through to rendering the unrendered source, which looks
                 exactly like a preview of a template with no variables in it. */
              <p className="flex items-start gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{extractErrorMessage(previewError)}</span>
              </p>
            ) : null}

            {preview?.subject ? (
              <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-medium">
                {preview.subject}
              </p>
            ) : null}

            {/* Framed, not inlined. This is a whole email document — MJML's
                <head> carries global CSS (`a { color:#2563eb }`, `body`, `p`,
                `table`) which, injected into the app's DOM, restyled the entire
                page and turned every link in the UI blue. */}
            <div className="relative">
              <EmailHtmlFrame
                title={t("workflows.preview.title", {
                  defaultValue: "Email preview",
                })}
                /* Only ever the SERVER's render. Falling back to `current.html`
                   showed raw {{paths}} and passed it off as the result. When
                   there is nothing to show, show nothing and say why. */
                html={preview?.html ?? ""}
                className="block h-[360px] w-full rounded-xl border border-border bg-white"
              />
              {previewLoading ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/60 text-xs text-muted-foreground backdrop-blur-[1px]">
                  {t("workflows.preview.rendering", {
                    defaultValue: "Rendering…",
                  })}
                </div>
              ) : null}
            </div>

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

      <div className="flex items-center gap-2">
        <VariablePicker
          fields={fields}
          disabled={disabled || view === "preview"}
          onInsert={insert}
        />
        <FieldHint>
          {focused === "subject"
            ? t("workflows.variables.intoSubject", {
                defaultValue: "Inserts into the subject",
              })
            : t("workflows.variables.intoBody", {
                defaultValue: "Inserts into the message",
              })}
        </FieldHint>
      </div>
    </div>
  );
}
