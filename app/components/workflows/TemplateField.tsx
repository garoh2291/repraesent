import { useRef } from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Field, FieldHint } from "~/components/wordpress/fields";
import type { CatalogField } from "~/lib/api/workflows";
import { VariablePicker } from "./VariablePicker";

/**
 * A one-line or multi-line template with clickable variable chips.
 *
 * Extracted from `EmailTemplateEditor` so the action nodes get the same
 * caret-insertion behaviour rather than each growing its own. The chips are
 * the only discoverable way `{{trigger.record.title}}` is learned — a plain
 * text box with a hint saying "you may use variables" teaches nobody which
 * ones exist.
 */
export function TemplateField({
  id,
  label,
  hint,
  value,
  fields,
  placeholder,
  multiline,
  rows = 3,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  /** The trigger entity's catalogue. Empty hides the picker entirely. */
  fields: CatalogField[];
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  const insert = (path: string) => {
    const token = `{{${path}}}`;
    const el = ref.current;
    if (!el) {
      onChange(`${value}${token}`);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? start;
    onChange(value.slice(0, start) + token + value.slice(end));
    // After the value round-trips through React, put the caret past the token
    // so a second chip lands after the first rather than inside it.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <Field>
      {/* Empty when the caller has already labelled the row itself. */}
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      {multiline ? (
        <Textarea
          id={id}
          ref={ref as React.Ref<HTMLTextAreaElement>}
          rows={rows}
          disabled={disabled}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          id={id}
          ref={ref as React.Ref<HTMLInputElement>}
          disabled={disabled}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {hint ? <FieldHint>{hint}</FieldHint> : null}

      <VariablePicker fields={fields} disabled={disabled} onInsert={insert} />
    </Field>
  );
}
