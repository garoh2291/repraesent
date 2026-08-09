import { useQuery } from "@tanstack/react-query";
import { Code2, Eye, Mail, Save } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { Field, FieldHint, ToggleField } from "~/components/wordpress/fields";
import { listEmailAccounts } from "~/lib/api/workspaces";
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
  disabled?: boolean;
  /**
   * Rendered in the panel header. The Save used to sit on the page background
   * below the card with no footer or toolbar attaching it to anything.
   */
  onSave?: () => void;
  saveDisabled?: boolean;
  onChange: (value: FormConfirmationEmail) => void;
}

export function ConfirmationEmailPanel({
  definition,
  locales,
  defaultLocale,
  value,
  locale,
  disabled,
  onSave,
  saveDisabled,
  onChange,
}: Props) {
  const { t } = useTranslation();

  const config: FormConfirmationEmail = value ?? {
    enabled: false,
    email_account_id: null,
    by_locale: {},
  };

  // Defensive: hydration sets editingLocale and locales in the same tick, and a
  // remove-locale race would otherwise index by_locale[undefined].
  const activeLocale = locales.includes(locale) ? locale : defaultLocale;
  const [view, setView] = useState<"code" | "preview">("code");
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const { data: accounts } = useQuery({
    queryKey: ["workspace-email-accounts"],
    queryFn: listEmailAccounts,
  });

  const userAccounts = useMemo(
    () => (accounts ?? []).filter((a) => a.source === "user"),
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
            <GhostAction disabled={saveDisabled} onClick={onSave}>
              <Save className="h-4 w-4" />
              {t("forms.builder.save")}
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
            onChange={(v) => onChange({ ...config, enabled: v })}
          />

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
                        {account.name} · {account.email}
                        {account.auth_failed_at
                          ? ` — ${t("forms.email.accountNeedsReconnect")}`
                          : account.provider === "google"
                            ? " · Google"
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
        </PanelSection>

        <PanelSection title={t("forms.email.sectionMessage")}>
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
      </PanelBody>
    </Panel>
  );
}
