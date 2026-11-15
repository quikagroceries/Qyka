export const TRUST_ICONS = ["wallet", "chat", "person", "help"] as const;

export default function TrustIcon({ kind }: { kind: (typeof TRUST_ICONS)[number] }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "wallet")
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
        <path d="M3 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v2h-3.5a3 3 0 0 0 0 6H18v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" {...p} />
        <circle cx="15.5" cy="12" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  if (kind === "chat")
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
        <path d="M4 12a8 8 0 1 1 3.3 6.46L4 19.5l1.1-3.4A7.96 7.96 0 0 1 4 12Z" {...p} />
        <circle cx="9" cy="12" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="15" cy="12" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    );
  if (kind === "person")
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
        <circle cx="12" cy="8.3" r="3.3" {...p} />
        <path d="M5 20c1-4 4-5.9 7-5.9s6 1.9 7 5.9" {...p} />
        <path d="M9.3 14.7l1.9 1.9 3.4-3.4" {...p} strokeWidth={1.6} />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <path d="M4.5 13v-1a7.5 7.5 0 0 1 15 0v1" {...p} />
      <rect x="2.5" y="13" width="4" height="6" rx="1.6" {...p} />
      <rect x="17.5" y="13" width="4" height="6" rx="1.6" {...p} />
      <path d="M19.5 19v.5a2 2 0 0 1-2 2h-1.2" {...p} />
    </svg>
  );
}
