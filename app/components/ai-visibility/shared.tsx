import type { ReactNode } from "react";
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import { cn } from "~/lib/utils";
import { getIntlLocale } from "~/lib/utils/format";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { AI_ENGINES, type AiEngine, type DomainType, type Filters, type Period, type PromptIntent } from "~/lib/api/ai-visibility";

/* ------------------------------------------------------------------ engines */

/**
 * Each engine gets a mark, not a logo: the product speaks about "the AI
 * assistants your customers use", and trademark logos would imply an
 * endorsement. The colour is only ever a small dot.
 */
export const ENGINE_META: Record<AiEngine, { label: string; color: string }> = {
  chatgpt: { label: "ChatGPT", color: "#10a37f" },
  perplexity: { label: "Perplexity", color: "#1f8a9e" },
  gemini: { label: "Gemini", color: "#4f6bed" },
  claude: { label: "Claude", color: "#c96442" },
  grok: { label: "Grok", color: "#141516" },
};

export function EngineMark({ engine, className, showLabel = true }: { engine: string; className?: string; showLabel?: boolean }) {
  const meta = ENGINE_META[engine as AiEngine] ?? { label: engine, color: "#8a8a8a" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
      {showLabel ? meta.label : <span className="sr-only">{meta.label}</span>}
    </span>
  );
}

/* --------------------------------------------------------------- formatting */

export function pct(v: number | null | undefined, digits = 0): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat(getIntlLocale(), { style: "percent", maximumFractionDigits: digits }).format(v);
}

export function rank(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `#${new Intl.NumberFormat(getIntlLocale(), { maximumFractionDigits: 1 }).format(v)}`;
}

export function eur(cents: number | null | undefined, opts: { precise?: boolean; digits?: number } = {}): string {
  if (cents == null || !Number.isFinite(cents)) return "—";
  const digits = opts.digits ?? (opts.precise || cents < 1000 ? 2 : 0);
  return new Intl.NumberFormat(getIntlLocale(), {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
    minimumFractionDigits: opts.precise || opts.digits ? digits : 0,
  }).format(cents / 100);
}

/** micro-USD → euro cents (USD_PER_EUR = 1.08, same constant as the API). */
export function microUsdToEurCents(micro: number): number {
  return (micro / 1_000_000 / 1.08) * 100;
}

export function num(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat(getIntlLocale()).format(v);
}

export function shortDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return new Intl.DateTimeFormat(getIntlLocale(), { day: "numeric", month: "short" }).format(d);
}

/* ----------------------------------------------------------------- filters */

export const PERIODS: Period[] = ["7d", "30d", "90d"];

/** Filters live in the URL so a view can be shared and survives reloads. */
export function useFilters(): [Filters, (patch: Partial<Filters>) => void] {
  const [params, setParams] = useSearchParams();
  const filters = useMemo<Filters>(() => {
    const p = params.get("period");
    const e = params.get("engine");
    return {
      period: (PERIODS as string[]).includes(p ?? "") ? (p as Period) : "7d",
      engine: (AI_ENGINES as readonly string[]).includes(e ?? "") ? (e as AiEngine) : null,
      topic_id: params.get("topic") || null,
    };
  }, [params]);
  const set = (patch: Partial<Filters>) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const apply = (k: string, v: string | null | undefined, dflt?: string) => {
          if (!v || v === dflt) next.delete(k);
          else next.set(k, v);
        };
        if ("period" in patch) apply("period", patch.period, "7d");
        if ("engine" in patch) apply("engine", patch.engine ?? null);
        if ("topic_id" in patch) apply("topic", patch.topic_id ?? null);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  };
  return [filters, set];
}

/** The segmented control used for periods and small choices. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: Array<{ value: T; label: ReactNode }>;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-lg border border-border bg-card p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "num whitespace-nowrap rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25",
            value === o.value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ deltas */

/** Change in percentage POINTS (for rates) or plain units. Lower-is-better flips the colour. */
export function Delta({
  cur,
  prev,
  kind,
  lowerIsBetter,
  className,
}: {
  cur: number | null | undefined;
  prev: number | null | undefined;
  kind: "pp" | "units";
  lowerIsBetter?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  if (cur == null || prev == null) return null;
  const diff = cur - prev;
  const shown = kind === "pp" ? Math.round(diff * 100) : Math.round(diff * 10) / 10;
  if (shown === 0) return null;
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  const Icon = diff > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn("num inline-flex items-center gap-0.5 text-[12px] font-medium", good ? "text-earned" : "text-overdue", className)}
      title={t("aiVisibility.common.vsPrevious", "vs. the period before")}
    >
      <Icon className="size-3.5" aria-hidden />
      {Math.abs(shown)}
      {kind === "pp" ? t("aiVisibility.common.pp", " pts") : ""}
    </span>
  );
}

/* ---------------------------------------------------------------- explainer */

/** A small (i) that explains a number in plain words — with the industry name for people who know it. */
export function Explain({ children, className }: { children: ReactNode; className?: string }) {
  const { t } = useTranslation();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("aiVisibility.common.whatIsThis", "What is this?")}
          className={cn("inline-flex size-4 items-center justify-center rounded-full text-muted-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25", className)}
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-[min(300px,calc(100vw-2rem))] p-3 text-[12.5px] leading-relaxed text-muted-foreground">
        {children}
      </PopoverContent>
    </Popover>
  );
}

/* -------------------------------------------------------------- source kind */

export function useDomainTypeLabel() {
  const { t } = useTranslation();
  return (type: DomainType | "own" | "competitor" | null | undefined): string => {
    switch (type) {
      case "own":
        return t("aiVisibility.sourceType.own", "Your site");
      case "competitor":
        return t("aiVisibility.sourceType.competitor", "Competitor");
      case "corporate":
        return t("aiVisibility.sourceType.corporate", "Company site");
      case "editorial":
        return t("aiVisibility.sourceType.editorial", "News & magazines");
      case "institutional":
        return t("aiVisibility.sourceType.institutional", "Public & education");
      case "ugc":
        return t("aiVisibility.sourceType.ugc", "Forums & social");
      case "reference":
        return t("aiVisibility.sourceType.reference", "Encyclopedia");
      case "directory":
        return t("aiVisibility.sourceType.directory", "Listings & reviews");
      case "other":
        return t("aiVisibility.sourceType.other", "Other");
      default:
        return t("aiVisibility.sourceType.unknown", "Not sorted yet");
    }
  };
}

export const SOURCE_TYPE_ORDER = ["own", "competitor", "editorial", "directory", "ugc", "reference", "corporate", "institutional", "other"] as const;

/** A thin horizontal bar used in tables: ink on paper, marker for the business. */
export function Bar({ value, own, color, className }: { value: number | null | undefined; own?: boolean; color?: string | null; className?: string }) {
  const w = Math.max(0, Math.min(1, value ?? 0));
  return (
    <span className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.07]", className)} aria-hidden>
      <span
        className={cn("block h-full rounded-full", own ? "bg-marker" : !color && "bg-foreground/60")}
        style={{ width: `${w * 100}%`, ...(color && !own ? { backgroundColor: color } : {}) }}
      />
    </span>
  );
}

/** Tone 0–100 as a word, because "63" means nothing to a barber. */
export function useToneWord() {
  const { t } = useTranslation();
  return (tone: number | null | undefined): string => {
    if (tone == null) return "—";
    if (tone >= 70) return t("aiVisibility.tone.positive", "Positive");
    if (tone >= 55) return t("aiVisibility.tone.friendly", "Friendly");
    if (tone > 45) return t("aiVisibility.tone.neutral", "Neutral");
    if (tone > 30) return t("aiVisibility.tone.mixed", "Mixed");
    return t("aiVisibility.tone.negative", "Negative");
  };
}

/** Intent in the owner's words. */
export function intentLabel(t: (k: string, d: string) => string, i: PromptIntent): string {
  return i === "informational"
    ? t("aiVisibility.intent.informational", "learning")
    : i === "transactional"
      ? t("aiVisibility.intent.transactional", "ready to buy")
      : t("aiVisibility.intent.commercial", "comparing");
}
