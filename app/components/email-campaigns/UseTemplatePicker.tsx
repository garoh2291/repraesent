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
  locales,
  onInsert,
  onInsertLocales,
  templateHref,
  disabled,
  buttonClassName,
  purpose = "marketing",
}: {
  /** Locale to render; falls back through the template's chain server-side. */
  locale?: string;
  /**
   * Every language the host stores copy for.
   *
   * When given (with `onInsertLocales`), the picker fills them ALL in one go
   * and says which ones the template cannot cover. A form offered in DE, FR and
   * NL used to get whichever single language you happened to be looking at,
   * silently leaving the other two on whatever was there before.
   */
  locales?: string[];
  onInsert: (template: { subject: string; html: string }) => void;
  /** Receives one entry per language the template could actually cover. */
  onInsertLocales?: (
    byLocale: Record<string, { subject: string; html: string }>,
  ) => void;
  /** Where "add this language to the template" should send the user. */
  templateHref?: (templateId: string) => string;
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

  /**
   * Set while resolving ONE language of a multi-language host — the "use a
   * different template for French" path. Null means "all of them".
   */
  const [focusLocale, setFocusLocale] = useState<string | null>(null);

  /** Languages this insert is responsible for. */
  const wantedLocales = focusLocale
    ? [focusLocale]
    : (locales?.length ? locales : [pickedLocale]);

  const selected = (templates?.data ?? []).find((x) => x.id === templateId);
  const covered = wantedLocales.filter((code) =>
    selected?.complete_locales.includes(code),
  );
  const uncovered = wantedLocales.filter(
    (code) => !selected?.complete_locales.includes(code),
  );

  const multi = !!locales?.length && !!onInsertLocales;

  const insert = useMutation({
    mutationFn: async () => {
      const targets = multi ? covered : [focusLocale ?? pickedLocale];
      const rendered = await Promise.all(
        targets.map(async (code) => ({
          locale: code,
          result: await renderEmailTemplate(templateId!, {
            locale: code,
            purpose,
          }),
        })),
      );

      /**
       * Refuse rather than blank. `contentForInsert` answers a locale the
       * template does not define with empty strings and `locale_complete:
       * false` — which, inserted, silently wipes the subject and body the
       * operator already had. The picker's own filter usually prevents it, but
       * not against a cached list or a template unpublished mid-dialog. The
       * test-send path already refuses this; so does this now.
       */
      const blank = rendered.filter(({ result }) => !result.locale_complete);
      if (blank.length > 0) {
        throw new Error(
          t("emailCampaigns.useTemplate.wentBlank", {
            defaultValue:
              "This template no longer has {{locales}}. Nothing was replaced — reopen and pick again.",
            locales: blank.map((x) => x.locale.toUpperCase()).join(", "),
          }),
        );
      }
      return rendered;
    },
    onSuccess: (rendered) => {
      if (multi && onInsertLocales) {
        onInsertLocales(
          Object.fromEntries(
            rendered.map(({ locale: code, result }) => [
              code,
              { subject: result.subject, html: result.html },
            ]),
          ),
        );
      } else {
        const only = rendered[0];
        if (only) {
          onInsert({ subject: only.result.subject, html: only.result.html });
        }
      }
      setOpen(false);
      setFocusLocale(null);
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
  const usable = (templates?.data ?? []).filter((template) => {
    if (template.current_version <= 0) return false;
    // Filling several languages at once: anything covering at least one of them
    // is worth offering, and the gap is named before you commit. Requiring full
    // coverage would hide the template AND the reason it was hidden.
    if (focusLocale) return template.complete_locales.includes(focusLocale);
    if (multi) {
      return locales!.some((code) => template.complete_locales.includes(code));
    }
    return template.complete_locales.includes(pickedLocale);
  });

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
          setFocusLocale(null);
          setTemplateId(null);
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
                    {/* Against the languages THIS host needs, not the
                        template's own list — so a gap is visible before you
                        pick, not after. */}
                    <span className="flex shrink-0 gap-1">
                      {(multi || focusLocale
                        ? wantedLocales
                        : template.complete_locales
                      ).map((code) => {
                        const has = template.complete_locales.includes(code);
                        return (
                          <span
                            key={code}
                            className={
                              has
                                ? "rounded bg-muted px-1 py-0.5 font-mono text-[10px] uppercase text-muted-foreground"
                                : "rounded px-1 py-0.5 font-mono text-[10px] uppercase text-muted-foreground/40 line-through"
                            }
                          >
                            {code}
                          </span>
                        );
                      })}
                    </span>
                  </button>
                ))}
              </div>

              {/* One language at a time only where that is the actual model.
                  Constrained to the host's languages — it used to offer all
                  four, so you could stand in the Dutch tab and paste French
                  into it. */}
              {!multi || focusLocale ? (
                <Select
                  value={focusLocale ?? pickedLocale}
                  onValueChange={focusLocale ? setFocusLocale : setPickedLocale}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(locales?.length ? locales : SUPPORTED_LOCALES).map(
                      (code) => (
                        <SelectItem key={code} value={code}>
                          {code.toUpperCase()}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              ) : null}

              {/* Say what Insert will do, and to which languages, before it
                  does it. */}
              {selected && multi ? (
                <div className="space-y-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-xs">
                  <p className="text-foreground">
                    {covered.length > 0
                      ? t("emailCampaigns.useTemplate.willReplace", {
                          defaultValue: "Replaces the copy in {{locales}}.",
                          locales: covered
                            .map((code) => code.toUpperCase())
                            .join(", "),
                        })
                      : t("emailCampaigns.useTemplate.coversNothing", {
                          defaultValue:
                            "This template has none of your languages.",
                        })}
                  </p>

                  {uncovered.length > 0 ? (
                    <>
                      <p className="text-amber-700 dark:text-amber-500">
                        {t("emailCampaigns.useTemplate.missingLocales", {
                          defaultValue:
                            "It has no {{locales}}, so that language is left as it is.",
                          locales: uncovered
                            .map((code) => code.toUpperCase())
                            .join(", "),
                        })}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => setFocusLocale(uncovered[0])}
                          className="rounded-md border border-border bg-background px-2 py-1 font-medium transition-colors hover:bg-muted"
                        >
                          {t("emailCampaigns.useTemplate.otherTemplateFor", {
                            defaultValue:
                              "Use a different template for {{locale}}",
                            locale: uncovered[0].toUpperCase(),
                          })}
                        </button>
                        {templateHref ? (
                          <a
                            href={templateHref(selected.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-border bg-background px-2 py-1 font-medium transition-colors hover:bg-muted"
                          >
                            {t("emailCampaigns.useTemplate.addLocaleTo", {
                              defaultValue: "Add {{locale}} to this template",
                              locale: uncovered[0].toUpperCase(),
                            })}
                          </a>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}

              {focusLocale ? (
                <button
                  type="button"
                  onClick={() => {
                    setFocusLocale(null);
                    setTemplateId(null);
                  }}
                  className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
                >
                  {t("emailCampaigns.useTemplate.backToAll", {
                    defaultValue: "Back to all languages",
                  })}
                </button>
              ) : null}

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
              // Nothing to write is not a valid Insert — it would close the
              // dialog having done nothing at all.
              disabled={
                !templateId ||
                insert.isPending ||
                (multi && covered.length === 0)
              }
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
