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
 * outcome sheet), then lets the browser open the dialer / WhatsApp / mail app
 * (or, with `emailInApp`, leaves email to our composer).
 */
export function ContactActions({
  target,
  onContact,
  size = "md",
  className,
  showEmpty = false,
  iconOnly = false,
  emailInApp = false,
  even = false,
}: {
  target: ContactTarget;
  onContact?: (channel: ContactChannel) => void;
  size?: "sm" | "md";
  className?: string;
  /** Show disabled buttons for missing channels (detail views). */
  showEmpty?: boolean;
  /** Icon-only squares (table rows, kanban cards). */
  iconOnly?: boolean;
  /**
   * Email opens our own composer through onContact, so the mailto: link must
   * not also fire. It stays an href: middle-click still reaches the mail app.
   */
  emailInApp?: boolean;
  /**
   * Phones only: one even row of equal 44px buttons (the main actions on a
   * detail page). Desktop keeps the wrapping row at the chosen size.
   */
  even?: boolean;
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

  const evenCols = ["", "max-sm:grid-cols-1", "max-sm:grid-cols-2", "max-sm:grid-cols-3"][visible.length];
  const evenItem = even && !iconOnly && "max-sm:h-11 max-sm:min-w-0 max-sm:justify-center max-sm:gap-1.5 max-sm:px-1.5 max-sm:text-[14px] max-sm:[&>svg]:size-4 max-sm:[&>svg]:shrink-0";
  // Small buttons stay small to the eye; on touch they get an invisible 44px
  // hit area (same idea as the small Button sizes).
  const smHit =
    size === "sm" && !iconOnly && !even &&
    "relative pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1.5 pointer-coarse:after:content-['']";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5",
        even && !iconOnly && ["max-sm:grid max-sm:gap-2", evenCols],
        className,
      )}
    >
      {visible.map(({ channel, href, label, Icon, external }) =>
        href ? (
          <a
            key={channel}
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            onClick={(e) => {
              e.stopPropagation();
              if (channel === "email" && emailInApp) e.preventDefault();
              onContact?.(channel);
            }}
            className={cn(
              "press inline-flex items-center gap-1.5 rounded-lg border border-border bg-card font-medium text-foreground transition-colors hover:border-foreground/30 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20",
              channel === "call" && "border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background",
              iconOnly
                ? "size-8 justify-center p-0 max-sm:size-11"
                : size === "sm"
                  ? "h-8 px-2.5 text-[12.5px]"
                  : "h-10 px-3.5 text-[13.5px] max-sm:h-11",
              smHit,
              evenItem,
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
              size === "sm" ? "h-8 px-2.5 text-[12.5px]" : "h-10 px-3.5 text-[13.5px] max-sm:h-11",
              evenItem,
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
