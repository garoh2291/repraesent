import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  BadgeCheck,
  ExternalLink,
  KeyRound,
  Send,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import i18n from "~/i18n";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  useCanManageWorkspaceAi,
  useWorkspaceAi,
  useWorkspaceAiMutations,
} from "~/lib/hooks/useWorkspaceAi";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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

export function meta() {
  return [
    { title: `${i18n.t("settings.ai.metaTitle")} - Repraesent` },
    { name: "description", content: i18n.t("settings.ai.metaDescription") },
  ];
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </h2>
  );
}

export default function SettingsAi() {
  const { t } = useTranslation();
  useDocumentMeta({
    titleKey: "settings.ai.metaTitle",
    descriptionKey: "settings.ai.metaDescription",
    titleSuffix: " - Repraesent",
  });

  const canManage = useCanManageWorkspaceAi();
  const status = useWorkspaceAi();

  return (
    <div className="space-y-6 sm:space-y-8 app-fade-up app-fade-up-d2">
      <div className="space-y-4">
        <div className="space-y-0.5">
          <SectionLabel>{t("settings.ai.sectionLabel")}</SectionLabel>
          <p className="text-sm text-muted-foreground">
            {t("settings.ai.sectionDescription")}
          </p>
        </div>

        {status.isPending ? (
          <Skeleton className="h-[220px] w-full rounded-2xl" />
        ) : (
          <KeyCard canManage={canManage} />
        )}

        {!canManage ? (
          <p className="text-xs text-muted-foreground">
            {t("settings.ai.adminOnly")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function KeyCard({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation();
  const { data } = useWorkspaceAi();
  const m = useWorkspaceAiMutations();
  const [apiKey, setApiKey] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const isConnected = !!data?.connected;
  const revoked = data?.status === "revoked" || data?.status === "error";

  const connect = () =>
    m.connect.mutate(apiKey.trim(), {
      onSuccess: (s) => {
        setApiKey("");
        toast.success(
          t("settings.ai.connected", { name: s.key_label ?? "OpenRouter" }),
        );
      },
      onError: (e) => toast.error(extractErrorMessage(e)),
    });

  const test = () =>
    m.test.mutate(undefined, {
      onSuccess: (r) =>
        toast.success(
          t("settings.ai.testOk", {
            name: r.key_label ?? "OpenRouter",
            usage: r.usage != null ? `$${r.usage.toFixed(2)}` : "—",
          }),
        ),
      onError: (e) => toast.error(extractErrorMessage(e)),
    });

  const disconnect = () =>
    m.disconnect.mutate(undefined, {
      onSuccess: () => {
        setConfirmDisconnect(false);
        toast.success(t("settings.ai.disconnected"));
      },
      onError: (e) => toast.error(extractErrorMessage(e)),
    });

  const setModel = (id: string) =>
    m.update.mutate(
      { default_chat_model: id },
      {
        onSuccess: () => toast.success(t("settings.ai.modelSaved")),
        onError: (e) => toast.error(extractErrorMessage(e)),
      },
    );

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-background">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {t("settings.ai.cardTitle")}
              </h3>
              {isConnected && !revoked ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <BadgeCheck className="h-3 w-3" />
                  {t("settings.ai.statusConnected")}
                </span>
              ) : revoked ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                  <TriangleAlert className="h-3 w-3" />
                  {t("settings.ai.statusRevoked")}
                </span>
              ) : null}
            </div>
            {isConnected ? (
              <>
                <p className="truncate text-xs text-muted-foreground">
                  {data?.key_label ?? "OpenRouter"}
                  {data?.api_key_masked ? ` · ${data.api_key_masked}` : null}
                </p>
                {data?.last_error ? (
                  <p className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
                    <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                    {t("settings.ai.lastError", { error: data.last_error })}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("settings.ai.notConnectedHint")}
              </p>
            )}
          </div>
        </div>

        {isConnected ? (
          <div className="flex items-center gap-2 sm:shrink-0">
            <Button
              variant="outline"
              size="sm"
              disabled={!canManage || m.test.isPending}
              onClick={test}
            >
              <Send className="mr-1.5 h-4 w-4" />
              {m.test.isPending
                ? t("common.loading", { defaultValue: "Loading…" })
                : t("settings.ai.test")}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={!canManage}
              onClick={() => setConfirmDisconnect(true)}
              aria-label={t("settings.ai.disconnect")}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="workspace-ai-key">
              {isConnected
                ? t("settings.ai.rotateLabel")
                : t("settings.ai.keyLabel")}
            </Label>
            <Input
              id="workspace-ai-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              disabled={!canManage}
              placeholder={t("settings.ai.keyPlaceholder")}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && apiKey.trim()) connect();
              }}
            />
          </div>
          <Button
            disabled={!canManage || !apiKey.trim() || m.connect.isPending}
            onClick={connect}
          >
            <KeyRound className="mr-1.5 h-4 w-4" />
            {m.connect.isPending
              ? t("common.loading", { defaultValue: "Loading…" })
              : isConnected
                ? t("settings.ai.rotate")
                : t("settings.ai.connect")}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("settings.ai.keyHelp")}{" "}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 underline"
          >
            openrouter.ai/keys
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>

        {!isConnected ? (
          <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2.5">
            <p className="text-xs font-medium text-foreground">
              {t("settings.ai.howTo.title")}
            </p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
              {([1, 2, 3, 4] as const).map((n) => (
                <li key={n}>{t(`settings.ai.howTo.step${n}`)}</li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("settings.ai.howTo.billing")}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 underline"
              >
                {t("settings.ai.howTo.link")}
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>
        ) : null}
      </div>

      {isConnected ? (
        <div className="mt-4 border-t border-border pt-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_minmax(16rem,20rem)] sm:items-center">
            <div className="space-y-0.5">
              <Label htmlFor="default-chat-model">
                {t("settings.ai.defaultModel")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings.ai.defaultModelHint")}
              </p>
            </div>
            <Select
              value={data?.default_chat_model}
              disabled={!canManage || m.update.isPending}
              onValueChange={setModel}
            >
              <SelectTrigger id="default-chat-model" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(data?.models ?? []).map((mo) => (
                  <SelectItem key={mo.id} value={mo.id}>
                    {mo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      <AlertDialog
        open={confirmDisconnect}
        onOpenChange={(open) => !open && setConfirmDisconnect(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.ai.disconnectTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.ai.disconnectDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={m.disconnect.isPending}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={m.disconnect.isPending}
              onClick={(e) => {
                e.preventDefault();
                disconnect();
              }}
            >
              {m.disconnect.isPending
                ? t("common.loading", { defaultValue: "Loading…" })
                : t("settings.ai.disconnect")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
