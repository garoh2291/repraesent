import { useState } from "react";
import type { MouseEvent } from "react";
import { format, isValid, parse } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { Calendar } from "~/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { formatDate } from "~/lib/utils/format";

/** Parse API datetime / date string to YYYY-MM-DD (UTC date part). */
export function apiDatetimeToIsoDate(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  const d = new Date(v as string);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

/** Same as apiDatetimeToIsoDate but uses "" for empty (native date input compatibility). */
export function apiDatetimeToIsoDateString(v: unknown): string {
  return apiDatetimeToIsoDate(v) ?? "";
}

export function formatDateToIsoLocal(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function parseIsoLocal(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  const d = parse(iso, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

export interface DatePickerPopoverProps {
  valueIso: string | undefined;
  onChange: (iso: string | undefined) => void;
  disabled?: boolean;
  allowClear?: boolean;
  placeholder: string;
  /** Return true to disable that calendar day */
  disabledDate?: (date: Date) => boolean;
  id?: string;
  className?: string;
  /** Lower bound for the year dropdown (default 1900) */
  fromYear?: number;
  /** Upper bound for the year dropdown (default current calendar year + 10) */
  toYear?: number;
}

export function DatePickerPopover({
  valueIso,
  onChange,
  disabled,
  allowClear,
  placeholder,
  disabledDate,
  id,
  className,
  fromYear = 1900,
  toYear = new Date().getFullYear() + 10,
}: DatePickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const selected = parseIsoLocal(valueIso);
  const display =
    selected != null ? formatDate(selected, "PPP") : placeholder;

  const handleClear = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onChange(undefined);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          data-slot="date-picker-trigger"
          className={cn(
            // Match ~/components/ui/input.tsx field chrome
            "flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-left text-base shadow-xs outline-none transition-[color,box-shadow] selection:bg-primary selection:text-primary-foreground md:text-sm",
            "dark:bg-input/30",
            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            !valueIso && "text-muted-foreground",
            valueIso && "text-foreground",
            className,
          )}
        >
          <CalendarIcon
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate">{display}</span>
          {allowClear && valueIso ? (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onChange(undefined);
                }
              }}
              className="-mr-1 inline-flex shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          fromYear={fromYear}
          toYear={toYear}
          selected={selected}
          onSelect={(d) => {
            if (d) {
              onChange(formatDateToIsoLocal(d));
              setOpen(false);
            }
          }}
          disabled={disabledDate}
          defaultMonth={selected ?? new Date()}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
