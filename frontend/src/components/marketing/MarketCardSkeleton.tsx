// Placeholder in MarketCard's exact shape while the market list loads from
// the API (markets now come from the backend, not a bundled list).
export default function MarketCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-line bg-canvas" aria-hidden>
      <div className="h-48 animate-pulse bg-canvas-deep" />
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="h-6 w-2/3 animate-pulse rounded-full bg-canvas-deep" />
        <div className="h-4 w-1/2 animate-pulse rounded-full bg-canvas-deep" />
        <div className="h-4 w-full animate-pulse rounded-full bg-canvas-deep" />
        <div className="mt-2 h-9 w-32 animate-pulse rounded-full bg-canvas-deep" />
      </div>
    </div>
  );
}
