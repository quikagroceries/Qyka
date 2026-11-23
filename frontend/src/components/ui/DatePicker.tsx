"use client";

// A styled date field — Radix Popover + the Calendar above — replacing the
// browser's native <input type="date"> wherever a date is collected.
// Keeps the same "yyyy-mm-dd string in, yyyy-mm-dd string out" contract as
// a native date input, so callers don't need to know it's not one.

import { useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { format, parse, isValid } from "date-fns";
import { Calendar } from "@/components/ui/Calendar";
import { cn } from "@/lib/cn";

function toDate(value: string): Date | undefined {
  if (!value) return undefined;
  const d = parse(value, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Select a date",
  disabled,
  fromYear,
  toYear,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: (date: Date) => boolean;
  fromYear?: number;
  toYear?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = toDate(value);

  const currentYear = new Date().getFullYear();
  const startYear = fromYear ?? currentYear - 100;
  const endYear = toYear ?? currentYear;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          id={id}
          type="button"
          className={cn(
            "flex min-h-[48px] w-full items-center justify-between gap-2 rounded-2xl border border-line-strong bg-canvas px-4 text-left text-base transition-colors",
            "hover:border-line-strong",
            "focus:outline-none focus:ring-2 focus:ring-brand-orange/40 focus:border-brand-orange",
            selected ? "text-ink" : "text-faint",
            className
          )}
        >
          {selected ? format(selected, "MMM d, yyyy") : placeholder}
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
            <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
            <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" />
            <line x1="8" y1="3" x2="8" y2="6.5" />
            <line x1="16" y1="3" x2="16" y2="6.5" />
          </svg>
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-[2000] rounded-2xl border border-line bg-surface shadow-lg"
        >
          <Calendar
            mode="single"
            selected={selected}
            startMonth={new Date(startYear, 0)}
            endMonth={new Date(endYear, 11)}
            disabled={disabled}
            defaultMonth={selected || new Date(endYear, 0)}
            onSelect={(date) => {
              if (date) onChange(format(date, "yyyy-MM-dd"));
              setOpen(false);
            }}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export default DatePicker;
