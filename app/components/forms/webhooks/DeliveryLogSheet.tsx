import { ChevronDown, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import type { FormWebhook, FormWebhookDelivery } from "~/lib/api/form-webhooks";
import {
  useRedeliver,
  useWebhookDeliveries,
} from "~/lib/hooks/useFormWebhooks";
import { cn } from "~/lib/utils";
import { relativeTime } from "./relative-time";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string;
  webhook: FormWebhook | null;
  canEdit: boolean;
}

/** The last fifty deliveries: what went, when, what came back, and a retry. */
export function DeliveryLogSheet({
  open,
  onOpenChange,
  formId,
  webhook,
  canEdit,
}: Props) {
  const { t } = useTranslation();
  const { data, isLoading } = useWebhookDeliveries(formId, webhook?.id, open);
  const redeliver = useRedeliver(formId);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[680px]"
      >
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>
            {t("forms.webhooks.deliveries")}
            {webhook ? (
              <span className="text-muted-foreground"> · {webhook.name}</span>
            ) : null}
          </SheetTitle>
          <SheetDescription>
            {t("forms.webhooks.deliveriesHint")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="p-5 text-sm text-muted-foreground">
              {t("common.loading", { defaultValue: "Loading…" })}
            </p>
          ) : !data?.length ? (
            <p className="p-5 text-sm text-muted-foreground">
              {t("forms.webhooks.deliveriesEmpty")}
            </p>
          ) : (
            <ul className="divide-y">
              {data.map((d) => (
                <DeliveryRow
                  key={d.id}
                  delivery={d}
                  expanded={expanded === d.id}
                  onToggle={() => setExpanded(expanded === d.id ? null : d.id)}
                  canRedeliver={canEdit && !!webhook}
                  redelivering={
                    redeliver.isPending &&
                    redeliver.variables?.deliveryId === d.id
                  }
                  onRedeliver={async () => {
                    if (!webhook) return;
                    try {
                      await redeliver.mutateAsync({
                        id: webhook.id,
                        deliveryId: d.id,
                      });
                      toast.success(t("forms.webhooks.redelivered"));
                    } catch (error) {
                      toast.error(extractErrorMessage(error));
                    }
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DeliveryRow({
  delivery: d,
  expanded,
  onToggle,
  canRedeliver,
  redelivering,
  onRedeliver,
}: {
  delivery: FormWebhookDelivery;
  expanded: boolean;
  onToggle: () => void;
  canRedeliver: boolean;
  redelivering: boolean;
  onRedeliver: () => void;
}) {
  const { t } = useTranslation();
  const tone =
    d.status === "succeeded"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : d.status === "pending" || d.status === "failed"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "bg-destructive/10 text-destructive";
  const code =
    d.response_status ??
    (d.last_error?.startsWith("timeout") ? t("forms.webhooks.timeout") : "—");

  return (
    <li>
      <div className="flex items-center gap-3 px-5 py-3 text-sm">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
          />
          <span
            className="w-24 shrink-0 text-xs text-muted-foreground"
            title={new Date(d.created_at).toISOString()}
          >
            {relativeTime(d.created_at)}
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
            {d.event_type}
          </span>
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium",
              tone,
            )}
          >
            {code}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {t("forms.webhooks.attempts", { count: d.attempts })}
            {d.duration_ms != null ? ` · ${d.duration_ms} ms` : ""}
          </span>
        </button>
        {canRedeliver ? (
          <button
            type="button"
            disabled={redelivering}
            onClick={onRedeliver}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <RotateCcw
              className={cn("h-3.5 w-3.5", redelivering && "animate-spin")}
            />
            {t("forms.webhooks.redeliver")}
          </button>
        ) : null}
      </div>
      {expanded ? (
        <div className="grid gap-3 px-5 pb-4 @md:grid-cols-2">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              {t("forms.webhooks.request")}
            </p>
            <pre className="max-h-64 overflow-auto rounded-lg border bg-[#111113] p-3 font-mono text-[11px] leading-relaxed text-white/80">
              {JSON.stringify(d.payload, null, 2)}
            </pre>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              {t("forms.webhooks.response")}
            </p>
            <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
              {d.last_error && !d.response_body
                ? d.last_error
                : d.response_body || "—"}
            </pre>
            {d.status === "failed" ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("forms.webhooks.nextAttempt", {
                  when: relativeTime(d.next_attempt_at),
                })}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}
