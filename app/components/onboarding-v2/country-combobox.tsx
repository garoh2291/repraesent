"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown } from "lucide-react";
import flags from "react-phone-number-input/flags";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "~/components/ui/command";
import { allCountries } from "~/lib/forms/commerce";
import { cn } from "~/lib/utils";
import { inputCls } from "./primitives";

/** Countries customers of re:praesent are most often in — shown first. */
const TOP = ["DE", "AT", "CH", "NL", "BE", "LU", "FR", "CA"];

function Flag({ code }: { code: string }) {
  const F = (flags as Record<string, React.ComponentType<{ title: string }>>)[code];
  return (
    <span className="inline-flex h-3.5 w-5 shrink-0 overflow-hidden rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
      {F ? <F title={code} /> : null}
    </span>
  );
}

export function CountryCombobox({
  id,
  value,
  onChange,
  describedBy,
  invalid,
}: {
  id?: string;
  value: string | null | undefined;
  onChange: (code: string) => void;
  describedBy?: string;
  invalid?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const countries = useMemo(() => allCountries(i18n.language), [i18n.language]);
  const top = countries.filter((c) => TOP.includes(c.code)).sort((a, b) => TOP.indexOf(a.code) - TOP.indexOf(b.code));
  const selected = countries.find((c) => c.code === value);

  const item = (c: { code: string; name: string }) => (
    <CommandItem
      key={c.code}
      value={`${c.name} ${c.code}`}
      onSelect={() => {
        onChange(c.code);
        setOpen(false);
      }}
      className="gap-2.5"
    >
      <Flag code={c.code} />
      <span className="flex-1 truncate">{c.name}</span>
      {value === c.code ? <Check className="size-4" /> : null}
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(inputCls, "flex items-center gap-2.5 text-left")}
        >
          {selected ? (
            <>
              <Flag code={selected.code} />
              <span className="flex-1 truncate">{selected.name}</span>
            </>
          ) : (
            <span className="flex-1 text-muted-foreground/70">{t("onb.country.pick")}</span>
          )}
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder={t("onb.country.search")} />
          <CommandList className="max-h-72">
            <CommandEmpty>{t("onb.country.none")}</CommandEmpty>
            <CommandGroup>{top.map(item)}</CommandGroup>
            <CommandGroup>{countries.filter((c) => !TOP.includes(c.code)).map(item)}</CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
