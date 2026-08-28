import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Trash2, UsersRound } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { SegmentCountBadge } from "~/components/email-campaigns/segments/SegmentCountBadge";
import { SuppressionsPanel } from "~/components/email-campaigns/segments/SuppressionsPanel";
import { ConfirmDeleteDialog } from "~/components/molecule/confirm-delete-dialog";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  createSegment,
  deleteSegment,
  listSegments,
  refreshSegmentCounts,
  type SegmentSummary,
} from "~/lib/api/segments";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { formatDateMedium } from "~/lib/utils/format";

export default function SegmentsIndex() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useDocumentMeta({
    titleKey: "emailCampaigns.segments.metaTitle",
    titleSuffix: " - Repraesent",
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<"dynamic" | "manual">("dynamic");
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { data: segments, isPending } = useQuery({
    queryKey: ["segments"],
    queryFn: listSegments,
  });

  const create = useMutation({
    mutationFn: () => createSegment({ name: newName.trim(), kind: newKind }),
    onSuccess: (segment) => {
      queryClient.invalidateQueries({ queryKey: ["segments"] });
      navigate(`/segments/${segment.id}`);
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: deleteSegment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["segments"] }),
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 p-4 py-10! sm:space-y-8 sm:p-6 app-fade-in">
      <div className="flex flex-col gap-3 app-fade-up sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {t("emailCampaigns.segments.title", { defaultValue: "Segments" })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("emailCampaigns.segments.subtitle", {
              defaultValue: "Saved audiences for your email campaigns.",
            })}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("emailCampaigns.segments.create", { defaultValue: "New segment" })}
        </Button>
      </div>

      {isPending ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("common.loading", { defaultValue: "Loading…" })}
        </p>
      ) : (segments?.length ?? 0) === 0 ? (
        <div className="app-fade-up flex flex-col items-center gap-3 rounded-2xl border border-dashed px-4 py-16 text-center">
          <UsersRound className="h-8 w-8 text-muted-foreground/50" />
          <div>
            <p className="font-medium">
              {t("emailCampaigns.segments.emptyTitle", {
                defaultValue: "No segments yet",
              })}
            </p>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              {t("emailCampaigns.segments.emptyHint", {
                defaultValue:
                  "Define who a campaign goes to — by conditions over your contacts, or a hand-picked list.",
              })}
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} variant="outline">
            <Plus className="mr-1.5 h-4 w-4" />
            {t("emailCampaigns.segments.create", {
              defaultValue: "New segment",
            })}
          </Button>
        </div>
      ) : (
        <div className="app-fade-up app-fade-up-d1 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {segments!.map((segment) => (
            <SegmentCard
              key={segment.id}
              segment={segment}
              onDelete={() => setPendingDelete(segment)}
            />
          ))}
        </div>
      )}

      <div className="app-fade-up app-fade-up-d2">
        <SuppressionsPanel />
      </div>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => !next && setPendingDelete(null)}
        name={pendingDelete?.name ?? null}
        description={t("emailCampaigns.segments.deleteConfirm", {
          defaultValue:
            "Campaigns already sent to it are unaffected, but you cannot send to this audience again without rebuilding it. This cannot be undone.",
        })}
        busy={remove.isPending}
        onConfirm={() => {
          if (pendingDelete) remove.mutate(pendingDelete.id);
          setPendingDelete(null);
        }}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t("emailCampaigns.segments.create", {
                defaultValue: "New segment",
              })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("emailCampaigns.segments.namePlaceholder", {
                defaultValue: "Segment name",
              })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) create.mutate();
              }}
            />
            <div className="grid grid-cols-2 gap-2">
              {(["dynamic", "manual"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setNewKind(kind)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    newKind === kind
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <Label className="text-sm">
                    {t(`emailCampaigns.segments.kind_${kind}`, {
                      defaultValue: kind === "dynamic" ? "Dynamic" : "Manual",
                    })}
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t(`emailCampaigns.segments.kind_${kind}_hint`, {
                      defaultValue:
                        kind === "dynamic"
                          ? "Contacts matching conditions, always current"
                          : "A hand-picked list you manage yourself",
                    })}
                  </p>
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => create.mutate()}
              disabled={!newName.trim() || create.isPending}
            >
              {create.isPending
                ? t("common.creating", { defaultValue: "Creating…" })
                : t("common.create", { defaultValue: "Create" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SegmentCard({
  segment,
  onDelete,
}: {
  segment: SegmentSummary;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const refresh = useMutation({
    mutationFn: () => refreshSegmentCounts(segment.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["segments"] }),
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  return (
    <div className="group relative rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
      <Link to={`/segments/${segment.id}`} className="block space-y-2">
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium">{segment.name}</span>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`emailCampaigns.segments.kind_${segment.kind}`, {
              defaultValue: segment.kind,
            })}
          </span>
        </div>
        {segment.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {segment.description}
          </p>
        ) : null}
        {/*
          `pr-16` keeps this row clear of the refresh and delete buttons, which
          are pinned to the card's bottom-right corner and only appear on hover.
          Without it they landed directly on top of the date — 52px of overlap,
          both unreadable.
        */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-16">
          <SegmentCountBadge
            matched={segment.matched_count}
            sendable={segment.sendable_count}
            loading={refresh.isPending}
          />
          {/* When the counts were taken. `counts_refreshed_at` rather than
              `updated_at`: a count is only worth reading if you know how old it
              is, and for a dynamic segment the definition can be untouched for
              months while the numbers move every day.

              Flows directly after the counts rather than being pushed to the
              right edge — it describes them, so proximity is the point. */}
          {segment.counts_refreshed_at ? (
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {t("emailCampaigns.segments.countedAt", {
                defaultValue: "Counted {{when}}",
                when: formatDateMedium(segment.counts_refreshed_at),
              })}
            </span>
          ) : null}
        </div>
      </Link>
      <div className="absolute bottom-3 right-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          aria-label={t("emailCampaigns.segments.refresh", {
            defaultValue: "Refresh counts",
          })}
          className="rounded p-1.5 text-muted-foreground hover:bg-muted"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${refresh.isPending ? "animate-spin" : ""}`}
          />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={t("common.delete", { defaultValue: "Delete" })}
          className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
