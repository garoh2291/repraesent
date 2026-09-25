import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Globe, KeyRound, Plus, Sparkles, X } from "lucide-react";
import { useAiVisibilityJob, useAiVisibilityStatus, useInvalidateAiVisibility } from "~/lib/hooks/useAiVisibility";
import {
  aiVisibilityApi,
  apiErrorMessage,
  isActiveJob,
  type PromptRow,
  type SiteProfile,
  type Status,
} from "~/lib/api/ai-visibility";
import { useAuthContext } from "~/providers/auth-provider";
import { cn } from "~/lib/utils";
import { PageContainer, PageHeader } from "~/components/notebook/page-header";
import { Panel } from "~/components/notebook/panel";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Skeleton } from "~/components/ui/skeleton";
import { PRESETS, PackagePicker, estimate, type PlanValue } from "~/components/ai-visibility/package-picker";
import { eur, intentLabel } from "~/components/ai-visibility/shared";
import { JobsStrip } from "~/components/ai-visibility/jobs-strip";

type Step = "business" | "competitors" | "questions" | "plan";
const STEPS: Step[] = ["business", "competitors", "questions", "plan"];

interface Biz {
  brand_name: string;
  brand_aliases: string;
  brand_domains: string;
  website_url: string;
  description: string;
  industry: string;
  country: string;
  language: string;
}

const split = (v: string) =>
  v
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

/**
 * Peec's onboarding, our way: start from what the workspace already knows
 * (onboarding stored name, website, industry and country), read the website
 * once to fill the gaps, and let the owner confirm instead of type. The last
 * step shows the bill before anything is spent.
 */
export default function AiVisibilitySetup() {
  const { t } = useTranslation();
  const status = useAiVisibilityStatus();
  const data = status.data;
  const { currentWorkspace } = useAuthContext();
  const canEdit = currentWorkspace?.member_role !== "viewer";

  if (!data) {
    return (
      <PageContainer className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-80" />
      </PageContainer>
    );
  }

  const keyOk = data.key.connected && data.key.status !== "revoked" && data.key.status !== "error";

  return (
    <PageContainer className="max-w-[980px] space-y-6">
      <PageHeader
        title={t("aiVisibility.setup.title", "See what AI assistants say about you")}
        subtitle={t(
          "aiVisibility.setup.subtitle",
          "Every day we ask ChatGPT, Perplexity, Gemini and others the questions your customers ask — and show you whether they recommend you, who they recommend instead, and what to do about it.",
        )}
      />
      {!canEdit ? (
        <Panel className="p-5 text-[14px] text-muted-foreground">
          {t("aiVisibility.setup.viewerOnly", "Ask an editor or admin of this workspace to set this up.")}
        </Panel>
      ) : !keyOk ? (
        <KeyStep error={data.key.last_error} />
      ) : (
        <>
          <JobsStrip canEdit={canEdit} />
          <Wizard data={data} />
        </>
      )}
    </PageContainer>
  );
}

function KeyStep({ error }: { error: string | null }) {
  const { t } = useTranslation();
  return (
    <Panel className="p-5 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-marker text-foreground">
          <KeyRound className="size-5" />
        </span>
        <div className="min-w-0 space-y-3">
          <h2 className="title-display text-[22px] font-semibold text-foreground">{t("aiVisibility.setup.keyTitle", "First, connect your OpenRouter key")}</h2>
          <p className="max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
            {t(
              "aiVisibility.setup.keyBody",
              "The questions are asked on your own OpenRouter account — the same key your AI chat uses. You pay OpenRouter directly at their prices; we add nothing. You'll see the exact monthly estimate and set a hard limit before anything runs.",
            )}
          </p>
          {error ? <p className="text-[13px] text-overdue">{t("aiVisibility.setup.keyError", "OpenRouter said: {{error}}", { error })}</p> : null}
          <Button asChild>
            <Link to="/settings/ai">
              {t("aiVisibility.setup.keyCta", "Connect in Settings → AI")}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function Wizard({ data }: { data: Status }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidateAiVisibility();
  const existing = data.project;
  const pre = "prefill" in data ? data.prefill : null;

  // Coming back mid-setup resumes at the right step instead of step 1.
  const [step, setStep] = useState<Step>(() => {
    if (!existing) return "business";
    if (data.jobs?.some((j) => j.kind === "suggest_prompts")) return "questions";
    return "competitors" in data && data.competitors.length ? "questions" : "competitors";
  });
  const [biz, setBiz] = useState<Biz>(() => ({
    brand_name: existing?.brand_name ?? pre?.brand_name ?? "",
    brand_aliases: (existing?.brand_aliases ?? pre?.brand_aliases ?? []).join(", "),
    brand_domains: (existing?.brand_domains ?? pre?.brand_domains ?? []).join(", "),
    website_url: existing?.website_url ?? pre?.website_url ?? "",
    description: existing?.description ?? pre?.description ?? "",
    industry: existing?.industry ?? pre?.industry ?? "",
    country: existing?.country ?? pre?.country ?? "",
    language: existing?.language ?? pre?.language ?? "en",
  }));
  const [site, setSite] = useState<SiteProfile | null>(null);
  // Long calls are server-side jobs: their state comes from the server, so
  // leaving the page (or a restart) loses nothing.
  const siteJob = useAiVisibilityJob("analyze_site");
  const suggestJob = useAiVisibilityJob("suggest_prompts");
  const reading = !!siteJob && isActiveJob(siteJob);
  const [saving, setSaving] = useState(false);

  // Competitors: proposals from the site read, plus typed ones.
  const [rivals, setRivals] = useState<Array<{ name: string; domain: string; on: boolean }>>(
    "competitors" in data ? data.competitors.map((c) => ({ name: c.name, domain: c.domains[0] ?? "", on: true })) : [],
  );
  const [topics, setTopics] = useState<string[]>("topics" in data ? data.topics.map((x) => x.name) : []);
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const writing = (!!suggestJob && isActiveJob(suggestJob)) || adding;
  const [plan, setPlan] = useState<PlanValue>(() => ({
    package: "starter",
    ...PRESETS.starter,
    cadence: "daily",
    monthly_cap_eur_cents: estimate({ ...PRESETS.starter, cadence: "daily" }, data.engines).suggestedCap,
  }));

  /** Fold a finished website read into the form — only into fields still empty. */
  const applySite = (res: SiteProfile) => {
    setSite(res);
    setBiz((b) => ({
      ...b,
      brand_name: b.brand_name || res.brand_name,
      brand_aliases: b.brand_aliases || res.brand_aliases.join(", "),
      brand_domains: b.brand_domains || res.brand_domains.join(", "),
      description: b.description || res.description || "",
      industry: b.industry || res.industry || "",
      country: b.country || res.country || "",
      language: b.language || res.language,
    }));
    setRivals((cur) => {
      const have = new Set(cur.map((r) => r.name.toLowerCase()));
      return [...cur, ...res.competitors.filter((c) => !have.has(c.name.toLowerCase())).map((c) => ({ name: c.name, domain: c.domain ?? "", on: true }))];
    });
    setTopics((cur) => (cur.length ? cur : res.topics));
  };

  // A read that finished — now, or while the page was closed — is applied once.
  const appliedSiteJob = useRef<string | null>(null);
  useEffect(() => {
    if (!siteJob || siteJob.status !== "succeeded" || !siteJob.result) return;
    if (appliedSiteJob.current === siteJob.id) return;
    appliedSiteJob.current = siteJob.id;
    applySite(siteJob.result as SiteProfile);
  }, [siteJob]);

  const readSite = async () => {
    try {
      await aiVisibilityApi.analyzeSite(biz.website_url.trim() || null);
      await invalidate();
    } catch (err) {
      toast.error(apiErrorMessage(err, t("aiVisibility.setup.readFailed", "Could not read the website.")));
    }
  };

  const saveBusiness = async () => {
    setSaving(true);
    try {
      await aiVisibilityApi.saveProject({
        brand_name: biz.brand_name.trim(),
        brand_aliases: split(biz.brand_aliases),
        brand_domains: split(biz.brand_domains),
        website_url: biz.website_url.trim() || null,
        description: biz.description.trim() || null,
        industry: biz.industry.trim() || null,
        country: biz.country.trim().length === 2 ? biz.country.trim().toUpperCase() : null,
        language: biz.language.trim() || "en",
      });
      setStep("competitors");
    } catch (err) {
      toast.error(apiErrorMessage(err, t("aiVisibility.planPage.saveFailed", "Could not save.")));
    } finally {
      setSaving(false);
    }
  };

  const saveCompetitors = async () => {
    setSaving(true);
    try {
      for (const r of rivals) {
        if (!r.on || !r.name.trim()) continue;
        await aiVisibilityApi.addCompetitor({ name: r.name.trim(), domains: r.domain ? [r.domain] : [], source: "setup" });
      }
      setStep("questions");
    } catch (err) {
      toast.error(apiErrorMessage(err, t("aiVisibility.competitors.saveFailed", "Could not save the competitor.")));
    } finally {
      setSaving(false);
    }
  };

  const loadSuggested = async () => {
    const res = await aiVisibilityApi.prompts({ period: "7d" });
    const list = res.prompts.filter((p) => p.status === "suggested" || p.status === "active");
    setPrompts((prev) => {
      const before = new Set(prev.map((p) => p.id));
      // Keep what the owner already ticked; tick new ones up to 25 in total.
      setPicked((picked) => {
        const next = new Set(prev.length ? [...picked].filter((id) => list.some((p) => p.id === id)) : []);
        for (const p of list) if (!before.has(p.id) && next.size < 25) next.add(p.id);
        return next;
      });
      return list;
    });
  };

  // Questions written in the background show up as soon as the job finishes.
  const loadedSuggestJob = useRef<string | null>(null);
  useEffect(() => {
    if (!suggestJob || suggestJob.status !== "succeeded" || loadedSuggestJob.current === suggestJob.id) return;
    loadedSuggestJob.current = suggestJob.id;
    if (existing) void loadSuggested().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestJob]);

  const [ownLines, setOwnLines] = useState("");
  const addOwn = async () => {
    const lines = ownLines
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length >= 3);
    if (!lines.length) return;
    setAdding(true);
    try {
      await aiVisibilityApi.addPrompts(lines.map((text) => ({ text, topic: topics[0] ?? null })), "suggested");
      const before = new Set(prompts.map((p) => p.id));
      const res = await aiVisibilityApi.prompts({ period: "7d" });
      const list = res.prompts.filter((p) => p.status === "suggested" || p.status === "active");
      setPrompts(list);
      // Typed questions are wanted by definition — tick them.
      setPicked((prev) => new Set([...prev, ...list.filter((p) => !before.has(p.id)).map((p) => p.id)]));
      setOwnLines("");
    } catch (err) {
      toast.error(apiErrorMessage(err, t("aiVisibility.prompts.addFailed", "Could not add the questions.")));
    } finally {
      setAdding(false);
    }
  };

  const writeQuestions = async () => {
    try {
      await aiVisibilityApi.suggestPrompts({ count: 25, topics });
      await invalidate();
    } catch (err) {
      toast.error(apiErrorMessage(err, t("aiVisibility.prompts.suggestFailed", "Could not suggest questions.")));
    }
  };

  useEffect(() => {
    if (step === "questions" && !prompts.length) void loadSuggested().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // The package follows the number of questions picked, until the owner chooses one.
  const [planTouched, setPlanTouched] = useState(false);
  useEffect(() => {
    if (step !== "plan" || planTouched) return;
    const n = picked.size;
    const key = n <= 25 ? "starter" : n <= 50 ? "growth" : "pro";
    const next = { ...PRESETS[key], package: key, cadence: plan.cadence } as PlanValue;
    setPlan({ ...next, monthly_cap_eur_cents: estimate(next, data.engines).suggestedCap });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const start = async () => {
    if (picked.size > plan.prompt_limit) {
      toast.error(t("aiVisibility.setup.tooMany", "You picked {{n}} questions but the package tracks {{limit}}.", { n: picked.size, limit: plan.prompt_limit }));
      return;
    }
    setSaving(true);
    try {
      await aiVisibilityApi.saveProject(
        plan.package === "custom"
          ? { package: "custom", prompt_limit: plan.prompt_limit, engines: plan.engines, cadence: plan.cadence, monthly_cap_eur_cents: plan.monthly_cap_eur_cents }
          : { package: plan.package, cadence: plan.cadence, monthly_cap_eur_cents: plan.monthly_cap_eur_cents },
      );
      const toActivate = prompts.filter((p) => picked.has(p.id) && p.status !== "active").map((p) => p.id);
      const toPark = prompts.filter((p) => !picked.has(p.id) && p.status === "active").map((p) => p.id);
      if (toPark.length) await aiVisibilityApi.bulkPrompts(toPark, "suggested");
      if (toActivate.length) await aiVisibilityApi.bulkPrompts(toActivate, "active");
      await aiVisibilityApi.activate(true);
      await invalidate();
      toast.success(t("aiVisibility.setup.started", "Tracking started. The first answers arrive in a few minutes."));
      navigate("/ai-visibility");
    } catch (err) {
      toast.error(apiErrorMessage(err, t("aiVisibility.setup.startFailed", "Could not start tracking.")));
    } finally {
      setSaving(false);
    }
  };

  const est = useMemo(() => estimate(plan, data.engines), [plan, data.engines]);
  // What the questions actually picked cost — the package limit is only the ceiling.
  const estPicked = useMemo(() => estimate({ ...plan, prompt_limit: Math.max(1, picked.size) }, data.engines), [plan, picked.size, data.engines]);
  const idx = STEPS.indexOf(step);
  const stepLabels: Record<Step, string> = {
    business: t("aiVisibility.setup.step.business", "Your business"),
    competitors: t("aiVisibility.setup.step.competitors", "Competitors"),
    questions: t("aiVisibility.setup.step.questions", "Questions"),
    plan: t("aiVisibility.setup.step.plan", "Package & cost"),
  };

  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap gap-x-5 gap-y-2" aria-label={t("aiVisibility.setup.steps", "Setup steps")}>
        {STEPS.map((s, i) => (
          <li key={s} className={cn("inline-flex items-center gap-2 text-[13px]", i === idx ? "font-semibold text-foreground" : "text-muted-foreground")} aria-current={i === idx ? "step" : undefined}>
            <span
              className={cn(
                "num flex size-6 items-center justify-center rounded-full text-[12px]",
                i < idx ? "bg-foreground text-background" : i === idx ? "bg-marker text-foreground" : "border border-border",
              )}
            >
              {i < idx ? <Check className="size-3.5" /> : i + 1}
            </span>
            {stepLabels[s]}
          </li>
        ))}
      </ol>

      {step === "business" ? (
        <Panel className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-background/50 p-4 sm:flex-row sm:items-center">
            <Globe className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-foreground">{t("aiVisibility.setup.readTitle", "Let us read your website")}</p>
              <p className="text-[12.5px] text-muted-foreground">
                {t("aiVisibility.setup.readBody", "We read a few public pages once to describe your business and suggest competitors and topics. About €0.01 on your key.")}
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                value={biz.website_url}
                onChange={(e) => setBiz({ ...biz, website_url: e.target.value })}
                placeholder="https://…"
                className="h-9 w-[min(240px,60vw)]"
              />
              <Button onClick={readSite} disabled={reading} className="h-9">
                <Sparkles className="size-3.5" />
                {reading ? t("aiVisibility.setup.reading", "Reading…") : t("aiVisibility.setup.read", "Read")}
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label={t("aiVisibility.setup.brandName", "Name customers use")} hint={t("aiVisibility.setup.brandNameHint", "The short name, e.g. “Muster Küchen”, not the legal form.")}>
              <Input value={biz.brand_name} onChange={(e) => setBiz({ ...biz, brand_name: e.target.value })} />
            </Field>
            <Field label={t("aiVisibility.setup.aliases", "Other spellings")} hint={t("aiVisibility.setup.aliasesHint", "Comma-separated, e.g. the legal name.")}>
              <Input value={biz.brand_aliases} onChange={(e) => setBiz({ ...biz, brand_aliases: e.target.value })} />
            </Field>
            <Field label={t("aiVisibility.setup.domains", "Your websites")} hint={t("aiVisibility.setup.domainsHint", "Answers citing these count as citing you.")}>
              <Input value={biz.brand_domains} onChange={(e) => setBiz({ ...biz, brand_domains: e.target.value })} placeholder="muster-kuechen.de" />
            </Field>
            <div className="grid grid-cols-[1fr_5rem_5rem] gap-3">
              <Field label={t("aiVisibility.setup.industry", "Kind of business")}>
                <Input value={biz.industry} onChange={(e) => setBiz({ ...biz, industry: e.target.value })} />
              </Field>
              <Field label={t("aiVisibility.setup.country", "Country")}>
                <Input value={biz.country} maxLength={2} onChange={(e) => setBiz({ ...biz, country: e.target.value.toUpperCase() })} placeholder="DE" />
              </Field>
              <Field label={t("aiVisibility.setup.language", "Language")}>
                <Input value={biz.language} maxLength={5} onChange={(e) => setBiz({ ...biz, language: e.target.value.toLowerCase() })} placeholder="de" />
              </Field>
            </div>
            <Field className="sm:col-span-2" label={t("aiVisibility.setup.description", "What you do")} hint={t("aiVisibility.setup.descriptionHint", "Two or three plain sentences. Used to write questions and advice.")}>
              <Textarea rows={3} value={biz.description} onChange={(e) => setBiz({ ...biz, description: e.target.value })} />
            </Field>
          </div>
          <Footer>
            <span />
            <Button onClick={saveBusiness} disabled={saving || !biz.brand_name.trim()}>
              {t("aiVisibility.setup.next", "Continue")}
              <ArrowRight className="size-3.5" />
            </Button>
          </Footer>
        </Panel>
      ) : null}

      {step === "competitors" ? (
        <Panel className="p-5 sm:p-6">
          <h2 className="text-[16px] font-semibold text-foreground">{t("aiVisibility.setup.rivalsTitle", "Who do customers compare you with?")}</h2>
          <p className="mt-1 max-w-2xl text-[13.5px] text-muted-foreground">
            {t("aiVisibility.setup.rivalsBody", "3 to 5 is plenty. You'll also get suggestions later from the names the assistants actually mention.")}
          </p>
          <ul className="mt-4 space-y-2">
            {rivals.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <Checkbox checked={r.on} onCheckedChange={(v) => setRivals(rivals.map((x, j) => (j === i ? { ...x, on: !!v } : x)))} aria-label={r.name || t("aiVisibility.setup.rival", "Competitor")} />
                <Input
                  value={r.name}
                  onChange={(e) => setRivals(rivals.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  placeholder={t("aiVisibility.competitors.name", "Name as customers say it")}
                  autoFocus={i === rivals.length - 1 && !r.name}
                  className="h-9 w-[min(260px,70vw)]"
                />
                <Input
                  value={r.domain}
                  onChange={(e) => setRivals(rivals.map((x, j) => (j === i ? { ...x, domain: e.target.value } : x)))}
                  placeholder={t("aiVisibility.competitors.domains", "Website")}
                  className="h-9 w-[min(220px,60vw)]"
                />
                <button type="button" onClick={() => setRivals(rivals.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={t("aiVisibility.common.remove", "Remove")}>
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setRivals([...rivals, { name: "", domain: "", on: true }])}>
            <Plus className="size-3.5" />
            {t("aiVisibility.competitors.add", "Add competitor")}
          </Button>
          {!rivals.length && !site ? (
            <p className="mt-3 text-[12.5px] text-muted-foreground">{t("aiVisibility.setup.rivalsTip", "Tip: go back and let us read your website to get suggestions.")}</p>
          ) : null}
          <Footer>
            <Button variant="ghost" onClick={() => setStep("business")}>
              <ArrowLeft className="size-3.5" />
              {t("aiVisibility.setup.back", "Back")}
            </Button>
            <Button onClick={saveCompetitors} disabled={saving}>
              {t("aiVisibility.setup.next", "Continue")}
              <ArrowRight className="size-3.5" />
            </Button>
          </Footer>
        </Panel>
      ) : null}

      {step === "questions" ? (
        <Panel className="p-5 sm:p-6">
          <h2 className="text-[16px] font-semibold text-foreground">{t("aiVisibility.setup.questionsTitle", "What would a customer ask?")}</h2>
          <p className="mt-1 max-w-2xl text-[13.5px] text-muted-foreground">
            {t(
              "aiVisibility.setup.questionsBody",
              "We write questions the way people ask AI assistants — most of them without your name, because that's where new customers find you. Tick the ones worth tracking.",
            )}
          </p>
          <div className="mt-4">
            <p className="mb-2 text-[13px] font-medium text-foreground">{t("aiVisibility.setup.topics", "Topics")}</p>
            <TopicChips topics={topics} onChange={setTopics} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={writeQuestions} disabled={writing} variant={prompts.length ? "outline" : "default"}>
              <Sparkles className="size-3.5" />
              {writing
                ? t("aiVisibility.setup.writing", "Writing questions…")
                : prompts.length
                  ? t("aiVisibility.setup.writeMore", "Write more")
                  : t("aiVisibility.setup.write", "Write 25 questions")}
            </Button>
            <span className="text-[12.5px] text-muted-foreground">{t("aiVisibility.setup.writeCost", "About €0.02 on your key.")}</span>
          </div>
          <details className="mt-3 text-[13px]">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              {t("aiVisibility.setup.ownTitle", "Or type your own questions (free)")}
            </summary>
            <div className="mt-2 space-y-2">
              <Textarea
                rows={4}
                value={ownLines}
                onChange={(e) => setOwnLines(e.target.value)}
                placeholder={t("aiVisibility.prompts.addPlaceholder", "Which kitchen studio in Hamburg is good for a small budget?\nWho installs fitted kitchens near Altona?")}
              />
              <Button variant="outline" size="sm" onClick={addOwn} disabled={writing || !ownLines.trim()}>
                {t("aiVisibility.setup.ownAdd", "Add to the list")}
              </Button>
            </div>
          </details>
          {writing && !prompts.length ? (
            <div className="mt-4 space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          ) : null}
          {prompts.length ? (
            <>
              <div className="mt-4 flex items-center justify-between text-[12.5px] text-muted-foreground">
                <span className="num">{t("aiVisibility.setup.picked", "{{n}} picked", { n: picked.size })}</span>
                <button type="button" className="underline underline-offset-4" onClick={() => setPicked(picked.size === prompts.length ? new Set() : new Set(prompts.map((p) => p.id)))}>
                  {picked.size === prompts.length ? t("aiVisibility.setup.pickNone", "Untick all") : t("aiVisibility.setup.pickAll", "Tick all")}
                </button>
              </div>
              <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
                {prompts.map((p) => (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-foreground/[0.02]">
                      <Checkbox
                        className="mt-0.5"
                        checked={picked.has(p.id)}
                        onCheckedChange={(v) =>
                          setPicked((prev) => {
                            const next = new Set(prev);
                            if (v) next.add(p.id);
                            else next.delete(p.id);
                            return next;
                          })
                        }
                      />
                      <span className="min-w-0">
                        <span className="block text-[14px] text-foreground">{p.text}</span>
                        <span className="text-[11.5px] text-muted-foreground">
                          {[p.topic, intentLabel(t, p.intent), p.branded ? t("aiVisibility.prompts.branded", "names a brand") : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <Footer>
            <Button variant="ghost" onClick={() => setStep("competitors")}>
              <ArrowLeft className="size-3.5" />
              {t("aiVisibility.setup.back", "Back")}
            </Button>
            <Button onClick={() => setStep("plan")} disabled={!picked.size}>
              {t("aiVisibility.setup.next", "Continue")}
              <ArrowRight className="size-3.5" />
            </Button>
          </Footer>
        </Panel>
      ) : null}

      {step === "plan" ? (
        <Panel className="p-5 sm:p-6">
          <h2 className="text-[16px] font-semibold text-foreground">{t("aiVisibility.setup.planTitle", "Pick a package — see the bill first")}</h2>
          <p className="mb-5 mt-1 max-w-2xl text-[13.5px] text-muted-foreground">
            {t("aiVisibility.setup.planBody", "You picked {{n}} questions. Change package, frequency or assistants and the estimate updates. Nothing is spent until you press Start.", { n: picked.size })}
          </p>
          <PackagePicker
            value={plan}
            onChange={(v) => {
              setPlanTouched(true);
              setPlan(v);
            }}
            catalog={data.engines}
          />
          <p className="mt-4 rounded-lg bg-marker-soft px-3.5 py-2.5 text-[13.5px] text-foreground">
            {t("aiVisibility.setup.pickedCost", "With the {{n}} questions you picked: about {{now}} a month. If you fill all {{limit}}: about {{max}}.", {
              n: picked.size,
              now: eur(estPicked.cents),
              limit: plan.prompt_limit,
              max: eur(est.cents),
            })}
          </p>
          {picked.size > plan.prompt_limit ? (
            <p className="mt-4 text-[13px] text-overdue">
              {t("aiVisibility.setup.tooMany", "You picked {{n}} questions but the package tracks {{limit}}.", { n: picked.size, limit: plan.prompt_limit })}
            </p>
          ) : null}
          <Footer>
            <Button variant="ghost" onClick={() => setStep("questions")}>
              <ArrowLeft className="size-3.5" />
              {t("aiVisibility.setup.back", "Back")}
            </Button>
            <Button onClick={start} disabled={saving || picked.size > plan.prompt_limit}>
              {t("aiVisibility.setup.start", "Start tracking — about {{cost}} a month", { cost: eur(estPicked.cents) })}
            </Button>
          </Footer>
        </Panel>
      ) : null}
    </div>
  );
}

function TopicChips({ topics, onChange }: { topics: string[]; onChange: (t: string[]) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !topics.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...topics, v]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {topics.map((tp) => (
        <span key={tp} className="inline-flex items-center gap-1 rounded-full border border-border bg-card py-1 pl-3 pr-1 text-[13px]">
          {tp}
          <button type="button" onClick={() => onChange(topics.filter((x) => x !== tp))} className="rounded-full p-0.5 text-muted-foreground hover:bg-accent" aria-label={t("aiVisibility.common.remove", "Remove")}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={t("aiVisibility.setup.addTopic", "Add a topic…")}
        className="h-8 w-40"
      />
    </div>
  );
}

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5 text-[13px]", className)}>
      <span className="font-medium text-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-[12px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">{children}</div>;
}
