import { useQuery } from "@tanstack/react-query";
import { Check, Code2, Eye, Loader2, Mail, Save } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import {
  GhostAction,
  Panel,
  PanelBody,
  PanelHeader,
  PanelSection,
  Segmented,
  SegmentedButton,
} from "~/components/forms/chrome";
import { UseTemplatePicker } from "~/components/email-campaigns/UseTemplatePicker";
import { Field, FieldHint, ToggleField } from "~/components/wordpress/fields";
import { sortAccountsWithAliases } from "~/lib/api/email-accounts";
import { listEmailAccounts } from "~/lib/api/workspaces";
import {
  defaultConfirmationEmail,
  isEmptyConfirmationCopy,
} from "~/lib/forms/email-template";
import {
  flattenFields,
  isPresentational,
  type FormConfirmationEmail,
  type FormDefinition,
  type FormLocale,
} from "~/lib/forms/schema";

const DEFAULT_ACCOUNT = "__default__";

/** Always available, whatever the form contains. */
const BASE_VARIABLES = [
  "name",
  "first_name",
  "last_name",
  "email",
  "phone",
  "form_name",
];

interface Props {
  definition: FormDefinition;
  locales: FormLocale[];
  defaultLocale: FormLocale;
  value: FormConfirmationEmail | null;
  /**
   * Which language to edit — owned by the builder's language strip, so this
   * panel follows the rest of the editor instead of having its own idea.
   */
  locale: FormLocale;
  /** Switch the builder's language, for the jump-to-empty-language buttons. */
  onSelectLocale?: (locale: FormLocale) => void;
  disabled?: boolean;
  /**
   * Rendered in the panel header. The Save used to sit on the page background
   * below the card with no footer or toolbar attaching it to anything.
   */
  onSave?: () => void;
  saveDisabled?: boolean;
  /** True while the save request is in flight. */
  saving?: boolean;
  /** True when there are unsaved edits. Drives the Save/Saved readout. */
  dirty?: boolean;
  onChange: (value: FormConfirmationEmail) => void;
}

export function ConfirmationEmailPanel({
  definition,
  locales,
  defaultLocale,
  value,
  locale,
  onSelectLocale,
  disabled,
  onSave,
  saveDisabled,
  saving,
  dirty,
  onChange,
}: Props) {
  const { t } = useTranslation();

  const config: FormConfirmationEmail = value ?? {
    enabled: false,
    email_account_id: null,
    by_locale: {},
  };

  /**
   * Switching the e-mail on seeds every language that has nothing written yet.
   *
   * Without this, turning the toggle on produced a form that validates as
   * broken (subject and body are now required when enabled) and an operator
   * facing four empty editors. Seeding gives them something to edit instead.
   *
   * Only ever fills blanks — someone who wrote copy, switched the feature off,
   * and switched it back on keeps every word.
   */
  const enableWithDefaults = (
    current: FormConfirmationEmail,
  ): FormConfirmationEmail => {
    const by_locale = { ...current.by_locale };
    for (const loc of locales) {
      if (isEmptyConfirmationCopy(by_locale[loc])) {
        by_locale[loc] = defaultConfirmationEmail(loc);
      }
    }
    return { ...current, enabled: true, by_locale };
  };

  // Defensive: hydration sets editingLocale and locales in the same tick, and a
  // remove-locale race would otherwise index by_locale[undefined].
  const activeLocale = locales.includes(locale) ? locale : defaultLocale;
  const [view, setView] = useState<"code" | "preview">("preview");
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const { data: accounts } = useQuery({
    queryKey: ["workspace-email-accounts"],
    queryFn: listEmailAccounts,
  });

  const userAccounts = useMemo(
    () =>
      sortAccountsWithAliases(
        (accounts ?? []).filter((a) => a.source === "user"),
      ),
    [accounts],
  );
  const managedAccounts = useMemo(
    () => (accounts ?? []).filter((a) => a.source !== "user"),
    [accounts],
  );

  /** Every value the confirmation email can interpolate, from this form. */
  const variables = useMemo(() => {
    const fieldKeys = flattenFields(definition)
      .filter((f) => !isPresentational(f.type) && f.type !== "hidden")
      .map((f) => f.key);
    return [...new Set([...BASE_VARIABLES, ...fieldKeys])];
  }, [definition]);

  const current = config.by_locale?.[activeLocale] ?? { subject: "", html: "" };

  const patchLocale = (patch: Partial<{ subject: string; html: string }>) =>
    onChange({
      ...config,
      by_locale: {
        ...config.by_locale,
        [activeLocale]: { ...current, ...patch },
      },
    });

  /** Write a template into several languages at once. */
  const patchLocales = (
    byLocale: Record<string, { subject: string; html: string }>,
  ) => {
    const next = { ...config.by_locale };
    for (const [code, copy] of Object.entries(byLocale)) {
      next[code as FormLocale] = copy;
    }
    onChange({ ...config, by_locale: next });
    const written = Object.keys(byLocale)
      .map((code) => code.toUpperCase())
      .join(", ");
    toast.success(
      t("forms.email.templateApplied", {
        defaultValue: "Template applied to {{locales}}",
        locales: written,
      }),
    );
  };

  /**
   * Languages the e-mail is switched on for but has nothing to send in.
   *
   * A standing statement rather than a one-off message at insert time: adding a
   * language later, or clearing a body, produces exactly this state, and the
   * only other sign of it is the publish gate refusing to let the form go live.
   */
  const blankLocales = config.enabled
    ? locales.filter((code) => {
        const copy = config.by_locale?.[code];
        return !copy?.subject?.trim() || !copy?.html?.trim();
      })
    : [];

  /** Insert at the caret, which is what makes the chips worth clicking. */
  const insertVariable = (name: string) => {
    const token = `{{${name}}}`;
    const el = bodyRef.current;
    if (!el) {
      patchLocale({ html: `${current.html}${token}` });
      return;
    }
    const start = el.selectionStart ?? current.html.length;
    const end = el.selectionEnd ?? start;
    const next = current.html.slice(0, start) + token + current.html.slice(end);
    patchLocale({ html: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <Panel>
      <PanelHeader
        icon={<Mail className="h-3.5 w-3.5" />}
        title={t("forms.email.title")}
        action={
          onSave ? (
            // The same three states as the builder's own Save button. This is
            // autosaved now, so a button that only ever says "Save" gave no
            // sign anything had happened — you could not tell a saved e-mail
            // from an unsaved one.
            <GhostAction disabled={saveDisabled} onClick={onSave}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : dirty ? (
                <Save className="h-4 w-4" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {saving
                ? t("forms.builder.savingAuto")
                : dirty
                  ? t("forms.builder.save")
                  : t("forms.builder.savedAuto")}
            </GhostAction>
          ) : null
        }
      />
      <PanelBody>
        <PanelSection title={t("forms.email.sectionDelivery")}>
          <FieldHint>{t("forms.email.hint")}</FieldHint>

          <ToggleField
            id="ce-enabled"
            label={t("forms.email.enabled")}
            checked={config.enabled}
            onChange={(v) =>
              onChange(
                v ? enableWithDefaults(config) : { ...config, enabled: false },
              )
            }
          />

          {/* Everything below the switch only matters once it is on. Off, the
              sender picker and an empty message editor are dead weight the
              operator has to scroll past. */}
          {!config.enabled ? (
            <FieldHint>{t("forms.email.disabledHint")}</FieldHint>
          ) : null}

          {config.enabled ? (
            <Field>
              <Label>{t("forms.email.account")}</Label>
              <Select
                disabled={disabled}
                value={config.email_account_id ?? DEFAULT_ACCOUNT}
                onValueChange={(v) =>
                  onChange({
                    ...config,
                    email_account_id: v === DEFAULT_ACCOUNT ? null : v,
                  })
                }
              >
                <SelectTrigger className="max-w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_ACCOUNT}>
                    {t("forms.email.accountDefault")}
                  </SelectItem>
                  {/* Grouped by who owns the mailbox: a user's own connected
                    account and one Repraesent provisioned for them are very
                    different things to be sending customers mail from. */}
                  {userAccounts.length > 0 ? (
                    <SelectGroup>
                      <SelectLabel>
                        {t("forms.email.accountGroupYours")}
                      </SelectLabel>
                      {userAccounts.map((account) => (
                        <SelectItem
                          key={account.id}
                          value={account.id}
                          // A revoked grant cannot send. Leaving it selectable
                          // would let someone configure a form that silently
                          // fails on every submission.
                          disabled={!!account.auth_failed_at}
                        >
                          {/* A send-as alias sends through the mailbox listed
                            above it; the arrow is what says so in a flat list. */}
                          {account.parent_account_id ? "↳ " : ""}
                          {account.name} · {account.email}
                          {account.auth_failed_at
                            ? ` — ${t("forms.email.accountNeedsReconnect")}`
                            : account.provider === "google"
                              ? " · Google"
                              : account.provider === "microsoft"
                                ? " · Microsoft 365"
                                : " · IMAP/SMTP"}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null}
                  {managedAccounts.length > 0 ? (
                    <SelectGroup>
                      <SelectLabel>
                        {t("forms.email.accountGroupManaged")}
                      </SelectLabel>
                      {managedAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} · {account.email}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
        </PanelSection>

        {config.enabled ? (
          <PanelSection title={t("forms.email.sectionMessage")}>
            {/* Named languages, from every tab, because the whole point is that
              you cannot see the empty one from the tab you are standing on. */}
            {blankLocales.length > 0 ? (
              <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2.5 text-xs">
                <p className="font-medium text-amber-800 dark:text-amber-400">
                  {t("forms.email.blankLocales", {
                    defaultValue:
                      "No email to send in {{locales}} — a submission in that language gets the default one instead.",
                    locales: blankLocales
                      .map((code) => code.toUpperCase())
                      .join(", "),
                  })}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {blankLocales
                    .filter((code) => code !== activeLocale)
                    .map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => onSelectLocale?.(code)}
                        disabled={!onSelectLocale}
                        className="rounded-md border border-amber-500/40 bg-background px-2 py-1 font-mono text-[11px] uppercase transition-colors hover:bg-muted disabled:cursor-default disabled:opacity-60"
                      >
                        {code}
                      </button>
                    ))}
                </div>
              </div>
            ) : null}

            <Field>
              <Label htmlFor="ce-subject">{t("forms.email.subject")}</Label>
              <Input
                id="ce-subject"
                disabled={disabled}
                value={current.subject}
                onChange={(e) => patchLocale({ subject: e.target.value })}
              />
            </Field>

            <Field>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="ce-body">{t("forms.email.body")}</Label>
                <div className="flex items-center gap-2">
                  <UseTemplatePicker
                    locale={activeLocale}
                    // The form's languages, so one insert fills them all and any
                    // the template cannot cover is named rather than skipped.
                    locales={locales}
                    disabled={disabled}
                    // A form confirmation answers a submission the person just
                    // made, so it ships without an unsubscribe footer.
                    purpose="transactional"
                    onInsert={({ subject, html }) =>
                      patchLocale({ subject, html })
                    }
                    onInsertLocales={patchLocales}
                    templateHref={(id) => `/email-templates/${id}`}
                    buttonClassName={
                      "inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    }
                  />
                  <Segmented>
                    <SegmentedButton
                      active={view === "code"}
                      onClick={() => setView("code")}
                    >
                      <Code2 className="mr-1 inline h-3 w-3" />
                      {t("forms.email.code")}
                    </SegmentedButton>
                    <SegmentedButton
                      active={view === "preview"}
                      onClick={() => setView("preview")}
                    >
                      <Eye className="mr-1 inline h-3 w-3" />
                      {t("forms.email.preview")}
                    </SegmentedButton>
                  </Segmented>
                </div>
              </div>

              {view === "code" ? (
                <Textarea
                  id="ce-body"
                  ref={bodyRef}
                  rows={12}
                  disabled={disabled}
                  className="font-mono text-xs"
                  value={current.html}
                  onChange={(e) => patchLocale({ html: e.target.value })}
                />
              ) : (
                <iframe
                  title={t("forms.email.preview")}
                  srcDoc={current.html}
                  // The preview renders the customer's own HTML, which assumes a
                  // white page — so this stays white in both themes.
                  className="h-72 w-full rounded-lg border bg-white"
                  sandbox=""
                />
              )}
            </Field>

            <Field>
              <Label>{t("forms.email.variables")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {variables.map((name) => (
                  <button
                    key={name}
                    type="button"
                    disabled={disabled || view !== "code"}
                    onClick={() => insertVariable(name)}
                    className="rounded-md border bg-muted/40 px-2 py-1 font-mono text-[11px] transition-colors hover:border-foreground/25 hover:bg-muted disabled:opacity-40"
                  >
                    {`{{${name}}}`}
                  </button>
                ))}
              </div>
            </Field>
          </PanelSection>
        ) : null}
      </PanelBody>
    </Panel>
  );
}
