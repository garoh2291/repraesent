import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BadgeCheck,
  Copy,
  ExternalLink,
  KeyRound,
  Radio,
  Send,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import i18n from "~/i18n";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  buildPixelSnippet,
  connectOpenaiAds,
  disconnectOpenaiAds,
  getOpenaiConversionsDebug,
  setupOpenaiConversions,
  testOpenaiAds,
} from "~/lib/api/openai-ads";
import {
  useCanManageOpenaiAds,
  useOpenaiAdsConnection,
  useOpenaiConversionsStatus,
} from "~/lib/hooks/useOpenaiAds";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { OpenAiMark } from "~/components/icons/openai-mark";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
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
    { title: `${i18n.t("settings.openaiAds.metaTitle")} - Repraesent` },
    {
      name: "description",
      content: i18n.t("settings.openaiAds.metaDescription"),
    },
  ];
}

/** Matches the eyebrow used by every other settings page. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </h2>
  );
}

export default function SettingsOpenaiAds() {
  const { t } = useTranslation();
  useDocumentMeta({
    titleKey: "settings.openaiAds.metaTitle",
    descriptionKey: "settings.openaiAds.metaDescription",
    titleSuffix: " - Repraesent",
  });

  const canManage = useCanManageOpenaiAds();
  const connection = useOpenaiAdsConnection();

  return (
    <div className="space-y-6 sm:space-y-8 app-fade-up app-fade-up-d2">
      <div className="space-y-4">
        <div className="space-y-0.5">
          <SectionLabel>
            {t("settings.openaiAds.sectionLabel", {
              defaultValue: "Ad account",
            })}
          </SectionLabel>
          <p className="text-sm text-muted-foreground">
            {t("settings.openaiAds.sectionDescription", {
              defaultValue:
                "Connect your OpenAI Ads account with the API key from ads.openai.com → Settings.",
            })}
          </p>
        </div>

        {connection.isPending ? (
          <Skeleton className="h-[180px] w-full rounded-2xl" />
        ) : (
          <ConnectionCard canManage={canManage} />
        )}

        {!canManage ? (
          <p className="text-xs text-muted-foreground">
            {t("settings.openaiAds.adminOnly", {
              defaultValue:
                "Only workspace admins can manage the OpenAI Ads connection.",
            })}
          </p>
        ) : null}
      </div>

      {connection.data?.connected ? (
        <ConversionsCard canManage={canManage} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connection card
// ---------------------------------------------------------------------------

function ConnectionCard({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const connection = useOpenaiAdsConnection();

  const [apiKey, setApiKey] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const invalidateAll = () =>
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0]).startsWith("openai-ads"),
    });

  const connectMutation = useMutation({
    mutationFn: (key: string) => connectOpenaiAds(key),
    onSuccess: async (status) => {
      await invalidateAll();
      setApiKey("");
      toast.success(
        t("settings.openaiAds.connected", {
          defaultValue: "Connected to {{name}}",
          name: status.ad_account_name ?? status.ad_account_id ?? "OpenAI Ads",
        }),
      );
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const testMutation = useMutation({
    mutationFn: testOpenaiAds,
    onSuccess: (result) => {
      void invalidateAll();
      toast.success(
        t("settings.openaiAds.testOk", {
          defaultValue: "Key works — account {{name}}",
          name: result.ad_account_name ?? result.ad_account_id ?? "",
        }),
      );
    },
    onError: (error) => {
      void invalidateAll();
      toast.error(extractErrorMessage(error));
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectOpenaiAds,
    onSuccess: async () => {
      await invalidateAll();
      setConfirmDisconnect(false);
      toast.success(
        t("settings.openaiAds.disconnected", {
          defaultValue: "OpenAI Ads disconnected",
        }),
      );
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const data = connection.data;
  const isConnected = !!data?.connected;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-background">
            <OpenAiMark className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {t("settings.openaiAds.cardTitle", {
                  defaultValue: "OpenAI Ads",
                })}
              </h3>
              {isConnected ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <BadgeCheck className="h-3 w-3" />
                  {t("settings.openaiAds.statusConnected", {
                    defaultValue: "Connected",
                  })}
                </span>
              ) : data?.status === "revoked" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                  <TriangleAlert className="h-3 w-3" />
                  {t("settings.openaiAds.statusRevoked", {
                    defaultValue: "Key rejected",
                  })}
                </span>
              ) : null}
            </div>
            {isConnected ? (
              <>
                <p className="truncate text-xs text-muted-foreground">
                  {data?.ad_account_name ?? data?.ad_account_id}
                  {data?.api_key_masked ? ` · ${data.api_key_masked}` : null}
                </p>
                {data?.last_error ? (
                  <p className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
                    <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                    {t("settings.openaiAds.lastError", {
                      defaultValue: "Last call failed: {{error}}",
                      error: data.last_error,
                    })}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("settings.openaiAds.notConnectedHint", {
                  defaultValue:
                    "Issue an API key in your Ads Manager settings, then paste it here.",
                })}
              </p>
            )}
          </div>
        </div>

        {isConnected ? (
          <div className="flex items-center gap-2 sm:shrink-0">
            <Button
              variant="outline"
              size="sm"
              disabled={!canManage || testMutation.isPending}
              onClick={() => testMutation.mutate()}
            >
              <Send className="mr-1.5 h-4 w-4" />
              {testMutation.isPending
                ? t("common.loading", { defaultValue: "Loading…" })
                : t("settings.openaiAds.test", { defaultValue: "Test key" })}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={!canManage}
              onClick={() => setConfirmDisconnect(true)}
              aria-label={t("settings.openaiAds.disconnect", {
                defaultValue: "Disconnect",
              })}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="openai-ads-key">
              {isConnected
                ? t("settings.openaiAds.rotateLabel", {
                    defaultValue: "Replace API key",
                  })
                : t("settings.openaiAds.keyLabel", {
                    defaultValue: "Ads API key",
                  })}
            </Label>
            <Input
              id="openai-ads-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              disabled={!canManage}
              placeholder={t("settings.openaiAds.keyPlaceholder", {
                defaultValue: "Paste the key from ads.openai.com → Settings",
              })}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <Button
            disabled={!canManage || !apiKey.trim() || connectMutation.isPending}
            onClick={() => connectMutation.mutate(apiKey.trim())}
          >
            <KeyRound className="mr-1.5 h-4 w-4" />
            {connectMutation.isPending
              ? t("common.loading", { defaultValue: "Loading…" })
              : isConnected
                ? t("settings.openaiAds.rotate", { defaultValue: "Replace" })
                : t("settings.openaiAds.connect", { defaultValue: "Connect" })}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("settings.openaiAds.keyHelp", {
            defaultValue:
              "The key is verified against your ad account before it is stored, and it is stored encrypted.",
          })}{" "}
          <a
            href="https://ads.openai.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 underline"
          >
            ads.openai.com
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>

        {!isConnected ? (
          <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2.5">
            <p className="text-xs font-medium text-foreground">
              {t("settings.openaiAds.howTo.title", {
                defaultValue: "How to get an API key",
              })}
            </p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
              {([1, 2, 3, 4] as const).map((n) => (
                <li key={n}>{t(`settings.openaiAds.howTo.step${n}`)}</li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-muted-foreground">
              <a
                href="https://help.openai.com/en/articles/20001206-ads-manager-beta-overview"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 underline"
              >
                {t("settings.openaiAds.howTo.helpLink", {
                  defaultValue: "Ads Manager overview (OpenAI Help Center)",
                })}
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>
        ) : null}
      </div>

      <AlertDialog
        open={confirmDisconnect}
        onOpenChange={(open) => !open && setConfirmDisconnect(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.openaiAds.disconnectTitle", {
                defaultValue: "Disconnect OpenAI Ads?",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.openaiAds.disconnectDescription", {
                defaultValue:
                  "The dashboard stops working and conversion events stop sending. The key itself stays valid at OpenAI until you rotate it in Ads Manager.",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnectMutation.isPending}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={disconnectMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                disconnectMutation.mutate();
              }}
            >
              {disconnectMutation.isPending
                ? t("common.loading", { defaultValue: "Loading…" })
                : t("settings.openaiAds.disconnect", {
                    defaultValue: "Disconnect",
                  })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversions card
// ---------------------------------------------------------------------------

function ConversionsCard({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const connection = useOpenaiAdsConnection();
  const enabled = !!connection.data?.conversions_enabled;
  const pixelId = connection.data?.pixel_id ?? null;
  const queue = useOpenaiConversionsStatus(enabled);

  const setupMutation = useMutation({
    mutationFn: setupOpenaiConversions,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("openai-ads"),
      });
      toast.success(
        t("settings.openaiAds.conversions.setupDone", {
          defaultValue: "Conversion tracking is on",
        }),
      );
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
        <SectionLabel>
          {t("settings.openaiAds.conversions.sectionLabel", {
            defaultValue: "Conversion tracking",
          })}
        </SectionLabel>
        <p className="text-sm text-muted-foreground">
          {t("settings.openaiAds.conversions.sectionDescription", {
            defaultValue:
              "Send leads and bookings back to OpenAI so your campaigns can optimize for them.",
          })}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        {!enabled ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-background">
                <Radio className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">
                  {t("settings.openaiAds.conversions.enableTitle", {
                    defaultValue: "Turn on conversion tracking",
                  })}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t("settings.openaiAds.conversions.enableBody", {
                    defaultValue:
                      "Creates a measurement pixel and conversion events (lead created, appointment scheduled) on your ad account. Your hosted forms and booking pages start reporting automatically.",
                  })}
                </p>
              </div>
            </div>
            <Button
              disabled={!canManage || setupMutation.isPending}
              onClick={() => setupMutation.mutate()}
            >
              {setupMutation.isPending
                ? t("common.loading", { defaultValue: "Loading…" })
                : t("settings.openaiAds.conversions.enable", {
                    defaultValue: "Turn on",
                  })}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <BadgeCheck className="h-3 w-3" />
                {t("settings.openaiAds.conversions.active", {
                  defaultValue: "Active",
                })}
              </span>
              {pixelId ? (
                <span className="text-xs text-muted-foreground">
                  {t("settings.openaiAds.conversions.pixelId", {
                    defaultValue: "Pixel",
                  })}
                  : <code className="font-mono">{pixelId}</code>
                </span>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <QueueStat
                label={t("settings.openaiAds.conversions.pending", {
                  defaultValue: "Waiting to send",
                })}
                value={queue.data?.pending}
                pending={queue.isPending}
              />
              <QueueStat
                label={t("settings.openaiAds.conversions.sent", {
                  defaultValue: "Sent",
                })}
                value={queue.data?.sent}
                pending={queue.isPending}
              />
              <QueueStat
                label={t("settings.openaiAds.conversions.failed", {
                  defaultValue: "Failed or expired",
                })}
                value={queue.data?.failed_recently}
                pending={queue.isPending}
              />
            </div>
            {queue.data?.last_error ? (
              <p className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
                <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                {queue.data.last_error}
              </p>
            ) : null}

            {pixelId ? <PixelSnippet pixelId={pixelId} /> : null}

            {canManage ? <DebugPanel /> : null}
          </div>
        )}
      </div>
    </div>
  );
}

function QueueStat({
  label,
  value,
  pending,
}: {
  label: string;
  value: number | undefined;
  pending: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/60 px-3 py-2.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {pending ? (
        <Skeleton className="mt-1 h-5 w-10 rounded" />
      ) : (
        <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
          {value ?? 0}
        </p>
      )}
    </div>
  );
}

function PixelSnippet({ pixelId }: { pixelId: string }) {
  const { t } = useTranslation();
  const snippet = buildPixelSnippet(pixelId);

  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">
          {t("settings.openaiAds.conversions.snippetTitle", {
            defaultValue: "Pixel for your own website",
          })}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="h-7"
          onClick={() => {
            void navigator.clipboard.writeText(snippet);
            toast.success(
              t("settings.openaiAds.conversions.snippetCopied", {
                defaultValue: "Snippet copied",
              }),
            );
          }}
        >
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          {t("settings.openaiAds.conversions.copy", { defaultValue: "Copy" })}
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("settings.openaiAds.conversions.snippetBody", {
          defaultValue:
            "Repraesent forms and booking pages report automatically. Paste this into the <head> of external landing pages so visits there are measured too.",
        })}
      </p>
      <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-background p-2 text-[11px] leading-relaxed text-muted-foreground">
        {snippet}
      </pre>
      <p className="mt-2 text-xs text-muted-foreground">
        {t("settings.openaiAds.conversions.snippetCsp", {
          defaultValue:
            "If your site sends a Content-Security-Policy header, allow the OpenAI hosts — add bzrcdn.openai.com to script-src, and both bzrcdn.openai.com and bzr.openai.com to connect-src — otherwise the browser blocks the pixel. Using a cookie banner? Add the snippet there as a marketing script instead of pasting it directly.",
        })}
      </p>
    </div>
  );
}

function DebugPanel() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const debug = useQuery({
    queryKey: ["openai-ads-conversions-debug"],
    queryFn: getOpenaiConversionsDebug,
    enabled: open,
    retry: false,
    // OpenAI's window is 15 minutes; refetch on every open, never in background.
    staleTime: 0,
  });

  return (
    <div>
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
        {open
          ? t("settings.openaiAds.conversions.debugHide", {
              defaultValue: "Hide recent events",
            })
          : t("settings.openaiAds.conversions.debugShow", {
              defaultValue: "Check recent events",
            })}
      </Button>
      {open ? (
        debug.isPending ? (
          <Skeleton className="mt-2 h-16 w-full rounded-lg" />
        ) : debug.data?.data.length ? (
          <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted/50 p-2 text-[11px] leading-relaxed text-muted-foreground">
            {JSON.stringify(debug.data.data, null, 2)}
          </pre>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("settings.openaiAds.conversions.debugEmpty", {
              defaultValue:
                "No events received by OpenAI in the last 15 minutes. Submit a test form and check again.",
            })}
          </p>
        )
      ) : null}
    </div>
  );
}
