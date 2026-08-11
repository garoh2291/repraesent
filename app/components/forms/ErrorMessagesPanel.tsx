/**
 * The copy a visitor sees when a field fails validation.
 *
 * Its own tab rather than a collapsed accordion at the bottom of Design: there
 * are fourteen strings here, they are per-locale, and every one of them is
 * something a visitor reads. Buried behind a chevron they were never filled in.
 *
 * The summary is advisory, not a validation issue — a blank string falls back
 * to error.generic at render time, so the form still works.
 */

import { useTranslation } from "react-i18next";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Cols, Panel, PanelBody, PanelHeader } from "~/components/forms/chrome";
import { Field, FieldHint } from "~/components/wordpress/fields";
import { FORM_ERROR_CODES, contentKey } from "~/lib/forms/schema";

/** error.generic plus the coded messages — what the summary counts. */
const ERROR_COPY_KEYS = ["generic", ...FORM_ERROR_CODES] as const;

interface Props {
  disabled?: boolean;
  getText: (key: string) => string;
  setText: (key: string, value: string) => void;
}

export function ErrorMessagesPanel({ disabled, getText, setText }: Props) {
  const { t } = useTranslation();

  const blankCount = [
    contentKey.errorGeneric(),
    ...FORM_ERROR_CODES.map((code) => contentKey.error(code)),
  ].filter((key) => getText(key).trim() === "").length;

  return (
    <div className="max-w-4xl">
      {/* Not sticky. The thing that has to follow you down the page is the
          validation banner listing what is actually wrong — see the builder
          shell — not this panel's own header. */}
      <Panel>
        <PanelHeader
          title={t("forms.builder.tabErrors")}
          meta={
            <span className="text-[11px] normal-case tracking-normal text-muted-foreground/70">
              {t("forms.design.errorsSummary", {
                total: ERROR_COPY_KEYS.length,
                blank: blankCount,
              })}
            </span>
          }
        />
        <PanelBody>
          <FieldHint>{t("forms.design.errorsHint")}</FieldHint>

          {/* error.generic first and full-width: it is the fallback for any
              code with no copy, and the failure banner in every success mode,
              so it is the one a visitor is likeliest to see. */}
          <Field>
            <Label htmlFor="err-generic">
              {t("forms.design.error.generic")}
            </Label>
            <Input
              id="err-generic"
              disabled={disabled}
              value={getText(contentKey.errorGeneric())}
              onChange={(e) =>
                setText(contentKey.errorGeneric(), e.target.value)
              }
            />
          </Field>

          <Cols>
            {FORM_ERROR_CODES.map((code) => (
              <Field key={code}>
                <Label htmlFor={`err-${code}`}>
                  {t(`forms.design.error.${code}`)}
                </Label>
                <Input
                  id={`err-${code}`}
                  disabled={disabled}
                  value={getText(contentKey.error(code))}
                  onChange={(e) =>
                    setText(contentKey.error(code), e.target.value)
                  }
                />
              </Field>
            ))}
          </Cols>
        </PanelBody>
      </Panel>
    </div>
  );
}
