import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import {
  Inbox,
  Send,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { EmailCard } from "~/components/organism/email-card";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";
import { EmailReplyActions } from "~/components/organism/compose-email/email-reply-actions";
import { useComposeEmail } from "~/components/organism/compose-email/use-compose-email";
import type { Recipient } from "~/components/organism/compose-email/recipient-field";
import { DealEmailCardActions } from "./deal-email-card-actions";
import { DealEmailSegmentEditor } from "./deal-email-rules-editor";
import { PendingEmailsList } from "./pending-email-card";
import { PENDING_POLL_MS } from "./emails-list";
import {
  composeInvalidateKeys,
  emailsQuery,
  dealEmailSegmentQuery,
  pendingOutboundQuery,
  type ActivityContext,
} from "./shared";

export function DealEmailsPanel({
  ctx,
  contextLabel,
  composeRecipients,
}: {
  ctx: ActivityContext;
  contextLabel?: string;
  composeRecipients?: Recipient[];
}) {
  const { t, i18n } = useTranslation();
  const { openCompose } = useComposeEmail();
  const dealId = ctx.dealId!;
  const q = emailsQuery(ctx, "deal");
  const sq = dealEmailSegmentQuery(dealId);
  const pq = pendingOutboundQuery(ctx, "deal");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [sub, setSub] = useState<"pipeline" | "hidden">("pipeline");

  const { data, isLoading, isError } = useQuery({
    queryKey: q.key,
    queryFn: q.fn,
    enabled: !!q.id,
  });
  const { data: segment } = useQuery({ queryKey: sq.key, queryFn: sq.fn });
  const { data: pending } = useQuery({
    queryKey: pq.key,
    queryFn: pq.fn,
    enabled: !!pq.id,
    refetchInterval: (query) =>
      (query.state.data?.length ?? 0) > 0 ? PENDING_POLL_MS : false,
  });
  const conditionCount = segment?.conditions.length ?? 0;

  const messages = data?.data ?? [];
  const pendingList = pending ?? [];
  const invalidateKeys = composeInvalidateKeys(ctx, "deal");
  const pipeline = messages.filter((m) => !m.hidden);
  const hiddenList = messages.filter((m) => m.hidden);

  const rulesBar = (
    <div className="rounded-lg border border-border bg-muted/30">
      <button
        type="button"
        onClick={() => setRulesOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-foreground"
      >
        <span className="inline-flex items-center gap-1.5">
          <SlidersHorizontal className="size-3.5 text-muted-foreground" />
          {t("dealEmails.segmentRules", { defaultValue: "Segment" })}
          {conditionCount > 0 && (
            <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-semibold text-primary">
              {conditionCount}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            rulesOpen && "rotate-180",
          )}
        />
      </button>
      {rulesOpen && (
        <div className="border-t border-border p-3">
          <DealEmailSegmentEditor dealId={dealId} />
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {rulesBar}
        <Skeleton className="h-[76px] w-full rounded-xl" />
        <Skeleton className="h-[76px] w-full rounded-xl" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="space-y-3">
        {rulesBar}
        <p className="text-sm text-destructive">{t("leadEmails.loadError")}</p>
      </div>
    );
  }

  if (messages.length === 0 && pendingList.length === 0) {
    return (
      <div className="space-y-3">
        {rulesBar}
        <div className="flex flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-border py-12 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Inbox className="size-5" />
          </span>
          <p className="text-sm font-medium text-foreground">
            {t("leadEmails.emptyTitle")}
          </p>
          <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
            {t("leadEmails.emptyDescription")}
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() =>
                openCompose({
                  to: composeRecipients,
                  dealId,
                  contextLabel,
                  invalidateKeys,
                })
              }
            >
              <Send className="size-3.5" />
              {t("compose.emptyCta", { defaultValue: "Send first email" })}
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/settings/bcc">{t("leadEmails.emptyCta")}</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const list = (msgs: typeof messages, emptyText: string) =>
    msgs.length === 0 ? (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyText}
      </p>
    ) : (
      <div className="space-y-3">
        {msgs.map((m) => (
          <EmailCard
            key={m.id}
            message={m}
            locale={i18n.language}
            actions={
              <>
                <EmailReplyActions
                  message={m}
                  dealId={dealId}
                  contextLabel={contextLabel}
                  invalidateKeys={invalidateKeys}
                />
                <DealEmailCardActions dealId={dealId} message={m} />
              </>
            }
          />
        ))}
      </div>
    );

  return (
    <div className="space-y-3">
      {rulesBar}
      {/* Above the sub-tabs on purpose: a send in flight has no `hidden` state
          yet, so it belongs to neither tab — and burying it would defeat the
          point of showing it at all. */}
      <PendingEmailsList pending={pendingList} locale={i18n.language} />
      <Tabs
        value={sub}
        onValueChange={(v) => setSub(v as "pipeline" | "hidden")}
      >
        <TabsList variant="line" className="h-8">
          <TabsTrigger value="pipeline" className="text-[11px]">
            {t("dealEmails.pipeline", { defaultValue: "Pipeline emails" })} (
            {pipeline.length})
          </TabsTrigger>
          <TabsTrigger value="hidden" className="text-[11px]">
            {t("dealEmails.hidden", { defaultValue: "Hidden emails" })} (
            {hiddenList.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline" className="mt-3">
          {list(
            pipeline,
            conditionCount > 0
              ? t("dealEmails.segmentEmptyPipeline", {
                  defaultValue: "No emails match this segment.",
                })
              : t("dealEmails.emptyPipeline", {
                  defaultValue: "All emails are hidden.",
                }),
          )}
        </TabsContent>
        <TabsContent value="hidden" className="mt-3">
          {list(
            hiddenList,
            t("dealEmails.emptyHidden", {
              defaultValue: "No hidden emails.",
            }),
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
