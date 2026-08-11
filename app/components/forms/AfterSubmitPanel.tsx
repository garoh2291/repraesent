/**
 * What happens once a visitor presses Send.
 *
 * Split out of the Design tab, which had grown three unrelated jobs: how the
 * form looks, what it says when it fails, and where the visitor lands when it
 * succeeds. Only the first of those is design, and the other two were buried
 * under a scroll.
 *
 * The copy for every mode lives in definition.content regardless of which mode
 * is selected, so switching to redirect and back never loses what was written.
 */

import { useTranslation } from "react-i18next";
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
import { Panel, PanelBody, PanelHeader } from "~/components/forms/chrome";
import { Field, FieldHint, ToggleField } from "~/components/wordpress/fields";
import { contentKey, type FormDefinition } from "~/lib/forms/schema";

interface Props {
  definition: FormDefinition;
  disabled?: boolean;
  getText: (key: string) => string;
  setText: (key: string, value: string) => void;
  onChange: (patch: Partial<FormDefinition>) => void;
}

export function AfterSubmitPanel({
  definition,
  disabled,
  getText,
  setText,
  onChange,
}: Props) {
  const { t } = useTranslation();
  const patchSuccess = (patch: Partial<FormDefinition["success"]>) =>
    onChange({ success: { ...definition.success, ...patch } });

  return (
    <div className="max-w-2xl">
      <Panel>
        <PanelHeader title={t("forms.builder.tabAfterSubmit")} />
        <PanelBody>
          <Field>
            <Label>{t("forms.design.successMode")}</Label>
            <Select
              disabled={disabled}
              value={definition.success.mode}
              onValueChange={(v) => patchSuccess({ mode: v as never })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inline">
                  {t("forms.design.successInline")}
                </SelectItem>
                <SelectItem value="modal">
                  {t("forms.design.successModal")}
                </SelectItem>
                <SelectItem value="redirect">
                  {t("forms.design.successRedirect")}
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {definition.success.mode === "redirect" ? (
            <Field>
              <Label htmlFor="success-url">
                {t("forms.design.redirectUrl")}
              </Label>
              <Input
                id="success-url"
                disabled={disabled}
                placeholder="https://example.com/thank-you"
                value={definition.success.redirectUrl ?? ""}
                onChange={(e) => patchSuccess({ redirectUrl: e.target.value })}
              />
              <FieldHint>{t("forms.validation.invalidRedirect")}</FieldHint>
            </Field>
          ) : null}

          {definition.success.mode === "inline" ? (
            <>
              <Field>
                <Label htmlFor="success-inline">
                  {t("forms.design.successInlineText")}
                </Label>
                <Textarea
                  id="success-inline"
                  rows={3}
                  disabled={disabled}
                  value={getText(contentKey.successInline())}
                  onChange={(e) =>
                    setText(contentKey.successInline(), e.target.value)
                  }
                />
              </Field>
              <ToggleField
                id="success-reset"
                label={t("forms.design.resetAfterSubmit")}
                checked={definition.success.resetAfterSubmit}
                onChange={(v) => patchSuccess({ resetAfterSubmit: v })}
              />
            </>
          ) : null}

          {definition.success.mode === "modal" ? (
            <>
              <Field>
                <Label htmlFor="success-mt">
                  {t("forms.design.successModalTitle")}
                </Label>
                <Input
                  id="success-mt"
                  disabled={disabled}
                  value={getText(contentKey.successModalTitle())}
                  onChange={(e) =>
                    setText(contentKey.successModalTitle(), e.target.value)
                  }
                />
              </Field>
              <Field>
                <Label htmlFor="success-mb">
                  {t("forms.design.successModalBody")}
                </Label>
                <Textarea
                  id="success-mb"
                  rows={3}
                  disabled={disabled}
                  value={getText(contentKey.successModalBody())}
                  onChange={(e) =>
                    setText(contentKey.successModalBody(), e.target.value)
                  }
                />
              </Field>
              <Field>
                <Label htmlFor="success-mc">
                  {t("forms.design.successModalCta")}
                </Label>
                <Input
                  id="success-mc"
                  disabled={disabled}
                  value={getText(contentKey.successModalCta())}
                  onChange={(e) =>
                    setText(contentKey.successModalCta(), e.target.value)
                  }
                />
              </Field>
            </>
          ) : null}
        </PanelBody>
      </Panel>
    </div>
  );
}
