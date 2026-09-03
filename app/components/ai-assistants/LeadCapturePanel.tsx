import { useTranslation } from "react-i18next";
import { Contact, Sparkles } from "lucide-react";
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelSection,
} from "~/components/forms/chrome";
import { Field, FieldHint, InfoNote } from "~/components/wordpress/fields";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { DEFAULT_STRINGS } from "~/lib/api/ai-assistants";
import {
  LEAD_FIELD_KEYS,
  type AssistantDraft,
  type LeadCaptureConfig,
  type LeadFieldKey,
} from "~/lib/api/ai-assistants";

interface Props {
  draft: AssistantDraft;
  canEdit: boolean;
  onChange: (patch: Partial<AssistantDraft>) => void;
}

export function LeadCapturePanel({ draft, canEdit, onChange }: Props) {
  const { t } = useTranslation();
  const lc = draft.lead_capture;
  const set = (p: Partial<LeadCaptureConfig>) =>
    onChange({ lead_capture: { ...lc, ...p } });

  const fieldState = (key: LeadFieldKey) =>
    lc.fields.find((f) => f.key === key);

  const toggleField = (key: LeadFieldKey, on: boolean) => {
    const others = lc.fields.filter((f) => f.key !== key);
    // Keep the canonical order so the card the visitor sees is stable.
    const next = on ? [...others, { key, required: false }] : others;
    set({
      fields: LEAD_FIELD_KEYS.map((k) => next.find((f) => f.key === k)).filter(
        (f): f is LeadCaptureConfig["fields"][number] => !!f,
      ),
    });
  };

  const setRequired = (key: LeadFieldKey, required: boolean) =>
    set({
      fields: lc.fields.map((f) => (f.key === key ? { ...f, required } : f)),
    });

  const disabled = !canEdit || !lc.enabled;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel>
        <PanelHeader
          icon={<Contact className="h-3.5 w-3.5" />}
          title={t("aiAssistants.leads.title")}
          action={
            <div className="flex items-center gap-2">
              <Label
                htmlFor="lead-enabled"
                className="text-xs font-normal text-muted-foreground"
              >
                {lc.enabled
                  ? t("aiAssistants.leads.on")
                  : t("aiAssistants.leads.off")}
              </Label>
              <Switch
                id="lead-enabled"
                checked={lc.enabled}
                disabled={!canEdit}
                onCheckedChange={(enabled) => set({ enabled })}
              />
            </div>
          }
        />
        <PanelBody>
          <PanelSection title={t("aiAssistants.leads.fieldsTitle")}>
            <ul className="divide-y divide-border/70 rounded-xl border border-border">
              {LEAD_FIELD_KEYS.map((key) => {
                const state = fieldState(key);
                const id = `lead-field-${key}`;
                return (
                  <li key={key} className="flex items-center gap-3 px-3 py-2.5">
                    <Checkbox
                      id={id}
                      checked={!!state}
                      disabled={disabled}
                      onCheckedChange={(v) => toggleField(key, v === true)}
                    />
                    <Label htmlFor={id} className="flex-1 font-normal">
                      {t(`aiAssistants.leads.fields.${key}`)}
                    </Label>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      {t("aiAssistants.leads.required")}
                      <Switch
                        checked={state?.required ?? false}
                        disabled={disabled || !state}
                        onCheckedChange={(v) => setRequired(key, v)}
                        className="scale-90"
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
          </PanelSection>

          <PanelSection title={t("aiAssistants.leads.triggersTitle")}>
            <div className="flex items-start justify-between gap-4 rounded-xl border border-border px-3 py-2.5">
              <div className="space-y-0.5">
                <Label htmlFor="trigger-intent" className="font-normal">
                  {t("aiAssistants.leads.onIntent")}
                </Label>
                <FieldHint>{t("aiAssistants.leads.onIntentHint")}</FieldHint>
              </div>
              <Switch
                id="trigger-intent"
                checked={lc.trigger.on_intent}
                disabled={disabled}
                onCheckedChange={(on_intent) =>
                  set({ trigger: { ...lc.trigger, on_intent } })
                }
              />
            </div>
            <div className="flex items-start justify-between gap-4 rounded-xl border border-border px-3 py-2.5">
              <div className="space-y-0.5">
                <Label htmlFor="trigger-turns" className="font-normal">
                  {t("aiAssistants.leads.afterTurns")}
                </Label>
                <FieldHint>{t("aiAssistants.leads.afterTurnsHint")}</FieldHint>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={lc.trigger.after_turns != null}
                  disabled={disabled}
                  aria-label={t("aiAssistants.leads.afterTurns")}
                  onCheckedChange={(on) =>
                    set({
                      trigger: { ...lc.trigger, after_turns: on ? 3 : null },
                    })
                  }
                />
                <Input
                  id="trigger-turns"
                  type="number"
                  min={1}
                  max={20}
                  disabled={disabled || lc.trigger.after_turns == null}
                  value={lc.trigger.after_turns ?? ""}
                  onChange={(e) =>
                    set({
                      trigger: {
                        ...lc.trigger,
                        after_turns: Math.min(
                          20,
                          Math.max(1, Number(e.target.value) || 1),
                        ),
                      },
                    })
                  }
                  className="h-8 w-16 text-center tabular-nums"
                />
              </div>
            </div>
          </PanelSection>

          <PanelSection title={t("aiAssistants.leads.copyTitle")}>
            <Field>
              <Label htmlFor="lead-intro">
                {t("aiAssistants.leads.intro")}
              </Label>
              <Textarea
                id="lead-intro"
                disabled={disabled}
                value={lc.intro_text}
                maxLength={400}
                onChange={(e) => set({ intro_text: e.target.value })}
                placeholder={DEFAULT_STRINGS.en.lead_intro}
                className="min-h-[72px]"
              />
            </Field>
            <Field>
              <Label htmlFor="lead-thanks">
                {t("aiAssistants.leads.thanks")}
              </Label>
              <Textarea
                id="lead-thanks"
                disabled={disabled}
                value={lc.thank_you_text}
                maxLength={400}
                onChange={(e) => set({ thank_you_text: e.target.value })}
                placeholder={DEFAULT_STRINGS.en.lead_thanks}
                className="min-h-[72px]"
              />
            </Field>
            <FieldHint>{t("aiAssistants.leads.copyHint")}</FieldHint>
          </PanelSection>
        </PanelBody>
      </Panel>

      <aside className="space-y-4 lg:sticky lg:top-[var(--ai-stick,5.5rem)] lg:self-start">
        <Panel>
          <PanelHeader
            icon={<Sparkles className="h-3.5 w-3.5" />}
            title={t("aiAssistants.leads.howTitle")}
          />
          <PanelBody className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>{t("aiAssistants.leads.how1")}</p>
            <p>{t("aiAssistants.leads.how2")}</p>
            <p>{t("aiAssistants.leads.how3")}</p>
          </PanelBody>
        </Panel>
        <InfoNote>{t("aiAssistants.leads.note")}</InfoNote>
      </aside>
    </div>
  );
}
