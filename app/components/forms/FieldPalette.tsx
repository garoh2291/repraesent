import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelSection,
} from "~/components/forms/chrome";
import { FIELD_GROUPS, FIELD_TYPE_META } from "~/lib/forms/field-types";
import type { FormFieldType, FormKind } from "~/lib/forms/schema";

interface Props {
  onAdd: (type: FormFieldType) => void;
  disabled?: boolean;
  /** Product forms offer the product field; standard forms never see it. */
  kind?: FormKind;
  /** Already placed — the palette stops offering a second one. */
  hasProduct?: boolean;
}

/**
 * Click-to-add rather than drag-from-palette. Adding lands the field at the end
 * of the last section and selects it, which is one gesture instead of a drag
 * plus an aim; reordering is still a drag once it exists.
 */
export function FieldPalette({ onAdd, disabled, kind, hasProduct }: Props) {
  const { t } = useTranslation();
  const offered = (type: FormFieldType) =>
    type !== "product" || (kind === "product" && !hasProduct);

  return (
    <Panel>
      <PanelHeader
        icon={<Plus className="h-3.5 w-3.5" />}
        title={t("forms.palette.title")}
      />
      <PanelBody className="space-y-4 p-3 sm:p-3">
        {FIELD_GROUPS.map(({ group, types: allTypes }) => {
          const types = allTypes.filter(offered);
          if (types.length === 0) return null;
          return (
            <PanelSection
              key={group}
              title={t(
                `forms.palette.group${group.charAt(0).toUpperCase()}${group.slice(1)}`,
              )}
              className="space-y-2 pt-4"
            >
              <div className="grid grid-cols-1 gap-0.5">
                {types.map((type) => {
                  const Icon = FIELD_TYPE_META[type].icon;
                  return (
                    <button
                      key={type}
                      type="button"
                      // Lets anything address a palette row by what it is rather
                      // than by position — used by the onboarding demo's cursor.
                      data-field-type={type}
                      disabled={disabled}
                      onClick={() => onAdd(type)}
                      className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                    >
                      <Icon
                        className="h-4 w-4 shrink-0 text-muted-foreground/70 transition-colors group-hover:text-foreground"
                        aria-hidden="true"
                      />
                      <span className="truncate">
                        {t(`forms.palette.${type}`)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </PanelSection>
          );
        })}
      </PanelBody>
    </Panel>
  );
}
