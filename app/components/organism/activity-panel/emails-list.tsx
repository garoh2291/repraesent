import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Inbox, Send } from "lucide-react";
import { EmailCard } from "~/components/organism/email-card";
import { EmailReplyActions } from "~/components/organism/compose-email/email-reply-actions";
import { useComposeEmail } from "~/components/organism/compose-email/use-compose-email";
import type { Recipient } from "~/components/organism/compose-email/recipient-field";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import {
  composeInvalidateKeys,
  emailsQuery,
  pendingOutboundQuery,
  type ActivityContext,
  type Variant,
} from "./shared";
import { PendingEmailsList } from "./pending-email-card";
import { DealEmailsPanel } from "./deal-emails-panel";

/** How often to re-check for an ingested copy while a send is still in flight. */
export const PENDING_POLL_MS = 60_000;

export function ActivityEmailsList({
  ctx,
  variant,
  contextLabel,
  canEdit,
  composeRecipients,
}: {
  ctx: ActivityContext;
  variant: Variant;
  contextLabel?: string;
  canEdit?: boolean;
  composeRecipients?: Recipient[];
}) {
  const { t, i18n } = useTranslation();

  // Deal context gets the segment/hide UI (rules bar + Pipeline/Hidden sub-tabs).
  if (variant === "deal") {
    return (
      <DealEmailsPanel
        ctx={ctx}
        contextLabel={contextLabel}
        composeRecipients={composeRecipients}
      />
    );
  }

  return (
    <ContactEmailsList
      ctx={ctx}
      contextLabel={contextLabel}
      canEdit={canEdit}
      composeRecipients={composeRecipients}
      t={t}
      locale={i18n.language}
    />
  );
}

function ContactEmailsList({
  ctx,
  contextLabel,
  canEdit,
  composeRecipients,
  t,
  locale,
}: {
  ctx: ActivityContext;
  contextLabel?: string;
  canEdit?: boolean;
  composeRecipients?: Recipient[];
  t: ReturnType<typeof useTranslation>["t"];
  locale: string;
}) {
  const { openCompose } = useComposeEmail();
  const q = emailsQuery(ctx, "contact");
  const pq = pendingOutboundQuery(ctx, "contact");

  const { data, isLoading, isError } = useQuery({
    queryKey: q.key,
    queryFn: q.fn,
    enabled: !!q.id,
  });

  const { data: pending } = useQuery({
    queryKey: pq.key,
    queryFn: pq.fn,
    enabled: !!pq.id,
    // The app disables every automatic refetch globally, so a placeholder would
    // otherwise sit there until the user navigated away and back.
    refetchInterval: (query) =>
      (query.state.data?.length ?? 0) > 0 ? PENDING_POLL_MS : false,
  });

  const compose = () =>
    openCompose({
      to: composeRecipients,
      contactId: ctx.emailContactId,
      contextLabel,
      invalidateKeys: composeInvalidateKeys(ctx, "contact"),
    });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-[76px] w-full rounded-xl" />
        <Skeleton className="h-[76px] w-full rounded-xl" />
      </div>
    );
  }
  if (isError) {
    return (
      <p className="text-sm text-destructive">{t("leadEmails.loadError")}</p>
    );
  }

  const messages = data?.data ?? [];
  const pendingList = pending ?? [];

  if (messages.length === 0 && pendingList.length === 0) {
    return (
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
          {canEdit && ctx.emailContactId && (
            <Button size="sm" className="gap-1.5" onClick={compose}>
              <Send className="size-3.5" />
              {t("compose.emptyCta", { defaultValue: "Send first email" })}
            </Button>
          )}
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/settings/bcc">{t("leadEmails.emptyCta")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const invalidateKeys = composeInvalidateKeys(ctx, "contact");

  return (
    <div className="space-y-3">
      <PendingEmailsList pending={pendingList} locale={locale} />
      {messages.map((m) => (
        <EmailCard
          key={m.id}
          message={m}
          locale={locale}
          actions={
            canEdit ? (
              <EmailReplyActions
                message={m}
                contactId={ctx.emailContactId}
                contextLabel={contextLabel}
                invalidateKeys={invalidateKeys}
              />
            ) : undefined
          }
        />
      ))}
    </div>
  );
}
