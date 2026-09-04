import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import {
  Cols,
  GhostAction,
  Panel,
  PanelBody,
  PanelHeader,
  PanelSection,
} from "~/components/forms/chrome";
import { FieldAnchor } from "~/components/ai-assistants/FieldAnchor";
import { relativeTime } from "~/components/ai-assistants/SourceRow";
import { Field, FieldHint } from "~/components/wordpress/fields";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { isWorkspaceAiNotConfigured } from "~/lib/api/workspace-ai";
import { MAX_KEY_PEOPLE } from "~/lib/ai-assistants/validate";
import {
  isNoKnowledgeError,
  regenerateBusinessProfile,
  withProfileDefaults,
  type AssistantDraft,
  type AssistantRecord,
  type BusinessProfile,
  type BusinessProfileMode,
} from "~/lib/api/ai-assistants";
import { aiKeys } from "~/lib/hooks/useAiAssistants";
import { cn } from "~/lib/utils";

interface Props {
  assistantId: string;
  canEdit: boolean;
  draft: AssistantDraft;
  onChange: (patch: Partial<AssistantDraft>) => void;
  /** From the SAVED record — the status line describes what the server holds. */
  mode: BusinessProfileMode;
  updatedAt: string | null;
  onRegenerated: (record: AssistantRecord) => void;
}

/**
 * The facts the assistant states as authoritative: who you are, where, how to
 * reach you. Auto-filled from the crawl, every field editable; edits ride the
 * main draft so autosave + republish-on-save apply like any other setting.
 */
export function BusinessFactsCard({
  assistantId,
  canEdit,
  draft,
  onChange,
  mode,
  updatedAt,
  onRegenerated,
}: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const profile = withProfileDefaults(draft.business_profile);
  const set = (p: Partial<BusinessProfile>) =>
    onChange({ business_profile: { ...profile, ...p } });
  const setReg = (p: Partial<BusinessProfile["registration"]>) =>
    set({ registration: { ...profile.registration, ...p } });

  const regenerate = useMutation({
    mutationFn: () => regenerateBusinessProfile(assistantId),
    onSuccess: (record) => {
      qc.setQueryData(aiKeys.detail(assistantId), record);
      onRegenerated(record);
      toast.success(t("aiAssistants.facts.regenerated"));
    },
    onError: (error) => {
      if (isWorkspaceAiNotConfigured(error)) {
        toast.error(t("aiAssistants.banner.title"), {
          description: t("aiAssistants.banner.body"),
          action: {
            label: t("aiAssistants.banner.openSettings"),
            onClick: () => navigate("/settings/ai"),
          },
        });
        return;
      }
      if (isNoKnowledgeError(error)) {
        toast.error(t("aiAssistants.facts.noKnowledgeTitle"), {
          description: t("aiAssistants.facts.noKnowledgeBody"),
        });
        return;
      }
      toast.error(t("aiAssistants.facts.regenerateFailed"), {
        description: extractErrorMessage(error),
      });
    },
  });

  const status =
    mode === "edited"
      ? t("aiAssistants.facts.statusEdited")
      : updatedAt
        ? t("aiAssistants.facts.statusExtracted", {
            when: relativeTime(updatedAt, i18n.language),
          })
        : t("aiAssistants.facts.statusEmpty");
  const isEmpty = mode !== "edited" && !updatedAt && isBlank(profile);

  return (
    <Panel>
      <PanelHeader
        icon={<Building2 className="h-3.5 w-3.5" />}
        title={t("aiAssistants.facts.title")}
        meta={
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
            <span
              aria-hidden
              className={cn(
                "size-1.5 rounded-full",
                mode === "edited"
                  ? "bg-foreground/60"
                  : updatedAt
                    ? "bg-emerald-500"
                    : "bg-muted-foreground/40",
              )}
            />
            {status}
          </span>
        }
        action={
          canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={regenerate.isPending}
              onClick={() => regenerate.mutate()}
            >
              {regenerate.isPending ? null : <RefreshCw className="h-3.5 w-3.5" />}
              {t("aiAssistants.facts.regenerate")}
            </Button>
          ) : null
        }
      />
      <PanelBody>
        <FieldHint>
          {isEmpty
            ? t("aiAssistants.facts.emptyHint")
            : t("aiAssistants.facts.hint")}
        </FieldHint>

        <PanelSection title={t("aiAssistants.facts.groups.identity")}>
          <Cols>
            <TextField
              id="bf-brand"
              label={t("aiAssistants.facts.fields.brand_name")}
              value={profile.brand_name}
              disabled={!canEdit}
              onChange={(v) => set({ brand_name: v })}
            />
            <TextField
              id="bf-legal"
              label={t("aiAssistants.facts.fields.legal_name")}
              value={profile.legal_name}
              disabled={!canEdit}
              onChange={(v) => set({ legal_name: v })}
            />
          </Cols>
          <Cols>
            <TextField
              id="bf-tagline"
              label={t("aiAssistants.facts.fields.tagline")}
              value={profile.tagline}
              disabled={!canEdit}
              onChange={(v) => set({ tagline: v })}
            />
            <TextField
              id="bf-founded"
              label={t("aiAssistants.facts.fields.founded")}
              value={profile.founded}
              disabled={!canEdit}
              onChange={(v) => set({ founded: v })}
            />
          </Cols>
        </PanelSection>

        <PanelSection title={t("aiAssistants.facts.groups.where")}>
          <Field>
            <Label htmlFor="bf-address">
              {t("aiAssistants.facts.fields.address")}
            </Label>
            <Textarea
              id="bf-address"
              value={profile.address}
              disabled={!canEdit}
              onChange={(e) => set({ address: e.target.value })}
              className="min-h-[64px] leading-relaxed"
              maxLength={400}
            />
          </Field>
          <Field>
            <Label>{t("aiAssistants.facts.fields.locations")}</Label>
            <TagInput
              value={profile.locations}
              disabled={!canEdit}
              onChange={(locations) => set({ locations })}
              placeholder={t("aiAssistants.facts.placeholders.locations")}
            />
          </Field>
          <Field>
            <Label htmlFor="bf-hours">
              {t("aiAssistants.facts.fields.opening_hours")}
            </Label>
            <Textarea
              id="bf-hours"
              value={profile.opening_hours}
              disabled={!canEdit}
              onChange={(e) => set({ opening_hours: e.target.value })}
              placeholder={t("aiAssistants.facts.placeholders.opening_hours")}
              className="min-h-[64px] leading-relaxed"
              maxLength={400}
            />
          </Field>
        </PanelSection>

        <PanelSection title={t("aiAssistants.facts.groups.registration")}>
          <Cols>
            <TextField
              id="bf-court"
              label={t("aiAssistants.facts.fields.court")}
              value={profile.registration.court}
              disabled={!canEdit}
              onChange={(v) => setReg({ court: v })}
            />
            <TextField
              id="bf-regno"
              label={t("aiAssistants.facts.fields.number")}
              value={profile.registration.number}
              disabled={!canEdit}
              mono
              onChange={(v) => setReg({ number: v })}
            />
          </Cols>
          <Cols>
            <TextField
              id="bf-vat"
              label={t("aiAssistants.facts.fields.vat_id")}
              value={profile.registration.vat_id}
              disabled={!canEdit}
              mono
              onChange={(v) => setReg({ vat_id: v })}
            />
            <TextField
              id="bf-ein"
              label={t("aiAssistants.facts.fields.ein")}
              value={profile.registration.ein}
              disabled={!canEdit}
              mono
              onChange={(v) => setReg({ ein: v })}
            />
          </Cols>
        </PanelSection>

        <PanelSection title={t("aiAssistants.facts.groups.contact")}>
          <Cols>
            <TextField
              id="bf-phone"
              label={t("aiAssistants.facts.fields.phone")}
              value={profile.phone}
              disabled={!canEdit}
              inputMode="tel"
              onChange={(v) => set({ phone: v })}
            />
            <Field>
              <Label htmlFor="bf-email">
                {t("aiAssistants.facts.fields.email")}
              </Label>
              <FieldAnchor path="business_profile.email">
                <Input
                  id="bf-email"
                  type="email"
                  inputMode="email"
                  value={profile.email}
                  disabled={!canEdit}
                  onChange={(e) => set({ email: e.target.value })}
                />
              </FieldAnchor>
            </Field>
          </Cols>
        </PanelSection>

        <PanelSection title={t("aiAssistants.facts.groups.offer")}>
          <Cols>
            <LinesField
              id="bf-services"
              label={t("aiAssistants.facts.fields.services")}
              hint={t("aiAssistants.facts.onePerLine")}
              value={profile.services}
              disabled={!canEdit}
              onChange={(services) => set({ services })}
            />
            <LinesField
              id="bf-pricing"
              label={t("aiAssistants.facts.fields.pricing")}
              hint={t("aiAssistants.facts.onePerLine")}
              value={profile.pricing}
              disabled={!canEdit}
              onChange={(pricing) => set({ pricing })}
            />
          </Cols>
        </PanelSection>

        <PanelSection
          title={t("aiAssistants.facts.groups.people")}
          action={
            canEdit && profile.key_people.length < MAX_KEY_PEOPLE ? (
              <GhostAction
                className="h-7 px-2 text-xs"
                onClick={() =>
                  set({
                    key_people: [...profile.key_people, { name: "", role: "" }],
                  })
                }
              >
                <Plus className="h-3.5 w-3.5" />
                {t("aiAssistants.facts.addPerson")}
              </GhostAction>
            ) : null
          }
        >
          <FieldAnchor path="business_profile.key_people">
            {profile.key_people.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("aiAssistants.facts.noPeople")}
              </p>
            ) : (
              <ul className="space-y-2">
                {profile.key_people.map((person, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Input
                      value={person.name}
                      disabled={!canEdit}
                      aria-label={t("aiAssistants.facts.fields.personName")}
                      placeholder={t("aiAssistants.facts.fields.personName")}
                      onChange={(e) =>
                        set({
                          key_people: profile.key_people.map((p, j) =>
                            j === i ? { ...p, name: e.target.value } : p,
                          ),
                        })
                      }
                    />
                    <Input
                      value={person.role}
                      disabled={!canEdit}
                      aria-label={t("aiAssistants.facts.fields.personRole")}
                      placeholder={t("aiAssistants.facts.fields.personRole")}
                      onChange={(e) =>
                        set({
                          key_people: profile.key_people.map((p, j) =>
                            j === i ? { ...p, role: e.target.value } : p,
                          ),
                        })
                      }
                    />
                    {canEdit ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground"
                        aria-label={t("common.remove", {
                          defaultValue: "Remove",
                        })}
                        onClick={() =>
                          set({
                            key_people: profile.key_people.filter(
                              (_, j) => j !== i,
                            ),
                          })
                        }
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </FieldAnchor>
        </PanelSection>

        <PanelSection title={t("aiAssistants.facts.groups.languages")}>
          <TagInput
            value={profile.languages}
            disabled={!canEdit}
            onChange={(languages) => set({ languages })}
            placeholder={t("aiAssistants.facts.placeholders.languages")}
          />
        </PanelSection>

        <PanelSection title={t("aiAssistants.facts.groups.notes")}>
          <Textarea
            value={profile.notes}
            disabled={!canEdit}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder={t("aiAssistants.facts.placeholders.notes")}
            className="min-h-[80px] leading-relaxed"
            maxLength={1000}
          />
        </PanelSection>
      </PanelBody>
    </Panel>
  );
}

function isBlank(p: BusinessProfile): boolean {
  return (
    !p.brand_name &&
    !p.legal_name &&
    !p.tagline &&
    !p.address &&
    !p.phone &&
    !p.email &&
    !p.opening_hours &&
    !p.founded &&
    !p.notes &&
    !Object.values(p.registration).some(Boolean) &&
    p.languages.length + p.locations.length + p.services.length === 0 &&
    p.pricing.length + p.key_people.length === 0
  );
}

// --- small controls ----------------------------------------------------------

function TextField({
  id,
  label,
  value,
  disabled,
  mono,
  inputMode,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  disabled?: boolean;
  mono?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        disabled={disabled}
        inputMode={inputMode}
        maxLength={200}
        onChange={(e) => onChange(e.target.value)}
        className={mono ? "font-mono text-sm" : undefined}
      />
    </Field>
  );
}

/** One item per line. Local text state so a trailing newline survives typing. */
function LinesField({
  id,
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string[];
  disabled?: boolean;
  onChange: (lines: string[]) => void;
}) {
  const [text, setText] = useState(value.join("\n"));
  useEffect(() => {
    const joined = value.join("\n");
    if (joined !== parseLines(text).join("\n")) setText(joined);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Field>
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={text}
        disabled={disabled}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseLines(e.target.value));
        }}
        className="min-h-[96px] leading-relaxed"
        maxLength={2000}
      />
      <FieldHint>{hint}</FieldHint>
    </Field>
  );
}

function parseLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function TagInput({
  value,
  disabled,
  placeholder,
  onChange,
}: {
  value: string[];
  disabled?: boolean;
  placeholder?: string;
  onChange: (next: string[]) => void;
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const commit = () => {
    const v = input.trim().replace(/,$/, "").trim();
    if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    setInput("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1.5 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs"
        >
          {tag}
          {!disabled ? (
            <button
              type="button"
              aria-label={`${t("common.remove", { defaultValue: "Remove" })} ${tag}`}
              onClick={() => onChange(value.filter((x) => x !== tag))}
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
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !input && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={value.length ? "" : placeholder}
        className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
