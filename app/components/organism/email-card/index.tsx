import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { BccMessage } from "~/lib/api/bcc-logs";
import TooltipContainer from "~/components/tooltip-container";

/**
 * Renders a name; when a display name hides a real email address, the name is
 * hoverable (dotted underline) and the tooltip reveals + copies the email.
 */
export function AddressChip({
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

export function formatEmailDate(value: string | null, locale: string): string {
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

export function initialsOf(name: string | null, fallback: string): string {
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
export function HtmlEmailPreview({ html }: { html: string }) {
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

/**
 * Collapsible BCC email card. Reused by the contact detail Emails tab and the
 * workspace Mail page. Pass `actions` to render an always-visible footer (link
 * / connect / create buttons) that sits outside the <summary> so its clicks
 * don't toggle the disclosure.
 */
export function EmailCard({
  message,
  locale,
  actions,
}: {
  message: BccMessage;
  locale: string;
  actions?: ReactNode;
}) {
  const recipients = message.participants.filter(
    (p) => p.kind === "to" || p.kind === "cc",
  );
  const preview = (message.text_body ?? "").trim().slice(0, 240);
  const when = formatEmailDate(message.sent_at ?? message.ingested_at, locale);
  const fromLabel = message.from_name || message.from_address || "—";

  return (
    <div className="rounded-xl border border-border bg-card transition-colors [&:has(details[open])]:border-primary/30 [&:has(details[open])]:shadow-[0_12px_30px_-22px_rgba(19,21,21,0.35)]">
      <details className="group">
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
                      {i > 0 && (
                        <span className="text-muted-foreground/50">, </span>
                      )}
                      <AddressChip name={p.display_name} email={p.email} />
                    </span>
                  ))}
                </>
              )}
            </p>
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
      {actions && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2.5 sm:px-4">
          {actions}
        </div>
      )}
    </div>
  );
}
