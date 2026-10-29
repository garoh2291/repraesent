import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Mail, TriangleAlert } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { sortAccountsWithAliases } from "~/lib/api/email-accounts";
import { listEmailAccounts, type WorkspaceEmailAccountSummary } from "~/lib/api/workspaces";
import type { CalendarSender } from "~/lib/api/appointment-book";

const DEFAULT_ACCOUNT = "__default__";

/**
 * Where a calendar's emails will leave from with this pick — the same order
 * the server sends in (the pick, then the workspace default), and the
 * Repraesent address when neither can send. Live, so the notice follows the
 * select before anything is saved.
 */
export function senderOf(accounts: WorkspaceEmailAccountSummary[], emailAccountId: string | null): CalendarSender {
  const account = accounts.find((a) => a.id === emailAccountId) ?? accounts.find((a) => a.is_default);
  if (account) {
    return account.auth_failed_at
      ? { via: "platform", email: account.email, reason: "needs_reconnect" }
      : { via: "mailbox", email: account.email, reason: "ok" };
  }
  return accounts.length > 0
    ? { via: "platform", email: null, reason: "needs_reconnect" }
    : { via: "platform", email: null, reason: "no_mailbox" };
}

export function useEmailAccounts() {
  return useQuery({ queryKey: ["workspace-email-accounts"], queryFn: listEmailAccounts });
}

/** "Send from" for a calendar's customer emails; null = the workspace default. */
export function SenderSelect({
  value,
  onChange,
  className,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const accounts = useEmailAccounts();
  const userAccounts = useMemo(
    () => sortAccountsWithAliases((accounts.data ?? []).filter((a) => a.source === "user")),
    [accounts.data],
  );
  const managedAccounts = useMemo(() => (accounts.data ?? []).filter((a) => a.source !== "user"), [accounts.data]);
  const defaultAccount = (accounts.data ?? []).find((a) => a.is_default);

  return (
    <Select value={value ?? DEFAULT_ACCOUNT} onValueChange={(v) => onChange(v === DEFAULT_ACCOUNT ? null : v)}>
      <SelectTrigger className={cn("h-10 w-full max-sm:h-11 sm:max-w-sm", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={DEFAULT_ACCOUNT}>
          {defaultAccount
            ? t("appointmentBook.sender.defaultWith", "Your main mailbox ({{email}})", { email: defaultAccount.email })
            : t("appointmentBook.sender.default", "Your main mailbox")}
        </SelectItem>
        {userAccounts.length > 0 ? (
          <SelectGroup>
            <SelectLabel>{t("forms.email.accountGroupYours")}</SelectLabel>
            {userAccounts.map((a) => (
              <SelectItem key={a.id} value={a.id} disabled={!!a.auth_failed_at}>
                {a.parent_account_id ? "↳ " : ""}
                {a.name} · {a.email}
                {a.auth_failed_at ? ` — ${t("forms.email.accountNeedsReconnect")}` : ""}
              </SelectItem>
            ))}
          </SelectGroup>
        ) : null}
        {managedAccounts.length > 0 ? (
          <SelectGroup>
            <SelectLabel>{t("forms.email.accountGroupManaged")}</SelectLabel>
            {managedAccounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name} · {a.email}
              </SelectItem>
            ))}
          </SelectGroup>
        ) : null}
      </SelectContent>
    </Select>
  );
}

/**
 * What the customer's email will come from. Quiet when it is the business's
 * own mailbox; a marked note with the fix when it falls back to Repraesent's
 * address, because that one is more likely to end up in spam.
 */
export function SenderNotice({ sender, compact = false }: { sender: CalendarSender; compact?: boolean }) {
  const { t } = useTranslation();
  if (sender.via === "mailbox") {
    if (!sender.email) return null;
    return (
      <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
        <Mail className="size-3.5 shrink-0" aria-hidden />
        {t("appointmentBook.sender.from", "Sent from {{email}}", { email: sender.email })}
      </p>
    );
  }
  const reconnect = sender.reason === "needs_reconnect";
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-secondary bg-secondary/25 text-foreground",
        compact ? "px-3 py-2" : "p-3",
      )}
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-[13px] font-medium">
          {reconnect
            ? t("appointmentBook.sender.reconnectTitle", "Your mailbox needs reconnecting, so this goes out from Repraesent's address")
            : t("appointmentBook.sender.platformTitle", "This goes out from Repraesent's address, not yours")}
        </p>
        {compact ? null : (
          <p className="text-[12.5px] opacity-90">
            {t(
              "appointmentBook.sender.platformBody",
              "Customers see your business name, but some email programs trust it less and may put it in spam. Connect your own mailbox and it goes out from your address.",
            )}
          </p>
        )}
        <Link to="/settings/email-accounts" className="inline-block text-[12.5px] font-medium underline underline-offset-2">
          {reconnect
            ? t("appointmentBook.sender.reconnectCta", "Reconnect your mailbox")
            : t("appointmentBook.sender.connectCta", "Connect your mailbox")}
        </Link>
      </div>
    </div>
  );
}
