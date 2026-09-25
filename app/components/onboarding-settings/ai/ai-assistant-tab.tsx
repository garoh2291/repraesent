import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Link } from "react-router";
import { AlertTriangle, ListChecks, MessagesSquare, Sparkles } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { ASSISTANT_LEVELS, type AssistantLevel } from "~/lib/api/onboarding-chat";
import { Portrait } from "~/components/onboarding-v2/chat/portrait";
import {
  ASSISTANT_MODELS,
  DEFAULT_ASSISTANT_NAMES,
  OVERRIDE_REGIONS,
  type AiOnboardingSettings,
  type AiOnboardingState,
  type LocalizedText,
  type Persona,
  type WordingRegion,
} from "~/lib/api/ai-onboarding";
import { useAiOnboarding, useSaveAiOnboarding } from "~/lib/hooks/useRootOnboarding";
import { cn } from "~/lib/utils";
import { SaveBar, Section } from "../settings-section";
import { LocalizedField, RegionPills } from "./localized-field";
import { QuestionList, useQuestionName } from "./question-list";
import { ruleProblem } from "./rules-editor";

const REGIONS: readonly WordingRegion[] = ["default", ...OVERRIDE_REGIONS];

/** What is sent on save; also what "dirty" compares. */
const payloadOf = (s: AiOnboardingState) =>
  JSON.stringify({
    settings: s.settings,
    questions: s.questions.map(({ key, enabled, name, texts, rules }) => ({ key, enabled, name, texts, rules })),
  });

/**
 * Settings → Onboarding → AI assistant: switch it on, give it a voice per
 * region, and decide what it asks, in which order, with which rules.
 * One draft, one save bar (like the General tab).
 */
export function AiAssistantTab() {
  const { t } = useTranslation();
  const query = useAiOnboarding();
  const save = useSaveAiOnboarding();
  const questionName = useQuestionName();
  const [draft, setDraft] = useState<AiOnboardingState | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [region, setRegion] = useState<WordingRegion>("default");

  useEffect(() => {
    if (query.data && !draft) setDraft(query.data);
  }, [query.data, draft]);

  const dirty = useMemo(() => !!draft && !!query.data && payloadOf(draft) !== payloadOf(query.data), [draft, query.data]);

  if (!draft) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const settings = draft.settings;
  const patchSettings = (p: Partial<AiOnboardingSettings>) => setDraft((d) => (d ? { ...d, settings: { ...d.settings, ...p } } : d));

  /** Read/write the current region's value of a regional setting. */
  function regional<T>(key: "welcome" | "intro", empty: T) {
    const block = settings[key] as unknown as { default: T; regions: Partial<Record<string, T>> };
    const value = region === "default" ? block.default : (block.regions[region] ?? empty);
    const set = (v: T) =>
      patchSettings({
        [key]: region === "default" ? { ...block, default: v } : { ...block, regions: { ...block.regions, [region]: v } },
      } as Partial<AiOnboardingSettings>);
    return [value, set, block.default] as const;
  }
  /** One assistant's name + style for the current region. */
  const assistantAt = (level: AssistantLevel) => {
    const block = settings.assistants[level];
    const value: Persona = region === "default" ? block.default : (block.regions[region] ?? { name: "", style: "" });
    const set = (v: Persona) =>
      patchSettings({
        assistants: {
          ...settings.assistants,
          [level]: region === "default" ? { ...block, default: v } : { ...block, regions: { ...block.regions, [region]: v } },
        },
      });
    return [value, set, block.default] as const;
  };
  const [welcome, setWelcome, baseWelcome] = regional<LocalizedText>("welcome", {});
  const [intro, setIntro, baseIntro] = regional<{ headline: LocalizedText; sub: LocalizedText }>("intro", { headline: {}, sub: {} });
  const regionHasOwn = (r: WordingRegion) => {
    if (r === "default") return false;
    const i = settings.intro.regions[r];
    const own = ASSISTANT_LEVELS.some((l) => {
      const p = settings.assistants[l].regions[r];
      return !!(p?.name || p?.style);
    });
    return !!(own || Object.keys(settings.welcome.regions[r] ?? {}).length || Object.keys(i?.headline ?? {}).length || Object.keys(i?.sub ?? {}).length);
  };
  const inherit = region !== "default";

  const onSave = () => {
    for (const q of draft.questions) {
      const problem =
        q.kind === "custom" && !q.name.trim()
          ? "settings.onboarding.ai.errors.nameRequired"
          : q.kind === "custom" && Object.keys(q.texts.default).length === 0
            ? "settings.onboarding.ai.errors.textRequired"
            : q.rules.map(ruleProblem).find(Boolean);
      if (problem) {
        setOpenKey(q.key);
        toast.error(t(problem, { name: questionName(q) }));
        return;
      }
    }
    save.mutate(draft, {
      onSuccess: (s) => {
        setDraft(s);
        toast.success(t("settings.onboarding.saved"));
      },
      onError: (err) => toast.error(extractErrorMessage(err) || t("settings.onboarding.saveFailed")),
    });
  };

  const enabledCount = draft.questions.filter((q) => q.enabled).length;
  const assistantName = ASSISTANT_LEVELS.map((l) => settings.assistants[l].default.name || DEFAULT_ASSISTANT_NAMES[l]).join(" · ");

  return (
    <div className="space-y-6">
      {/* Status */}
      <div
        className={cn(
          "flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:p-5",
          settings.enabled ? "border-[#a4dab8] bg-[#a4dab8]/15" : "border-border bg-muted/30",
        )}
      >
        <div className="flex items-start gap-3">
          <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", settings.enabled ? "bg-[#3f9a64]" : "bg-muted-foreground/40")} aria-hidden />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {settings.enabled ? t("settings.onboarding.ai.statusOn", { name: assistantName }) : t("settings.onboarding.ai.statusOff")}
            </p>
            <p className="text-sm text-muted-foreground">
              {settings.enabled ? t("settings.onboarding.ai.statusOnHint", { count: enabledCount }) : t("settings.onboarding.ai.statusOffHint")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
          <Select value={settings.model} onValueChange={(model) => patchSettings({ model })}>
            <SelectTrigger className="h-9 min-w-44 bg-background" aria-label={t("settings.onboarding.ai.model")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSISTANT_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label} <span className="text-muted-foreground">· {t("settings.onboarding.ai.modelCost", { cost: m.cost })}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch checked={settings.enabled} onCheckedChange={(v) => patchSettings({ enabled: v })} className="data-[state=checked]:bg-foreground" />
            {t("settings.onboarding.ai.toggle")}
          </label>
        </div>
      </div>

      {settings.enabled && query.data?.ai_key_ready === false ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {t("settings.onboarding.ai.noKey")}{" "}
            <Link to="/settings/ai" className="font-medium underline underline-offset-4">
              {t("settings.onboarding.ai.noKeyLink")}
            </Link>
          </span>
        </p>
      ) : null}

      {/* Voice & welcome, per region */}
      <Section
        icon={<Sparkles className="h-4 w-4" />}
        title={t("settings.onboarding.ai.voiceTitle")}
        hint={t("settings.onboarding.ai.voiceHint")}
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <RegionPills regions={REGIONS} value={region} onChange={setRegion} filled={regionHasOwn} />
            {inherit ? (
              <p className="text-xs text-muted-foreground">
                {t("settings.onboarding.ai.regionInherit", { region: t(`settings.onboarding.regions.${region}`) })}
              </p>
            ) : null}
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">{t("settings.onboarding.ai.assistantsTitle")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t("settings.onboarding.ai.assistantsHint")}</p>
            </div>
            {ASSISTANT_LEVELS.map((level) => {
              const [persona, setPersona, basePersona] = assistantAt(level);
              const fallbackName = (inherit && basePersona.name) || DEFAULT_ASSISTANT_NAMES[level];
              const levelLabel = t(`settings.onboarding.ai.level${level[0].toUpperCase()}${level.slice(1)}`);
              return (
                <div key={level} className="grid gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-[auto_minmax(0,12rem)_1fr] sm:items-start">
                  <div className="flex items-center gap-3 sm:w-44">
                    <Portrait level={level} size={40} simple />
                    <span className="text-[13px] font-medium leading-tight text-foreground/80">{levelLabel}</span>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor={`ai-assistant-name-${level}`} className="text-xs font-medium text-muted-foreground">
                      {t("settings.onboarding.ai.assistantName")}
                    </label>
                    <Input
                      id={`ai-assistant-name-${level}`}
                      className="h-10"
                      maxLength={40}
                      value={persona.name}
                      onChange={(e) => setPersona({ ...persona, name: e.target.value })}
                      placeholder={fallbackName}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor={`ai-assistant-style-${level}`} className="text-xs font-medium text-muted-foreground">
                      {t("settings.onboarding.ai.assistantStyle")}
                    </label>
                    <Textarea
                      id={`ai-assistant-style-${level}`}
                      className="min-h-10 resize-y"
                      rows={1}
                      maxLength={300}
                      value={persona.style}
                      onChange={(e) => setPersona({ ...persona, style: e.target.value })}
                      placeholder={inherit && basePersona.style ? basePersona.style : t("settings.onboarding.ai.assistantStylePlaceholder")}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <LocalizedField
            key={`welcome-${region}`}
            label={t("settings.onboarding.ai.welcome")}
            value={welcome}
            onChange={setWelcome}
            placeholder={inherit ? baseWelcome : undefined}
            multiline
            hint={t("settings.onboarding.ai.welcomeHint")}
          />
          <LocalizedField
            key={`headline-${region}`}
            label={t("settings.onboarding.ai.introHeadline")}
            value={intro.headline}
            onChange={(v) => setIntro({ ...intro, headline: v })}
            placeholder={inherit ? baseIntro.headline : undefined}
            maxLength={200}
          />
          <LocalizedField
            key={`sub-${region}`}
            label={t("settings.onboarding.ai.introSub")}
            value={intro.sub}
            onChange={(v) => setIntro({ ...intro, sub: v })}
            placeholder={inherit ? baseIntro.sub : undefined}
            multiline
            maxLength={500}
            hint={t("settings.onboarding.ai.introHint")}
          />
        </div>
      </Section>

      {/* Questions */}
      <Section
        icon={<ListChecks className="h-4 w-4" />}
        title={t("settings.onboarding.ai.questionsTitle")}
        hint={t("settings.onboarding.ai.questionsHint")}
        action={
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground sm:inline-flex">
            <MessagesSquare className="size-3.5" aria-hidden />
            {t("settings.onboarding.ai.askedCount", { count: enabledCount, total: draft.questions.length })}
          </span>
        }
      >
        <QuestionList
          questions={draft.questions}
          onChange={(questions) => setDraft((d) => (d ? { ...d, questions } : d))}
          openKey={openKey}
          setOpenKey={setOpenKey}
        />
      </Section>

      <SaveBar dirty={dirty} saving={save.isPending} onSave={onSave} onDiscard={() => query.data && setDraft(query.data)} />
    </div>
  );
}
