import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import { cn } from "~/lib/utils";

/**
 * "‹ Back to …" (REDESIGN_PLAN.md §0). On phones it's an iOS-style back
 * control: a chevron and a 44 px row you can hit with a thumb. On larger
 * screens it keeps the small text link the pages had.
 */
export function BackLink({
  to,
  children,
  className,
  onClick,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "press inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
        "max-sm:-ml-1.5 max-sm:min-h-11 max-sm:gap-0.5 max-sm:pr-2 max-sm:text-[15px] max-sm:text-foreground/75",
        className,
      )}
    >
      <ArrowLeft className="h-3.5 w-3.5 max-sm:hidden" aria-hidden />
      <ChevronLeft className="size-5 sm:hidden" aria-hidden />
      <span className="min-w-0 truncate">{children}</span>
    </Link>
  );
}
