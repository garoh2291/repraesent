import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { Button } from "~/components/ui/button";

/** A piece of text with its own copy button. */
export function CopyBlock({ text, label, hideText }: { text: string; label?: string; hideText?: boolean }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(t("guided.copy.copyFailed"));
    }
  };
  return (
    <div className="mt-2">
      {!hideText ? <p className="rounded-lg border border-border bg-background/60 px-3.5 py-3 text-[14px] leading-relaxed text-foreground">{text}</p> : null}
      <Button variant="ghost" size="sm" className="mt-1 -ml-2" onClick={copy}>
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? t("guided.copy.copiedShort") : (label ?? t("guided.copy.copy"))}
      </Button>
    </div>
  );
}
