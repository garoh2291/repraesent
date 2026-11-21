import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { DealCurrencySelect } from "~/components/molecule/deal-currency-select";
import { formatDealValueInput, type DealCurrency } from "~/lib/api/deals";
import { usePipelinesQuery } from "~/lib/hooks/usePipelines";
import { useDealStages } from "~/lib/hooks/usePipelineStages";
import { useStageLabel } from "~/lib/pipeline-stages/use-stage-label";
import { useWorkspaceMembers } from "~/lib/hooks/useWorkspaceMembers";

export interface BatchForm {
  titleExtra: string;
  value: string;
  currency: DealCurrency | null;
  pipelineId: string;
  stage: string;
  owner: string; // "" = nobody
  withTask: boolean;
  taskTitle: string;
  taskDue: string; // yyyy-mm-dd
  runAutomations: boolean;
}

export function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Anna Müller" + "Küche" → "Anna Müller · Küche" (same as the server). */
export function previewTitle(name: string, extra: string): string {
  const e = extra.replace(/\s+/g, " ").trim();
  return e ? `${name} · ${e}` : name;
}

/**
 * "Same for every deal": what every picked contact's deal gets. The top is
 * a small stack of the real titles it will make, so the shared text is never
 * a guess.
 */
export function BatchSettings({
  form,
  onForm,
  sampleNames,
  count,
  currency,
}: {
  form: BatchForm;
  onForm: (f: BatchForm) => void;
  sampleNames: string[];
  count: number;
  currency: DealCurrency;
}) {
  const { t } = useTranslation();
  const set = <K extends keyof BatchForm>(k: K, v: BatchForm[K]) => onForm({ ...form, [k]: v });

  const pipelines = usePipelinesQuery().data ?? [];
  const defaultPipeline = pipelines.find((p) => p.is_default)?.id ?? pipelines[0]?.id ?? "";
  const pipelineId = form.pipelineId || defaultPipeline;
  const stages = useDealStages(pipelineId || null);
  const stageLabel = useStageLabel();
  const openStages = useMemo(() => stages.visible.filter((s) => s.category === "open"), [stages.visible]);
  const stage = form.stage || stages.entry?.key || openStages[0]?.key || "";

  const members = useWorkspaceMembers().data?.members ?? [];
  const memberOptions = members.map((m) => ({
    id: m.user_id,
    label: [m.user_first_name, m.user_last_name].filter(Boolean).join(" ") || m.user_email,
  }));

  const samples = sampleNames.slice(0, 3);
  const more = Math.max(0, count - samples.length);

  return (
    <section aria-label={t("dealBatch.settings.title", "Same for every deal")} className="space-y-5">
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {t("dealBatch.settings.title", "Same for every deal")}
        </h2>
        {/* The stack: the first real titles, then how many more. */}
        <div className="relative mt-3 pb-2" aria-live="polite">
          {samples.length ? (
            <ol className="relative space-y-1.5">
              {samples.map((name, i) => (
                <li
                  key={`${name}-${i}`}
                  className={cn(
                    "relative rounded-lg border bg-card px-3.5 py-2.5",
                    i === 0 ? "border-foreground/25 shadow-[0_1px_0_rgba(20,21,22,0.06)]" : "border-border",
                  )}
                  style={{ marginLeft: i * 10, opacity: 1 - i * 0.18 }}
                >
                  <p className="truncate text-[14.5px] font-medium text-foreground">{previewTitle(name, form.titleExtra)}</p>
                  {i === 0 ? (
                    <p className="num mt-0.5 truncate text-[12.5px] text-muted-foreground">
                      {[
                        form.value ? `${form.value} ${currency}` : t("dealBatch.settings.noValue", "No value"),
                        stage ? stageLabel(stages.byKey.get(stage) ?? { entity: "deal", key: stage, label: null }) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-3.5 py-3 text-[14px] text-muted-foreground">
              {t("dealBatch.settings.nobody", "Tick at least one contact to see the deals.")}
            </p>
          )}
          {more > 0 ? (
            <p className="num mt-3 text-[13px] text-muted-foreground">
              {t("dealBatch.settings.andMore", { defaultValue: "and {{count}} more, one per contact", count: more })}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="batch-extra">{t("dealBatch.settings.extra", "Add to every title (optional)")}</Label>
        <Input
          id="batch-extra"
          value={form.titleExtra}
          maxLength={120}
          onChange={(e) => set("titleExtra", e.target.value)}
          placeholder={t("dealBatch.settings.extraPlaceholder", "e.g. Kitchen 2027")}
          autoCapitalize="sentences"
          enterKeyHint="next"
        />
        <p className="text-[12.5px] text-muted-foreground">
          {t("dealBatch.settings.extraHint", "Each deal is named after its contact.")}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="batch-value">{t("dealBatch.settings.value", "Value of each deal")}</Label>
        <div className="flex gap-2">
          <Input
            id="batch-value"
            className="flex-1"
            type="text"
            inputMode="decimal"
            enterKeyHint="next"
            value={form.value}
            onChange={(e) => {
              const raw = e.target.value.replace(/,/g, "");
              if (raw !== "" && !/^\d*\.?\d{0,2}$/.test(raw)) return;
              set("value", formatDealValueInput(e.target.value));
            }}
            placeholder="0"
          />
          <DealCurrencySelect value={currency} onChange={(c) => set("currency", c)} />
        </div>
        <p className="text-[12.5px] text-muted-foreground">
          {t("dealBatch.settings.valueHint", "Leave it empty if you don't know yet. You can change each deal later.")}
        </p>
      </div>

      {pipelines.length > 1 ? (
        <NativeField
          id="batch-pipeline"
          label={t("dealBatch.settings.pipeline", "Pipeline")}
          value={pipelineId}
          onChange={(v) => onForm({ ...form, pipelineId: v, stage: "" })}
          options={pipelines.map((p) => ({ value: p.id, label: p.name }))}
        />
      ) : null}

      <NativeField
        id="batch-stage"
        label={t("dealBatch.settings.stage", "Deal stage")}
        value={stage}
        onChange={(v) => set("stage", v)}
        options={openStages.map((s) => ({ value: s.key, label: stageLabel(s) }))}
      />

      <NativeField
        id="batch-owner"
        label={t("dealBatch.settings.owner", "Who looks after them")}
        value={form.owner}
        onChange={(v) => set("owner", v)}
        options={[{ value: "", label: t("contacts.unassigned", "Unassigned") }, ...memberOptions.map((m) => ({ value: m.id, label: m.label }))]}
      />

      <div className="rounded-xl border border-border bg-card">
        <label className="flex min-h-12 cursor-pointer select-none items-center justify-between gap-3 px-4 py-3">
          <span className="min-w-0">
            <span className="block text-[14.5px] font-medium text-foreground">{t("dealBatch.settings.task", "A first task on every deal")}</span>
            <span className="block text-[12.5px] text-muted-foreground">
              {t("dealBatch.settings.taskHint", "So every deal has a next step.")}
            </span>
          </span>
          <Switch checked={form.withTask} onCheckedChange={(v) => set("withTask", v)} />
        </label>
        {form.withTask ? (
          <div className="grid gap-3 border-t border-border px-4 py-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="batch-task">{t("dealBatch.settings.taskTitle", "Task")}</Label>
              <Input
                id="batch-task"
                value={form.taskTitle}
                maxLength={200}
                onChange={(e) => set("taskTitle", e.target.value)}
                aria-invalid={!form.taskTitle.trim()}
                autoCapitalize="sentences"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="batch-due">{t("dealBatch.settings.taskDue", "Due")}</Label>
              <Input id="batch-due" type="date" value={form.taskDue} onChange={(e) => set("taskDue", e.target.value)} className="sm:w-[11rem]" />
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-card">
        <label className="flex min-h-12 cursor-pointer select-none items-center justify-between gap-3 px-4 py-3">
          <span className="min-w-0">
            <span className="block text-[14.5px] font-medium text-foreground">
              {t("dealBatch.settings.automations", "Run my deal automations for these")}
            </span>
            <span className="block text-[12.5px] text-muted-foreground">
              {form.runAutomations
                ? t("dealBatch.settings.automationsOn", "Each new deal starts your workflows, like a deal made by hand. That can mean an email per deal.")
                : t("dealBatch.settings.automationsOff", "Off: no workflow starts for these deals, so nobody gets an email per deal.")}
            </span>
          </span>
          <Switch checked={form.runAutomations} onCheckedChange={(v) => set("runAutomations", v)} />
        </label>
      </div>
    </section>
  );
}

function NativeField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-10 w-full appearance-none rounded-md border border-input bg-card pl-3 pr-10 text-[14px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:text-[16px]",
          )}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      </div>
    </div>
  );
}
