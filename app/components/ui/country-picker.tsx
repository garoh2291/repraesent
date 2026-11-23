import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown } from "lucide-react";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "~/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Flag } from "~/components/onboarding-v2/country-combobox";
import { allCountries } from "~/lib/forms/commerce";
import { useIsPhone } from "~/lib/hooks/use-is-phone";
import { cn } from "~/lib/utils";

/** Where re:praesent's customers most often are: listed first. */
const MOST_USED = ["DE", "AT", "CH", "NL", "BE", "LU", "FR", "IT", "ES", "GB", "US"];
/** Codes Intl knows that aren't countries anyone lives in. */
const NOT_COUNTRIES = new Set(["EU", "EZ", "UN", "XA", "XB", "ZZ", "QO"]);

/** Case, accent and umlaut blind: "osterreich" finds "Österreich". */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase();

type Country = { code: string; name: string; en: string };

/**
 * One country picker: every country, named in the reader's language, with
 * its flag; the most used ones first; search by local name, English name or
 * code ("Deutschland", "germany", "DE"). A popover on desktop; on a phone the
 * list opens in place under the button — inside sheets a floating popover
 * fights the sheet's scroll lock — with 44 px rows and 16 px search text so
 * iOS never zooms in. Same pattern as TimezonePicker.
 */
export function CountryPicker({
  value,
  onChange,
  label,
  invalid,
}: {
  /** ISO 3166-1 alpha-2, or "" for none. */
  value: string;
  onChange: (code: string) => void;
  /** Accessible name of the button ("Country"). */
  label: string;
  invalid?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const phone = useIsPhone();
  const [open, setOpen] = useState(false);
  const countries = useMemo<Country[]>(() => {
    const en = new Map(allCountries("en").map((c) => [c.code, c.name]));
    return allCountries(i18n.language)
      .filter((c) => !NOT_COUNTRIES.has(c.code))
      .map((c) => ({ ...c, en: en.get(c.code) ?? c.name }));
  }, [i18n.language]);
  const selected = countries.find((c) => c.code === value) ?? null;

  const pick = (code: string) => {
    onChange(code);
    setOpen(false);
  };

  const trigger = (
    <button
      type="button"
      aria-label={`${label}: ${selected?.name ?? t("onb.country.pick")}`}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-invalid={invalid || undefined}
      onClick={phone ? () => setOpen((v) => !v) : undefined}
      className={cn(
        "press flex h-10 w-full min-w-0 items-center gap-2.5 rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-xs transition-colors max-sm:h-11",
        "touch-manipulation select-none hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        open && "border-foreground/40",
        invalid && "border-destructive",
      )}
    >
      {selected ? <Flag code={selected.code} /> : null}
      <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted-foreground")}>
        {selected?.name ?? t("onb.country.pick")}
      </span>
      <ChevronDown className={cn("size-4 shrink-0 opacity-50 transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden />
    </button>
  );

  const list = <CountryList value={value} countries={countries} onPick={pick} touch={phone} />;

  if (phone) {
    return (
      <div className="w-full space-y-2">
        {trigger}
        {open ? (
          <div
            ref={(el) => {
              // Opens below the button; bring the list into view above the sheet's footer.
              if (!el) return;
              const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              requestAnimationFrame(() => el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" }));
            }}
            className="scroll-mb-24 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
          >
            {list}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      {/* Portaled to <body>: inside a dialog its scroll lock would swallow wheel/touch scrolls here. */}
      <PopoverContent
        align="start"
        sideOffset={6}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        className="w-[clamp(260px,var(--radix-popover-trigger-width),360px)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl p-0"
      >
        {list}
      </PopoverContent>
    </Popover>
  );
}

function CountryList({
  value,
  countries,
  onPick,
  touch,
}: {
  value: string;
  countries: Country[];
  onPick: (code: string) => void;
  touch: boolean;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const q = fold(query.trim());
  const row = cn("gap-2.5 touch-manipulation select-none", touch ? "min-h-11 text-[15px]" : "min-h-9");

  const item = (c: Country) => (
    <CommandItem key={c.code} value={c.code} onSelect={() => onPick(c.code)} className={row}>
      <Flag code={c.code} />
      <span className="min-w-0 flex-1 truncate">{c.name}</span>
      {value === c.code ? <Check className="size-4" aria-hidden /> : null}
    </CommandItem>
  );

  // Searching: one flat list, the closest first (name starts with it, then the code, then anywhere).
  const matches = q
    ? countries
        .map((c) => {
          const name = fold(c.name);
          const en = fold(c.en);
          const code = c.code.toLowerCase();
          const rank =
            code === q ? 0 : name.startsWith(q) || en.startsWith(q) ? 1 : name.includes(q) || en.includes(q) ? 2 : -1;
          return { c, rank };
        })
        .filter((x) => x.rank >= 0)
        .sort((a, b) => a.rank - b.rank)
        .map((x) => x.c)
    : null;
  const top = MOST_USED.map((code) => countries.find((c) => c.code === code)).filter((c): c is Country => !!c);

  return (
    <Command shouldFilter={false}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={t("onb.country.search")}
        // 16 px on touch: iOS zooms into anything smaller and never zooms back.
        className={cn(touch && "text-base")}
        enterKeyHint="search"
        autoCapitalize="none"
        autoCorrect="off"
      />
      <CommandList className={touch ? "max-h-[min(320px,45dvh)]" : "max-h-[min(300px,50vh)]"}>
        {matches ? (
          matches.length ? (
            <CommandGroup>{matches.map(item)}</CommandGroup>
          ) : (
            <p className="px-3 py-3 text-sm text-muted-foreground">{t("onb.country.none")}</p>
          )
        ) : (
          <>
            <CommandGroup>{top.map(item)}</CommandGroup>
            <CommandSeparator />
            <CommandGroup>{countries.filter((c) => !MOST_USED.includes(c.code)).map(item)}</CommandGroup>
          </>
        )}
      </CommandList>
    </Command>
  );
}
