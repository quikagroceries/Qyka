"use client";

// Radix Select (the shadcn/ui structural pattern), restyled with Qyka's own
// tokens — rounded-2xl/brand-orange/surface, not shadcn's default theme.
// Replaces raw <select> anywhere a styled, keyboard-accessible dropdown is
// needed instead of the browser's native control.

import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "@/lib/cn";
import Icon from "@/components/ui/Icon";

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "flex min-h-[48px] w-full items-center justify-between gap-2 rounded-2xl border border-line-strong bg-canvas px-4 text-base text-ink",
        "placeholder:text-faint transition-colors",
        "hover:border-line-strong",
        "focus:outline-none focus:ring-2 focus:ring-brand-orange/40 focus:border-brand-orange",
        "data-[placeholder]:text-faint",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <Icon name="chevronDown" className="h-4 w-4 shrink-0 text-muted" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        sideOffset={6}
        className={cn(
          "relative z-[2000] max-h-[min(24rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-line bg-surface shadow-lg",
          className
        )}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="flex h-7 items-center justify-center text-faint">
          <Icon name="chevronDown" className="h-4 w-4 rotate-180" />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="p-1.5">{children}</SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex h-7 items-center justify-center text-faint">
          <Icon name="chevronDown" className="h-4 w-4" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex min-h-[40px] cursor-pointer select-none items-center rounded-xl px-3 py-2 pr-8 text-sm text-ink outline-none transition-colors",
        "data-[highlighted]:bg-sunken",
        "data-[state=checked]:font-semibold data-[state=checked]:text-brand-orange-dark",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2.5 flex items-center">
        <Icon name="check" className="h-4 w-4 text-brand-orange-dark" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
