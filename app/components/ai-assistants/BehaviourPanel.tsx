import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Cpu,
  Languages,
  Paperclip,
  MessageSquareText,
  Shield,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  Cols,
  Panel,
  PanelBody,
  PanelHeader,
  PanelSection,
  Segmented,
  SegmentedButton,
} from "~/components/forms/chrome";
import { FieldAnchor } from "~/components/ai-assistants/FieldAnchor";
import { Field, FieldHint } from "~/components/wordpress/fields";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Slider } from "~/components/ui/slider";
import { Checkbox } from "~/components/ui/checkbox";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { useChatModels } from "~/lib/hooks/useAiAssistants";
import { MAX_BUSINESS_NAME } from "~/lib/ai-assistants/validate";
import {
  AI_LOCALES,
  ANSWER_LENGTHS,
  ANSWER_LENGTH_TOKENS,
  type AiLocale,
  type AnswerLength,
  DEFAULT_ATTACHMENTS,
  type AssistantDraft,
  type AttachmentsConfig,
  type PersonaTone,
} from "~/lib/api/ai-assistants";

interface Props {
  draft: AssistantDraft;
  canEdit: boolean;
  onChange: (patch: Partial<AssistantDraft>) => void;
}

const TONES: PersonaTone[] = ["friendly", "formal", "concise"];
const INSTRUCTIONS_MAX = 1000;

export function BehaviourPanel({ draft, canEdit, onChange }: Props) {
  const { t } = useTranslation();
  const { data: models } = useChatModels();
  const persona = draft.persona;
  const setPersona = (p: Partial<AssistantDraft["persona"]>) =>
    onChange({ persona: { ...persona, ...p } });
  const brand = draft.business_profile?.brand_name?.trim() ?? "";
  const detectedName =
    brand && brand !== draft.business_name.trim() ? brand : "";
  const rerank = draft.retrieval?.rerank ?? false;
  const attachments: AttachmentsConfig = {
    ...DEFAULT_ATTACHMENTS,
    ...(draft.attachments ?? {}),
  };
  const setAttachments = (p: Partial<AttachmentsConfig>) =>
    onChange({ attachments: { ...attachments, ...p } });

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel>
        <PanelHeader
          icon={<Cpu className="h-3.5 w-3.5" />}
          title={t("aiAssistants.behaviour.modelTitle")}
        />
        <PanelBody>
          <Field>
            <Label htmlFor="chat-model">
              {t("aiAssistants.behaviour.model")}
            </Label>
            <Select
              value={draft.chat_model}
              disabled={!canEdit}
              onValueChange={(v) => onChange({ chat_model: v })}
            >
              <SelectTrigger id="chat-model" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  models ?? [{ id: draft.chat_model, label: draft.chat_model }]
                ).map((mo) => (
                  <SelectItem key={mo.id} value={mo.id}>
                    {mo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldHint>{t("aiAssistants.behaviour.modelHint")}</FieldHint>
          </Field>

          <Field>
            <div className="flex items-baseline justify-between">
              <Label htmlFor="temperature">
                {t("aiAssistants.behaviour.temperature")}
              </Label>
              <span className="text-sm tabular-nums text-muted-foreground">
                {draft.temperature.toFixed(2)}
              </span>
            </div>
            <Slider
              id="temperature"
              min={0}
              max={1}
              step={0.05}
              disabled={!canEdit}
              value={[draft.temperature]}
              onValueChange={(v) => onChange({ temperature: v[0] ?? 0 })}
            />
            <FieldHint>{t("aiAssistants.behaviour.temperatureHint")}</FieldHint>
          </Field>

          <Field>
            <Label>{t("aiAssistants.behaviour.answerLength.label")}</Label>
            <Segmented label={t("aiAssistants.behaviour.answerLength.label")}>
              {ANSWER_LENGTHS.map((len: AnswerLength) => (
                <SegmentedButton
                  key={len}
                  active={(draft.answer_length ?? "medium") === len}
                  onClick={() => canEdit && onChange({ answer_length: len })}
                >
                  {t(`aiAssistants.behaviour.answerLength.${len}`)}
                </SegmentedButton>
              ))}
            </Segmented>
            <FieldHint>
              {t("aiAssistants.behaviour.answerLength.hint", {
                tokens: ANSWER_LENGTH_TOKENS[draft.answer_length ?? "medium"],
              })}
            </FieldHint>
          </Field>

          <Cols>
            <Field>
              <Label htmlFor="max-tokens">
                {t("aiAssistants.behaviour.maxTokens")}
              </Label>
              <Input
                id="max-tokens"
                type="number"
                min={100}
                max={1500}
                step={50}
                disabled={!canEdit}
                value={draft.max_output_tokens}
                onChange={(e) =>
                  onChange({
                    max_output_tokens: clamp(
                      Number(e.target.value) || 0,
                      100,
                      1500,
                    ),
                  })
                }
              />
              <FieldHint>{t("aiAssistants.behaviour.maxTokensHint")}</FieldHint>
            </Field>
            <Field>
              <Label htmlFor="budget">
                {t("aiAssistants.behaviour.budget")}
              </Label>
              <Input
                id="budget"
                type="number"
                min={0}
                step={1000}
                disabled={!canEdit}
                placeholder={t("aiAssistants.behaviour.budgetUnlimited")}
                value={draft.daily_token_budget ?? ""}
                onChange={(e) =>
                  onChange({
                    daily_token_budget:
                      e.target.value === ""
                        ? null
                        : Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
              <FieldHint>{t("aiAssistants.behaviour.budgetHint")}</FieldHint>
            </Field>
          </Cols>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          icon={<MessageSquareText className="h-3.5 w-3.5" />}
          title={t("aiAssistants.behaviour.personaTitle")}
        />
        <PanelBody>
          <Field>
            <Label htmlFor="business-name">
              {t("aiAssistants.behaviour.businessName")}
            </Label>
            <FieldAnchor path="business_name">
              <Input
                id="business-name"
                value={draft.business_name}
                disabled={!canEdit}
                maxLength={MAX_BUSINESS_NAME}
                onChange={(e) => onChange({ business_name: e.target.value })}
                placeholder={t("aiAssistants.behaviour.businessNamePlaceholder")}
              />
            </FieldAnchor>
            {detectedName ? (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {t("aiAssistants.behaviour.businessNameDetected")}{" "}
                  <span className="font-medium text-foreground">
                    {detectedName}
                  </span>
                </span>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => onChange({ business_name: detectedName })}
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {t("aiAssistants.behaviour.businessNameUse")}
                  </button>
                ) : null}
              </p>
            ) : (
              <FieldHint>{t("aiAssistants.behaviour.businessNameHint")}</FieldHint>
            )}
          </Field>

          <Field>
            <Label>{t("aiAssistants.behaviour.tone")}</Label>
            <RadioGroup
              value={persona.tone}
              disabled={!canEdit}
              onValueChange={(v) => setPersona({ tone: v as PersonaTone })}
              className="grid-cols-3 gap-2"
            >
              {TONES.map((tone) => (
                <label
                  key={tone}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-[[data-state=checked]]:border-foreground/40 has-[[data-state=checked]]:bg-muted/60"
                >
                  <RadioGroupItem value={tone} id={`tone-${tone}`} />
                  {t(`aiAssistants.behaviour.tones.${tone}`)}
                </label>
              ))}
            </RadioGroup>
          </Field>

          <PanelSection title={t("aiAssistants.behaviour.languageTitle")}>
            <RadioGroup
              value={persona.language_mode}
              disabled={!canEdit}
              onValueChange={(v) =>
                setPersona({
                  language_mode: v as "visitor" | "fixed",
                  fixed_locale:
                    v === "fixed"
                      ? (persona.fixed_locale ?? "en")
                      : persona.fixed_locale,
                })
              }
              className="gap-2"
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5 has-[[data-state=checked]]:border-foreground/40 has-[[data-state=checked]]:bg-muted/60">
                <RadioGroupItem value="visitor" className="mt-0.5" />
                <span className="space-y-0.5">
                  <span className="block text-sm">
                    {t("aiAssistants.behaviour.languageVisitor")}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t("aiAssistants.behaviour.languageVisitorHint")}
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5 has-[[data-state=checked]]:border-foreground/40 has-[[data-state=checked]]:bg-muted/60">
                <RadioGroupItem value="fixed" className="mt-0.5" />
                <span className="flex-1 space-y-2">
                  <span className="block text-sm">
                    {t("aiAssistants.behaviour.languageFixed")}
                  </span>
                  {persona.language_mode === "fixed" ? (
                    <Select
                      value={persona.fixed_locale ?? "en"}
                      disabled={!canEdit}
                      onValueChange={(v) =>
                        setPersona({ fixed_locale: v as AiLocale })
                      }
                    >
                      <SelectTrigger className="h-8 w-40">
                        <Languages className="h-3.5 w-3.5" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AI_LOCALES.map((l) => (
                          <SelectItem key={l} value={l}>
                            {t(`aiAssistants.locales.${l}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </span>
              </label>
            </RadioGroup>
          </PanelSection>

          <PanelSection title={t("aiAssistants.behaviour.instructionsTitle")}>
            <FieldAnchor path="persona.custom_instructions">
              <Textarea
                value={persona.custom_instructions}
                disabled={!canEdit}
                maxLength={INSTRUCTIONS_MAX}
                onChange={(e) =>
                  setPersona({ custom_instructions: e.target.value })
                }
                placeholder={t(
                  "aiAssistants.behaviour.instructionsPlaceholder",
                )}
                className="min-h-[120px] leading-relaxed"
              />
            </FieldAnchor>
            <div className="flex items-baseline justify-between gap-3">
              <FieldHint>
                {t("aiAssistants.behaviour.instructionsHint")}
              </FieldHint>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {persona.custom_instructions.length} / {INSTRUCTIONS_MAX}
              </span>
            </div>
          </PanelSection>
        </PanelBody>
      </Panel>

      <Panel className="lg:col-span-2">
        <PanelHeader
          icon={<Shield className="h-3.5 w-3.5" />}
          title={t("aiAssistants.behaviour.domainsTitle")}
        />
        <PanelBody>
          <FieldHint>{t("aiAssistants.behaviour.domainsHint")}</FieldHint>
          <FieldAnchor path="allowed_domains">
            <DomainTagInput
              value={draft.allowed_domains}
              disabled={!canEdit}
              onChange={(allowed_domains) => onChange({ allowed_domains })}
            />
          </FieldAnchor>
        </PanelBody>
      </Panel>

      <Panel className="lg:col-span-2">
        <PanelHeader
          icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
          title={t("aiAssistants.behaviour.advancedTitle")}
        />
        <PanelBody>
          <FieldAnchor path="retrieval.rerank">
            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
              <span className="space-y-0.5">
                <span className="block text-sm">
                  {t("aiAssistants.behaviour.rerank")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t("aiAssistants.behaviour.rerankHint")}
                </span>
              </span>
              <Switch
                checked={rerank}
                disabled={!canEdit}
                onCheckedChange={(v) =>
                  onChange({ retrieval: { ...draft.retrieval, rerank: v } })
                }
                aria-label={t("aiAssistants.behaviour.rerank")}
                className="mt-0.5"
              />
            </label>
          </FieldAnchor>

          <FieldAnchor path="attachments.enabled">
            <div className="rounded-lg border border-border">
              <label className="flex cursor-pointer items-start justify-between gap-4 px-3 py-2.5">
                <span className="space-y-0.5">
                  <span className="flex items-center gap-1.5 text-sm">
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                    {t("aiAssistants.behaviour.attachmentsEnabled")}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t("aiAssistants.behaviour.attachmentsHint")}
                  </span>
                </span>
                <Switch
                  checked={attachments.enabled}
                  disabled={!canEdit}
                  onCheckedChange={(v) => setAttachments({ enabled: v })}
                  aria-label={t("aiAssistants.behaviour.attachmentsEnabled")}
                  className="mt-0.5"
                />
              </label>
              <div
                className={cn(
                  "grid gap-2 border-t border-border px-3 py-2.5 sm:grid-cols-2",
                  !attachments.enabled && "opacity-50",
                )}
              >
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={attachments.images}
                    disabled={!canEdit || !attachments.enabled}
                    onCheckedChange={(v) =>
                      setAttachments({ images: v === true })
                    }
                  />
                  {t("aiAssistants.behaviour.attachmentsImages")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={attachments.documents}
                    disabled={!canEdit || !attachments.enabled}
                    onCheckedChange={(v) =>
                      setAttachments({ documents: v === true })
                    }
                  />
                  {t("aiAssistants.behaviour.attachmentsDocuments")}
                </label>
              </div>
            </div>
          </FieldAnchor>
        </PanelBody>
      </Panel>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function normalizeHost(raw: string): string | null {
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  s = s
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
  if (!/^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(s)) return null;
  return s;
}

function DomainTagInput({
  value,
  disabled,
  onChange,
}: {
  value: string[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [invalid, setInvalid] = useState(false);

  const commit = () => {
    const host = normalizeHost(input);
    if (!host) {
      setInvalid(input.trim().length > 0);
      return;
    }
    if (!value.includes(host)) onChange([...value, host]);
    setInput("");
    setInvalid(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1.5 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        {value.map((d) => (
          <span
            key={d}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-xs"
          >
            {d}
            {!disabled ? (
              <button
                type="button"
                aria-label={`${t("common.remove", { defaultValue: "Remove" })} ${d}`}
                onClick={() => onChange(value.filter((x) => x !== d))}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </span>
        ))}
        <input
          value={input}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onChange={(e) => {
            setInput(e.target.value);
            setInvalid(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "," || e.key === " ") {
              e.preventDefault();
              commit();
            } else if (e.key === "Backspace" && !input && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={commit}
          placeholder={
            value.length ? "" : t("aiAssistants.behaviour.domainsPlaceholder")
          }
          className="min-w-[10rem] flex-1 bg-transparent px-1 py-0.5 font-mono text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {invalid ? (
        <p className="text-xs text-red-600 dark:text-red-400">
          {t("aiAssistants.behaviour.domainsInvalid")}
        </p>
      ) : (
        <FieldHint>{t("aiAssistants.behaviour.domainsEmpty")}</FieldHint>
      )}
    </div>
  );
}
