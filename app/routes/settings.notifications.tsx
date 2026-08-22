import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BellRing,
  Plus,
  Send,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import i18n from "~/i18n";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  createNotificationChannel,
  deleteNotificationChannel,
  listNotificationChannels,
  NOTIFICATION_EVENTS,
  testNotificationChannel,
  updateNotificationChannel,
  type NotificationChannel,
  type NotificationEvent,
  type NotificationProvider,
} from "~/lib/api/notification-channels";
import { useCanManageNotifications } from "~/lib/hooks/useCanManageNotifications";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Checkbox } from "~/components/ui/checkbox";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
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
    { title: `${i18n.t("settings.notifications.metaTitle")} - Repraesent` },
    {
      name: "description",
      content: i18n.t("settings.notifications.metaDescription"),
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

/** Well-known webhook hosts, for a soft "looks wrong" hint — never a block. */
const PROVIDER_HOST_HINTS: Record<NotificationProvider, string[]> = {
  slack: ["hooks.slack.com"],
  teams: ["logic.azure.com", "webhook.office.com", "powerautomate.com"],
};

function looksLikeProviderUrl(
  provider: NotificationProvider,
  url: string,
): boolean {
  try {
    const host = new URL(url).hostname;
    return PROVIDER_HOST_HINTS[provider].some(
      (h) => host === h || host.endsWith(`.${h}`),
    );
  } catch {
    return true; // not parseable yet — the required-field check handles it
  }
}

export default function SettingsNotifications() {
  const { t } = useTranslation();
  useDocumentMeta({
    titleKey: "settings.notifications.metaTitle",
    descriptionKey: "settings.notifications.metaDescription",
    titleSuffix: " - Repraesent",
  });

  const queryClient = useQueryClient();
  const canManage = useCanManageNotifications();

  const { data: channels, isPending } = useQuery({
    queryKey: ["notification-channels"],
    queryFn: listNotificationChannels,
  });

  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] =
    useState<NotificationChannel | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["notification-channels"] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNotificationChannel(id),
    onSuccess: async () => {
      await invalidate();
      setPendingDelete(null);
      toast.success(
        t("settings.notifications.deleted", {
          defaultValue: "Channel removed",
        }),
      );
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  return (
    <div className="space-y-6 sm:space-y-8 app-fade-up app-fade-up-d2">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <SectionLabel>
              {t("settings.notifications.sectionLabel", {
                defaultValue: "Channels",
              })}
            </SectionLabel>
            <p className="text-sm text-muted-foreground">
              {t("settings.notifications.sectionDescription", {
                defaultValue:
                  "Post workspace events to Slack or Microsoft Teams the moment they happen.",
              })}
            </p>
          </div>
          <Button size="sm" disabled={!canManage} onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t("settings.notifications.addChannel", {
              defaultValue: "Add channel",
            })}
          </Button>
        </div>

        {isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-[180px] w-full rounded-2xl" />
            <Skeleton className="h-[180px] w-full rounded-2xl" />
          </div>
        ) : !channels?.length ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <BellRing className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium text-foreground">
              {t("settings.notifications.emptyTitle", {
                defaultValue: "No notification channels yet",
              })}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("settings.notifications.emptyDescription", {
                defaultValue:
                  "Connect a Slack or Teams channel to get pinged about new leads and deal updates.",
              })}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {channels.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                canManage={canManage}
                onDelete={() => setPendingDelete(channel)}
              />
            ))}
          </div>
        )}

        {!canManage ? (
          <p className="text-xs text-muted-foreground">
            {t("settings.notifications.adminOnly", {
              defaultValue:
                "Only workspace admins can manage notification channels.",
            })}
          </p>
        ) : null}
      </div>

      <AddChannelDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={invalidate}
      />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.notifications.deleteTitle", {
                defaultValue: "Remove this channel?",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.notifications.deleteDescription", {
                defaultValue:
                  "Notifications will stop posting to {{name}}. The webhook itself is not deleted.",
                name: pendingDelete?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
              }}
            >
              {deleteMutation.isPending
                ? t("common.loading", { defaultValue: "Loading…" })
                : t("settings.notifications.deleteConfirm", {
                    defaultValue: "Remove",
                  })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ChannelCard({
  channel,
  canManage,
  onDelete,
}: {
  channel: NotificationChannel;
  canManage: boolean;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["notification-channels"] });

  const updateMutation = useMutation({
    mutationFn: (body: {
      events?: NotificationEvent[];
      is_active?: boolean;
    }) => updateNotificationChannel(channel.id, body),
    onSuccess: invalidate,
    onError: (error) => {
      toast.error(extractErrorMessage(error));
      void invalidate();
    },
  });

  const testMutation = useMutation({
    mutationFn: () => testNotificationChannel(channel.id),
    onSuccess: (result) => {
      void invalidate();
      if (result.ok) {
        toast.success(
          t("settings.notifications.testSent", {
            defaultValue: "Test message sent",
          }),
        );
      } else {
        toast.error(
          t("settings.notifications.testFailed", {
            defaultValue: "Test failed: {{error}}",
            error: result.error ?? "",
          }),
        );
      }
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const toggleEvent = (event: NotificationEvent, on: boolean) => {
    const next = on
      ? [...channel.events, event]
      : channel.events.filter((e) => e !== event);
    updateMutation.mutate({ events: next });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-background">
            <ProviderMark provider={channel.provider} />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {channel.name}
              </h3>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <ProviderMark provider={channel.provider} className="h-3 w-3" />
                {channel.provider === "slack"
                  ? t("settings.notifications.providerSlack", {
                      defaultValue: "Slack",
                    })
                  : t("settings.notifications.providerTeams", {
                      defaultValue: "Microsoft Teams",
                    })}
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {channel.webhook_url_masked}
            </p>
            {channel.last_error ? (
              <p className="flex items-start gap-1 text-xs text-destructive">
                <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                {t("settings.notifications.lastError", {
                  defaultValue: "Last delivery failed: {{error}}",
                  error: channel.last_error,
                })}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3 sm:shrink-0">
          <Button
            variant="outline"
            size="sm"
            disabled={!canManage || testMutation.isPending}
            onClick={() => testMutation.mutate()}
          >
            <Send className="mr-1.5 h-4 w-4" />
            {testMutation.isPending
              ? t("common.loading", { defaultValue: "Loading…" })
              : t("settings.notifications.sendTest", {
                  defaultValue: "Send test",
                })}
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {t("settings.notifications.active", { defaultValue: "Active" })}
            </span>
            <Switch
              checked={channel.is_active}
              disabled={!canManage}
              onCheckedChange={(checked) =>
                updateMutation.mutate({ is_active: checked })
              }
              aria-label={t("settings.notifications.active", {
                defaultValue: "Active",
              })}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            disabled={!canManage}
            onClick={onDelete}
            aria-label={t("settings.notifications.deleteConfirm", {
              defaultValue: "Remove",
            })}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <p className="text-xs font-medium text-muted-foreground">
          {t("settings.notifications.eventsLabel", {
            defaultValue: "Notify about",
          })}
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {NOTIFICATION_EVENTS.map((event) => (
            <label
              key={event}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
            >
              <span className="text-sm text-foreground">
                {t(`settings.notifications.events.${event}`)}
              </span>
              <Switch
                checked={channel.events.includes(event)}
                disabled={!canManage}
                onCheckedChange={(checked) => toggleEvent(event, checked)}
                aria-label={t(`settings.notifications.events.${event}`)}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProviderMark({
  provider,
  className = "h-6 w-6",
}: {
  provider: NotificationProvider;
  className?: string;
}) {
  return (
    <img
      src={`/notifications/${provider}.svg`}
      alt=""
      className={`${className} object-contain`}
    />
  );
}

function AddChannelDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();

  const [provider, setProvider] = useState<NotificationProvider>("slack");
  const [name, setName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [events, setEvents] = useState<NotificationEvent[]>([
    ...NOTIFICATION_EVENTS,
  ]);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setProvider("slack");
    setName("");
    setWebhookUrl("");
    setEvents([...NOTIFICATION_EVENTS]);
    setError(null);
  };

  const createMutation = useMutation({
    mutationFn: createNotificationChannel,
    onSuccess: () => {
      onCreated();
      onOpenChange(false);
      reset();
      toast.success(
        t("settings.notifications.created", { defaultValue: "Channel added" }),
      );
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const urlLooksOff =
    webhookUrl.startsWith("https://") &&
    !looksLikeProviderUrl(provider, webhookUrl);

  const submit = () => {
    setError(null);
    if (!name.trim()) {
      setError(
        t("settings.notifications.nameRequired", {
          defaultValue: "Enter a channel name.",
        }),
      );
      return;
    }
    if (!webhookUrl.trim().startsWith("https://")) {
      setError(
        t("settings.notifications.webhookUrlInvalid", {
          defaultValue: "Enter a valid https:// webhook URL.",
        }),
      );
      return;
    }
    createMutation.mutate({
      provider,
      name: name.trim(),
      webhook_url: webhookUrl.trim(),
      events,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("settings.notifications.addChannel", {
              defaultValue: "Add channel",
            })}
          </DialogTitle>
          <DialogDescription>
            {t("settings.notifications.addChannelDescription", {
              defaultValue:
                "Paste an incoming-webhook URL. Events post there instantly.",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>
              {t("settings.notifications.provider", {
                defaultValue: "Provider",
              })}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {(["slack", "teams"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProvider(p)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    provider === p
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground hover:border-border/80"
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <ProviderMark provider={p} className="h-4 w-4" />
                    {p === "slack"
                      ? t("settings.notifications.providerSlack", {
                          defaultValue: "Slack",
                        })
                      : t("settings.notifications.providerTeams", {
                          defaultValue: "Microsoft Teams",
                        })}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="channel-name">
              {t("settings.notifications.nameLabel", {
                defaultValue: "Channel name",
              })}
            </Label>
            <Input
              id="channel-name"
              value={name}
              maxLength={100}
              placeholder={t("settings.notifications.namePlaceholder", {
                defaultValue: "e.g. #sales-alerts",
              })}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="webhook-url">
              {t("settings.notifications.webhookUrlLabel", {
                defaultValue: "Webhook URL",
              })}
            </Label>
            <Input
              id="webhook-url"
              value={webhookUrl}
              placeholder="https://"
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {provider === "slack"
                ? t("settings.notifications.webhookUrlHelpSlack", {
                    defaultValue:
                      "Paste a Slack incoming-webhook URL (hooks.slack.com).",
                  })
                : t("settings.notifications.webhookUrlHelpTeams", {
                    defaultValue:
                      "Paste a Microsoft Teams Workflows webhook URL.",
                  })}
            </p>
            {urlLooksOff ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t("settings.notifications.webhookUrlSuspicious", {
                  defaultValue:
                    "This does not look like a typical webhook URL for this provider.",
                })}
              </p>
            ) : null}
            <div className="rounded-lg bg-muted/50 px-3 py-2.5">
              <p className="text-xs font-medium text-foreground">
                {t("settings.notifications.howToTitle", {
                  defaultValue: "How to get a webhook URL",
                })}
              </p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                {([1, 2, 3, 4] as const).map((n) => (
                  <li key={n}>
                    {t(`settings.notifications.howTo.${provider}.step${n}`)}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              {t("settings.notifications.eventsLabel", {
                defaultValue: "Notify about",
              })}
            </Label>
            <div className="space-y-2">
              {NOTIFICATION_EVENTS.map((event) => (
                <label key={event} className="flex items-center gap-2">
                  <Checkbox
                    checked={events.includes(event)}
                    onCheckedChange={(checked) =>
                      setEvents((prev) =>
                        checked === true
                          ? [...prev, event]
                          : prev.filter((e) => e !== event),
                      )
                    }
                  />
                  <span className="text-sm text-foreground">
                    {t(`settings.notifications.events.${event}`)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createMutation.isPending}
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button onClick={submit} disabled={createMutation.isPending}>
            {createMutation.isPending
              ? t("common.loading", { defaultValue: "Loading…" })
              : t("settings.notifications.save", { defaultValue: "Save" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
