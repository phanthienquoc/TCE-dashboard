'use client';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`tce-skeleton ${className}`} />;
}

export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return <div className="tce-page-skeleton" role="status" aria-label="Loading">
    <div className="tce-skeleton-head"><div className="tce-skeleton-copy"><Skeleton className="h-3 w-24" /><Skeleton className="mt-2 h-7 w-40" /></div><Skeleton className="h-10 w-10 rounded-xl" /></div>
    <div className="tce-skeleton-metrics">{Array.from({ length: 4 }, (_, index) => <div key={index} className="tce-skeleton-card"><Skeleton className="h-3 w-16" /><Skeleton className="mt-3 h-7 w-20" /></div>)}</div>
    <div className="tce-skeleton-list">{Array.from({ length: rows }, (_, index) => <div key={index} className="tce-skeleton-card"><div className="tce-skeleton-row"><Skeleton className="size-10 rounded-xl" /><div className="tce-skeleton-copy"><Skeleton className="h-4 w-32" /><Skeleton className="mt-2 h-3 w-48 max-w-full" /></div><Skeleton className="h-8 w-16 rounded-lg" /></div><div className="tce-skeleton-grid"><Skeleton className="h-12 rounded-xl" /><Skeleton className="h-12 rounded-xl" /><Skeleton className="h-12 rounded-xl" /></div></div>)}</div>
    <SkeletonStyles />
  </div>;
}

export function EngineRuntimeSkeleton() {
  return <div className="tce-skeleton-runtime" role="status" aria-label="Loading engine runtime">{Array.from({ length: 4 }, (_, index) => <div key={index} className="tce-skeleton-engine-row"><Skeleton className="size-10 rounded-xl" /><div className="tce-skeleton-copy"><Skeleton className="h-4 w-36" /><Skeleton className="mt-2 h-3 w-48 max-w-full" /></div><Skeleton className="h-8 w-14 rounded-full" /></div>)}<SkeletonStyles /></div>;
}

export function CampaignSkeleton() {
  return <div className="tce-skeleton-list" role="status" aria-label="Loading dividend rolling campaigns">{Array.from({ length: 4 }, (_, index) => <div key={index} className="tce-skeleton-card"><div className="tce-skeleton-row"><div className="tce-skeleton-copy"><Skeleton className="h-4 w-40" /><Skeleton className="mt-2 h-3 w-28" /></div><Skeleton className="h-7 w-16 rounded-full" /></div><div className="tce-skeleton-grid-three"><Skeleton className="h-16 rounded-xl" /><Skeleton className="h-16 rounded-xl" /><Skeleton className="h-16 rounded-xl" /></div></div>)}<SkeletonStyles /></div>;
}

export function DividendSkeleton() {
  return <div className="tce-skeleton-list" role="status" aria-label="Loading dividend events"><div className="tce-skeleton-filter"><Skeleton className="h-10 flex-1 rounded-xl" /><Skeleton className="h-10 flex-1 rounded-xl" /></div>{Array.from({ length: 6 }, (_, index) => <div key={index} className="tce-skeleton-card"><div className="tce-skeleton-row"><Skeleton className="h-5 w-14" /><Skeleton className="h-3 w-16" /><Skeleton className="ml-auto h-5 w-5 rounded-md" /></div><div className="tce-skeleton-grid-six">{Array.from({ length: 6 }, (_, item) => <Skeleton key={item} className="h-10 rounded-lg" />)}</div></div>)}<SkeletonStyles /></div>;
}

export function DetailSkeleton() {
  return <div className="tce-page-skeleton" role="status" aria-label="Loading details"><Skeleton className="h-8 w-36" /><div className="tce-skeleton-card"><div className="tce-skeleton-row"><Skeleton className="size-10 rounded-xl" /><div className="tce-skeleton-copy"><Skeleton className="h-4 w-40" /><Skeleton className="mt-2 h-3 w-56 max-w-full" /></div></div><div className="tce-skeleton-detail"><Skeleton className="h-10 w-full rounded-xl" /><Skeleton className="h-10 w-full rounded-xl" /><Skeleton className="h-28 w-full rounded-xl" /></div></div><SkeletonStyles /></div>;
}

export function XauPanelSkeleton() {
  return <div className="tce-page-skeleton" role="status" aria-label="Loading XAU engine"><div className="tce-skeleton-card"><div className="tce-skeleton-row"><Skeleton className="size-11 rounded-xl" /><div className="tce-skeleton-copy"><Skeleton className="h-5 w-40" /><Skeleton className="mt-2 h-3 w-56 max-w-full" /></div><Skeleton className="h-8 w-16 rounded-full" /></div><div className="tce-skeleton-chart"><Skeleton className="h-full w-full rounded-xl" /></div><div className="tce-skeleton-grid"><Skeleton className="h-12 rounded-xl" /><Skeleton className="h-12 rounded-xl" /><Skeleton className="h-12 rounded-xl" /></div></div><SkeletonStyles /></div>;
}

function SkeletonStyles() {
  return <style jsx global>{` .tce-skeleton{position:relative;overflow:hidden;background:color-mix(in srgb,var(--muted) 16%,var(--surface));border-radius:8px;flex:0 0 auto}.tce-skeleton::after{content:'';position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--primary) 12%,transparent),transparent);animation:tceSkeletonShimmer 1.35s ease-in-out infinite}.tce-page-skeleton,.tce-skeleton-list,.tce-skeleton-runtime{display:grid;gap:12px;width:100%}.tce-skeleton-head,.tce-skeleton-row{display:flex;align-items:center;gap:12px}.tce-skeleton-head{justify-content:space-between}.tce-skeleton-copy{min-width:0;flex:1}.tce-skeleton-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.tce-skeleton-card{border:1px solid var(--border);background:var(--surface-strong);border-radius:16px;padding:14px;min-width:0}.tce-skeleton-list{grid-template-columns:1fr}.tce-skeleton-grid,.tce-skeleton-grid-three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}.tce-skeleton-grid-six{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.tce-skeleton-filter{display:flex;gap:10px;padding:12px;border:1px solid var(--border);border-radius:16px;background:var(--surface-strong)}.tce-skeleton-engine-row{display:flex;align-items:center;gap:12px;min-height:76px;padding:12px;border:1px solid var(--border);border-radius:16px;background:var(--surface-strong)}.tce-skeleton-runtime{padding:12px}.tce-skeleton-chart{height:220px;margin-top:14px}.tce-skeleton-detail{display:grid;gap:10px;margin-top:16px}@keyframes tceSkeletonShimmer{100%{transform:translateX(100%)}}@media (min-width:768px){.tce-skeleton-metrics{grid-template-columns:repeat(4,minmax(0,1fr))}.tce-skeleton-grid-six{grid-template-columns:repeat(6,minmax(0,1fr))}}@media (prefers-reduced-motion:reduce){.tce-skeleton::after{animation:none}} `}</style>;
}
