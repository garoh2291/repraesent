import { Check, Copy, Inbox } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Field, FieldHint } from "~/components/wordpress/fields";
import type { FormIntakeConfig } from "~/lib/forms/schema";

/** Recognised without any configuration — the keys real form builders emit. */
const AUTO_MAPPED: { column: string; keys: string }[] = [
  { column: "email", keys: "email, e-mail, mail, your_email" },
  { column: "first_name", keys: "first_name, firstName, fname, vorname" },
  { column: "last_name", keys: "last_name, surname, lastName, nachname" },
  { column: "full_name", keys: "full_name, name, your_name" },
  { column: "phone", keys: "phone, tel, telephone, mobile" },
];

/**
 * Everything an intake form is.
 *
 * There is no canvas, no fields, no preview — the form is a URL somebody pastes
 * into a tool we have never heard of. So the page answers the three questions
 * that URL raises, in the order they come up: where do I send it, what happens
 * to what I send, and did anything actually arrive.
 *
 * The last one is the part that makes this usable. Nobody can recall the exact
 * key names their form builder emits, so instead of asking them to guess, the
 * page shows the most recent body it received and they map against something
 * real.
 */
export function IntakeSetupPanel({
  formId,
  intake,
}: {
  formId: string;
  intake: FormIntakeConfig | undefined;
}) {
  const { t, i18n } = useTranslation();
  const [copied, setCopied] = useState<"url" | "curl" | null>(null);

  const base =
    typeof window === "undefined"
      ? ""
      : (import.meta.env.VITE_API_URL as string | undefined) ||
        `${window.location.origin}/api`;
  const url = `${base.replace(/\/$/, "")}/public/forms/${formId}/intake`;

  const curl = `curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -d '{"email":"someone@example.com","name":"Ada Lovelace"}'`;

  const copy = async (what: "url" | "curl", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error(
        t("pipeline.tracking.copyFailed", {
          defaultValue: "Could not copy. Select it and copy manually.",
        }),
      );
    }
  };

  const last = intake?.lastPayload ?? null;

  return (
    <div className="space-y-6">
      <Field>
        <Label htmlFor="intake-url">
          {t("forms.builder.intakeUrlLabel", {
            defaultValue: "Your intake URL",
          })}
        </Label>
        <div className="flex gap-1.5">
          <Input
            id="intake-url"
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => copy("url", url)}
            aria-label={t("common.copy", { defaultValue: "Copy" })}
            className="shrink-0 rounded-lg border border-border px-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {copied === "url" ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
        <FieldHint>
          {t("forms.builder.intakeUrlHint", {
            defaultValue:
              "Anyone with this URL can create a lead in this workspace. Treat it like a password.",
          })}
        </FieldHint>
      </Field>

      <Field>
        <div className="flex items-center justify-between gap-2">
          <Label>{t("forms.builder.intakeCurl", { defaultValue: "Try it" })}</Label>
          <button
            type="button"
            onClick={() => copy("curl", curl)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {copied === "curl" ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {t("common.copy", { defaultValue: "Copy" })}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-xl border border-border bg-muted/40 p-3 text-[11px] leading-relaxed">
          <code>{curl}</code>
        </pre>
      </Field>

      <Field>
        <Label>
          {t("forms.builder.intakeMappingTitle", {
            defaultValue: "What we do with what arrives",
          })}
        </Label>
        <div className="overflow-hidden rounded-xl border border-border">
          {AUTO_MAPPED.map((row, index) => (
            <div
              key={row.column}
              className={`grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-3 px-3 py-2 text-xs ${
                index > 0 ? "border-t border-border" : ""
              }`}
            >
              <span className="font-mono text-foreground">{row.column}</span>
              <span className="min-w-0 break-words text-muted-foreground">
                {row.keys}
              </span>
            </div>
          ))}
        </div>
        <FieldHint>
          {t("forms.builder.intakeMappingHint", {
            defaultValue:
              "Recognised keys map themselves. Everything else is kept on the lead.",
          })}
        </FieldHint>
      </Field>

      <Field>
        <Label>
          {t("forms.builder.intakeLastPayloadTitle", {
            defaultValue: "Last received",
          })}
        </Label>
        {last ? (
          <>
            <pre className="max-h-72 overflow-auto rounded-xl border border-border bg-muted/40 p-3 text-[11px] leading-relaxed">
              <code>{JSON.stringify(last.body, null, 2)}</code>
            </pre>
            <FieldHint>
              {t("forms.builder.intakeLastPayloadAt", {
                date: new Intl.DateTimeFormat(i18n.language, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(last.at)),
                defaultValue: "Received {{date}}",
              })}
            </FieldHint>
          </>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-dashed border-border p-4">
            <Inbox
              className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("forms.builder.intakeLastPayloadEmpty", {
                defaultValue:
                  "Nothing yet. Point your form at the URL and submit once — the keys it sends will show up here.",
              })}
            </p>
          </div>
        )}
      </Field>
    </div>
  );
}
