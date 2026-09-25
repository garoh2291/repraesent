import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

/**
 * The one page header (NOTEBOOK_UX_PLAN.md §1): display-face title, an
 * optional plain-language line under it, actions on the right. Replaces the
 * dozen hand-rolled h1 variants.
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  className,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow ? (
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="title-display text-[26px] font-semibold text-foreground sm:text-[32px]">
          {title}
        </h1>
        {subtitle ? (
          <p className="max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
        {children}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

/** Standard page container: same width and gutters everywhere. */
export function PageContainer({
  className,
  children,
  wide,
}: {
  className?: string;
  children: ReactNode;
  /** Kanbans and calendars use the full width. */
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-5 sm:px-6 sm:py-7",
        wide ? "max-w-none" : "max-w-[1200px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
