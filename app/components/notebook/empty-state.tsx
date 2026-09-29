import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

/** An empty screen is an invitation to act: what shows up here, and how. */
export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
  compact,
}: {
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2",
        compact ? "px-4 py-5 sm:px-5" : "px-5 py-8 sm:px-6",
        className,
      )}
    >
      {icon ? (
        <div className="mb-1 flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-[18px]">
          {icon}
        </div>
      ) : null}
      <p className="text-[15px] font-semibold text-foreground">{title}</p>
      {body ? (
        <p className="max-w-md text-[13.5px] leading-relaxed text-muted-foreground">{body}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
