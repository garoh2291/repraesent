import {
  MoreHorizontal,
  Pencil,
  ScrollText,
  Send,
  Trash2,
  Webhook,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Switch } from "~/components/ui/switch";
import {
  EmptyPanelState,
  GhostAction,
  Panel,
  PanelBody,
  PanelHeader,
} from "~/components/forms/chrome";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import type { FormWebhook, WebhookTestResult } from "~/lib/api/form-webhooks";
import type { FormKind } from "~/lib/forms/schema";
import {
  useDeleteWebhook,
  useFormWebhooks,
  usePayloadKeys,
  useTestWebhook,
  useUpdateWebhook,
} from "~/lib/hooks/useFormWebhooks";
import { useAuthContext } from "~/providers/auth-provider";
import { cn } from "~/lib/utils";
import { DeliveryLogSheet } from "./DeliveryLogSheet";
import { WebhookEditorSheet } from "./WebhookEditorSheet";
import { relativeTime } from "./relative-time";

interface Props {
  formId: string;
  kind: FormKind;
  canEdit: boolean;
}

/**
 * The Webhooks tab. Cards per endpoint, a sheet to edit one, a sheet for its
 * deliveries. Everything a person needs to trust the integration is on the
 * card: on/off, where it goes, whether the last one landed, and a way to send
 * a test without waiting for a visitor.
 */
export function WebhooksPanel({ formId, kind, canEdit }: Props) {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const isAdmin = currentWorkspace?.member_role === "admin";

  const { data: webhooks, isLoading } = useFormWebhooks(formId);
  const { data: payloadKeys } = usePayloadKeys(formId);
  const update = useUpdateWebhook(formId);
  const remove = useDeleteWebhook(formId);
  const test = useTestWebhook(formId);

  const [editor, setEditor] = useState<{
    open: boolean;
    webhook: FormWebhook | null;
  }>({
    open: false,
    webhook: null,
  });
  const [log, setLog] = useState<FormWebhook | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FormWebhook | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, WebhookTestResult>
  >({});
  const [freshSecret, setFreshSecret] = useState<{
    id: string;
    secret: string;
  } | null>(null);

  const sendTest = async (hook: FormWebhook) => {
    try {
      const result = await test.mutateAsync({ id: hook.id });
      setTestResults((prev) => ({ ...prev, [hook.id]: result }));
      if (result.ok) {
        toast.success(
          t("forms.webhooks.testOk", {
            code: result.status,
            ms: result.duration_ms,
          }),
        );
      } else {
        toast.error(
          t("forms.webhooks.testFailed", {
            code: result.status ?? result.error ?? "—",
          }),
        );
      }
    } catch (error) {
      toast.error(extractErrorMessage(error));
    }
  };

  return (
    <>
      <Panel>
        <PanelHeader
          icon={<Webhook className="h-3.5 w-3.5" />}
          title={t("forms.webhooks.title")}
          meta={
            webhooks?.length ? (
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                {webhooks.length}
              </span>
            ) : null
          }
          action={
            canEdit ? (
              <GhostAction
                onClick={() => setEditor({ open: true, webhook: null })}
              >
                {t("forms.webhooks.add")}
              </GhostAction>
            ) : null
          }
        />

        {isLoading ? (
          <PanelBody>
            <div className="h-16 animate-pulse rounded-xl bg-muted/40" />
          </PanelBody>
        ) : !webhooks?.length ? (
          <EmptyPanelState
            icon={<Webhook className="h-5 w-5" />}
            title={t("forms.webhooks.empty")}
            hint={t("forms.webhooks.emptyHint")}
          />
        ) : (
          <ul className="divide-y">
            {webhooks.map((hook) => {
              const result = testResults[hook.id];
              const secret =
                freshSecret?.id === hook.id ? freshSecret.secret : null;
              return (
                <li key={hook.id} className="px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <Switch
                      checked={hook.is_active}
                      disabled={!canEdit}
                      onCheckedChange={(v) =>
                        update.mutate(
                          { id: hook.id, body: { is_active: v } },
                          {
                            onError: (error) =>
                              toast.error(extractErrorMessage(error)),
                          },
                        )
                      }
                      aria-label={hook.name}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">
                          {hook.name}
                        </span>
                        <StatusChip hook={hook} />
                      </div>
                      <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                        {hook.url_masked}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {hook.events.map((e) => (
                          <span
                            key={e}
                            className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                          >
                            {e}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {canEdit ? (
                        <GhostAction
                          className="h-8 text-xs"
                          disabled={
                            test.isPending && test.variables?.id === hook.id
                          }
                          onClick={() => sendTest(hook)}
                        >
                          <Send className="h-3.5 w-3.5" />
                          {t("forms.webhooks.sendTest")}
                        </GhostAction>
                      ) : null}
                      <GhostAction
                        className="h-8 text-xs"
                        onClick={() => setLog(hook)}
                      >
                        <ScrollText className="h-3.5 w-3.5" />
                        {t("forms.webhooks.deliveries")}
                      </GhostAction>
                      <GhostAction
                        className="h-8 text-xs"
                        onClick={() => setEditor({ open: true, webhook: hook })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {canEdit
                          ? t("forms.webhooks.edit")
                          : t("forms.webhooks.view")}
                      </GhostAction>
                      {canEdit ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={t("forms.webhooks.more")}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onSelect={() =>
                                setEditor({ open: true, webhook: hook })
                              }
                            >
                              <Pencil className="h-4 w-4" />
                              {t("forms.webhooks.edit")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setPendingDelete(hook)}
                            >
                              <Trash2 className="h-4 w-4" />
                              {t("forms.webhooks.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                  </div>

                  {secret ? (
                    <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
                      <p className="font-medium">
                        {t("forms.webhooks.secretOnce")}
                      </p>
                      <code className="mt-1 block break-all rounded-lg bg-background px-2.5 py-1.5 font-mono text-[12px]">
                        {secret}
                      </code>
                      <button
                        type="button"
                        className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
                        onClick={() => setFreshSecret(null)}
                      >
                        {t("forms.webhooks.secretDismiss")}
                      </button>
                    </div>
                  ) : null}

                  {result ? <TestSendResult result={result} /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <WebhookEditorSheet
        open={editor.open}
        onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
        formId={formId}
        kind={kind}
        webhook={editor.webhook}
        payloadKeys={payloadKeys}
        isAdmin={isAdmin}
        disabled={!canEdit}
        onSaved={(saved) => {
          if (saved.secret)
            setFreshSecret({ id: saved.id, secret: saved.secret });
        }}
      />

      <DeliveryLogSheet
        open={log != null}
        onOpenChange={(open) => {
          if (!open) setLog(null);
        }}
        formId={formId}
        webhook={log}
        canEdit={canEdit}
      />

      <AlertDialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("forms.webhooks.deleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("forms.webhooks.deleteBody", {
                name: pendingDelete?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!pendingDelete) return;
                try {
                  await remove.mutateAsync(pendingDelete.id);
                  toast.success(t("forms.webhooks.deleted"));
                } catch (error) {
                  toast.error(extractErrorMessage(error));
                } finally {
                  setPendingDelete(null);
                }
              }}
            >
              {t("forms.webhooks.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function StatusChip({ hook }: { hook: FormWebhook }) {
  const { t } = useTranslation();
  if (!hook.is_active && hook.disabled_reason) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {t("forms.webhooks.status.autoDisabled", { count: hook.failure_count })}
      </span>
    );
  }
  if (!hook.last_delivery_at) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full border border-current" />
        {t("forms.webhooks.status.never")}
      </span>
    );
  }
  if (hook.failure_count > 0) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive"
        title={hook.last_error ?? undefined}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {t("forms.webhooks.status.failing", {
          count: hook.failure_count,
          error: hook.last_error ?? "",
        })}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {t("forms.webhooks.status.ok", {
        when: relativeTime(hook.last_success_at),
      })}
    </span>
  );
}

function TestSendResult({ result }: { result: WebhookTestResult }) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "mt-3 rounded-xl border p-3 text-sm",
        result.ok
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-destructive/30 bg-destructive/5",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium",
            result.ok
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
              : "bg-destructive/15 text-destructive",
          )}
        >
          {result.status ?? result.error ?? "—"}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {result.duration_ms} ms
        </span>
        {!result.ok && result.error && result.status ? (
          <span className="text-xs text-muted-foreground">{result.error}</span>
        ) : null}
      </div>
      {result.body_excerpt ? (
        <pre className="mt-2 max-h-24 overflow-auto rounded-lg bg-background/60 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {result.body_excerpt}
        </pre>
      ) : null}
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {t("forms.webhooks.response")}
      </p>
    </div>
  );
}
