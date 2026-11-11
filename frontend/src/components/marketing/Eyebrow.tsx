/**
 * The marketing site's lead-in line: small tracked capitals in the body sans,
 * accent colour, no pill or box. Used above the hero headline and every section heading so
 * the whole page opens the same way.
 */
export default function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={"font-sans text-xs font-bold uppercase tracking-[0.2em] text-brand-orange-dark sm:text-[0.8rem] " + className}>
      {children}
    </p>
  );
}
