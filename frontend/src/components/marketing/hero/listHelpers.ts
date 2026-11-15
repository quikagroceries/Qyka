import type { StaticImageData } from "next/image";

import { QUICK_ITEMS } from "@/components/marketing/hero/quickItems";

// Quick-add items carry a quantity the person can change, so the hero list is
// a real mini-list (icon, name, stepper) rather than a pile of fixed strings.
export type ListItem = { name: string; qty: number; unit: string; src?: StaticImageData };

const UNIT_PLURAL: Record<string, string> = { loaf: "loaves", kg: "kg", whole: "whole" };
export const unitFor = (unit: string, qty: number) =>
  qty === 1 ? unit : UNIT_PLURAL[unit] ?? unit + "s";
const unitBase = (unit: string) => {
  if (unit === "loaves") return "loaf";
  return unit in UNIT_PLURAL ? unit : unit.replace(/s$/, "");
};

// "Garri, 2 cups" -> { name: "Garri", qty: 2, unit: "cup" }
export function parseLine(line: string): ListItem {
  const m = line.match(/^(.*?),\s*(\d+(?:\.\d+)?)\s+(.+)$/);
  const src = QUICK_ITEMS.find((q) => q.add === line)?.src;
  if (!m) return { name: line, qty: 1, unit: "", src };
  return { name: m[1], qty: Number(m[2]), unit: unitBase(m[3]), src };
}

export const formatItem = (i: ListItem) => (i.unit ? `${i.name}, ${i.qty} ${unitFor(i.unit, i.qty)}` : i.name);
