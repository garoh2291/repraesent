import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "~/lib/utils";

/** A big number with a plain label and an optional change vs. before. */
export function Stat({
  value,
  label,
  delta,
  deltaLabel,
  tone,
  className,
}: {
  value: ReactNode;
  label: ReactNode;
  /** Relative change, e.g. 0.12 = +12%. Null hides it. */
  delta?: number | null;
  deltaLabel?: string;
  tone?: "earned";
  className?: string;
}) {
  const up = delta != null && delta > 0.005;
  const down = delta != null && delta < -0.005;
  return (
    <div className={cn("min-w-0", className)}>
      <p
        className={cn(
          "title-display num truncate text-[30px] font-semibold sm:text-[36px]",
          tone === "earned" ? "text-earned" : "text-foreground",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[13px] text-muted-foreground">{label}</p>
      {delta != null && (up || down) ? (
        <p
          className={cn(
            "mt-1 inline-flex items-center gap-0.5 text-[12px] font-medium",
            up ? "text-earned" : "text-overdue",
          )}
          title={deltaLabel}
        >
          {up ? (
            <ArrowUpRight className="size-3.5" aria-hidden />
          ) : (
            <ArrowDownRight className="size-3.5" aria-hidden />
          )}
          <span className="num">
            {delta >= 2
              ? `×${Math.round((delta + 1) * 10) / 10}`
              : `${Math.round(Math.abs(delta) * 100)}%`}
          </span>
          {deltaLabel ? <span className="font-normal text-muted-foreground">&nbsp;{deltaLabel}</span> : null}
        </p>
      ) : null}
    </div>
  );
}

/** A count that needs the owner, drawn with the marker. */
export function MarkerCount({
  n,
  className,
  dark,
}: {
  n: number;
  className?: string;
  /** On the ink sidebar. */
  dark?: boolean;
}) {
  if (!n) return null;
  return (
    <span
      className={cn(
        "num inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-5",
        dark ? "bg-marker text-[#141516]" : "bg-marker text-foreground",
        className,
      )}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}
