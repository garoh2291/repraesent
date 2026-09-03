import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import {
  ArrowDown,
  ArrowUp,
  LifeBuoy,
  MousePointerClick,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Cols,
  Panel,
  PanelBody,
  PanelHeader,
  PanelSection,
} from "~/components/forms/chrome";
import { Field, FieldHint } from "~/components/wordpress/fields";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { useAppointmentConfigs } from "~/lib/hooks/useAppointmentConfigs";
import {
  ACTION_SHOW,
  ACTION_TYPES,
  AI_LOCALES,
  EMPTY_FALLBACK_CONTACT,
  type ActionConfig,
  type ActionShow,
  type ActionType,
  type AssistantDraft,
} from "~/lib/api/ai-assistants";
import { cn } from "~/lib/utils";

interface Props {
  draft: AssistantDraft;
  canEdit: boolean;
  onChange: (patch: Partial<AssistantDraft>) => void;
}

const MAX_ACTIONS = 6;

function newAction(type: ActionType): ActionConfig {
  return {
    id: `a${Math.random().toString(36).slice(2, 10)}`,
    type,
    label: "",
    labels: {},
    show: "on_lead_intent",
  };
}

/**
 * CTA chips the widget offers next to an answer (book, call, email, link)
 * plus the contact the assistant falls back to when it cannot answer.
 */
export function ActionsPanel({ draft, canEdit, onChange }: Props) {
  const { t } = useTranslation();
  const actions = draft.actions ?? [];
  const fallback = draft.fallback_contact ?? EMPTY_FALLBACK_CONTACT;
  const [openId, setOpenId] = useState<string | undefined>(undefined);
  const { data: configs } = useAppointmentConfigs(
    canEdit && actions.some((a) => a.type === "book"),
  );

  const setActions = (next: ActionConfig[]) => onChange({ actions: next });
  const update = (id: string, p: Partial<ActionConfig>) =>
    setActions(actions.map((a) => (a.id === id ? { ...a, ...p } : a)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= actions.length) return;
    const next = [...actions];
    [next[i], next[j]] = [next[j], next[i]];
    setActions(next);
  };
  const add = () => {
    if (actions.length >= MAX_ACTIONS) return;
    const a = newAction("link");
    setActions([...actions, a]);
    setOpenId(a.id);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel>
        <PanelHeader
          icon={<MousePointerClick className="h-3.5 w-3.5" />}
          title={t("aiAssistants.actions.title")}
          meta={
            <span className="text-[11px] tabular-nums text-muted-foreground/70">
              {actions.length}/{MAX_ACTIONS}
            </span>
          }
          action={
            canEdit ? (
              <Button
                variant="outline"
                size="sm"
                onClick={add}
                disabled={actions.length >= MAX_ACTIONS}
              >
                <Plus className="h-3.5 w-3.5" />
                {t("aiAssistants.actions.add")}
              </Button>
            ) : null
          }
        />
        <PanelBody>
          <FieldHint>{t("aiAssistants.actions.hint")}</FieldHint>
          {actions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("aiAssistants.actions.empty")}
            </p>
          ) : (
            <Accordion
              type="single"
              collapsible
              value={openId}
              onValueChange={(v) => setOpenId(v || undefined)}
              className="rounded-xl border border-border px-3"
            >
              {actions.map((a, i) => (
                <AccordionItem key={a.id} value={a.id}>
                  <AccordionTrigger className="text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                        {t(`aiAssistants.actions.types.${a.type}`)}
                      </span>
                      <span
                        className={cn(
                          "truncate",
                          !a.label && "italic text-muted-foreground",
                        )}
                      >
                        {a.label || t("aiAssistants.actions.untitled")}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pb-4">
                    <ActionEditor
                      action={a}
                      canEdit={canEdit}
                      configs={configs ?? []}
                      onChange={(p) => update(a.id, p)}
                    />
                    {canEdit ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                          aria-label={t("aiAssistants.actions.moveUp")}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          disabled={i === actions.length - 1}
                          onClick={() => move(i, 1)}
                          aria-label={t("aiAssistants.actions.moveDown")}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto text-destructive hover:text-destructive"
                          onClick={() =>
                            setActions(actions.filter((x) => x.id !== a.id))
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t("common.remove", { defaultValue: "Remove" })}
                        </Button>
                      </div>
                    ) : null}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </PanelBody>
      </Panel>

      <aside className="space-y-4 lg:sticky lg:top-[var(--ai-stick,5.5rem)] lg:self-start">
        <Panel>
          <PanelHeader
            icon={<LifeBuoy className="h-3.5 w-3.5" />}
            title={t("aiAssistants.fallback.title")}
          />
          <PanelBody>
            <FieldHint>{t("aiAssistants.fallback.hint")}</FieldHint>
            <Field>
              <Label htmlFor="fb-phone">
                {t("aiAssistants.fallback.phone")}
              </Label>
              <Input
                id="fb-phone"
                type="tel"
                maxLength={40}
                disabled={!canEdit}
                value={fallback.phone}
                onChange={(e) =>
                  onChange({
                    fallback_contact: { ...fallback, phone: e.target.value },
                  })
                }
              />
            </Field>
            <Field>
              <Label htmlFor="fb-email">
                {t("aiAssistants.fallback.email")}
              </Label>
              <Input
                id="fb-email"
                type="email"
                maxLength={200}
                disabled={!canEdit}
                value={fallback.email}
                onChange={(e) =>
                  onChange({
                    fallback_contact: { ...fallback, email: e.target.value },
                  })
                }
              />
            </Field>
            <Field>
              <Label htmlFor="fb-text">{t("aiAssistants.fallback.text")}</Label>
              <Textarea
                id="fb-text"
                maxLength={200}
                disabled={!canEdit}
                value={fallback.text}
                placeholder={t("aiAssistants.fallback.textPlaceholder")}
                onChange={(e) =>
                  onChange({
                    fallback_contact: { ...fallback, text: e.target.value },
                  })
                }
                className="min-h-[72px]"
              />
            </Field>
          </PanelBody>
        </Panel>
      </aside>
    </div>
  );
}

function ActionEditor({
  action: a,
  canEdit,
  configs,
  onChange,
}: {
  action: ActionConfig;
  canEdit: boolean;
  configs: Array<{
    id: string;
    company_name?: string;
    provider_name?: string | null;
  }>;
  onChange: (p: Partial<ActionConfig>) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Cols>
        <Field>
          <Label>{t("aiAssistants.actions.type")}</Label>
          <Select
            value={a.type}
            disabled={!canEdit}
            onValueChange={(v) => onChange({ type: v as ActionType })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map((ty) => (
                <SelectItem key={ty} value={ty}>
                  {t(`aiAssistants.actions.types.${ty}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <Label htmlFor={`label-${a.id}`}>
            {t("aiAssistants.actions.label")}
          </Label>
          <Input
            id={`label-${a.id}`}
            maxLength={40}
            disabled={!canEdit}
            value={a.label}
            placeholder={t(`aiAssistants.actions.labelPlaceholder.${a.type}`)}
            onChange={(e) => onChange({ label: e.target.value })}
          />
        </Field>
      </Cols>

      {a.type === "link" ? (
        <Field>
          <Label htmlFor={`url-${a.id}`}>{t("aiAssistants.actions.url")}</Label>
          <Input
            id={`url-${a.id}`}
            inputMode="url"
            disabled={!canEdit}
            value={a.url ?? ""}
            placeholder="https://example.com/pricing"
            onChange={(e) => onChange({ url: e.target.value || undefined })}
          />
        </Field>
      ) : a.type === "book" ? (
        <Field>
          <Label>{t("aiAssistants.actions.bookingPage")}</Label>
          <Select
            value={a.config_id ?? ""}
            disabled={!canEdit}
            onValueChange={(v) => onChange({ config_id: v || undefined })}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={t("aiAssistants.actions.bookingPick")}
              />
            </SelectTrigger>
            <SelectContent>
              {configs.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.provider_name || c.company_name || c.id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldHint>
            {configs.length === 0
              ? t("aiAssistants.actions.bookingNone")
              : null}{" "}
            <Link to="/appointments" className="underline">
              {t("aiAssistants.actions.manageBooking")}
            </Link>
          </FieldHint>
        </Field>
      ) : a.type === "call" ? (
        <Field>
          <Label htmlFor={`phone-${a.id}`}>
            {t("aiAssistants.actions.phone")}
          </Label>
          <Input
            id={`phone-${a.id}`}
            type="tel"
            maxLength={40}
            disabled={!canEdit}
            value={a.phone ?? ""}
            placeholder="+49 40 123456"
            onChange={(e) => onChange({ phone: e.target.value || undefined })}
          />
        </Field>
      ) : (
        <Field>
          <Label htmlFor={`email-${a.id}`}>
            {t("aiAssistants.actions.email")}
          </Label>
          <Input
            id={`email-${a.id}`}
            type="email"
            maxLength={200}
            disabled={!canEdit}
            value={a.email ?? ""}
            placeholder="hello@example.com"
            onChange={(e) => onChange({ email: e.target.value || undefined })}
          />
        </Field>
      )}

      <Field>
        <Label>{t("aiAssistants.actions.show")}</Label>
        <Select
          value={a.show}
          disabled={!canEdit}
          onValueChange={(v) => onChange({ show: v as ActionShow })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_SHOW.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`aiAssistants.actions.showOptions.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <PanelSection title={t("aiAssistants.actions.perLocale")}>
        <div className="grid gap-2 @sm:grid-cols-2">
          {AI_LOCALES.map((l) => (
            <div key={l} className="flex items-center gap-2">
              <span className="w-6 font-mono text-[11px] uppercase text-muted-foreground">
                {l}
              </span>
              <Input
                maxLength={40}
                disabled={!canEdit}
                value={a.labels?.[l] ?? ""}
                placeholder={a.label}
                onChange={(e) => {
                  const labels = { ...(a.labels ?? {}) };
                  if (e.target.value.trim()) labels[l] = e.target.value;
                  else delete labels[l];
                  onChange({ labels });
                }}
                className="h-8 text-sm"
              />
            </div>
          ))}
        </div>
      </PanelSection>
    </div>
  );
}
