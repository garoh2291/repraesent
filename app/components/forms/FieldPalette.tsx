import { useTranslation } from "react-i18next";
import { FIELD_GROUPS, FIELD_TYPE_META } from "~/lib/forms/field-types";
import type { FormFieldType } from "~/lib/forms/schema";

interface Props {
  onAdd: (type: FormFieldType) => void;
  disabled?: boolean;
}

/**
 * Click-to-add rather than drag-from-palette. Adding lands the field at the end
 * of the last section and selects it, which is one gesture instead of a drag
 * plus an aim; reordering is still a drag once it exists.
 */
export function FieldPalette({ onAdd, disabled }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("forms.palette.title")}
      </h2>

      {FIELD_GROUPS.map(({ group, types }) => (
        <div key={group} className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
            {t(
              `forms.palette.group${group.charAt(0).toUpperCase()}${group.slice(1)}`,
            )}
          </p>
          <div className="grid grid-cols-1 gap-1">
            {types.map((type) => {
              const Icon = FIELD_TYPE_META[type].icon;
              return (
                <button
                  key={type}
                  type="button"
                  disabled={disabled}
                  onClick={() => onAdd(type)}
                  className="flex items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-left text-sm transition-colors hover:border-border hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="truncate">{t(`forms.palette.${type}`)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
