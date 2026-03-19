import { useState } from "react";
import { Navigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Mail, Copy, Check, Server, Shield, Smartphone, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import { getServiceConfig, decryptEmailConfigPassword } from "~/lib/api/workspaces";

export function meta() {
  return [
    { title: "Email Setup - Repraesent" },
    { name: "description", content: "Email configuration guide" },
  ];
}

type Lang = "en" | "de";

const labels = {
  en: {
    pageTitle: "Email Setup",
    pageSubtitle: "Step-by-step guide for configuring your email account",
    notConfigured: "Email not configured yet",
    notConfiguredDesc: "Contact your administrator to set up the email configuration.",
    credentialsTitle: "Account Credentials",
    credentialsDesc: "Use these credentials for all email services. The password is the same for all.",
    credentialNote: "The username is always",
    credentialNoteSuffix: "— use it for both incoming and outgoing mail.",
    emailLabel: "Email",
    passwordLabel: "Password",
    serverTitle: "Server Settings",
    serverDesc: "Use these settings in any email client — Thunderbird, Apple Mail, mobile apps, etc.",
    incomingLabel: "Incoming Mail (IMAP)",
    outgoingLabel: "Outgoing Mail (SMTP)",
    serverLabel: "Server",
    portSslLabel: "Port (SSL/TLS)",
    portStartLabel: "Port (STARTTLS)",
    usernameLabel: "Username",
    authLabel: "Authentication",
    authRequired: "Required",
    authNotRequired: "Not required",
    outlookTitle: "Microsoft Outlook",
    outlookDesc: "Setup instructions for new and existing Outlook users — follow the screenshots below",
    otherTitle: "Other Email Clients",
    otherDesc: "Thunderbird, Apple Mail, Android, iPhone — use the manual server settings above",
    steps: {
      outlook: [
        { text: <>Open Microsoft Outlook. On the welcome screen, enter your email address and click <strong className="text-foreground font-medium">Continue</strong>.</>, alt: "Outlook welcome screen — enter email address" },
        { text: <><strong className="text-foreground font-medium">Existing Outlook users:</strong> Go to <strong className="text-foreground font-medium">Settings → Account → Add Account</strong>.</>, alt: "Outlook Settings — Account — Add Account" },
        { text: <>Confirm by clicking <strong className="text-foreground font-medium">Add Account</strong> to proceed.</>, alt: "Outlook — confirm Add Account" },
        { text: <>When asked how to connect, select <strong className="text-foreground font-medium">"Synchronize directly with IMAP"</strong>.</>, alt: "Outlook account type selection — choose IMAP" },
        { text: <>Enter your password. Outlook will automatically populate the IMAP and SMTP server settings.</>, alt: "Outlook IMAP settings auto-filled" },
        { text: <>Click <strong className="text-foreground font-medium">Done</strong> to complete the setup.</>, alt: "Outlook setup complete — click Done" },
      ],
      other: [
        "Open your email client and go to account settings.",
        "Choose to add a new account manually (do not use auto-detect).",
        "Enter your email address and password.",
        "For incoming mail, select IMAP and enter the server details from the table above.",
        "For outgoing mail, enter the SMTP server details with authentication enabled.",
        "Save and test the connection.",
      ],
    },
  },
  de: {
    pageTitle: "E-Mail Einrichtung",
    pageSubtitle: "Schritt-für-Schritt-Anleitung zur Konfiguration Ihres E-Mail-Kontos",
    notConfigured: "E-Mail noch nicht konfiguriert",
    notConfiguredDesc: "Bitte wenden Sie sich an Ihren Administrator, um die E-Mail-Konfiguration einzurichten.",
    credentialsTitle: "Ihre E-Mail-Zugangsdaten",
    credentialsDesc: "Verwenden Sie diese Zugangsdaten für alle E-Mail-Dienste. Das Passwort ist für alle identisch.",
    credentialNote: "Der Benutzername ist immer",
    credentialNoteSuffix: "— verwenden Sie ihn für ein- und ausgehende E-Mails.",
    emailLabel: "E-Mail-Adresse",
    passwordLabel: "Passwort",
    serverTitle: "Servereinstellungen",
    serverDesc: "Verwenden Sie diese Einstellungen in jedem E-Mail-Programm — Thunderbird, Apple Mail, mobile Apps usw.",
    incomingLabel: "Eingangsserver (IMAP)",
    outgoingLabel: "Ausgangsserver (SMTP)",
    serverLabel: "Server",
    portSslLabel: "Port (SSL/TLS)",
    portStartLabel: "Port (STARTTLS)",
    usernameLabel: "Benutzername",
    authLabel: "Authentifizierung",
    authRequired: "Erforderlich",
    authNotRequired: "Nicht erforderlich",
    outlookTitle: "Microsoft Outlook",
    outlookDesc: "Einrichtungsanleitung für neue und bestehende Outlook-Nutzer — folgen Sie den Screenshots unten",
    otherTitle: "Andere E-Mail-Clients",
    otherDesc: "Thunderbird, Apple Mail, Android, iPhone — verwenden Sie die obigen Servereinstellungen",
    steps: {
      outlook: [
        { text: <>Öffnen Sie Microsoft Outlook. Geben Sie Ihre E-Mail-Adresse ein und klicken Sie auf <strong className="text-foreground font-medium">Weiter</strong>.</>, alt: "Outlook Willkommensbildschirm" },
        { text: <><strong className="text-foreground font-medium">Bestehende Nutzer:</strong> Öffnen Sie <strong className="text-foreground font-medium">Einstellungen → Konto → Konto hinzufügen</strong>.</>, alt: "Outlook Einstellungen — Konto hinzufügen" },
        { text: <>Bestätigen Sie durch Klicken auf <strong className="text-foreground font-medium">Konto hinzufügen</strong>.</>, alt: "Outlook — Konto hinzufügen bestätigen" },
        { text: <>Wählen Sie <strong className="text-foreground font-medium">„Direkt mit IMAP synchronisieren"</strong>.</>, alt: "Outlook Kontotyp — IMAP wählen" },
        { text: <>Geben Sie Ihr Passwort ein. Outlook füllt die Servereinstellungen automatisch aus.</>, alt: "Outlook IMAP-Einstellungen automatisch ausgefüllt" },
        { text: <>Klicken Sie auf <strong className="text-foreground font-medium">Fertig</strong>. Ihr Konto ist jetzt aktiv.</>, alt: "Outlook-Einrichtung abgeschlossen" },
      ],
      other: [
        "Öffnen Sie Ihr E-Mail-Programm und gehen Sie zu den Kontoeinstellungen.",
        "Wählen Sie, ein neues Konto manuell hinzuzufügen.",
        "Geben Sie Ihre E-Mail-Adresse und Ihr Passwort ein.",
        "Wählen Sie für eingehende E-Mails IMAP und geben Sie die Serverdaten ein.",
        "Geben Sie für ausgehende E-Mails die SMTP-Serverdaten mit Authentifizierung ein.",
        "Speichern und testen Sie die Verbindung.",
      ],
    },
  },
} as const;

function CopyButton({ value }: { value: string }) {
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
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function CredentialRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground w-32 shrink-0">
        {label}
      </span>
      <span className="flex-1 font-mono text-sm text-foreground break-all">{value}</span>
      <CopyButton value={value} />
    </div>
  );
}

function ServerRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground w-40 shrink-0">{label}</span>
      <span className="flex-1 font-mono text-sm text-foreground">{value}</span>
      <CopyButton value={value} />
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
      <div className="flex items-start gap-3 px-6 py-4 border-b border-border bg-muted/20">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div className="px-6">{children}</div>
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
}: {
  label: string;
  serviceId: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const handleCopy = () => {
    if (!revealedPassword) return;
    navigator.clipboard.writeText(revealedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground w-32 shrink-0">
        {label}
      </span>
      <span className="flex-1 font-mono text-sm text-foreground break-all">
        {revealed && revealedPassword ? revealedPassword : "*******"}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        {revealed && revealedPassword && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        )}
        <button
          onClick={handleToggle}
          disabled={loading}
          className="flex items-center justify-center rounded-md border border-border bg-muted/40 p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
          title={revealed ? "Hide password" : "Show password"}
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
  );
}

export default function Emails() {
  const { currentWorkspace } = useAuthContext();
  const [lang, setLang] = useState<Lang>("en");
  const tx = labels[lang];

  const emailService = currentWorkspace?.services?.find(
    (s) => s.service_type === "email-config",
  );

  const { data: cfg = {} } = useQuery({
    queryKey: ["service-config", emailService?.service_id],
    queryFn: () => getServiceConfig(emailService!.service_id),
    enabled: !!emailService?.service_id,
  });

  if (!emailService) {
    return <Navigate to="/" replace />;
  }

  const isConfigured = !!(cfg.email && cfg.imap_server && cfg.smtp_server);

  return (
    <div className="p-6 app-fade-in">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="app-fade-up flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10">
              <Mail className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                {tx.pageTitle}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">{tx.pageSubtitle}</p>
            </div>
          </div>

          {/* Language toggle */}
          <div className="flex shrink-0 items-center rounded-lg border border-border bg-muted/30 p-0.5">
            <button
              onClick={() => setLang("en")}
              className={[
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150",
                lang === "en"
                  ? "bg-background text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              EN
            </button>
            <button
              onClick={() => setLang("de")}
              className={[
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150",
                lang === "de"
                  ? "bg-background text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              DE
            </button>
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Not configured */}
        {!isConfigured ? (
          <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-muted mx-auto">
              <Mail className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">{tx.notConfigured}</p>
            <p className="text-sm text-muted-foreground">{tx.notConfiguredDesc}</p>
          </div>
        ) : (
          <>
            {/* Account Credentials */}
            <div className="app-fade-up app-fade-up-d1">
              <SectionCard icon={Shield} title={tx.credentialsTitle} description={tx.credentialsDesc}>
                <CredentialRow label={tx.emailLabel} value={String(cfg.email ?? "")} />
                <PasswordRow label={tx.passwordLabel} serviceId={emailService.service_id} />
                <div className="py-3">
                  <p className="text-xs text-muted-foreground">
                    {tx.credentialNote}{" "}
                    <code className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">
                      {String(cfg.email ?? "")}
                    </code>{" "}
                    {tx.credentialNoteSuffix}
                  </p>
                </div>
              </SectionCard>
            </div>

            {/* Server Settings */}
            <div className="app-fade-up app-fade-up-d2">
              <SectionCard icon={Server} title={tx.serverTitle} description={tx.serverDesc}>
                <div className="pt-4 pb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {tx.incomingLabel}
                  </span>
                </div>
                <ServerRow label={tx.serverLabel} value={String(cfg.imap_server ?? "")} />
                <ServerRow label={tx.portSslLabel} value={String(cfg.imap_port_ssl ?? 993)} />
                <ServerRow label={tx.portStartLabel} value={String(cfg.imap_port_starttls ?? 143)} />
                <ServerRow label={tx.usernameLabel} value={String(cfg.imap_username ?? cfg.email ?? "")} />

                <div className="pt-5 pb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {tx.outgoingLabel}
                  </span>
                </div>
                <ServerRow label={tx.serverLabel} value={String(cfg.smtp_server ?? "")} />
                <ServerRow label={tx.portStartLabel} value={String(cfg.smtp_port_starttls ?? 587)} />
                <ServerRow label={tx.portSslLabel} value={String(cfg.smtp_port_ssl ?? 465)} />
                <div className="flex items-center justify-between gap-4 py-3">
                  <span className="text-sm text-muted-foreground w-40 shrink-0">{tx.authLabel}</span>
                  <span className="flex-1 font-mono text-sm text-foreground">
                    {cfg.smtp_auth_required !== false ? tx.authRequired : tx.authNotRequired}
                  </span>
                </div>
              </SectionCard>
            </div>
          </>
        )}

        {/* Outlook Setup */}
        <div className="app-fade-up app-fade-up-d3">
          <SectionCard icon={Mail} title={tx.outlookTitle} description={tx.outlookDesc}>
            <div className="py-4 space-y-6">
              {tx.steps.outlook.map((step, i) => (
                <div key={i}>
                  {i > 0 && <div className="border-t border-border mb-6" />}
                  <div className="flex items-start gap-2.5">
                    <StepBadge number={i + 1} />
                    <div className="space-y-3 flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {step.text}
                      </p>
                      <div className="rounded-xl overflow-hidden border border-border bg-muted/30">
                        <img
                          src={`/outlook-step-${i + 1}.png`}
                          alt={step.alt}
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
          <SectionCard icon={Smartphone} title={tx.otherTitle} description={tx.otherDesc}>
            <div className="py-4 space-y-3">
              {tx.steps.other.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <StepBadge number={i + 1} />
                  <p className="text-sm text-muted-foreground leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
