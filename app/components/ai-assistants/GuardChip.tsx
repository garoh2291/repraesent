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

// Standard replies are routine, so they stay neutral; the colours are kept for
// the turns an owner may want to act on (blocked, unanswered, a contact ask).
const TONE: Record<Family, string> = {
  llm: "border-border text-muted-foreground",
  canned: "border-border bg-muted text-muted-foreground",
  blocked: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  gate: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  lead: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  limit: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
};

/**
 * What happened to a turn, in the owner's words ("Stopped as spam", "No
 * answer found"). A decision this build doesn't know yet reads "Other" — the
 * raw server code only survives in the tooltip, for whoever debugs it.
 */
export function GuardChip({ decision }: { decision: GuardDecision }) {
  const { t } = useTranslation();
  const known = decision in FAMILY;
  const family = FAMILY[decision] ?? "llm";
  const label = known
    ? t(`aiAssistants.guardPlain.${decision}`)
    : t("aiAssistants.guardPlain.other");
  return (
    <span
      title={known ? label : decision}
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        TONE[family],
      )}
    >
      {label}
    </span>
  );
}
