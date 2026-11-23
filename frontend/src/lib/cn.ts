// Minimal classnames joiner — same "filter(Boolean).join(' ')" convention
// Button.tsx already uses, just reusable. No tailwind-merge: nothing here
// passes conflicting utilities for the same property, so there's nothing
// to dedupe.
export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
