"use client";

import type { ReactNode } from "react";
import { applyOverrides } from "@/lib/content";

/** Applies the owner's rewordings to the site's copy before its children
 * render - on the server (so the HTML already has the new words) and again in
 * the browser (so hydration agrees). Idempotent, so repeated renders are fine. */
export default function ContentBoot({
  overrides,
  children,
}: {
  overrides: Record<string, string>;
  children: ReactNode;
}) {
  applyOverrides(overrides);
  return <>{children}</>;
}
