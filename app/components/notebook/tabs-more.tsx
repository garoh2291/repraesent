import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";

export type MoreTab = {
  value: string;
  label: ReactNode;
  /** Problems inside that tab; summed on the trigger so nothing hides. */
  issues?: number;
};

/**
 * The last trigger in a `line` TabsList for the tabs an owner opens rarely.
 * Radix renders TabsContent by value alone, so the tabs behind this menu keep
 * their `?tab=` URLs — only their trigger moves. When one of them is open the
 * trigger takes its name and the active underline.
 */
export function TabsMore({
  tabs,
  value,
  onSelect,
  renderBadge,
}: {
  tabs: MoreTab[];
  value: string;
  onSelect: (value: string) => void;
  renderBadge?: (count: number) => ReactNode;
}) {
  const { t } = useTranslation();
  if (tabs.length === 0) return null;
  const active = tabs.find((tab) => tab.value === value);
  const issues = tabs.reduce((sum, tab) => sum + (tab.issues ?? 0), 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-state={active ? "active" : "inactive"}
        className={cn(
          "relative inline-flex h-[calc(100%-1px)] items-center justify-center gap-1 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-colors hover:text-foreground focus-visible:outline-1 focus-visible:outline-ring",
          "after:absolute after:inset-x-0 after:bottom-[-5px] after:h-0.5 after:bg-foreground after:opacity-0 after:transition-opacity",
          active && "text-foreground after:opacity-100",
        )}
      >
        {active ? active.label : t("guided.more")}
        {renderBadge ? renderBadge(issues) : null}
        <ChevronDown className="size-3.5 opacity-60" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-52">
        {tabs.map((tab) => (
          <DropdownMenuItem
            key={tab.value}
            onSelect={() => onSelect(tab.value)}
            className={cn("min-h-10 justify-between", tab.value === value && "font-semibold")}
          >
            <span>{tab.label}</span>
            {renderBadge ? renderBadge(tab.issues ?? 0) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
