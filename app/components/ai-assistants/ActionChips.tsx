import { CalendarDays, ExternalLink, Mail, Phone } from "lucide-react";
import type { ActionItem } from "~/lib/api/ai-assistants";

const CHIP_CLASS =
  "inline-flex items-center gap-1 rounded-full border border-foreground/20 bg-background px-2.5 py-1 text-[11px] font-medium";

/**
 * CTA chips as the widget shows them, for transcripts and the playground.
 *
 * A `book` chip has no href — the widget draws a slot picker inside the chat
 * instead — so here it renders as a static chip rather than a dead link.
 */
export function ActionChips({ items }: { items: ActionItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex max-w-[85%] flex-wrap gap-1.5">
      {items.map((a) => {
        const Icon =
          a.type === "book"
            ? CalendarDays
            : a.type === "call"
              ? Phone
              : a.type === "email"
                ? Mail
                : ExternalLink;
        if (!a.href || a.mode === "inline_booking") {
          return (
            <span key={a.id} className={`${CHIP_CLASS} text-muted-foreground`}>
              <Icon className="h-3 w-3" aria-hidden />
              {a.label}
            </span>
          );
        }
        return (
          <a
            key={a.id}
            href={a.href}
            target="_blank"
            rel="noreferrer"
            className={`${CHIP_CLASS} hover:bg-muted`}
          >
            <Icon className="h-3 w-3" aria-hidden />
            {a.label}
          </a>
        );
      })}
    </div>
  );
}
