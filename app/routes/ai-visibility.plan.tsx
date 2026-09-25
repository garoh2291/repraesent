import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Pause, Play } from "lucide-react";
import { aiVisibilityApi, apiErrorMessage } from "~/lib/api/ai-visibility";
import { useInvalidateAiVisibility } from "~/lib/hooks/useAiVisibility";
import { formatDateTime } from "~/lib/utils/format";
import { Panel, PanelHeader } from "~/components/notebook/panel";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { useAiVisibilityContext } from "~/components/ai-visibility/context";
import { PackagePicker, type PlanValue } from "~/components/ai-visibility/package-picker";
import { EngineMark, eur, microUsdToEurCents, num } from "~/components/ai-visibility/shared";

/** The package, the bill, the business details the answers are matched against. */
export default function AiVisibilityPlan() {
  const { t } = useTranslation();
  const { state, canEdit } = useAiVisibilityContext();
  const invalidate = useInvalidateAiVisibility();
  const navigate = useNavigate();
  const p = state.project;
  const [plan, setPlan] = useState<PlanValue>({
    package: p.package,
    prompt_limit: p.prompt_limit,
    engines: p.engines,
    cadence: p.cadence,
    monthly_cap_eur_cents: p.monthly_cap_eur_cents,
  });
  const [biz, setBiz] = useState({
    brand_name: p.brand_name,
    brand_aliases: p.brand_aliases.join(", "),
    brand_domains: p.brand_domains.join(", "),
    description: p.description ?? "",
    country: p.country ?? "",
    language: p.language,
  });
  const [saving, setSaving] = useState(false);
  const dirtyPlan =
    plan.package !== p.package ||
    plan.prompt_limit !== p.prompt_limit ||
    plan.cadence !== p.cadence ||
    plan.monthly_cap_eur_cents !== p.monthly_cap_eur_cents ||
    plan.engines.join() !== p.engines.join();

  const split = (v: string) =>
    v
      .split(/[,\n]/)
      .map((x) => x.trim())
      .filter(Boolean);

  const save = async (body: Parameters<typeof aiVisibilityApi.saveProject>[0], ok: string) => {
    setSaving(true);
    try {
      await aiVisibilityApi.saveProject(body);
      toast.success(ok);
      void invalidate();
    } catch (err) {
      toast.error(apiErrorMessage(err, t("aiVisibility.planPage.saveFailed", "Could not save.")));
    } finally {
      setSaving(false);
    }
  };

  const togglePause = async () => {
    try {
      if (p.status === "active") await aiVisibilityApi.pause();
      else await aiVisibilityApi.resume();
      void invalidate();
    } catch (err) {
      toast.error(apiErrorMessage(err, t("aiVisibility.planPage.saveFailed", "Could not save.")));
    }
  };

  const spentShare = state.spend.cap_eur_cents ? state.spend.month_eur_cents / state.spend.cap_eur_cents : 0;
  const est = state.estimate.at_active;

  return (
    <div className="space-y-6">
      {/* This month */}
      <Panel className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{t("aiVisibility.planPage.thisMonth", "This month")}</p>
            <p className="title-display num mt-1 text-[32px] font-semibold text-foreground">
              {eur(state.spend.month_eur_cents, { precise: true })}
              <span className="ml-2 text-[15px] font-normal text-muted-foreground">
                {t("aiVisibility.planPage.ofCap", "of {{cap}} limit", { cap: eur(state.spend.cap_eur_cents) })}
              </span>
            </p>
            <div className="mt-3 h-2 w-full max-w-md overflow-hidden rounded-full bg-foreground/[0.07]">
              <div className={spentShare >= 0.9 ? "h-full bg-overdue" : "h-full bg-foreground"} style={{ width: `${Math.min(100, spentShare * 100)}%` }} />
            </div>
            <p className="mt-2 text-[12.5px] text-muted-foreground">
              {t("aiVisibility.planPage.forecast", "At {{n}} tracked questions, a full month costs about {{cost}}.", {
                n: state.active_prompts,
                cost: eur(est.eur_cents_per_month),
              })}
            </p>
          </div>
          {canEdit ? (
            <Button variant="outline" onClick={togglePause}>
              {p.status === "active" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              {p.status === "active" ? t("aiVisibility.planPage.pause", "Pause tracking") : t("aiVisibility.planPage.resume", "Resume tracking")}
            </Button>
          ) : null}
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 text-[13px] sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">{t("aiVisibility.planPage.lastRun", "Last run")}</dt>
            <dd className="mt-0.5 text-foreground">{p.last_run_at ? formatDateTime(p.last_run_at) : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("aiVisibility.planPage.nextRun", "Next run")}</dt>
            <dd className="mt-0.5 text-foreground">{p.status === "active" && p.next_run_at ? formatDateTime(p.next_run_at) : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("aiVisibility.planPage.lastBatch", "Last run cost")}</dt>
            <dd className="num mt-0.5 text-foreground">
              {state.latest_batch ? eur(microUsdToEurCents(state.latest_batch.cost_micro_usd), { precise: true }) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("aiVisibility.planPage.lastBatchAnswers", "Answers in last run")}</dt>
            <dd className="num mt-0.5 text-foreground">
              {state.latest_batch ? `${num(state.latest_batch.answers_done)}${state.latest_batch.answers_failed ? ` (${state.latest_batch.answers_failed} ✕)` : ""}` : "—"}
            </dd>
          </div>
        </dl>
      </Panel>

      {/* Package */}
      <Panel>
        <PanelHeader title={t("aiVisibility.planPage.package", "Package")} />
        <div className="p-4 sm:p-5">
          <PackagePicker value={plan} onChange={setPlan} catalog={state.engines} activePrompts={state.active_prompts} />
          {canEdit ? (
            <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
              <Button
                variant="ghost"
                disabled={!dirtyPlan || saving}
                onClick={() => setPlan({ package: p.package, prompt_limit: p.prompt_limit, engines: p.engines, cadence: p.cadence, monthly_cap_eur_cents: p.monthly_cap_eur_cents })}
              >
                {t("aiVisibility.common.reset", "Reset")}
              </Button>
              <Button
                disabled={!dirtyPlan || saving}
                onClick={() =>
                  save(
                    plan.package === "custom"
                      ? { package: "custom", prompt_limit: plan.prompt_limit, engines: plan.engines, cadence: plan.cadence, monthly_cap_eur_cents: plan.monthly_cap_eur_cents }
                      : { package: plan.package, cadence: plan.cadence, monthly_cap_eur_cents: plan.monthly_cap_eur_cents },
                    t("aiVisibility.planPage.saved", "Saved."),
                  )
                }
              >
                {t("aiVisibility.planPage.savePlan", "Save package")}
              </Button>
            </div>
          ) : null}
        </div>
      </Panel>

      {/* Business */}
      <Panel>
        <PanelHeader title={t("aiVisibility.planPage.business", "Your business, as the answers are matched")} />
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <Field label={t("aiVisibility.setup.brandName", "Name customers use")}>
            <Input value={biz.brand_name} onChange={(e) => setBiz({ ...biz, brand_name: e.target.value })} disabled={!canEdit} />
          </Field>
          <Field label={t("aiVisibility.setup.aliases", "Other spellings")} hint={t("aiVisibility.setup.aliasesHint", "Comma-separated, e.g. the legal name.")}>
            <Input value={biz.brand_aliases} onChange={(e) => setBiz({ ...biz, brand_aliases: e.target.value })} disabled={!canEdit} />
          </Field>
          <Field label={t("aiVisibility.setup.domains", "Your websites")} hint={t("aiVisibility.setup.domainsHint", "Answers citing these count as citing you.")}>
            <Input value={biz.brand_domains} onChange={(e) => setBiz({ ...biz, brand_domains: e.target.value })} disabled={!canEdit} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("aiVisibility.setup.country", "Country")}>
              <Input value={biz.country} maxLength={2} onChange={(e) => setBiz({ ...biz, country: e.target.value.toUpperCase() })} placeholder="DE" disabled={!canEdit} />
            </Field>
            <Field label={t("aiVisibility.setup.language", "Language")}>
              <Input value={biz.language} maxLength={5} onChange={(e) => setBiz({ ...biz, language: e.target.value.toLowerCase() })} placeholder="de" disabled={!canEdit} />
            </Field>
          </div>
          <Field className="sm:col-span-2" label={t("aiVisibility.setup.description", "What you do")}>
            <Textarea rows={3} value={biz.description} onChange={(e) => setBiz({ ...biz, description: e.target.value })} disabled={!canEdit} />
          </Field>
        </div>
        {canEdit ? (
          <div className="flex justify-end border-t border-border px-4 py-3 sm:px-5">
            <Button
              disabled={saving || !biz.brand_name.trim()}
              onClick={() =>
                save(
                  {
                    brand_name: biz.brand_name.trim(),
                    brand_aliases: split(biz.brand_aliases),
                    brand_domains: split(biz.brand_domains),
                    description: biz.description.trim() || null,
                    country: biz.country.trim().length === 2 ? biz.country.trim() : null,
                    language: biz.language.trim() || "en",
                  },
                  t("aiVisibility.planPage.saved", "Saved."),
                )
              }
            >
              {t("aiVisibility.common.save", "Save")}
            </Button>
          </div>
        ) : null}
      </Panel>

      {/* How it works, for the curious */}
      <Panel className="p-5 sm:p-6">
        <h2 className="text-[15px] font-semibold text-foreground">{t("aiVisibility.planPage.howTitle", "How this works")}</h2>
        <div className="mt-3 grid gap-4 text-[13.5px] leading-relaxed text-muted-foreground md:grid-cols-2">
          <p>
            {t(
              "aiVisibility.planPage.how1",
              "On every run day we ask each assistant every tracked question once, the way a customer would, with the assistant's own web search switched on. We read each answer: were you named, where, how, and which websites it used.",
            )}
          </p>
          <p>
            {t(
              "aiVisibility.planPage.how2",
              "Answers vary from day to day — that's normal. The numbers are shares across many answers, so they get steadier with every run. Look at trends over weeks, not single days.",
            )}
          </p>
          <p>
            {t(
              "aiVisibility.planPage.how3",
              "We ask through each assistant's official connection, not by imitating a browser. Answers are very close to what people see in the apps, but not always word for word. Google's AI Overviews can't be asked this way, so we don't show it.",
            )}
          </p>
          <p>
            {t(
              "aiVisibility.planPage.how4",
              "Nothing touches your website. We only read public pages once when you set this up, and your robots.txt to check that AI assistants are allowed in.",
            )}
          </p>
        </div>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-muted-foreground">
          {state.engines
            .filter((e) => p.engines.includes(e.engine))
            .map((e) => (
              <li key={e.engine} className="inline-flex items-center gap-1.5">
                <EngineMark engine={e.engine} /> <span className="font-mono text-[11px]">{e.model}</span>
              </li>
            ))}
        </ul>
      </Panel>

      {canEdit ? (
        <div className="flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="text-overdue hover:text-overdue">
                {t("aiVisibility.planPage.delete", "Stop and delete AI visibility")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("aiVisibility.planPage.deleteTitle", "Stop tracking and remove the setup?")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("aiVisibility.planPage.deleteBody", "No more questions are asked and nothing more is spent. You can set it up again later; past answers are not shown then.")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("aiVisibility.common.cancel", "Cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    try {
                      await aiVisibilityApi.deleteProject();
                      await invalidate();
                      navigate("/ai-visibility/setup");
                    } catch (err) {
                      toast.error(apiErrorMessage(err, t("aiVisibility.planPage.saveFailed", "Could not save.")));
                    }
                  }}
                >
                  {t("aiVisibility.planPage.deleteConfirm", "Stop and delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block space-y-1.5 text-[13px] ${className ?? ""}`}>
      <span className="font-medium text-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-[12px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}
