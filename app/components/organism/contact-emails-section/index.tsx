import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import {
  Mail,
  ChevronDown,
  AlertTriangle,
  Inbox,
  ArrowRight,
} from "lucide-react";
import { getBccMessages, type BccMessage } from "~/lib/api/bcc-logs";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import TooltipContainer from "~/components/tooltip-container";

/**
 * Renders a name; when a display name hides a real email address, the name is
 * hoverable (dotted underline) and the tooltip reveals + copies the email.
 */
function AddressChip({
  name,
  email,
}: {
  name: string | null;
  email: string | null;
}) {
  const label = (name || email || "—").trim();
  const hasHiddenEmail = !!email && email.toLowerCase() !== label.toLowerCase();

  if (!hasHiddenEmail) {
    return <span>{label}</span>;
  }

  return (
    <TooltipContainer
      tooltipContent={email!}
      copyText={email!}
      side="top"
      delayDuration={150}
    >
      <span className="cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2 hover:decoration-foreground">
        {label}
      </span>
    </TooltipContainer>
  );
}

function formatDate(value: string | null, locale: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initialsOf(name: string | null, fallback: string): string {
  const src = (name ?? "").trim();
  if (!src) return fallback;
  const parts = src.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || fallback;
}

/**
 * Renders an HTML email body in a fully sandboxed iframe: no script execution,
 * no same-origin access, isolated CSS. This is untrusted third-party markup, so
 * the sandbox is the security boundary — never render it inline.
 */
function HtmlEmailPreview({ html }: { html: string }) {
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base target="_blank"><style>
    html,body{margin:0;padding:16px;background:#fff;color:#131515;font-family:Geist,ui-sans-serif,system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.6;-webkit-font-smoothing:antialiased;word-break:break-word}
    *{box-sizing:border-box}
    img{max-width:100%;height:auto}
    table{max-width:100%!important}
    a{color:#5265f3}
    blockquote{margin:0 0 0 12px;padding-left:12px;border-left:2px solid #e2e1dc;color:#6b6866}
  </style></head><body>${html}</body></html>`;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white">
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-3 py-1.5">
        <span className="size-2 rounded-full bg-[#f6564e]/70" />
        <span className="size-2 rounded-full bg-[#f5b83d]/70" />
        <span className="size-2 rounded-full bg-[#4bb861]/70" />
        <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          HTML
        </span>
      </div>
      <iframe
        title="email-body"
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        srcDoc={srcDoc}
        className="h-[440px] w-full bg-white"
        loading="lazy"
      />
    </div>
  );
}

function EmailCard({ message, locale }: { message: BccMessage; locale: string }) {
  const { t } = useTranslation();
  const recipients = message.participants.filter(
    (p) => p.kind === "to" || p.kind === "cc",
  );
  const preview = (message.text_body ?? "").trim().slice(0, 240);
  const when = formatDate(message.sent_at ?? message.ingested_at, locale);
  const fromLabel = message.from_name || message.from_address || "—";

  return (
    <details className="group rounded-xl border border-border bg-card transition-colors open:border-primary/30 open:shadow-[0_12px_30px_-22px_rgba(19,21,21,0.35)]">
      <summary className="flex cursor-pointer list-none items-start gap-3 p-4 hover:bg-muted/30">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
          {initialsOf(message.from_name || message.from_address, "@")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {message.subject || fromLabel}
            </p>
            <time className="shrink-0 font-mono text-[11px] text-muted-foreground">
              {when}
            </time>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            <span className="text-foreground/70">
              <AddressChip
                name={message.from_name}
                email={message.from_address}
              />
            </span>
            {recipients.length > 0 && (
              <>
                <span className="mx-1 text-muted-foreground/60">→</span>
                {recipients.map((p, i) => (
                  <span key={p.id}>
                    {i > 0 && <span className="text-muted-foreground/50">, </span>}
                    <AddressChip name={p.display_name} email={p.email} />
                  </span>
                ))}
              </>
            )}
          </p>
          {message.match_ambiguous && (
            <span
              title={t("leadEmails.ambiguousHint")}
              className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
            >
              <AlertTriangle className="size-3" />
              {t("leadEmails.ambiguous")}
            </span>
          )}
          {preview && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground group-open:hidden">
              {preview}
            </p>
          )}
        </div>
        <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border p-3">
        {message.html_body ? (
          <HtmlEmailPreview html={message.html_body} />
        ) : message.text_body ? (
          <pre className="whitespace-pre-wrap break-words px-1 font-sans text-sm leading-relaxed text-foreground">
            {message.text_body}
          </pre>
        ) : (
          <p className="px-1 text-sm italic text-muted-foreground">—</p>
        )}
      </div>
    </details>
  );
}

export function ContactEmailsSection({ contactId }: { contactId: string }) {
  const { t, i18n } = useTranslation();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["contact-emails", contactId],
    queryFn: () => getBccMessages({ contactId }),
    enabled: !!contactId,
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

  if (messages.length === 0) {
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
        <Button asChild variant="outline" size="sm" className="mt-2 gap-1.5">
          <Link to="/settings/bcc">
            <Mail className="size-3.5" />
            {t("leadEmails.emptyCta")}
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((m) => (
        <EmailCard key={m.id} message={m} locale={i18n.language} />
      ))}
    </div>
  );
}
