import { MapPin, Truck } from "lucide-react";

export function BookCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
        <div className="h-full w-full animate-pulse bg-muted" />
        <div className="absolute left-3 top-3 h-5 w-16 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        <div className="mt-1 flex items-center gap-3">
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        </div>
        <div className="mt-2 flex items-end justify-between">
          <div className="h-5 w-16 animate-pulse rounded bg-muted" />
          <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
    </div>
  );
}
