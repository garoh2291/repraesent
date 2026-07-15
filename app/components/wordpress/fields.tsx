import React from "react";
import { Info } from "lucide-react";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

/**
 * Layout primitives shared by every ported WordPress plugin settings screen.
 *
 * These used to live in `re-appointment/fields.tsx`, with re:index, re:maintenance
 * and re:review re-exporting them from that sibling plugin's folder, while
 * re:cookie kept its own drifted copies. They live here now so there is one
 * definition and no plugin owns another plugin's chrome.
 *
 * Where the two copies had diverged, the survivor takes the superset as a prop
 * (`PageShell width`, `CardHeader muted/icon/action`) so each screen keeps the
 * look it already had.
 */

const SHELL_WIDTHS = {
  md: "max-w-[1280px]",
  lg: "max-w-[1400px]",
} as const;

export function PageShell({
  children,
  className,
  id,
  width = "md",
  spaced = true,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  width?: keyof typeof SHELL_WIDTHS;
  /** Vertical rhythm between top-level sections. */
  spaced?: boolean;
}) {
  return (
    <div
      id={id}
      className={cn(
        "mx-auto w-full p-4 py-10! sm:p-6 app-fade-in",
        SHELL_WIDTHS[width],
        spaced && "space-y-6 sm:space-y-8",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-card", className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  icon,
  title,
  subtitle,
  action,
  muted,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Tinted header band. */
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 border-b px-5 py-4 sm:px-6",
        muted && "bg-muted/30",
      )}
    >
      {icon ? (
        <span
          aria-hidden
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-5 p-5 sm:p-6", className)}>{children}</div>;
}

export function Field({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-2", className)}>{children}</div>;
}

export function FieldHint({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>
      {children}
    </p>
  );
}

export function TwoCol({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

export function ToggleField({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  id?: string;
}) {
  const switchId = id ?? `toggle-${label}`;
  return (
    <div className="flex items-center gap-3">
      <Switch id={switchId} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={switchId} className="font-normal">
        {label}
      </Label>
    </div>
  );
}

/**
 * Bare colour picker + hex input. re:cookie uses its own richer, labelled
 * ColorField; this is the unadorned pair used inside the re:appointment editor.
 */
export function ColorInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const swatch = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        id={`${id}-picker`}
        value={swatch}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
      />
      <Input
        type="text"
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-sm"
      />
    </div>
  );
}

const STAT_TONES = {
  neutral: "bg-primary/10 text-primary",
  positive: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  muted: "bg-muted text-muted-foreground",
} as const;

const STAT_SIZES = {
  /** Free-form value (a date, a string). */
  md: "text-lg font-semibold tracking-tight sm:text-xl",
  /** A bare count — aligned columns, so tabular figures. */
  lg: "text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl",
} as const;

export function StatTile({
  icon,
  label,
  value,
  tone = "neutral",
  size = "md",
  loading = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: keyof typeof STAT_TONES;
  size?: keyof typeof STAT_SIZES;
  /** Show a skeleton in place of the value. */
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md",
            STAT_TONES[tone],
          )}
        >
          {icon}
        </span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      {loading ? (
        <div className="mt-3 h-7 w-10 animate-pulse rounded bg-muted" />
      ) : (
        <div className={cn("mt-2", STAT_SIZES[size])}>{value}</div>
      )}
    </div>
  );
}

export function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-xl border border-border bg-muted/40 px-3.5 py-3 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <div className="min-w-0 leading-relaxed">{children}</div>
    </div>
  );
}
