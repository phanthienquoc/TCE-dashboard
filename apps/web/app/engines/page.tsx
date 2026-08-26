'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import EngineControlPanel from './EngineControlPanel';

export default function EnginesPage() {
  return (
    <main className="min-h-svh overflow-x-clip bg-[#090510] text-[#f4effa]">
      <header className="sticky top-0 z-40 border-b border-violet-200/[0.08] bg-[#0b0611]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/dashboard" className="grid size-9 place-items-center rounded-full border border-violet-200/[0.08] text-[#a88bb5] hover:text-white" aria-label="Back to dashboard">
            <ArrowLeft className="size-4" />
          </Link>
          <div><p className="text-[10px] uppercase tracking-[.14em] text-[#9d8fa8]">TCE</p><p className="text-sm font-semibold">Engine runtime</p></div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-5 sm:px-6 sm:pt-7">
        <EngineControlPanel />
      </div>
    </main>
  );
}
