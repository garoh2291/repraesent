import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import type { AiEngine, Cadence, EngineInfo, PackageKey } from "~/lib/api/ai-visibility";
import { AI_ENGINES } from "~/lib/api/ai-visibility";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { EngineMark, Explain, Segmented, eur, microUsdToEurCents, num } from "./shared";

export interface PlanValue {
  package: PackageKey;
  prompt_limit: number;
  engines: AiEngine[];
  cadence: Cadence;
  monthly_cap_eur_cents: number;
}

export const PRESETS: Record<Exclude<PackageKey, "custom">, { prompt_limit: number; engines: AiEngine[] }> = {
  starter: { prompt_limit: 25, engines: ["chatgpt", "perplexity", "gemini"] },
  growth: { prompt_limit: 50, engines: ["chatgpt", "perplexity", "gemini", "claude"] },
  pro: { prompt_limit: 100, engines: ["chatgpt", "perplexity", "gemini", "claude", "grok"] },
};

const RUN_DAYS: Record<Cadence, number> = { daily: 30.44, three_weekly: 13.04, weekly: 4.35 };

/** Same arithmetic as the API's estimateMonthlyCost — kept identical on purpose. */
export function estimate(v: Pick<PlanValue, "prompt_limit" | "engines" | "cadence">, catalog: EngineInfo[]) {
  const answers = Math.round(v.prompt_limit * RUN_DAYS[v.cadence]);
  const rows = v.engines.map((e) => {
    const info = catalog.find((c) => c.engine === e);
    const perAnswer = info?.micro_usd_per_answer ?? 15_000;
    return { engine: e, measured: !!info?.measured, answers, perAnswer, cents: microUsdToEurCents(answers * perAnswer) };
  });
  const cents = rows.reduce((s, r) => s + r.cents, 0);
  return { rows, answers: answers * v.engines.length, cents, suggestedCap: Math.max(500, Math.ceil((cents * 1.2) / 100) * 100) };
}

export function PackagePicker({
  value,
  onChange,
  catalog,
  activePrompts,
}: {
  value: PlanValue;
  onChange: (v: PlanValue) => void;
  catalog: EngineInfo[];
  activePrompts?: number;
}) {
  const { t } = useTranslation();
  const est = estimate(value, catalog);
  const minLimit = Math.max(1, activePrompts ?? 1);

  const pick = (k: PackageKey) => {
    if (k === "custom") return onChange({ ...value, package: "custom" });
    const preset = PRESETS[k];
    const next = { ...value, package: k, prompt_limit: preset.prompt_limit, engines: preset.engines };
    onChange({ ...next, monthly_cap_eur_cents: estimate(next, catalog).suggestedCap });
  };
  const setCustom = (patch: Partial<PlanValue>) => {
    const next = { ...value, ...patch, package: "custom" as const };
    onChange({ ...next, monthly_cap_eur_cents: estimate(next, catalog).suggestedCap });
  };

  const packages: Array<{ key: PackageKey; name: string; line: string }> = [
    { key: "starter", name: t("aiVisibility.plan.starter", "Starter"), line: t("aiVisibility.plan.starterLine", "25 questions · 3 assistants") },
    { key: "growth", name: t("aiVisibility.plan.growth", "Growth"), line: t("aiVisibility.plan.growthLine", "50 questions · 4 assistants") },
    { key: "pro", name: t("aiVisibility.plan.pro", "Pro"), line: t("aiVisibility.plan.proLine", "100 questions · 5 assistants") },
    { key: "custom", name: t("aiVisibility.plan.custom", "Custom"), line: t("aiVisibility.plan.customLine", "You choose") },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {packages.map((p) => {
          const preview =
            p.key === "custom" ? null : estimate({ ...PRESETS[p.key], cadence: value.cadence }, catalog).cents;
          const selected = value.package === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => pick(p.key)}
              aria-pressed={selected}
              className={cn(
                "relative flex flex-col items-start rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25",
                selected ? "border-foreground bg-card shadow-xs" : "border-border bg-card/60 hover:border-foreground/40",
              )}
            >
              {selected ? (
                <span className="absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background">
                  <Check className="size-3" />
                </span>
              ) : null}
              <span className="title-display text-[17px] font-semibold text-foreground">{p.name}</span>
              <span className="mt-0.5 text-[12.5px] text-muted-foreground">{p.line}</span>
              <span className="num mt-3 text-[20px] font-semibold text-foreground">
                {preview == null ? "—" : `≈ ${eur(preview)}`}
                {preview == null ? null : <span className="ml-1 text-[12px] font-normal text-muted-foreground">{t("aiVisibility.plan.perMonth", "/ month")}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-[13px] font-medium text-foreground">{t("aiVisibility.plan.cadence", "How often we ask")}</p>
          <Segmented<Cadence>
            label={t("aiVisibility.plan.cadence", "How often we ask")}
            value={value.cadence}
            onChange={(c) => onChange({ ...value, cadence: c, monthly_cap_eur_cents: estimate({ ...value, cadence: c }, catalog).suggestedCap })}
            options={[
              { value: "daily", label: t("aiVisibility.plan.daily", "Every day") },
              { value: "three_weekly", label: t("aiVisibility.plan.threeWeekly", "3× a week") },
              { value: "weekly", label: t("aiVisibility.plan.weekly", "Weekly") },
            ]}
          />
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            {value.cadence === "daily"
              ? t("aiVisibility.plan.dailyHint", "Best for spotting changes quickly. AI answers change from day to day, so more days give steadier numbers.")
              : value.cadence === "weekly"
                ? t("aiVisibility.plan.weeklyHint", "Cheapest. Numbers move slower and need a few weeks to settle.")
                : t("aiVisibility.plan.threeWeeklyHint", "Monday, Wednesday and Friday — a middle ground.")}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-[13px] font-medium text-foreground">{t("aiVisibility.plan.questions", "Questions tracked")}</p>
          <Input
            type="number"
            inputMode="numeric"
            min={minLimit}
            max={300}
            value={value.prompt_limit}
            onChange={(e) => {
              const n = Math.max(1, Math.min(300, Number(e.target.value) || 1));
              setCustom({ prompt_limit: n });
            }}
            className="num h-10 w-32"
          />
          {activePrompts != null && activePrompts > value.prompt_limit ? (
            <p className="text-[12.5px] text-overdue">
              {t("aiVisibility.plan.belowActive", "You have {{n}} active questions — archive some first or keep a higher limit.", { n: activePrompts })}
            </p>
          ) : (
            <p className="text-[12.5px] text-muted-foreground">{t("aiVisibility.plan.questionsHint", "Most businesses start with 20–30.")}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[13px] font-medium text-foreground">{t("aiVisibility.plan.assistants", "AI assistants we ask")}</p>
        <div className="flex flex-wrap gap-2">
          {AI_ENGINES.map((e) => {
            const on = value.engines.includes(e);
            const info = catalog.find((c) => c.engine === e);
            return (
              <button
                key={e}
                type="button"
                aria-pressed={on}
                disabled={info && !info.available}
                onClick={() => {
                  const next = on ? value.engines.filter((x) => x !== e) : [...value.engines, e];
                  if (next.length) setCustom({ engines: AI_ENGINES.filter((x) => next.includes(x)) });
                }}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] transition-colors disabled:opacity-40",
                  on ? "border-foreground bg-card font-medium text-foreground" : "border-dashed border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <EngineMark engine={e} />
                {on ? <Check className="size-3.5" /> : null}
              </button>
            );
          })}
          <span
            className="inline-flex h-9 cursor-not-allowed items-center gap-2 rounded-lg border border-dashed border-border px-3 text-[13px] text-muted-foreground/60"
            title={t("aiVisibility.plan.googleNa", "Google AI Overviews has no way to be asked from outside Google. We never guess its answers.")}
          >
            Google AI Overviews · {t("aiVisibility.plan.notAvailable", "not available")}
          </span>
        </div>
      </div>

      {/* The bill, spelled out */}
      <div className="rounded-xl border border-border bg-background/60">
        <div className="flex flex-col gap-1 border-b border-border px-4 py-3.5 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="text-[13.5px] text-muted-foreground">
            {t("aiVisibility.plan.estimateLine", "{{answers}} answers a month", { answers: num(est.answers) })}
          </p>
          <p className="title-display num text-[26px] font-semibold text-foreground">
            ≈ {eur(est.cents)}
            <span className="ml-1 text-[13px] font-normal text-muted-foreground">{t("aiVisibility.plan.perMonth", "/ month")}</span>
          </p>
        </div>
        <table className="w-full text-[13px]">
          <tbody className="divide-y divide-border">
            {est.rows.map((r) => (
              <tr key={r.engine}>
                <td className="px-4 py-2">
                  <EngineMark engine={r.engine} />
                </td>
                <td className="num px-2 py-2 text-right text-muted-foreground">
                  {num(r.answers)} × {eur(microUsdToEurCents(r.perAnswer), { digits: 3 })}
                  {r.measured ? (
                    <span className="ml-1.5 rounded bg-earned-soft px-1 text-[10.5px] font-medium text-earned">
                      {t("aiVisibility.plan.measured", "measured")}
                    </span>
                  ) : null}
                </td>
                <td className="num px-4 py-2 text-right font-medium text-foreground">{eur(r.cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-border px-4 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
          {t(
            "aiVisibility.plan.billingNote",
            "Paid directly to OpenRouter from your own key, at their price — re:praesent adds nothing on top. Each answer includes the assistant's web search and a small check that reads the answer. After the first answers we switch from list prices to what you actually paid.",
          )}
        </p>
      </div>

      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
          {t("aiVisibility.plan.cap", "Monthly spending limit")}
          <Explain>
            {t(
              "aiVisibility.plan.capHelp",
              "A hard stop. Before every question we check this month's spend; when the next one would go over, tracking pauses until the 1st of next month. Raise the limit any time to continue.",
            )}
          </Explain>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">€</span>
            <Input
              type="number"
              inputMode="decimal"
              min={1}
              step={1}
              value={Math.round(value.monthly_cap_eur_cents / 100)}
              onChange={(e) => onChange({ ...value, monthly_cap_eur_cents: Math.max(100, Math.round((Number(e.target.value) || 1) * 100)) })}
              className="num h-10 w-32 pl-7"
            />
          </div>
          <button
            type="button"
            onClick={() => onChange({ ...value, monthly_cap_eur_cents: est.suggestedCap })}
            className="text-[12.5px] font-medium text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
          >
            {t("aiVisibility.plan.useSuggested", "Use {{cap}} (estimate + 20%)", { cap: eur(est.suggestedCap) })}
          </button>
        </div>
        {value.monthly_cap_eur_cents < est.cents ? (
          <p className="text-[12.5px] text-overdue">
            {t("aiVisibility.plan.capBelow", "This limit is below the estimate — tracking will pause before the month ends.")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
