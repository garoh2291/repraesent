import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation, Trans } from "react-i18next";
import i18n from "~/i18n";
import {
  Mail,
  Copy,
  Check,
  Server,
  KeyRound,
  Smartphone,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import {
  listEmailAccounts,
  decryptEmailAccountPassword,
} from "~/lib/api/workspaces";
import { isSetupMailbox } from "~/lib/api/email-accounts";
import { CopyButton } from "~/components/molecule/copy-button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { cn } from "~/lib/utils";

/**
 * "Set up in your email app" — the server details and password a mailbox we
 * host needs in Outlook, Apple Mail or a phone. Opened per account from
 * Settings → Email accounts; the account lives in `?account=` so the link can
 * be shared and survives a reload. Used to be `/email`, a Customers tab — it is
 * setup, done once, so it sits one layer down (PRODUCT_DIRECTION.md, frequency
 * rule). The heading and the way back come from `settings._layout.tsx`.
 */
export function meta() {
  return [
    { title: `${i18n.t("settings.emailSetup.metaTitle")} - Repraesent` },
    {
      name: "description",
      content: i18n.t("settings.emailSetup.metaDescription"),
    },
  ];
}

const OUTLOOK_STEP_KEYS = [
  "email.steps.outlook.step1",
  "email.steps.outlook.step2",
  "email.steps.outlook.step3",
  "email.steps.outlook.step4",
  "email.steps.outlook.step5",
  "email.steps.outlook.step6",
] as const;

const OUTLOOK_STEP_ALT_KEYS = [
  "email.steps.outlook.step1Alt",
  "email.steps.outlook.step2Alt",
  "email.steps.outlook.step3Alt",
  "email.steps.outlook.step4Alt",
  "email.steps.outlook.step5Alt",
  "email.steps.outlook.step6Alt",
] as const;

const OTHER_STEP_KEYS = [
  "email.steps.other.step1",
  "email.steps.other.step2",
  "email.steps.other.step3",
  "email.steps.other.step4",
  "email.steps.other.step5",
  "email.steps.other.step6",
] as const;

/** Small bordered control; 44 px tall on touch screens. */
const SMALL_CONTROL =
  "press inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-border bg-muted/40 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:min-w-11";

function Row({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 py-3 sm:flex-row sm:items-center sm:gap-4",
        !last && "border-b border-border",
      )}
    >
      <span className="shrink-0 text-xs text-muted-foreground sm:w-40">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
    </div>
  );
}

function ValueRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <Row label={label} last={last}>
      <span className="min-w-0 flex-1 break-all font-mono text-sm text-foreground">
        {value}
      </span>
      <CopyButton value={value} className="pointer-coarse:min-h-11 pointer-coarse:px-3" />
    </Row>
  );
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-start gap-3 border-b border-border bg-muted/20 px-4 py-4 sm:px-6">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/70"
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="px-4 sm:px-6">{children}</div>
    </section>
  );
}

function StepBadge({ number }: { number: number }) {
  return (
    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
      {number}
    </span>
  );
}

function PasswordRow({ accountId }: { accountId: string }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function fetchPassword(): Promise<string | null> {
    if (password) return password;
    try {
      const res = await decryptEmailAccountPassword(accountId);
      setPassword(res.password);
      setFailed(false);
      return res.password;
    } catch {
      setFailed(true);
      return null;
    }
  }

  async function handleToggle() {
    if (revealed) {
      setRevealed(false);
      return;
    }
    setLoading(true);
    const pw = await fetchPassword();
    setLoading(false);
    if (pw) setRevealed(true);
  }

  async function handleCopy() {
    setCopyLoading(true);
    const pw = await fetchPassword();
    setCopyLoading(false);
    if (!pw) return;
    try {
      await navigator.clipboard.writeText(pw);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="border-b border-border">
      <Row label={t("email.passwordLabel")} last>
        <span className="min-w-0 flex-1 break-all font-mono text-sm text-foreground">
          {revealed && password ? password : "••••••••"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          disabled={copyLoading}
          className={cn(SMALL_CONTROL, "px-2.5 py-1 pointer-coarse:px-3")}
        >
          {copyLoading ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : copied ? (
            <Check className="size-3 text-emerald-600" aria-hidden />
          ) : (
            <Copy className="size-3" aria-hidden />
          )}
          {copied ? t("common.copied") : t("common.copy")}
        </button>
        <button
          type="button"
          onClick={handleToggle}
          disabled={loading}
          aria-label={revealed ? t("email.hidePassword") : t("email.showPassword")}
          title={revealed ? t("email.hidePassword") : t("email.showPassword")}
          className={cn(SMALL_CONTROL, "p-1.5")}
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : revealed ? (
            <EyeOff className="size-3.5" aria-hidden />
          ) : (
            <Eye className="size-3.5" aria-hidden />
          )}
        </button>
      </Row>
      {failed ? (
        <p role="alert" className="pb-3 text-xs text-destructive">
          {t("settings.emailSetup.passwordFailed")}
        </p>
      ) : null}
    </div>
  );
}

export default function SettingsEmailSetup() {
  const { t } = useTranslation();
  useDocumentMeta({
    titleKey: "settings.emailSetup.metaTitle",
    descriptionKey: "settings.emailSetup.metaDescription",
    titleSuffix: " - Repraesent",
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedId = searchParams.get("account");

  const { data: allAccounts = [], isPending, isError } = useQuery({
    queryKey: ["workspace-email-accounts"],
    queryFn: listEmailAccounts,
  });

  const accounts = useMemo(
    () => allAccounts.filter(isSetupMailbox),
    [allAccounts],
  );

  // No / unknown / not-hosted id → the default hosted mailbox, else the first.
  // The URL is corrected (replace) so a reload or a shared link shows the same.
  const account =
    accounts.find((a) => a.id === requestedId) ??
    accounts.find((a) => a.is_default) ??
    accounts[0] ??
    null;

  useEffect(() => {
    if (!account || account.id === requestedId) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("account", account.id);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }, [account, requestedId, setSearchParams]);

  function selectAccount(id: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("account", id);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }

  if (isPending) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !account) {
    return (
      <div className="space-y-3 rounded-2xl border border-border bg-card px-5 py-10 text-center">
        <span className="mx-auto inline-flex size-12 items-center justify-center rounded-xl bg-muted">
          <Mail className="h-5 w-5 text-muted-foreground" aria-hidden />
        </span>
        <p className="text-sm font-medium text-foreground">
          {isError
            ? t("settings.emailSetup.loadFailed")
            : t("settings.emailSetup.noMailbox")}
        </p>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          {isError
            ? t("settings.emailSetup.loadFailedDesc")
            : t("settings.emailSetup.noMailboxDesc")}
        </p>
        <Link
          to="/settings/email-accounts"
          className="press mt-2 inline-flex min-h-11 items-center justify-center rounded-lg bg-foreground px-4 text-sm font-medium text-background sm:min-h-10"
        >
          {t("settings.emailSetup.backToAccounts")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* What the email app asks for: the address and its password. */}
      <div className="app-fade-up">
        <SectionCard
          icon={KeyRound}
          title={t("settings.emailSetup.signInTitle")}
          description={t("settings.emailSetup.signInDesc")}
        >
          <Row label={t("email.emailLabel")}>
            {accounts.length > 1 ? (
              <Select value={account.id} onValueChange={selectAccount}>
                <SelectTrigger
                  aria-label={t("settings.emailSetup.pickAddress")}
                  className="w-full min-w-0 max-w-[400px] sm:font-mono"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="break-all sm:font-mono">
                      {a.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="min-w-0 flex-1 break-all font-mono text-sm text-foreground">
                {account.email}
              </span>
            )}
            {/* Icon-only on phones so the whole address fits in the picker. */}
            <CopyButton
              value={account.email}
              iconOnly
              className="size-11 justify-center sm:hidden"
            />
            <CopyButton
              value={account.email}
              className="max-sm:hidden pointer-coarse:min-h-11 pointer-coarse:px-3"
            />
          </Row>
          <PasswordRow key={account.id} accountId={account.id} />
          <p className="py-3 text-xs text-muted-foreground">
            {t("email.credentialNote")}{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono break-all text-foreground">
              {account.imap_username ?? account.email}
            </code>{" "}
            {t("email.credentialNoteSuffix")}
          </p>
        </SectionCard>
      </div>

      {/* Outlook, step by step with screenshots. */}
      <div className="app-fade-up app-fade-up-d1">
        <SectionCard
          icon={Mail}
          title={t("email.outlookTitle")}
          description={t("email.outlookDesc")}
        >
          <ol className="space-y-6 py-4">
            {OUTLOOK_STEP_KEYS.map((key, i) => (
              <li
                key={key}
                className={cn(i > 0 && "border-t border-border pt-6")}
              >
                <div className="flex items-start gap-2.5">
                  <StepBadge number={i + 1} />
                  <div className="min-w-0 flex-1 space-y-3">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      <Trans
                        i18nKey={key}
                        components={{
                          0: <strong className="font-medium text-foreground" />,
                          1: <strong className="font-medium text-foreground" />,
                        }}
                      />
                    </p>
                    <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
                      <img
                        src={`/outlook-step-${i + 1}.png`}
                        alt={t(OUTLOOK_STEP_ALT_KEYS[i])}
                        loading="lazy"
                        className="h-auto w-full object-contain"
                      />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>

      {/* Every other app: the manual route. */}
      <div className="app-fade-up app-fade-up-d2">
        <SectionCard
          icon={Smartphone}
          title={t("email.otherTitle")}
          description={t("settings.emailSetup.otherDesc")}
        >
          <ol className="space-y-3 py-4">
            {OTHER_STEP_KEYS.map((key, i) => (
              <li key={key} className="flex items-start gap-2.5">
                <StepBadge number={i + 1} />
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t(key)}
                </p>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>

      {/* The server details the manual route asks for. */}
      <div className="app-fade-up app-fade-up-d3">
        <SectionCard
          icon={Server}
          title={t("email.serverTitle")}
          description={t("email.serverDesc")}
        >
          <p className="pt-4 pb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("email.incomingLabel")}
          </p>
          <ValueRow label={t("email.serverLabel")} value={String(account.imap_server ?? "")} />
          <ValueRow label={t("email.portSslLabel")} value={String(account.imap_port_ssl ?? 993)} />
          <ValueRow
            label={t("email.portStartLabel")}
            value={String(account.imap_port_starttls ?? 143)}
          />
          <ValueRow
            label={t("email.usernameLabel")}
            value={String(account.imap_username ?? account.email)}
            last
          />

          <p className="border-t border-border pt-5 pb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("email.outgoingLabel")}
          </p>
          <ValueRow label={t("email.serverLabel")} value={String(account.smtp_server ?? "")} />
          <ValueRow
            label={t("email.portStartLabel")}
            value={String(account.smtp_port_starttls ?? 587)}
          />
          <ValueRow label={t("email.portSslLabel")} value={String(account.smtp_port_ssl ?? 465)} />
          <ValueRow
            label={t("email.usernameLabel")}
            value={String(account.smtp_username ?? account.email)}
          />
          <Row label={t("email.authLabel")} last>
            <span className="text-sm text-foreground">
              {account.smtp_auth_required
                ? t("email.authRequired")
                : t("email.authNotRequired")}
            </span>
          </Row>
        </SectionCard>
      </div>
    </div>
  );
}
