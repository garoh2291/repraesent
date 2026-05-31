import { useMemo, useRef, useState } from "react";
import PhoneInput, {
  type Country,
  type Value,
} from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import en from "react-phone-number-input/locale/en.json";
import {
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from "libphonenumber-js";
import { Check, ChevronDown, Globe } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";

interface PhoneNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  defaultCountry?: Country;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function PhoneNumberInput({
  value,
  onChange,
  defaultCountry = "DE",
  placeholder,
  className,
  disabled,
  autoFocus,
}: PhoneNumberInputProps) {
  // The locked country calling code (`countryCallingCodeEditable={false}`) prevents
  // the underlying input from accepting a pasted international number that uses a
  // different calling code. Intercept the paste, detect the country from the pasted
  // text and set the full E.164 value directly so the country switches automatically.
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").trim();
    if (!text) return;

    // Normalise common international prefixes (e.g. "0044" -> "+44").
    const cleaned = text.replace(/[^\d+]/g, "");
    const normalized = cleaned.startsWith("00")
      ? `+${cleaned.slice(2)}`
      : cleaned;

    // Only override the default behaviour for full international numbers.
    // National-only numbers are handled fine by the input using the current country.
    if (!normalized.startsWith("+")) return;

    const parsed = parsePhoneNumberFromString(normalized);
    if (parsed) {
      e.preventDefault();
      onChange(parsed.number);
    }
  };

  return (
    <PhoneInput
      className={cn("crm-phone-input", className)}
      international
      defaultCountry={defaultCountry}
      countryCallingCodeEditable={false}
      flags={flags}
      countrySelectComponent={CountrySelect}
      value={(value || undefined) as Value | undefined}
      onChange={(v) => onChange(v ?? "")}
      onPaste={handlePaste}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
    />
  );
}

interface CountryOption {
  value?: Country;
  label: string;
  divider?: boolean;
}

interface CountrySelectProps {
  value?: Country;
  onChange: (country?: Country) => void;
  options: CountryOption[];
  iconComponent?: React.ComponentType<{ country?: Country; label?: string }>;
  disabled?: boolean;
  readOnly?: boolean;
  name?: string;
}

function CountrySelect({
  value,
  onChange,
  options,
  iconComponent: Icon,
  disabled,
  readOnly,
}: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const countryListScrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Dialog RemoveScroll / nested scroll: wheel on portaled popovers often hits the
  // dialog body instead of this list. Scroll manually and consume the event when possible.
  const handleCountryListWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = countryListScrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const canScrollUp = scrollTop > 0;
    const canScrollDown = scrollTop < scrollHeight - clientHeight;
    if ((e.deltaY < 0 && canScrollUp) || (e.deltaY > 0 && canScrollDown)) {
      e.preventDefault();
      e.stopPropagation();
      el.scrollTop += e.deltaY;
    }
  };

  const realOptions = useMemo(
    () => options.filter((o) => !o.divider && o.value),
    [options],
  );

  const selected = realOptions.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={disabled || readOnly}
        aria-label="Select country"
        className={cn(
          "inline-flex items-center gap-1 rounded-sm px-1 py-0.5 -ml-1 text-sm transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "disabled:opacity-50 disabled:pointer-events-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {selected && Icon ? (
          <Icon country={selected.value} label={selected.label} />
        ) : (
          <Globe className="h-4 w-4 text-muted-foreground" />
        )}
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        align="start"
        className="p-0 w-[280px]"
        onPointerDown={(e) => e.stopPropagation()}
        onOpenAutoFocus={(e) => {
          // cmdk's CommandInput doesn't autofocus on its own, and Radix's default
          // focus target inside a Dialog is unreliable here. Focus the search input
          // explicitly so typing filters the country list immediately.
          e.preventDefault();
          requestAnimationFrame(() => {
            contentRef.current
              ?.querySelector<HTMLInputElement>('[data-slot="command-input"]')
              ?.focus();
          });
        }}
      >
        <Command>
          <CommandInput placeholder="Search country…" />
          <CommandList
            ref={countryListScrollRef}
            className="max-h-72 overscroll-contain"
            onWheel={handleCountryListWheel}
          >
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {realOptions.map((o) => {
                const country = o.value as Country;
                let dial = "";
                try {
                  dial = `+${getCountryCallingCode(country)}`;
                } catch {
                  dial = "";
                }
                const fullLabel = (en as Record<string, string>)[country] || o.label;
                return (
                  <CommandItem
                    key={country}
                    value={`${fullLabel} ${dial} ${country}`}
                    onSelect={() => {
                      onChange(country);
                      setOpen(false);
                    }}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    {Icon ? (
                      <Icon country={country} label={fullLabel} />
                    ) : null}
                    <span className="flex-1 truncate">{fullLabel}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {dial}
                    </span>
                    {value === country ? (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
