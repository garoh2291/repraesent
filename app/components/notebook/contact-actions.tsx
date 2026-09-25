import { Mail, MessageCircle, Phone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";
import type { ContactChannel } from "~/lib/api/lead-outcomes";

/** Digits-only international number for wa.me ("+49 170 …" → "49170…"). */
export function whatsappHref(phone: string): string | null {
  let digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  digits = digits.replace(/\D/g, "");
  return digits.length >= 7 ? `https://wa.me/${digits}` : null;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export interface ContactTarget {
  phone?: string | null;
  email?: string | null;
}

/**
 * Call / WhatsApp / Email as big, thumb-sized buttons (NOTEBOOK_UX_PLAN.md §3).
 * Each tap reports the channel first (first-contact telemetry, then the
 * outcome sheet), then lets the browser open the dialer / WhatsApp / mail app.
 */
export function ContactActions({
  target,
  onContact,
  size = "md",
  className,
  showEmpty = false,
  iconOnly = false,
}: {
  target: ContactTarget;
  onContact?: (channel: ContactChannel) => void;
  size?: "sm" | "md";
  className?: string;
  /** Show disabled buttons for missing channels (detail views). */
  showEmpty?: boolean;
  /** Icon-only squares (table rows, kanban cards). */
  iconOnly?: boolean;
}) {
  const { t } = useTranslation();
  const phone = target.phone?.trim() || null;
  const email = target.email?.trim() || null;
  const wa = phone ? whatsappHref(phone) : null;

  const items: {
    channel: ContactChannel;
    href: string | null;
    label: string;
    Icon: typeof Phone;
    external?: boolean;
  }[] = [
    { channel: "call", href: phone ? telHref(phone) : null, label: t("outcome.call", "Call"), Icon: Phone },
    { channel: "whatsapp", href: wa, label: t("outcome.whatsapp", "WhatsApp"), Icon: MessageCircle, external: true },
    { channel: "email", href: email ? `mailto:${email}` : null, label: t("outcome.email", "Email"), Icon: Mail },
  ];

  const visible = showEmpty ? items : items.filter((i) => i.href);
  if (visible.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {visible.map(({ channel, href, label, Icon, external }) =>
        href ? (
          <a
            key={channel}
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            onClick={(e) => {
              e.stopPropagation();
              onContact?.(channel);
            }}
            className={cn(
              "press inline-flex items-center gap-1.5 rounded-lg border border-border bg-card font-medium text-foreground transition-colors hover:border-foreground/30 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20",
              channel === "call" && "border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background",
              iconOnly
                ? "size-8 justify-center p-0"
                : size === "sm"
                  ? "h-8 px-2.5 text-[12.5px]"
                  : "h-10 px-3.5 text-[13.5px]",
            )}
            aria-label={iconOnly ? label : undefined}
            title={iconOnly ? label : undefined}
          >
            <Icon className={size === "sm" || iconOnly ? "size-3.5" : "size-4"} aria-hidden />
            {iconOnly ? null : label}
          </a>
        ) : (
          <span
            key={channel}
            aria-disabled
            className={cn(
              "inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-dashed border-border font-medium text-muted-foreground/60",
              size === "sm" ? "h-8 px-2.5 text-[12.5px]" : "h-10 px-3.5 text-[13.5px]",
            )}
            title={t("outcome.noChannel", "Not on file")}
          >
            <Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden />
            {label}
          </span>
        ),
      )}
    </div>
  );
}
