import { Check, ChevronsUpDown, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Segmented, SegmentedButton } from "~/components/forms/chrome";
import {
  allCountries,
  countryName,
  detectPreset,
  presetCountries,
  type CountryPreset,
} from "~/lib/forms/commerce";
import { cn } from "~/lib/utils";

interface Props {
  value: string[];
  onChange: (codes: string[]) => void;
  disabled?: boolean;
}

/**
 * Where Stripe may ship to. Three presets cover most shops; "Custom" opens a
 * searchable list with removable chips. The stored value is always the plain
 * code list — the preset is detected from it, never stored.
 */
export function CountryPresetPicker({ value, onChange, disabled }: Props) {
  const { t, i18n } = useTranslation();
  const preset = detectPreset(value);
  const [custom, setCustom] = useState(preset === "custom");
  const [open, setOpen] = useState(false);
  const countries = useMemo(() => allCountries(i18n.language), [i18n.language]);
  const selected = new Set(value);

  const pick = (next: CountryPreset) => {
    if (next === "custom") {
      setCustom(true);
      return;
    }
    setCustom(false);
    onChange(presetCountries(next));
  };

  const showCustom = custom || preset === "custom";

  return (
    <div className="space-y-3">
      <Segmented label={t("forms.products.shipping")}>
        {(["worldwide", "eu", "dach", "custom"] as CountryPreset[]).map(
          (key) => (
            <SegmentedButton
              key={key}
              active={showCustom ? key === "custom" : preset === key}
              onClick={() => pick(key)}
            >
              {t(`forms.products.${key}`)}
            </SegmentedButton>
          ),
        )}
      </Segmented>

      {showCustom ? (
        <div className="space-y-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                className="flex h-9 w-full items-center justify-between rounded-lg border bg-background px-3 text-sm disabled:opacity-50"
              >
                <span className="text-muted-foreground">
                  {value.length
                    ? t("forms.products.countries", { count: value.length })
                    : t("forms.products.searchCountries")}
                </span>
                <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-(--radix-popover-trigger-width) p-0"
              align="start"
            >
              <Command>
                <CommandInput
                  placeholder={t("forms.products.searchCountries")}
                />
                <CommandList className="max-h-64">
                  <CommandEmpty>—</CommandEmpty>
                  <CommandGroup>
                    {countries.map((c) => {
                      const on = selected.has(c.code);
                      return (
                        <CommandItem
                          key={c.code}
                          value={`${c.name} ${c.code}`}
                          onSelect={() =>
                            onChange(
                              on
                                ? value.filter((v) => v !== c.code)
                                : [...value, c.code],
                            )
                          }
                        >
                          <span
                            className={cn(
                              "grid h-4 w-4 place-items-center rounded-sm border",
                              on
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border",
                            )}
                          >
                            {on ? <Check className="h-3 w-3" /> : null}
                          </span>
                          <span className="flex-1 truncate">{c.name}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {c.code}
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {value.length ? (
            <div className="flex flex-wrap gap-1.5">
              {value.map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 text-xs"
                >
                  {countryName(code, i18n.language)}
                  {!disabled ? (
                    <button
                      type="button"
                      aria-label={`${t("common.remove", { defaultValue: "Remove" })} ${code}`}
                      onClick={() => onChange(value.filter((v) => v !== code))}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  ) : null}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("forms.products.customHint")}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
