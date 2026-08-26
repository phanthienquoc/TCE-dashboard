'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import EngineControlPanel from './EngineControlPanel';

export default function EnginesPage() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-container app-header-inner">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="touch-target grid place-items-center rounded-2xl border border-violet-200/[0.09] bg-white/[0.02] text-[#a88bb5]" aria-label="Back to dashboard"><ArrowLeft className="size-4" /></Link>
            <div><p className="eyebrow">TCE</p><p className="account-email">Engine runtime</p></div>
          </div>
        </div>
      </header>
      <div className="app-container app-content">
        <EngineControlPanel />
      </div>
    </main>
  );
}
