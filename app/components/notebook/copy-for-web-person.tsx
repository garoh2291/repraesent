import { useState, type ReactNode } from "react";
import { Check, Copy, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { setLocalFlag } from "./setup-checklist";

/**
 * A piece of code the owner will almost never paste themselves. So next to
 * Copy sits the thing they will actually do: send it to whoever looks after
 * their website. The address is left empty — we don't know who that is.
 */
export function CopyForWebPerson({
  code,
  title,
  hint,
  emailSubject,
  emailIntro,
  copiedFlag,
  disabled,
  maxPreviewLines = 8,
  className,
}: {
  code: string;
  title?: ReactNode;
  hint?: ReactNode;
  emailSubject: string;
  /** Plain words above the code in the email body. */
  emailIntro: string;
  /** localStorage flag set on copy or email — feeds a checklist step. */
  copiedFlag?: string;
  disabled?: boolean;
  maxPreviewLines?: number;
  className?: string;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const markUsed = () => {
    if (copiedFlag) setLocalFlag(copiedFlag);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      markUsed();
      toast.success(t("guided.copy.copied"));
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(t("guided.copy.copyFailed"));
    }
  };

  // mailto bodies are capped by some mail apps around 2 000 characters; the
  // snippets we hand over are a few hundred, the inline HTML bundle never
  // goes through here.
  const mailto = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(
    `${emailIntro}\n\n${code}\n`,
  )}`;

  const lines = code.split("\n");
  const preview =
    lines.length > maxPreviewLines
      ? `${lines.slice(0, maxPreviewLines).join("\n")}\n…`
      : code;

  return (
    <div className={cn("space-y-3", className)}>
      {title || hint ? (
        <div>
          {title ? (
            <p className="text-[14px] font-semibold text-foreground">{title}</p>
          ) : null}
          {hint ? (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      ) : null}
      <pre
        className={cn(
          "ink-surface max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-[#141516] px-3.5 py-3 font-mono text-[12px] leading-relaxed text-white/85",
          disabled && "opacity-50",
        )}
      >
        {preview}
      </pre>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={copy} disabled={disabled} className="h-10">
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? t("guided.copy.copiedShort") : t("guided.copy.copy")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10"
          disabled={disabled}
          asChild={!disabled}
        >
          {disabled ? (
            <span>
              <Mail className="size-4" aria-hidden />
              {t("guided.copy.email")}
            </span>
          ) : (
            <a href={mailto} onClick={markUsed}>
              <Mail className="size-4" aria-hidden />
              {t("guided.copy.email")}
            </a>
          )}
        </Button>
      </div>
    </div>
  );
}
