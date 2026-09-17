'use client';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`tce-skeleton ${className}`} />;
}

export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-40" />
        </div>
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-2xl border border-black/5 bg-white p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-3 h-7 w-20" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="rounded-2xl border border-black/5 bg-white p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48 max-w-full" />
              </div>
              <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EngineRuntimeSkeleton() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4" role="status" aria-label="Loading engine runtime">
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex min-h-[76px] items-center gap-4 rounded-2xl border border-white/5 px-4">
            <Skeleton className="size-10 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-48 max-w-full" />
            </div>
            <Skeleton className="h-8 w-14 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CampaignSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading dividend rolling campaigns">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="rounded-2xl border border-black/5 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DividendSkeleton() {
  return (
    <div className="min-h-[24rem] space-y-3" role="status" aria-label="Loading dividend events">
      <div className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-3">
        <Skeleton className="h-10 flex-1 rounded-xl" />
        <Skeleton className="h-10 flex-1 rounded-xl" />
      </div>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="rounded-2xl border border-black/5 bg-white p-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="ml-auto h-5 w-5 rounded-md" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 md:grid-cols-6">
            {Array.from({ length: 6 }, (_, item) => (
              <Skeleton key={item} className="h-10 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading details">
      <Skeleton className="h-8 w-36" />
      <div className="rounded-2xl border border-black/5 bg-white p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
        </div>
        <div className="mt-5 space-y-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
