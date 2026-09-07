import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Handshake, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelSection,
} from "~/components/forms/chrome";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import type { PipelineStage } from "~/lib/api/pipeline-stages";
import { resolveStageColors } from "~/lib/pipeline-stages/colors";
import { resolveStageLabel } from "~/lib/pipeline-stages/labels";
import {
  useDeleteFormDealSettings,
  useFormDealOptions,
  useFormDealSettings,
  useSaveFormDealSettings,
} from "~/lib/hooks/useFormDealSettings";
import { cn } from "~/lib/utils";

interface Props {
  formId: string;
  canEdit: boolean;
}

/** Sentinel for "don't create a deal when the payment fails" (null on the wire). */
const NO_LOST = "__none__";

function StageOption({ stage }: { stage: PipelineStage }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className={cn(
          "inline-block size-2 shrink-0 rounded-full",
          resolveStageColors(stage).dot,
        )}
      />
      {resolveStageLabel(stage, t)}
    </span>
  );
}

/**
 * The Deal tab — product forms only.
 *
 * Saves on its own PUT rather than through the builder's definition autosave,
 * because the config lives in its own table. That is deliberate: publishing
 * snapshots `definition`, so a pipeline chosen after publishing would never
 * take effect. Here the pipeline and stages on a live form can be changed
 * without republishing.
 */
export function DealPanel({ formId, canEdit }: Props) {
  const { t } = useTranslation();
  const settingsQuery = useFormDealSettings(formId);
  const optionsQuery = useFormDealOptions(formId);
  const save = useSaveFormDealSettings(formId);
  const remove = useDeleteFormDealSettings(formId);

  const settings = settingsQuery.data ?? null;
  const pipelines = useMemo(() => optionsQuery.data ?? [], [optionsQuery.data]);

  const [enabled, setEnabled] = useState(false);
  const [pipelineId, setPipelineId] = useState<string>("");
  const [wonKey, setWonKey] = useState<string>("");
  const [lostKey, setLostKey] = useState<string>(NO_LOST);
  const [titleTemplate, setTitleTemplate] = useState<string>("");

  // Hydrate once the two queries land. Keyed on the row's identity so a
  // background refetch never overwrites something half-typed.
  useEffect(() => {
    if (settingsQuery.isLoading || optionsQuery.isLoading) return;
    const fallbackPipeline =
      pipelines.find((p) => p.is_default)?.id ?? pipelines[0]?.id ?? "";
    if (settings) {
      setEnabled(settings.is_enabled);
      setPipelineId(settings.pipeline_id ?? fallbackPipeline);
      setWonKey(settings.won_stage_key);
      setLostKey(settings.lost_stage_key ?? NO_LOST);
      setTitleTemplate(settings.title_template ?? "");
      return;
    }
    setEnabled(false);
    setPipelineId(fallbackPipeline);
    // Pre-pick the obvious pair so turning the switch on is a one-click action.
    const stages = pipelines.find((p) => p.id === fallbackPipeline)?.stages ?? [];
    setWonKey(stages.find((s) => s.category === "won")?.key ?? "");
    setLostKey(stages.find((s) => s.category === "lost")?.key ?? NO_LOST);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.id, settingsQuery.isLoading, optionsQuery.isLoading, pipelines]);

  const stages = useMemo(
    () => pipelines.find((p) => p.id === pipelineId)?.stages ?? [],
    [pipelines, pipelineId],
  );

  /**
   * Switching pipeline invalidates the two stage keys — a key is only unique
   * within its pipeline, and two pipelines may both have a "won".
   */
  const onPipelineChange = (next: string) => {
    setPipelineId(next);
    const nextStages = pipelines.find((p) => p.id === next)?.stages ?? [];
    setWonKey(nextStages.find((s) => s.category === "won")?.key ?? "");
    setLostKey(
      lostKey === NO_LOST
        ? NO_LOST
        : (nextStages.find((s) => s.category === "lost")?.key ?? NO_LOST),
    );
  };

  const busy = save.isPending || remove.isPending;
  const canSave = canEdit && !busy && (!enabled || !!wonKey);

  const onSave = async () => {
    try {
      // Switching off a form that never had a config is a no-op, not a 404.
      if (!enabled && !settings) return;
      if (!enabled && settings) {
        await remove.mutateAsync();
      } else {
        await save.mutateAsync({
          is_enabled: true,
          pipeline_id: pipelineId || null,
          won_stage_key: wonKey,
          lost_stage_key: lostKey === NO_LOST ? null : lostKey,
          title_template: titleTemplate.trim() || null,
        });
      }
      toast.success(t("common.saved", { defaultValue: "Saved" }));
    } catch (error) {
      toast.error(extractErrorMessage(error));
    }
  };

  if (settingsQuery.isLoading || optionsQuery.isLoading) {
    return (
      <Panel>
        <PanelHeader
          icon={<Handshake className="size-3.5" />}
          title={t("forms.deal.title", { defaultValue: "Deal" })}
        />
        <PanelBody>
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("common.loading")}
          </div>
        </PanelBody>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeader
        icon={<Handshake className="size-3.5" />}
        title={t("forms.deal.title", { defaultValue: "Deal" })}
        action={
          canEdit ? (
            <Button size="sm" disabled={!canSave} onClick={onSave}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("common.save", { defaultValue: "Save" })}
            </Button>
          ) : null
        }
      />
      <PanelBody>
        <PanelSection>
          <label className="flex items-start gap-3">
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              disabled={!canEdit}
              className="mt-0.5"
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium">
                {t("forms.deal.enable", {
                  defaultValue: "Create a deal from each submission",
                })}
              </span>
              <span className="block text-xs leading-relaxed text-muted-foreground">
                {t("forms.deal.enableHint", {
                  defaultValue:
                    "A deal is created once Stripe resolves the payment — not when the form is submitted, so an abandoned checkout never reaches your board. The buyer's contact, Stripe customer, invoice and purchased products are attached to it.",
                })}
              </span>
            </span>
          </label>
        </PanelSection>

        {enabled ? (
          <>
            <PanelSection
              title={t("forms.deal.whereTitle", { defaultValue: "Where it lands" })}
            >
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t("forms.deal.pipeline", { defaultValue: "Pipeline" })}
                </label>
                <Select
                  value={pipelineId}
                  onValueChange={onPipelineChange}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t("forms.deal.wonStage", {
                    defaultValue: "When the payment succeeds",
                  })}
                </label>
                <Select
                  value={wonKey}
                  onValueChange={setWonKey}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={t("forms.deal.pickStage", {
                        defaultValue: "Pick a stage",
                      })}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.key}>
                        <StageOption stage={s} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t("forms.deal.lostStage", {
                    defaultValue: "When the payment fails or expires",
                  })}
                </label>
                <Select
                  value={lostKey}
                  onValueChange={setLostKey}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_LOST}>
                      {t("forms.deal.noLost", {
                        defaultValue: "Don't create a deal",
                      })}
                    </SelectItem>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.key}>
                        <StageOption stage={s} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </PanelSection>

            <PanelSection
              title={t("forms.deal.titleSection", { defaultValue: "Deal title" })}
            >
              <Input
                value={titleTemplate}
                disabled={!canEdit}
                placeholder="{buyer} — {products}"
                onChange={(e) => setTitleTemplate(e.target.value)}
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("forms.deal.titleHint", {
                  defaultValue:
                    "Leave empty for “Buyer — Products”. Available: {buyer}, {products}, {form}, {amount}.",
                })}
              </p>
            </PanelSection>

            <PanelSection>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("forms.deal.invoiceNotice", {
                  defaultValue:
                    "Turning this on also asks Stripe to issue an invoice for one-off payments, so the deal always carries a real invoice with a PDF. Buyers may receive that invoice by email, depending on your Stripe settings. Subscriptions are invoiced by Stripe either way.",
                })}
              </p>
            </PanelSection>
          </>
        ) : null}
      </PanelBody>
    </Panel>
  );
}
