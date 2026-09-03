import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  submitPlaygroundLead,
  type RetrievalDebug,
  type SseLeadForm,
} from "~/lib/api/ai-assistants";
import { cn } from "~/lib/utils";

export function LeadCard({
  form,
  submitted,
  assistantId,
  conversationId,
  onSubmitted,
}: {
  form: SseLeadForm;
  submitted: boolean;
  assistantId: string;
  conversationId: string | undefined;
  onSubmitted: () => void;
}) {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...form.prefill,
  }));
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (!conversationId) return;
    setPending(true);
    try {
      await submitPlaygroundLead(assistantId, {
        conversation_id: conversationId,
        fields: values,
      });
      onSubmitted();
    } catch (err) {
      toast.error(
        t("common.failedToSave", { defaultValue: "Could not save" }),
        {
          description: extractErrorMessage(err),
        },
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      className="w-full max-w-[85%] space-y-3 rounded-2xl border border-border bg-background p-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <p className="text-xs text-muted-foreground">
        {form.intro_text}
        <span className="ml-1 rounded bg-muted px-1 font-mono text-[10px] uppercase">
          {form.reason}
        </span>
      </p>
      {submitted ? (
        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
          {t("aiAssistants.playground.leadSent")}
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {form.fields.map((f) => (
              <div
                key={f.key}
                className={cn(
                  "space-y-1",
                  f.key === "message" && "sm:col-span-2",
                )}
              >
                <Label htmlFor={`pl-${f.key}`} className="text-xs">
                  {t(`aiAssistants.leads.fields.${f.key}`)}
                  {f.required ? " *" : ""}
                </Label>
                <Input
                  id={`pl-${f.key}`}
                  required={f.required}
                  value={values[f.key] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            {t("aiAssistants.playground.leadSubmit")}
          </Button>
        </>
      )}
    </form>
  );
}

export function DebugTable({ debug }: { debug: RetrievalDebug }) {
  const { t } = useTranslation();
  return (
    <div className="w-full max-w-[85%] space-y-2 rounded-xl border border-border bg-muted/30 p-3 text-[11px]">
      <p className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-muted-foreground">
        <span>best_sim={debug.best_similarity?.toFixed(3) ?? "—"}</span>
        <span>fts_hits={debug.fts_hits}</span>
        <span>classifier={debug.classifier ?? "—"}</span>
      </p>
      {debug.chunks.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full font-mono">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="pr-2 font-normal">
                  {t("aiAssistants.playground.chunk")}
                </th>
                <th className="pr-2 text-right font-normal">sim</th>
                <th className="pr-2 text-right font-normal">rrf</th>
                <th className="text-right font-normal">fts</th>
              </tr>
            </thead>
            <tbody>
              {debug.chunks.map((c, i) => (
                <tr key={i} className="border-t border-border/60">
                  <td
                    className="max-w-[20rem] truncate py-0.5 pr-2"
                    title={`${c.title} › ${c.heading_path}`}
                  >
                    {c.title}
                    <span className="text-muted-foreground">
                      {" "}
                      › {c.heading_path}
                    </span>
                  </td>
                  <td className="pr-2 text-right tabular-nums">
                    {c.similarity?.toFixed(3) ?? "—"}
                  </td>
                  <td className="pr-2 text-right tabular-nums">
                    {c.rrf.toFixed(4)}
                  </td>
                  <td className="text-right tabular-nums">
                    {c.fts_rank ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
