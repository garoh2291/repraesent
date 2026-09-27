import { useId, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "~/lib/utils";
import { SPRING } from "~/lib/motion";

/**
 * The one segmented control (REDESIGN_PLAN.md §0): an ink pill that slides
 * to the chosen option. 44 px tall on phones; on larger screens the same
 * compact size the hand-rolled toggles had.
 *
 * `stretch` makes the options share the full width on phones.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  stretch = false,
  role = "radiogroup",
  className,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  onChange: (value: T) => void;
  /** Accessible name of the group. */
  label: string;
  stretch?: boolean;
  /** "tablist" when the options switch what the page shows below. */
  role?: "radiogroup" | "tablist";
  className?: string;
}) {
  const id = useId();
  const reduce = useReducedMotion();
  const itemRole = role === "tablist" ? "tab" : "radio";
  return (
    <div
      role={role}
      aria-label={label}
      className={cn(
        "inline-flex rounded-xl border border-border bg-card p-0.5 sm:rounded-lg",
        stretch && "max-sm:flex max-sm:w-full",
        className,
      )}
    >
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role={itemRole}
            aria-checked={itemRole === "radio" ? on : undefined}
            aria-selected={itemRole === "tab" ? on : undefined}
            onClick={() => onChange(o.value)}
            className={cn(
              "press num relative whitespace-nowrap rounded-[10px] px-3.5 text-[14px] font-medium transition-colors max-sm:min-h-10 sm:rounded-md sm:px-3 sm:py-1.5 sm:text-[12.5px]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25",
              stretch && "max-sm:flex-1",
              on ? "text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {on ? (
              <motion.span
                layoutId={`seg-${id}`}
                transition={reduce ? { duration: 0 } : SPRING}
                className="absolute inset-0 rounded-[inherit] bg-foreground"
                aria-hidden
              />
            ) : null}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
