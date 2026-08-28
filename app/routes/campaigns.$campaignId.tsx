import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Ban,
  CalendarClock,
  Play,
  Send as SendIcon,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { CampaignAnalytics } from "~/components/email-campaigns/campaigns/CampaignAnalytics";
import { CampaignStatusBadge } from "~/components/email-campaigns/campaigns/CampaignStatusBadge";
import { TestSendDialog } from "~/components/email-campaigns/builder/TestSendDialog";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  cancelCampaign,
  getCampaign,
  listCampaignSends,
  resumeCampaign,
  scheduleCampaign,
  type CampaignSummary,
} from "~/lib/api/email-campaigns";
import { Skeleton } from "~/components/ui/skeleton";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { formatDateTime, formatNumber } from "~/lib/utils/format";

/**
 * A rate against what was actually delivered.
 *
 * Denominator is `sent`, not the audience: a bounce never had the chance to be
 * opened, so counting it against the open rate understates the campaign.
 */
function rate(value: number, of: number): string {
  if (!of) return "—";
  return `${Math.round((value / of) * 100)}%`;
}

export default function CampaignDetail() {
  const { t } = useTranslation();
  const { campaignId } = useParams<{ campaignId: string }>();
  const queryClient = useQueryClient();
  useDocumentMeta({
    titleKey: "emailCampaigns.list.metaTitle",
    titleSuffix: " - Repraesent",
  });

  const { data: campaign, isPending } = useQuery({
    queryKey: ["email-campaign", campaignId],
    queryFn: () => getCampaign(campaignId!),
    enabled: !!campaignId,
    // Live progress while sending.
    refetchInterval: (query) =>
      query.state.data?.status === "sending" ||
      query.state.data?.status === "scheduled"
        ? 10_000
        : false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["email-campaign", campaignId] });
    queryClient.invalidateQueries({ queryKey: ["email-campaigns"] });
  };

  const doSchedule = useMutation({
    mutationFn: () => scheduleCampaign(campaignId!, null),
    onSuccess: () => {
      invalidate();
      toast.success(
        t("emailCampaigns.detail.sendStarted", {
          defaultValue: "Sending started",
        }),
      );
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
  const doCancel = useMutation({
    mutationFn: () => cancelCampaign(campaignId!),
    onSuccess: invalidate,
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
  const doResume = useMutation({
    mutationFn: () => resumeCampaign(campaignId!),
    onSuccess: invalidate,
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  if (isPending || !campaign) {
    return (
      <div className="mx-auto w-full max-w-[1280px] space-y-5 p-4 py-10! sm:p-6">
        <Skeleton className="h-10 w-72 rounded-lg" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const progress =
    campaign.total_recipients > 0
      ? Math.round((campaign.sent_count / campaign.total_recipients) * 100)
      : 0;

  // Configuration while it is still being decided; results once it has gone out.
  const hasSent =
    campaign.status === "sending" ||
    campaign.status === "sent" ||
    campaign.status === "paused";
  const defaultTab = hasSent ? "analytics" : "overview";

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-5 p-4 py-10! sm:p-6 app-fade-in">
      <div className="app-fade-up flex flex-wrap items-center gap-3">
        <Link
          to="/campaigns"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"
          aria-label={t("common.back", { defaultValue: "Back" })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {campaign.name}
        </h1>
        <CampaignStatusBadge status={campaign.status} />
        <CampaignActions
          campaign={campaign}
          onSchedule={() => doSchedule.mutate()}
          onCancel={() => {
            if (
              window.confirm(
                t("emailCampaigns.detail.cancelConfirm", {
                  defaultValue:
                    "Cancel this campaign? Pending emails will not be sent.",
                }),
              )
            ) {
              doCancel.mutate();
            }
          }}
          onResume={() => doResume.mutate()}
          busy={
            doSchedule.isPending || doCancel.isPending || doResume.isPending
          }
        />
      </div>

      {/*
        The four numbers anyone opens a sent campaign to see, in the header so
        they survive whichever tab you are on. Rates are shown against
        *delivered*, not against the audience, because a bounce is not a
        recipient who ignored you.
      */}
      {hasSent ? (
        <dl className="app-fade-up grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
          {[
            {
              label: t("emailCampaigns.detail.kpiDelivered", {
                defaultValue: "Delivered",
              }),
              value: formatNumber(campaign.sent_count),
              sub: t("emailCampaigns.detail.kpiOf", {
                defaultValue: "of {{total}}",
                total: formatNumber(campaign.total_recipients),
              }),
            },
            {
              label: t("emailCampaigns.detail.kpiOpened", {
                defaultValue: "Opened",
              }),
              value: rate(campaign.unique_open_count, campaign.sent_count),
              sub: formatNumber(campaign.unique_open_count),
            },
            {
              label: t("emailCampaigns.detail.kpiClicked", {
                defaultValue: "Clicked",
              }),
              value: rate(campaign.unique_click_count, campaign.sent_count),
              sub: formatNumber(campaign.unique_click_count),
            },
            {
              label: t("emailCampaigns.detail.kpiUnsubscribed", {
                defaultValue: "Unsubscribed",
              }),
              value: rate(campaign.unsubscribe_count, campaign.sent_count),
              sub: formatNumber(campaign.unsubscribe_count),
            },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-card px-4 py-3">
              <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {kpi.label}
              </dt>
              <dd className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-semibold tabular-nums">
                  {kpi.value}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {kpi.sub}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {campaign.status === "sending" || campaign.status === "paused" ? (
        <div className="space-y-1 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span>
              {t("emailCampaigns.detail.progress", {
                defaultValue: "{{sent}} of {{total}} sent",
                sent: campaign.sent_count,
                total: campaign.total_recipients,
              })}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {progress}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
          {campaign.status === "paused" ? (
            <p className="pt-1 text-xs text-orange-600 dark:text-orange-400">
              {t("emailCampaigns.detail.pausedHint", {
                defaultValue:
                  "Paused — the sending mailbox needs to be reconnected under Settings → Email accounts, then resume.",
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      {campaign.status === "scheduled" && campaign.scheduled_at ? (
        <p className="flex items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/5 px-4 py-3 text-sm text-blue-700 dark:text-blue-400">
          <CalendarClock className="h-4 w-4" />
          {t("emailCampaigns.detail.scheduledFor", {
            defaultValue: "Scheduled for {{when}}",
            when: formatDateTime(campaign.scheduled_at),
          })}
        </p>
      ) : null}

      {/*
        The landing tab follows the campaign's state. A draft is still being
        configured, so its settings are the answer; a campaign that has sent is
        only ever opened to find out how it did, and burying that behind a tab
        made the page greet you with the half you were not asking about.
        `key` forces the tab state to re-derive once the campaign loads.
      */}
      <Tabs
        key={defaultTab}
        defaultValue={defaultTab}
        className="app-fade-up app-fade-up-d1"
      >
        <TabsList variant="line">
          <TabsTrigger value="overview">
            {t("emailCampaigns.detail.tabOverview", {
              defaultValue: "Overview",
            })}
          </TabsTrigger>
          <TabsTrigger value="recipients">
            {t("emailCampaigns.detail.tabRecipients", {
              defaultValue: "Recipients",
            })}
          </TabsTrigger>
          {/* "Performance", not "Analytics" — the sidebar already has an
              Analytics section meaning website traffic, and the collision sent
              me to the wrong page while auditing this. */}
          <TabsTrigger value="analytics">
            {t("emailCampaigns.detail.tabPerformance", {
              defaultValue: "Performance",
            })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <CampaignOverview campaign={campaign} />
        </TabsContent>
        <TabsContent value="recipients" className="pt-4">
          <RecipientsTable campaignId={campaign.id} />
        </TabsContent>
        <TabsContent value="analytics" className="pt-4">
          <CampaignAnalytics campaign={campaign} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CampaignActions({
  campaign,
  onSchedule,
  onCancel,
  onResume,
  busy,
}: {
  campaign: CampaignSummary;
  onSchedule: () => void;
  onCancel: () => void;
  onResume: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [testOpen, setTestOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      {campaign.template_id ? (
        <>
          <Button variant="outline" size="sm" onClick={() => setTestOpen(true)}>
            {t("emailCampaigns.detail.testSend", { defaultValue: "Test" })}
          </Button>
          <TestSendDialog
            open={testOpen}
            onOpenChange={setTestOpen}
            templateId={campaign.template_id}
            locale="de"
          />
        </>
      ) : null}
      {campaign.status === "draft" ? (
        <Button size="sm" onClick={onSchedule} disabled={busy}>
          <SendIcon className="mr-1.5 h-3.5 w-3.5" />
          {t("emailCampaigns.detail.sendNow", { defaultValue: "Send now" })}
        </Button>
      ) : null}
      {campaign.status === "paused" ? (
        <Button size="sm" onClick={onResume} disabled={busy}>
          <Play className="mr-1.5 h-3.5 w-3.5" />
          {t("emailCampaigns.detail.resume", { defaultValue: "Resume" })}
        </Button>
      ) : null}
      {["scheduled", "sending", "paused"].includes(campaign.status) ? (
        <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
          <Ban className="mr-1.5 h-3.5 w-3.5" />
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
      ) : null}
    </div>
  );
}

function CampaignOverview({ campaign }: { campaign: CampaignSummary }) {
  const { t } = useTranslation();
  const rows: [string, React.ReactNode][] = [
    [
      t("emailCampaigns.wizard.step_audience", { defaultValue: "Audience" }),
      campaign.segment_name ?? "—",
    ],
    [
      t("emailCampaigns.wizard.step_template", { defaultValue: "Template" }),
      campaign.template_name ?? "—",
    ],
    [
      t("emailCampaigns.wizard.fromMailbox", { defaultValue: "Send from" }),
      campaign.email_account_email ??
        t("emailCampaigns.wizard.defaultAccount", {
          defaultValue: "Workspace default",
        }),
    ],
    [
      t("emailCampaigns.wizard.replyTo", { defaultValue: "Reply-to" }),
      campaign.reply_to ?? "—",
    ],
    [
      t("emailCampaigns.detail.audienceAtSchedule", {
        defaultValue: "Audience at scheduling",
      }),
      campaign.audience_sendable_count !== null
        ? `${campaign.audience_sendable_count} / ${campaign.audience_matched_count}`
        : "—",
    ],
    [
      t("emailCampaigns.detail.completedAt", { defaultValue: "Completed" }),
      campaign.completed_at ? formatDateTime(campaign.completed_at) : "—",
    ],
  ];

  return (
    <dl className="grid gap-x-6 gap-y-4 rounded-2xl border border-border bg-card p-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="space-y-0.5">
          <dt className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {label}
          </dt>
          <dd className="min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RecipientsTable({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | undefined>(undefined);

  const { data } = useQuery({
    queryKey: ["email-campaign-sends", campaignId, page, status],
    queryFn: () => listCampaignSends(campaignId, { page, limit: 25, status }),
  });

  const STATUSES = [
    "pending",
    "sending",
    "sent",
    "failed",
    "skipped",
    "cancelled",
  ] as const;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          active={status === undefined}
          onClick={() => {
            setStatus(undefined);
            setPage(1);
          }}
          label={t("common.all", { defaultValue: "All" })}
        />
        {STATUSES.map((key) => (
          <FilterChip
            key={key}
            active={status === key}
            onClick={() => {
              setStatus(key);
              setPage(1);
            }}
            label={t(`emailCampaigns.sendStatus.${key}`, { defaultValue: key })}
          />
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                {t("emailCampaigns.detail.recipient", {
                  defaultValue: "Recipient",
                })}
              </TableHead>
              <TableHead>
                {t("emailCampaigns.detail.sendStatus", {
                  defaultValue: "Status",
                })}
              </TableHead>
              <TableHead>
                {t("emailCampaigns.detail.sentAt", { defaultValue: "Sent" })}
              </TableHead>
              <TableHead>
                {t("emailCampaigns.detail.engagement", {
                  defaultValue: "Engagement",
                })}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.data ?? []).map((send) => (
              <TableRow key={send.id}>
                <TableCell>
                  {send.contact_id ? (
                    <Link
                      to={`/contacts/${send.contact_id}`}
                      className="hover:underline"
                    >
                      {send.to_email}
                    </Link>
                  ) : (
                    send.to_email
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-xs">
                    {t(`emailCampaigns.sendStatus.${send.status}`, {
                      defaultValue: send.status,
                    })}
                    {send.skip_reason ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {send.skip_reason}
                      </span>
                    ) : null}
                    {send.status === "failed" && send.last_error ? (
                      <span
                        className="block max-w-56 truncate text-muted-foreground"
                        title={send.last_error}
                      >
                        {send.last_error}
                      </span>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {send.sent_at ? formatDateTime(send.sent_at) : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {[
                    send.opened_at
                      ? t("emailCampaigns.detail.opened", {
                          defaultValue: "opened",
                        })
                      : null,
                    send.clicked_at
                      ? t("emailCampaigns.detail.clicked", {
                          defaultValue: "clicked",
                        })
                      : null,
                    send.unsubscribed_at
                      ? t("emailCampaigns.detail.unsubscribed", {
                          defaultValue: "unsubscribed",
                        })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data && data.totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!data.hasPrev}
            onClick={() => setPage((value) => value - 1)}
          >
            {t("common.previous", { defaultValue: "Previous" })}
          </Button>
          <span className="text-xs text-muted-foreground">
            {data.page} / {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!data.hasNext}
            onClick={() => setPage((value) => value + 1)}
          >
            {t("common.next", { defaultValue: "Next" })}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
