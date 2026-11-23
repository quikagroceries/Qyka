"use client";

// shadcn/ui's Calendar recipe (react-day-picker v10) restyled with Qyka's
// own tokens instead of the shadcn default theme — brand-orange for the
// selected day, ink/muted for everything else, font-display for the month
// caption to match the rest of the app's headings.

import { DayPicker, type DayButtonProps } from "react-day-picker";
import { cn } from "@/lib/cn";

function Chevron({ orientation }: { orientation?: "left" | "right" | "up" | "down" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-4 w-4", orientation === "right" && "rotate-180")}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DayButton({ className, ...props }: DayButtonProps) {
  return <button type="button" className={className} {...props} />;
}

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col gap-4",
        month: "space-y-3",
        month_caption: "flex items-center justify-center pt-1 relative",
        caption_label: "font-display text-sm font-extrabold text-ink",
        nav: "flex items-center gap-1 absolute inset-x-0 justify-between",
        button_previous: cn(
          "flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-sunken hover:text-ink",
          "disabled:opacity-40 disabled:pointer-events-none"
        ),
        button_next: cn(
          "flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-sunken hover:text-ink",
          "disabled:opacity-40 disabled:pointer-events-none"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 text-center text-xs font-semibold text-faint",
        week: "flex w-full mt-1",
        day: "p-0 text-center text-sm relative",
        day_button: cn(
          "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-ink transition-colors",
          "hover:bg-sunken",
          "aria-selected:bg-brand-orange aria-selected:text-[#1A1A1A] aria-selected:hover:bg-brand-orange-dark"
        ),
        today: "[&>button]:border [&>button]:border-brand-orange",
        outside: "[&>button]:text-faint",
        disabled: "[&>button]:text-faint [&>button]:opacity-50 [&>button]:pointer-events-none",
        hidden: "invisible",
        ...classNames,
      }}
      components={{ Chevron, DayButton }}
      {...props}
    />
  );
}
