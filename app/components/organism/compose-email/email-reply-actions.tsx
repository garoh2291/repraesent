import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Reply, ReplyAll } from "lucide-react";
import { getBccAddress, type BccMessage } from "~/lib/api/bcc-logs";
import { listEmailAccountsForWorkspace } from "~/lib/api/email-accounts";
import { Button } from "~/components/ui/button";
import { replyQuote, replyRecipients, replySubject } from "./build-reply";
import { useComposeEmail } from "./use-compose-email";

/**
 * Reply / Reply All in an EmailCard footer.
 *
 * Both open the shared composer, which re-adds the locked BCC logging address
 * on its own — a reply has to come back through ingest exactly like a fresh
 * send, or it would never appear on the contact or the deal.
 */
export function EmailReplyActions({
  message,
  dealId,
  contactId,
  contextLabel,
  invalidateKeys,
}: {
  message: BccMessage;
  dealId?: string;
  contactId?: string;
  contextLabel?: string;
  invalidateKeys?: readonly (readonly unknown[])[];
}) {
  const { t, i18n } = useTranslation();
  const { openCompose } = useComposeEmail();

  // Read-only reads of keys other surfaces own; never invalidated from here.
  const { data: accounts } = useQuery({
    queryKey: ["workspace-email-accounts"],
    queryFn: listEmailAccountsForWorkspace,
  });
  const { data: bccAddress } = useQuery({
    queryKey: ["bcc-address"],
    queryFn: getBccAddress,
  });

  const open = (all: boolean) => {
    const { to, cc } = replyRecipients(message, all, {
      ownAddresses: (accounts ?? []).map((a) => a.email),
      bccDomain: bccAddress?.domain ?? "bcc.repraesent.com",
    });

    openCompose({
      to,
      cc,
      subject: replySubject(message.subject),
      html: replyQuote(message, i18n.language, t),
      dealId,
      contactId,
      replyTo: message,
      contextLabel,
      invalidateKeys,
    });
  };

  // Reply All only earns its place when there is somebody else to copy.
  const others = message.participants.filter(
    (p) => (p.kind === "to" || p.kind === "cc") && !!p.email,
  );

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 gap-1.5 text-xs"
        onClick={() => open(false)}
        disabled={!message.from_address}
      >
        <Reply className="size-3.5" />
        {t("compose.reply", { defaultValue: "Reply" })}
      </Button>
      {others.length > 1 && (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 text-xs"
          onClick={() => open(true)}
          disabled={!message.from_address}
        >
          <ReplyAll className="size-3.5" />
          {t("compose.replyAll", { defaultValue: "Reply all" })}
        </Button>
      )}
    </>
  );
}
