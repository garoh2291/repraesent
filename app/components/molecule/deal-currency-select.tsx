import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import type { DealCurrency } from "~/lib/api/deals";
import { useWorkspaceCurrency } from "~/lib/hooks/useWorkspaceCurrency";
import { cn } from "~/lib/utils";

const SYMBOL: Record<DealCurrency, string> = { EUR: "€", USD: "US$", CAD: "CA$" };

/**
 * Currency next to a deal value. Hidden until migration 187 is applied (then
 * every deal is EUR). Disabled when product lines decide the currency.
 */
export function DealCurrencySelect({
  value,
  onChange,
  disabled,
  className,
  id,
}: {
  value: DealCurrency;
  onChange: (c: DealCurrency) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const { t } = useTranslation();
  const { available, currencies } = useWorkspaceCurrency();
  if (!available) return null;
  return (
    <Select value={value} onValueChange={(v) => onChange(v as DealCurrency)} disabled={disabled}>
      <SelectTrigger id={id} aria-label={t("pipeline.fields.currency", { defaultValue: "Currency" })} className={cn("w-[6.5rem] shrink-0 tabular-nums", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {currencies.map((c) => (
          <SelectItem key={c} value={c}>
            <span className="font-medium">{c}</span>
            <span className="ml-1.5 text-muted-foreground">{SYMBOL[c]}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
