import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import type { AiQuestion, QuestionRule, RuleAction, RuleWhen } from "~/lib/api/ai-onboarding";
import { optionLabel } from "~/lib/onboarding/option-labels";
import { cn } from "~/lib/utils";

const MAX_RULES = 10;
const ACTIONS: RuleAction[] = ["say", "skip", "flag", "instruct"];

const newId = () => `r${Math.random().toString(36).slice(2, 8)}`;

/**
 * "When the answer is … → then say / skip / flag / tell the assistant …".
 * The assistant reads these as instructions; `skip` hides another question.
 */
export function RulesEditor({
  question,
  questions,
  questionName,
  onChange,
}: {
  question: AiQuestion;
  questions: AiQuestion[];
  questionName: (q: AiQuestion) => string;
  onChange: (rules: QuestionRule[]) => void;
}) {
  const { t } = useTranslation();
  const rules = question.rules;
  // One chip per answer value: "Not sure" on two fields of a topic is one answer here.
  const options = question.fields
    .flatMap((f) => (f.options ?? []).map((value) => ({ path: f.path, value })))
    .filter((o, i, all) => all.findIndex((x) => x.value === o.value) === i);
  const skippable = questions.filter((q) => q.key !== question.key && !q.locked);

  const update = (i: number, patch: Partial<QuestionRule>) => onChange(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setWhen = (i: number, kind: RuleWhen["kind"]) =>
    update(i, { when: kind === "option" ? { kind, values: [] } : kind === "text" ? { kind, text: "" } : { kind } });

  return (
    <div className="space-y-2">
      {rules.length === 0 ? <p className="text-sm text-muted-foreground">{t("settings.onboarding.ai.rules.empty")}</p> : null}
      <ul className="space-y-2">
        {rules.map((rule, i) => (
          <li key={rule.id} className="rounded-lg border border-border bg-background p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("settings.onboarding.ai.rules.when")}</span>
              <Select value={rule.when.kind} onValueChange={(v) => setWhen(i, v as RuleWhen["kind"])}>
                <SelectTrigger className="h-9 min-w-44" aria-label={t("settings.onboarding.ai.rules.when")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="always">{t("settings.onboarding.ai.rules.always")}</SelectItem>
                  {options.length ? <SelectItem value="option">{t("settings.onboarding.ai.rules.answerIs")}</SelectItem> : null}
                  <SelectItem value="text">{t("settings.onboarding.ai.rules.answerLike")}</SelectItem>
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => onChange(rules.filter((_, j) => j !== i))}
                className="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label={t("settings.onboarding.ai.rules.remove")}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>

            {rule.when.kind === "option" ? (
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={t("settings.onboarding.ai.rules.answerIs")}>
                {options.map((o) => {
                  const values = rule.when.kind === "option" ? rule.when.values : [];
                  const on = values.includes(o.value);
                  return (
                    <button
                      key={`${o.path}:${o.value}`}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        update(i, { when: { kind: "option", values: on ? values.filter((v) => v !== o.value) : [...values, o.value] } })
                      }
                      className={cn(
                        "h-8 rounded-full border px-3 text-[13px] transition-colors",
                        on ? "border-foreground bg-foreground text-background" : "border-border text-foreground hover:border-foreground/40",
                      )}
                    >
                      {optionLabel(t, o.path, o.value)}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {rule.when.kind === "text" ? (
              <Input
                className="mt-2 h-10"
                value={rule.when.text}
                maxLength={500}
                onChange={(e) => update(i, { when: { kind: "text", text: e.target.value } })}
                placeholder={t("settings.onboarding.ai.rules.answerLikePlaceholder")}
              />
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("settings.onboarding.ai.rules.then")}</span>
              <Select
                value={rule.action}
                onValueChange={(v) => update(i, { action: v as RuleAction, ...(v === "skip" ? { value: "" } : { target_key: undefined }) })}
              >
                <SelectTrigger className="h-9 min-w-44" aria-label={t("settings.onboarding.ai.rules.then")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {t(`settings.onboarding.ai.rules.actions.${a}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {rule.action === "skip" ? (
                <Select value={rule.target_key ?? ""} onValueChange={(v) => update(i, { target_key: v })}>
                  <SelectTrigger className="h-9 min-w-52 flex-1" aria-label={t("settings.onboarding.ai.rules.skipWhich")}>
                    <SelectValue placeholder={t("settings.onboarding.ai.rules.skipWhich")} />
                  </SelectTrigger>
                  <SelectContent>
                    {skippable.map((q) => (
                      <SelectItem key={q.key} value={q.key}>
                        {questionName(q)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
            {rule.action !== "skip" ? (
              <Input
                className="mt-2 h-10"
                value={rule.value}
                maxLength={500}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder={t(`settings.onboarding.ai.rules.placeholders.${rule.action}`)}
              />
            ) : null}
          </li>
        ))}
      </ul>
      {rules.length < MAX_RULES ? (
        <button
          type="button"
          onClick={() => onChange([...rules, { id: newId(), when: { kind: "always" }, action: "say", value: "" }])}
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <Plus className="size-4" aria-hidden />
          {t("settings.onboarding.ai.rules.add")}
        </button>
      ) : null}
    </div>
  );
}

/** Client-side check before saving (the server checks again). */
export function ruleProblem(rule: QuestionRule): string | null {
  if (rule.when.kind === "option" && rule.when.values.length === 0) return "settings.onboarding.ai.rules.errors.pickAnswer";
  if (rule.when.kind === "text" && !rule.when.text.trim()) return "settings.onboarding.ai.rules.errors.describeWhen";
  if (rule.action === "skip" && !rule.target_key) return "settings.onboarding.ai.rules.errors.pickSkip";
  if (rule.action !== "skip" && !rule.value.trim()) return "settings.onboarding.ai.rules.errors.needsText";
  return null;
}
