import React from "react";
import { cn } from "~/lib/utils";

/**
 * Presentation primitives for the forms builder.
 *
 * These deliberately do NOT live in `components/wordpress/fields.tsx`. That
 * module is imported by 13 ported WordPress settings screens against only 4
 * forms files, so restyling it in place would redesign half the app as a side
 * effect. The builder gets its own chrome; `fields.tsx` keeps supplying the
 * genuinely generic bits (Field, FieldHint, ToggleField, ColorInput).
 *
 * The radius ladder here is the one `home.tsx` already established and the rest
 * of the app follows: 2xl panel -> xl inner tile -> lg control -> full chip.
 */

/** The builder's card surface. One radius, one border, one background. */
export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The single heading system. Before this the builder ran two in parallel —
 * a `text-xs uppercase` micro-label at six sites and CardHeader's
 * `text-sm font-semibold` at nine, side by side in the same grid row on the
 * Design tab. The eyebrow wins because it is what the polished pages
 * (home.tsx, login.tsx) already use.
 */
export function PanelHeader({
  icon,
  title,
  meta,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  /** Small trailing detail next to the title — a locale code, a field key. */
  meta?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[3.25rem] items-center gap-2.5 border-b border-border px-4 py-3 sm:px-5",
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
        >
          {icon}
        </span>
      ) : null}
      <h2 className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      {meta ? <div className="min-w-0 shrink-0">{meta}</div> : null}
      {action ? <div className="ml-auto shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * Panel content. Also the **container-query root** — `Cols` measures this, not
 * the viewport, which is what stops number pairs rendering at 140px inside the
 * 340px inspector column.
 */
export function PanelBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("@container space-y-5 p-4 sm:p-5", className)}>
      {children}
    </div>
  );
}

/**
 * A labelled group inside a PanelBody. Replaces the bare `<div className="border-t" />`
 * idiom the builder used in three places, and gives the inspector's five
 * previously-undifferentiated concerns real boundaries.
 */
export function PanelSection({
  title,
  action,
  children,
  className,
}: {
  /** Omit for an unlabelled group that still gets the dividing rule. */
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "space-y-3 border-t border-border/70 pt-5 first:border-0 first:pt-0",
        className,
      )}
    >
      {title || action ? (
        <div className="flex items-center gap-2">
          {title ? (
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              {title}
            </h3>
          ) : null}
          {action ? <div className="ml-auto shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * Two-up pair. `TwoCol` from fields.tsx breaks at the `sm` *viewport*, so it
 * fired inside the narrow inspector on any wide screen. This breaks on the
 * width of the enclosing PanelBody instead.
 */
export function Cols({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 @sm:grid-cols-2", className)}>
      {children}
    </div>
  );
}

/** Segmented control. One definition; the builder had two drifted copies. */
export function Segmented({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SegmentedButton({
  active,
  onClick,
  children,
  label,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  /** aria-label for icon-only buttons. */
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        "rounded-md px-2 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * The builder's secondary action button. Share used two different treatments
 * for the same "Copy" affordance two cards apart; this is the survivor.
 */
export function GhostAction({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Placeholder for a panel with nothing to show — the inspector, mainly. */
export function EmptyPanelState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <span
        aria-hidden
        className="flex size-11 items-center justify-center rounded-2xl border border-border bg-muted/40 text-muted-foreground"
      >
        {icon}
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {hint ? (
          <p className="mx-auto max-w-[24ch] text-xs leading-relaxed text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
