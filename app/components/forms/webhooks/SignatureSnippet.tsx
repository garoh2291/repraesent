import { Check, ChevronDown, Copy } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { verifySnippet } from "~/lib/forms/webhook-preview";
import { cn } from "~/lib/utils";

/** How to verify X-Repraesent-Signature, as code, folded away by default. */
export function SignatureSnippet() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const code = verifySnippet();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard denied */
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            open && "rotate-180",
          )}
        />
        {t("forms.webhooks.verify")}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
          {t("forms.webhooks.verifyHint")}
        </p>
        <div className="relative overflow-hidden rounded-xl border bg-[#111113]">
          <button
            type="button"
            onClick={copy}
            className="absolute right-2 top-2 inline-flex h-7 items-center gap-1.5 rounded-md border border-white/15 px-2 text-[11px] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            {copied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copied ? t("forms.webhooks.copied") : t("forms.webhooks.copy")}
          </button>
          <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed text-white/80">
            {code}
          </pre>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
