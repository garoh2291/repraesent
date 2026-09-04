import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";
import type { GuardDecision } from "~/lib/api/ai-assistants";

type Family = "llm" | "canned" | "blocked" | "gate" | "lead" | "limit";

const FAMILY: Record<GuardDecision, Family> = {
  llm: "llm",
  canned_greeting: "canned",
  canned_thanks: "canned",
  canned_goodbye: "canned",
  heuristic_block: "blocked",
  retrieval_gate: "gate",
  classifier_off_topic: "gate",
  classifier_smalltalk: "canned",
  budget: "limit",
  rate_limited: "limit",
  lead_form: "lead",
};

const TONE: Record<Family, string> = {
  llm: "border-border text-muted-foreground",
  canned: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  blocked: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  gate: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  lead: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  limit: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
};

/** What the guard did with a turn: the short family label, full reason on hover. */
export function GuardChip({ decision }: { decision: GuardDecision }) {
  const { t } = useTranslation();
  const family = FAMILY[decision] ?? "llm";
  return (
    <span
      title={t(`aiAssistants.guard.${decision}`, { defaultValue: decision })}
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        TONE[family],
      )}
    >
      {t(`aiAssistants.guardFamily.${family}`)}
    </span>
  );
}
