import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Send as SendIcon, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { CampaignStatusBadge } from "~/components/email-campaigns/campaigns/CampaignStatusBadge";
import { FilterComponent } from "~/components/molecule/filter-component";
import type { Filter } from "~/components/molecule/filter-component/types";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  deleteCampaign,
  listCampaigns,
  type CampaignSummary,
} from "~/lib/api/email-campaigns";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { useSearchShortcut } from "~/lib/hooks/useSearchShortcut";

export default function CampaignsIndex() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  useDocumentMeta({
    titleKey: "emailCampaigns.list.metaTitle",
    titleSuffix: " - Repraesent",
  });

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const { ref: searchInputRef, withHint } = useSearchShortcut();
  const status = searchParams.get("status") ?? undefined;

  const { data, isPending } = useQuery({
    queryKey: ["email-campaigns", debouncedSearch, status],
    queryFn: () =>
      listCampaigns({ page: 1, limit: 100, search: debouncedSearch, status }),
  });

  const remove = useMutation({
    mutationFn: deleteCampaign,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["email-campaigns"] }),
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const statusFilter: Filter[] = useMemo(
    () => [
      {
        name: "campaign_status",
        paramKey: "status",
        single: true,
        options: (
          [
            "draft",
            "scheduled",
            "sending",
            "paused",
            "sent",
            "cancelled",
          ] as const
        ).map((key) => ({
          key,
          label: t(`emailCampaigns.status.${key}`, { defaultValue: key }),
        })),
      },
    ],
    [t],
  );

  const campaigns = data?.data ?? [];
  const fmt = (value: number) => value.toLocaleString(i18n.language);

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 p-4 py-10! sm:space-y-8 sm:p-6 app-fade-in">
      <div className="flex flex-col gap-3 app-fade-up sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {t("emailCampaigns.list.title", { defaultValue: "Campaigns" })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("emailCampaigns.list.subtitle", {
              defaultValue: "Email broadcasts to your segments.",
            })}
          </p>
        </div>
        <Button onClick={() => navigate("/campaigns/new")}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("emailCampaigns.list.create", { defaultValue: "New campaign" })}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 app-fade-up app-fade-up-d1">
        <Input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={withHint(
            t("emailCampaigns.list.searchPlaceholder", {
              defaultValue: "Search campaigns…",
            }),
          )}
          className="max-w-sm"
        />
        <FilterComponent filters={statusFilter} />
      </div>

      {isPending ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("common.loading", { defaultValue: "Loading…" })}
        </p>
      ) : campaigns.length === 0 ? (
        <div className="app-fade-up flex flex-col items-center gap-3 rounded-2xl border border-dashed px-4 py-16 text-center">
          <SendIcon className="h-8 w-8 text-muted-foreground/50" />
          <div>
            <p className="font-medium">
              {t("emailCampaigns.list.emptyTitle", {
                defaultValue: "No campaigns yet",
              })}
            </p>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              {t("emailCampaigns.list.emptyHint", {
                defaultValue:
                  "Pick a segment, pick a template, schedule the send — the rest runs itself.",
              })}
            </p>
          </div>
          <Button onClick={() => navigate("/campaigns/new")} variant="outline">
            <Plus className="mr-1.5 h-4 w-4" />
            {t("emailCampaigns.list.create", { defaultValue: "New campaign" })}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map((campaign, index) => (
            <CampaignRow
              key={campaign.id}
              campaign={campaign}
              index={index}
              fmt={fmt}
              onDelete={() => {
                if (
                  window.confirm(
                    t("emailCampaigns.list.deleteConfirm", {
                      defaultValue: "Delete this campaign?",
                    }),
                  )
                ) {
                  remove.mutate(campaign.id);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignRow({
  campaign,
  index,
  fmt,
  onDelete,
}: {
  campaign: CampaignSummary;
  index: number;
  fmt: (value: number) => string;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const openRate =
    campaign.sent_count > 0
      ? Math.round((campaign.unique_open_count / campaign.sent_count) * 100)
      : null;

  return (
    <div
      className={`app-fade-up app-fade-up-d${Math.min(index + 1, 4)} group flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40`}
    >
      <Link
        to={`/campaigns/${campaign.id}`}
        className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1"
      >
        <span className="min-w-0 flex-1 basis-48 truncate font-medium">
          {campaign.name}
        </span>
        <CampaignStatusBadge status={campaign.status} />
        <span className="hidden text-xs text-muted-foreground sm:block">
          {campaign.segment_name ?? "—"}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {campaign.status === "draft"
            ? campaign.scheduled_at
              ? new Date(campaign.scheduled_at).toLocaleString()
              : t("emailCampaigns.list.notScheduled", {
                  defaultValue: "Not scheduled",
                })
            : t("emailCampaigns.list.progress", {
                defaultValue: "{{sent}} / {{total}} sent",
                sent: fmt(campaign.sent_count),
                total: fmt(campaign.total_recipients),
              })}
        </span>
        {openRate !== null ? (
          <span className="text-xs tabular-nums text-muted-foreground">
            {t("emailCampaigns.list.openRate", {
              defaultValue: "{{rate}}% opened",
              rate: openRate,
            })}
          </span>
        ) : null}
      </Link>
      {campaign.status !== "sending" && campaign.status !== "scheduled" ? (
        <button
          type="button"
          onClick={onDelete}
          aria-label={t("common.delete", { defaultValue: "Delete" })}
          className="rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
