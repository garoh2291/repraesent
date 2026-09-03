import { CalendarDays, ExternalLink, Mail, Phone } from "lucide-react";
import type { ActionItem } from "~/lib/api/ai-assistants";

/** CTA chips as the widget shows them, for transcripts and the playground. */
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
        return (
          <a
            key={a.id}
            href={a.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-foreground/20 bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-muted"
          >
            <Icon className="h-3 w-3" aria-hidden />
            {a.label}
          </a>
        );
      })}
    </div>
  );
}
