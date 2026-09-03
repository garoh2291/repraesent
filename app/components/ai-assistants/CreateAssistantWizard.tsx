import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AiKeyBanner } from "~/components/ai-assistants/AiKeyBanner";
import { SourceStatusChip } from "~/components/ai-assistants/SourceStatusChip";
import { WidgetTypeGlyph } from "~/components/ai-assistants/WidgetTypeGlyph";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { FieldHint } from "~/components/wordpress/fields";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  WIDGET_TYPES,
  createAssistant,
  createSource,
  publishAssistant,
  updateAssistant,
  type WidgetType,
} from "~/lib/api/ai-assistants";
import { isWorkspaceAiNotConfigured } from "~/lib/api/workspace-ai";
import { aiKeys, useAiSources } from "~/lib/hooks/useAiAssistants";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "~/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 1 | 2 | 3;

function normalizeUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    return u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Three steps: what it looks like → what it knows → done. The assistant is
 * created at the end of step 2 so step 3 can already show crawl progress.
 */
export function CreateAssistantWizard({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [type, setType] = useState<WidgetType>("bubble");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [keyMissing, setKeyMissing] = useState(false);
  const [published, setPublished] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setName("");
    setType("bubble");
    setDescription("");
    setUrl("");
    setCreatedId(null);
    setKeyMissing(false);
    setPublished(false);
  }, [open]);

  const { data: sources } = useAiSources(createdId ?? undefined);
  const normalizedUrl = normalizeUrl(url);
  const urlInvalid = url.trim().length > 0 && !normalizedUrl;

  const create = async () => {
    setPending(true);
    try {
      const record = await createAssistant({
        name: name.trim(),
        widget_type: type,
      });
      setCreatedId(record.id);
      if (description.trim()) {
        await updateAssistant(record.id, {
          business_description: description.trim(),
        });
      }
      if (normalizedUrl) {
        try {
          await createSource(record.id, {
            type: "website",
            url: normalizedUrl,
            crawl_limit: 25,
            title: new URL(normalizedUrl).hostname.replace(/^www\./, ""),
          });
        } catch (err) {
          if (isWorkspaceAiNotConfigured(err)) setKeyMissing(true);
          else toast.error(extractErrorMessage(err));
        }
      }
      await qc.invalidateQueries({ queryKey: aiKeys.list() });
      setStep(3);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  const publish = async () => {
    if (!createdId) return;
    setPending(true);
    try {
      await publishAssistant(createdId);
      await qc.invalidateQueries({ queryKey: aiKeys.list() });
      setPublished(true);
      toast.success(t("aiAssistants.detail.publishedToast"));
    } catch (err) {
      if (isWorkspaceAiNotConfigured(err)) setKeyMissing(true);
      else toast.error(extractErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("aiAssistants.wizard.title")}</DialogTitle>
          <DialogDescription>
            {t(`aiAssistants.wizard.step${step}Hint`)}
          </DialogDescription>
        </DialogHeader>

        <ol
          className="flex items-center gap-2"
          aria-label={t("aiAssistants.wizard.progress")}
        >
          {([1, 2, 3] as Step[]).map((n) => (
            <li key={n} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                  n < step
                    ? "bg-foreground text-background"
                    : n === step
                      ? "border-2 border-foreground text-foreground"
                      : "border border-border text-muted-foreground",
                )}
                aria-current={n === step ? "step" : undefined}
              >
                {n < step ? <Check className="h-3 w-3" /> : n}
              </span>
              <span
                className={cn(
                  "truncate text-xs",
                  n === step ? "font-medium" : "text-muted-foreground",
                )}
              >
                {t(`aiAssistants.wizard.step${n}`)}
              </span>
              {n < 3 ? (
                <span className="h-px flex-1 bg-border" aria-hidden />
              ) : null}
            </li>
          ))}
        </ol>

        {step === 1 ? (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) setStep(2);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="assistant-name">
                {t("aiAssistants.create.nameLabel")}
              </Label>
              <Input
                id="assistant-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("aiAssistants.create.namePlaceholder")}
                maxLength={80}
              />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                {t("aiAssistants.create.typeLabel")}
              </legend>
              <div
                role="radiogroup"
                className="grid grid-cols-2 gap-3"
                aria-label={t("aiAssistants.create.typeLabel")}
              >
                {WIDGET_TYPES.map((w) => (
                  <button
                    key={w}
                    type="button"
                    role="radio"
                    aria-checked={type === w}
                    onClick={() => setType(w)}
                    className={cn(
                      "flex flex-col gap-3 rounded-xl border p-3 text-left transition-colors",
                      type === w
                        ? "border-foreground/40 bg-muted/60"
                        : "border-border bg-card hover:border-foreground/20",
                    )}
                  >
                    <div
                      aria-hidden
                      className="flex h-16 items-center justify-center rounded-lg border border-border/60 bg-background"
                    >
                      <WidgetTypeGlyph type={w} />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">
                        {t(`aiAssistants.widgetType.${w}`)}
                      </p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {t(`aiAssistants.widgetType.${w}Hint`)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </fieldset>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                {t("common.cancel", { defaultValue: "Cancel" })}
              </Button>
              <Button type="submit" disabled={!name.trim()}>
                {t("aiAssistants.wizard.next")}
              </Button>
            </DialogFooter>
          </form>
        ) : null}

        {step === 2 ? (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!urlInvalid) void create();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="wizard-description">
                {t("aiAssistants.knowledge.descriptionTitle")}
              </Label>
              <Textarea
                id="wizard-description"
                autoFocus
                value={description}
                maxLength={4000}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("aiAssistants.knowledge.descriptionPlaceholder")}
                className="min-h-[110px] leading-relaxed"
              />
              <FieldHint>{t("aiAssistants.wizard.descriptionHint")}</FieldHint>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wizard-url">
                {t("aiAssistants.wizard.website")}
              </Label>
              <Input
                id="wizard-url"
                inputMode="url"
                value={url}
                aria-invalid={urlInvalid || undefined}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
              />
              <FieldHint>{t("aiAssistants.wizard.websiteHint")}</FieldHint>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setStep(1)}
              >
                {t("aiAssistants.wizard.back")}
              </Button>
              <Button type="submit" disabled={pending || urlInvalid}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("aiAssistants.create.submit")}
              </Button>
            </DialogFooter>
          </form>
        ) : null}

        {step === 3 && createdId ? (
          <div className="space-y-5">
            {keyMissing ? <AiKeyBanner /> : null}
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-sm font-medium">
                {t("aiAssistants.wizard.createdTitle", { name: name.trim() })}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("aiAssistants.wizard.createdBody")}
              </p>
              {sources &&
              sources.filter((s) => s.type !== "description").length > 0 ? (
                <ul className="mt-3 space-y-1.5">
                  {sources
                    .filter((s) => s.type !== "description")
                    .map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="truncate">{s.title}</span>
                        <SourceStatusChip status={s.status} />
                      </li>
                    ))}
                </ul>
              ) : null}
            </div>
            <DialogFooter className="sm:justify-between">
              <Button
                variant="ghost"
                onClick={() => go(`/ai-assistants/${createdId}`)}
              >
                {t("aiAssistants.wizard.openEditor")}
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    go(`/ai-assistants/${createdId}?tab=playground`)
                  }
                >
                  {t("aiAssistants.wizard.testIt")}
                </Button>
                <Button
                  disabled={pending || published || keyMissing}
                  onClick={() => void publish()}
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : published ? (
                    <Check className="h-4 w-4" />
                  ) : null}
                  {published
                    ? t("aiAssistants.status.published")
                    : t("aiAssistants.detail.publish")}
                </Button>
              </div>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
