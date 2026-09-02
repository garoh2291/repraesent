import { Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type {
  FormWebhookEvent,
  FormWebhookFieldMap,
  PayloadKeyGroup,
} from "~/lib/api/form-webhooks";
import {
  buildPreview,
  renamedTargets,
  tokenizeJson,
} from "~/lib/forms/webhook-preview";
import { cn } from "~/lib/utils";

interface Props {
  envelope: Record<string, unknown>;
  groups: PayloadKeyGroup[];
  map: FormWebhookFieldMap;
  events: FormWebhookEvent[];
  event: FormWebhookEvent;
  onEventChange: (event: FormWebhookEvent) => void;
}

/**
 * The exact JSON that will be POSTed, on the builder's one dark surface (the
 * command bar's colour), tinted with three hues and no highlighter library.
 * A renamed key gets a left rule and a ghost "was …" comment; the hidden count
 * closes the block.
 */
export function PayloadPreview({
  envelope,
  groups,
  map,
  events,
  event,
  onEventChange,
}: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const preview = useMemo(
    () => buildPreview(envelope, groups, map, event),
    [envelope, groups, map, event],
  );
  const renamed = useMemo(() => renamedTargets(map), [map]);
  const lines = useMemo(() => tokenizeJson(preview), [preview]);
  const hidden = useMemo(() => {
    const all = groups
      .filter((g) => g.group !== "checkout" || event !== "form.submitted")
      .flatMap((g) => g.keys.map((k) => k.key));
    return all.filter((key) => {
      const rule = map.keys[key];
      return rule ? !rule.include : map.default === "exclude";
    }).length;
  }, [groups, map, event]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(preview, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard denied — nothing sensible to do but leave the button as is.
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-[#111113] text-white/85">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/45">
          {t("forms.webhooks.previewEvent")}
        </span>
        {events.length > 1 ? (
          <Select
            value={event}
            onValueChange={(v) => onEventChange(v as FormWebhookEvent)}
          >
            <SelectTrigger
              size="sm"
              className="h-7 border-white/15 bg-white/5 font-mono text-[11px] text-white/85 hover:bg-white/10"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e} value={e} className="font-mono text-xs">
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="font-mono text-[11px] text-white/70">{event}</span>
        )}
        <button
          type="button"
          onClick={copy}
          className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md border border-white/15 px-2 text-[11px] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          {copied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? t("forms.webhooks.copied") : t("forms.webhooks.copyJson")}
        </button>
      </div>

      <pre className="max-h-[520px] overflow-auto p-4 font-mono text-[12px] leading-relaxed">
        {lines.map((line, i) => {
          const was = line.dataKey ? renamed[line.dataKey] : undefined;
          return (
            <div
              key={i}
              className={cn(
                "-mx-1 flex items-baseline whitespace-pre px-1",
                was && "border-l-2 border-primary/70 bg-primary/10",
              )}
            >
              <span className="min-w-0">
                {line.tokens.map((tok, j) => (
                  <span
                    key={j}
                    className={
                      tok.kind === "key"
                        ? "text-white/60"
                        : tok.kind === "string"
                          ? "text-emerald-300/90"
                          : tok.kind === "number"
                            ? "text-amber-300/90"
                            : tok.kind === "literal"
                              ? "text-sky-300/90"
                              : "text-white/45"
                    }
                  >
                    {tok.text}
                  </span>
                ))}
              </span>
              {was ? (
                <span className="ml-3 shrink-0 text-white/35">
                  {`// ${t("forms.webhooks.was", { key: was })}`}
                </span>
              ) : null}
            </div>
          );
        })}
        {hidden > 0 ? (
          <div className="mt-2 text-white/35">
            {`// ${t("forms.webhooks.hidden", { count: hidden })}`}
          </div>
        ) : null}
      </pre>
    </div>
  );
}
