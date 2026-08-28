import { useMutation, useQuery } from "@tanstack/react-query";
import { LayoutTemplate } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { SUPPORTED_LOCALES } from "~/i18n/locales";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { usePilotFeatures } from "~/lib/feature-flags";
import {
  listEmailTemplates,
  renderEmailTemplate,
} from "~/lib/api/email-templates";

/**
 * "Use template" — the bridge from the shared template library into every
 * existing email surface.
 *
 * Hands the host editor the template's compiled HTML with {{variables}}
 * STILL IN PLACE, so the destination fills them at its own send time against
 * its own real recipient. It used to insert server-RENDERED output built
 * against a fake sample person, which froze "Alex Example" into whatever you
 * inserted into and destroyed every variable in the process.
 */
export function UseTemplatePicker({
  locale,
  onInsert,
  disabled,
  buttonClassName,
  purpose = "marketing",
}: {
  /** Locale to render; falls back through the template's chain server-side. */
  locale?: string;
  onInsert: (template: { subject: string; html: string }) => void;
  disabled?: boolean;
  buttonClassName?: string;
  /**
   * What the host surface sends.
   *
   * "marketing" (campaigns, workflow emails) keeps the unsubscribe footer.
   * "transactional" (form and appointment confirmations, a one-off composed
   * email) strips it: those are replies to something the recipient just did,
   * so an unsubscribe control on them is illogical — and it would be a promise
   * the system does not keep, because transactional sends deliberately ignore
   * the suppression list.
   */
  purpose?: "marketing" | "transactional";
}) {
  const { t } = useTranslation();
  const pilot = usePilotFeatures();
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [pickedLocale, setPickedLocale] = useState(locale ?? "de");

  const { data: templates } = useQuery({
    queryKey: ["email-templates", ""],
    queryFn: () => listEmailTemplates({ page: 1, limit: 100 }),
    enabled: open,
  });

  const insert = useMutation({
    mutationFn: () =>
      renderEmailTemplate(templateId!, { locale: pickedLocale, purpose }),
    onSuccess: (template) => {
      onInsert({ subject: template.subject, html: template.html });
      setOpen(false);
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  /**
   * What you may actually insert.
   *
   * Two rules, both about not handing someone content that will not work:
   *
   * - **Published only.** `current_version === 0` means the template has never
   *   been published — it is somebody's work in progress. Inserting a draft
   *   copies whatever half-finished state it is in, with no indication that it
   *   was not meant to be used yet.
   * - **Has the locale you picked.** Rendering a locale a template does not
   *   define returns an empty subject and body, so offering it can only ever
   *   produce a blank insert.
   */
  const usable = (templates?.data ?? []).filter(
    (template) =>
      template.current_version > 0 &&
      template.complete_locales.includes(pickedLocale),
  );

  // Selecting a template and then switching locale could otherwise leave a
  // selection that is no longer offered, and Insert would render nothing.
  useEffect(() => {
    if (templateId && !usable.some((template) => template.id === templateId)) {
      setTemplateId(null);
    }
  }, [pickedLocale, usable, templateId]);

  // Gated in ONE place rather than at each of the five hosts (workflow email
  // step, form confirmation, appointment confirmation, campaign, composer):
  // the template library is the piloted feature, so wherever it is reachable
  // from, it follows the same flag. Hooks run first — this component must not
  // change hook order between renders.
  if (!pilot.emailCampaigns) return null;

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setPickedLocale(locale ?? "de");
          setOpen(true);
        }}
        className={
          buttonClassName ??
          "inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
        }
      >
        <LayoutTemplate className="h-3.5 w-3.5" />
        {t("emailCampaigns.useTemplate.button", {
          defaultValue: "Use template",
        })}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("emailCampaigns.useTemplate.title", {
                defaultValue: "Insert a template",
              })}
            </DialogTitle>
          </DialogHeader>

          {usable.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
              {/* Distinguish "you have none" from "none in this language" —
                  otherwise switching locale looks like the list broke. */}
              {(templates?.data ?? []).some((x) => x.current_version > 0)
                ? t("emailCampaigns.useTemplate.emptyForLocale", {
                    defaultValue:
                      "No published template has this language yet. Add it in the template, or pick another language.",
                  })
                : t("emailCampaigns.useTemplate.empty", {
                    defaultValue:
                      "No published templates yet — build one under Templates in the sidebar.",
                  })}
            </p>
          ) : (
            <div className="space-y-3">
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {usable.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setTemplateId(template.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      templateId === template.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <span className="truncate">{template.name}</span>
                    <span className="flex shrink-0 gap-1">
                      {template.complete_locales.map((code) => (
                        <span
                          key={code}
                          className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] uppercase text-muted-foreground"
                        >
                          {code}
                        </span>
                      ))}
                    </span>
                  </button>
                ))}
              </div>
              <Select value={pickedLocale} onValueChange={setPickedLocale}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LOCALES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("emailCampaigns.useTemplate.hint", {
                  defaultValue:
                    "Replaces what is in the editor. Variables stay intact and fill in when the email is sent.",
                })}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => insert.mutate()}
              disabled={!templateId || insert.isPending}
            >
              {insert.isPending
                ? t("common.loading", { defaultValue: "Loading…" })
                : t("emailCampaigns.useTemplate.insert", {
                    defaultValue: "Insert",
                  })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
