import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

/**
 * Ask for one value, in the app's own dialog.
 *
 * Replaces `window.prompt`, which the "Save row" and link controls were using.
 * The native prompt is unstyled OS chrome, it cannot be translated, it has no
 * room for a label or a hint, and it offers exactly one text field and two
 * generic buttons — so anything beyond "type a string" has to be smuggled into
 * the value itself (the link control asked people to submit an EMPTY prompt to
 * remove a link, which nobody would guess).
 *
 * `Dialog` rather than `AlertDialog`: this is a form. AlertDialog is for
 * confirming something destructive, which is what `ConfirmDeleteDialog` is.
 */
export function PromptDialog({
  open,
  onOpenChange,
  title,
  label,
  placeholder,
  defaultValue = "",
  submitLabel,
  onSubmit,
  secondaryAction,
  busy,
  inputType = "text",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Visible, and tied to the input — a placeholder is not a label. */
  label: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel?: string;
  onSubmit: (value: string) => void;
  /** An extra outcome the value alone cannot express, e.g. "Remove link". */
  secondaryAction?: { label: string; onClick: () => void };
  busy?: boolean;
  inputType?: "text" | "url";
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(defaultValue);

  // Re-seed each time it opens: the same dialog instance is reused for
  // different rows and different links.
  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  const submit = () => {
    if (!value.trim()) return;
    onSubmit(value.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="prompt-dialog-input" className="text-xs">
            {label}
          </Label>
          <Input
            id="prompt-dialog-input"
            autoFocus
            type={inputType}
            value={value}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              // Enter commits, the way the native prompt did.
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {secondaryAction ? (
            <Button
              variant="ghost"
              onClick={secondaryAction.onClick}
              className="text-muted-foreground hover:text-destructive"
            >
              {secondaryAction.label}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button onClick={submit} disabled={!value.trim() || busy}>
              {submitLabel ?? t("common.save", { defaultValue: "Save" })}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
