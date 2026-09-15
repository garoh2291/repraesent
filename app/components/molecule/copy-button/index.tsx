import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";

/**
 * Copy `value` to the clipboard, and say so for a moment.
 *
 * One component for the "copy this snippet" buttons that used to be re-typed
 * per screen. The two-second "Copied" swap is the feedback; a toast only
 * appears when the clipboard is unavailable (an insecure origin, a denied
 * permission), because a success toast on top of the swap is saying it twice.
 */
export function CopyButton({
  value,
  label,
  copiedLabel,
  size = "sm",
  iconOnly = false,
  className,
}: {
  value: string;
  /** Defaults to `common.copy`. */
  label?: string;
  /** Defaults to `common.copied`. */
  copiedLabel?: string;
  size?: "xs" | "sm";
  iconOnly?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const text = label ?? t("common.copy", "Copy");
  const doneText = copiedLabel ?? t("common.copied", "Copied");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("common.copyFailed", "Could not copy — select the text and copy it manually."));
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={iconOnly ? (copied ? doneText : text) : undefined}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-muted/40 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        size === "xs" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        className,
      )}
    >
      {copied ? (
        <Check className="size-3 text-emerald-500" aria-hidden />
      ) : (
        <Copy className="size-3" aria-hidden />
      )}
      {iconOnly ? null : copied ? doneText : text}
    </button>
  );
}
