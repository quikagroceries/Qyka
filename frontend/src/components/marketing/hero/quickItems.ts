import type { StaticImageData } from "next/image";

import tomatoes from "@/assets/illustrations/tomatoes.webp";
import bananas from "@/assets/illustrations/bananas-1.webp";
import pepper from "@/assets/illustrations/pepper.webp";
import onion from "@/assets/illustrations/onion.webp";
import garri from "@/assets/illustrations/garri.webp";
import riceBag from "@/assets/illustrations/rice-bag.webp";
import crayfish from "@/assets/illustrations/crayfish.webp";
import eggs from "@/assets/illustrations/eggs.webp";
import milk from "@/assets/illustrations/milk-carton-1.webp";
import bread from "@/assets/illustrations/bread-loaf-1.webp";
import chicken from "@/assets/illustrations/roast-chicken.webp";
import okra from "@/assets/illustrations/okra.webp";
import carrot from "@/assets/illustrations/carrot.webp";

export type QuickItem = { label: string; add: string; src: StaticImageData };

// What people tap to start a list - Chowdeck's cuisine strip, but for the
// market. Tapping one drops it straight into the list box above.
export const QUICK_ITEMS: QuickItem[] = [
  { label: "Tomatoes", add: "Tomatoes, 1 basket", src: tomatoes },
  { label: "Pepper", add: "Fresh pepper, 1 paint", src: pepper },
  { label: "Onions", add: "Onions, 1 bag", src: onion },
  { label: "Garri", add: "Garri, 2 cups", src: garri },
  { label: "Rice", add: "Rice, 1 bag", src: riceBag },
  { label: "Crayfish", add: "Crayfish, 1 cup", src: crayfish },
  { label: "Eggs", add: "Eggs, 1 crate", src: eggs },
  { label: "Chicken", add: "Chicken, 1 whole", src: chicken },
  { label: "Milk", add: "Milk, 2 cartons", src: milk },
  { label: "Bread", add: "Bread, 2 loaves", src: bread },
  { label: "Okra", add: "Okra, 1 bowl", src: okra },
  { label: "Carrots", add: "Carrots, 1 kg", src: carrot },
  { label: "Bananas", add: "Bananas, 1 bunch", src: bananas },
];
