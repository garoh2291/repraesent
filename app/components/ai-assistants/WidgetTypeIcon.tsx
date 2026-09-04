import { Globe, LayoutTemplate, MessageCircle, Search } from "lucide-react";
import type { WidgetType } from "~/lib/api/ai-assistants";

/** One icon per widget type — index badge, publish cards, wizard. */
export function WidgetTypeIcon({
  type,
  className = "h-3 w-3",
}: {
  type: WidgetType;
  className?: string;
}) {
  const Icon =
    type === "bubble"
      ? MessageCircle
      : type === "section"
        ? LayoutTemplate
        : type === "page"
          ? Globe
          : Search;
  return <Icon className={className} aria-hidden />;
}
