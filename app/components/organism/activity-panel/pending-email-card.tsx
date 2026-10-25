import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { EmailCard } from "~/components/organism/email-card";
import TooltipContainer from "~/components/tooltip-container";
import type { BccMessage } from "~/lib/api/bcc-logs";
import type { PendingOutboundEmail } from "~/lib/api/outbound-mail";
import {
  emailsQuery,
  pendingOutboundQuery,
  type ActivityContext,
  type Variant,
} from "./shared";

/** How often to re-check for an ingested copy while a send is still in flight. */
export const PENDING_POLL_MS = 20_000;

/**
 * Sent-but-not-ingested emails for a contact or deal, shared by the All feed
 * and both Emails tabs (same key, one cache).
 *
 * Polls only while something is pending: the app's global query defaults turn
 * off every automatic refetch. When a placeholder drops out, its real copy has
 * landed, so the message list is refetched to put it in the same spot.
 */
export function usePendingOutbound(ctx: ActivityContext, variant: Variant) {
  const queryClient = useQueryClient();
  const pq = pendingOutboundQuery(ctx, variant);
  const emailsKey = emailsQuery(ctx, variant).key;
  const query = useQuery({
    queryKey: pq.key,
    queryFn: pq.fn,
    enabled: !!pq.id,
    refetchInterval: (q) =>
      (q.state.data?.length ?? 0) > 0 ? PENDING_POLL_MS : false,
  });

  const count = query.data?.length;
  const prev = useRef(count);
  useEffect(() => {
    if (count !== undefined && prev.current !== undefined && count < prev.current) {
      void queryClient.invalidateQueries({ queryKey: emailsKey });
    }
    prev.current = count;
    // emailsKey is rebuilt every render; its contents only change with ctx.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, queryClient, JSON.stringify(emailsKey)]);

  return query;
}

/**
 * Render a just-sent email with the same card as an ingested one.
 *
 * Reshaping into `BccMessage` rather than writing a second card keeps the two
 * states visually identical, so when the real message replaces this one nothing
 * appears to move.
 */
function toMessage(pending: PendingOutboundEmail): BccMessage {
  const participants: BccMessage["participants"] = [
    ...pending.to_emails.map((email, i) => ({
      id: `${pending.id}-to-${i}`,
      bcc_log_message_id: pending.id,
      kind: "to" as const,
      email,
      display_name: null,
    })),
    ...pending.cc_emails.map((email, i) => ({
      id: `${pending.id}-cc-${i}`,
      bcc_log_message_id: pending.id,
      kind: "cc" as const,
      email,
      display_name: null,
    })),
  ];

  return {
    id: pending.id,
    bcc_log_address_id: "",
    workspace_id: "",
    message_id_header: null,
    subject: pending.subject,
    from_address: pending.from_email || null,
    from_name: pending.from_name,
    sent_at: pending.sent_at,
    text_body: pending.text_body,
    html_body: pending.html_body,
    ingested_at: pending.sent_at ?? new Date().toISOString(),
    participants,
  };
}

export function PendingEmailCard({
  pending,
  locale,
}: {
  pending: PendingOutboundEmail;
  locale: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="opacity-90">
      <EmailCard
        message={toMessage(pending)}
        locale={locale}
        actions={
          <TooltipContainer
            tooltipContent={t("compose.syncingHint", {
              defaultValue:
                "Delivered. It appears here as a normal email once the logged copy is processed — usually a few minutes.",
            })}
            showCopyButton={false}
          >
            <span
              tabIndex={0}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Clock aria-hidden className="size-3" />
              {t("compose.syncing", { defaultValue: "Sent · syncing" })}
            </span>
          </TooltipContainer>
        }
      />
    </div>
  );
}

/**
 * The pending list plus its polling behaviour, shared by the contact and deal
 * Emails tabs.
 *
 * Polling is deliberately conditional: the app's global query defaults turn off
 * every automatic refetch, so without this a placeholder would sit there until
 * the user navigated away and back.
 */
export function PendingEmailsList({
  pending,
  locale,
}: {
  pending: PendingOutboundEmail[];
  locale: string;
}) {
  if (pending.length === 0) return null;
  return (
    <div className="space-y-3">
      {pending.map((p) => (
        <PendingEmailCard key={p.id} pending={p} locale={locale} />
      ))}
    </div>
  );
}
