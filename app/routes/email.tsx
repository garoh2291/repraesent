import { useState } from "react";
import { Navigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation, Trans } from "react-i18next";
import i18n from "~/i18n";
import {
  Mail,
  Copy,
  Check,
  Server,
  Shield,
  Smartphone,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import {
  getServiceConfig,
  decryptEmailConfigPassword,
} from "~/lib/api/workspaces";
import { EmailTabs } from "~/components/email-tabs";

export function meta() {
  return [
    { title: i18n.t("email.metaTitle") },
    { name: "description", content: i18n.t("email.metaDescription") },
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

function CopyButton({
  value,
  t,
}: {
  value: string;
  t: (key: string) => string;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
      {copied ? t("common.copied") : t("common.copy")}
    </button>
  );
}

function CredentialRow({
  label,
  value,
  t,
}: {
  label: string;
  value: string;
  t: (key: string) => string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 py-3 border-b border-border last:border-0">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground sm:w-32 shrink-0">
        {label}
      </span>
      <span className="flex-1 font-mono text-sm text-foreground break-all min-w-0">
        {value}
      </span>
      <CopyButton value={value} t={t} />
    </div>
  );
}

function ServerRow({
  label,
  value,
  t,
}: {
  label: string;
  value: string;
  t: (key: string) => string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 py-3 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground sm:w-40 shrink-0">
        {label}
      </span>
      <span className="flex-1 font-mono text-sm text-foreground break-all min-w-0">
        {value}
      </span>
      <CopyButton value={value} t={t} />
    </div>
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
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-start gap-3 px-4 sm:px-6 py-4 border-b border-border bg-muted/20">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="px-4 sm:px-6">{children}</div>
    </div>
  );
}

function StepBadge({ number }: { number: number }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-[10px] font-bold text-amber-400 mt-0.5">
      {number}
    </span>
  );
}

function PasswordRow({
  label,
  serviceId,
  t,
}: {
  label: string;
  serviceId: string;
  t: (key: string) => string;
}) {
  const [revealed, setRevealed] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedSilently, setCopiedSilently] = useState(false);

  const handleToggle = async () => {
    if (revealed) {
      setRevealed(false);
      setRevealedPassword(null);
      return;
    }
    setLoading(true);
    try {
      const { password } = await decryptEmailConfigPassword(serviceId);
      setRevealedPassword(password);
      setRevealed(true);
    } catch {
      // silently ignore — user can retry
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (revealedPassword) {
      // Password already decrypted — copy directly
      navigator.clipboard.writeText(revealedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      // Silently decrypt and copy without revealing
      setCopyLoading(true);
      try {
        const { password } = await decryptEmailConfigPassword(serviceId);
        navigator.clipboard.writeText(password);
        setCopiedSilently(true);
        setTimeout(() => setCopiedSilently(false), 3000);
      } catch {
        // silently ignore
      } finally {
        setCopyLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-1.5 py-3 border-b border-border last:border-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground sm:w-32 shrink-0">
          {label}
        </span>
        <span className="flex-1 font-mono text-sm text-foreground break-all min-w-0">
          {revealed && revealedPassword ? revealedPassword : "*******"}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleCopy}
            disabled={copyLoading}
            className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
          >
            {copyLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : copied || copiedSilently ? (
              <Check className="h-3 w-3 text-emerald-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copied || copiedSilently ? t("common.copied") : t("common.copy")}
          </button>
          <button
            onClick={handleToggle}
            disabled={loading}
            className="flex items-center justify-center rounded-md border border-border bg-muted/40 p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
            title={revealed ? t("email.hidePassword") : t("email.showPassword")}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : revealed ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
      {copiedSilently && (
        <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <Check className="h-3 w-3 shrink-0" />
          {t("email.passwordCopied")}
        </div>
      )}
    </div>
  );
}

export default function Emails() {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();

  const emailService = currentWorkspace?.services?.find(
    (s) => s.service_type === "email-config"
  );

  const { data: cfg = {}, isPending } = useQuery({
    queryKey: ["service-config", emailService?.service_id],
    queryFn: () => getServiceConfig(emailService!.service_id),
    enabled: !!emailService?.service_id,
  });

  if (!emailService) {
    return <Navigate to="/" replace />;
  }

  const isConfigured = !!(cfg.email && cfg.imap_server && cfg.smtp_server);

  return (
    <div className="mx-auto w-full max-w-[1280px] p-4 sm:p-6 py-10! space-y-6 sm:space-y-8 app-fade-in">
      <div className="mx-auto w-full space-y-6">
        {/* Header */}
        <div className="app-fade-up flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10">
              <Mail className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                {t("email.pageTitle")}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t("email.pageSubtitle")}
              </p>
            </div>
          </div>
        </div>

        <EmailTabs />

        {/* Not configured */}
        {!isConfigured && !isPending ? (
          <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-muted mx-auto">
              <Mail className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {t("email.notConfigured")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("email.notConfiguredDesc")}
            </p>
          </div>
        ) : (
          <>
            {/* Account Credentials */}
            <div className="app-fade-up app-fade-up-d1">
              <SectionCard
                icon={Shield}
                title={t("email.credentialsTitle")}
                description={t("email.credentialsDesc")}
              >
                <CredentialRow
                  label={t("email.emailLabel")}
                  value={String(cfg.email ?? "")}
                  t={t}
                />
                <PasswordRow
                  label={t("email.passwordLabel")}
                  serviceId={emailService.service_id}
                  t={t}
                />
                <div className="py-3">
                  <p className="text-xs text-muted-foreground">
                    {t("email.credentialNote")}{" "}
                    <code className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">
                      {String(cfg.email ?? "")}
                    </code>{" "}
                    {t("email.credentialNoteSuffix")}
                  </p>
                </div>
              </SectionCard>
            </div>
          </>
        )}

        {/* Outlook Setup */}
        <div className="app-fade-up app-fade-up-d3">
          <SectionCard
            icon={Mail}
            title={t("email.outlookTitle")}
            description={t("email.outlookDesc")}
          >
            <div className="py-4 space-y-6">
              {OUTLOOK_STEP_KEYS.map((key, i) => (
                <div key={i}>
                  {i > 0 && <div className="border-t border-border mb-6" />}
                  <div className="flex items-start gap-2.5">
                    <StepBadge number={i + 1} />
                    <div className="space-y-3 flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        <Trans
                          i18nKey={key}
                          components={{
                            0: (
                              <strong className="text-foreground font-medium" />
                            ),
                            1: (
                              <strong className="text-foreground font-medium" />
                            ),
                          }}
                        />
                      </p>
                      <div className="rounded-xl overflow-hidden border border-border bg-muted/30">
                        <img
                          src={`/outlook-step-${i + 1}.png`}
                          alt={t(OUTLOOK_STEP_ALT_KEYS[i])}
                          className="w-full h-auto object-contain"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Other Clients */}
        <div className="app-fade-up app-fade-up-d3">
          <SectionCard
            icon={Smartphone}
            title={t("email.otherTitle")}
            description={t("email.otherDesc")}
          >
            <div className="py-4 space-y-3">
              {OTHER_STEP_KEYS.map((key, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <StepBadge number={i + 1} />
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t(key)}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
        {/* Server Settings */}
        <div className="app-fade-up app-fade-up-d2">
          <SectionCard
            icon={Server}
            title={t("email.serverTitle")}
            description={t("email.serverDesc")}
          >
            <div className="pt-4 pb-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {t("email.incomingLabel")}
              </span>
            </div>
            <ServerRow
              label={t("email.serverLabel")}
              value={String(cfg.imap_server ?? "")}
              t={t}
            />
            <ServerRow
              label={t("email.portSslLabel")}
              value={String(cfg.imap_port_ssl ?? 993)}
              t={t}
            />
            <ServerRow
              label={t("email.portStartLabel")}
              value={String(cfg.imap_port_starttls ?? 143)}
              t={t}
            />
            <ServerRow
              label={t("email.usernameLabel")}
              value={String(cfg.imap_username ?? cfg.email ?? "")}
              t={t}
            />

            <div className="pt-5 pb-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {t("email.outgoingLabel")}
              </span>
            </div>
            <ServerRow
              label={t("email.serverLabel")}
              value={String(cfg.smtp_server ?? "")}
              t={t}
            />
            <ServerRow
              label={t("email.portStartLabel")}
              value={String(cfg.smtp_port_starttls ?? 587)}
              t={t}
            />
            <ServerRow
              label={t("email.portSslLabel")}
              value={String(cfg.smtp_port_ssl ?? 465)}
              t={t}
            />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 py-3">
              <span className="text-sm text-muted-foreground sm:w-40 shrink-0">
                {t("email.authLabel")}
              </span>
              <span className="flex-1 font-mono text-sm text-foreground">
                {cfg.smtp_auth_required !== false
                  ? t("email.authRequired")
                  : t("email.authNotRequired")}
              </span>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
