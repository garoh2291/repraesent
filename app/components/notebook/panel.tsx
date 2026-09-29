import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

/** The card surface. One radius, one border, one shadow. */
export function Panel({
  className,
  children,
  as: As = "section",
  ...rest
}: {
  className?: string;
  children: ReactNode;
  as?: "section" | "div" | "article";
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <As
      className={cn("rounded-xl border border-border bg-card shadow-xs", className)}
      {...rest}
    >
      {children}
    </As>
  );
}

/** A panel's heading row: title, optional count, optional action. */
export function PanelHeader({
  title,
  count,
  marker,
  action,
  hint,
  className,
}: {
  title: ReactNode;
  count?: number | null;
  /** Highlight the count — it needs the owner. */
  marker?: boolean;
  action?: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5",
        className,
      )}
    >
      <div className="flex min-w-0 items-baseline gap-2">
        <h2 className="truncate text-[15px] font-semibold text-foreground">{title}</h2>
        {count != null ? (
          <span
            className={cn(
              "num text-[13px] font-semibold",
              marker && count > 0 ? "marker text-foreground" : "text-muted-foreground",
            )}
          >
            {count}
          </span>
        ) : null}
        {hint ? (
          <span className="hidden truncate text-[12px] text-muted-foreground sm:inline">
            {hint}
          </span>
        ) : null}
      </div>
      {action}
    </div>
  );
}
