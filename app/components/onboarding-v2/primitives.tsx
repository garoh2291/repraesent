"use client";

import { forwardRef, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check, ChevronDown, Globe, Loader2, MapPin, Plus, X } from "lucide-react";
import { cn } from "~/lib/utils";
import type { FieldSource } from "~/lib/api/onboarding-v2";

/**
 * Building blocks for the onboarding wizard. Light, warm, calm: one question
 * per screen, big type, press feedback on pointer-down, keyboard-complete.
 * Motion lives in the shell; these stay still.
 *
 * Colour: ink (`foreground`) for selection and focus, yellow (`secondary`)
 * for "found"/"free" highlights. No blue (`primary`) anywhere in the flow.
 * Controls: every input, select and combobox is one 40 px control
 * (`controlCls`), like Linear — never size a field by hand.
 */

// ── heading ──────────────────────────────────────────────────────────────────

export function StepHeading({
  title,
  sub,
  eyebrow,
}: {
  title: string;
  sub?: React.ReactNode;
  eyebrow?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    // Screen readers and keyboard users land on the new question.
    ref.current?.focus({ preventScroll: true });
  }, [title]);
  return (
    <header className="mb-6 space-y-3 sm:mb-8">
      {eyebrow ? (
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/55">
          <span aria-hidden className="size-1.5 rounded-[2px] bg-secondary ring-1 ring-foreground/15" />
          {eyebrow}
        </p>
      ) : null}
      <h1
        ref={ref}
        tabIndex={-1}
        className="ob2-heading max-w-[24ch] text-balance text-[1.75rem] leading-[1.12] tracking-[-0.02em] text-foreground outline-none sm:text-[2.5rem] sm:leading-[1.1]"
      >
        {title}
      </h1>
      {sub ? <div className="max-w-prose text-[15px] leading-relaxed text-muted-foreground">{sub}</div> : null}
    </header>
  );
}

/**
 * Results that arrive below the fold (Google/Facebook matches on a phone) scroll into view
 * once, when they appear. Pair with `scroll-mb-32` so the sticky action bar doesn't cover them.
 */
export function useRevealWhen<T extends HTMLElement>(ready: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!ready || !ref.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  }, [ready]);
  return ref;
}

// ── choice cards ─────────────────────────────────────────────────────────────

export function ChoiceCard({
  selected,
  onSelect,
  title,
  description,
  icon,
  badge,
  role = "radio",
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: string;
  role?: "radio" | "checkbox";
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "group relative flex min-h-14 w-full gap-3 rounded-2xl border bg-card p-4 text-left",
        // Title-only cards centre on the icon; cards with a description align to the top.
        description ? "items-start" : "items-center",
        "transition-[transform,border-color,box-shadow,background-color] duration-150 ease-out active:scale-[0.985]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        selected
          ? role === "checkbox"
            ? // Multi-select lists often start mostly checked; keep them calm.
              "border-foreground/35 bg-foreground/[0.02]"
            : "border-foreground bg-foreground/[0.025] shadow-[0_0_0_1px_var(--foreground)]"
          : "border-border hover:border-foreground/25",
      )}
    >
      {icon ? (
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors",
            description && "mt-0.5",
            selected ? "bg-foreground text-background" : "bg-muted text-foreground/70",
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
          {title}
          {badge ? (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
              {badge}
            </span>
          ) : null}
        </span>
        {description ? <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{description}</span> : null}
      </span>
      <span
        aria-hidden
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border transition-[background-color,border-color] duration-150",
          description && "mt-1",
          role === "checkbox" && "rounded-md",
          selected ? "border-foreground bg-foreground text-background" : "border-border bg-background",
        )}
      >
        {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </span>
    </button>
  );
}

export function ChoiceGroup({
  label,
  children,
  columns = 1,
  multi = false,
}: {
  label: string;
  children: React.ReactNode;
  columns?: 1 | 2 | 3;
  multi?: boolean;
}) {
  return (
    <div
      role={multi ? "group" : "radiogroup"}
      aria-label={label}
      className={cn("grid gap-2.5", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3")}
    >
      {children}
    </div>
  );
}

// ── chips ────────────────────────────────────────────────────────────────────

export function ChipToggle({
  selected,
  onToggle,
  children,
}: {
  selected: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium",
        "transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25",
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground hover:border-foreground/30",
      )}
    >
      {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
      {children}
    </button>
  );
}

/**
 * One question, one tap: a labelled row of radio chips. "unknown" renders as a
 * quieter dashed chip — an honest "I don't know" is always a valid answer.
 * Tapping the selected chip again clears it.
 */
export function ChipQuestion<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T | null | undefined;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T | null) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-2.5">
      <div>
        <p id={id} className="text-[15px] font-medium text-foreground">
          {label}
        </p>
        {hint ? <p className="mt-0.5 text-[13px] text-muted-foreground">{hint}</p> : null}
      </div>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-2">
        {options.map((o) => {
          const selected = value === o.value;
          const unknown = o.value === "unknown";
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(selected ? null : o.value)}
              className={cn(
                "inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium",
                "transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.97]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25",
                selected
                  ? "border-foreground bg-foreground text-background"
                  : unknown
                    ? "border-dashed border-border bg-transparent text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    : "border-border bg-card text-foreground hover:border-foreground/30",
              )}
            >
              {selected ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : null}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T | null | undefined;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex w-full flex-wrap gap-1 rounded-2xl border border-border bg-card p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-9 flex-1 whitespace-nowrap rounded-xl px-3.5 text-sm font-medium transition-colors duration-150 active:scale-[0.97]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25",
            value === o.value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── source chip ──────────────────────────────────────────────────────────────

export function SourceChip({ source }: { source?: FieldSource | null }) {
  const { t } = useTranslation();
  if (!source || source.confirmed || source.source === "user" || source.source === "system") return null;
  const Icon = source.source === "google" ? MapPin : Globe;
  const label = t(`onb.source.${source.source}`);
  const content = (
    <>
      <Icon className="size-3 shrink-0" aria-hidden />
      {/* Icon-only when the field is narrow (half-width columns); the label stays for screen readers. */}
      <span className="sr-only @[22rem]:not-sr-only">{label}</span>
    </>
  );
  const cls =
    "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-secondary/60 px-2 py-1 text-[11px] font-medium text-secondary-foreground @[22rem]:py-0.5";
  return source.url ? (
    <a href={source.url} target="_blank" rel="noreferrer" className={cn(cls, "hover:underline")} title={`${label}: ${source.url}`}>
      {content}
    </a>
  ) : (
    <span className={cls} title={label}>{content}</span>
  );
}

// ── field ────────────────────────────────────────────────────────────────────

export function Field({
  label,
  hint,
  error,
  source,
  optional,
  className,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string | null;
  source?: FieldSource | null;
  optional?: boolean;
  className?: string;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => React.ReactNode;
}) {
  const { t } = useTranslation();
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("@container space-y-1.5", className)}>
      {/* Fixed-height label row: side-by-side fields keep their inputs on one line
          whether or not a label carries "optional" or a source chip. */}
      <div className="flex h-5 items-center justify-between gap-2">
        <label htmlFor={id} className="truncate text-[13px] font-medium text-foreground">
          {label}
          {optional ? <span className="ml-1.5 font-normal text-muted-foreground">{t("onb.optional")}</span> : null}
        </label>
        <SourceChip source={source} />
      </div>
      {children({ id, describedBy, invalid: !!error })}
      {error ? (
        <p id={errId} className="text-[13px] font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[13px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The one control style (Linear-like): 40 px, 8 px radius, hairline border,
 * ink focus ring. 16 px text on phones (no iOS focus zoom), 14 px from sm.
 */
export const controlCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-base text-foreground outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/70 hover:border-foreground/25 focus:border-foreground/45 focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--foreground)_10%,transparent)] aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--destructive)_15%,transparent)] disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm";

/** shadcn Switch in ink (its default checked colour is the blue `primary`). */
export const inkSwitchCls = "data-[state=checked]:bg-foreground focus-visible:ring-foreground/20 focus-visible:border-foreground/40";

/** @deprecated name kept for existing imports — same as `controlCls`. */
export const inputCls = controlCls;

/** Same control as TextInput (the name step used to be taller; heights are uniform now). */
export const BigInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function BigInput({ className, ...props }, ref) {
    return <input ref={ref} {...props} className={cn(controlCls, className)} />;
  },
);

export const TextInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className, ...props }, ref) {
    return <input ref={ref} {...props} className={cn(controlCls, className)} />;
  },
);

export const TextArea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, ...props }, ref) {
    return <textarea ref={ref} {...props} className={cn(controlCls, "h-auto min-h-24 resize-y py-2.5 leading-relaxed", className)} />;
  },
);

/**
 * Native select dressed as the control: no OS arrow, a chevron 12 px from the
 * right edge, vertically centred. Keeps native keyboard + mobile pickers.
 */
export const SelectInput = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { wrapperClassName?: string }>(
  function SelectInput({ className, wrapperClassName, children, ...props }, ref) {
    return (
      <div className={cn("relative", wrapperClassName)}>
        <select
          ref={ref}
          {...props}
          className={cn(controlCls, "cursor-pointer appearance-none pr-9 [&:invalid]:text-muted-foreground/70", className)}
        >
          {children}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    );
  },
);

// ── tags ─────────────────────────────────────────────────────────────────────

export function TagInput({
  id,
  value,
  onChange,
  placeholder,
  suggestions = [],
  max = 30,
  describedBy,
}: {
  id?: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  max?: number;
  describedBy?: string;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const parts = raw.split(/[,;\n]/).map((p) => p.trim()).filter(Boolean);
    const next = [...value];
    for (const p of parts) if (!next.some((v) => v.toLowerCase() === p.toLowerCase()) && next.length < max) next.push(p);
    onChange(next);
    setText("");
  };
  const unused = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));
  return (
    <div className="space-y-2">
      <div className={cn(controlCls, "flex h-auto min-h-10 flex-wrap items-center gap-1 px-1.5 py-1 focus-within:border-foreground/45 focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--foreground)_10%,transparent)]")}>
        {value.map((v) => (
          <span key={v} className="inline-flex h-7 items-center gap-1 rounded-md bg-muted pl-2 pr-0.5 text-sm text-foreground">
            {v}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== v))}
              className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
              aria-label={t("onb.remove", { item: v })}
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={text}
          aria-describedby={describedBy}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === ",") && text.trim()) {
              e.preventDefault();
              add(text);
            } else if (e.key === "Backspace" && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => text.trim() && add(text)}
          placeholder={value.length ? "" : placeholder}
          className="h-7 min-w-[8rem] flex-1 bg-transparent px-1.5 text-base outline-none placeholder:text-muted-foreground/70 sm:text-sm"
        />
      </div>
      {unused.length ? (
        <div className="flex flex-wrap gap-1.5">
          {unused.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <Plus className="size-3" /> {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── action bar ───────────────────────────────────────────────────────────────

export function ActionBar({
  onBack,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  busy,
  secondary,
  primaryType = "submit",
}: {
  onBack?: () => void;
  primaryLabel: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  busy?: boolean;
  secondary?: React.ReactNode;
  primaryType?: "submit" | "button";
}) {
  const { t } = useTranslation();
  return (
    <div className="sticky bottom-0 z-10 -mx-5 mt-10 border-t border-border/70 bg-background/85 px-5 py-4 backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
      {/* Phones: Back + a full-width primary on one row, the skip/secondary action on its own row below.
          From sm: Back on the left, secondary + primary on the right. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:flex-nowrap">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 sm:h-10 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 active:scale-[0.97]"
          >
            <ArrowLeft className="size-4" />
            <span>{t("onb.back")}</span>
          </button>
        ) : null}
        {secondary ? (
          <div className="order-last flex w-full justify-center sm:order-none sm:ml-auto sm:w-auto">{secondary}</div>
        ) : null}
        <button
          type={primaryType}
          onClick={onPrimary}
          disabled={primaryDisabled || busy}
          aria-busy={busy || undefined}
          className={cn(
            "inline-flex h-11 min-w-[9rem] flex-1 items-center justify-center gap-2 rounded-lg bg-foreground px-5 text-sm sm:h-10 font-semibold text-background shadow-sm transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:flex-none",
            !secondary && "sm:ml-auto",
          )}
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}

export function SkipLink({ onClick, label }: { onClick: () => void; label?: string }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-11 whitespace-nowrap rounded-lg px-2 text-sm sm:h-10 font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25"
    >
      {label ?? t("onb.skip")}
    </button>
  );
}

/** Errors that belong to no single field (network, server). */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="mt-6 rounded-xl border border-destructive/25 bg-destructive/[0.06] px-4 py-3 text-sm font-medium text-destructive">
      {message}
    </div>
  );
}

/** A soft card grouping related fields on the review step. */
export function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
        {aside}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
