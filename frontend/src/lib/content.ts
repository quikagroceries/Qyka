// Owner-editable website copy.
//
// The site's wording lives in code (content/i18n.ts, landing.ts, helpContent.ts).
// An owner can reword any plain-text piece of it in Admin > Website text; those
// rewordings are stored on the server under a key naming where the text lives
// ("en.hero.title", "faqs.0.a") and applied here, on top of the wording the
// site ships with, before anything renders (see ContentBoot in the root layout).
// Resetting a key puts the original back. Plain text only: links, prices and
// numbers are never editable from here.

import { DICTS } from "@/content/i18n";
import { FAQS, HELP_TOPICS } from "@/lib/helpContent";
import { LANDING } from "@/content/landing";

export const ROOTS: Record<string, any> = {
  en: DICTS.en,
  pcm: DICTS.pcm,
  faqs: FAQS,
  help: HELP_TOPICS,
  landing: LANDING,
};

export const ROOT_LABELS: Record<string, string> = {
  en: "Website (English)",
  pcm: "Website (Pidgin)",
  faqs: "FAQs",
  help: "Help topics",
  landing: "Landing page",
};

// Words in a path that mean "this isn't copy" (links, images, ids...).
const NOT_COPY = /(^|\.)(href|src|url|image|img|icon|slug|id|key|color|colour|tone|alt|type|kind|variant|art)$/i;
const looksLikeLink = (s: string) => /^(\/|#|https?:|mailto:|tel:)/.test(s);

function collect(node: any, prefix: string, out: Record<string, string>) {
  if (typeof node === "string") {
    out[prefix] = node;
  } else if (Array.isArray(node)) {
    node.forEach((v, i) => collect(v, `${prefix}.${i}`, out));
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) collect(v, `${prefix}.${k}`, out);
  }
  // numbers, booleans and functions are never editable copy
}

// Snapshot of the shipped wording, taken once at load - before any override is
// applied - so "reset" and "what was it originally" always have an answer.
const DEFAULTS: Record<string, string> = {};
for (const [root, obj] of Object.entries(ROOTS)) collect(obj, root, DEFAULTS);

/** Every piece of copy an owner may edit: key -> original wording. */
export function editableCopy(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, text] of Object.entries(DEFAULTS)) {
    if (NOT_COPY.test(key) || looksLikeLink(text) || text.trim() === "") continue;
    out[key] = text;
  }
  return out;
}

function setPath(root: any, path: string[], value: string) {
  let node = root;
  for (let i = 0; i < path.length - 1; i++) {
    node = node?.[path[i]];
    if (node == null) return;
  }
  const last = path[path.length - 1];
  if (node != null && typeof node[last] === "string") node[last] = value;
}

/** Make the site's wording equal "shipped wording + these overrides". Safe to
 * call again with a different set: anything no longer overridden goes back. */
export function applyOverrides(overrides: Record<string, string> | null | undefined) {
  const wanted = overrides || {};
  const editable = editableCopy();
  for (const key of Object.keys(editable)) {
    const [root, ...path] = key.split(".");
    const next = key in wanted ? wanted[key] : editable[key];
    setPath(ROOTS[root], path, next);
  }
}

/** The server's list of rewordings, for the root layout. Never throws: if the
 * server can't be reached the site simply shows its shipped wording. */
export async function fetchOverrides(): Promise<Record<string, string>> {
  try {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
    const res = await fetch(`${base}/content`, { next: { revalidate: 60 } });
    if (!res.ok) return {};
    return (await res.json()).overrides || {};
  } catch {
    return {};
  }
}
